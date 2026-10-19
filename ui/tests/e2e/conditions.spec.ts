// Conditions studies (brief 8.2 and 13.3 spec 4; plan 6.3, D18, D22, D28,
// B03, B04, B11, B36, I33, F14; T22).
//
// "runs and resumes": the list opens with its research question and S there
// sends nothing in the current session (D22). A new study with the Control
// row (no system prompt) and one condition with a system prompt, the two
// seeded probes picked as prompts, the default model and 2 repeats is
// 2 conditions x 2 prompts x 1 model x 2 repeats = 8 cells. Its Anthropic
// rate limit is set to 60 a minute, 1 at once (saved in the study's config
// and sent as `concurrency_per_provider`, B36), so cells run one at a time
// about a second apart: Pause after the first `progress` event lands while
// the second cell waits for its slot. The study is then `paused` through
// the API with cells still pending, and the grid shows paused. Resume is
// clicked at once, with no waiting and no retry: the server holds the claim
// until the old stream releases (I33), so the one /resume request answers
// 200 and streams to "8 of 8 cells". Every cell is completed and classified
// (B04), and the study is `completed`.
//
// "sources and results" (T23; D20, I22, B04, B06, B11, B39): a study whose
// conditions come from "Import from a file" (the e2e-conditions.md fixture:
// Control and Terse) and whose prompts come from HH-RLHF against the fake
// /rows (target 20, a stratification mix other than the default) runs to
// 40 of 40 cells. Results shows one badge per response and none of them
// unclassified, Classify reports what the route returned, the comparison
// cards render, text metrics compute and Run statistics is offered. The
// Export tab has exactly the five D20 rows: the four that need no
// statistics download under their names (the CSV header has model_id and
// repetition, B11; every JSONL line parses, B06), and the report row says
// it waits for statistics.
//
// "statistics and the report" (fixme, see its comment): Run statistics, the
// statistics table download (I22) and the report download.
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { CONDITIONS, CONDITIONS_RESULTS } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, readSeed, sidecarUrl } from './helpers';

type StudyDetail = {
  experiment: { id: number; status: string; config: Record<string, unknown> };
  conditions: { id: number; label: string; system_prompt: string }[];
  progress: { total: number; completed: number; failed: number; pending: number };
};
type StudyResponse = { status: string; classification: string | null; repetition: number };

const stamp = () => String(Date.now()).slice(-7);

/** Long enough for a stray send to have reached the sidecar. */
const SETTLE_MS = 700;

test.beforeEach(async ({ page }) => {
  // Onboarding done, the tour and every first-time tip seen (brief 13.3).
  await page.addInitScript(
    (tipIds: string[]) => {
      localStorage.setItem('flinch:onboarding_done', 'true');
      localStorage.setItem('flinch:tour_seen', 'true');
      for (const id of tipIds) localStorage.setItem(`flinch:tip_seen:${id}`, 'true');
    },
    tipsRegistry.map((t) => t.id),
  );
});

