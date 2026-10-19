import { describe, expect, it } from 'vitest';
import {
  MAX_MODELS,
  agreementLabel,
  agreementTone,
  alignedCount,
  cellClass,
  compareProblems,
  comparisonRoute,
  customProbeBody,
  defaultModels,
  displayName,
  expectedMinutes,
  exportName,
  hasDuplicate,
  modelTally,
  modelsLine,
  pickedModels,
  runRoute,
  sortComparisons,
  tallyRows,
  toDetail,
  toSummary,
  type CompareAnswer,
  type CompareResult,
} from './compare';
import type { ModelGroup } from '../model-picker';

const EM = String.fromCharCode(0x2014);

const ans = (classification: string | null, extra: Partial<CompareAnswer> = {}): CompareAnswer => ({
  response: classification ? `text ${classification}` : null,
  classification,
  run_id: 1,
  session_id: 1,
  error: null,
  ...extra,
});

const res = (
  id: number,
  models: Record<string, CompareAnswer>,
  disagreement = false,
): CompareResult => ({
  probe_id: id,
  probe_name: `p${id}`,
  probe_domain: 'd',
  prompt_text: 'x',
  models,
  disagreement,
});

const group = (provider: string, ids: string[], available = true): ModelGroup => ({
  provider,
  available,
  hint: available ? '' : 'no key',
  models: ids.map((id) => ({ id, name: id })),
});

describe('toSummary / toDetail', () => {
  it('types a list row and drops wrong fields', () => {
    const s = toSummary({
      id: 4,
      name: 'Compare',
      models: ['a', 2, 'b'],
      probe_ids: [1, 'x', 2],
      session_ids: { a: 10, b: 'nope' },
      agreement_rate: 50,
      total_probes: 2,
      notes: null,
      created_at: '2026-10-19 10:00:00',
    });
    expect(s).toEqual({
      id: 4,
      name: 'Compare',
      models: ['a', 'b'],
      probe_ids: [1, 2],
      session_ids: { a: 10 },
      agreement_rate: 50,
      total_probes: 2,
      notes: '',
      created_at: '2026-10-19 10:00:00',
    });
  });

  it('fills a missing row with safe values', () => {
    expect(toSummary(null)).toMatchObject({ id: 0, models: [], agreement_rate: 0 });
  });

  it('types every result and answer', () => {
    const d = toDetail({
      id: 1,
      models: ['a'],
      results: [
        {
          probe_id: 3,
          probe_name: 'refuse-me',
          prompt_text: 'p',
          models: { a: { response: 'no', classification: 'refused', run_id: 9, session_id: 2 } },
          disagreement: false,
        },
        'junk',
      ],
    });
    expect(d.results).toHaveLength(2);
    expect(d.results[0].models.a).toEqual({
      response: 'no',
      classification: 'refused',
      run_id: 9,
      session_id: 2,
      error: null,
    });
    expect(d.results[0].probe_domain).toBe('');
    expect(d.results[1]).toMatchObject({ probe_id: 0, models: {}, disagreement: false });
  });

  it('gives an empty result list when results is not a list', () => {
    expect(toDetail({ id: 1, results: 'x' }).results).toEqual([]);
  });
});

describe('sortComparisons', () => {
  it('orders newest first, ids breaking ties, and drops rows without an id', () => {
    const rows = [
      { id: 1, created_at: '2026-10-18 09:00:00' },
      { id: 3, created_at: '2026-10-19 09:00:00' },
      { id: 2, created_at: '2026-10-19 09:00:00' },
      { name: 'no id' },
    ];
    expect(sortComparisons(rows).map((c) => c.id)).toEqual([3, 2, 1]);
  });

  it('reads a non-list as empty', () => {
    expect(sortComparisons({ rows: [] })).toEqual([]);
  });
});

describe('names and labels', () => {
  it('replaces the em dash in the sidecar name', () => {
    expect(displayName(`Compare 10/19 14:05 ${EM} claude vs gpt`)).toBe(
      'Compare 10/19 14:05 · claude vs gpt',
    );
    expect(displayName(`a${EM}b`)).toBe('a · b');
    expect(displayName('plain')).toBe('plain');
  });

  it('joins models with vs', () => {
    expect(modelsLine(['a', 'b', 'c'])).toBe('a vs b vs c');
  });

  it('rounds the agreement, which is already a percentage', () => {
    expect(agreementLabel(100)).toBe('100%');
    expect(agreementLabel(66.666)).toBe('67%');
    expect(agreementLabel(0)).toBe('0%');
    expect(agreementLabel(1)).toBe('1%');
    expect(agreementLabel(Number.NaN)).toBe('0%');
  });

  it('tones ok at 80, warn at 50, danger below', () => {
    expect(agreementTone(100)).toBe('ok');
    expect(agreementTone(80)).toBe('ok');
    expect(agreementTone(79.9)).toBe('warn');
    expect(agreementTone(50)).toBe('warn');
    expect(agreementTone(49)).toBe('danger');
    expect(agreementTone(0)).toBe('danger');
  });

  it('builds the routes and file names', () => {
    expect(comparisonRoute(7)).toBe('/studies/compare/7');
    expect(runRoute(12)).toBe('/probe/runs/12');
    expect(exportName(3, 'csv')).toBe('flinch-comparison-3.csv');
  });
});

