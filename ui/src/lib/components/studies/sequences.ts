// Sequences logic (brief 8.4, 9.9, plan T25). Pure functions the Run tab, its
// store and StrategyDialog share: strategy labels and form checks, the
// sequence list order and per-card actions, the interactive thread built from
// stored turns, the automatic stream's line, the batch body, estimate and
// progress rows, and the whittle working line's expected duration (R11).
//
// The shapes below are the fields this screen reads from the sidecar
// (`flinch/db.py` strategy_templates, sequences, sequence_runs,
// sequence_turns, sequence_batches; `flinch/runner.py` replies); they sit here
// rather than in api/types.ts (T24 rule).

import { CLS_SPEC, toCls } from '$lib/cls';

/** One row of GET /api/strategies. */
export interface Strategy {
  id: number;
  name: string;
  description: string | null;
  goal: string;
  opening_pattern: string;
  escalation_pattern: string;
  setup_hint: string;
  category: string | null;
  effectiveness_notes?: string | null;
  is_builtin: number | boolean | null;
  created_at?: string | null;
}

/** One row of GET /api/sessions/{id}/sequences. */
export interface Sequence {
  id: number;
  session_id: number;
  probe_id: number;
  strategy_id: number;
  batch_id: number | null;
  mode: string;
  max_warmup_turns: number;
  use_narrative_engine: number | boolean | null;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  /** Only on the create reply: the interactive sequence's first run. */
  current_run_id?: number | null;
}

export interface SequenceRun {
  id: number;
  sequence_id: number;
  warmup_count: number;
  status: string;
  probe_classification: string | null;
  threshold_found: number | boolean | null;
  created_at?: string | null;
  completed_at?: string | null;
}

/** GET /api/sequences/{id} (`db.get_sequence_summary`). */
export interface SequenceSummary extends Sequence {
  runs: SequenceRun[];
  summary: {
    total_runs: number;
    complied: number;
    refused: number;
    threshold_warmup_count: number | null;
    threshold_found: boolean;
  };
}

/** A stored turn (GET /api/sequence-runs/{id}/turns) or one in a turn reply. */
export interface SequenceTurn {
  turn_number: number;
  role: string;
  content: string;
  classification?: string | null;
  turn_type: string;
}

/** POST /api/sequences/{id}/run-turn. */
export interface TurnReply {
  coach_turn: SequenceTurn;
  target_turn: SequenceTurn;
  warmup_turns_sent: number;
  warmup_turns_planned: number;
}

/** POST /api/sequences/{id}/drop-probe. */
export interface DropReply {
  turns: SequenceTurn[];
  probe_classification: string;
}

/** POST /api/sequences/{id}/whittle. */
export interface WhittleReply {
  sequence_id: number;
  results: { warmup_count: number; probe_classification: string; error?: string }[];
  threshold_at: number | null;
  threshold_found: boolean;
  total_runs: number;
}

/** GET /api/sequence-batches/{id} and the create reply. */
export interface SequenceBatch {
  id: number;
  session_id: number;
  strategy_id: number;
  mode: string;
  fixed_n: number | null;
  max_warmup_turns: number;
  status: string;
  probes_total: number;
  probes_completed: number;
  estimated_cost_usd: number | null;
}

/** POST /api/sequence-batches/{id}/estimate (`runner.estimate_sequence_cost`). */
export interface BatchEstimate {
  probe_count: number;
  mode: string;
  max_turns: number;
  estimated_runs: number;
  estimated_total_turns: number;
  estimated_tokens: number;
  estimated_cost_usd: number;
}

// ── Limits (brief 8.4) ─────────────────────────────────────────

export const WARMUP_MIN = 1;
export const WARMUP_MAX = 20;
export const WARMUP_DEFAULT = 10;
export const DEPTH_MIN = 0;
export const DEPTH_MAX = 20;
export const DEPTH_DEFAULT = 3;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Warmup turns: 1 to 20, default 10. */
export const clampWarmup = (v: unknown) => clampInt(v, WARMUP_MIN, WARMUP_MAX, WARMUP_DEFAULT);

/** Batch depth (`fixed_n`): 0 to 20; 0 is a real depth (B02). */
export const clampDepth = (v: unknown) => clampInt(v, DEPTH_MIN, DEPTH_MAX, DEPTH_DEFAULT);

// ── Strategies ─────────────────────────────────────────────────

/** "fiction_workshop" reads "fiction workshop". */
export function strategyTitle(name: string | null | undefined): string {
  return (name ?? '').replace(/_+/g, ' ').trim();
}

/** The select option: "{name with underscores as spaces} ({category})". */
export function strategyOption(s: Pick<Strategy, 'name' | 'category'>): string {
  const title = strategyTitle(s.name);
  const cat = (s.category ?? '').trim();
  return cat ? `${title} (${cat})` : title;
}

