// A conditions study's Results, Raters and Export tabs (brief 8.2.3, D20,
// D21, I11, I22, B04, B14, B31): the logic behind the comparison cards, the
// text metrics table, the statistics lines, the rating tables and the export
// rows, kept out of the components so it can be tested. Local types for the
// rows these routes return (types.ts is frozen).
import type { ConditionComparison, ConditionSummary } from '$lib/api/types';
import type { ClsCounts } from '$lib/components/class-bar';
import { toCls } from '$lib/cls';
import { CONDITIONS_RESULTS as R } from '$lib/copy/studies';

// ---------------------------------------------------------------------------
// Rows the API returns (local types)
// ---------------------------------------------------------------------------

/** One AI rating item (`ai_rating_items`). */
export interface RatingItem {
  id: number;
  rating_id: number;
  response_id: number;
  position_label: string;
  rank: number | null;
}

/** One entry of GET /api/experiments/{id}/ratings (`flinch/db.py` list_ai_ratings). */
export interface AiRating {
  id: number;
  rater_model: string;
  prompt_id: number;
  target_model_id: string;
  /** Position label to condition id, e.g. {"A": 2, "B": 1}. */
  blinding_order: Record<string, number> | string | null;
  status: string;
  items: RatingItem[];
}

/** One entry of GET /api/experiments/{id}/human-evals (`eval_tasks`). */
export interface EvalTask {
  id: number;
  batch_id: string;
  prompt_id: number;
  target_model_id: string;
  tracking_id: string;
  status: string;
}

/** POST /api/experiments/{id}/prolific (`flinch/prolific.py` generate_tasks). */
export interface ProlificResult {
  batch_id: string;
  task_count: number;
  prompt_count: number;
  raters_per_task: number;
  conditions: number;
}

/** POST /api/experiments/{id}/human-evals/import (`flinch/prolific.py` import_results). */
export interface HumanImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  total_rows: number;
}

/** POST /api/experiments/{id}/classify (B04). */
export interface ClassifyResult {
  classified: number;
  skipped: number;
}

/** One response with its text (GET /api/experiments/{id}/responses?prompt_id=). */
export interface StudyResponseText {
  id: number;
  condition_id: number;
  prompt_id: number;
  model_id: string;
  repetition: number;
  status: string;
  classification: string | null;
  error_message: string | null;
  response_text: string | null;
}

// ---------------------------------------------------------------------------
// Stream ids and limits
// ---------------------------------------------------------------------------

export const metricsStreamId = (id: number) => `metrics:${id}`;
export const rateStreamId = (id: number) => `rate:${id}`;

/** The first rater in the route's defaults (`flinch/models.py` RunAIRatersRequest). */
export const DEFAULT_RATER = 'claude-haiku-4-5-20251001';
/** Prolific defaults (`flinch/models.py` GenerateProlificExportRequest). */
export const PROLIFIC_PROMPTS = 300;
export const PROLIFIC_RATERS = 3;
/** A response's text is collapsed after this many characters (brief 8.2.3). */
export const COLLAPSE_AT = 600;

/** Prolific tasks need two or three conditions: the CSV has three response columns (I11). */
export const prolificAllowed = (conditions: number) => conditions === 2 || conditions === 3;

// ---------------------------------------------------------------------------
// Condition comparison
// ---------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A condition's badge counts for ClassBar: anything outside the four classes counts as unknown. */
export function classCounts(c: Pick<ConditionSummary, 'classifications'>): ClsCounts {
  const out: ClsCounts = {};
  for (const [k, n] of Object.entries(c.classifications ?? {})) {
    const cls = toCls(k);
    out[cls] = (out[cls] ?? 0) + (num(n) ?? 0);
  }
  return out;
}

/** Completed responses with no classification, over every condition. */
export function unclassifiedTotal(cmp: Pick<ConditionComparison, 'conditions'> | null): number {
  if (!cmp) return 0;
  return cmp.conditions.reduce((s, c) => s + (classCounts(c).unknown ?? 0), 0);
}

/** "67%" for a rate, or a dash when there is none. */
export function ratePct(rate: number | null | undefined): string {
  const r = num(rate);
  return r === null ? R.noRate : `${Math.round(r * 100)}%`;
}

