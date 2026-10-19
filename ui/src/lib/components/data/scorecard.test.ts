import { describe, expect, it } from 'vitest';
import type { SessionListItem, SessionRun } from '$lib/api/types';
import { COMPARE_SESSION_PREFIX } from '$lib/session';
import type { PolicyClaim } from '../probe/claims';
import {
  asScorecardTab,
  barWidth,
  buildGrid,
  cellCounts,
  cellRuns,
  claimIndex,
  complianceCounts,
  distinctModels,
  fallbackName,
  generateBody,
  generateProblems,
  isCompliant,
  otherResponses,
  runHref,
  sessionsForModel,
  sourceSessions,
  toCompliance,
  toResults,
  toScorecardList,
  toVerdict,
  toggled,
  verdictCounts,
  viewFromGenerate,
  viewFromSnapshot,
  type ClaimResult,
  type ComplianceRow,
} from './scorecard';

function claimResult(over: Partial<ClaimResult> = {}): ClaimResult {
  return {
    claim_id: 1,
    claim_text: 'Refuse weapons help',
    category: 'Weapons',
    expected_behavior: 'should_refuse',
    severity: 'hard',
    total_probes: 5,
    refused: 0,
    complied: 5,
    collapsed: 0,
    negotiated: 0,
    refused_rate: 0,
    enforcement: 'under',
    ...over,
  };
}

function claim(id: number, provider: string, slug: string, category = 'Cat'): PolicyClaim {
  return { id, provider, claim_id: slug, claim_text: `${slug} text`, category };
}

function session(over: Partial<SessionListItem> & { id: number }): SessionListItem {
  return {
    name: `S${over.id}`,
    target_model: 'model-a',
    coach_profile: 'standard',
    created_at: '2026-10-19 10:00:00',
    completed_at: null,
    notes: null,
    system_prompt: null,
    coach_backend: null,
    coach_model: null,
    probe_ids: null,
    run_count: 1,
    ...over,
  };
}

function run(over: Partial<SessionRun> & { id: number }): SessionRun {
  return {
    probe_id: 1,
    session_id: 1,
    target_model: 'model-a',
    initial_response: null,
    initial_classification: 'complied',
    coach_suggestion: null,
    coach_pattern_detected: null,
    coach_move_suggested: null,
    pushback_text: null,
    pushback_source: null,
    final_response: null,
    final_classification: null,
    override_text: null,
    notes: null,
    created_at: '2026-10-19 10:00:00',
    probe_text: '',
    probe_name: 'answer-me',
    probe_domain: null,
    ...over,
  };
}

describe('toVerdict (B27 words)', () => {
  it('maps every enforcement word', () => {
    expect(toVerdict('consistent')).toBe('matches');
    expect(toVerdict('over')).toBe('over');
    expect(toVerdict('under')).toBe('under');
    expect(toVerdict('context_dependent')).toBe('context');
  });
  it('treats anything else as No data', () => {
    expect(toVerdict('')).toBe('none');
    expect(toVerdict(null)).toBe('none');
    expect(toVerdict('weird')).toBe('none');
  });
});

describe('toResults', () => {
  it('reads by_model and drops malformed claims', () => {
    const r = toResults({
      models: ['m1'],
      session_ids: [3, 'x'],
      stat_run_ids: [],
      by_model: {
        m1: { model: 'm1', claims_tested: 1, by_claim: [claimResult(), { nope: 1 }, 'bad'] },
        m2: 'bad',
      },
    });
    expect(r.models).toEqual(['m1']);
    expect(r.session_ids).toEqual([3]);
    expect(Object.keys(r.by_model)).toEqual(['m1']);
    expect(r.by_model.m1.by_claim).toHaveLength(1);
  });
  it('falls back to by_model keys when models is missing', () => {
    expect(toResults({ by_model: { a: { by_claim: [] } } }).models).toEqual(['a']);
    expect(toResults(null).models).toEqual([]);
  });
});

describe('views', () => {
  it('builds the view for a generate reply', () => {
    const v = viewFromGenerate(
      {
        snapshot_id: 9,
        results: { models: ['m'], session_ids: [1], stat_run_ids: [2], by_model: {} },
      },
      'Mine',
      '2026-10-19T00:00:00Z',
    );
    expect(v).toMatchObject({
      snapshotId: 9,
      name: 'Mine',
      models: ['m'],
      sessionIds: [1],
      statRunIds: [2],
    });
  });
  it('builds the view for a saved row, preferring its own columns', () => {
    const v = viewFromSnapshot({
      id: 4,
      name: 'Saved',
      created_at: '2026-10-18 09:00:00',
      models: ['x', 'y'],
      session_ids: [7],
      stat_run_ids: [],
      results: { models: ['x'], session_ids: [8], stat_run_ids: [5], by_model: {} },
    });
    expect(v.snapshotId).toBe(4);
    expect(v.models).toEqual(['x', 'y']);
    expect(v.sessionIds).toEqual([7]);
    expect(v.statRunIds).toEqual([5]);
    expect(v.createdAt).toBe('2026-10-18 09:00:00');
  });
  it('lists saved scorecards newest first and skips rows without an id', () => {
    const list = toScorecardList([
      { id: 1, name: 'a', models: ['m'], created_at: 'x' },
      { name: 'no id' },
      { id: 3, name: 'c', models: 'bad', created_at: 'y' },
    ]);
    expect(list.map((s) => s.id)).toEqual([3, 1]);
    expect(list[0].models).toEqual([]);
    expect(toScorecardList('nope')).toEqual([]);
  });
});

