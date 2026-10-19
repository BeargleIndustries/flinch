// Repeat runs logic (brief 8.3, plan T24). Pure functions the screen and its
// store share: the distribution maths (counts per badge, whole-number shares
// that add up to 100), the summaries list order and wording, and the live
// run's state as the stat-run stream's events land.
//
// The shapes below are the fields this screen reads from the sidecar
// (`flinch/db.py` get_stat_run_summary, get_stat_run, get_stat_run_iterations,
// get_stat_distribution); they sit here rather than in api/types.ts (T24 rule).

import { CLS_ORDER, toCls, type Cls } from '$lib/cls';
import { localDay } from '$lib/format';
import type { ClsCounts } from '../class-bar';

/** One row of GET /api/sessions/{id}/stat-runs. */
export interface StatSummary {
  stat_run_id: number;
  probe_id: number;
  probe_name: string;
  probe_domain: string;
  model: string;
  total: number;
  refused: number;
  collapsed: number;
  negotiated: number;
  complied: number;
  consistency_rate: number | null;
  created_at: string | null;
  status: string;
}

/** One row of `iterations` in GET /api/stat-runs/{id}. */
export interface StatIteration {
  id: number;
  stat_run_id: number;
  iteration_num: number;
  response_text: string | null;
  classification: string | null;
  latency_ms: number | null;
}

/** GET /api/stat-runs/{id}. */
export interface StatRunDetail {
  id: number;
  session_id: number;
  probe_id: number;
  target_model: string;
  repeat_count: number;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  summary: StatSummary | null;
  iterations: StatIteration[];
}

/** The request body of POST /api/sessions/{id}/stat-run (`flinch/models.py` StartStatRunRequest). */
export interface StatRunBody {
  probe_ids: number[];
  repeat_count: number;
}

/** Times per probe: 1 to 100 (`StartStatRunRequest.repeat_count`), default 10. */
export const REPEAT_MIN = 1;
export const REPEAT_MAX = 100;
export const REPEAT_DEFAULT = 10;

/** How much of a response the iteration table shows before "Show all" (brief 8.3). */
export const EXCERPT_CHARS = 200;

// ─── Small readers ──────────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** A whole number from 1 to 100; anything unreadable is the default. */
export function clampRepeats(v: unknown): number {
  const n =
    typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n)) return REPEAT_DEFAULT;
  return Math.min(REPEAT_MAX, Math.max(REPEAT_MIN, Math.round(n)));
}

// ─── Distribution maths ─────────────────────────────────────────────────────

/**
 * Counts per badge from GET /api/stat-runs/{id}/distribution
 * (`{classification: count}`). Keys outside the four badges, and null
 * classifications (sent as "unknown"), add up under `unknown`.
 */
export function distributionCounts(dist: unknown): ClsCounts {
  const out: Partial<Record<Cls, number>> = {};
  if (!isRecord(dist)) return out;
  for (const [key, value] of Object.entries(dist)) {
    const n = num(value);
    if (n === null || n <= 0) continue;
    const cls = toCls(key);
    out[cls] = (out[cls] ?? 0) + Math.round(n);
  }
  return out;
}

/** Counts per badge from a summary row (it has no unknown count). */
export function summaryCounts(s: StatSummary): ClsCounts {
  const counts: ClsCounts = {
    refused: s.refused,
    collapsed: s.collapsed,
    negotiated: s.negotiated,
    complied: s.complied,
  };
  const known = s.refused + s.collapsed + s.negotiated + s.complied;
  if (s.total > known) counts.unknown = s.total - known;
  return counts;
}

/**
 * Whole-number percentages that add up to exactly 100 (largest remainder):
 * each share is floored, then the points left go to the largest remainders,
 * earlier entries first on a tie. All zeros stay zeros.
 */
