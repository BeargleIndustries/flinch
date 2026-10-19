import { describe, expect, it } from 'vitest';
import {
  MIN_BAR,
  defaultPick,
  excludedCounts,
  excludedSequences,
  isFound,
  orderedRuns,
  parseEffectiveness,
  parseThresholds,
  resultChoices,
  strategyChoices,
  stripRuns,
  successShare,
  thresholdBars,
  thresholdCase,
  thresholdWidth,
  turnStrip,
  type EffectivenessRow,
  type ThresholdRow,
  type WhittlingRow,
} from './sequence-results';
import type { Sequence, SequenceRun } from './sequences';

const seq = (id: number, status: string, strategy_id = 1): Sequence => ({
  id,
  session_id: 1,
  probe_id: 10 + id,
  strategy_id,
  batch_id: null,
  mode: 'interactive',
  max_warmup_turns: 3,
  use_narrative_engine: 0,
  status,
  created_at: null,
  completed_at: null,
});

const wr = (
  warmup_count: number,
  probe_classification: string | null,
  threshold_found: number | boolean | null = 0,
  status = 'completed',
): WhittlingRow => ({ warmup_count, probe_classification, threshold_found, status });

const tr = (
  sequence_id: number,
  strategy_id: number,
  threshold_turns: number | null,
  strategy_name = `s${strategy_id}`,
): ThresholdRow => ({
  sequence_id,
  probe_id: sequence_id,
  probe_name: `p${sequence_id}`,
  domain: 'd',
  strategy_name,
  strategy_id,
  threshold_turns,
  probe_classification: null,
});

const er = (
  id: number,
  sequence_count: number,
  success_count: number,
  avg_threshold: number | null,
): EffectivenessRow => ({
  id,
  name: `s${id}`,
  category: null,
  sequence_count,
  success_count,
  avg_threshold,
});

describe('the picker', () => {
  const list = [seq(5, 'running'), seq(4, 'completed'), seq(3, 'failed'), seq(2, 'pending')];

  it('offers completed and failed sequences in list order', () => {
    expect(resultChoices(list).map((s) => s.id)).toEqual([4, 3]);
  });

  it('keeps the wanted sequence when it is a choice, else the newest', () => {
    const choices = resultChoices(list);
    expect(defaultPick(choices, 3)).toBe(3);
    expect(defaultPick(choices, 5)).toBe(4);
    expect(defaultPick(choices, null)).toBe(4);
    expect(defaultPick([], 3)).toBeNull();
  });
});

describe('thresholdCase', () => {
  it('reads empty with no runs', () => {
    expect(thresholdCase([], 3)).toEqual({ kind: 'empty' });
  });

  it('puts a failed run first', () => {
    expect(thresholdCase([wr(3, 'complied', 1), wr(2, null, 0, 'failed')], 3)).toEqual({
      kind: 'failed',
    });
  });

  it('reads the threshold run, N > 0', () => {
    const runs = [wr(3, 'complied'), wr(2, 'complied', 1), wr(1, 'refused')];
    expect(thresholdCase(runs, 3)).toEqual({ kind: 'found', n: 2 });
  });

  it('reads zero when even no warmup got through', () => {
    const runs = [wr(1, 'complied'), wr(0, 'complied', true)];
    expect(thresholdCase(runs, 1)).toEqual({ kind: 'zero' });
  });

  it('reads one run that was not whittled', () => {
    expect(thresholdCase([wr(2, 'complied')], 2)).toEqual({ kind: 'single', warmup: 2 });
    expect(thresholdCase([wr(2, 'refused')], 2)).toEqual({ kind: 'single', warmup: 2 });
  });

  it('reads no threshold when the whittle was Refused on its first pass', () => {
    expect(thresholdCase([wr(4, 'refused')], 4, true)).toEqual({ kind: 'none', max: 4 });
  });

  it('reads no threshold when the highest of several runs was Refused', () => {
    expect(thresholdCase([wr(3, 'refused'), wr(3, 'complied')], 3)).toEqual({
      kind: 'none',
      max: 3,
    });
  });

  it('reads several unwhittled runs otherwise', () => {
    expect(thresholdCase([wr(3, 'complied'), wr(3, 'negotiated')], 3)).toEqual({
      kind: 'unwhittled',
      runs: 2,
    });
  });
});

