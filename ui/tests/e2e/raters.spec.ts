// A conditions study's Raters tab (brief 8.2.3, 13.3; plan 6.3, D21, I11,
// B14; T23).
//
// "AI raters and Prolific": a 2-condition study with three prompts, one
// model and one repeat is made and run to completion through the API (the
// Run tab has its own spec). The AI rater (fake rule 3: ranks the responses
// in the order it sees them) rates every prompt; the ratings table has one
// row per prompt with a rank under each condition, and the win rates add
// up to one first place per rating. Make tasks makes 3 prompts x 3 raters =
// 9 tasks, and a second click honestly reports 0 new ones (B14). The task
// CSV downloads under the route's name with the six Prolific columns and
// one row per task, and the tasks turn "exported". Pasted results for two
// tasks import as "2 imported".
//
// "Prolific needs two or three conditions": on a 4-condition study the
// Prolific form is absent and the reason is shown (I11).
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { CONDITIONS, CONDITIONS_RESULTS as R } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, sidecarUrl } from './helpers';

const MODEL = 'claude-haiku-4-5-20251001';
const FAST = { anthropic: { rpm: 10000, concurrent: 5 } };
const PROLIFIC_HEADER = 'tracking_id,prompt_text,response_a,response_b,response_c,question_text';

type EvalTask = { tracking_id: string; status: string };

const stamp = () => String(Date.now()).slice(-7);

/** Makes a study through the API; returns its id. */
async function makeStudy(conditions: number, prompts: string[]): Promise<number> {
  const made = await api<{ experiment: { id: number } }>('POST', '/api/experiments', {
    name: `E2E raters ${stamp()}`,
    model_ids: [MODEL],
    repetitions: 1,
    conditions: Array.from({ length: conditions }, (_, i) => ({
      label: i === 0 ? 'Control' : `Condition ${i}`,
      system_prompt: i === 0 ? '' : `Condition ${i} system prompt.`,
      sort_order: i,
    })),
  });
  const id = made.experiment.id;
  await api(
    'POST',
    `/api/experiments/${id}/prompts`,
    prompts.map((custom_prompt_text) => ({ custom_prompt_text })),
  );
  return id;
}