describe('buildGrid', () => {
  const claims = claimIndex({
    openai: [claim(1, 'openai', 'harassment', 'Harassment')],
    google: [claim(2, 'google', 'hate-speech', 'Hate'), claim(3, 'google', 'adult', 'Sexual')],
  });

  it('makes one row per claim any model has, with No data where a model has none', () => {
    const v = viewFromGenerate(
      {
        snapshot_id: 1,
        results: {
          models: ['m1', 'm2'],
          by_model: {
            m1: {
              by_claim: [
                claimResult({ claim_id: 1, category: 'Harassment' }),
                claimResult({ claim_id: 2, category: 'Hate', enforcement: 'consistent' }),
              ],
            },
            m2: {
              by_claim: [
                claimResult({ claim_id: 3, category: 'Sexual', enforcement: 'context_dependent' }),
              ],
            },
          },
        },
      },
      'n',
    );
    const rows = buildGrid(v, claims);
    // Sorted by provider, then category, then slug.
    expect(rows.map((r) => r.slug)).toEqual(['hate-speech', 'adult', 'harassment']);
    const hate = rows[0];
    expect(hate.provider).toBe('google');
    expect(hate.cells.map((c) => [c.model, c.verdict])).toEqual([
      ['m1', 'matches'],
      ['m2', 'none'],
    ]);
    expect(rows[2].cells[0].verdict).toBe('under');
    expect(rows[1].cells[1].verdict).toBe('context');
    expect(verdictCounts(rows)).toEqual({ matches: 1, over: 0, under: 1, context: 1, none: 3 });
  });

  it('keeps a claim no longer in the policy list, without provider or slug', () => {
    const v = viewFromGenerate(
      {
        results: { models: ['m'], by_model: { m: { by_claim: [claimResult({ claim_id: 99 })] } } },
      },
      'n',
    );
    const [row] = buildGrid(v, claims);
    expect(row).toMatchObject({ claimId: 99, provider: '', slug: '', text: 'Refuse weapons help' });
  });

  it('is empty when nothing is linked', () => {
    const v = viewFromGenerate(
      { results: { models: ['m'], by_model: { m: { by_claim: [] } } } },
      'n',
    );
    expect(buildGrid(v, claims)).toEqual([]);
  });
});

describe('claimIndex', () => {
  it('indexes claims by database id and ignores junk', () => {
    const idx = claimIndex({ a: [claim(5, 'a', 's')], b: 'bad' as unknown as PolicyClaim[] });
    expect([...idx.keys()]).toEqual([5]);
    expect(claimIndex(null).size).toBe(0);
  });
});

describe('cellCounts', () => {
  it('splits the cell and counts the rest as unknown', () => {
    expect(
      cellCounts(
        claimResult({ total_probes: 6, refused: 2, complied: 1, collapsed: 1, negotiated: 1 }),
      ),
    ).toEqual({ refused: 2, collapsed: 1, negotiated: 1, complied: 1, unknown: 1 });
  });
});

describe('build form', () => {
  it('lists sessions with runs, newest first, and marks Model compare sessions (R13)', () => {
    const list = sourceSessions([
      session({ id: 1 }),
      session({ id: 2, run_count: 0 }),
      session({ id: 3, notes: `${COMPARE_SESSION_PREFIX}: x`, target_model: 'model-b' }),
    ]);
    expect(list.map((s) => [s.id, s.compare])).toEqual([
      [3, true],
      [1, false],
    ]);
  });
  it('collects distinct models in name order', () => {
    expect(
      distinctModels([
        { target_model: 'b' },
        { target_model: 'a' },
        { target_model: 'b' },
        { target_model: ' ' },
        { target_model: null },
      ]),
    ).toEqual(['a', 'b']);
  });
  it('says what blocks Generate', () => {
    const base = {
      name: '',
      models: new Set(['m']),
      sessionIds: new Set([1]),
      statRunIds: new Set<number>(),
    };
    expect(generateProblems(base)).toEqual([]);
    expect(generateProblems({ ...base, models: new Set() })).toEqual(['models']);
    expect(generateProblems({ ...base, sessionIds: new Set() })).toEqual(['sources']);
    expect(generateProblems({ ...base, sessionIds: new Set(), statRunIds: new Set([4]) })).toEqual(
      [],
    );
    expect(generateProblems({ ...base, name: 'x'.repeat(201) })).toEqual(['name']);
  });
  it('builds the generate body with a name, ordered models and sorted ids', () => {
    const body = generateBody(
      {
        name: '  ',
        models: new Set(['z', 'b', 'a']),
        sessionIds: new Set([5, 2]),
        statRunIds: new Set([9, 1]),
      },
      ['a', 'b'],
      new Date(2026, 9, 19),
    );
    expect(body).toEqual({
      name: 'Scorecard Oct 19',
      models: ['a', 'b', 'z'],
      session_ids: [2, 5],
      stat_run_ids: [1, 9],
    });
    expect(fallbackName(new Date(2026, 0, 3))).toBe('Scorecard Jan 3');
  });
  it('toggles a set without changing the original', () => {
    const a = new Set([1]);
    expect([...toggled(a, 2)]).toEqual([1, 2]);
    expect([...toggled(a, 1)]).toEqual([]);
    expect([...a]).toEqual([1]);
  });
});

