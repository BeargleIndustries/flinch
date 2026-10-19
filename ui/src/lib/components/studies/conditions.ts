// Conditions studies (brief 8.2, D28): the logic behind the list, the new
// study form, the Add prompts dialog and the Run tab, kept out of the
// components so it can be tested. Types for the rows the experiments API
// returns that types.ts does not name sit here (plan rule: types.ts is frozen).
import type { Condition, ProviderLimit, StudyProgress, Variant } from '$lib/api/types';
import { toCls, type Cls } from '$lib/cls';
import { CONDITIONS } from '$lib/copy/studies';

// ---------------------------------------------------------------------------
// Rows the API returns (local types)
// ---------------------------------------------------------------------------

/** One entry of GET /api/experiments/{id}/prompts (`flinch/db.py` list_experiment_prompts). */
export interface StudyPrompt {
  id: number;
  experiment_id: number;
  probe_id: number | null;
  custom_prompt_text: string | null;
  domain: string | null;
  sort_order: number;
  probe_name: string | null;
  probe_text: string | null;
}

/** One entry of GET /api/experiments/{id}/responses (an `experiment_responses` row). */
export interface StudyResponse {
  id: number;
  condition_id: number;
  prompt_id: number;
  model_id: string;
  repetition: number;
  status: string;
  classification: string | null;
  error_message: string | null;
}

/** POST /api/experiments/{id}/estimate (B02: nested, multiplied by repetitions). */
export interface StudyEstimate {
  estimate: { estimated_cost_usd: number; total_cells: number };
  cells: number;
  prompts: number;
  conditions: number;
  models: number;
  repetitions: number;
}

/** The `complete` event of the HH-RLHF import stream (`flinch/hh_import.py`). */
export interface HhResult {
  imported: number;
  skipped: number;
  warning: string | null;
}

// ---------------------------------------------------------------------------
// Limits (`flinch/models.py`, `flinch/rate_limiter.py`)
// ---------------------------------------------------------------------------

export const NAME_MAX = 200;
export const LABEL_MAX = 100;
export const REPEATS_MAX = 50;
export const HH_TARGET_MAX = 5000;
export const RPM_MAX = 10000;
export const CONCURRENT_MAX = 50;
/** GET /api/experiments/{id}/responses answers at most this many rows. */
export const RESPONSES_LIMIT = 1000;
/** Above this many cells the form warns (brief 8.2.2). */
export const LARGE_STUDY = 500;

/** The `config` key the form saves rate limits under; Start and Resume send it back. */
export const RATE_CONFIG_KEY = 'rate_limits';

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export interface ConditionRow {
  /** Stable key for the each block. */
  key: number;
  label: string;
  systemPrompt: string;
}

let nextKey = 1;
export const conditionRow = (label: string, systemPrompt = ''): ConditionRow => ({
  key: nextKey++,
  label,
  systemPrompt,
});

/** The two rows a new study starts with: the control (no system prompt) and one more. */
export function defaultConditions(): ConditionRow[] {
  return [conditionRow(CONDITIONS.controlLabel), conditionRow(CONDITIONS.conditionN(1))];
}

/** A conditions file's variants as rows: the label, and its prompt text as the system prompt. */
export function rowsFromVariants(variants: readonly Variant[]): ConditionRow[] {
  return variants.map((v) => conditionRow(v.label.trim(), v.prompt_text ?? ''));
}

/** The next "Condition n" label not already used. */
export function nextConditionLabel(rows: readonly ConditionRow[]): string {
  const used = new Set(rows.map((r) => r.label.trim().toLowerCase()));
  for (let n = 1; ; n++) {
    const label = CONDITIONS.conditionN(n);
    if (!used.has(label.toLowerCase())) return label;
  }
}

/** The error under the Conditions panel, or null. Empty system prompts are allowed (B08). */
export function conditionsError(rows: readonly ConditionRow[]): string | null {
  const labels = rows.map((r) => r.label.trim());
  if (labels.length === 0 || labels.some((l) => l === '')) return CONDITIONS.needCondition;
  if (labels.some((l) => l.length > LABEL_MAX)) return CONDITIONS.labelLong;
  const lower = labels.map((l) => l.toLowerCase());
  if (new Set(lower).size !== lower.length) return CONDITIONS.uniqueLabels;
  return null;
}

/** POST /api/experiments `conditions`. */
export function conditionsBody(rows: readonly ConditionRow[]) {
  return rows.map((r, i) => ({
    label: r.label.trim(),
    system_prompt: r.systemPrompt,
    sort_order: i,
  }));
}

// ---------------------------------------------------------------------------
// Prompt sources (I12: HH-RLHF, then picked probes, then pasted CSV)
// ---------------------------------------------------------------------------