test('runs and resumes', async ({ page }) => {
  test.setTimeout(120_000);
  const seed = readSeed();
  const runsOf = async () =>
    (await api<{ runs: unknown[] }>('GET', `/api/sessions/${seed.sessionId}`)).runs.length;
  const runsBefore = await runsOf();

  // Every /start, /pause and /resume the page sends, with its status.
  const calls: { kind: string; status: number }[] = [];
  page.on('response', (r) => {
    const m = /\/api\/experiments\/\d+\/(start|pause|resume)$/.exec(new URL(r.url()).pathname);
    if (m && r.request().method() === 'POST') calls.push({ kind: m[1], status: r.status() });
  });

  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, seed.sessionId);
  await page.goto('/studies/conditions');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS['conditions.list']);

  // D22: the Probe screen's S does nothing here.
  await page.keyboard.press('s');
  await page.waitForTimeout(SETTLE_MS);
  expect(await runsOf()).toBe(runsBefore);

  // New study.
  await page.getByTestId('new-study').click();
  await expect(page).toHaveURL(/\/studies\/conditions\/new$/);
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS['conditions.list']);
  const name = `E2E conditions ${stamp()}`;
  await page.getByTestId('study-name').fill(name);

  const rows = page.getByTestId('condition-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByTestId('condition-label')).toHaveValue(CONDITIONS.controlLabel);
  await expect(rows.nth(0).getByTestId('condition-prompt')).toHaveValue('');
  await rows.nth(1).getByTestId('condition-label').fill('Terse');
  await rows.nth(1).getByTestId('condition-prompt').fill('Answer in one short sentence.');

  const picker = page.getByTestId('study-probe-picker');
  for (const probe of ['refuse-me', 'answer-me']) {
    await picker.getByRole('searchbox', { name: 'Search probes' }).fill(probe);
    await picker
      .locator('li label')
      .filter({ has: page.getByText(probe, { exact: true }) })
      .getByRole('checkbox')
      .check();
  }
  await expect(page.getByTestId('probes-picked')).toHaveText(CONDITIONS.probesPicked(2));

  const modelSelect = page.getByTestId('study-models').getByRole('combobox');
  await expect(modelSelect).toHaveCount(1);
  await expect(modelSelect).not.toHaveValue('');
  const model = await modelSelect.inputValue();

  await page.getByTestId('study-repeats').fill('2');
  const anthropic = page.locator('[data-testid="rate-row"][data-provider="anthropic"]');
  await anthropic.getByTestId('rate-rpm').fill('60');
  await anthropic.getByTestId('rate-concurrent').fill('1');

  // 2 conditions x 2 prompts x 1 model x 2 repeats.
  const cellsLine = page.getByTestId('cells-line');
  await expect(cellsLine).toHaveAttribute('data-total', '8');
  await expect(cellsLine).toHaveText(CONDITIONS.cellsLine(2, 2, 1, 2, 8));

  await page.getByTestId('create-study').click();
  await expect(page).toHaveURL(/\/studies\/conditions\/\d+$/);
  const id = Number(/(\d+)$/.exec(page.url())![1]);

  const statusChip = page.getByTestId('study-status').locator('[data-status]');
  await expect(statusChip).toHaveAttribute('data-status', 'draft');
  await expect(page.getByTestId('setup-prompts')).toHaveText(CONDITIONS.promptsCount(2));
  await expect(page.getByTestId('setup-rates')).toContainText('60 a minute, 1 at once');
  await expect(page.getByTestId('study-estimate')).toContainText('About 8 model calls');
  await expect(page.getByTestId('study-estimate')).toContainText(
    CONDITIONS.estimateBreakdown(2, 2, 1, 2),
  );

  const created = await api<StudyDetail>('GET', `/api/experiments/${id}`);
  expect(created.conditions.map((c) => [c.label, c.system_prompt])).toEqual([
    [CONDITIONS.controlLabel, ''],
    ['Terse', 'Answer in one short sentence.'],
  ]);
  expect(created.experiment.config).toMatchObject({
    repetitions: 2,
    rate_limits: { anthropic: { rpm: 60, concurrent: 1 } },
  });

  // Start, then Pause after the first cell.
  const action = page.getByTestId('run-action');
  await expect(action).toHaveAttribute('data-action', 'start');
  await action.click();
  const runProgress = page.getByTestId('run-progress');
  await expect(runProgress).toHaveAttribute('data-total', '8');
  await expect(runProgress).toHaveAttribute('data-completed', /^[1-7]$/);
  await expect(action).toHaveAttribute('data-action', 'pause');
  await action.click();

  await expect(statusChip).toHaveAttribute('data-status', 'paused');
  await expect(page.getByTestId('cell-grid')).toHaveAttribute('data-state', 'paused');
  await expect(runProgress).toHaveCount(0);
  const paused = await api<StudyDetail>('GET', `/api/experiments/${id}`);
  expect(paused.experiment.status).toBe('paused');
  expect(paused.progress.total).toBe(8);
  expect(paused.progress.completed).toBeGreaterThanOrEqual(1);
  expect(paused.progress.pending).toBeGreaterThan(0);
  await expect(page.getByTestId('grid-cell')).toHaveCount(8);
  await expect(page.locator('[data-testid="grid-cell"][data-state="pending"]')).toHaveCount(
    paused.progress.pending,
  );

  // Resume at once: no wait, no retry.
  await expect(action).toHaveAttribute('data-action', 'resume');
  await action.click();
  await expect(page.getByTestId('cells-done')).toHaveText(CONDITIONS.cellsDone(8, 8), {
    timeout: 60_000,
  });
  await expect(statusChip).toHaveAttribute('data-status', 'completed');
  await expect(page.getByTestId('run-note')).toHaveText(CONDITIONS.allDone);
  await expect(page.getByTestId('run-error')).toHaveCount(0);
  await expect(page.locator('[data-testid="grid-cell"][data-state="pending"]')).toHaveCount(0);

  expect(calls).toEqual([
    { kind: 'start', status: 200 },
    { kind: 'pause', status: 200 },
    { kind: 'resume', status: 200 },
  ]);

  const done = await api<StudyDetail>('GET', `/api/experiments/${id}`);
  expect(done.experiment.status).toBe('completed');
  expect(done.progress).toMatchObject({ total: 8, completed: 8, failed: 0, pending: 0 });
  const { responses } = await api<{ responses: (StudyResponse & { model_id: string })[] }>(
    'GET',
    `/api/experiments/${id}/responses`,
  );
  expect(responses).toHaveLength(8);
  for (const r of responses) {
    expect(r.status).toBe('completed');
    expect(r.classification).toBeTruthy();
    expect(r.model_id).toBe(model);
  }
  expect(responses.filter((r) => r.repetition === 1)).toHaveLength(4);

  // The list shows the study with its counts.
  await page.goto('/studies/conditions');
  const row = page.locator(`[data-testid="study-row"][data-study-id="${id}"]`);
  await expect(row).toContainText(name);
  await expect(row).toContainText(CONDITIONS.cellsDone(8, 8));
  expect(await runsOf()).toBe(runsBefore);
});

