// Scorecard state (brief 9.2, plan T30). Every request goes through
// status.track; screens call these from an $effect inside `untrack`.
//
// Across models reads GET /api/sessions (sources and models), GET
// /api/sessions/{id}/stat-runs for each session with runs (repeat-run
// sources), GET /api/policies (provider and slug per claim), GET
// /api/scorecards; Generate is POST /api/scorecard/generate and Open is GET
// /api/scorecard/{id}. A cell's runs come from GET /api/sessions/{id} for the
// scorecard's sessions of that model and GET /api/probes/{id}/claims for the
// probes those runs used.
//
// This session reads GET /api/sessions/{id}/compliance.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { SessionDetail, SessionListItem } from '$lib/api/types';
import { SCORECARD } from '$lib/copy/data';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import type { PoliciesByProvider, PolicyClaim } from '../probe/claims';
import { sortSummaries, type StatSummary } from '../studies/repeat';
import {
  cellRuns,
  claimIndex,
  sessionsForModel,
  toCompliance,
  toScorecardList,
  viewFromGenerate,
  viewFromSnapshot,
  type CellRun,
  type ComplianceView,
  type GenerateBody,
  type ScorecardListItem,
  type ScorecardView,
} from './scorecard';

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

/** A read that may fail on its own without blanking the screen. */
async function soft<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch (e) {
    report(e);
    return fallback;
  }
}

/** A repeat run with the session it belongs to. */
export interface SourceStatRun extends StatSummary {
  session_id: number;
}

class ScorecardStore {
  // ── Sources ──
  sessions = $state<SessionListItem[]>([]);
  statRuns = $state<SourceStatRun[]>([]);
  claims = $state<Map<number, PolicyClaim>>(new Map());
  sourcesLoaded = $state(false);
  sourcesError = $state<string | null>(null);

  // ── Saved scorecards ──
  saved = $state<ScorecardListItem[]>([]);
  savedLoaded = $state(false);
  savedError = $state<string | null>(null);

  // ── The scorecard on screen ──
  view = $state<ScorecardView | null>(null);
  /** Goes up each time another scorecard is put on screen (even the same saved one again). */
  viewSeq = $state(0);
  generating = $state(false);
  /** Saved scorecard id being opened. */
  opening = $state<number | null>(null);

  // ── This session ──
  compliance = $state<ComplianceView | null>(null);
  complianceFor = $state<number | null>(null);
  complianceError = $state<string | null>(null);

  #sourcesToken = 0;
  #savedToken = 0;
  #complianceToken = 0;
  #viewToken = 0;
  /** Cell runs per scorecard view and cell, so reopening a cell does not read again. */
  #cells = new Map<string, Promise<CellRun[]>>();

