// Browse logic (brief 9.1, 9.9, plan T29). Pure functions the Browse screen,
// its two detail routes, the Clear all dialog and the store share: list rows
// typed from the dashboard routes, Model compare sessions dropped (D29, one
// rule in $lib/session), the date groups, the All tab's merged feed, the
// per-session badge tally, the domain table and the run rows of the session
// detail.
//
// The shapes below are the fields these screens read from the sidecar
// (`flinch/db.py` list_all_sessions_summary, list_all_sequences_summary,
// get_dashboard_stats; `flinch/app.py` export_session_summary,
// clear_all_data_endpoint); they sit here rather than in api/types.ts (T24 rule).

import type { Experiment, Run, SessionListItem } from '$lib/api/types';
import { CLS_ORDER, toCls, type Cls } from '$lib/cls';
import { isCompareSession } from '$lib/session';
import type { ClsCounts } from '../class-bar';
import type { ComparisonSummary } from '../studies/compare';
import type { Sequence } from '../studies/sequences';

// ── Row shapes ─────────────────────────────────────────────────

/** One row of GET /api/dashboard/sessions: the session, its run count and first-response counts. */
export interface BrowseSession extends SessionListItem {
  refused_count: number;
  complied_count: number;
  collapsed_count: number;
  negotiated_count: number;
}

/** One row of GET /api/dashboard/sequences: the sequence plus its session's name and model. */
export interface BrowseSequence extends Sequence {
  session_name: string | null;
  target_model: string | null;
}

/** GET /api/sessions/{id}/export/summary. */
export interface SessionSummary {
  session: { name: string; target_model: string; created_at: string };
  stats: { outcome_classifications: Record<string, number> } & Record<string, unknown>;
  domain_breakdown: Record<string, Record<string, number>>;
  total_runs: number;
}

/** One row of GET /api/sessions/{id}/findings (`db.list_session_findings`). */
export interface Finding {
  id: number;
  run_id: number;
  probe_id: number;
  probe_name: string;
  finding: string;
  pattern_tags: string[];
  updated_at: string | null;
}

/** DELETE /api/dashboard/clear-all. */
export interface ClearAllReply {
  status: string;
  deleted: Record<string, number>;
  preserved: string[];
}

// ── Routes ─────────────────────────────────────────────────────

export const BROWSE_ROUTE = '/data/browse';
export const sessionHref = (id: number) => `${BROWSE_ROUTE}/sessions/${id}`;
export const sequenceHref = (id: number) => `${BROWSE_ROUTE}/sequences/${id}`;
export const comparisonHref = (id: number) => `/studies/compare/${id}`;
export const studyHref = (id: number) => `/studies/conditions/${id}`;
export const runHref = (id: number) => `/probe/runs/${id}`;

export const BROWSE_TABS = ['all', 'sessions', 'comparisons', 'studies', 'sequences'] as const;
export type BrowseTab = (typeof BROWSE_TABS)[number];

/** A `?tab=` value as a tab, else All. */
export function asTab(value: string | null | undefined): BrowseTab {
  return (BROWSE_TABS as readonly string[]).includes(value ?? '') ? (value as BrowseTab) : 'all';
}

/** The confirmation string the clear-all route requires (`flinch/app.py`). */
export const CLEAR_ALL_CONFIRM = 'DELETE_ALL_DATA';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Newest first: by time (unreadable times last), then by id. */
function newestFirst<T extends { id: number; created_at: string | null }>(a: T, b: T): number {
  const ta = parseTime(a.created_at) ?? -Infinity;
  const tb = parseTime(b.created_at) ?? -Infinity;
  return tb === ta ? b.id - a.id : tb > ta ? 1 : -1;
}

/**
 * GET /api/dashboard/sessions, typed, newest first. The route already leaves
 * Model compare sessions out (B19); `isCompareSession` drops any that slip
 * through, so Browse and the switcher follow one rule (D29).
 */
export function toSessions(rows: unknown): BrowseSession[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(isRecord)
    .map(
      (r): BrowseSession => ({
        id: num(r.id),
        name: str(r.name),
        target_model: str(r.target_model),
        coach_profile: str(r.coach_profile),
        created_at: str(r.created_at),
        completed_at: strOrNull(r.completed_at),
        notes: strOrNull(r.notes),
        system_prompt: strOrNull(r.system_prompt),
        coach_backend: strOrNull(r.coach_backend),
        coach_model: strOrNull(r.coach_model),
        probe_ids: null,
        run_count: num(r.run_count),
        refused_count: num(r.refused_count),
        complied_count: num(r.complied_count),
        collapsed_count: num(r.collapsed_count),
        negotiated_count: num(r.negotiated_count),
      }),
    )
    .filter((s) => s.id > 0 && !isCompareSession(s.notes))
    .sort(newestFirst);
}

