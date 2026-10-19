// Sequences Results logic (brief 8.4 Results tab, D21, D30, I20, plan T26).
// Pure functions the Results tab and its store share: which sequences the
// picker offers, the threshold readout by case, the threshold bars, the
// turn-by-turn strip, the strategy filter, and strategy effectiveness counted
// over completed sequences only.
//
// The shapes below are the fields the Results tab reads from the sidecar
// (`flinch/db.py` get_whittling_results, get_turn_classifications,
// get_cross_probe_thresholds, get_strategy_effectiveness; `flinch/app.py`
// turn-classifications); they sit here rather than in api/types.ts (T24 rule).

import { toCls, type Cls } from '$lib/cls';
import { hasResults, type Sequence, type SequenceRun } from './sequences';

/** One row of GET /api/sequences/{id}/whittling (warmup_count descending). */
export interface WhittlingRow {
  warmup_count: number;
  probe_classification: string | null;
  threshold_found: number | boolean | null;
  status: string;
}

/** One turn of GET /api/sequences/{id}/turn-classifications. */
export interface ClassifiedTurn {
  turn_number: number;
  role: string;
  classification: string | null;
  turn_type: string;
  content?: string | null;
}

/** One run of GET /api/sequences/{id}/turn-classifications. */
export interface ClassifiedRun {
  sequence_run_id: number;
  warmup_count: number;
  probe_classification: string | null;
  turns: ClassifiedTurn[];
}

/** One row of GET /api/sessions/{id}/thresholds (completed sequences only). */
export interface ThresholdRow {
  sequence_id: number;
  probe_id: number;
  probe_name: string;
  domain: string | null;
  strategy_name: string;
  strategy_id: number;
  /** The threshold run's warmup turns; null when the sequence has none. */
  threshold_turns: number | null;
  probe_classification: string | null;
}

/** One row of GET /api/sessions/{id}/strategy-effectiveness. */
export interface EffectivenessRow {
  id: number;
  name: string;
  category: string | null;
  sequence_count: number;
  success_count: number;
  avg_threshold: number | null;
}

/** The two classes the sidecar counts as getting through (db.get_strategy_effectiveness). */
export const GOT_THROUGH = new Set(['complied', 'collapsed']);

export const isFound = (v: number | boolean | null | undefined) => v === true || v === 1;

// ── The picker ─────────────────────────────────────────────────

/** Sequences with something to read (completed or failed), in list order. */
export function resultChoices(list: readonly Sequence[]): Sequence[] {
  return list.filter(hasResults);
}

/** `wanted` while it is a choice, else the first (newest) choice. */
export function defaultPick(choices: readonly Sequence[], wanted: number | null): number | null {
  if (wanted !== null && choices.some((s) => s.id === wanted)) return wanted;
  return choices[0]?.id ?? null;
}

// ── The threshold readout ──────────────────────────────────────

export type ThresholdCase =
  | { kind: 'empty' }
  | { kind: 'failed' }
  | { kind: 'found'; n: number }
  | { kind: 'zero' }
  | { kind: 'none'; max: number }
  | { kind: 'single'; warmup: number }
  | { kind: 'unwhittled'; runs: number };

/**
 * The readout's case (brief 8.4): a failed run first; then the run marked as
 * the threshold (N > 0, or 0 when even no warmup got through); a single run
 * that was not whittled; else no threshold with the highest run Refused.
 * `refusedAtMax` is the whittle reply's "Refused on the first pass" (threshold
 * found, no turn count), the one case a single run is a whittle.
 */
export function thresholdCase(
  runs: readonly WhittlingRow[],
  maxWarmup: number,
  refusedAtMax = false,
): ThresholdCase {
  if (runs.length === 0) return { kind: 'empty' };
  if (runs.some((r) => r.status === 'failed')) return { kind: 'failed' };
  const found = runs.find((r) => isFound(r.threshold_found));
  if (found)
    return found.warmup_count > 0 ? { kind: 'found', n: found.warmup_count } : { kind: 'zero' };
  const top = [...runs].sort((a, b) => b.warmup_count - a.warmup_count)[0];
  const topRefused = toCls(top.probe_classification) === 'refused';
  if (refusedAtMax && topRefused) return { kind: 'none', max: maxWarmup };
  if (runs.length === 1) return { kind: 'single', warmup: runs[0].warmup_count };
  if (topRefused) return { kind: 'none', max: maxWarmup };
  return { kind: 'unwhittled', runs: runs.length };
}