export function isBuiltin(s: Pick<Strategy, 'is_builtin'>): boolean {
  return s.is_builtin === true || s.is_builtin === 1;
}

/** The strategy to preselect: `current` while listed, else the first. */
export function pickStrategy(list: readonly Strategy[], current: number | null): number | null {
  if (current !== null && list.some((s) => s.id === current)) return current;
  return list[0]?.id ?? null;
}

export interface StrategyForm {
  name: string;
  description: string;
  goal: string;
  opening_pattern: string;
  escalation_pattern: string;
  setup_hint: string;
  category: string;
}

export const EMPTY_STRATEGY: Readonly<StrategyForm> = {
  name: '',
  description: '',
  goal: '',
  opening_pattern: '',
  escalation_pattern: '',
  setup_hint: '',
  category: '',
};

/** The fields `POST /api/strategies` requires (`flinch/app.py` create_strategy). */
export const REQUIRED_STRATEGY_FIELDS = [
  'name',
  'goal',
  'opening_pattern',
  'escalation_pattern',
  'setup_hint',
] as const;

export function strategyForm(s: Partial<Strategy> | null | undefined): StrategyForm {
  if (!s) return { ...EMPTY_STRATEGY };
  return {
    name: s.name ?? '',
    description: s.description ?? '',
    goal: s.goal ?? '',
    opening_pattern: s.opening_pattern ?? '',
    escalation_pattern: s.escalation_pattern ?? '',
    setup_hint: s.setup_hint ?? '',
    category: s.category ?? '',
  };
}

/** Required fields left blank, in form order. */
export function missingStrategyFields(
  f: StrategyForm,
): (typeof REQUIRED_STRATEGY_FIELDS)[number][] {
  return REQUIRED_STRATEGY_FIELDS.filter((k) => !f[k].trim());
}

/** Whether another strategy (not `exceptId`) already has this name, ignoring case and spaces. */
export function duplicateStrategyName(
  name: string,
  list: readonly Pick<Strategy, 'id' | 'name'>[],
  exceptId: number | null = null,
): boolean {
  const key = (s: string) => s.trim().toLowerCase();
  const k = key(name);
  return !!k && list.some((s) => s.id !== exceptId && key(s.name) === k);
}

/** The body for POST or PUT: every field trimmed. */
export function strategyBody(f: StrategyForm): StrategyForm {
  return {
    name: f.name.trim(),
    description: f.description.trim(),
    goal: f.goal.trim(),
    opening_pattern: f.opening_pattern.trim(),
    escalation_pattern: f.escalation_pattern.trim(),
    setup_hint: f.setup_hint.trim(),
    category: f.category.trim(),
  };
}

// ── The sequence list ──────────────────────────────────────────