export const HH_SUBSETS = [
  'harmless-base',
  'helpful-base',
  'helpful-online',
  'helpful-rejection-sampled',
] as const;

export const HH_KINDS = ['factual', 'advice', 'opinion', 'ethical'] as const;
export type HhKind = (typeof HH_KINDS)[number];

/** The importer's default mix, in percent (`flinch/hh_import.py`). */
export const HH_DEFAULT_MIX: Readonly<Record<HhKind, number>> = {
  factual: 35,
  advice: 25,
  opinion: 25,
  ethical: 15,
};

export interface HhSource {
  enabled: boolean;
  targetCount: number;
  subsets: string[];
  seed: number;
  mix: Record<HhKind, number>;
}

export interface PromptSources {
  hh: HhSource;
  probeIds: Set<number>;
  csvText: string;
}

export function emptySources(): PromptSources {
  return {
    hh: {
      enabled: false,
      targetCount: 300,
      subsets: [...HH_SUBSETS],
      seed: 42,
      mix: { ...HH_DEFAULT_MIX },
    },
    probeIds: new Set(),
    csvText: '',
  };
}

const isWhole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function mixSum(mix: Readonly<Record<HhKind, number>>): number {
  return HH_KINDS.reduce((s, k) => s + (Number.isFinite(mix[k]) ? mix[k] : 0), 0);
}

export function isDefaultMix(mix: Readonly<Record<HhKind, number>>): boolean {
  return HH_KINDS.every((k) => mix[k] === HH_DEFAULT_MIX[k]);
}

/** The first problem with the HH-RLHF fields, or null. */
export function hhError(hh: HhSource): string | null {
  if (!hh.enabled) return null;
  if (!isWhole(hh.targetCount) || hh.targetCount < 1 || hh.targetCount > HH_TARGET_MAX)
    return CONDITIONS.hhTargetBad;
  if (hh.subsets.length === 0) return CONDITIONS.hhSubsetsBad;
  if (!isWhole(hh.seed)) return CONDITIONS.hhSeedBad;
  const bad = HH_KINDS.some((k) => !Number.isFinite(hh.mix[k]) || hh.mix[k] < 0);
  const sum = mixSum(hh.mix);
  if (bad || Math.abs(sum - 100) > 0.001) return CONDITIONS.hhMixSum(sum);
  return null;
}

/**
 * POST /api/experiments/{id}/prompts/import-hh. The default mix is sent as
 * `null` (the importer's own defaults, brief 8.2.2); any other as fractions.
 */
export function hhBody(hh: HhSource) {
  const stratification = isDefaultMix(hh.mix)
    ? null
    : Object.fromEntries(HH_KINDS.map((k) => [k, hh.mix[k] / 100]));
  return {
    target_count: hh.targetCount,
    subsets: [...hh.subsets],
    seed: hh.seed,
    stratification,
  };
}

/**
 * Minimal RFC 4180 parse: commas, double-quoted fields with "" escapes and
 * line breaks inside quotes; LF and CRLF rows. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

export interface CsvCount {
  /** Rows the server will import: a non-empty `prompt_text`. */
  rows: number;
  /** Whether the first row names a `prompt_text` column. */
  hasHeader: boolean;
}

/** What `flinch/db.py` bulk_import_prompts will make of the pasted text. */
export function csvCount(text: string): CsvCount {
  if (!text.trim()) return { rows: 0, hasHeader: false };
  const [header, ...body] = parseCsv(text.trim());
  const col = (header ?? []).indexOf('prompt_text');
  if (col < 0) return { rows: 0, hasHeader: false };
  return { rows: body.filter((r) => (r[col] ?? '').trim() !== '').length, hasHeader: true };
}

/** Prompts the sources will add: picked probes, pasted rows and the HH-RLHF target. */
export function sourcePromptCount(s: PromptSources): number {
  return s.probeIds.size + csvCount(s.csvText).rows + (s.hh.enabled ? s.hh.targetCount || 0 : 0);
}

/** The first problem with the sources, or null; `needOne` asks for at least one prompt. */
export function sourcesError(s: PromptSources, needOne: string): string | null {
  const hh = hhError(s.hh);
  if (hh) return hh;
  if (s.csvText.trim() && !csvCount(s.csvText).hasHeader) return CONDITIONS.csvNoHeader;
  return sourcePromptCount(s) > 0 ? null : needOne;
}

// ---------------------------------------------------------------------------
// Models, repeats and rate limits
// ---------------------------------------------------------------------------

/** The provider the run's rate pool files a model under (`flinch/runner.py` _get_provider). */
export function rateProvider(modelId: string): string {
  if (modelId.startsWith('ollama:')) return 'ollama';
  const m = modelId.toLowerCase();
  if (['claude', 'haiku', 'sonnet', 'opus'].some((x) => m.includes(x))) return 'anthropic';
  if (['gpt', 'o3', 'o4'].some((x) => m.includes(x))) return 'openai';
  if (m.includes('gemini')) return 'google';
  if (m.includes('grok')) return 'xai';
  return 'together';
}