export function roundShares(counts: readonly number[]): number[] {
  const clean = counts.map((c) => (Number.isFinite(c) && c > 0 ? c : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (total === 0) return clean.map(() => 0);
  const exact = clean.map((c) => (c / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, rem: e - Math.floor(e) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (clean[i] === 0) continue;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

export interface DistRow {
  cls: Cls;
  count: number;
  /** Whole-number share; the rows' shares add up to 100 when the total is above 0. */
  pct: number;
}

export interface Distribution {
  total: number;
  /** Every badge in CLS_ORDER; `unknown` only when it has a count. */
  rows: DistRow[];
  /** The badge every run got, or null when the runs split (or there are none). */
  unanimous: Cls | null;
  /** The badge with the most runs (earlier in CLS_ORDER on a tie), or null with no runs. */
  top: DistRow | null;
}

export function distribution(counts: ClsCounts): Distribution {
  const listed = CLS_ORDER.filter((c) => c !== 'unknown' || (counts.unknown ?? 0) > 0);
  const raw = listed.map((c) => {
    const n = counts[c];
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  });
  const shares = roundShares(raw);
  const rows = listed.map((cls, i) => ({ cls, count: raw[i], pct: shares[i] }));
  const total = raw.reduce((a, b) => a + b, 0);
  const nonZero = rows.filter((r) => r.count > 0);
  let top: DistRow | null = null;
  for (const r of nonZero) if (!top || r.count > top.count) top = r;
  return {
    total,
    rows,
    unanimous: nonZero.length === 1 ? nonZero[0].cls : null,
    top,
  };
}

/** "100%"; a share is a whole number already. */
export const pctLabel = (pct: number): string => `${Math.round(pct)}%`;

/** The summary's consistency rate (refused share, 0 to 1) as "67%", or null. */
export function rateLabel(rate: number | null | undefined): string | null {
  return typeof rate === 'number' && Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : null;
}

// ─── Summaries ──────────────────────────────────────────────────────────────

/** Rows the sidecar sent, readable fields only, newest first (highest id first). */
export function sortSummaries(rows: unknown): StatSummary[] {
  if (!Array.isArray(rows)) return [];
  const out: StatSummary[] = [];
  for (const r of rows) {
    if (!isRecord(r)) continue;
    const id = num(r.stat_run_id);
    if (id === null) continue;
    out.push({
      stat_run_id: id,
      probe_id: num(r.probe_id) ?? 0,
      probe_name: str(r.probe_name) ?? '',
      probe_domain: str(r.probe_domain) ?? '',
      model: str(r.model) ?? '',
      total: num(r.total) ?? 0,
      refused: num(r.refused) ?? 0,
      collapsed: num(r.collapsed) ?? 0,
      negotiated: num(r.negotiated) ?? 0,
      complied: num(r.complied) ?? 0,
      consistency_rate: num(r.consistency_rate),
      created_at: str(r.created_at),
      status: str(r.status) ?? '',
    });
  }
  return out.sort((a, b) => b.stat_run_id - a.stat_run_id);
}

/**
 * The status word the list shows. The stat runner writes `complete`; the
 * screen says "completed" like every other finished job. `running` rows left
 * by a closed app become `failed` at the next start (B23) and show as such.
 */
export function runStatus(status: string | null | undefined): string {
  const s = (status ?? '').trim().toLowerCase();
  return s === 'complete' ? 'completed' : s;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * SQLite's `datetime('now')` ("2026-10-19 14:03:22", UTC) or an ISO string as
 * the local date and time: `{ date: "2026-10-19", time: "16:03" }`. Null when
 * unreadable.
 */
export function runDate(
  createdAt: string | null | undefined,
): { date: string; time: string } | null {
  if (!createdAt) return null;
  const s = createdAt.trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)
    ? `${s.replace(' ', 'T')}Z`
    : s;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: localDay(d),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** "812 ms" under a second, "1.4 s" from there, "" when missing. */
export function latencyLabel(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
}

/** Median latency of the rows that have one, or null. */
export function medianLatency(values: readonly (number | null | undefined)[]): number | null {
  const xs = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = xs.length >> 1;
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2);
}

/** The first `max` characters of a response, whitespace folded, with "…" when cut. */
export function excerpt(text: string | null | undefined, max = EXCERPT_CHARS): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

// ─── The live run ───────────────────────────────────────────────────────────
//
// Events (`flinch/stat_runner.py`), every one after `batch_start` carrying
// `batch_probe_index` and `batch_probe_total`:
//   batch_start {probe_count, repeat_count, target_model}
//   start {stat_run_id, probe_id, probe_name, target_model, repeat_count}
//   iteration {stat_run_id, iteration, total, classification, latency_ms, completed, failed}
//   iteration_error {stat_run_id, iteration, total, error, completed, failed}
//   complete {stat_run_id, summary, completed, failed}
//   error {error}            a probe that was not found (with batch_probe_index),
//                            or the whole stream failing (without it)
//   batch_complete {session_id, probe_count}

export interface LiveCell {
  iteration: number;
  /** Null for a failed call. */
  cls: Cls | null;
  latencyMs: number | null;
  error: string | null;
}

export type LiveProbeState = 'waiting' | 'running' | 'done' | 'failed' | 'stopped';

export interface LiveProbe {
  probeId: number;
  name: string;
  statRunId: number | null;
  repeat: number;
  cells: LiveCell[];
  state: LiveProbeState;
  error: string | null;
}

export interface LiveRun {
  repeat: number;
  model: string | null;
  probes: LiveProbe[];
  /** Calls the run will make; a probe that fails before its first call takes its calls off. */
  total: number;
  /** Calls answered or failed so far. */
  completed: number;
  failed: number;
  /** `batch_complete` arrived. */
  finished: boolean;
  /** The whole stream failed, as the sidecar said it. */
  error: string | null;
  /** The newest stat run that sent `complete`. */
  lastStatRunId: number | null;
}

export interface PlannedProbe {
  id: number;
  name: string;
}

export function initialLive(plan: readonly PlannedProbe[], repeat: number): LiveRun {
  return {
    repeat,
    model: null,
    probes: plan.map((p) => ({
      probeId: p.id,
      name: p.name,
      statRunId: null,
      repeat,
      cells: [],
      state: 'waiting',
      error: null,
    })),
    total: plan.length * repeat,
    completed: 0,
    failed: 0,
    finished: false,
    error: null,
    lastStatRunId: null,
  };
}

function withProbe(run: LiveRun, i: number, next: Partial<LiveProbe>): LiveRun {
  if (i < 0 || i >= run.probes.length) return run;
  const probes = run.probes.slice();
  probes[i] = { ...probes[i], ...next };
  return { ...run, probes };
}

/** Index of the row a probe-level event is about. */
function rowFor(run: LiveRun, data: Record<string, unknown>): number {
  const statRunId = num(data.stat_run_id);
  if (statRunId !== null) {
    const i = run.probes.findIndex((p) => p.statRunId === statRunId);
    if (i >= 0) return i;
  }
  const index = num(data.batch_probe_index);
  if (index !== null && index >= 1 && index <= run.probes.length) return index - 1;
  const probeId = num(data.probe_id);
  if (probeId !== null)
    return run.probes.findIndex((p) => p.probeId === probeId && p.state === 'waiting');
  return -1;
}

const callsDone = (run: LiveRun) => run.probes.reduce((n, p) => n + p.cells.length, 0);
const callsFailed = (run: LiveRun) =>
  run.probes.reduce((n, p) => n + p.cells.filter((c) => c.cls === null).length, 0);

/** The live run after one stream event. Unknown events and unreadable data leave it as it was. */
export function applyEvent(run: LiveRun, name: string, data: unknown): LiveRun {
  if (!isRecord(data)) return run;

  if (name === 'batch_start') {
    const repeat = num(data.repeat_count) ?? run.repeat;
    const count = num(data.probe_count) ?? run.probes.length;
    return {
      ...run,
      repeat,
      model: str(data.target_model) ?? run.model,
      total: count * repeat,
    };
  }

  if (name === 'start') {
    let i = rowFor(run, data);
    let next = run;
    if (i < 0) {
      // A probe the plan did not list (the rail changed under the run): add its row.
      const probeId = num(data.probe_id) ?? -1;
      next = {
        ...run,
        probes: [
          ...run.probes,
          {
            probeId,
            name: str(data.probe_name) ?? `#${probeId}`,
            statRunId: null,
            repeat: run.repeat,
            cells: [],
            state: 'waiting',
            error: null,
          },
        ],
      };
      i = next.probes.length - 1;
    }
    return withProbe({ ...next, model: str(data.target_model) ?? next.model }, i, {
      statRunId: num(data.stat_run_id),
      name: str(data.probe_name) || next.probes[i].name,
      repeat: num(data.repeat_count) ?? next.probes[i].repeat,
      state: 'running',
    });
  }

  if (name === 'iteration' || name === 'iteration_error') {
    const i = rowFor(run, data);
    if (i < 0) return run;
    const ok = name === 'iteration';
    const iteration = num(data.iteration) ?? run.probes[i].cells.length + 1;
    const cell: LiveCell = {
      iteration,
      cls: ok ? toCls(str(data.classification)) : null,
      latencyMs: ok ? num(data.latency_ms) : null,
      error: ok ? null : (str(data.error) ?? ''),
    };
    const cells = [...run.probes[i].cells.filter((c) => c.iteration !== iteration), cell].sort(
      (a, b) => a.iteration - b.iteration,
    );
    const next = withProbe(run, i, { cells, state: 'running' });
    return { ...next, completed: callsDone(next), failed: callsFailed(next) };
  }

  if (name === 'complete') {
    const i = rowFor(run, data);
    const statRunId = num(data.stat_run_id);
    const next = i < 0 ? run : withProbe(run, i, { state: 'done' });
    return { ...next, lastStatRunId: statRunId ?? next.lastStatRunId };
  }

  if (name === 'error') {
    const message = str(data.error) ?? str(data.message) ?? '';
    if (num(data.batch_probe_index) !== null) {
      // One probe could not run (not found); its calls come off the total.
      const i = rowFor(run, data);
      if (i < 0) return run;
      const row = run.probes[i];
      const next = withProbe(run, i, { state: 'failed', error: message });
      return {
        ...next,
        total: Math.max(callsDone(next), next.total - (row.repeat - row.cells.length)),
      };
    }
    return settle({ ...run, error: message || run.error || '' }, 'stopped');
  }

  if (name === 'batch_complete') {
    return { ...settle(run, 'stopped'), finished: true };
  }

  return run;
}

/** Rows still waiting or running when the stream ends become `as` (stopped). */
export function settle(run: LiveRun, as: LiveProbeState = 'stopped'): LiveRun {
  if (!run.probes.some((p) => p.state === 'waiting' || p.state === 'running')) return run;
  return {
    ...run,
    probes: run.probes.map((p) =>
      p.state === 'waiting' || p.state === 'running' ? { ...p, state: as } : p,
    ),
  };
}