describe('thresholdBars', () => {
  it('orders runs by warmup, scales heights and marks the threshold', () => {
    const bars = thresholdBars([wr(4, 'complied'), wr(2, 'complied', 1), wr(0, 'refused')], 4);
    expect(bars.map((b) => b.warmup)).toEqual([0, 2, 4]);
    expect(bars.map((b) => b.height)).toEqual([MIN_BAR, 50, 100]);
    expect(bars.map((b) => b.found)).toEqual([false, true, false]);
    expect(bars.map((b) => b.cls)).toEqual(['refused', 'complied', 'complied']);
  });

  it('flags failed runs and reads unknown classes', () => {
    const [bar] = thresholdBars([wr(1, 'error', 0, 'failed')], 1);
    expect(bar).toMatchObject({ failed: true, cls: 'unknown', height: 100 });
  });
});

describe('turnStrip', () => {
  it('keeps model replies only, in turn order, with W, S and P', () => {
    const cells = turnStrip([
      { turn_number: 4, role: 'target', classification: 'refused', turn_type: 'warmup' },
      { turn_number: 1, role: 'coach', classification: null, turn_type: 'warmup' },
      { turn_number: 2, role: 'target', classification: 'complied', turn_type: 'warmup' },
      { turn_number: 6, role: 'target', classification: null, turn_type: 'setup' },
      { turn_number: 7, role: 'probe', classification: null, turn_type: 'probe' },
      { turn_number: 8, role: 'target', classification: 'Complied', turn_type: 'probe' },
    ]);
    expect(cells.map((c) => c.letter).join('')).toBe('WWSP');
    expect(cells.map((c) => c.cls)).toEqual(['complied', 'refused', 'unknown', 'complied']);
    expect(cells.map((c) => c.warmup)).toEqual([1, 2, null, null]);
  });

  it('reads an unknown turn type as a warmup', () => {
    expect(
      turnStrip([{ turn_number: 1, role: 'target', classification: null, turn_type: 'x' }])[0],
    ).toMatchObject({ type: 'warmup', letter: 'W' });
  });

  it('orders runs by id and tolerates missing turns', () => {
    const runs = stripRuns([
      { sequence_run_id: 9, warmup_count: 1, probe_classification: null, turns: [] },
      { sequence_run_id: 3, warmup_count: 2, probe_classification: null },
      null,
    ]);
    expect(runs.map((r) => r.sequence_run_id)).toEqual([3, 9]);
    expect(runs[0].turns).toEqual([]);
    expect(stripRuns('nope')).toEqual([]);
  });

  it('orders the Runs list by id', () => {
    const runs = [{ id: 7 }, { id: 2 }] as SequenceRun[];
    expect(orderedRuns(runs).map((r) => r.id)).toEqual([2, 7]);
  });
});

describe('thresholds across probes', () => {
  const rows = [tr(1, 2, 3, 'zeta'), tr(2, 1, null, 'alpha'), tr(3, 2, 1, 'zeta')];

  it('lists each strategy once, by name', () => {
    expect(strategyChoices(rows)).toEqual([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'zeta' },
    ]);
  });

  it('scales bars to the deepest threshold, none for null', () => {
    expect(thresholdWidth(3, rows)).toBe(100);
    expect(thresholdWidth(1, rows)).toBe(33);
    expect(thresholdWidth(0, rows)).toBe(MIN_BAR);
    expect(thresholdWidth(null, rows)).toBe(0);
  });

  it('parses only rows with a sequence id', () => {
    expect(parseThresholds([tr(1, 1, 1), { foo: 1 }, null])).toHaveLength(1);
    expect(parseThresholds({})).toEqual([]);
  });
});

describe('completed sequences only (I20)', () => {
  const list = [
    seq(1, 'completed'),
    seq(2, 'running'),
    seq(3, 'failed'),
    seq(4, 'running'),
    seq(5, 'pending'),
  ];

  it('leaves out every status but completed', () => {
    expect(excludedSequences(list).map((s) => s.id)).toEqual([2, 3, 4, 5]);
  });

  it('counts left-out sequences by status in a fixed order', () => {
    expect(excludedCounts(excludedSequences(list))).toEqual([
      { status: 'running', count: 2 },
      { status: 'pending', count: 1 },
      { status: 'failed', count: 1 },
    ]);
  });

  it('reads a share and parses the reply', () => {
    expect(successShare({ sequence_count: 3, success_count: 1 })).toBe(33);
    expect(successShare({ sequence_count: 0, success_count: 0 })).toBe(0);
    const parsed = parseEffectiveness([
      {
        id: 1,
        name: 'a',
        category: null,
        sequence_count: '2',
        success_count: 1,
        avg_threshold: 'x',
      },
      { name: 'no id' },
    ]);
    expect(parsed).toEqual([er(1, 2, 1, null)].map((r) => ({ ...r, name: 'a' })));
  });

  it('reads 1 and true as found', () => {
    expect(isFound(1)).toBe(true);
    expect(isFound(true)).toBe(true);
    expect(isFound(0)).toBe(false);
    expect(isFound(null)).toBe(false);
  });
});
