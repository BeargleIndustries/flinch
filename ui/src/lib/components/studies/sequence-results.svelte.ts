// Sequences Results state (brief 8.4 Results tab, D21, I20, plan T26).
//
// Session level: GET /api/sessions/{id}/thresholds (every completed sequence,
// kept for the strategy choices and the effectiveness average), the same
// route with `?strategy_id=` when the filter is set, and GET
// /api/sessions/{id}/strategy-effectiveness. The sidecar counts completed
// sequences only (I20), so the rows are shown as sent; the sequences left out
// are listed from the sequences store for the note.
//
// The picked sequence: GET /api/sequences/{id} (summary and runs, cached in
// the sequences store), GET /api/sequences/{id}/whittling and GET
// /api/sequences/{id}/turn-classifications; a run's transcript is GET
// /api/sequence-runs/{id}/turns when the run is opened.
//
// Every request goes through status.track; screens call these from an
// $effect inside `untrack`.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import {
  excludedSequences,
  parseEffectiveness,
  parseThresholds,
  stripRuns,
  type ClassifiedRun,
  type EffectivenessRow,
  type ThresholdRow,
  type WhittlingRow,
} from './sequence-results';
import type { Sequence, SequenceTurn } from './sequences';
import { sequences } from './sequences.svelte';

export interface SequenceDetail {
  loading: boolean;
  error: string | null;
  whittling: WhittlingRow[];
  strips: ClassifiedRun[];
}

export interface RunTurns {
  loading: boolean;
  error: string | null;
  turns: SequenceTurn[];
}

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

class SequenceResultsStore {
  sessionId = $state<number | null>(null);

  /** Every completed sequence's threshold row. */
  thresholds = $state<ThresholdRow[]>([]);
  effectiveness = $state<EffectivenessRow[]>([]);
  /** Sequences not `completed` when the counts were read (I20). */
  excluded = $state<Sequence[]>([]);
  /** The session reads (list, thresholds, effectiveness) have landed. */
  sessionLoaded = $state(false);
  sessionLoading = $state(false);
  sessionError = $state<string | null>(null);

  /** The strategy filter (null: all) and its rows once read. */
  filterId = $state<number | null>(null);
  filtered = $state<ThresholdRow[] | null>(null);
  filtering = $state(false);

  details = $state<Record<number, SequenceDetail>>({});
  runTurns = $state<Record<number, RunTurns>>({});

  #sessionToken = 0;
  #filterToken = 0;
  #detailTokens = new Map<number, number>();

  /** The session-level reads. Resets the filter when the session changes. */
  async loadSession(sessionId: number): Promise<void> {
    if (sessionId !== this.sessionId) {
      this.sessionId = sessionId;
      this.thresholds = [];
      this.effectiveness = [];
      this.excluded = [];
      this.sessionLoaded = false;
      this.filterId = null;
      this.filtered = null;
      this.details = {};
      this.runTurns = {};
    }
    const token = ++this.#sessionToken;
    this.sessionLoading = true;
    try {
      const [, thresholds, effectiveness] = await Promise.all([
        sequences.load(sessionId),
        status.track(
          request<unknown>(ROUTES.getSessionThresholds, { params: { session_id: sessionId } }),
        ),
        status.track(
          request<unknown>(ROUTES.getStrategyEffectiveness, {
            params: { session_id: sessionId },
          }),
        ),
      ]);
      const excluded = excludedSequences(sequences.list);
      if (token !== this.#sessionToken || sessionId !== this.sessionId) return;
      this.thresholds = parseThresholds(thresholds);
      this.effectiveness = parseEffectiveness(effectiveness);
      this.excluded = excluded;
      this.sessionError = null;
      this.sessionLoaded = true;
      for (const r of this.thresholds) sequences.ensureSummary(r.sequence_id);
      if (this.filterId !== null) void this.setFilter(this.filterId);
    } catch (e) {
      if (token === this.#sessionToken) this.sessionError = report(e);
    } finally {
      if (token === this.#sessionToken) this.sessionLoading = false;
    }
  }

  /** GET /api/sessions/{id}/thresholds?strategy_id= (null shows every row). */
  async setFilter(strategyId: number | null): Promise<void> {
    this.filterId = strategyId;
    const token = ++this.#filterToken;
    const sessionId = this.sessionId;
    if (strategyId === null || sessionId === null) {
      this.filtered = null;
      this.filtering = false;
      return;
    }
    this.filtering = true;
    try {
      const rows = await status.track(
        request<unknown>(ROUTES.getSessionThresholds, {
          params: { session_id: sessionId },
          query: { strategy_id: strategyId },
        }),
      );
      if (token !== this.#filterToken) return;
      this.filtered = parseThresholds(rows);
    } catch (e) {
      if (token === this.#filterToken) {
        report(e);
        this.filterId = null;
        this.filtered = null;
      }
    } finally {
      if (token === this.#filterToken) this.filtering = false;
    }
  }

  /** The picked sequence's summary, whittling rows and turn classifications. */
  async loadSequence(id: number): Promise<void> {
    const token = (this.#detailTokens.get(id) ?? 0) + 1;
    this.#detailTokens.set(id, token);
    const prev = this.details[id];
    this.details = {
      ...this.details,
      [id]: {
        loading: true,
        error: null,
        whittling: prev?.whittling ?? [],
        strips: prev?.strips ?? [],
      },
    };
    try {
      const [, whittling, strips] = await Promise.all([
        sequences.loadSummary(id),
        status.track(request<WhittlingRow[]>(ROUTES.getWhittling, { params: { sequence_id: id } })),
        status.track(
          request<unknown>(ROUTES.getTurnClassifications, { params: { sequence_id: id } }),
        ),
      ]);
      if (this.#detailTokens.get(id) !== token) return;
      this.details = {
        ...this.details,
        [id]: {
          loading: false,
          error: null,
          whittling: Array.isArray(whittling) ? whittling : [],
          strips: stripRuns(strips),
        },
      };
    } catch (e) {
      if (this.#detailTokens.get(id) !== token) return;
      const cur = this.details[id];
      this.details = {
        ...this.details,
        [id]: {
          loading: false,
          error: report(e),
          whittling: cur?.whittling ?? [],
          strips: cur?.strips ?? [],
        },
      };
    }
  }

  /** GET /api/sequence-runs/{id}/turns for an opened run (once). */
  async loadRunTurns(runId: number, force = false): Promise<void> {
    const cur = this.runTurns[runId];
    if (cur && !force && (cur.loading || (!cur.error && cur.turns.length))) return;
    this.runTurns = {
      ...this.runTurns,
      [runId]: { loading: true, error: null, turns: cur?.turns ?? [] },
    };
    try {
      const turns = await status.track(
        request<SequenceTurn[]>(ROUTES.listSequenceRunTurns, { params: { run_id: runId } }),
      );
      this.runTurns = {
        ...this.runTurns,
        [runId]: { loading: false, error: null, turns: Array.isArray(turns) ? turns : [] },
      };
    } catch (e) {
      this.runTurns = {
        ...this.runTurns,
        [runId]: { loading: false, error: friendlyError(e).message, turns: [] },
      };
    }
  }
}

export const sequenceResults = new SequenceResultsStore();