/** `ProviderRateLimiter.DEFAULT_LIMITS`, and its fallback for any other provider. */
export const RATE_DEFAULTS: Readonly<Record<string, { rpm: number; concurrent: number }>> = {
  anthropic: { rpm: 60, concurrent: 5 },
  openai: { rpm: 60, concurrent: 5 },
  google: { rpm: 60, concurrent: 3 },
  together: { rpm: 60, concurrent: 3 },
  xai: { rpm: 60, concurrent: 3 },
};
export const RATE_FALLBACK = { rpm: 30, concurrent: 2 };

export const rateDefault = (provider: string) => RATE_DEFAULTS[provider] ?? RATE_FALLBACK;

/** One provider's two fields as typed (empty means the default). */
export interface RateRow {
  rpm: string;
  concurrent: string;
}

/** Distinct providers of the picked models, in pick order. */
export function providersOf(models: readonly string[]): string[] {
  return [...new Set(models.filter((m) => m.trim()).map((m) => rateProvider(m.trim())))];
}

function wholeIn(text: string, max: number): number | null | 'bad' {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : 'bad';
}

/**
 * `concurrency_per_provider` (B36, I25): only `at once` is the bare integer
 * form; a calls-a-minute value makes `{rpm, concurrent?}`; both empty leaves
 * the provider out (the pool default). Returns null when a field is invalid.
 */
export function rateLimitsBody(
  providers: readonly string[],
  rows: Readonly<Record<string, RateRow>>,
): Record<string, number | ProviderLimit> | null {
  const out: Record<string, number | ProviderLimit> = {};
  for (const p of providers) {
    const row = rows[p];
    if (!row) continue;
    const rpm = wholeIn(row.rpm, RPM_MAX);
    const concurrent = wholeIn(row.concurrent, CONCURRENT_MAX);
    if (rpm === 'bad' || concurrent === 'bad') return null;
    if (rpm !== null) out[p] = concurrent === null ? { rpm } : { rpm, concurrent };
    else if (concurrent !== null) out[p] = concurrent;
  }
  return out;
}

/** The saved limits from a study's `config`, keeping only the shapes the route accepts. */
export function savedRateLimits(config: unknown): Record<string, number | ProviderLimit> {
  const raw =
    config && typeof config === 'object'
      ? (config as Record<string, unknown>)[RATE_CONFIG_KEY]
      : null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number | ProviderLimit> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isWhole(v) && v >= 1 && v <= CONCURRENT_MAX) out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const { rpm, concurrent } = v as Record<string, unknown>;
      const lim: ProviderLimit = {};
      if (isWhole(rpm) && rpm >= 1 && rpm <= RPM_MAX) lim.rpm = rpm;
      if (isWhole(concurrent) && concurrent >= 1 && concurrent <= CONCURRENT_MAX)
        lim.concurrent = concurrent;
      if (lim.rpm || lim.concurrent) out[k] = lim;
    }
  }
  return out;
}

/** A saved limit in words: "2 at once" or "60 a minute, 1 at once". */
export function rateWords(limit: number | ProviderLimit): string {
  return typeof limit === 'number'
    ? CONDITIONS.rateOnlyConcurrent(limit)
    : CONDITIONS.rateFull(limit.rpm ?? null, limit.concurrent ?? null);
}

/** The repeats field: a whole number 1 to 50, or null. */
export function repeatsValue(n: unknown): number | null {
  return isWhole(n) && n >= 1 && n <= REPEATS_MAX ? n : null;
}

/** The seed field: empty is no seed (undefined); a whole number; anything else is null (bad). */
export function seedValue(text: string): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function cellTotal(prompts: number, conditions: number, models: number, repeats: number) {
  return (
    Math.max(0, prompts) * Math.max(0, conditions) * Math.max(0, models) * Math.max(0, repeats)
  );
}

// ---------------------------------------------------------------------------
// Run tab
// ---------------------------------------------------------------------------

export const conditionsStreamId = (id: number) => `conditions:${id}`;
export const hhStreamId = (id: number) => `hh:${id}`;
export const studyRoute = (id: number) => `/studies/conditions/${id}`;

export type PrimaryAction = 'start' | 'pause' | 'resume' | 'runPending' | null;
export type RunNote = 'orphan' | 'elsewhere' | 'allDone' | 'needPrompts' | null;

