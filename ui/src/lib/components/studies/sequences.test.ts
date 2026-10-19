import { describe, expect, it } from 'vitest';
import {
  EMPTY_STRATEGY,
  activeRun,
  applyAutoEvent,
  applyBatchEvent,
  autoLineParts,
  batchBody,
  batchKey,
  buildThread,
  canRunAll,
  canStep,
  clampDepth,
  clampWarmup,
  clock,
  customProbeName,
  duplicateStrategyName,
  exportQuery,
  formatCost,
  hasResults,
  initialAuto,
  initialBatch,
  isBuiltin,
  latestRun,
  mergeTurns,
  missingStrategyFields,
  pickStrategy,
  probeClass,
  sequenceFileName,
  sortSequences,
  strategyBody,
  strategyForm,
  strategyOption,
  strategyTitle,
  usesEngine,
  warmupsSent,
  whittleExpectation,
  type BatchForm,
  type Sequence,
  type SequenceRun,
  type SequenceTurn,
  type Strategy,
} from './sequences';

const strategy = (over: Partial<Strategy> = {}): Strategy => ({
  id: 1,
  name: 'fiction_workshop',
  description: 'Scene-setting',
  goal: 'g',
  opening_pattern: 'o',
  escalation_pattern: 'e',
  setup_hint: 's',
  category: 'fiction',
  is_builtin: 1,
  ...over,
});

const seq = (over: Partial<Sequence> = {}): Sequence => ({
  id: 1,
  session_id: 1,
  probe_id: 1,
  strategy_id: 1,
  batch_id: null,
  mode: 'automatic',
  max_warmup_turns: 10,
  use_narrative_engine: 0,
  status: 'pending',
  created_at: '2026-10-19 10:00:00',
  completed_at: null,
  ...over,
});

const run = (over: Partial<SequenceRun> = {}): SequenceRun => ({
  id: 1,
  sequence_id: 1,
  warmup_count: 2,
  status: 'completed',
  probe_classification: null,
  threshold_found: 0,
  ...over,
});

const turn = (n: number, role: string, type: string, cls: string | null = null): SequenceTurn => ({
  turn_number: n,
  role,
  content: `${role} ${n}`,
  classification: cls,
  turn_type: type,
});

describe('limits', () => {
  it('clamps warmup turns to 1..20, default 10', () => {
    expect(clampWarmup(0)).toBe(1);
    expect(clampWarmup(25)).toBe(20);
    expect(clampWarmup('7')).toBe(7);
    expect(clampWarmup('')).toBe(10);
    expect(clampWarmup(Number.NaN)).toBe(10);
  });

  it('keeps depth 0 and clamps to 0..20', () => {
    expect(clampDepth(0)).toBe(0);
    expect(clampDepth('0')).toBe(0);
    expect(clampDepth(-3)).toBe(0);
    expect(clampDepth(40)).toBe(20);
    expect(clampDepth('x')).toBe(3);
  });
});

