// Browse state (brief 9.1, plan T29). The overview is GET /api/dashboard/stats;
// the lists are GET /api/dashboard/sessions (Model compare sessions left out,
// B19, D29), /api/dashboard/comparisons, /api/experiments and
// /api/dashboard/sequences, with probe and strategy names from GET
// /api/probes and /api/strategies for the sequence rows. Deletes go through
// the session store (sessions) or their own routes; Clear all is DELETE
// /api/dashboard/clear-all {confirm}, after which the session store reloads
// (the current session becomes null) and the rail's probes are read again.
//
// The detail routes' reads are plain functions at the end: each screen keeps
// its own state and calls them from an $effect inside `untrack`. Every request
// goes through status.track.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type {
  DashboardStats,
  Experiment,
  Probe,
  RunTurn,
  SessionDetail as SessionDetailReply,
} from '$lib/api/types';
import { BROWSE } from '$lib/copy/data';
import { friendlyError } from '$lib/errors';
import { probes } from '$lib/stores/probe.svelte';
import { session } from '$lib/stores/session.svelte';
import { status } from '$lib/stores/status.svelte';
import { sortComparisons, type ComparisonSummary } from '../studies/compare';
import {
  strategyTitle,
  type SequenceSummary,
  type SequenceTurn,
  type Strategy,
} from '../studies/sequences';
import {
  CLEAR_ALL_CONFIRM,
  toFindings,
  toSequences,
  toSessions,
  toStudies,
  type BrowseSequence,
  type BrowseSession,
  type ClearAllReply,
  type Finding,
  type SessionSummary,
} from './browse';

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

/** A list read that may fail on its own without blanking the screen. */
async function soft<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch (e) {
    report(e);
    return fallback;
  }
}

class BrowseStore {
  stats = $state<DashboardStats | null>(null);
  sessions = $state<BrowseSession[]>([]);
  comparisons = $state<ComparisonSummary[]>([]);
  studies = $state<Experiment[]>([]);
  sequences = $state<BrowseSequence[]>([]);
  probeNames = $state<Record<number, string>>({});
  strategyNames = $state<Record<number, string>>({});
  /** The first read has landed (successfully or not). */
  loaded = $state(false);
  error = $state<string | null>(null);
  /** Row keys (`session-3`) with a delete in flight. */
  removing = $state<Set<string>>(new Set());

  #token = 0;

