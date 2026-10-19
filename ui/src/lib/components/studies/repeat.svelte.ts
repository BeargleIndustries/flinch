// Repeat runs state (brief 8.3, plan T24, I17). The session's summaries
// (GET /api/sessions/{id}/stat-runs), the selected run's detail and
// distribution (GET /api/stat-runs/{id} and /distribution), and the live run:
// POST /api/sessions/{id}/stat-run {probe_ids, repeat_count} streamed through
// the registry under `statrun:{sessionId}`, so the status strip shows it and
// it keeps running when you leave the screen. The sidecar builds every call's
// target with the session's model and system prompt (B15, I17).
//
// Stop: the stat-run route has no cancel request, so the registry's cancel is
// the abort alone; closing the stream stops the sidecar's generator after the
// call in flight. The stopped run's row keeps status `running` until the next
// start sweeps it to `failed` (B23).
//
// Every request goes through status.track; screens call `load()` from an
// $effect inside `untrack`.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import { REPEAT } from '$lib/copy/studies';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import { streams } from '$lib/stores/streams-registry.svelte';
import type { ClsCounts } from '../class-bar';
import {
  applyEvent,
  distributionCounts,
  initialLive,
  settle,
  sortSummaries,
  type LiveRun,
  type PlannedProbe,
  type StatRunBody,
  type StatRunDetail,
  type StatSummary,
} from './repeat';

/** The screen's route; the strip's "Show" link returns here. */
export const REPEAT_ROUTE = '/studies/repeat';

export const statRunStreamId = (sessionId: number) => `statrun:${sessionId}`;

export type RepeatPhase = 'running' | 'stopping' | 'finished' | 'stopped' | 'failed';

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

class RepeatStore {
  /** The session whose runs are listed. */
  sessionId = $state<number | null>(null);
  summaries = $state<StatSummary[]>([]);
  /** The list for `sessionId` has loaded at least once. */
  loaded = $state(false);
  listError = $state<string | null>(null);

  selectedId = $state<number | null>(null);
  detail = $state<StatRunDetail | null>(null);
  /** The selected run's counts per badge, from its distribution. */
  counts = $state<ClsCounts | null>(null);
  detailLoading = $state(false);
  detailError = $state<string | null>(null);

  /** The live (or last) run and the session it belongs to. */
  live = $state<LiveRun | null>(null);
  liveSessionId = $state<number | null>(null);
  phase = $state<RepeatPhase | null>(null);

  #listToken = 0;
  #detailToken = 0;
  #runToken = 0;

  get running(): boolean {
    return this.phase === 'running' || this.phase === 'stopping';
  }

  /** Whether the live panel shows for `sessionId`. */
  shownFor(sessionId: number | null | undefined): boolean {
    return this.phase !== null && sessionId != null && this.liveSessionId === sessionId;
  }