/** GET /api/dashboard/sequences, typed, newest first. */
export function toSequences(rows: unknown): BrowseSequence[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(isRecord)
    .map(
      (r): BrowseSequence => ({
        id: num(r.id),
        session_id: num(r.session_id),
        probe_id: num(r.probe_id),
        strategy_id: num(r.strategy_id),
        batch_id: typeof r.batch_id === 'number' ? r.batch_id : null,
        mode: str(r.mode),
        max_warmup_turns: num(r.max_warmup_turns),
        use_narrative_engine:
          typeof r.use_narrative_engine === 'number' || typeof r.use_narrative_engine === 'boolean'
            ? r.use_narrative_engine
            : null,
        status: str(r.status),
        created_at: strOrNull(r.created_at),
        completed_at: strOrNull(r.completed_at),
        session_name: strOrNull(r.session_name),
        target_model: strOrNull(r.target_model),
      }),
    )
    .filter((s) => s.id > 0)
    .sort(newestFirst);
}

/** GET /api/experiments (`{experiments: [...]}`), newest first. */
export function toStudies(reply: unknown): Experiment[] {
  const rows = isRecord(reply) && Array.isArray(reply.experiments) ? reply.experiments : [];
  return (rows as unknown[])
    .filter(isRecord)
    .map((r) => r as unknown as Experiment)
    .filter((e) => typeof e.id === 'number' && e.id > 0)
    .sort((a, b) => newestFirst(a, b));
}

// ── Counts ─────────────────────────────────────────────────────

/**
 * A session row's first responses by class. The route counts four classes;
 * runs not in any of them (unclassified or errors) are the unknown share.
 */
export function sessionTally(
  s: Pick<
    BrowseSession,
    'run_count' | 'refused_count' | 'collapsed_count' | 'negotiated_count' | 'complied_count'
  >,
): ClsCounts {
  const known = s.refused_count + s.collapsed_count + s.negotiated_count + s.complied_count;
  return {
    refused: s.refused_count,
    collapsed: s.collapsed_count,
    negotiated: s.negotiated_count,
    complied: s.complied_count,
    unknown: Math.max(0, s.run_count - known),
  };
}

/** A `{class: count}` map from the sidecar folded into the five classes (anything else is unknown). */
export function toClsCounts(map: unknown): ClsCounts {
  const out: ClsCounts = {};
  if (!isRecord(map)) return out;
  for (const [k, v] of Object.entries(map)) {
    const n = num(v);
    if (n <= 0) continue;
    const c = toCls(k);
    out[c] = (out[c] ?? 0) + n;
  }
  return out;
}

export function totalOf(counts: ClsCounts): number {
  return CLS_ORDER.reduce((sum, c) => sum + (counts[c] ?? 0), 0);
}

// ── Dates ──────────────────────────────────────────────────────

/**
 * Milliseconds for a sidecar timestamp, or null. Timestamps without a zone
 * (`YYYY-MM-DD HH:MM:SS` and naive ISO strings) are UTC, as in format.ts.
 */
export function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  let s = iso.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(s)) s += 'Z';
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

export const DATE_GROUPS = ['today', 'week', 'month', 'older'] as const;
export type DateGroup = (typeof DATE_GROUPS)[number];

const DAY_MS = 86_400_000;

/**
 * Brief 9.1's groups: Today (the same local calendar day as `now`), This week
 * (the six days before), This month (up to 30 days back), else Older. A time
 * after today (clock skew) counts as Today; one that cannot be read is Older.
 */
export function dateGroup(iso: string | null | undefined, now: Date): DateGroup {
  const t = parseTime(iso);
  if (t === null) return 'older';
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t >= startOfToday) return 'today';
  if (t >= startOfToday - 6 * DAY_MS) return 'week';
  if (t >= startOfToday - 29 * DAY_MS) return 'month';
  return 'older';
}

export interface Grouped<T> {
  group: DateGroup;
  items: T[];
}

/** `items` (already in display order) split into the date groups that have any, in group order. */
export function groupByDate<T>(
  items: readonly T[],
  at: (item: T) => string | null | undefined,
  now: Date,
): Grouped<T>[] {
  const buckets = new Map<DateGroup, T[]>();
  for (const item of items) {
    const g = dateGroup(at(item), now);
    const list = buckets.get(g);
    if (list) list.push(item);
    else buckets.set(g, [item]);
  }
  return DATE_GROUPS.filter((g) => buckets.has(g)).map((g) => ({
    group: g,
    items: buckets.get(g)!,
  }));
}