/** The first `n` characters of a system prompt, with an ellipsis when cut. */
export function clip(text: string | null | undefined, n: number): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

// ---------------------------------------------------------------------------
// Text metrics table
// ---------------------------------------------------------------------------

/** The rows of the metrics table, in order (brief 8.2.3; `flinch/db.py` get_condition_comparison). */
export const METRIC_ROWS: readonly { key: string; label: string }[] = [
  { key: 'mtld', label: 'MTLD' },
  { key: 'honore_statistic', label: 'Honoré' },
  { key: 'hedging_ratio', label: 'Hedging' },
  { key: 'confidence_ratio', label: 'Confidence' },
  { key: 'evasion_ratio', label: 'Evasion' },
  { key: 'flesch_kincaid_grade', label: 'Reading grade' },
  { key: 'word_count', label: 'Words' },
  { key: 'ttr', label: 'TTR' },
  { key: 'subjectivity', label: 'Subjectivity' },
  { key: 'polarity', label: 'Polarity' },
];

export interface MetricStat {
  mean: number;
  sd: number;
  n: number;
}

/** One condition's stat for a metric, or null. */
export function metricStat(c: Pick<ConditionSummary, 'metrics'>, key: string): MetricStat | null {
  const m = isRecord(c.metrics) ? c.metrics[key] : null;
  if (!isRecord(m)) return null;
  const mean = num(m.mean);
  if (mean === null) return null;
  return { mean, sd: num(m.sd) ?? 0, n: num(m.n) ?? 0 };
}

/** "12.34 ± 0.50". */
export const meanSd = (s: MetricStat) => `${s.mean.toFixed(2)} ± ${s.sd.toFixed(2)}`;

/** The metric rows some condition has; a row no condition has is hidden. */
export function visibleMetricRows(conditions: readonly Pick<ConditionSummary, 'metrics'>[]) {
  return METRIC_ROWS.filter((row) => conditions.some((c) => metricStat(c, row.key) !== null));
}

/** The pairs of an analysis section that are objects (an `error` entry is not a pair). */
function pairs(section: unknown): Record<string, unknown>[] {
  if (!isRecord(section) || typeof section.error === 'string') return [];
  return Object.values(section).filter(isRecord);
}

/** The largest absolute Cohen's d for a metric over every pair, or null. */
export function largestD(analysis: Record<string, unknown> | null, metric: string): number | null {
  let best: number | null = null;
  for (const pair of pairs(analysis?.effect_sizes)) {
    const cell = pair[metric];
    const d = isRecord(cell) ? num(cell.cohens_d) : null;
    if (d !== null && (best === null || Math.abs(d) > Math.abs(best))) best = d;
  }
  return best;
}

/**
 * The smallest p value for a metric over every pair: the FDR-corrected one
 * from `corrections`, falling back to the raw Mann-Whitney `p_value`.
 */
export function smallestP(analysis: Record<string, unknown> | null, metric: string): number | null {
  const pick = (section: unknown, field: string) => {
    let best: number | null = null;
    for (const pair of pairs(section)) {
      const cell = pair[metric];
      const p = isRecord(cell) ? num(cell[field]) : null;
      if (p !== null && (best === null || p < best)) best = p;
    }
    return best;
  };
  return pick(analysis?.corrections, 'p_fdr') ?? pick(analysis?.nonparametric, 'p_value');
}

/** "*", "**", "***" or "" (brief 8.2.3 legend). */
export function stars(p: number | null): string {
  if (p === null) return '';
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return '';
}

export type DTone = 'none' | 'small' | 'medium' | 'large';

/** Cohen's d size: small from 0.2, medium from 0.5, large from 0.8. */
export function dTone(d: number | null): DTone {
  const a = d === null ? 0 : Math.abs(d);
  if (a >= 0.8) return 'large';
  if (a >= 0.5) return 'medium';
  if (a >= 0.2) return 'small';
  return 'none';
}

// ---------------------------------------------------------------------------
// Statistics lines (`/analyze` stores per-test `error` keys, Appendix C 31)
// ---------------------------------------------------------------------------

