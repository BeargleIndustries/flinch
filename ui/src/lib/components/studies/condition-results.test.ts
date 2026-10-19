import { describe, expect, it } from 'vitest';
import { CONDITIONS_RESULTS as R } from '$lib/copy/studies';
import {
  analysisLines,
  blindingOf,
  classCounts,
  clip,
  dTone,
  errorsIn,
  largestD,
  meanSd,
  metricStat,
  preregName,
  prolificAllowed,
  prolificBody,
  prolificError,
  ranksByCondition,
  rateCounts,
  ratePct,
  reportName,
  reportReady,
  smallestP,
  stars,
  textField,
  unclassifiedTotal,
  visibleMetricRows,
  winRates,
  winnerAgreement,
  type AiRating,
} from './condition-results';

const cond = (classifications: Record<string, number>, metrics: Record<string, unknown> = {}) => ({
  id: 1,
  label: 'A',
  system_prompt: '',
  description: '',
  response_count: 0,
  classifications,
  compliance_rate: null,
  metrics,
});

describe('comparison', () => {
  it('counts nulls and unexpected words as unknown', () => {
    expect(classCounts(cond({ refused: 2, unknown: 1, weird: 2 }))).toEqual({
      refused: 2,
      unknown: 3,
    });
  });

  it('sums unclassified over every condition', () => {
    expect(unclassifiedTotal(null)).toBe(0);
    expect(
      unclassifiedTotal({ conditions: [cond({ unknown: 2 }), cond({ complied: 3, unknown: 1 })] }),
    ).toBe(3);
  });

  it('formats rates and clips prompts', () => {
    expect(ratePct(0.6666)).toBe('67%');
    expect(ratePct(null)).toBe(R.noRate);
    expect(clip('a  b', 10)).toBe('a b');
    expect(clip('abcdefghij', 5)).toBe('abcd…');
  });
});

describe('metrics table', () => {
  const metrics = { word_count: { mean: 5, sd: 0.5, n: 4 }, ttr: { mean: null } };

  it('reads a stat and formats mean and sd', () => {
    const s = metricStat(cond({}, metrics), 'word_count');
    expect(s).toEqual({ mean: 5, sd: 0.5, n: 4 });
    expect(meanSd(s!)).toBe('5.00 ± 0.50');
    expect(metricStat(cond({}, metrics), 'ttr')).toBeNull();
    expect(metricStat(cond({}, metrics), 'mtld')).toBeNull();
  });

  it('hides rows no condition has', () => {
    expect(visibleMetricRows([cond({}, metrics), cond({})]).map((r) => r.key)).toEqual([
      'word_count',
    ]);
  });

  const analysis = {
    effect_sizes: {
      A_vs_B: { word_count: { cohens_d: 0.3 } },
      A_vs_C: { word_count: { cohens_d: -0.9 } },
    },
    corrections: {
      A_vs_B: { word_count: { p_fdr: 0.04 } },
      A_vs_C: { word_count: { p_fdr: 0.2 } },
    },
    nonparametric: { A_vs_B: { ttr: { p_value: 0.004 } } },
  };

  it('takes the largest absolute d and the smallest p, FDR first', () => {
    expect(largestD(analysis, 'word_count')).toBe(-0.9);
    expect(largestD(analysis, 'ttr')).toBeNull();
    expect(smallestP(analysis, 'word_count')).toBe(0.04);
    expect(smallestP(analysis, 'ttr')).toBe(0.004);
    expect(largestD({ effect_sizes: { error: 'No module named scipy' } }, 'word_count')).toBeNull();
    expect(largestD(null, 'word_count')).toBeNull();
  });

  it('stars and d sizes', () => {
    expect([0.0005, 0.005, 0.03, 0.2, null].map((p) => stars(p))).toEqual([
      '***',
      '**',
      '*',
      '',
      '',
    ]);
    expect([0.1, -0.25, 0.6, -1.2, null].map((d) => dTone(d))).toEqual([
      'none',
      'small',
      'medium',
      'large',
      'none',
    ]);
  });
});

describe('statistics lines', () => {
  it('finds errors at any of the levels /analyze stores them', () => {
    expect(errorsIn({ error: 'No module named scipy' })).toEqual(['No module named scipy']);
    expect(errorsIn({ ai_raters: { alpha: null, error: 'too few' } })).toEqual([
      'ai raters: too few',
    ]);
    expect(errorsIn({ A_vs_B: { word_count: { error: 'all equal' } } })).toEqual([
      'A vs B, word count: all equal',
    ]);
  });

  it('gives one readable line per test, errors as text', () => {
    const lines = analysisLines({
      win_rates: { ai_raters: { A: { total: 2 } }, human_raters: {} },
      effect_sizes: { error: 'No module named numpy' },
      nonparametric: { A_vs_B: { word_count: { error: 'x' }, ttr: { error: 'y' } } },
      power_analysis: { actual_power: 0.81, required_n_per_group: 175 },
      paired: {},
      extra_test: { A_vs_B: {} },
    });
    expect(lines.map((l) => [l.key, l.state])).toEqual([
      ['win_rates', 'ok'],
      ['effect_sizes', 'error'],
      ['power_analysis', 'ok'],
      ['nonparametric', 'error'],
      ['paired', 'empty'],
      ['extra_test', 'ok'],
    ]);
    expect(lines[1].text).toBe('No module named numpy');
    expect(lines[3].text).toBe(`A vs B, word count: x${R.moreErrors(1)}`);
    expect(lines[2].text).toBe(R.powerLine(0.81, 175));
    expect(lines[4].text).toBe(R.nothingToCompare);
    expect(analysisLines(null)).toEqual([]);
  });
});

