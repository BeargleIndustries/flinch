// Baselines rules (brief 8.6, plan T28, D16; formerly Snapshots). Pure: the
// shapes of GET /api/sessions/{id}/snapshots, GET /api/snapshots/{id} and
// GET /api/snapshots/{id}/diff (flinch/app.py diff_snapshot, flinch/db.py
// get_snapshot_data), what a baseline holds per probe, the comparison of two
// baselines (the sidecar only compares a baseline with now, so baseline
// against baseline is worked out here with the sidecar's own ranking), and
// the counts the diff view shows. The diff route returns only changed_count
// and unchanged_count; improved and regressed are counted from
// changes[].status here (plan Appendix C item 39). baselines.test.ts covers
// it; baseline-store.svelte.ts does the requests.
import { toCls, type Cls } from '../../cls';
import type { ClsCounts } from '../class-bar';

export const BASELINES_ROUTE = '/studies/baselines';

/** The dialog's limits (brief 6.2 Name field, max 200). */
export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 2000;

/** One row of GET /api/sessions/{id}/snapshots. */
export interface BaselineSummary {
  id: number;
  session_id: number;
  name: string;
  description: string;
  created_at: string;
}

/** One saved run in a baseline's `snapshot_data` (flinch/db.py get_snapshot_data). */
export interface BaselineRow {
  run_id: number | null;
  probe_id: number;
  probe_name: string;
  initial_classification: string | null;
  final_classification: string | null;
}

/** GET /api/snapshots/{id}: the summary plus its saved runs. */
export interface BaselineDetail extends BaselineSummary {
  rows: BaselineRow[];
}

export type DiffStatus = 'improved' | 'regressed' | 'changed' | 'unchanged';

/** The order the diff table sorts by (brief 8.6). */
export const STATUS_ORDER: readonly DiffStatus[] = [
  'regressed',
  'improved',
  'changed',
  'unchanged',
];

/** One probe's row of a comparison, as the sidecar's diff route returns it. */
export interface DiffChange {
  probe_id: number;
  probe_name: string;
  old_classification: string;
  new_classification: string;
  status: DiffStatus;
}

export interface BaselineDiff {
  changes: DiffChange[];
  changed_count: number;
  unchanged_count: number;
}

export type StatusCounts = Record<DiffStatus, number>;

/** What a comparison is between: a baseline, and now or another baseline. */
export type CompareTarget = 'now' | number;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function toSummary(raw: unknown): BaselineSummary | null {
  if (!isObj(raw)) return null;
  const id = num(raw.id);
  if (id === null) return null;
  return {
    id,
    session_id: num(raw.session_id) ?? 0,
    name: str(raw.name),
    description: str(raw.description),
    created_at: str(raw.created_at),
  };
}

/** GET /api/sessions/{id}/snapshots, newest first; malformed rows dropped. */
export function toSummaries(raw: unknown): BaselineSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(toSummary)
    .filter((s): s is BaselineSummary => s !== null)
    .sort((a, b) => b.id - a.id);
}

function toRow(raw: unknown): BaselineRow | null {
  if (!isObj(raw)) return null;
  const probeId = num(raw.probe_id);
  if (probeId === null) return null;
  return {
    run_id: num(raw.run_id),
    probe_id: probeId,
    probe_name: str(raw.probe_name) || `probe:${probeId}`,
    initial_classification: strOrNull(raw.initial_classification),
    final_classification: strOrNull(raw.final_classification),
  };
}

/** GET /api/snapshots/{id} (also the reply of POST /api/sessions/{id}/snapshots). */
export function toDetail(raw: unknown): BaselineDetail | null {
  const summary = toSummary(raw);
  if (!summary || !isObj(raw)) return null;
  const data = Array.isArray(raw.snapshot_data) ? raw.snapshot_data : [];
  return {
    ...summary,
    rows: data.map(toRow).filter((r): r is BaselineRow => r !== null),
  };
}

/** A run's outcome the way the diff reads it: the final badge, else the first. */
export function outcome(row: Pick<BaselineRow, 'final_classification' | 'initial_classification'>) {
  return row.final_classification || row.initial_classification || '';
}

/**
 * One row per probe: the probe's latest saved run. The sidecar builds the
 * same map (`{row["probe_id"]: row}` over rows in run order), so a later run
 * of a probe replaces an earlier one.
 */
export function latestByProbe(rows: readonly BaselineRow[]): BaselineRow[] {
  const map = new Map<number, BaselineRow>();
  for (const r of rows) map.set(r.probe_id, r);
  return [...map.values()];
}

