import { describe, expect, it } from 'vitest';
import type { Experiment } from '$lib/api/types';
import { COMPARE_SESSION_PREFIX } from '$lib/session';
import type { ComparisonSummary } from '../studies/compare';
import {
  CLEAR_ALL_CONFIRM,
  asTab,
  clearedCounts,
  comparisonHref,
  runHref,
  sequenceHref,
  sessionHref,
  studyHref,
  dateGroup,
  domainRows,
  feed,
  groupByDate,
  parseTime,
  pushbackSource,
  runOutcome,
  runPreview,
  sessionTally,
  showConversation,
  toClsCounts,
  toFindings,
  toSequences,
  toSessions,
  toStudies,
  totalOf,
  type BrowseSequence,
  type BrowseSession,
} from './browse';

const sessionRow = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `s${id}`,
  target_model: 'claude-test',
  coach_profile: 'standard',
  created_at: `2026-10-${String(10 + id).padStart(2, '0')} 12:00:00`,
  completed_at: null,
  notes: null,
  system_prompt: '',
  coach_backend: 'anthropic',
  coach_model: null,
  run_count: 3,
  refused_count: 1,
  complied_count: 1,
  collapsed_count: 0,
  negotiated_count: 0,
  ...extra,
});

describe('toSessions', () => {
  it('types the rows and sorts them newest first', () => {
    const out = toSessions([sessionRow(1), sessionRow(3), sessionRow(2)]);
    expect(out.map((s) => s.id)).toEqual([3, 2, 1]);
    expect(out[0]).toMatchObject({ name: 's3', run_count: 3, refused_count: 1 });
  });

  it('drops Model compare sessions by the shared prefix rule (D29)', () => {
    const out = toSessions([
      sessionRow(1),
      sessionRow(2, { notes: `${COMPARE_SESSION_PREFIX} 2026-10-12` }),
      sessionRow(3, { notes: 'my own notes' }),
    ]);
    expect(out.map((s) => s.id)).toEqual([3, 1]);
  });

  it('treats missing counts as 0 and ignores anything that is not a row', () => {
    const out = toSessions([{ id: 5, name: 'x', created_at: '2026-10-01 00:00:00' }, null, 'x', 7]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ run_count: 0, refused_count: 0, negotiated_count: 0 });
  });

  it('returns [] for a reply that is not a list', () => {
    expect(toSessions({ sessions: [] })).toEqual([]);
  });

  it('breaks equal times by id, newest id first', () => {
    const same = { created_at: '2026-10-01 10:00:00' };
    expect(toSessions([sessionRow(4, same), sessionRow(9, same)]).map((s) => s.id)).toEqual([9, 4]);
  });
});

describe('sessionTally and counts', () => {
  const s = (run_count: number, r = 0, c = 0, col = 0, n = 0) =>
    ({
      run_count,
      refused_count: r,
      complied_count: c,
      collapsed_count: col,
      negotiated_count: n,
    }) as BrowseSession;

  it('puts runs outside the four classes in unknown', () => {
    expect(sessionTally(s(5, 2, 1))).toEqual({
      refused: 2,
      collapsed: 0,
      negotiated: 0,
      complied: 1,
      unknown: 2,
    });
  });

  it('never gives a negative unknown', () => {
    expect(sessionTally(s(1, 1, 1)).unknown).toBe(0);
  });

  it('folds a sidecar class map into the five classes', () => {
    const c = toClsCounts({ refused: 2, complied: 1, error: 1, unknown: 1, odd: 0 });
    expect(c).toEqual({ refused: 2, complied: 1, unknown: 2 });
    expect(totalOf(c)).toBe(5);
    expect(toClsCounts(null)).toEqual({});
  });
});

