// Model compare rules (brief 8.5, plan T27, D29). Pure: the shapes of
// POST /api/compare/run and GET /api/comparisons{,/{id}} (flinch/app.py
// run_multi_model_compare, flinch/db.py list_comparisons/get_comparison),
// which models and probes can be sent, the agreement figures and the tallies
// the comparison view shows. compare.test.ts covers it; compare.svelte.ts
// does the requests.
import { CLS_ORDER, toCls, type Cls } from '../../cls';
import { defaultTargetModel } from '../../session';
import type { ClsCounts } from '../class-bar';
import type { ModelGroup } from '../model-picker';

/** POST /api/compare/run refuses fewer than 2 or more than 5 models. */
export const MIN_MODELS = 2;
export const MAX_MODELS = 5;

/** The prompt preview length in the comparison view (brief 8.5). */
export const PROMPT_PREVIEW = 300;

/**
 * Rough seconds per probe: the models answer in parallel, then each answer
 * is classified (keyword scan plus the LLM judge). Probes run one after another.
 */
export const SECONDS_PER_PROBE = 25;

export const COMPARE_ROUTE = '/studies/compare';
export const comparisonRoute = (id: number) => `${COMPARE_ROUTE}/${id}`;
export const runRoute = (runId: number) => `/probe/runs/${runId}`;

/** One model's answer to one probe. */
export interface CompareAnswer {
  response: string | null;
  classification: string | null;
  run_id: number | null;
  session_id: number | null;
  error: string | null;
}

/** One probe's row: every model's answer, and whether their badges differ. */
export interface CompareResult {
  probe_id: number;
  probe_name: string;
  probe_domain: string;
  prompt_text: string;
  models: Record<string, CompareAnswer>;
  disagreement: boolean;
}

/** One entry of GET /api/comparisons. `agreement_rate` is already a percentage. */
export interface ComparisonSummary {
  id: number;
  name: string;
  models: string[];
  probe_ids: number[];
  /** Model id to the session it created (D29). */
  session_ids: Record<string, number>;
  agreement_rate: number;
  total_probes: number;
  notes: string;
  created_at: string;
}

/** GET /api/comparisons/{id}. */
export interface ComparisonDetail extends ComparisonSummary {
  results: CompareResult[];
}

/** POST /api/compare/run's reply. */
export interface CompareRunReply {
  comparison_id: number;
  models: string[];
  session_ids: Record<string, number>;
  results: CompareResult[];
  agreement_rate: number;
  total_probes: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const nullableStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const nullableNum = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function sessionIds(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const [k, id] of Object.entries(v)) if (typeof id === 'number') out[k] = id;
  return out;
}

function answer(v: unknown): CompareAnswer {
  const a = isRecord(v) ? v : {};
  return {
    response: nullableStr(a.response),
    classification: nullableStr(a.classification),
    run_id: nullableNum(a.run_id),
    session_id: nullableNum(a.session_id),
    error: nullableStr(a.error),
  };
}

function result(v: unknown): CompareResult {
  const r = isRecord(v) ? v : {};
  const models: Record<string, CompareAnswer> = {};
  if (isRecord(r.models)) for (const [m, a] of Object.entries(r.models)) models[m] = answer(a);
  return {
    probe_id: num(r.probe_id),
    probe_name: str(r.probe_name),
    probe_domain: str(r.probe_domain),
    prompt_text: str(r.prompt_text),
    models,
    disagreement: r.disagreement === true,
  };
}

/** One list row with every field present and typed. */
export function toSummary(v: unknown): ComparisonSummary {
  const r = isRecord(v) ? v : {};
  return {
    id: num(r.id),
    name: str(r.name),
    models: Array.isArray(r.models)
      ? r.models.filter((m): m is string => typeof m === 'string')
      : [],
    probe_ids: Array.isArray(r.probe_ids)
      ? r.probe_ids.filter((p): p is number => typeof p === 'number')
      : [],
    session_ids: sessionIds(r.session_ids),
    agreement_rate: num(r.agreement_rate),
    total_probes: num(r.total_probes),
    notes: str(r.notes),
    created_at: str(r.created_at),
  };
}

/** GET /api/comparisons/{id}, with every result typed. */
export function toDetail(v: unknown): ComparisonDetail {
  const r = isRecord(v) ? v : {};
  return {
    ...toSummary(v),
    results: Array.isArray(r.results) ? r.results.map(result) : [],
  };
}

