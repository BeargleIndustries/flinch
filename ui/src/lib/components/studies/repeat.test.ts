import { describe, expect, it } from 'vitest';
import {
  applyEvent,
  clampRepeats,
  countsOf,
  distribution,
  distributionCounts,
  excerpt,
  initialLive,
  latencyLabel,
  liveStatRunIds,
  localDay,
  medianLatency,
  pctLabel,
  rateLabel,
  roundShares,
  runDate,
  runStatus,
  settle,
  sortSummaries,
  summaryCounts,
  type LiveRun,
  type StatSummary,
} from './repeat';

describe('roundShares', () => {
  it('gives whole numbers that add up to 100', () => {
    expect(roundShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundShares([2, 1])).toEqual([67, 33]);
    expect(roundShares([3])).toEqual([100]);
    expect(roundShares([1, 0, 0, 2])).toEqual([33, 0, 0, 67]);
    for (const counts of [
      [7, 3, 1],
      [1, 1, 1, 1, 1, 1, 1],
      [99, 1, 0],
      [5, 5, 5, 5, 5, 5],
    ])
      expect(roundShares(counts).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('keeps zeros at 0 and an empty total all zeros', () => {
    expect(roundShares([0, 0, 0])).toEqual([0, 0, 0]);
    expect(roundShares([])).toEqual([]);
    expect(roundShares([0, 3, 0])).toEqual([0, 100, 0]);
  });

  it('treats negatives and non-finite counts as 0', () => {
    expect(roundShares([-1, 2, Number.NaN, Infinity])).toEqual([0, 100, 0, 0]);
  });

  it('breaks remainder ties toward the earlier entry', () => {
    expect(roundShares([1, 1])).toEqual([50, 50]);
    expect(roundShares([1, 1, 1, 0])).toEqual([34, 33, 33, 0]);
  });
});

describe('distributionCounts', () => {
  it('reads the {classification: count} map into badge counts', () => {
    expect(distributionCounts({ refused: 3 })).toEqual({ refused: 3 });
    expect(distributionCounts({ refused: 2, complied: 1 })).toEqual({ refused: 2, complied: 1 });
  });

  it('adds unknown, null-classified and unexpected keys under unknown', () => {
    expect(distributionCounts({ unknown: 1, weird: 2, Refused: 1 })).toEqual({
      unknown: 3,
      refused: 1,
    });
  });

  it('ignores zero, negative, non-numeric counts and non-objects', () => {
    expect(distributionCounts({ refused: 0, complied: -2, collapsed: 'x' })).toEqual({});
    expect(distributionCounts(null)).toEqual({});
    expect(distributionCounts([1, 2])).toEqual({});
  });
});

describe('countsOf and summaryCounts', () => {
  it('counts classes, null as unknown', () => {
    expect(countsOf(['refused', 'refused', null, 'complied'])).toEqual({
      refused: 2,
      unknown: 1,
      complied: 1,
    });
  });

  it('reads a summary, with runs outside the four badges as unknown', () => {
    const s = summary({ total: 5, refused: 2, complied: 1 });
    expect(summaryCounts(s)).toEqual({
      refused: 2,
      collapsed: 0,
      negotiated: 0,
      complied: 1,
      unknown: 2,
    });
    expect(summaryCounts(summary({ total: 3, refused: 3 }))).not.toHaveProperty('unknown');
  });
});

describe('distribution', () => {
  it('lists the four badges with counts and shares; unanimous when one badge has every run', () => {
    const d = distribution({ refused: 3 });
    expect(d.total).toBe(3);
    expect(d.rows.map((r) => [r.cls, r.count, r.pct])).toEqual([
      ['refused', 3, 100],
      ['collapsed', 0, 0],
      ['negotiated', 0, 0],
      ['complied', 0, 0],
    ]);
    expect(d.unanimous).toBe('refused');
    expect(d.top?.cls).toBe('refused');
  });

  it('adds the unknown row only when it has runs, and shares still add to 100', () => {
    const d = distribution({ refused: 1, complied: 1, unknown: 1 });
    expect(d.rows.map((r) => r.cls)).toEqual([
      'refused',
      'collapsed',
      'negotiated',
      'complied',
      'unknown',
    ]);
    expect(d.rows.map((r) => r.pct)).toEqual([34, 0, 0, 33, 33]);
    expect(d.unanimous).toBeNull();
  });

  it('picks the largest badge as top, earlier in order on a tie', () => {
    expect(distribution({ complied: 2, refused: 1 }).top?.cls).toBe('complied');
    expect(distribution({ complied: 2, refused: 2 }).top?.cls).toBe('refused');
  });

  it('has no top, no unanimous badge and zero shares with no runs', () => {
    const d = distribution({});
    expect(d.total).toBe(0);
    expect(d.top).toBeNull();
    expect(d.unanimous).toBeNull();
    expect(d.rows.every((r) => r.pct === 0)).toBe(true);
  });

  it('labels shares and rates', () => {
    expect(pctLabel(100)).toBe('100%');
    expect(rateLabel(0.6667)).toBe('67%');
    expect(rateLabel(1)).toBe('100%');
    expect(rateLabel(null)).toBeNull();
    expect(rateLabel(Number.NaN)).toBeNull();
  });
});

describe('clampRepeats', () => {
  it('keeps a whole number from 1 to 100, defaulting to 10', () => {
    expect(clampRepeats(3)).toBe(3);
    expect(clampRepeats('7')).toBe(7);
    expect(clampRepeats(0)).toBe(1);
    expect(clampRepeats(250)).toBe(100);
    expect(clampRepeats(2.6)).toBe(3);
    expect(clampRepeats('')).toBe(10);
    expect(clampRepeats('abc')).toBe(10);
    expect(clampRepeats(undefined)).toBe(10);
  });
});

function summary(over: Partial<StatSummary> = {}): StatSummary {
  return {
    stat_run_id: 1,
    probe_id: 1,
    probe_name: 'p',
    probe_domain: '',
    model: 'claude-test',
    total: 0,
    refused: 0,
    collapsed: 0,
    negotiated: 0,
    complied: 0,
    consistency_rate: null,
    created_at: '2026-10-19 12:00:00',
    status: 'complete',
    ...over,
  };
}

describe('summaries', () => {
  it('sorts newest first by id and drops unreadable rows', () => {
    const rows = sortSummaries([
      { stat_run_id: 4, probe_name: 'a', status: 'complete', total: 3 },
      null,
      { probe_name: 'no id' },
      { stat_run_id: 9, probe_name: 'b', status: 'failed', consistency_rate: 0.5 },
    ]);
    expect(rows.map((r) => r.stat_run_id)).toEqual([9, 4]);
    expect(rows[0].consistency_rate).toBe(0.5);
    expect(rows[1].total).toBe(3);
    expect(rows[1].model).toBe('');
    expect(sortSummaries({})).toEqual([]);
  });

  it('says completed for the runner\'s "complete" and keeps other statuses', () => {
    expect(runStatus('complete')).toBe('completed');
    expect(runStatus('failed')).toBe('failed');
    expect(runStatus('Running')).toBe('running');
    expect(runStatus(null)).toBe('');
  });
});

describe('runDate', () => {
  it("reads SQLite's UTC datetime as the local date and time", () => {
    const d = new Date(Date.UTC(2026, 9, 19, 14, 3, 22));
    const got = runDate('2026-10-19 14:03:22');
    expect(got?.date).toBe(localDay(d));
    expect(got?.time).toBe(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    );
  });

  it('reads an ISO string too, and null for nothing or nonsense', () => {
    expect(runDate('2026-01-02T03:04:05Z')?.date).toBe(localDay(new Date('2026-01-02T03:04:05Z')));
    expect(runDate(null)).toBeNull();
    expect(runDate('not a date')).toBeNull();
  });
});

describe('latency and excerpts', () => {
  it('labels latency in ms under a second, seconds above', () => {
    expect(latencyLabel(812)).toBe('812 ms');
    expect(latencyLabel(0)).toBe('0 ms');
    expect(latencyLabel(1400)).toBe('1.4 s');
    expect(latencyLabel(12345)).toBe('12 s');
    expect(latencyLabel(null)).toBe('');
    expect(latencyLabel(-5)).toBe('');
  });

  it('takes the median of the latencies present', () => {
    expect(medianLatency([300, 100, 200])).toBe(200);
    expect(medianLatency([100, 200, null, 400, 300])).toBe(250);
    expect(medianLatency([null, undefined])).toBeNull();
  });

  it('folds whitespace and cuts at the limit with an ellipsis', () => {
    expect(excerpt('  a\n\nb  ')).toBe('a b');
    expect(excerpt('abcdef', 3)).toBe('abc…');
    expect(excerpt('abc', 3)).toBe('abc');
    expect(excerpt(null)).toBe('');
    expect(excerpt('x'.repeat(250))).toHaveLength(201);
  });
});

describe('the live run', () => {
  const plan = [
    { id: 11, name: 'refuse-me' },
    { id: 12, name: 'answer-me' },
  ];

  const feed = (run: LiveRun, events: [string, unknown][]) =>
    events.reduce((r, [name, data]) => applyEvent(r, name, data), run);

  it('starts with one waiting row per planned probe and the call total', () => {
    const run = initialLive(plan, 3);
    expect(run.total).toBe(6);
    expect(run.probes.map((p) => [p.name, p.state, p.cells.length])).toEqual([
      ['refuse-me', 'waiting', 0],
      ['answer-me', 'waiting', 0],
    ]);
  });

  it("fills each probe's tape as iterations land and finishes on batch_complete", () => {
    const run = feed(initialLive(plan, 2), [
      ['batch_start', { probe_count: 2, repeat_count: 2, target_model: 'claude-test' }],
      ['start', { stat_run_id: 7, probe_id: 11, probe_name: 'refuse-me', batch_probe_index: 1 }],
      ['iteration', { stat_run_id: 7, iteration: 1, classification: 'refused', latency_ms: 40 }],
      ['iteration', { stat_run_id: 7, iteration: 2, classification: 'refused', latency_ms: 60 }],
      ['complete', { stat_run_id: 7, summary: {}, batch_probe_index: 1 }],
      ['start', { stat_run_id: 8, probe_id: 12, probe_name: 'answer-me', batch_probe_index: 2 }],
      ['iteration', { stat_run_id: 8, iteration: 1, classification: 'complied', latency_ms: 30 }],
      ['iteration_error', { stat_run_id: 8, iteration: 2, error: 'Timeout' }],
      ['complete', { stat_run_id: 8, summary: {}, batch_probe_index: 2 }],
      ['batch_complete', { session_id: 1, probe_count: 2 }],
    ]);
    expect(run.model).toBe('claude-test');
    expect(run.completed).toBe(4);
    expect(run.failed).toBe(1);
    expect(run.total).toBe(4);
    expect(run.finished).toBe(true);
    expect(run.lastStatRunId).toBe(8);
    expect(liveStatRunIds(run)).toEqual([7, 8]);
    expect(run.probes[0].cells.map((c) => [c.cls, c.latencyMs])).toEqual([
      ['refused', 40],
      ['refused', 60],
    ]);
    expect(run.probes[1].cells.map((c) => [c.cls, c.error])).toEqual([
      ['complied', null],
      [null, 'Timeout'],
    ]);
    expect(run.probes.map((p) => p.state)).toEqual(['done', 'done']);
  });

  it('marks a missing probe failed and takes its calls off the total', () => {
    const run = feed(initialLive(plan, 3), [
      ['batch_start', { probe_count: 2, repeat_count: 3 }],
      ['error', { error: 'Probe 11 not found', batch_probe_index: 1, batch_probe_total: 2 }],
    ]);
    expect(run.probes[0].state).toBe('failed');
    expect(run.probes[0].error).toBe('Probe 11 not found');
    expect(run.total).toBe(3);
    expect(run.error).toBeNull();
  });

  it('stops every open row when the whole stream fails', () => {
    const run = feed(initialLive(plan, 2), [
      ['start', { stat_run_id: 7, probe_id: 11, batch_probe_index: 1 }],
      ['error', { error: 'RuntimeError: boom' }],
    ]);
    expect(run.error).toBe('RuntimeError: boom');
    expect(run.probes.map((p) => p.state)).toEqual(['stopped', 'stopped']);
    expect(run.finished).toBe(false);
  });

  it('adds a row for a probe the plan did not list', () => {
    const run = applyEvent(initialLive([], 2), 'start', {
      stat_run_id: 3,
      probe_id: 99,
      probe_name: 'late',
    });
    expect(run.probes.map((p) => [p.probeId, p.name, p.state, p.statRunId])).toEqual([
      [99, 'late', 'running', 3],
    ]);
  });

  it('replaces a repeated iteration instead of adding it twice, and ignores junk', () => {
    let run = applyEvent(initialLive(plan, 2), 'start', { stat_run_id: 7, probe_id: 11 });
    run = applyEvent(run, 'iteration', { stat_run_id: 7, iteration: 1, classification: 'refused' });
    run = applyEvent(run, 'iteration', {
      stat_run_id: 7,
      iteration: 1,
      classification: 'complied',
    });
    expect(run.probes[0].cells.map((c) => c.cls)).toEqual(['complied']);
    expect(applyEvent(run, 'iteration', 'nope')).toBe(run);
    expect(applyEvent(run, 'heartbeat', {})).toBe(run);
    expect(applyEvent(run, 'iteration', { stat_run_id: 404, iteration: 1 })).toBe(run);
  });

  it('settle stops waiting and running rows and leaves settled ones', () => {
    let run = applyEvent(initialLive(plan, 1), 'start', { stat_run_id: 7, probe_id: 11 });
    run = applyEvent(run, 'complete', { stat_run_id: 7 });
    const out = settle(run);
    expect(out.probes.map((p) => p.state)).toEqual(['done', 'stopped']);
    expect(settle(out)).toBe(out);
  });
});