export interface ThresholdBar {
  key: string;
  warmup: number;
  cls: Cls;
  found: boolean;
  failed: boolean;
  /** Bar height in percent of the tallest possible run (at least a stub). */
  height: number;
}

/** A visible stub for runs at 0 warmup turns. */
export const MIN_BAR = 6;

/** One bar per run, fewest warmup turns on the left. */
export function thresholdBars(runs: readonly WhittlingRow[], maxWarmup: number): ThresholdBar[] {
  const top = Math.max(1, maxWarmup, ...runs.map((r) => r.warmup_count));
  return [...runs]
    .sort((a, b) => a.warmup_count - b.warmup_count)
    .map((r, i) => ({
      key: `${r.warmup_count}-${i}`,
      warmup: r.warmup_count,
      cls: toCls(r.probe_classification),
      found: isFound(r.threshold_found),
      failed: r.status === 'failed',
      height: Math.max(MIN_BAR, Math.round((r.warmup_count / top) * 100)),
    }));
}

// ── Turn by turn ───────────────────────────────────────────────

export type TurnType = 'warmup' | 'setup' | 'probe';

export const TURN_LETTER: Record<TurnType, string> = { warmup: 'W', setup: 'S', probe: 'P' };

export interface StripCell {
  key: number;
  type: TurnType;
  letter: string;
  cls: Cls;
  /** 1-based warmup number for warmup replies, else null. */
  warmup: number | null;
}

const TYPES = new Set<string>(['warmup', 'setup', 'probe']);

/** The model's replies in turn order, one square each. */
export function turnStrip(turns: readonly ClassifiedTurn[]): StripCell[] {
  let warmup = 0;
  return [...turns]
    .filter((t) => t && t.role === 'target' && typeof t.turn_number === 'number')
    .sort((a, b) => a.turn_number - b.turn_number)
    .map((t) => {
      const type = (TYPES.has(t.turn_type) ? t.turn_type : 'warmup') as TurnType;
      if (type === 'warmup') warmup += 1;
      return {
        key: t.turn_number,
        type,
        letter: TURN_LETTER[type],
        cls: toCls(t.classification),
        warmup: type === 'warmup' ? warmup : null,
      };
    });
}

/** Runs in the order they ran (run id). */
export function stripRuns(runs: unknown): ClassifiedRun[] {
  if (!Array.isArray(runs)) return [];
  return (runs as ClassifiedRun[])
    .filter((r) => r && typeof r.sequence_run_id === 'number')
    .map((r) => ({ ...r, turns: Array.isArray(r.turns) ? r.turns : [] }))
    .sort((a, b) => a.sequence_run_id - b.sequence_run_id);
}

/** A sequence's runs for the Runs list: in the order they ran. */
export function orderedRuns(runs: readonly SequenceRun[]): SequenceRun[] {
  return [...runs].sort((a, b) => a.id - b.id);
}

// ── Thresholds across probes ───────────────────────────────────

export interface StrategyChoice {
  id: number;
  name: string;
}