const rating = (
  id: number,
  prompt: number,
  blinding: AiRating['blinding_order'],
  ranks: Record<string, number>,
  extra: Partial<AiRating> = {},
): AiRating => ({
  id,
  rater_model: 'r1',
  prompt_id: prompt,
  target_model_id: 'm',
  blinding_order: blinding,
  status: 'completed',
  items: Object.entries(ranks).map(([position_label, rank], i) => ({
    id: i,
    rating_id: id,
    response_id: i,
    position_label,
    rank,
  })),
  ...extra,
});

describe('ratings', () => {
  it('decodes ranks with blinding_order[position_label]', () => {
    const r = rating(1, 1, { A: 20, B: 10 }, { A: 1, B: 2 });
    expect([...ranksByCondition(r)]).toEqual([
      [20, 1],
      [10, 2],
    ]);
    expect(blindingOf({ blinding_order: '{"A": 3}' })).toEqual({ A: 3 });
    expect(blindingOf({ blinding_order: 'not json' })).toEqual({});
  });

  it('counts first places and mean rank over completed ratings', () => {
    const ratings = [
      rating(1, 1, { A: 20, B: 10 }, { A: 1, B: 2 }),
      rating(2, 2, { A: 10, B: 20 }, { A: 1, B: 2 }),
      rating(3, 3, { A: 10, B: 20 }, { A: 1, B: 2 }),
      rating(4, 4, { A: 10, B: 20 }, {}, { status: 'failed' }),
    ];
    const w = winRates(ratings, [10, 20]);
    expect(w).toEqual([
      { conditionId: 10, wins: 2, rated: 3, winRate: 2 / 3, meanRank: 4 / 3 },
      { conditionId: 20, wins: 1, rated: 3, winRate: 1 / 3, meanRank: 5 / 3 },
    ]);
    expect(winRates([], [1])[0]).toMatchObject({ winRate: null, meanRank: null });
  });

  it('measures winner agreement only where two raters saw the same prompt', () => {
    const ratings = [
      rating(1, 1, { A: 10, B: 20 }, { A: 1, B: 2 }),
      rating(2, 1, { A: 20, B: 10 }, { A: 2, B: 1 }, { rater_model: 'r2' }),
      rating(3, 2, { A: 10, B: 20 }, { A: 1, B: 2 }),
      rating(4, 2, { A: 10, B: 20 }, { A: 2, B: 1 }, { rater_model: 'r2' }),
      rating(5, 3, { A: 10, B: 20 }, { A: 1, B: 2 }),
    ];
    expect(winnerAgreement(ratings)).toEqual({ shared: 2, agreed: 1 });
  });

  it('reads rate stream counts and errors', () => {
    expect(rateCounts({ completed: 2, total: 3, error: 'boom' })).toEqual({
      completed: 2,
      total: 3,
      error: 'boom',
    });
    expect(rateCounts('x')).toEqual({ completed: null, total: null, error: null });
  });
});

describe('prolific', () => {
  it('is offered for two or three conditions only (I11)', () => {
    expect([1, 2, 3, 4].map(prolificAllowed)).toEqual([false, true, true, false]);
  });

  it('checks the form and builds the body', () => {
    const f = { promptCount: 300, models: ['m'], ratersPerTask: 3, batchId: ' b1 ' };
    expect(prolificError(f)).toBeNull();
    expect(prolificError({ ...f, promptCount: 0 })).toBe(R.prolificPromptsBad);
    expect(prolificError({ ...f, ratersPerTask: 1.5 })).toBe(R.prolificRatersBad);
    expect(prolificError({ ...f, models: [] })).toBe(R.prolificModelsBad);
    expect(prolificBody(f)).toEqual({
      prompt_count: 300,
      model_ids: ['m'],
      raters_per_task: 3,
      batch_id: 'b1',
    });
  });
});

describe('export', () => {
  it('names the Markdown files and gates the report', () => {
    expect(preregName(4)).toBe('study-4-preregistration.md');
    expect(reportName(4)).toBe('study-4-report.md');
    expect(reportReady('completed', true)).toBe(true);
    expect(reportReady('completed', false)).toBe(false);
    expect(reportReady('paused', true)).toBe(false);
  });

  it('reads the text field or says it was empty', () => {
    expect(textField({ report: '# R' }, 'report')).toBe('# R');
    expect(() => textField({}, 'report')).toThrow(R.exportEmpty);
  });
});