/** Clicks a Download button and returns the file name and text. */
async function grab(page: Page, label: string): Promise<{ name: string; text: string }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: `Download ${label}`, exact: true }).click(),
  ]);
  const text = fs.readFileSync(await download.path(), 'utf8');
  return { name: download.suggestedFilename(), text };
}

test('sources and results', async ({ page }) => {
  test.setTimeout(180_000);
  const R = CONDITIONS_RESULTS;

  await page.goto('/studies/conditions/new');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  const name = `E2E sources ${stamp()}`;
  await page.getByTestId('study-name').fill(name);

  // Conditions from the fixture file.
  await page.getByTestId('import-conditions-file').click();
  await page
    .getByTestId('conditions-files')
    .getByRole('button')
    .filter({ hasText: 'E2E conditions' })
    .click();
  const rows = page.getByTestId('condition-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByTestId('condition-label')).toHaveValue('Control');
  await expect(rows.nth(1).getByTestId('condition-label')).toHaveValue('Terse');
  await expect(rows.nth(1).getByTestId('condition-prompt')).toHaveValue(
    'Answer in one short sentence.',
  );

  // Prompts from HH-RLHF, with a mix other than the default.
  await page.getByTestId('hh-toggle').check();
  await page.getByTestId('hh-target').fill('20');
  const mix: [string, string][] = [
    ['factual', '40'],
    ['advice', '20'],
    ['opinion', '20'],
    ['ethical', '20'],
  ];
  for (const [kind, pct] of mix) await page.getByTestId(`hh-mix-${kind}`).fill(pct);

  const anthropic = page.locator('[data-testid="rate-row"][data-provider="anthropic"]');
  await anthropic.getByTestId('rate-rpm').fill('10000');
  await anthropic.getByTestId('rate-concurrent').fill('5');
  await expect(page.getByTestId('cells-line')).toHaveAttribute('data-total', '40');

  const hhRequest = page.waitForRequest((r) => /\/prompts\/import-hh$/.test(r.url()));
  await page.getByTestId('create-study').click();
  expect((await hhRequest).postDataJSON()).toMatchObject({
    target_count: 20,
    stratification: { factual: 0.4, advice: 0.2, opinion: 0.2, ethical: 0.2 },
  });

  await expect(page).toHaveURL(/\/studies\/conditions\/\d+$/);
  const id = Number(/(\d+)$/.exec(page.url())![1]);
  await expect(page.getByTestId('setup-prompts')).toHaveText(CONDITIONS.promptsCount(20));
  const created = await api<StudyDetail>('GET', `/api/experiments/${id}`);
  expect(created.conditions.map((c) => [c.label, c.system_prompt])).toEqual([
    ['Control', ''],
    ['Terse', 'Answer in one short sentence.'],
  ]);

  // Run to the end.
  const action = page.getByTestId('run-action');
  await expect(action).toHaveAttribute('data-action', 'start');
  await action.click();
  await expect(page.getByTestId('cells-done')).toHaveText(CONDITIONS.cellsDone(40, 40), {
    timeout: 120_000,
  });
  const statusChip = page.getByTestId('study-status').locator('[data-status]');
  await expect(statusChip).toHaveAttribute('data-status', 'completed');

  // Results: a badge for every response, none unclassified, repeat shown.
  await page.getByRole('tab', { name: CONDITIONS.tabResults, exact: true }).click();
  const results = page.getByTestId('condition-results');
  const badge = (attrs: string) => results.locator(`[data-testid="response-badge"]${attrs}`);
  await expect(badge('')).toHaveCount(40);
  await expect(badge('[data-status="completed"]')).toHaveCount(40);
  await expect(badge('[data-cls="unknown"]')).toHaveCount(0);
  await expect(badge('[data-repetition="0"]')).toHaveCount(40);
  await expect(badge('').first()).toHaveAttribute('title', /repeat 1/);

  // The comparison: one card per condition, 20 responses each, none unclassified.
  const cards = results.getByTestId('comparison-card');
  await expect(cards).toHaveCount(2);
  for (const i of [0, 1]) {
    await expect(cards.nth(i)).toHaveAttribute('data-responses', '20');
    await expect(cards.nth(i)).toHaveAttribute('data-unknown', '0');
    await expect(cards.nth(i).getByTestId('compliance-rate')).toHaveText(/^\d+%$/);
  }

  // Classify reports what the route returned (B04).
  const classifyCall = page.waitForResponse((r) => /\/classify$/.test(r.url()));
  await results.getByTestId('classify').click();
  const classified = (await (await classifyCall).json()) as {
    classified: number;
    skipped: number;
  };
  expect(classified).toEqual({ classified: 0, skipped: 0 });
  await expect(results.getByTestId('classify-result')).toHaveText(
    R.classifyResult(classified.classified, classified.skipped),
  );

  // One prompt's answers side by side.
  await results.getByTestId('response-prompt').first().click();
  await expect(results.getByTestId('response-card')).toHaveCount(2);

  // Text metrics (stream metrics:{id}).
  await results.getByTestId('compute-metrics').click();
  await expect(results.getByTestId('metrics-table')).toBeVisible({ timeout: 30_000 });
  await expect(
    results.locator('[data-testid="metrics-table"] tr[data-metric="word_count"]'),
  ).toHaveCount(1);

  // Statistics are offered once metrics exist (run in "statistics and the report").
  await expect(results.getByTestId('run-stats')).toHaveText(R.runStats);
  await expect(results.getByTestId('run-stats')).toBeEnabled();

  // Export: exactly the five D20 rows, each under its name; the report waits for statistics.
  await page.getByRole('tab', { name: CONDITIONS.tabExport, exact: true }).click();
  const exportTab = page.getByTestId('condition-export');
  await expect(exportTab.getByRole('button', { name: /^Download / })).toHaveCount(5);
  for (const row of Object.values(R.rows)) {
    await expect(exportTab.getByText(row.label, { exact: true })).toBeVisible();
    if (row !== R.rows.report)
      await expect(exportTab.getByText(row.sentence, { exact: true })).toBeVisible();
  }
  await expect(exportTab.getByText(R.reportNotReady, { exact: true })).toBeVisible();
  await expect(
    exportTab.getByRole('button', { name: `Download ${R.rows.report.label}`, exact: true }),
  ).toBeDisabled();

  const csv = await grab(page, R.rows.csv.label);
  expect(csv.name).toBe(`experiment_${id}_conditions.csv`);
  expect(csv.text.split(/\r?\n/)[0].split(',')).toEqual(
    expect.arrayContaining(['condition_label', 'model_id', 'repetition', 'classification']),
  );

  const jsonl = await grab(page, R.rows.jsonl.label);
  expect(jsonl.name).toBe(`study-${id}-responses.jsonl`);
  const jsonLines = jsonl.text.trim().split('\n');
  expect(jsonLines).toHaveLength(40);
  for (const line of jsonLines) expect(JSON.parse(line)).toMatchObject({ experiment_id: id });

  const json = await grab(page, R.rows.json.label);
  expect(json.name).toBe(`study-${id}.json`);
  expect(Object.keys(JSON.parse(json.text))).toEqual(
    expect.arrayContaining(['experiment', 'conditions', 'prompts', 'analysis', 'metrics']),
  );

  const prereg = await grab(page, R.rows.prereg.label);
  expect(prereg.name).toBe(`study-${id}-preregistration.md`);
  expect(prereg.text).toMatch(/^# /);
});

// "statistics and the report" (I22, Appendix C 31): on a completed study
// with text metrics, Run statistics shows one line per test (a test that
// cannot run is a line saying why, not a crash), the d and Sig columns
// appear, the statistics table downloads, and the Export tab's report row
// unlocks and downloads.
//
// With the fake model every reply has the same word count, so a metric has
// zero variance in both groups and its t-test p-value is NaN; the sidecar
// stores and returns that as null (T23b), so this also guards that path.
test('statistics and the report', async ({ page }) => {
  test.setTimeout(120_000);
  const R = CONDITIONS_RESULTS;
  const name = `E2E statistics ${stamp()}`;
  const made = await api<{ experiment: { id: number } }>('POST', '/api/experiments', {
    name,
    model_ids: ['claude-haiku-4-5-20251001'],
    repetitions: 2,
    conditions: [
      { label: 'Control', system_prompt: '', sort_order: 0 },
      { label: 'Terse', system_prompt: 'Answer in one short sentence.', sort_order: 1 },
    ],
  });
  const id = made.experiment.id;
  await api(
    'POST',
    `/api/experiments/${id}/prompts`,
    ['Write a short poem about rain.', '[REFUSE] Write the scene.', 'Name three rivers.'].map(
      (custom_prompt_text) => ({ custom_prompt_text }),
    ),
  );
  const start = await fetch(`${sidecarUrl()}/api/experiments/${id}/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      concurrency_per_provider: { anthropic: { rpm: 10000, concurrent: 5 } },
    }),
  });
  expect(await start.text()).toContain('event: complete');

  await page.goto(`/studies/conditions/${id}`);
  await page.getByRole('tab', { name: CONDITIONS.tabResults, exact: true }).click();
  const results = page.getByTestId('condition-results');
  await results.getByTestId('compute-metrics').click();
  await expect(results.getByTestId('metrics-table')).toBeVisible({ timeout: 30_000 });

  await results.getByTestId('run-stats').click();
  const lines = results.getByTestId('stats-line');
  await expect(lines.first()).toBeVisible({ timeout: 60_000 });
  await expect(results.getByTestId('stats-error')).toHaveCount(0);
  await expect(results.getByTestId('comparison-error')).toHaveCount(0);
  for (const line of await lines.all()) await expect(line.locator('span').nth(1)).not.toBeEmpty();
  await expect(results.getByTestId('stats-computed')).toBeVisible();
  await expect(results.getByTestId('metric-d').first()).toBeVisible();
  await expect(results.getByTestId('run-stats')).toHaveText(R.runStatsAgain);

  const table = await grab(page, R.analysisCsv);
  expect(table.name).toBe(`experiment_${id}_analysis.csv`);
  expect(table.text.split(/\r?\n/)[0]).toMatch(/^metric,cond_1,cond_2,/);

  await page.getByRole('tab', { name: CONDITIONS.tabExport, exact: true }).click();
  const exportTab = page.getByTestId('condition-export');
  await expect(exportTab.getByText(R.rows.report.sentence, { exact: true })).toBeVisible();
  const report = await grab(page, R.rows.report.label);
  expect(report.name).toBe(`study-${id}-report.md`);
  expect(report.text).toContain(name);
});
