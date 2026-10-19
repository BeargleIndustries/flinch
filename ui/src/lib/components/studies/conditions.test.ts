import { describe, expect, it } from 'vitest';
import type { Condition } from '$lib/api/types';
import { CONDITIONS } from '$lib/copy/studies';
import {
  buildGrid,
  cellState,
  cellTotal,
  conditionRow,
  conditionsBody,
  conditionsError,
  csvCount,
  defaultConditions,
  emptySources,
  eventCounts,
  eventError,
  hhBody,
  hhError,
  hhResult,
  nextConditionLabel,
  parseCsv,
  promptName,
  providersOf,
  rateLimitsBody,
  rateProvider,
  rateWords,
  repeatsValue,
  rowsFromVariants,
  runActions,
  savedRateLimits,
  seedValue,
  sourcePromptCount,
  sourcesError,
  type RunState,
  type StudyResponse,
} from './conditions';

describe('conditions rows', () => {
  it('starts with a Control row with no system prompt and one more', () => {
    const rows = defaultConditions();
    expect(rows.map((r) => [r.label, r.systemPrompt])).toEqual([
      ['Control', ''],
      ['Condition 1', ''],
    ]);
    expect(conditionsError(rows)).toBeNull();
  });

  it('allows an empty system prompt but not an empty, long or repeated label', () => {
    expect(conditionsError([])).toBe(CONDITIONS.needCondition);
    expect(conditionsError([conditionRow('  ')])).toBe(CONDITIONS.needCondition);
    expect(conditionsError([conditionRow('x'.repeat(101))])).toBe(CONDITIONS.labelLong);
    expect(conditionsError([conditionRow('Terse'), conditionRow(' terse ')])).toBe(
      CONDITIONS.uniqueLabels,
    );
    expect(conditionsError([conditionRow('Control', '')])).toBeNull();
  });

  it('numbers new rows past the labels in use', () => {
    expect(nextConditionLabel(defaultConditions())).toBe('Condition 2');
    expect(nextConditionLabel([conditionRow('Control')])).toBe('Condition 1');
  });

  it('loads a conditions file: label, and its prompt text as the system prompt', () => {
    const rows = rowsFromVariants([
      { label: 'Control', prompt_text: '', is_baseline: true },
      { label: ' Terse ', prompt_text: 'Answer in one short sentence.', is_baseline: false },
    ]);
    expect(rows.map((r) => [r.label, r.systemPrompt])).toEqual([
      ['Control', ''],
      ['Terse', 'Answer in one short sentence.'],
    ]);
  });

  it('sends trimmed labels, the prompt as typed and the row order', () => {
    expect(conditionsBody([conditionRow(' A ', ' sys '), conditionRow('B')])).toEqual([
      { label: 'A', system_prompt: ' sys ', sort_order: 0 },
      { label: 'B', system_prompt: '', sort_order: 1 },
    ]);
  });
});

describe('prompt sources', () => {
  it('parses quoted CSV fields with commas, quotes and line breaks', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\r\n\n1,2')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
      ['1', '2'],
    ]);
  });

  it('counts the rows the server will import (prompt_text present and not empty)', () => {
    expect(csvCount('')).toEqual({ rows: 0, hasHeader: false });
    expect(csvCount('text\nhello')).toEqual({ rows: 0, hasHeader: false });
    expect(csvCount('prompt_text,domain\nOne,a\n,b\n"Two, more",c\n')).toEqual({
      rows: 2,
      hasHeader: true,
    });
    expect(csvCount('domain,prompt_text\nx,Hello')).toEqual({ rows: 1, hasHeader: true });
  });

  it('adds picked probes, pasted rows and the HH-RLHF target', () => {
    const s = emptySources();
    expect(sourcePromptCount(s)).toBe(0);
    expect(sourcesError(s, 'need')).toBe('need');
    s.probeIds = new Set([1, 2]);
    s.csvText = 'prompt_text\nA\nB\nC';
    expect(sourcePromptCount(s)).toBe(5);
    s.hh.enabled = true;
    s.hh.targetCount = 20;
    expect(sourcePromptCount(s)).toBe(25);
    expect(sourcesError(s, 'need')).toBeNull();
  });

  it('flags pasted text without a prompt_text header', () => {
    const s = emptySources();
    s.probeIds = new Set([1]);
    s.csvText = 'text\nA';
    expect(sourcesError(s, 'need')).toBe(CONDITIONS.csvNoHeader);
  });

  it('checks the HH-RLHF fields only when it is on', () => {
    const s = emptySources();
    s.hh.targetCount = 0;
    expect(hhError(s.hh)).toBeNull();
    s.hh.enabled = true;
    expect(hhError(s.hh)).toBe(CONDITIONS.hhTargetBad);
    s.hh.targetCount = 5001;
    expect(hhError(s.hh)).toBe(CONDITIONS.hhTargetBad);
    s.hh.targetCount = 20;
    s.hh.subsets = [];
    expect(hhError(s.hh)).toBe(CONDITIONS.hhSubsetsBad);
    s.hh.subsets = ['helpful-base'];
    s.hh.seed = 1.5;
    expect(hhError(s.hh)).toBe(CONDITIONS.hhSeedBad);
    s.hh.seed = 7;
    s.hh.mix.factual = 50;
    expect(hhError(s.hh)).toBe(CONDITIONS.hhMixSum(115));
    s.hh.mix = { factual: 40, advice: 20, opinion: 20, ethical: 20 };
    expect(hhError(s.hh)).toBeNull();
  });

  it('sends the default mix as null and any other as fractions', () => {
    const s = emptySources();
    s.hh.enabled = true;
    expect(hhBody(s.hh)).toEqual({
      target_count: 300,
      subsets: ['harmless-base', 'helpful-base', 'helpful-online', 'helpful-rejection-sampled'],
      seed: 42,
      stratification: null,
    });
    s.hh.mix = { factual: 40, advice: 20, opinion: 20, ethical: 20 };
    expect(hhBody(s.hh).stratification).toEqual({
      factual: 0.4,
      advice: 0.2,
      opinion: 0.2,
      ethical: 0.2,
    });
  });
});