  /**
   * GET /api/sessions/{id}/stat-runs, newest first. Keeps the selected run
   * when it is still listed, else selects the newest. With `select`, selects
   * (and reads again) that run.
   */
  async load(sessionId: number, opts: { select?: number } = {}): Promise<void> {
    if (sessionId !== this.sessionId) {
      this.sessionId = sessionId;
      this.summaries = [];
      this.loaded = false;
      this.listError = null;
      this.#clearDetail();
    }
    const token = ++this.#listToken;
    try {
      const rows = await status.track(
        request<unknown>(ROUTES.listStatRuns, { params: { session_id: sessionId } }),
      );
      if (token !== this.#listToken) return;
      this.summaries = sortSummaries(rows);
      this.listError = null;
      const listed = (id: number | null | undefined) =>
        id != null && this.summaries.some((s) => s.stat_run_id === id);
      if (listed(opts.select)) await this.select(opts.select as number);
      else if (listed(this.selectedId)) return;
      else if (this.summaries.length > 0) await this.select(this.summaries[0].stat_run_id);
      else this.#clearDetail();
    } catch (e) {
      if (token === this.#listToken) this.listError = report(e);
    } finally {
      if (token === this.#listToken) this.loaded = true;
    }
  }

  /** Reads a run's detail (iterations with latency and text) and its distribution. */
  async select(statRunId: number): Promise<void> {
    this.selectedId = statRunId;
    const token = ++this.#detailToken;
    this.detailLoading = true;
    try {
      const params = { stat_run_id: statRunId };
      const [detail, dist] = await status.track(
        Promise.all([
          request<StatRunDetail>(ROUTES.getStatRun, { params }),
          request<unknown>(ROUTES.getStatRunDistribution, { params }),
        ]),
      );
      if (token !== this.#detailToken) return;
      this.detail = {
        ...detail,
        iterations: Array.isArray(detail?.iterations) ? detail.iterations : [],
      };
      this.counts = distributionCounts(dist);
      this.detailError = null;
    } catch (e) {
      if (token !== this.#detailToken) return;
      this.detail = null;
      this.counts = null;
      this.detailError = report(e);
    } finally {
      if (token === this.#detailToken) this.detailLoading = false;
    }
  }

  /**
   * Runs `plan` (one or several probes) `repeat` times each in the session.
   * Resolves when the stream has ended.
   */
  async run(sessionId: number, plan: readonly PlannedProbe[], repeat: number): Promise<void> {
    if (plan.length === 0) return;
    if (this.running && this.liveSessionId === sessionId) {
      status.note(REPEAT.busy);
      return;
    }
    const token = ++this.#runToken;
    const id = statRunStreamId(sessionId);
    this.liveSessionId = sessionId;
    this.live = initialLive(plan, repeat);
    this.phase = 'running';

    const body: StatRunBody = { probe_ids: plan.map((p) => p.id), repeat_count: repeat };
    await streams.open(
      {
        id,
        route: REPEAT_ROUTE,
        label: REPEAT.stripLabel(plan.length, repeat),
        total: plan.length * repeat,
        cancel: () => {
          if (token === this.#runToken && this.phase === 'running') this.phase = 'stopping';
        },
      },
      ROUTES.startStatRun,
      { params: { session_id: sessionId }, body },
      {
        on: (name, data) => {
          if (token === this.#runToken) this.#on(id, sessionId, name, data);
        },
        error: (err) => {
          if (token === this.#runToken) this.#fail(err);
        },
        done: ({ aborted }) => {
          if (token === this.#runToken) this.#end(sessionId, aborted);
        },
      },
    );
  }

  /** Stop from the panel: the same path as the strip's Cancel. */
  cancel(): Promise<void> {
    if (!this.running || this.liveSessionId === null) return Promise.resolve();
    return streams.cancel(statRunStreamId(this.liveSessionId));
  }

  /** Close the live panel once the run has ended. */
  dismiss(): void {
    if (this.running) return;
    this.phase = null;
    this.live = null;
  }

  #clearDetail(): void {
    ++this.#detailToken;
    this.selectedId = null;
    this.detail = null;
    this.counts = null;
    this.detailError = null;
    this.detailLoading = false;
  }

  #on(id: string, sessionId: number, name: string, data: unknown): void {
    const live = this.live;
    if (!live) return;
    // The whole stream failing (an `error` that is not about one probe).
    if (name === 'error' && isRecord(data) && data.batch_probe_index === undefined) {
      this.#fail(data.error ?? data.message ?? '');
      return;
    }
    const next = applyEvent(live, name, data);
    this.live = next;
    streams.report(id, { completed: next.completed, total: next.total, failed: next.failed });

    // Each finished probe lands in the list and becomes the selected run.
    if (name === 'complete' && next.lastStatRunId !== null && this.sessionId === sessionId)
      void this.load(sessionId, { select: next.lastStatRunId });
    if (name === 'batch_complete' && this.running)
      this.phase = this.phase === 'stopping' ? 'stopped' : 'finished';
  }

  #fail(err: unknown): void {
    const f = friendlyError(err);
    if (this.live) this.live = { ...settle(this.live), error: f.message };
    this.phase = 'failed';
    status.error(f.message, f.details);
  }

  #end(sessionId: number, aborted: boolean): void {
    if (this.running && this.live) {
      // Stopped (or the stream ended without batch_complete): nothing else lands.
      this.live = settle(this.live);
      this.phase = !aborted && this.live.finished ? 'finished' : 'stopped';
    }
    // The list follows: statuses and counts as the sidecar has them now.
    if (this.sessionId === sessionId) {
      const last = this.live?.lastStatRunId;
      void this.load(sessionId, last != null ? { select: last } : {});
    }
  }
}

export const repeat = new RepeatStore();