  /** Reads the overview and every list again. */
  async load(): Promise<void> {
    const token = ++this.#token;
    try {
      const [stats, sessions, comparisons, sequences, studies, probeList, strategies] =
        await status.track(
          Promise.all([
            request<DashboardStats>(ROUTES.dashboardStats),
            request<unknown>(ROUTES.dashboardSessions),
            request<unknown>(ROUTES.dashboardComparisons),
            request<unknown>(ROUTES.dashboardSequences),
            soft(request<unknown>(ROUTES.listExperiments), { experiments: [] }),
            soft(request<Probe[]>(ROUTES.listProbes), [] as Probe[]),
            soft(request<Strategy[]>(ROUTES.listStrategies), [] as Strategy[]),
          ]),
        );
      if (token !== this.#token) return;
      this.stats = stats;
      this.sessions = toSessions(sessions);
      this.comparisons = sortComparisons(comparisons);
      this.sequences = toSequences(sequences);
      this.studies = toStudies(studies);
      this.probeNames = Object.fromEntries(
        (Array.isArray(probeList) ? probeList : []).map((p) => [p.id, p.name]),
      );
      this.strategyNames = Object.fromEntries(
        (Array.isArray(strategies) ? strategies : []).map((s) => [s.id, strategyTitle(s.name)]),
      );
      this.error = null;
    } catch (e) {
      if (token === this.#token) this.error = report(e);
    } finally {
      if (token === this.#token) this.loaded = true;
    }
  }

  /** The overview alone, after a delete. */
  async #reloadStats(): Promise<void> {
    try {
      this.stats = await status.track(request<DashboardStats>(ROUTES.dashboardStats));
    } catch (e) {
      report(e);
    }
  }

  async #removing<T>(key: string, work: () => Promise<T>): Promise<T | null> {
    if (this.removing.has(key)) return null;
    this.removing = new Set([...this.removing, key]);
    try {
      return await work();
    } catch (e) {
      report(e);
      return null;
    } finally {
      const next = new Set(this.removing);
      next.delete(key);
      this.removing = next;
    }
  }

  /** DELETE /api/sessions/{id} through the session store (it forgets a deleted current session). */
  async removeSession(id: number): Promise<boolean> {
    const ok = await this.#removing(`session-${id}`, async () => {
      await status.track(session.remove(id));
      return true;
    });
    if (!ok) return false;
    this.sessions = this.sessions.filter((s) => s.id !== id);
    this.sequences = this.sequences.filter((s) => s.session_id !== id);
    status.note(BROWSE.sessionDeleted);
    await this.#reloadStats();
    return true;
  }

  /** DELETE /api/comparisons/{id}. */
  async removeComparison(id: number): Promise<boolean> {
    const ok = await this.#removing(`comparison-${id}`, async () => {
      await status.track(request(ROUTES.deleteComparison, { params: { comparison_id: id } }));
      return true;
    });
    if (!ok) return false;
    this.comparisons = this.comparisons.filter((c) => c.id !== id);
    status.note(BROWSE.comparisonDeleted);
    await this.#reloadStats();
    return true;
  }

  /** DELETE /api/sequences/{id}. */
  async removeSequence(id: number): Promise<boolean> {
    const ok = await this.#removing(`sequence-${id}`, async () => {
      await status.track(request(ROUTES.deleteSequence, { params: { sequence_id: id } }));
      return true;
    });
    if (!ok) return false;
    this.sequences = this.sequences.filter((s) => s.id !== id);
    status.note(BROWSE.sequenceDeleted);
    await this.#reloadStats();
    return true;
  }

  /**
   * DELETE /api/dashboard/clear-all. Throws the request's error for the dialog
   * to show inline. On success the session store reloads (no session is left,
   * so the current one becomes null), the probe store reloads and Browse reads
   * everything again.
   */
  async clearAll(): Promise<ClearAllReply> {
    const reply = await status.track(
      request<ClearAllReply>(ROUTES.clearAllData, { body: { confirm: CLEAR_ALL_CONFIRM } }),
    );
    await Promise.all([session.refresh(), this.load()]);
    await probes.reload();
    return reply;
  }
}

export const browse = new BrowseStore();

// ── Detail reads ───────────────────────────────────────────────

/** GET /api/sessions/{id} and its export summary, together. */
export async function readSession(
  id: number,
): Promise<{ detail: SessionDetailReply; summary: SessionSummary }> {
  const [detail, summary] = await status.track(
    Promise.all([
      request<SessionDetailReply>(ROUTES.getSession, { params: { session_id: id } }),
      request<SessionSummary>(ROUTES.exportSessionSummary, { params: { session_id: id } }),
    ]),
  );
  return { detail, summary };
}

/** GET /api/sessions/{id}/findings. */
export async function readFindings(id: number): Promise<Finding[]> {
  return toFindings(
    await status.track(request<unknown>(ROUTES.getSessionFindings, { params: { session_id: id } })),
  );
}

/** GET /api/runs/{id}/turns. */
export function readRunTurns(runId: number): Promise<RunTurn[]> {
  return status.track(request<RunTurn[]>(ROUTES.listRunTurns, { params: { run_id: runId } }));
}

/** GET /api/sequences/{id}. */
export function readSequence(id: number): Promise<SequenceSummary> {
  return status.track(
    request<SequenceSummary>(ROUTES.getSequence, { params: { sequence_id: id } }),
  );
}

/** GET /api/sequence-runs/{id}/turns. */
export function readSequenceTurns(runId: number): Promise<SequenceTurn[]> {
  return status.track(
    request<SequenceTurn[]>(ROUTES.listSequenceRunTurns, { params: { run_id: runId } }),
  );
}