const stamp = (s: string | null | undefined) => {
  const t = s ? Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`) : Number.NaN;
  return Number.isFinite(t) ? t : 0;
};

/** Newest first (created_at, then id). Drops rows without an id. */
export function sortSequences(rows: unknown): Sequence[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Sequence[])
    .filter((r) => r && typeof r.id === 'number')
    .sort((a, b) => stamp(b.created_at) - stamp(a.created_at) || b.id - a.id);
}

export const isInteractive = (s: Pick<Sequence, 'mode'>) => s.mode === 'interactive';

export const usesEngine = (s: Pick<Sequence, 'use_narrative_engine'>) =>
  s.use_narrative_engine === true || s.use_narrative_engine === 1;

/** Interactive sequences take turns while pending or running. */
export function canStep(s: Pick<Sequence, 'mode' | 'status'>): boolean {
  return isInteractive(s) && (s.status === 'pending' || s.status === 'running');
}

/** Every other mode runs all its turns on request, unless it is running. */
export function canRunAll(s: Pick<Sequence, 'mode' | 'status'>): boolean {
  return !isInteractive(s) && s.status !== 'running';
}

/** Completed or failed sequences have something to read on the Results tab. */
export function hasResults(s: Pick<Sequence, 'status'>): boolean {
  return s.status === 'completed' || s.status === 'failed';
}

/** The run that takes the next turn: the newest pending or running run. */
export function activeRun(runs: readonly SequenceRun[]): SequenceRun | null {
  let best: SequenceRun | null = null;
  for (const r of runs)
    if ((r.status === 'pending' || r.status === 'running') && (!best || r.id > best.id)) best = r;
  return best;
}

/** The newest run, whatever its status. */
export function latestRun(runs: readonly SequenceRun[]): SequenceRun | null {
  let best: SequenceRun | null = null;
  for (const r of runs) if (!best || r.id > best.id) best = r;
  return best;
}

// ── The thread ─────────────────────────────────────────────────

export interface ThreadTurn {
  key: number;
  role: 'coach' | 'target' | 'probe';
  turnType: 'warmup' | 'setup' | 'probe';
  content: string;
  /** The model's class; only model turns carry one. */
  cls: string | null;
  /** 1-based warmup number for warmup turns (the coach turn and the model reply share it). */
  warmup: number | null;
}

const ROLE_SET = new Set(['coach', 'target', 'probe']);
const TYPE_SET = new Set(['warmup', 'setup', 'probe']);

/** Stored turns merged with new ones by turn number (new wins), in order. */
export function mergeTurns(
  existing: readonly SequenceTurn[],
  incoming: readonly SequenceTurn[],
): SequenceTurn[] {
  const map = new Map<number, SequenceTurn>();
  for (const t of existing) map.set(t.turn_number, t);
  for (const t of incoming) map.set(t.turn_number, t);
  return [...map.values()].sort((a, b) => a.turn_number - b.turn_number);
}

/** The thread the card draws: roles and types checked, warmups numbered. */
export function buildThread(turns: readonly SequenceTurn[]): ThreadTurn[] {
  let warmup = 0;
  return [...turns]
    .filter((t) => t && typeof t.turn_number === 'number')
    .sort((a, b) => a.turn_number - b.turn_number)
    .map((t) => {
      const role = (ROLE_SET.has(t.role) ? t.role : 'target') as ThreadTurn['role'];
      const turnType = (
        TYPE_SET.has(t.turn_type) ? t.turn_type : 'warmup'
      ) as ThreadTurn['turnType'];
      if (turnType === 'warmup' && role !== 'target') warmup += 1;
      return {
        key: t.turn_number,
        role,
        turnType,
        content: t.content ?? '',
        cls: role === 'target' ? (t.classification ?? null) : null,
        warmup: turnType === 'warmup' ? Math.max(warmup, 1) : null,
      };
    });
}

/** Warmup turns the coach has sent in a thread. */
export function warmupsSent(turns: readonly SequenceTurn[]): number {
  return turns.filter((t) => t.role === 'coach' && t.turn_type === 'warmup').length;
}

/** The model's class on the probe turn, once the probe has been dropped. */
export function probeClass(turns: readonly SequenceTurn[]): string | null {
  const t = [...turns].reverse().find((x) => x.role === 'target' && x.turn_type === 'probe');
  return t?.classification ?? null;
}

// ── The automatic stream (`sequence:{id}`) ─────────────────────

export interface AutoLive {
  phase: 'running' | 'finished' | 'failed' | 'stopped';
  step: number;
  total: number;
  turnType: string | null;
  cls: string | null;
  runId: number | null;
  probeCls: string | null;
  error: string | null;
}

export function initialAuto(warmup: number): AutoLive {
  return {
    phase: 'running',
    step: 0,
    total: Math.max(1, warmup + 1),
    turnType: null,
    cls: null,
    runId: null,
    probeCls: null,
    error: null,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Folds one event of POST /api/sequences/{id}/run-auto into the live state. */
export function applyAutoEvent(live: AutoLive, name: string, data: unknown): AutoLive {
  if (!isRecord(data)) return live;
  const runId = num(data.sequence_run_id) ?? live.runId;
  if (name === 'turn') {
    return {
      ...live,
      step: num(data.step) ?? live.step,
      total: num(data.total_steps) ?? live.total,
      turnType: str(data.turn_type),
      cls: str(data.classification),
      runId,
    };
  }
  if (name === 'complete') {
    const total = num(data.total_steps) ?? live.total;
    return {
      ...live,
      phase: 'finished',
      step: num(data.step) ?? total,
      total,
      turnType: 'probe',
      cls: str(data.probe_classification),
      probeCls: str(data.probe_classification),
      runId,
    };
  }
  if (name === 'error') {
    return { ...live, phase: 'failed', error: str(data.error) ?? str(data.message) ?? '', runId };
  }
  return live;
}

/** "Warmup" or "Setup" and the class word for the live line. */
export function autoLineParts(live: AutoLive): { type: string; cls: string } | null {
  if (!live.turnType) return null;
  const type = live.turnType[0].toUpperCase() + live.turnType.slice(1);
  return { type, cls: CLS_SPEC[toCls(live.cls)].word };
}

// ── Batches ────────────────────────────────────────────────────

export type BatchMode = 'whittle' | 'fixed_n';

export interface BatchForm {
  strategyId: number | null;
  probeIds: readonly number[];
  mode: BatchMode;
  maxWarmup: number;
  depth: number;
}

/** POST /api/sessions/{id}/sequence-batch: `fixed_n` only in fixed mode (0 is kept). */
export function batchBody(f: BatchForm): {
  strategy_id: number;
  probe_ids: number[];
  mode: BatchMode;
  fixed_n: number | null;
  max_warmup_turns: number;
} | null {
  if (f.strategyId === null || f.probeIds.length === 0) return null;
  return {
    strategy_id: f.strategyId,
    probe_ids: [...f.probeIds].sort((a, b) => a - b),
    mode: f.mode,
    fixed_n: f.mode === 'fixed_n' ? clampDepth(f.depth) : null,
    max_warmup_turns: clampWarmup(f.maxWarmup),
  };
}

/** A key that changes whenever any field the estimate depends on changes. */
export function batchKey(f: BatchForm): string {
  const b = batchBody(f);
  return b ? JSON.stringify(b) : '';
}

/** "$0.06"; a positive cost under a cent reads `under`; NaN reads null. */
export function formatCost(usd: unknown, under: string): string | null {
  const n = typeof usd === 'number' ? usd : Number(usd);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 0 && n < 0.005) return under;
  return `$${n.toFixed(2)}`;
}

export interface BatchRow {
  sequenceId: number | null;
  name: string;
  thresholdAt: number | null;
  /** Fixed mode: the probe's class. */
  cls: string | null;
  mode: BatchMode;
  error: string | null;
}

export interface BatchLive {
  phase: 'running' | 'finished' | 'failed' | 'stopped';
  completed: number;
  total: number;
  failed: number;
  rows: BatchRow[];
  error: string | null;
}

export function initialBatch(total: number): BatchLive {
  return { phase: 'running', completed: 0, total, failed: 0, rows: [], error: null };
}

/**
 * Folds one event of POST /api/sequence-batches/{id}/start into the live
 * state. `names` maps sequence ids to probe names for error rows.
 */
export function applyBatchEvent(
  live: BatchLive,
  name: string,
  data: unknown,
  mode: BatchMode,
  nameOf: (sequenceId: number | null) => string,
): BatchLive {
  if (!isRecord(data)) return live;
  const completed = num(data.completed) ?? live.completed;
  const total = num(data.total) ?? live.total;
  const sequenceId = num(data.sequence_id);
  if (name === 'progress') {
    const row: BatchRow = {
      sequenceId,
      name: str(data.probe_name) ?? nameOf(sequenceId),
      thresholdAt: num(data.threshold_at),
      cls: str(data.probe_classification),
      mode,
      error: null,
    };
    return { ...live, completed, total, rows: [...live.rows, row] };
  }
  if (name === 'error') {
    const msg = str(data.error) ?? str(data.message) ?? '';
    // An error with no sequence is the whole stream failing.
    if (sequenceId === null) return { ...live, phase: 'failed', error: msg };
    const row: BatchRow = {
      sequenceId,
      name: nameOf(sequenceId),
      thresholdAt: null,
      cls: null,
      mode,
      error: msg,
    };
    return { ...live, completed, total, failed: live.failed + 1, rows: [...live.rows, row] };
  }
  if (name === 'complete') return { ...live, phase: 'finished', completed, total };
  return live;
}

// ── Whittling (R11: a working line with expected duration) ─────

/** Seconds one turn pair takes: coach, model and classifier calls. */
export const SECONDS_PER_PAIR = 9;

/**
 * Whittling runs at N, N-1, ... 0 warmup turns until the probe is Refused.
 * The worst case is every pass: N + 1 passes and (N + 1)(N + 2) / 2 turn
 * pairs. Returns the passes and an upper bound in whole minutes (at least 1).
 */
export function whittleExpectation(maxWarmup: number): { passes: number; minutes: number } {
  const n = Math.max(0, Math.round(maxWarmup));
  const pairs = ((n + 1) * (n + 2)) / 2;
  return { passes: n + 1, minutes: Math.max(1, Math.ceil((pairs * SECONDS_PER_PAIR) / 60)) };
}

/** "0:07", "2:05", "1:02:03". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// ── Export ─────────────────────────────────────────────────────

export const EXPORT_FORMATS = ['json', 'csv', 'html', 'pdf'] as const;
export type SequenceExportFormat = (typeof EXPORT_FORMATS)[number];

/** The file name used when the sidecar's header names none. */
export function sequenceFileName(id: number, format: SequenceExportFormat): string {
  return `flinch-sequence-${id}.${format}`;
}

/** The query for GET /api/sequences/{id}/export; only HTML and PDF are themed. */
export function exportQuery(format: SequenceExportFormat, theme: string): Record<string, string> {
  return format === 'html' || format === 'pdf' ? { format, theme } : { format };
}

/** The custom probe's name (brief 8.4: "custom-{Date.now()}"). */
export const customProbeName = (now: number) => `custom-${now}`;