describe('cell detail', () => {
  const sessions = [
    {
      id: 1,
      name: 'One',
      runs: [
        run({ id: 10, probe_id: 1 }),
        run({ id: 11, probe_id: 2 }),
        run({ id: 12, probe_id: 1, target_model: 'model-b' }),
      ],
    },
    { id: 2, name: 'Two', runs: [run({ id: 20, probe_id: 1, initial_classification: 'refused' })] },
  ];

  it('keeps runs of the model whose probe is linked, newest first', () => {
    const out = cellRuns(sessions, new Set([1]), 'model-a');
    expect(out.map((r) => [r.id, r.sessionName, r.classification])).toEqual([
      [20, 'Two', 'refused'],
      [10, 'One', 'complied'],
    ]);
    expect(runHref(out[0].id)).toBe('/probe/runs/20');
  });
  it('counts responses the list does not show', () => {
    const runs = cellRuns(sessions, new Set([1]), 'model-a');
    expect(otherResponses(claimResult({ total_probes: 5 }), runs)).toBe(3);
    expect(otherResponses(claimResult({ total_probes: 1 }), runs)).toBe(0);
  });
  it('reads only the scorecard sessions that ran the model', () => {
    const list = [
      { id: 1, target_model: 'model-a' },
      { id: 2, target_model: 'model-b' },
      { id: 3, target_model: 'model-a' },
    ];
    expect(sessionsForModel([1, 2], list, 'model-a')).toEqual([1]);
  });
});

describe('This session', () => {
  const row = (over: Partial<ComplianceRow>): ComplianceRow => ({
    claim_id: 1,
    provider: 'openai',
    claim_slug: 'harassment',
    claim_text: 't',
    category: 'Harassment',
    expected_behavior: 'should_refuse',
    severity: 'medium',
    probe_count: 1,
    refused_count: 0,
    complied_count: 1,
    collapsed_count: 0,
    negotiated_count: 0,
    compliance_rate: 0,
    ...over,
  });

  it('groups by provider, then category, both in name order, with counts per group', () => {
    const view = toCompliance({
      by_provider: {
        openai: {
          Weapons: [
            row({
              claim_id: 2,
              claim_slug: 'weapons',
              category: 'Weapons',
              refused_count: 2,
              complied_count: 0,
              probe_count: 2,
              compliance_rate: 1,
            }),
          ],
          Harassment: [row({})],
        },
        google: {
          Hate: [
            row({
              claim_id: 3,
              provider: 'google',
              claim_slug: 'hate-speech',
              category: 'Hate',
              refused_count: 1,
              complied_count: 0,
              compliance_rate: 1,
            }),
          ],
        },
        empty: {},
      },
      summary: { total_claims_tested: 3, compliant_claims: 2, average_compliance_rate: 0.667 },
    });
    expect(view.providers.map((p) => p.provider)).toEqual(['google', 'openai']);
    const openai = view.providers[1];
    expect(openai.categories.map((c) => c.category)).toEqual(['Harassment', 'Weapons']);
    expect(openai.runs).toBe(3);
    expect(openai.counts).toEqual({
      refused: 2,
      collapsed: 0,
      negotiated: 0,
      complied: 1,
      unknown: 0,
    });
    expect(openai.categories[1].counts.refused).toBe(2);
    expect(view.summary).toEqual({
      total_claims_tested: 3,
      compliant_claims: 2,
      average_compliance_rate: 0.667,
    });
  });
  it('is empty for an empty or odd reply', () => {
    expect(toCompliance({ by_provider: {}, summary: {} }).providers).toEqual([]);
    expect(toCompliance(null).summary.total_claims_tested).toBe(0);
  });
  it('counts unclassified runs as unknown', () => {
    expect(complianceCounts([row({ probe_count: 3 })]).unknown).toBe(2);
  });
  it('uses the route 80% line and clamps the bar', () => {
    expect(isCompliant(0.8)).toBe(true);
    expect(isCompliant(0.79)).toBe(false);
    expect(isCompliant(null)).toBe(false);
    expect(barWidth(0.5)).toBe(50);
    expect(barWidth(2)).toBe(100);
    expect(barWidth(-1)).toBe(0);
    expect(barWidth(null)).toBe(0);
  });
});

describe('asScorecardTab', () => {
  it('opens This session only for ?tab=session', () => {
    expect(asScorecardTab('session')).toBe('session');
    expect(asScorecardTab('policies')).toBe('policies');
    expect(asScorecardTab(null)).toBe('policies');
  });
});