/** The tests `full_analysis` runs, in its order, with their names. */
export const ANALYSIS_TESTS: readonly { key: string; label: string }[] = [
  { key: 'win_rates', label: 'Win rates' },
  { key: 'effect_sizes', label: "Effect sizes (Cohen's d)" },
  { key: 'inter_rater_agreement', label: 'Rater agreement' },
  { key: 'per_model_breakdown', label: 'Win rates by model' },
  { key: 'power_analysis', label: 'Power' },
  { key: 'nonparametric', label: 'Mann-Whitney U' },
  { key: 'paired', label: 'Wilcoxon signed-rank' },
  { key: 'corrections', label: 'FDR correction' },
];

export interface AnalysisLine {
  key: string;
  label: string;
  /** "ok", "error" or "empty" (the test ran but had nothing to compare). */
  state: 'ok' | 'error' | 'empty';
  text: string;
}

/** Every `error` string in a test's result, up to two levels down, with where it was. */
export function errorsIn(result: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, where: string[], depth: number) => {
    if (!isRecord(v) || depth > 3) return;
    if (typeof v.error === 'string' && v.error) {
      out.push(where.length ? `${where.join(', ')}: ${v.error}` : v.error);
    }
    for (const [k, child] of Object.entries(v)) {
      if (k !== 'error')
        walk(child, [...where, k.replace(/_vs_/g, ' vs ').replace(/_/g, ' ')], depth + 1);
    }
  };
  walk(result, [], 0);
  return out;
}

function summaryOf(key: string, v: Record<string, unknown>): string | null {
  if (key === 'power_analysis') {
    const power = num(v.actual_power);
    const need = num(v.required_n_per_group);
    if (power !== null && need !== null) return R.powerLine(power, need);
  }
  if (key === 'inter_rater_agreement') {
    const parts: string[] = [];
    for (const [who, label] of [
      ['ai_raters', R.aiRaters],
      ['human_raters', R.humanRaters],
    ] as const) {
      const a = isRecord(v[who]) ? num((v[who] as Record<string, unknown>).alpha) : null;
      if (a !== null) parts.push(R.alphaPart(label, a));
    }
    if (parts.length) return parts.join(', ');
  }
  if (key === 'win_rates') {
    const ai = isRecord(v.ai_raters) ? v.ai_raters : {};
    const rated = Object.values(ai).some((c) => isRecord(c) && (num(c.total) ?? 0) > 0);
    return rated ? R.winRatesDone : null;
  }
  const n = Object.keys(v).length;
  return n > 0 ? R.pairsDone(n) : null;
}

/** One readable line per test the analysis ran: errors as text, never a crash. */
export function analysisLines(analysis: unknown): AnalysisLine[] {
  if (!isRecord(analysis)) return [];
  const known = new Set(ANALYSIS_TESTS.map((t) => t.key));
  const tests = [
    ...ANALYSIS_TESTS,
    ...Object.keys(analysis)
      .filter((k) => !known.has(k))
      .map((k) => ({ key: k, label: k.replace(/_/g, ' ') })),
  ];
  const out: AnalysisLine[] = [];
  for (const { key, label } of tests) {
    if (!(key in analysis)) continue;
    const v = analysis[key];
    const errors = errorsIn(v);
    if (errors.length) {
      const more = errors.length > 1 ? R.moreErrors(errors.length - 1) : '';
      out.push({ key, label, state: 'error', text: errors[0] + more });
      continue;
    }
    const summary = isRecord(v) ? summaryOf(key, v) : null;
    out.push({ key, label, state: summary ? 'ok' : 'empty', text: summary ?? R.nothingToCompare });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ratings (B14: blinding decodes with `blinding_order[position_label]`)
// ---------------------------------------------------------------------------

/** The rating's blinding map, parsed when it arrives as text. */
export function blindingOf(r: Pick<AiRating, 'blinding_order'>): Record<string, number> {
  let b: unknown = r.blinding_order;
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b);
    } catch {
      return {};
    }
  }
  if (!isRecord(b)) return {};
  const out: Record<string, number> = {};
  for (const [label, id] of Object.entries(b)) {
    const n = typeof id === 'number' ? id : Number(id);
    if (Number.isFinite(n)) out[label] = n;
  }
  return out;
}

/** Condition id to the rank this rating gave it. */
export function ranksByCondition(
  r: Pick<AiRating, 'blinding_order' | 'items'>,
): Map<number, number> {
  const blinding = blindingOf(r);
  const out = new Map<number, number>();
  for (const item of r.items ?? []) {
    const cid = blinding[item.position_label];
    const rank = num(item.rank);
    if (cid !== undefined && rank !== null) out.set(cid, rank);
  }
  return out;
}