describe('toSequences and toStudies', () => {
  it('types sequence rows with their session name and model', () => {
    const out = toSequences([
      {
        id: 4,
        session_id: 2,
        probe_id: 9,
        strategy_id: 1,
        mode: 'automatic',
        max_warmup_turns: 2,
        status: 'completed',
        created_at: '2026-10-18 10:00:00',
        session_name: 'A',
        target_model: 'claude-test',
      },
      { id: 0 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ max_warmup_turns: 2, session_name: 'A', batch_id: null });
  });

  it('reads the experiments list, newest first', () => {
    const e = (id: number, created_at: string) =>
      ({ id, name: `e${id}`, created_at }) as Experiment;
    const out = toStudies({
      experiments: [e(1, '2026-10-01 00:00:00'), e(2, '2026-10-05 00:00:00')],
    });
    expect(out.map((x) => x.id)).toEqual([2, 1]);
    expect(toStudies([])).toEqual([]);
  });
});

describe('dates', () => {
  // Local noon on 19 October 2026.
  const now = new Date(2026, 9, 19, 12, 0, 0);
  const local = (d: number, h = 9) => new Date(2026, 9, d, h, 0, 0).toISOString();

  it('reads naive sidecar timestamps as UTC', () => {
    expect(parseTime('2026-10-19 08:00:00')).toBe(Date.UTC(2026, 9, 19, 8, 0, 0));
    expect(parseTime('2026-10-19T08:00:00')).toBe(Date.UTC(2026, 9, 19, 8, 0, 0));
    expect(parseTime('nonsense')).toBeNull();
    expect(parseTime(null)).toBeNull();
  });

  it('groups by Today, This week, This month and Older', () => {
    expect(dateGroup(local(19, 0), now)).toBe('today');
    expect(dateGroup(local(20), now)).toBe('today');
    expect(dateGroup(local(18), now)).toBe('week');
    expect(dateGroup(local(13), now)).toBe('week');
    expect(dateGroup(local(12), now)).toBe('month');
    expect(dateGroup(new Date(2026, 8, 20, 9).toISOString(), now)).toBe('month');
    expect(dateGroup(new Date(2026, 8, 19, 9).toISOString(), now)).toBe('older');
    expect(dateGroup('', now)).toBe('older');
  });

  it('keeps item order inside each group and leaves out empty groups', () => {
    const items = [
      { id: 1, at: local(19) },
      { id: 2, at: local(2) },
      { id: 3, at: local(19, 8) },
    ];
    const out = groupByDate(items, (i) => i.at, now);
    expect(out.map((g) => g.group)).toEqual(['today', 'month']);
    expect(out[0].items.map((i) => i.id)).toEqual([1, 3]);
  });
});

describe('feed', () => {
  it('merges every list newest first, kinds in tab order on a tie', () => {
    const t = '2026-10-18 10:00:00';
    const out = feed({
      sessions: [{ id: 1, created_at: t } as BrowseSession],
      comparisons: [{ id: 2, created_at: '2026-10-18 11:00:00' } as ComparisonSummary],
      studies: [{ id: 3, created_at: t } as Experiment],
      sequences: [{ id: 4, created_at: '2026-10-01 10:00:00' } as BrowseSequence],
    });
    expect(out.map((i) => i.key)).toEqual(['comparison-2', 'session-1', 'study-3', 'sequence-4']);
  });

  it('is empty when every list is', () => {
    expect(feed({ sessions: [], comparisons: [], studies: [], sequences: [] })).toEqual([]);
  });
});

describe('session detail helpers', () => {
  it('turns the domain breakdown into rows, most runs first', () => {
    const rows = domainRows({
      fiction: { total: 1, refused: 1, collapsed: 0, negotiated: 0, complied: 0 },
      e2e: { total: 3, refused: 1, collapsed: 1, negotiated: 0, complied: 1 },
      bad: 4,
    });
    expect(rows.map((r) => r.domain)).toEqual(['e2e', 'fiction']);
    expect(rows[0]).toMatchObject({ total: 3, complied: 1 });
    expect(domainRows(null)).toEqual([]);
  });

  it('takes the outcome from the final class, else the first', () => {
    expect(
      runOutcome({ initial_classification: 'refused', final_classification: 'collapsed' }),
    ).toBe('collapsed');
    expect(runOutcome({ initial_classification: 'refused', final_classification: null })).toBe(
      'refused',
    );
    expect(runOutcome({ initial_classification: null, final_classification: '' })).toBe('unknown');
  });

  it('previews the probe text in 80 characters', () => {
    const long = 'word '.repeat(40);
    const p = runPreview(long);
    expect(p.endsWith('…')).toBe(true);
    expect(p.length).toBeLessThanOrEqual(81);
    expect(runPreview('  two\n lines ')).toBe('two lines');
    expect(runPreview(null)).toBe('');
  });

  it('names the pushback source', () => {
    expect(pushbackSource('coach')).toBe('coach');
    expect(pushbackSource('Override')).toBe('override');
    expect(pushbackSource('skipped')).toBe('skip');
    expect(pushbackSource('')).toBeNull();
    expect(pushbackSource(null)).toBeNull();
  });

  it('shows the whole conversation only past two turns', () => {
    expect(showConversation(2)).toBe(false);
    expect(showConversation(3)).toBe(true);
  });

  it('keeps findings that say something, with their tags', () => {
    const out = toFindings([
      {
        id: 1,
        run_id: 5,
        probe_id: 2,
        probe_name: 'p',
        finding: ' Gave in. ',
        pattern_tags: ['a', '', 3],
      },
      { id: 2, run_id: 6, probe_id: 2, probe_name: 'p', finding: '   ' },
    ]);
    expect(out).toEqual([
      {
        id: 1,
        run_id: 5,
        probe_id: 2,
        probe_name: 'p',
        finding: 'Gave in.',
        pattern_tags: ['a'],
        updated_at: null,
      },
    ]);
  });
});

describe('routes and tabs', () => {
  it('builds the detail links', () => {
    expect(sessionHref(3)).toBe('/data/browse/sessions/3');
    expect(sequenceHref(4)).toBe('/data/browse/sequences/4');
    expect(comparisonHref(5)).toBe('/studies/compare/5');
    expect(studyHref(6)).toBe('/studies/conditions/6');
    expect(runHref(7)).toBe('/probe/runs/7');
  });

  it('reads a ?tab= value, defaulting to All', () => {
    expect(asTab('sequences')).toBe('sequences');
    expect(asTab('nope')).toBe('all');
    expect(asTab(null)).toBe('all');
  });
});

describe('clear all', () => {
  it('sends the confirmation string the route requires', () => {
    expect(CLEAR_ALL_CONFIRM).toBe('DELETE_ALL_DATA');
  });

  it('reads the sessions and runs removed', () => {
    expect(clearedCounts({ deleted: { sessions: 2, runs: 7, sequences: 1 } })).toEqual({
      sessions: 2,
      runs: 7,
    });
    expect(clearedCounts(null)).toEqual({ sessions: 0, runs: 0 });
  });
});