describe('models, repeats and rate limits', () => {
  it('files models under the providers the run pool uses', () => {
    expect(rateProvider('claude-sonnet-4-20250514')).toBe('anthropic');
    expect(rateProvider('gpt-4o-mini')).toBe('openai');
    expect(rateProvider('o3-mini')).toBe('openai');
    expect(rateProvider('gemini-2.0-flash')).toBe('google');
    expect(rateProvider('grok-2')).toBe('xai');
    expect(rateProvider('ollama:llama3')).toBe('ollama');
    expect(rateProvider('meta-llama/Llama-3-70b')).toBe('together');
    expect(providersOf(['claude-a', 'claude-b', '', 'gpt-x'])).toEqual(['anthropic', 'openai']);
  });

  it('builds concurrency_per_provider: an int, {rpm, concurrent} or nothing', () => {
    const providers = ['anthropic', 'openai', 'google'];
    expect(
      rateLimitsBody(providers, {
        anthropic: { rpm: '60', concurrent: '1' },
        openai: { rpm: '', concurrent: '2' },
        google: { rpm: '', concurrent: '' },
      }),
    ).toEqual({ anthropic: { rpm: 60, concurrent: 1 }, openai: 2 });
    expect(rateLimitsBody(providers, { anthropic: { rpm: '120', concurrent: '' } })).toEqual({
      anthropic: { rpm: 120 },
    });
    expect(rateLimitsBody(providers, { anthropic: { rpm: '0', concurrent: '' } })).toBeNull();
    expect(rateLimitsBody(providers, { anthropic: { rpm: '', concurrent: '51' } })).toBeNull();
    expect(rateLimitsBody(providers, { anthropic: { rpm: '1.5', concurrent: '' } })).toBeNull();
    // A provider no longer picked is left out.
    expect(rateLimitsBody(['openai'], { anthropic: { rpm: '60', concurrent: '' } })).toEqual({});
  });

  it('reads saved limits back from config, keeping only valid shapes', () => {
    expect(savedRateLimits(null)).toEqual({});
    expect(savedRateLimits({ repetitions: 2 })).toEqual({});
    expect(
      savedRateLimits({
        rate_limits: { anthropic: { rpm: 60, concurrent: 1 }, openai: 3, bad: 'x', zero: 0 },
      }),
    ).toEqual({ anthropic: { rpm: 60, concurrent: 1 }, openai: 3 });
    expect(rateWords(3)).toBe('3 at once');
    expect(rateWords({ rpm: 60, concurrent: 1 })).toBe('60 a minute, 1 at once');
  });

  it('accepts repeats 1 to 50 and an optional whole seed', () => {
    expect(repeatsValue(1)).toBe(1);
    expect(repeatsValue(50)).toBe(50);
    expect(repeatsValue(0)).toBeNull();
    expect(repeatsValue(51)).toBeNull();
    expect(repeatsValue(null)).toBeNull();
    expect(seedValue('')).toBeUndefined();
    expect(seedValue(' 7 ')).toBe(7);
    expect(seedValue('x')).toBeNull();
    expect(cellTotal(2, 2, 1, 2)).toBe(8);
  });
});