describe('agreement and tallies', () => {
  const results = [
    res(1, { a: ans('refused'), b: ans('refused') }),
    res(2, { a: ans('complied'), b: ans('refused') }, true),
    res(3, { a: ans(null, { error: 'boom' }), b: ans('complied') }),
  ];

  it('counts results without a disagreement', () => {
    expect(alignedCount(results)).toBe(2);
    expect(alignedCount([])).toBe(0);
  });

  it('shows a failure or a missing answer as unknown', () => {
    expect(cellClass(ans('refused'))).toBe('refused');
    expect(cellClass(ans('refused', { error: 'x' }))).toBe('unknown');
    expect(cellClass(undefined)).toBe('unknown');
    expect(cellClass(ans('weird'))).toBe('unknown');
  });

  it('tallies one model across the results', () => {
    expect(modelTally(results, 'a')).toEqual({ refused: 1, complied: 1, unknown: 1 });
    expect(modelTally(results, 'b')).toEqual({ refused: 2, complied: 1 });
    expect(modelTally(results, 'missing')).toEqual({ unknown: 3 });
  });

  it('orders a tally by class and leaves zeros out', () => {
    expect(tallyRows({ unknown: 1, complied: 2, refused: 0 })).toEqual([
      { cls: 'complied', count: 2 },
      { cls: 'unknown', count: 1 },
    ]);
  });
});

describe('picking models', () => {
  it('trims, drops blanks and keeps the first of each id', () => {
    expect(pickedModels([' a ', '', 'b', 'a'])).toEqual(['a', 'b']);
  });

  it('spots a repeated filled row only', () => {
    expect(hasDuplicate(['a', 'a '])).toBe(true);
    expect(hasDuplicate(['a', '', ''])).toBe(false);
  });

  it('needs 2 to 5 distinct models and at least one probe', () => {
    expect(compareProblems(['a', 'b'], 1)).toEqual([]);
    expect(compareProblems(['a', ''], 1)).toEqual(['models']);
    expect(compareProblems(['a', 'a'], 1)).toEqual(['models', 'duplicate']);
    expect(compareProblems(['a', 'b'], 0)).toEqual(['probes']);
    const six = Array.from({ length: MAX_MODELS + 1 }, (_, i) => `m${i}`);
    expect(compareProblems(six, 1)).toEqual(['models']);
  });

  it('starts from the session default and another provider', () => {
    const groups = [
      group('anthropic', ['claude-opus', 'claude-sonnet-4-6']),
      group('openai', ['gpt-4.1', 'gpt-4o']),
    ];
    expect(defaultModels(groups)).toEqual(['claude-sonnet-4-6', 'gpt-4.1']);
  });

  it('skips unavailable providers and falls back to the same one', () => {
    const groups = [
      group('anthropic', ['claude-sonnet-4-6', 'claude-haiku']),
      group('openai', ['gpt-4.1'], false),
    ];
    expect(defaultModels(groups)).toEqual(['claude-sonnet-4-6', 'claude-haiku']);
  });

  it('leaves the second row blank when nothing else is available', () => {
    expect(defaultModels([group('anthropic', ['claude-sonnet-4-6'])])).toEqual([
      'claude-sonnet-4-6',
      '',
    ]);
    expect(defaultModels([])).toEqual(['', '']);
  });
});

describe('the run', () => {
  it('expects at least a minute, more with more probes', () => {
    expect(expectedMinutes(0)).toBe(1);
    expect(expectedMinutes(2)).toBe(1);
    expect(expectedMinutes(3)).toBe(2);
    expect(expectedMinutes(10)).toBe(5);
  });

  it('saves a custom prompt as a custom-domain probe', () => {
    expect(customProbeBody('  hello  ', 42)).toEqual({
      name: 'custom-42',
      domain: 'custom',
      prompt_text: 'hello',
    });
  });
});
