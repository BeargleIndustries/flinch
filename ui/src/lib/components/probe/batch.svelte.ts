// The batch run (brief 7.8): "Run every probe" streams
// POST /api/sessions/{id}/batch {probe_ids: null, delay_ms} through the
// streams registry under `batch:{sessionId}`, so the status strip shows it and
// it keeps running when you leave /probe. This module holds the run's state;
// BatchRun.svelte draws it.
//
// Events (B01): `start {batch_id, total}` first, then `progress` per saved run
// or `error {batch_id, probe_id, error}` per failed probe, then
// `complete {completed, total, failed, cancelled}`. An `error` without a
// probe_id is the batch itself failing.
//
// Cancel (D17) is the registry's: the route's own cancel, then the abort. The
// cancel here POSTs /api/batch/{batch_id}/cancel, which sets the batch row's
// flag the server reads before every probe; the strip's Cancel takes the same
// path. After it the probe in flight shows Cancelled and the rest Not run.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { BatchBody } from '$lib/api/types';
import { PROBE } from '$lib/copy/probe';
import { friendlyError } from '$lib/errors';
import { probes } from '$lib/stores/probe.svelte';
import { status } from '$lib/stores/status.svelte';
import { streams } from '$lib/stores/streams-registry.svelte';
import { landRow, planRows, settleRows, type BatchRow, type PlannedProbe } from './batch-rows';

export type BatchPhase = 'starting' | 'running' | 'stopping' | 'finished' | 'stopped' | 'failed';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export const batchStreamId = (sessionId: number) => `batch:${sessionId}`;

/**
 * A batch over a chosen set of probes (Framings' "Run in this session", brief
 * 8.1): the probe ids sent, the screen the strip's "Show" returns to, and the
 * title the panel and the strip use. Without it the batch runs every probe of
 * the session from /probe.
 */
export interface BatchScope {
  probeIds: number[];
  route: string;
  label: string;
}

class BatchRun {
  /** The session the batch belongs to; the panel shows only in that session. */
  sessionId = $state<number | null>(null);
  /** From the `start` event; the cancel target. */
  batchId = $state<number | null>(null);
  /** Null when no batch has run since the last Back. */
  phase = $state<BatchPhase | null>(null);
  delayMs = $state(0);
  total = $state(0);
  completed = $state(0);
  failed = $state(0);
  rows = $state<BatchRow[]>([]);
  /** The panel's running title; null is "Running all probes". */
  label = $state<string | null>(null);
  /** The batch-level failure (not a single probe's), as a friendly line. */
  error = $state<string | null>(null);

  #plan: PlannedProbe[] = [];
  /** Bumped by each start, so a superseded stream's events are dropped. */
  #token = 0;

  get live(): boolean {
    return this.phase === 'starting' || this.phase === 'running' || this.phase === 'stopping';
  }

  /** Whether the panel replaces the idle view for `sessionId`. */
  shownFor(sessionId: number | null | undefined): boolean {
    return this.phase !== null && sessionId != null && this.sessionId === sessionId;
  }