/** GET /api/comparisons, newest first (the sidecar orders by date; ids break ties). */
export function sortComparisons(rows: unknown): ComparisonSummary[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(toSummary)
    .filter((c) => c.id > 0)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
}

/**
 * Since 0.9 the sidecar names a comparison "Compare {date} · claude vs gpt".
 * Names saved by 0.8 hold an em dash instead, which the UI never shows
 * (brief 5.7 rule 1), so it becomes the same middle dot.
 */
export function displayName(name: string): string {
  const emDash = String.fromCharCode(0x2014);
  return name.split(` ${emDash} `).join(' · ').split(emDash).join(' · ');
}

/** "claude-sonnet-4-6 vs gpt-4.1". */
export function modelsLine(models: readonly string[]): string {
  return models.join(' vs ');
}

/** An agreement percentage as shown: whole numbers. */
export function agreementLabel(rate: number): string {
  return `${Math.round(Number.isFinite(rate) ? rate : 0)}%`;
}

export type Tone = 'ok' | 'warn' | 'danger';

/** Brief 8.5: ok at 80 or more, warn at 50 or more, danger below. */
export function agreementTone(rate: number): Tone {
  if (rate >= 80) return 'ok';
  if (rate >= 50) return 'warn';
  return 'danger';
}

/** Results where every model that answered got the same badge. */
export function alignedCount(results: readonly CompareResult[]): number {
  return results.filter((r) => !r.disagreement).length;
}

/** The badge a cell shows: its class, `unknown` for a failure or a missing answer. */
export function cellClass(a: CompareAnswer | undefined): Cls {
  return a && !a.error ? toCls(a.classification) : 'unknown';
}

/** How many of each badge one model got across the comparison. */
export function modelTally(results: readonly CompareResult[], model: string): ClsCounts {
  const counts: ClsCounts = {};
  for (const r of results) {
    const c = cellClass(r.models[model]);
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

/** A tally as ordered (class, count) pairs, zeros left out. */
export function tallyRows(counts: ClsCounts): { cls: Cls; count: number }[] {
  return CLS_ORDER.flatMap((cls) => (counts[cls] ? [{ cls, count: counts[cls] as number }] : []));
}

/** The models the run sends: trimmed, blanks dropped, first of each id kept. */
export function pickedModels(rows: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of rows) {
    const m = raw.trim();
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

/** Whether two filled rows name the same model. */
export function hasDuplicate(rows: readonly string[]): boolean {
  const filled = rows.map((r) => r.trim()).filter(Boolean);
  return new Set(filled).size !== filled.length;
}

export type CompareProblem = 'models' | 'duplicate' | 'probes';

/** What blocks Run, in field order; empty when the comparison can be sent. */
export function compareProblems(rows: readonly string[], probeCount: number): CompareProblem[] {
  const out: CompareProblem[] = [];
  const n = pickedModels(rows).length;
  if (n < MIN_MODELS || n > MAX_MODELS) out.push('models');
  if (hasDuplicate(rows)) out.push('duplicate');
  if (probeCount < 1) out.push('probes');
  return out;
}

/**
 * The two rows Set up starts with: the session default (I18) and the first
 * model of another available provider, else the next model of the same one.
 */
export function defaultModels(groups: readonly ModelGroup[]): string[] {
  const first = defaultTargetModel(groups);
  const available = groups.filter((g) => g.available && g.models.length > 0);
  const home = available.find((g) => g.models.some((m) => m.id === first));
  const other = available.find((g) => g !== home);
  const second =
    other?.models[0]?.id ?? home?.models.find((m) => m.id !== first && !m.deprecated)?.id ?? '';
  return [first, second];
}

/** Expected minutes for `probes` probes (R11), at least 1. */
export function expectedMinutes(probes: number): number {
  return Math.max(1, Math.ceil((Math.max(0, probes) * SECONDS_PER_PROBE) / 60));
}

/** POST /api/probes for "Add a custom prompt" (brief 8.5). */
export function customProbeBody(text: string, now: number) {
  return { name: `custom-${now}`, domain: 'custom', prompt_text: text.trim() };
}

/** The comparison's export files (GET /api/comparisons/{id}/export). */
export function exportName(id: number, format: 'json' | 'csv'): string {
  return `flinch-comparison-${id}.${format}`;
}