export interface RunState {
  status: string;
  /** This window's stream for the study is open. */
  attached: boolean;
  /** GET /progress `active`: some stream owns the study on the server. */
  active: boolean;
  progress: Pick<StudyProgress, 'total' | 'pending' | 'failed'>;
  /** Prompts in the study; a draft with none cannot start. */
  prompts: number;
}

export interface RunActions {
  primary: PrimaryAction;
  /** Whether the primary button is enabled (Resume always is, F14). */
  enabled: boolean;
  /** Failed cells to offer "Retry"; 0 hides it. */
  retry: number;
  note: RunNote;
}

/** The action row by state (brief 8.2.3, F14: Resume stays enabled; the server guards). */
export function runActions(s: RunState): RunActions {
  if (s.attached) return { primary: 'pause', enabled: true, retry: 0, note: null };
  const { total, pending, failed } = s.progress;
  const retry = s.status !== 'running' && failed > 0 ? failed : 0;
  switch (s.status) {
    case 'draft': {
      const empty = s.prompts === 0 && total === 0;
      return {
        primary: 'start',
        enabled: !empty,
        retry: 0,
        note: empty ? 'needPrompts' : s.active ? 'elsewhere' : null,
      };
    }
    case 'running':
      return {
        primary: 'resume',
        enabled: true,
        retry: 0,
        note: s.active ? 'elsewhere' : 'orphan',
      };
    case 'paused':
      return { primary: 'resume', enabled: true, retry, note: s.active ? 'elsewhere' : null };
    default: {
      const done = pending === 0 && failed === 0 && total > 0;
      return {
        primary: pending > 0 ? 'runPending' : null,
        enabled: true,
        retry,
        note: done ? 'allDone' : s.active ? 'elsewhere' : null,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Cell grid
// ---------------------------------------------------------------------------

export type CellState = 'pending' | 'failed' | Cls;

export interface GridCell {
  id: number;
  state: CellState;
  promptId: number;
  modelId: string;
  repetition: number;
}

export interface GridRow {
  condition: Condition;
  cells: GridCell[];
}

/** A cell's state: its badge once completed, else pending or failed. */
export function cellState(r: Pick<StudyResponse, 'status' | 'classification'>): CellState {
  if (r.status === 'completed') return toCls(r.classification);
  if (r.status === 'failed') return 'failed';
  return 'pending';
}

/**
 * One row per condition (by sort order), its cells by prompt order, then
 * model, then repeat, so the same column is the same prompt, model and
 * repeat in every row.
 */
export function buildGrid(
  conditions: readonly Condition[],
  responses: readonly StudyResponse[],
  prompts: readonly Pick<StudyPrompt, 'id'>[] = [],
): GridRow[] {
  const order = new Map(prompts.map((p, i) => [p.id, i]));
  const rank = (id: number) => order.get(id) ?? order.size + id;
  const byCondition = new Map<number, StudyResponse[]>();
  for (const r of responses) {
    const list = byCondition.get(r.condition_id);
    if (list) list.push(r);
    else byCondition.set(r.condition_id, [r]);
  }
  return [...conditions]
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((condition) => ({
      condition,
      cells: (byCondition.get(condition.id) ?? [])
        .slice()
        .sort(
          (a, b) =>
            rank(a.prompt_id) - rank(b.prompt_id) ||
            (a.model_id < b.model_id ? -1 : a.model_id > b.model_id ? 1 : 0) ||
            a.repetition - b.repetition,
        )
        .map((r) => ({
          id: r.id,
          state: cellState(r),
          promptId: r.prompt_id,
          modelId: r.model_id,
          repetition: r.repetition,
        })),
    }));
}

/** A prompt's short name: the probe name, else the first 60 characters of its text. */
export function promptName(p: StudyPrompt | undefined): string {
  if (!p) return '';
  if (p.probe_name) return p.probe_name;
  const text = (p.custom_prompt_text ?? p.probe_text ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

// ---------------------------------------------------------------------------
// Stream events
// ---------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export interface RunCounts {
  total: number | null;
  completed: number | null;
  failed: number | null;
}

/** The counts in a `started`, `progress`, `paused` or `complete` event. */
export function eventCounts(data: unknown): RunCounts {
  if (!isRecord(data)) return { total: null, completed: null, failed: null };
  return { total: num(data.total), completed: num(data.completed), failed: num(data.failed) };
}

/** The text of an `error` event. */
export function eventError(data: unknown): string {
  if (isRecord(data) && typeof data.error === 'string') return data.error;
  return typeof data === 'string' ? data : '';
}

/** The HH-RLHF `complete` event. */
export function hhResult(data: unknown): HhResult {
  if (!isRecord(data)) return { imported: 0, skipped: 0, warning: null };
  return {
    imported: num(data.imported) ?? 0,
    skipped: num(data.skipped) ?? 0,
    warning: typeof data.warning === 'string' && data.warning ? data.warning : null,
  };
}