// ── The All tab ────────────────────────────────────────────────

export type FeedItem =
  | { kind: 'session'; key: string; created_at: string | null; row: BrowseSession }
  | { kind: 'comparison'; key: string; created_at: string | null; row: ComparisonSummary }
  | { kind: 'study'; key: string; created_at: string | null; row: Experiment }
  | { kind: 'sequence'; key: string; created_at: string | null; row: BrowseSequence };

/** Every list merged into one feed, newest first; kinds break ties in tab order. */
export function feed(lists: {
  sessions: readonly BrowseSession[];
  comparisons: readonly ComparisonSummary[];
  studies: readonly Experiment[];
  sequences: readonly BrowseSequence[];
}): FeedItem[] {
  const items: FeedItem[] = [
    ...lists.sessions.map(
      (row): FeedItem => ({
        kind: 'session',
        key: `session-${row.id}`,
        created_at: row.created_at,
        row,
      }),
    ),
    ...lists.comparisons.map(
      (row): FeedItem => ({
        kind: 'comparison',
        key: `comparison-${row.id}`,
        created_at: row.created_at,
        row,
      }),
    ),
    ...lists.studies.map(
      (row): FeedItem => ({
        kind: 'study',
        key: `study-${row.id}`,
        created_at: row.created_at,
        row,
      }),
    ),
    ...lists.sequences.map(
      (row): FeedItem => ({
        kind: 'sequence',
        key: `sequence-${row.id}`,
        created_at: row.created_at,
        row,
      }),
    ),
  ];
  const order = { session: 0, comparison: 1, study: 2, sequence: 3 } as const;
  return items
    .map((item, i) => ({ item, i, t: parseTime(item.created_at) ?? -Infinity }))
    .sort((a, b) =>
      b.t === a.t ? order[a.item.kind] - order[b.item.kind] || a.i - b.i : b.t > a.t ? 1 : -1,
    )
    .map((x) => x.item);
}

// ── Session detail ─────────────────────────────────────────────

export interface DomainRow {
  domain: string;
  total: number;
  refused: number;
  collapsed: number;
  negotiated: number;
  complied: number;
}

/** The summary's `domain_breakdown` as table rows, most runs first, then by name. */
export function domainRows(breakdown: unknown): DomainRow[] {
  if (!isRecord(breakdown)) return [];
  return Object.entries(breakdown)
    .filter((e): e is [string, Record<string, unknown>] => isRecord(e[1]))
    .map(([domain, d]) => ({
      domain,
      total: num(d.total),
      refused: num(d.refused),
      collapsed: num(d.collapsed),
      negotiated: num(d.negotiated),
      complied: num(d.complied),
    }))
    .sort((a, b) => b.total - a.total || a.domain.localeCompare(b.domain));
}

/** A run's outcome: the final class when pushback was sent, else the first response's. */
export function runOutcome(run: Pick<Run, 'initial_classification' | 'final_classification'>): Cls {
  return toCls(run.final_classification || run.initial_classification);
}

/** The row's one-line preview: whitespace folded, cut at `max` characters with an ellipsis. */
export function runPreview(text: string | null | undefined, max = 80): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

/** The pushback's source key ("coach", "override" or "skip"), or null when none was recorded. */
export function pushbackSource(source: string | null | undefined): string | null {
  const s = (source ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'skipped') return 'skip';
  return s;
}

/** The whole conversation is worth showing when it holds more than the probe and one reply. */
export const showConversation = (turnCount: number) => turnCount > 2;

/** GET /api/sessions/{id}/findings, typed, rows without a finding dropped. */
export function toFindings(rows: unknown): Finding[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(isRecord)
    .map((r) => ({
      id: num(r.id),
      run_id: num(r.run_id),
      probe_id: num(r.probe_id),
      probe_name: str(r.probe_name),
      finding: str(r.finding).trim(),
      pattern_tags: Array.isArray(r.pattern_tags)
        ? r.pattern_tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
        : [],
      updated_at: strOrNull(r.updated_at),
    }))
    .filter((f) => f.finding !== '');
}

// ── Clear all ──────────────────────────────────────────────────

/** The sessions and runs a clear-all removed, from its per-table counts. */
export function clearedCounts(reply: unknown): { sessions: number; runs: number } {
  const deleted = isRecord(reply) && isRecord(reply.deleted) ? reply.deleted : {};
  return { sessions: num(deleted.sessions), runs: num(deleted.runs) };
}