  /**
   * Starts the batch over the session's probe set, or over `scope.probeIds`.
   * Resolves when the stream has ended.
   */
  async start(
    sessionId: number,
    delayMs: number,
    plan: readonly PlannedProbe[],
    scope?: BatchScope,
  ): Promise<void> {
    if (this.live && this.sessionId === sessionId) return;
    const token = ++this.#token;
    const id = batchStreamId(sessionId);
    this.#plan = plan.map((p) => ({ id: p.id, name: p.name, domain: p.domain }));
    this.sessionId = sessionId;
    this.batchId = null;
    this.phase = 'starting';
    this.delayMs = delayMs;
    this.total = plan.length;
    this.completed = 0;
    this.failed = 0;
    this.rows = planRows(this.#plan, plan.length);
    this.error = null;
    this.label = scope?.label ?? null;

    const body: BatchBody = { probe_ids: scope?.probeIds ?? null, delay_ms: delayMs };
    await streams.open(
      {
        id,
        route: scope?.route ?? '/probe',
        label: scope?.label ?? PROBE.batchTitle,
        total: plan.length || undefined,
        cancel: () => this.#cancelOnServer(token),
      },
      ROUTES.runBatch,
      { params: { session_id: sessionId }, body },
      {
        on: (name, data) => {
          if (token === this.#token) this.#on(id, name, data);
        },
        error: (err) => {
          if (token === this.#token) this.#fail(err);
        },
        done: ({ aborted }) => {
          if (token === this.#token) this.#end(aborted);
        },
      },
    );
  }

  /** Cancel from the panel: the same path as the strip's Cancel. */
  cancel(): Promise<void> {
    if (this.sessionId === null || !this.live) return Promise.resolve();
    return streams.cancel(batchStreamId(this.sessionId));
  }

  /** Back: the panel closes and the idle view returns. */
  dismiss(): void {
    if (this.live) return;
    this.phase = null;
    this.rows = [];
    this.error = null;
  }

  async #cancelOnServer(token: number): Promise<void> {
    if (token !== this.#token) return;
    this.phase = 'stopping';
    const batchId = this.batchId;
    // Before `start` there is no batch row yet; the abort alone closes the
    // generator, which marks the row cancelled itself (B01).
    if (batchId === null) return;
    try {
      await status.track(request(ROUTES.cancelBatch, { params: { batch_id: batchId } }));
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
    }
  }

  #on(id: string, name: string, data: unknown): void {
    if (!isRecord(data)) return;
    if (name === 'start') {
      this.batchId = num(data.batch_id);
      const total = num(data.total) ?? this.total;
      if (total !== this.total || this.rows.length !== total) {
        this.total = total;
        this.rows = planRows(this.#plan, total);
      }
      if (this.phase === 'starting') this.phase = 'running';
      streams.report(id, { total, completed: 0 });
      return;
    }
    if (name === 'progress' || (name === 'error' && num(data.probe_id) !== null)) {
      const probeId = num(data.probe_id) ?? -1;
      const failedProbe = name === 'error';
      this.rows = landRow(
        this.rows,
        {
          probeId,
          name: str(data.probe_name) ?? this.#nameOf(probeId),
          runId: num(data.run_id),
          cls: str(data.classification),
          error: failedProbe ? friendlyError(str(data.error) ?? '').message : null,
        },
        (pid) => this.#plan.find((p) => p.id === pid)?.domain ?? null,
      );
      this.completed = num(data.completed) ?? this.completed + 1;
      this.total = num(data.total) ?? this.total;
      if (failedProbe) this.failed += 1;
      streams.report(id, { completed: this.completed, total: this.total, failed: this.failed });
      return;
    }
    if (name === 'error') {
      this.#fail(str(data.error) ?? '');
      return;
    }
    if (name === 'complete') {
      this.completed = num(data.completed) ?? this.completed;
      this.total = num(data.total) ?? this.total;
      this.failed = num(data.failed) ?? this.failed;
      const cancelled = data.cancelled === true || this.phase === 'stopping';
      this.rows = settleRows(this.rows);
      this.phase = cancelled ? 'stopped' : 'finished';
      streams.report(id, { completed: this.completed, total: this.total, failed: this.failed });
    }
  }

  #nameOf(probeId: number): string {
    return this.#plan.find((p) => p.id === probeId)?.name ?? `#${probeId}`;
  }

  #fail(err: unknown): void {
    const f = friendlyError(err);
    this.error = f.message;
    this.rows = settleRows(this.rows);
    this.phase = 'failed';
    status.error(f.message, f.details);
  }

  #end(aborted: boolean): void {
    if (this.live) {
      // Aborted by Cancel (or by a newer stream); or the stream ended with no
      // `complete`. Either way the batch is over and nothing else will land.
      this.rows = settleRows(this.rows);
      const whole = !aborted && this.phase !== 'stopping' && this.completed >= this.total;
      this.phase = whole ? 'finished' : 'stopped';
    }
    // The rail's stats and run history follow (brief 7.8: session stats reload).
    void probes.refreshActivity();
  }
}

export const batch = new BatchRun();
