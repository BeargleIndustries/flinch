import { describe, expect, it } from 'vitest';
import {
  BASELINES_ROUTE,
  DESCRIPTION_MAX,
  NAME_MAX,
  baselineTally,
  countStatuses,
  diffRows,
  diffStatus,
  latestByProbe,
  nameProblem,
  outcome,
  parseTarget,
  saveBody,
  sortChanges,
  targetValue,
  toDetail,
  toDiff,
  toSummaries,
  type BaselineRow,
  type DiffChange,
} from './baselines';

const row = (
  probe_id: number,
  initial: string | null,
  final: string | null = null,
  run_id = probe_id * 10,
): BaselineRow => ({
  run_id,
  probe_id,
  probe_name: `probe-${probe_id}`,
  initial_classification: initial,
  final_classification: final,
});

const change = (
  probe_id: number,
  status: DiffChange['status'],
  name = `p${probe_id}`,
): DiffChange => ({
  probe_id,
  probe_name: name,
  old_classification: 'refused',
  new_classification: 'refused',
  status,
});

describe('route', () => {
  it('is the Studies tab path', () => {
    expect(BASELINES_ROUTE).toBe('/studies/baselines');
  });
});

describe('toSummaries', () => {
  it('reads the list rows, newest first, and drops malformed ones', () => {
    const out = toSummaries([
      { id: 2, session_id: 5, name: 'A', description: '', created_at: '2026-10-18 10:00:00' },
      { id: 7, session_id: 5, name: 'B', description: null, created_at: '2026-10-19 10:00:00' },
      { name: 'no id' },
      null,
    ]);
    expect(out.map((b) => b.id)).toEqual([7, 2]);
    expect(out[0]).toEqual({
      id: 7,
      session_id: 5,
      name: 'B',
      description: '',
      created_at: '2026-10-19 10:00:00',
    });
  });

  it('gives an empty list for anything but an array', () => {
    expect(toSummaries(null)).toEqual([]);
    expect(toSummaries({ id: 1 })).toEqual([]);
  });
});

describe('toDetail', () => {
  it('reads snapshot_data rows and drops ones without a probe id', () => {
    const d = toDetail({
      id: 3,
      session_id: 1,
      name: 'Before',
      description: 'Sonnet',
      created_at: 'x',
      snapshot_data: [
        {
          run_id: 9,
          probe_id: 4,
          probe_name: 'refuse-me',
          initial_classification: 'refused',
          final_classification: null,
          initial_response: 'No.',
        },
        { run_id: 10 },
      ],
    });
    expect(d?.rows).toEqual([
      {
        run_id: 9,
        probe_id: 4,
        probe_name: 'refuse-me',
        initial_classification: 'refused',
        final_classification: null,
      },
    ]);
    expect(d?.description).toBe('Sonnet');
  });

  it('names a probe without a name by its id; a missing snapshot_data is no rows', () => {
    expect(toDetail({ id: 1, snapshot_data: [{ probe_id: 8 }] })?.rows[0].probe_name).toBe(
      'probe:8',
    );
    expect(toDetail({ id: 1 })?.rows).toEqual([]);
    expect(toDetail('nope')).toBeNull();
  });
});

describe('outcome and latestByProbe', () => {
  it('reads the final badge, else the first, else empty', () => {
    expect(outcome(row(1, 'refused', 'collapsed'))).toBe('collapsed');
    expect(outcome(row(1, 'refused'))).toBe('refused');
    expect(outcome(row(1, null))).toBe('');
  });

  it('keeps the last run per probe, like the sidecar', () => {
    const latest = latestByProbe([
      row(1, 'refused', null, 1),
      row(2, 'complied'),
      row(1, 'complied', null, 3),
    ]);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.probe_id === 1)?.run_id).toBe(3);
  });
});

describe('baselineTally', () => {
  it('counts probes and the badge each probe ends on', () => {
    const t = baselineTally([
      row(1, 'refused'),
      row(2, 'refused', 'collapsed'),
      row(3, 'complied'),
      row(3, 'refused', null, 99),
      row(4, null),
    ]);
    expect(t.probes).toBe(4);
    expect(t.counts).toEqual({ refused: 2, collapsed: 1, unknown: 1 });
  });

  it('is zero for an empty baseline', () => {
    expect(baselineTally([])).toEqual({ probes: 0, counts: {} });
  });
});

describe('diffStatus (the sidecar ranking)', () => {
  it('ranks refused > negotiated > collapsed > complied', () => {
    expect(diffStatus('refused', 'refused')).toBe('unchanged');
    expect(diffStatus('complied', 'refused')).toBe('improved');
    expect(diffStatus('collapsed', 'negotiated')).toBe('improved');
    expect(diffStatus('refused', 'collapsed')).toBe('regressed');
    expect(diffStatus('negotiated', 'complied')).toBe('regressed');
  });

  it('treats a missing side as below every badge', () => {
    expect(diffStatus('', 'complied')).toBe('improved');
    expect(diffStatus('refused', '')).toBe('regressed');
    expect(diffStatus('', '')).toBe('unchanged');
  });

  it('calls two unranked values that differ "changed"', () => {
    expect(diffStatus('unknown', 'error')).toBe('changed');
  });
});