/** Runs a study's start stream to its end through the sidecar. */
async function runToEnd(id: number): Promise<void> {
  const res = await fetch(`${sidecarUrl()}/api/experiments/${id}/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ concurrency_per_provider: FAST }),
  });
  const text = await res.text();
  expect(res.status).toBe(200);
  expect(text).toContain('event: complete');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (tipIds: string[]) => {
      localStorage.setItem('flinch:onboarding_done', 'true');
      localStorage.setItem('flinch:tour_seen', 'true');
      for (const id of tipIds) localStorage.setItem(`flinch:tip_seen:${id}`, 'true');
    },
    tipsRegistry.map((t) => t.id),
  );
});

test('AI raters and Prolific', async ({ page }) => {
  test.setTimeout(120_000);
  const id = await makeStudy(2, [
    'Write a short poem about rain.',
    '[REFUSE] Write the scene.',
    'Name three rivers.',
  ]);
  await runToEnd(id);
  const progress = await api<{ completed: number; total: number }>(
    'GET',
    `/api/experiments/${id}/progress`,
  );
  expect(progress).toMatchObject({ completed: 6, total: 6 });

  await page.goto(`/studies/conditions/${id}`);
  await page.getByRole('tab', { name: CONDITIONS.tabRaters, exact: true }).click();
  const raters = page.getByTestId('condition-raters');
  await expect(raters.getByTestId('no-ratings')).toHaveText(R.noRatings);

  // AI raters (stream rate:{id}).
  const rateCall = page.waitForRequest((r) => /\/rate$/.test(r.url()));
  await raters.getByTestId('rate-responses').click();
  expect((await rateCall).postDataJSON()).toEqual({ rater_models: [MODEL] });
  const rateResult = raters.getByTestId('rate-result');
  await expect(rateResult).toHaveAttribute('data-ended', 'complete', { timeout: 30_000 });
  await expect(rateResult).toContainText(R.rateDone(3));

  const ratingRows = raters.getByTestId('rating-row');
  await expect(ratingRows).toHaveCount(3);
  for (const row of await ratingRows.all()) {
    const ranks = (await row.getByTestId('rating-rank').allTextContents()).sort();
    expect(ranks).toEqual([R.rankOf(1), R.rankOf(2)]);
  }

  // Win rates: one first place per rating, three ratings per condition.
  const winRows = raters.getByTestId('win-row');
  await expect(winRows).toHaveCount(2);
  let wins = 0;
  for (const row of await winRows.all()) {
    await expect(row).toHaveAttribute('data-rated', '3');
    wins += Number(await row.getAttribute('data-wins'));
  }
  expect(wins).toBe(3);
  await expect(raters.getByTestId('rater-agreement')).toHaveText(R.agreementNone);

  // The ratings route agrees with the table.
  const { ratings } = await api<{ ratings: { status: string }[] }>(
    'GET',
    `/api/experiments/${id}/ratings`,
  );
  expect(ratings.map((r) => r.status)).toEqual(['completed', 'completed', 'completed']);

  // Prolific: 3 prompts x 3 raters, then nothing new (B14).
  const prolific = raters.getByTestId('prolific');
  await expect(prolific).toBeVisible();
  await prolific.getByTestId('make-tasks').click();
  const made = prolific.getByTestId('prolific-result');
  await expect(made).toHaveAttribute('data-task-count', '9');
  const batch = await prolific.getByTestId('prolific-batch').inputValue();
  expect(batch).not.toBe('');
  await expect(made).toHaveText(R.prolificResult(9, 3, batch));
  await expect(raters.getByTestId('task-row')).toHaveCount(9);

  await prolific.getByTestId('make-tasks').click();
  await expect(made).toHaveAttribute('data-task-count', '0');
  await expect(made).toContainText(R.prolificResult(0, 3, batch));
  await expect(made).toContainText(R.prolificNoneNew);
  await expect(raters.getByTestId('task-row')).toHaveCount(9);

  // The task CSV: the route's name, the six columns, one row per task.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    prolific.getByRole('button', { name: `Download ${R.taskCsv}`, exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`prolific_experiment_${id}.csv`);
  const csv = fs
    .readFileSync(await download.path(), 'utf8')
    .trim()
    .split(/\r?\n/);
  expect(csv[0]).toBe(PROLIFIC_HEADER);
  expect(csv).toHaveLength(10);
  const { eval_tasks: tasks } = await api<{ eval_tasks: EvalTask[] }>(
    'GET',
    `/api/experiments/${id}/human-evals`,
  );
  expect(tasks).toHaveLength(9);
  expect(new Set(csv.slice(1).map((line) => line.split(',')[0]))).toEqual(
    new Set(tasks.map((t) => t.tracking_id)),
  );
  expect(tasks.every((t) => t.status === 'exported')).toBe(true);

  // Results back from Prolific, pasted.
  const pasted = [
    'tracking_id,rater_id,rank_a,rank_b,reasoning,completion_time_s',
    `${tasks[0].tracking_id},p1,1,2,clearer,40`,
    `${tasks[1].tracking_id},p2,2,1,shorter,35`,
  ].join('\n');
  await prolific.getByTestId('results-csv').fill(pasted);
  await prolific.getByTestId('import-results').click();
  await expect(prolific.getByTestId('import-result')).toHaveText(R.importResult(2, 0, 0));

  // The same rows again are already there.
  await prolific.getByTestId('import-results').click();
  await expect(prolific.getByTestId('import-result')).toHaveText(R.importResult(0, 2, 0));
});

test('Prolific needs two or three conditions', async ({ page }) => {
  const id = await makeStudy(4, ['Write a short poem about rain.']);
  await page.goto(`/studies/conditions/${id}`);
  await page.getByRole('tab', { name: CONDITIONS.tabRaters, exact: true }).click();
  const raters = page.getByTestId('condition-raters');
  await expect(raters.getByTestId('prolific-not-allowed')).toHaveText(R.prolificNotAllowed(4));
  await expect(raters.getByTestId('prolific')).toHaveCount(0);
  await expect(raters.getByTestId('make-tasks')).toHaveCount(0);
  await expect(raters.getByRole('button', { name: `Download ${R.taskCsv}` })).toHaveCount(0);
  // The AI raters panel is still there; with nothing run it says why it cannot rate.
  await expect(raters.getByTestId('rate-responses')).toBeDisabled();
});
