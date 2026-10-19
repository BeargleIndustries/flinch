import { describe, expect, it } from 'vitest';
import { landRow, planRows, settleRows, tally, type PlannedProbe } from './batch-rows';

const plan: PlannedProbe[] = [
  { id: 1, name: 'one', domain: 'a' },
  { id: 2, name: 'two', domain: 'b' },
  { id: 3, name: 'three', domain: null },
];

const states = (rows: { state: string }[]) => rows.map((r) => r.state);

describe('planRows', () => {
  it('plans every probe with the first in flight', () => {
    expect(states(planRows(plan, 3))).toEqual(['next', 'waiting', 'waiting']);
  });

  it('plans nothing when the rail list does not match the batch total', () => {
    expect(planRows(plan, 4)).toEqual([]);
    expect(planRows([], 0)).toEqual([]);
  });
});

describe('landRow', () => {
  it('fills the landed row and moves in flight to the next waiting row', () => {
    const rows = landRow(planRows(plan, 3), { probeId: 1, name: 'one', runId: 9, cls: 'refused' });
    expect(states(rows)).toEqual(['done', 'next', 'waiting']);
    expect(rows[0]).toMatchObject({ runId: 9, cls: 'refused', domain: 'a', error: null });
  });

  it('marks a failed probe and keeps going', () => {
    const rows = landRow(planRows(plan, 3), { probeId: 1, name: 'one', error: 'boom' });
    expect(states(rows)).toEqual(['failed', 'next', 'waiting']);
    expect(rows[0]).toMatchObject({ error: 'boom', cls: null });
  });

  it('leaves no row in flight after the last probe', () => {
    let rows = planRows(plan, 3);
    for (const p of plan) rows = landRow(rows, { probeId: p.id, name: p.name, cls: 'complied' });
    expect(states(rows)).toEqual(['done', 'done', 'done']);
  });

  it('appends a row when there is no plan, with the domain from the lookup', () => {
    const rows = landRow([], { probeId: 7, name: 'seven', cls: 'complied' }, () => 'x');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ probeId: 7, state: 'done', domain: 'x' });
  });
});

describe('settleRows', () => {
  it('cancels the probe in flight and marks the rest not run', () => {
    const rows = landRow(planRows(plan, 3), { probeId: 1, name: 'one', cls: 'refused' });
    expect(states(settleRows(rows))).toEqual(['done', 'cancelled', 'skipped']);
  });
});

describe('tally', () => {
  it('counts landed classifications in badge order', () => {
    let rows = planRows(plan, 3);
    rows = landRow(rows, { probeId: 1, name: 'one', cls: 'complied' });
    rows = landRow(rows, { probeId: 2, name: 'two', cls: 'Refused' });
    rows = landRow(rows, { probeId: 3, name: 'three', error: 'x' });
    expect(tally(rows)).toEqual([
      { cls: 'refused', count: 1 },
      { cls: 'complied', count: 1 },
    ]);
  });
});