/** The strategies the session's completed sequences use, by name. */
export function strategyChoices(rows: readonly ThresholdRow[]): StrategyChoice[] {
  const map = new Map<number, string>();
  for (const r of rows) if (!map.has(r.strategy_id)) map.set(r.strategy_id, r.strategy_name);
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

/** Rows that belong to `strategyId` (all with null). */
export function filterThresholds(
  rows: readonly ThresholdRow[],
  strategyId: number | null,
): ThresholdRow[] {
  return strategyId === null ? [...rows] : rows.filter((r) => r.strategy_id === strategyId);
}

/** Bar width in percent of the deepest threshold on screen (0 for none). */
export function thresholdWidth(turns: number | null, rows: readonly ThresholdRow[]): number {
  if (turns === null) return 0;
  const top = Math.max(1, ...rows.map((r) => r.threshold_turns ?? 0));
  return Math.max(MIN_BAR, Math.round((turns / top) * 100));
}

/** Parses the thresholds reply: rows with a sequence id only. */
export function parseThresholds(rows: unknown): ThresholdRow[] {
  if (!Array.isArray(rows)) return [];
  return (rows as ThresholdRow[]).filter((r) => r && typeof r.sequence_id === 'number');
}

// ── Completed sequences only (I20) ─────────────────────────────

/** Sequences the session-level panels leave out: every status but `completed`. */
export function excludedSequences(list: readonly Sequence[]): Sequence[] {
  return list.filter((s) => s.status !== 'completed');
}

const STATUS_ORDER = ['running', 'pending', 'failed', 'abandoned'];

/** Left-out sequences counted by status, in a fixed order. */
export function excludedCounts(list: readonly Sequence[]): { status: string; count: number }[] {
  const map = new Map<string, number>();
  for (const s of list) map.set(s.status, (map.get(s.status) ?? 0) + 1);
  const rank = (s: string) => {
    const i = STATUS_ORDER.indexOf(s);
    return i === -1 ? STATUS_ORDER.length : i;
  };
  return [...map.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => rank(a.status) - rank(b.status) || a.status.localeCompare(b.status));
}

/** Whether any run's probe got through (complied or collapsed). */
export function gotThrough(runs: readonly Pick<SequenceRun, 'probe_classification'>[]): boolean {
  return runs.some((r) => GOT_THROUGH.has(toCls(r.probe_classification)));
}

export interface LeftOut {
  strategy_id: number;
  gotThrough: boolean;
}

const mean = (xs: readonly number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/**
 * Strategy effectiveness over completed sequences only (I20). The sidecar's
 * rows count every sequence in the session whatever its status
 * (`db.get_strategy_effectiveness` has no status filter), so each strategy
 * with a left-out sequence is corrected: the left-out sequences come off the
 * count, those that got through come off the successes, and the average
 * threshold is taken over the completed threshold rows (the thresholds route
 * already keeps completed sequences only). Strategies left with no completed
 * sequence drop out. Strategies with nothing left out keep the sidecar's row.
 */
export function completedEffectiveness(
  rows: readonly EffectivenessRow[],
  leftOut: readonly LeftOut[],
  thresholds: readonly ThresholdRow[],
): EffectivenessRow[] {
  const out: EffectivenessRow[] = [];
  for (const row of rows) {
    const mine = leftOut.filter((l) => l.strategy_id === row.id);
    if (mine.length === 0) {
      out.push({ ...row });
      continue;
    }
    const count = row.sequence_count - mine.length;
    if (count <= 0) continue;
    const success = Math.max(0, row.success_count - mine.filter((l) => l.gotThrough).length);
    const turns = thresholds
      .filter((t) => t.strategy_id === row.id && t.threshold_turns !== null)
      .map((t) => t.threshold_turns as number);
    out.push({
      ...row,
      sequence_count: count,
      success_count: Math.min(success, count),
      avg_threshold: mean(turns),
    });
  }
  return out.sort((a, b) => b.success_count - a.success_count);
}

/** Successes as a percentage of sequences (0 with none). */
export function successShare(
  row: Pick<EffectivenessRow, 'sequence_count' | 'success_count'>,
): number {
  if (row.sequence_count <= 0) return 0;
  return Math.round((row.success_count / row.sequence_count) * 100);
}

/** Parses the effectiveness reply: numeric counts, a finite average or null. */
export function parseEffectiveness(rows: unknown): EffectivenessRow[] {
  if (!Array.isArray(rows)) return [];
  return (rows as EffectivenessRow[])
    .filter((r) => r && typeof r.id === 'number')
    .map((r) => ({
      ...r,
      sequence_count: Number(r.sequence_count) || 0,
      success_count: Number(r.success_count) || 0,
      avg_threshold:
        typeof r.avg_threshold === 'number' && Number.isFinite(r.avg_threshold)
          ? r.avg_threshold
          : null,
    }));
}
