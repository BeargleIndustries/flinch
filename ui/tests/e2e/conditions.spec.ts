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
// T23 adds "sources and results" (HH-RLHF against the fake /rows, Import
// from a file, Results, JSONL).
import { expect, test } from '@playwright/test';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { CONDITIONS } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, readSeed } from './helpers';

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