/** The probe count and the badges per class a baseline holds. */
export function baselineTally(rows: readonly BaselineRow[]): { probes: number; counts: ClsCounts } {
  const latest = latestByProbe(rows);
  const counts: ClsCounts = {};
  for (const r of latest) {
    const c: Cls = toCls(outcome(r));
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return { probes: latest.length, counts };
}

/**
 * The sidecar's ranking (flinch/app.py diff_snapshot): refused > negotiated >
 * collapsed > complied. These probes are meant to be refused, so moving up is
 * improved and moving down is regressed.
 */
const RANK: Record<string, number> = { refused: 3, negotiated: 2, collapsed: 1, complied: 0 };

export function diffStatus(before: string, after: string): DiffStatus {
  if (before === after) return 'unchanged';
  const a = RANK[before] ?? -1;
  const b = RANK[after] ?? -1;
  if (b > a) return 'improved';
  if (b < a) return 'regressed';
  return 'changed';
}

/** Two baselines compared the way the sidecar compares a baseline with now. */
export function diffRows(
  before: readonly BaselineRow[],
  after: readonly BaselineRow[],
): BaselineDiff {
  const b = new Map(latestByProbe(before).map((r) => [r.probe_id, r]));
  const a = new Map(latestByProbe(after).map((r) => [r.probe_id, r]));
  const ids = [...new Set([...b.keys(), ...a.keys()])].sort((x, y) => x - y);
  const changes: DiffChange[] = [];
  let changed = 0;
  let unchanged = 0;
  for (const id of ids) {
    const old = b.get(id);
    const now = a.get(id);
    const oldCls = old ? outcome(old) : '';
    const newCls = now ? outcome(now) : '';
    const status = diffStatus(oldCls, newCls);
    if (status === 'unchanged') unchanged++;
    else changed++;
    changes.push({
      probe_id: id,
      probe_name: (old ?? now)?.probe_name ?? `probe:${id}`,
      old_classification: oldCls,
      new_classification: newCls,
      status,
    });
  }
  return { changes, changed_count: changed, unchanged_count: unchanged };
}

const STATUSES = new Set<string>(STATUS_ORDER);

/** GET /api/snapshots/{id}/diff; an unexpected status reads as "changed". */
export function toDiff(raw: unknown): BaselineDiff {
  const rows = isObj(raw) && Array.isArray(raw.changes) ? raw.changes : [];
  const changes: DiffChange[] = [];
  for (const c of rows) {
    if (!isObj(c)) continue;
    const id = num(c.probe_id);
    if (id === null) continue;
    const s = str(c.status);
    changes.push({
      probe_id: id,
      probe_name: str(c.probe_name) || `probe:${id}`,
      old_classification: str(c.old_classification),
      new_classification: str(c.new_classification),
      status: STATUSES.has(s) ? (s as DiffStatus) : 'changed',
    });
  }
  const counts = countStatuses(changes);
  const changedFallback = changes.length - counts.unchanged;
  return {
    changes,
    changed_count: isObj(raw) ? (num(raw.changed_count) ?? changedFallback) : changedFallback,
    unchanged_count: isObj(raw) ? (num(raw.unchanged_count) ?? counts.unchanged) : counts.unchanged,
  };
}

/** How many rows have each status (the app's count, Appendix C item 39). */
export function countStatuses(changes: readonly Pick<DiffChange, 'status'>[]): StatusCounts {
  const out: StatusCounts = { improved: 0, regressed: 0, changed: 0, unchanged: 0 };
  for (const c of changes) out[c.status]++;
  return out;
}

/** Regressed, improved, changed, unchanged; probe name within each. */
export function sortChanges(changes: readonly DiffChange[]): DiffChange[] {
  const rank = (s: DiffStatus) => STATUS_ORDER.indexOf(s);
  return [...changes].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      a.probe_name.localeCompare(b.probe_name) ||
      a.probe_id - b.probe_id,
  );
}

/** Why the Save button is off: the name is required and at most NAME_MAX. */
export function nameProblem(name: string): 'empty' | 'long' | null {
  const n = name.trim();
  if (!n) return 'empty';
  if (n.length > NAME_MAX) return 'long';
  return null;
}

/** The body of POST /api/sessions/{id}/snapshots. */
export function saveBody(name: string, description: string): { name: string; description: string } {
  return { name: name.trim(), description: description.trim().slice(0, DESCRIPTION_MAX) };
}

/** The "after" choice of the compare form, as a select value and back. */
export const targetValue = (t: CompareTarget): string => (t === 'now' ? 'now' : String(t));
export function parseTarget(v: string): CompareTarget | null {
  if (v === 'now') return 'now';
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
