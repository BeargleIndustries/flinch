// Model compare state (brief 8.5, plan T27, D29). Set up reads GET
// /api/models and GET /api/probes; Run is one synchronous request, POST
// /api/compare/run {probe_ids, models, system_prompt} (JSON, no stream), that
// can take minutes (R11): the screen shows a working line with the expected
// duration and the status strip shows the job until the reply lands, so
// leaving the screen does not lose it. A custom prompt is first saved with
// POST /api/probes. Past comparisons: GET /api/comparisons; one comparison:
// GET /api/comparisons/{id}; a cell's conversation: GET /api/runs/{id}/turns;
// delete: DELETE /api/comparisons/{id} (committed after B25).
//
// The sidecar creates one session per model for every run (D29); the
// session switcher hides them by their notes prefix (isCompareSession).
//
// Every request goes through status.track; screens call the loaders from an
// $effect inside `untrack`.
import { ApiError, request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { ModelProvider, Probe, RunTurn } from '$lib/api/types';
import { COMPARE } from '$lib/copy/studies';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import {
  COMPARE_ROUTE,
  customProbeBody,
  expectedMinutes,
  sortComparisons,
  toDetail,
  type CompareRunReply,
  type ComparisonDetail,
  type ComparisonSummary,
} from './compare';

/** The strip's job id while a comparison runs. */
export const COMPARE_JOB = 'compare:run';

export interface CompareRunState {
  running: boolean;
  startedAt: number;
  models: number;
  probes: number;
  minutes: number;
  error: string | null;
  /** The saved comparison, once the reply lands. */
  comparisonId: number | null;
}

export interface TurnsState {
  loading: boolean;
  turns: RunTurn[];
  error: string | null;
}

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

class CompareStore {
  // Set up
  groups = $state<ModelProvider[]>([]);
  groupsLoaded = $state(false);
  allProbes = $state<Probe[]>([]);
  allProbesLoaded = $state(false);

  // Past comparisons
  list = $state<ComparisonSummary[]>([]);
  listLoaded = $state(false);
  listError = $state<string | null>(null);
  /** Ids with a delete in flight. */
  removing = $state<Set<number>>(new Set());

  // The run
  run = $state<CompareRunState | null>(null);

  // One comparison
  detailId = $state<number | null>(null);
  detail = $state<ComparisonDetail | null>(null);
  detailLoading = $state(false);
  detailError = $state<string | null>(null);
  notFound = $state(false);
  turns = $state<Record<number, TurnsState>>({});

  #listToken = 0;
  #detailToken = 0;

  get running(): boolean {
    return this.run?.running === true;
  }

  /** GET /api/models and GET /api/probes, read on every visit. */
  async loadSetup(): Promise<void> {
    const models = status
      .track(request<ModelProvider[]>(ROUTES.listModels))
      .then((g) => (this.groups = Array.isArray(g) ? g : []))
      .catch(report)
      .finally(() => (this.groupsLoaded = true));
    const probes = status
      .track(request<Probe[]>(ROUTES.listProbes))
      .then((p) => (this.allProbes = Array.isArray(p) ? p : []))
      .catch(report)
      .finally(() => (this.allProbesLoaded = true));
    await Promise.all([models, probes]);
  }

  /** GET /api/comparisons, newest first. */
  async loadList(): Promise<void> {
    const token = ++this.#listToken;
    try {
      const rows = await status.track(request<unknown>(ROUTES.listComparisons));
      if (token !== this.#listToken) return;
      this.list = sortComparisons(rows);
      this.listError = null;
    } catch (e) {
      if (token === this.#listToken) this.listError = report(e);
    } finally {
      if (token === this.#listToken) this.listLoaded = true;
    }
  }

  /**
   * Saves the custom prompt (when given) as a probe, then runs the comparison.
   * Resolves with the saved comparison's id, or null when it failed.
   */
  async start(opts: {
    models: string[];
    probeIds: number[];
    custom: string;
    systemPrompt: string;
  }): Promise<number | null> {
    if (this.running) {
      status.note(COMPARE.busy);
      return null;
    }
    const probeIds = [...opts.probeIds];
    const probes = probeIds.length + (opts.custom.trim() ? 1 : 0);
    this.run = {
      running: true,
      startedAt: Date.now(),
      models: opts.models.length,
      probes,
      minutes: expectedMinutes(probes),
      error: null,
      comparisonId: null,
    };
    status.progress(COMPARE_JOB, {
      label: COMPARE.strip(opts.models.length, probes),
      completed: 0,
      total: probes,
      route: COMPARE_ROUTE,
    });
    try {
      if (opts.custom.trim()) {
        const probe = await status.track(
          request<Probe>(ROUTES.createProbe, { body: customProbeBody(opts.custom, Date.now()) }),
        );
        probeIds.push(probe.id);
      }
      const reply = await status.track(
        request<CompareRunReply>(ROUTES.runCompare, {
          body: { probe_ids: probeIds, models: opts.models, system_prompt: opts.systemPrompt },
        }),
      );
      const id = typeof reply?.comparison_id === 'number' ? reply.comparison_id : null;
      this.run = { ...this.run, running: false, comparisonId: id };
      status.note(COMPARE.finished);
      void this.loadList();
      return id;
    } catch (e) {
      const message = report(e);
      if (this.run) this.run = { ...this.run, running: false, error: message };
      return null;
    } finally {
      status.clearProgress(COMPARE_JOB);
    }
  }

  /** Hide the finished run's line. */
  dismiss(): void {
    if (!this.running) this.run = null;
  }

  /** GET /api/comparisons/{id}. */
  async open(id: number): Promise<void> {
    if (id !== this.detailId) {
      this.detailId = id;
      this.detail = null;
      this.turns = {};
    }
    const token = ++this.#detailToken;
    this.detailLoading = true;
    this.notFound = false;
    try {
      const raw = await status.track(
        request<unknown>(ROUTES.getComparison, { params: { comparison_id: id } }),
      );
      if (token !== this.#detailToken) return;
      this.detail = toDetail(raw);
      this.detailError = null;
    } catch (e) {
      if (token !== this.#detailToken) return;
      this.detail = null;
      if (e instanceof ApiError && e.status === 404) {
        this.notFound = true;
        this.detailError = null;
      } else {
        this.detailError = report(e);
      }
    } finally {
      if (token === this.#detailToken) this.detailLoading = false;
    }
  }

  /** GET /api/runs/{id}/turns for one cell, read once per visit. */
  async loadTurns(runId: number): Promise<void> {
    const cur = this.turns[runId];
    if (cur && (cur.loading || !cur.error)) return;
    this.turns = { ...this.turns, [runId]: { loading: true, turns: [], error: null } };
    try {
      const turns = await status.track(
        request<RunTurn[]>(ROUTES.listRunTurns, { params: { run_id: runId } }),
      );
      this.turns = {
        ...this.turns,
        [runId]: { loading: false, turns: Array.isArray(turns) ? turns : [], error: null },
      };
    } catch (e) {
      this.turns = { ...this.turns, [runId]: { loading: false, turns: [], error: report(e) } };
    }
  }

  /** DELETE /api/comparisons/{id}. Resolves true once it is gone. */
  async remove(id: number): Promise<boolean> {
    if (this.removing.has(id)) return false;
    this.removing = new Set([...this.removing, id]);
    try {
      await status.track(request(ROUTES.deleteComparison, { params: { comparison_id: id } }));
      this.list = this.list.filter((c) => c.id !== id);
      if (this.detailId === id) {
        this.detailId = null;
        this.detail = null;
        this.turns = {};
      }
      if (this.run?.comparisonId === id) this.run = null;
      status.note(COMPARE.deleted);
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      const next = new Set(this.removing);
      next.delete(id);
      this.removing = next;
    }
  }
}

export const compare = new CompareStore();