describe('run actions (brief 8.2.3, F14)', () => {
  const base: RunState = {
    status: 'draft',
    attached: false,
    active: false,
    progress: { total: 0, pending: 0, failed: 0 },
    prompts: 2,
  };

  it('offers Pause while this window streams, whatever the status', () => {
    expect(runActions({ ...base, attached: true, status: 'paused' })).toEqual({
      primary: 'pause',
      enabled: true,
      retry: 0,
      note: null,
    });
  });

  it('starts a draft, but not one with no prompts', () => {
    expect(runActions(base)).toMatchObject({ primary: 'start', enabled: true, note: null });
    expect(runActions({ ...base, prompts: 0 })).toMatchObject({
      primary: 'start',
      enabled: false,
      note: 'needPrompts',
    });
  });

  it('keeps Resume enabled for paused and orphaned running studies', () => {
    const paused = { ...base, status: 'paused', progress: { total: 8, pending: 6, failed: 0 } };
    expect(runActions(paused)).toMatchObject({ primary: 'resume', enabled: true, note: null });
    expect(runActions({ ...paused, active: true })).toMatchObject({
      primary: 'resume',
      enabled: true,
      note: 'elsewhere',
    });
    expect(runActions({ ...paused, status: 'running' })).toMatchObject({
      primary: 'resume',
      enabled: true,
      retry: 0,
      note: 'orphan',
    });
  });

  it('runs pending cells of a settled study and offers to retry failures', () => {
    expect(
      runActions({ ...base, status: 'completed', progress: { total: 8, pending: 2, failed: 1 } }),
    ).toEqual({ primary: 'runPending', enabled: true, retry: 1, note: null });
    expect(
      runActions({ ...base, status: 'failed', progress: { total: 8, pending: 0, failed: 8 } }),
    ).toEqual({ primary: null, enabled: true, retry: 8, note: null });
    expect(
      runActions({ ...base, status: 'completed', progress: { total: 8, pending: 0, failed: 0 } }),
    ).toEqual({ primary: null, enabled: true, retry: 0, note: 'allDone' });
  });
});

describe('cell grid', () => {
  const cond = (id: number, sort: number, label: string): Condition => ({
    id,
    experiment_id: 1,
    label,
    system_prompt: '',
    description: '',
    sort_order: sort,
  });
  const resp = (
    id: number,
    condition_id: number,
    prompt_id: number,
    repetition: number,
    status = 'pending',
    classification: string | null = null,
  ): StudyResponse => ({
    id,
    condition_id,
    prompt_id,
    model_id: 'm',
    repetition,
    status,
    classification,
    error_message: null,
  });

  it('reads a cell as its badge, failed or pending', () => {
    expect(cellState({ status: 'completed', classification: 'refused' })).toBe('refused');
    expect(cellState({ status: 'completed', classification: null })).toBe('unknown');
    expect(cellState({ status: 'failed', classification: null })).toBe('failed');
    expect(cellState({ status: 'pending', classification: null })).toBe('pending');
  });

  it('makes a row per condition in sort order, columns by prompt order then repeat', () => {
    const grid = buildGrid(
      [cond(2, 1, 'B'), cond(1, 0, 'Control')],
      [
        resp(10, 2, 7, 1),
        resp(11, 1, 5, 0, 'completed', 'complied'),
        resp(12, 2, 5, 0, 'failed'),
        resp(13, 2, 7, 0),
      ],
      [{ id: 7 }, { id: 5 }],
    );
    expect(grid.map((r) => r.condition.label)).toEqual(['Control', 'B']);
    expect(grid[0].cells.map((c) => c.state)).toEqual(['complied']);
    expect(grid[1].cells.map((c) => [c.promptId, c.repetition, c.state])).toEqual([
      [7, 0, 'pending'],
      [7, 1, 'pending'],
      [5, 0, 'failed'],
    ]);
  });

  it('names a prompt by its probe, else its text', () => {
    const p = {
      id: 1,
      experiment_id: 1,
      probe_id: null,
      custom_prompt_text: 'x'.repeat(80),
      domain: null,
      sort_order: 0,
      probe_name: null,
      probe_text: null,
    };
    expect(promptName({ ...p, probe_name: 'refuse-me' })).toBe('refuse-me');
    expect(promptName(p)).toHaveLength(60);
    expect(promptName(undefined)).toBe('');
  });
});

describe('stream events', () => {
  it('reads counts, errors and the HH-RLHF result', () => {
    expect(eventCounts({ total: 8 })).toEqual({ total: 8, completed: null, failed: null });
    expect(eventCounts({ completed: 1, failed: 0, total: 8, model: 'm' })).toEqual({
      total: 8,
      completed: 1,
      failed: 0,
    });
    expect(eventCounts('x')).toEqual({ total: null, completed: null, failed: null });
    expect(eventError({ error: 'boom' })).toBe('boom');
    expect(eventError('raw')).toBe('raw');
    expect(hhResult({ imported: 20, skipped: 0, by_domain: {} })).toEqual({
      imported: 20,
      skipped: 0,
      warning: null,
    });
    expect(hhResult({ imported: 0, skipped: 3, warning: 'Has prompts' }).warning).toBe(
      'Has prompts',
    );
  });
});