describe('diffRows (baseline against baseline)', () => {
  it('compares each probe latest outcome and counts changed and unchanged', () => {
    const before = [row(1, 'refused'), row(2, 'complied'), row(3, 'negotiated')];
    const after = [row(1, 'refused', 'collapsed'), row(2, 'complied'), row(4, 'refused')];
    const d = diffRows(before, after);
    expect(d.changed_count).toBe(3);
    expect(d.unchanged_count).toBe(1);
    expect(
      d.changes.map((c) => [c.probe_id, c.old_classification, c.new_classification, c.status]),
    ).toEqual([
      [1, 'refused', 'collapsed', 'regressed'],
      [2, 'complied', 'complied', 'unchanged'],
      [3, 'negotiated', '', 'regressed'],
      [4, '', 'refused', 'improved'],
    ]);
  });

  it('names a probe from whichever side has it', () => {
    const d = diffRows([], [row(9, 'refused')]);
    expect(d.changes[0].probe_name).toBe('probe-9');
  });
});

describe('toDiff', () => {
  it('reads the sidecar reply and keeps its counts', () => {
    const d = toDiff({
      snapshot_id: 1,
      changes: [
        {
          probe_id: 1,
          probe_name: 'refuse-me',
          old_classification: 'refused',
          new_classification: 'collapsed',
          status: 'regressed',
        },
        {
          probe_id: 2,
          probe_name: 'answer-me',
          old_classification: 'complied',
          new_classification: 'complied',
          status: 'unchanged',
        },
      ],
      changed_count: 1,
      unchanged_count: 1,
    });
    expect(d.changed_count).toBe(1);
    expect(d.unchanged_count).toBe(1);
    expect(d.changes[0].status).toBe('regressed');
  });

  it('reads an unknown status as changed and fills missing counts from the rows', () => {
    const d = toDiff({
      changes: [
        { probe_id: 1, old_classification: 'a', new_classification: 'b', status: 'weird' },
        { probe_id: 2, status: 'unchanged' },
        { status: 'improved' },
      ],
    });
    expect(d.changes.map((c) => c.status)).toEqual(['changed', 'unchanged']);
    expect(d.changes[0].probe_name).toBe('probe:1');
    expect(d.changed_count).toBe(1);
    expect(d.unchanged_count).toBe(1);
    expect(toDiff(null)).toEqual({ changes: [], changed_count: 0, unchanged_count: 0 });
  });
});

describe('countStatuses and sortChanges', () => {
  it('counts each status', () => {
    expect(
      countStatuses([
        change(1, 'improved'),
        change(2, 'regressed'),
        change(3, 'regressed'),
        change(4, 'unchanged'),
      ]),
    ).toEqual({ improved: 1, regressed: 2, changed: 0, unchanged: 1 });
  });

  it('sorts regressed, improved, changed, unchanged, then by probe name', () => {
    const sorted = sortChanges([
      change(1, 'unchanged', 'a'),
      change(2, 'changed', 'b'),
      change(3, 'improved', 'c'),
      change(4, 'regressed', 'z'),
      change(5, 'regressed', 'm'),
    ]);
    expect(sorted.map((c) => c.probe_id)).toEqual([5, 4, 3, 2, 1]);
  });
});

describe('the dialog', () => {
  it('needs a name of at most NAME_MAX characters', () => {
    expect(nameProblem('')).toBe('empty');
    expect(nameProblem('   ')).toBe('empty');
    expect(nameProblem('Before the update')).toBeNull();
    expect(nameProblem('x'.repeat(NAME_MAX))).toBeNull();
    expect(nameProblem('x'.repeat(NAME_MAX + 1))).toBe('long');
  });

  it('trims the body and caps the description', () => {
    expect(saveBody('  A  ', '  notes ')).toEqual({ name: 'A', description: 'notes' });
    expect(saveBody('A', 'y'.repeat(DESCRIPTION_MAX + 5)).description).toHaveLength(
      DESCRIPTION_MAX,
    );
  });
});

describe('compare target', () => {
  it('round-trips now and baseline ids through the select value', () => {
    expect(targetValue('now')).toBe('now');
    expect(targetValue(12)).toBe('12');
    expect(parseTarget('now')).toBe('now');
    expect(parseTarget('12')).toBe(12);
    expect(parseTarget('')).toBeNull();
    expect(parseTarget('1.5')).toBeNull();
    expect(parseTarget('-3')).toBeNull();
  });
});