  /** Sessions, their repeat runs and the policy claims. */
  async loadSources(): Promise<void> {
    const token = ++this.#sourcesToken;
    try {
      const [sessions, policies] = await status.track(
        Promise.all([
          request<SessionListItem[]>(ROUTES.listSessions),
          soft(request<PoliciesByProvider>(ROUTES.listPolicies), {} as PoliciesByProvider),
        ]),
      );
      if (token !== this.#sourcesToken) return;
      const list = Array.isArray(sessions) ? sessions : [];
      const withRuns = list.filter((s) => (s.run_count ?? 0) > 0);
      const perSession = await status.track(
        Promise.all(
          withRuns.map(async (s) => {
            const rows = await soft(
              request<unknown>(ROUTES.listStatRuns, { params: { session_id: s.id } }),
              [],
            );
            return sortSummaries(rows)
              .filter((r) => r.total > 0)
              .map((r) => ({ ...r, session_id: s.id }));
          }),
        ),
      );
      if (token !== this.#sourcesToken) return;
      this.sessions = list;
      this.statRuns = perSession.flat().sort((a, b) => b.stat_run_id - a.stat_run_id);
      this.claims = claimIndex(policies);
      this.sourcesError = null;
    } catch (e) {
      if (token === this.#sourcesToken) this.sourcesError = report(e);
    } finally {
      if (token === this.#sourcesToken) this.sourcesLoaded = true;
    }
  }

  async loadSaved(): Promise<void> {
    const token = ++this.#savedToken;
    try {
      const rows = await status.track(request<unknown>(ROUTES.listScorecards));
      if (token !== this.#savedToken) return;
      this.saved = toScorecardList(rows);
      this.savedError = null;
    } catch (e) {
      if (token === this.#savedToken) this.savedError = report(e);
    } finally {
      if (token === this.#savedToken) this.savedLoaded = true;
    }
  }

  /** Generates and saves a scorecard, then shows it. Returns whether it worked. */
  async generate(body: GenerateBody): Promise<boolean> {
    if (this.generating) return false;
    this.generating = true;
    const token = ++this.#viewToken;
    try {
      const reply = await status.track(request<unknown>(ROUTES.generateScorecard, { body }));
      if (token === this.#viewToken) {
        this.#setView(viewFromGenerate(reply, body.name, new Date().toISOString()));
      }
      status.note(SCORECARD.generated);
      void this.loadSaved();
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      this.generating = false;
    }
  }

  /** The scorecard on screen, generated again from the same models and sources. */
  refresh(): Promise<boolean> {
    const v = this.view;
    if (!v) return Promise.resolve(false);
    return this.generate({
      name: v.name || SCORECARD.title,
      models: v.models,
      session_ids: v.sessionIds,
      stat_run_ids: v.statRunIds,
    });
  }

  async open(id: number): Promise<void> {
    if (this.opening !== null) return;
    this.opening = id;
    const token = ++this.#viewToken;
    try {
      const row = await status.track(
        request<unknown>(ROUTES.getScorecard, { params: { snapshot_id: id } }),
      );
      if (token === this.#viewToken) this.#setView(viewFromSnapshot(row));
    } catch (e) {
      report(e);
    } finally {
      this.opening = null;
    }
  }

  #setView(v: ScorecardView) {
    this.view = v;
    this.viewSeq += 1;
    this.#cells.clear();
  }

  /** The session runs behind one cell of the scorecard on screen (cached per view). */
  runsFor(model: string, claimId: number): Promise<CellRun[]> {
    const v = this.view;
    if (!v) return Promise.resolve([]);
    const key = `${v.snapshotId ?? 'new'}|${model}|${claimId}`;
    let p = this.#cells.get(key);
    if (!p) {
      p = this.#readCell(v, model, claimId);
      this.#cells.set(key, p);
      // A failed read is not cached, so opening the cell again retries.
      p.catch(() => this.#cells.delete(key));
    }
    return p;
  }

  async #readCell(v: ScorecardView, model: string, claimId: number): Promise<CellRun[]> {
    const ids = sessionsForModel(v.sessionIds, this.sessions, model);
    const details = await status.track(
      Promise.all(
        ids.map((id) =>
          request<SessionDetail>(ROUTES.getSession, { params: { session_id: id } }).catch(
            () => null,
          ),
        ),
      ),
    );
    const sessions = details
      .filter((d): d is SessionDetail => d !== null && Array.isArray(d.runs))
      .map((d) => ({
        id: d.id,
        name: d.name,
        runs: d.runs.filter((r) => r.target_model === model),
      }));
    const probeIds = [...new Set(sessions.flatMap((s) => s.runs.map((r) => r.probe_id)))];
    const links = await status.track(
      Promise.all(
        probeIds.map(async (pid) => {
          const claims = await request<PolicyClaim[]>(ROUTES.listProbeClaims, {
            params: { probe_id: pid },
          });
          return Array.isArray(claims) && claims.some((c) => c.id === claimId) ? pid : null;
        }),
      ),
    );
    const linked = new Set(links.filter((x): x is number => x !== null));
    return cellRuns(sessions, linked, model);
  }

  async loadCompliance(sessionId: number): Promise<void> {
    const token = ++this.#complianceToken;
    if (this.complianceFor !== sessionId) this.compliance = null;
    try {
      const reply = await status.track(
        request<unknown>(ROUTES.getSessionCompliance, { params: { session_id: sessionId } }),
      );
      if (token !== this.#complianceToken) return;
      this.compliance = toCompliance(reply);
      this.complianceFor = sessionId;
      this.complianceError = null;
    } catch (e) {
      if (token === this.#complianceToken) {
        this.complianceError = report(e);
        this.complianceFor = sessionId;
      }
    }
  }

  /** Whether This session's numbers are for `sessionId`. */
  complianceReadyFor(sessionId: number): boolean {
    return this.complianceFor === sessionId;
  }
}

export const scorecard = new ScorecardStore();