describe('strategies', () => {
  it('shows underscores as spaces and the category in brackets', () => {
    expect(strategyTitle('fiction_workshop')).toBe('fiction workshop');
    expect(strategyOption(strategy())).toBe('fiction workshop (fiction)');
    expect(strategyOption(strategy({ category: '' }))).toBe('fiction workshop');
    expect(strategyOption(strategy({ category: null }))).toBe('fiction workshop');
  });

  it('reads is_builtin as 1 or true', () => {
    expect(isBuiltin(strategy({ is_builtin: 1 }))).toBe(true);
    expect(isBuiltin(strategy({ is_builtin: true }))).toBe(true);
    expect(isBuiltin(strategy({ is_builtin: 0 }))).toBe(false);
    expect(isBuiltin(strategy({ is_builtin: null }))).toBe(false);
  });

  it('keeps the picked strategy while listed, else the first', () => {
    const list = [strategy({ id: 4 }), strategy({ id: 7 })];
    expect(pickStrategy(list, 7)).toBe(7);
    expect(pickStrategy(list, 99)).toBe(4);
    expect(pickStrategy(list, null)).toBe(4);
    expect(pickStrategy([], 3)).toBeNull();
  });

  it('lists the required fields left blank', () => {
    expect(missingStrategyFields({ ...EMPTY_STRATEGY })).toEqual([
      'name',
      'goal',
      'opening_pattern',
      'escalation_pattern',
      'setup_hint',
    ]);
    const full = strategyForm(strategy());
    expect(missingStrategyFields(full)).toEqual([]);
    expect(missingStrategyFields({ ...full, goal: '   ' })).toEqual(['goal']);
  });

  it('finds duplicate names except the one being edited', () => {
    const list = [strategy({ id: 1, name: 'noir' }), strategy({ id: 2, name: 'Heist' })];
    expect(duplicateStrategyName(' NOIR ', list)).toBe(true);
    expect(duplicateStrategyName('noir', list, 1)).toBe(false);
    expect(duplicateStrategyName('heist', list, 1)).toBe(true);
    expect(duplicateStrategyName('', list)).toBe(false);
  });

  it('builds a form from a strategy and a trimmed body', () => {
    expect(strategyForm(null)).toEqual(EMPTY_STRATEGY);
    const f = strategyForm(strategy({ description: null, category: null }));
    expect(f.description).toBe('');
    expect(f.category).toBe('');
    expect(strategyBody({ ...f, name: '  noir  ' }).name).toBe('noir');
  });
});

describe('the sequence list', () => {
  it('sorts newest first, then by id', () => {
    const rows = [
      seq({ id: 1, created_at: '2026-10-19 10:00:00' }),
      seq({ id: 3, created_at: '2026-10-19 10:00:00' }),
      seq({ id: 2, created_at: '2026-10-19 11:00:00' }),
    ];
    expect(sortSequences(rows).map((s) => s.id)).toEqual([2, 3, 1]);
    expect(sortSequences(null)).toEqual([]);
    expect(sortSequences([{ nope: 1 }])).toEqual([]);
  });

  it('gives interactive sequences turns while pending or running', () => {
    expect(canStep(seq({ mode: 'interactive', status: 'pending' }))).toBe(true);
    expect(canStep(seq({ mode: 'interactive', status: 'running' }))).toBe(true);
    expect(canStep(seq({ mode: 'interactive', status: 'completed' }))).toBe(false);
    expect(canStep(seq({ mode: 'automatic', status: 'pending' }))).toBe(false);
  });

  it('runs every other mode unless running', () => {
    expect(canRunAll(seq({ mode: 'automatic', status: 'failed' }))).toBe(true);
    expect(canRunAll(seq({ mode: 'fixed_n', status: 'pending' }))).toBe(true);
    expect(canRunAll(seq({ mode: 'whittle', status: 'running' }))).toBe(false);
    expect(canRunAll(seq({ mode: 'interactive', status: 'pending' }))).toBe(false);
  });

  it('has results when completed or failed', () => {
    expect(hasResults(seq({ status: 'completed' }))).toBe(true);
    expect(hasResults(seq({ status: 'failed' }))).toBe(true);
    expect(hasResults(seq({ status: 'abandoned' }))).toBe(false);
  });

  it('reads the IF engine flag', () => {
    expect(usesEngine(seq({ use_narrative_engine: 1 }))).toBe(true);
    expect(usesEngine(seq({ use_narrative_engine: false }))).toBe(false);
  });

  it('finds the active and the latest run', () => {
    const runs = [
      run({ id: 3, status: 'completed' }),
      run({ id: 5, status: 'pending' }),
      run({ id: 4, status: 'running' }),
      run({ id: 6, status: 'failed' }),
    ];
    expect(activeRun(runs)?.id).toBe(5);
    expect(latestRun(runs)?.id).toBe(6);
    expect(activeRun([run({ status: 'completed' })])).toBeNull();
    expect(latestRun([])).toBeNull();
  });
});