export interface WinRate {
  conditionId: number;
  /** Ratings that ranked this condition first. */
  wins: number;
  /** Completed ratings that ranked it at all. */
  rated: number;
  winRate: number | null;
  meanRank: number | null;
}

/** First places and mean rank per condition, from completed ratings. */
export function winRates(ratings: readonly AiRating[], conditionIds: readonly number[]): WinRate[] {
  const acc = new Map(conditionIds.map((id) => [id, { wins: 0, rated: 0, rankSum: 0 }]));
  for (const r of ratings) {
    if (r.status !== 'completed') continue;
    const ranks = ranksByCondition(r);
    for (const [cid, rank] of ranks) {
      const a = acc.get(cid);
      if (!a) continue;
      a.rated++;
      a.rankSum += rank;
      if (rank === 1) a.wins++;
    }
  }
  return conditionIds.map((id) => {
    const a = acc.get(id)!;
    return {
      conditionId: id,
      wins: a.wins,
      rated: a.rated,
      winRate: a.rated ? a.wins / a.rated : null,
      meanRank: a.rated ? a.rankSum / a.rated : null,
    };
  });
}

export interface Agreement {
  /** Prompt and model pairs rated by two or more raters. */
  shared: number;
  /** Of those, how many had every rater pick the same winner. */
  agreed: number;
}

/** How often raters agree on the winner, over pairs rated by more than one rater. */
export function winnerAgreement(ratings: readonly AiRating[]): Agreement {
  const winners = new Map<string, Set<number>>();
  const counts = new Map<string, number>();
  for (const r of ratings) {
    if (r.status !== 'completed') continue;
    const first = [...ranksByCondition(r)].find(([, rank]) => rank === 1);
    if (!first) continue;
    const key = `${r.prompt_id}\u0000${r.target_model_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const set = winners.get(key) ?? new Set<number>();
    set.add(first[0]);
    winners.set(key, set);
  }
  let shared = 0;
  let agreed = 0;
  for (const [key, n] of counts) {
    if (n < 2) continue;
    shared++;
    if (winners.get(key)!.size === 1) agreed++;
  }
  return { shared, agreed };
}

/** The rate stream's `progress` and `complete` counts. */
export function rateCounts(data: unknown): {
  completed: number | null;
  total: number | null;
  error: string | null;
} {
  if (!isRecord(data)) return { completed: null, total: null, error: null };
  return {
    completed: num(data.completed),
    total: num(data.total),
    error: typeof data.error === 'string' && data.error ? data.error : null,
  };
}

// ---------------------------------------------------------------------------
// Prolific form
// ---------------------------------------------------------------------------

export interface ProlificForm {
  promptCount: number;
  models: string[];
  ratersPerTask: number;
  batchId: string;
}

/** The first problem with the Prolific form, or null. */
export function prolificError(f: ProlificForm): string | null {
  if (!Number.isInteger(f.promptCount) || f.promptCount < 1) return R.prolificPromptsBad;
  if (!Number.isInteger(f.ratersPerTask) || f.ratersPerTask < 1) return R.prolificRatersBad;
  if (f.models.length === 0) return R.prolificModelsBad;
  return null;
}

/** POST /api/experiments/{id}/prolific body. */
export function prolificBody(f: ProlificForm) {
  return {
    prompt_count: f.promptCount,
    model_ids: [...f.models],
    raters_per_task: f.ratersPerTask,
    batch_id: f.batchId.trim(),
  };
}

// ---------------------------------------------------------------------------
// Export tab (D20)
// ---------------------------------------------------------------------------

export const preregName = (id: number) => `study-${id}-preregistration.md`;
export const reportName = (id: number) => `study-${id}-report.md`;

/** The report needs a finished study with statistics (brief 8.2.3). */
export const reportReady = (status: string, hasAnalysis: boolean) =>
  status === 'completed' && hasAnalysis;

/** The text field of a JSON answer, or a thrown error naming what was missing. */
export function textField(body: unknown, field: string): string {
  if (isRecord(body) && typeof body[field] === 'string') return body[field] as string;
  throw new Error(R.exportEmpty);
}