describe('the thread', () => {
  const turns = [
    turn(1, 'coach', 'warmup'),
    turn(2, 'target', 'warmup', 'complied'),
    turn(3, 'coach', 'warmup'),
    turn(4, 'target', 'warmup', 'complied'),
    turn(5, 'coach', 'setup'),
    turn(6, 'target', 'setup', 'complied'),
    turn(7, 'probe', 'probe'),
    turn(8, 'target', 'probe', 'refused'),
  ];

  it('numbers warmups and keeps classes on model turns only', () => {
    const t = buildThread([...turns].reverse());
    expect(t.map((x) => x.key)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(t.map((x) => x.warmup)).toEqual([1, 1, 2, 2, null, null, null, null]);
    expect(t[0].cls).toBeNull();
    expect(t[7]).toMatchObject({ role: 'target', turnType: 'probe', cls: 'refused' });
    expect(t[6]).toMatchObject({ role: 'probe', turnType: 'probe', cls: null });
  });

  it('falls back on unknown roles and types', () => {
    const [t] = buildThread([{ turn_number: 1, role: 'x', content: '', turn_type: 'y' }]);
    expect(t).toMatchObject({ role: 'target', turnType: 'warmup' });
  });

  it('merges by turn number, new wins', () => {
    const merged = mergeTurns(turns.slice(0, 2), [
      { ...turns[1], content: 'new' },
      turns[2],
      turns[3],
    ]);
    expect(merged.map((t) => t.turn_number)).toEqual([1, 2, 3, 4]);
    expect(merged[1].content).toBe('new');
  });

  it('counts warmups sent and reads the probe class', () => {
    expect(warmupsSent(turns)).toBe(2);
    expect(warmupsSent([])).toBe(0);
    expect(probeClass(turns)).toBe('refused');
    expect(probeClass(turns.slice(0, 4))).toBeNull();
  });
});

describe('the automatic stream', () => {
  it('starts with N + 1 steps', () => {
    expect(initialAuto(3)).toMatchObject({ phase: 'running', step: 0, total: 4 });
    expect(initialAuto(0).total).toBe(1);
  });

  it('folds turn, complete and error events', () => {
    let live = initialAuto(2);
    live = applyAutoEvent(live, 'turn', {
      step: 1,
      total_steps: 3,
      turn_type: 'warmup',
      classification: 'complied',
      sequence_run_id: 9,
    });
    expect(live).toMatchObject({ step: 1, total: 3, turnType: 'warmup', runId: 9 });
    expect(autoLineParts(live)).toEqual({ type: 'Warmup', cls: 'Complied' });
    live = applyAutoEvent(live, 'complete', {
      step: 3,
      total_steps: 3,
      probe_classification: 'refused',
      sequence_run_id: 9,
    });
    expect(live).toMatchObject({ phase: 'finished', step: 3, probeCls: 'refused' });
    const failed = applyAutoEvent(initialAuto(1), 'error', { error: 'boom', sequence_run_id: 2 });
    expect(failed).toMatchObject({ phase: 'failed', error: 'boom', runId: 2 });
  });

  it('ignores events without a record', () => {
    const live = initialAuto(1);
    expect(applyAutoEvent(live, 'turn', 'nope')).toBe(live);
    expect(applyAutoEvent(live, 'heartbeat', {})).toBe(live);
    expect(autoLineParts(live)).toBeNull();
  });
});

describe('batches', () => {
  const form = (over: Partial<BatchForm> = {}): BatchForm => ({
    strategyId: 2,
    probeIds: [5, 3],
    mode: 'fixed_n',
    maxWarmup: 10,
    depth: 1,
    ...over,
  });

  it('sends fixed_n only in fixed mode, keeping 0', () => {
    expect(batchBody(form())).toEqual({
      strategy_id: 2,
      probe_ids: [3, 5],
      mode: 'fixed_n',
      fixed_n: 1,
      max_warmup_turns: 10,
    });
    expect(batchBody(form({ depth: 0 }))?.fixed_n).toBe(0);
    expect(batchBody(form({ mode: 'whittle' }))?.fixed_n).toBeNull();
    expect(batchBody(form({ probeIds: [] }))).toBeNull();
    expect(batchBody(form({ strategyId: null }))).toBeNull();
  });

  it('changes its key with any field the estimate uses', () => {
    const k = batchKey(form());
    expect(batchKey(form({ probeIds: [3, 5] }))).toBe(k);
    expect(batchKey(form({ depth: 2 }))).not.toBe(k);
    expect(batchKey(form({ maxWarmup: 9 }))).not.toBe(k);
    expect(batchKey(form({ mode: 'whittle' }))).not.toBe(k);
    expect(batchKey(form({ probeIds: [] }))).toBe('');
    // Whittle mode ignores the depth.
    expect(batchKey(form({ mode: 'whittle', depth: 1 }))).toBe(
      batchKey(form({ mode: 'whittle', depth: 7 })),
    );
  });

  it('formats the cost', () => {
    expect(formatCost(0.0555, 'under')).toBe('$0.06');
    expect(formatCost(12.5, 'under')).toBe('$12.50');
    expect(formatCost(0.001, 'under')).toBe('under');
    expect(formatCost(0, 'under')).toBe('$0.00');
    expect(formatCost('x', 'under')).toBeNull();
    expect(formatCost(-1, 'under')).toBeNull();
  });

  it('folds progress, error and complete events', () => {
    const nameOf = (id: number | null) => `seq-${id}`;
    let live = initialBatch(3);
    live = applyBatchEvent(
      live,
      'progress',
      { sequence_id: 1, probe_name: 'refuse-me', threshold_at: 4, completed: 1, total: 3 },
      'whittle',
      nameOf,
    );
    live = applyBatchEvent(
      live,
      'progress',
      { sequence_id: 2, probe_name: 'answer-me', threshold_at: null, completed: 2, total: 3 },
      'whittle',
      nameOf,
    );
    live = applyBatchEvent(
      live,
      'error',
      { sequence_id: 3, error: 'boom', completed: 3, total: 3 },
      'whittle',
      nameOf,
    );
    expect(live.rows.map((r) => [r.name, r.thresholdAt, r.error])).toEqual([
      ['refuse-me', 4, null],
      ['answer-me', null, null],
      ['seq-3', null, 'boom'],
    ]);
    expect(live).toMatchObject({ completed: 3, failed: 1, phase: 'running' });
    live = applyBatchEvent(live, 'complete', { completed: 3, total: 3 }, 'whittle', nameOf);
    expect(live.phase).toBe('finished');
  });

  it('reads a fixed-mode class and a stream-wide error', () => {
    const nameOf = () => 'x';
    const live = applyBatchEvent(
      initialBatch(1),
      'progress',
      { sequence_id: 1, probe_name: 'p', probe_classification: 'complied', completed: 1, total: 1 },
      'fixed_n',
      nameOf,
    );
    expect(live.rows[0]).toMatchObject({ cls: 'complied', mode: 'fixed_n' });
    const failed = applyBatchEvent(initialBatch(1), 'error', { error: 'down' }, 'fixed_n', nameOf);
    expect(failed).toMatchObject({ phase: 'failed', error: 'down', rows: [] });
  });
});

describe('whittling', () => {
  it('expects N + 1 passes and an upper bound in minutes', () => {
    expect(whittleExpectation(10)).toEqual({ passes: 11, minutes: 10 });
    expect(whittleExpectation(2)).toEqual({ passes: 3, minutes: 1 });
    expect(whittleExpectation(0)).toEqual({ passes: 1, minutes: 1 });
    expect(whittleExpectation(20).minutes).toBe(35);
  });

  it('formats the running clock', () => {
    expect(clock(7_400)).toBe('0:07');
    expect(clock(125_000)).toBe('2:05');
    expect(clock(3_723_000)).toBe('1:02:03');
    expect(clock(-5)).toBe('0:00');
  });
});

describe('export and names', () => {
  it('themes HTML and PDF only', () => {
    expect(exportQuery('json', 't')).toEqual({ format: 'json' });
    expect(exportQuery('csv', 't')).toEqual({ format: 'csv' });
    expect(exportQuery('html', 't')).toEqual({ format: 'html', theme: 't' });
    expect(exportQuery('pdf', 't')).toEqual({ format: 'pdf', theme: 't' });
  });

  it('names files and custom probes', () => {
    expect(sequenceFileName(4, 'csv')).toBe('flinch-sequence-4.csv');
    expect(customProbeName(1700000000000)).toBe('custom-1700000000000');
  });
});
