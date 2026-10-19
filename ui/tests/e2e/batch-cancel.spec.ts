// Run every probe (brief 7.8, 13.3 spec 3; plan 6.3, AC9, R2; T18).
//
// Cancel: three probes carry `[SLOW]`, so the fake target (tests/fake_models.py
// rule 0) takes a second over each. Cancel is clicked once the first row has
// landed and the second probe is in flight. The panel says "Stopped after", the
// cancel POST names the `start` event's batch id, the batch row is `cancelled`,
// and the session's run count stops growing: at most the probe in flight lands
// after Cancel, and the third probe is never sent.
//
// Happy path: two probes, both rows get their badge, "Finished: 2 of 2", and
// Back returns to the idle view.
//
// The sidecar has no route that reads a batch row, so its status is read from
// this run's e2e.db (read-only, WAL) with node:sqlite.
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { CLS_SPEC } from '../../src/lib/cls';
import { PROBE } from '../../src/lib/copy/probe';
import { SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, ensureProbe, readSeed, tmpDir, type Session } from './helpers';

type SessionDetail = { runs: { id: number; probe_id: number }[] };

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

/** A short unique suffix; the switcher button truncates names at 28 characters. */
const stamp = () => String(Date.now()).slice(-7);

async function openIn(page: Page, sess: Session): Promise<void> {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, sess.id);
  await page.goto('/probe');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('session-switcher')).toContainText(sess.name);
  await expect(page.getByTestId('probe-idle')).toBeVisible();
}

async function runCount(sess: Session): Promise<number> {
  return (await api<SessionDetail>('GET', `/api/sessions/${sess.id}`)).runs.length;
}

function batchStatus(batchId: number): string | null {
  const db = new DatabaseSync(path.join(tmpDir(), 'e2e.db'), { readOnly: true });
  try {
    const row = db.prepare('SELECT status FROM batch_runs WHERE id = ?').get(batchId) as
      | { status: string }
      | undefined;
    return row?.status ?? null;
  } finally {
    db.close();
  }
}

async function startBatch(page: Page, count: number, delayMs: number): Promise<void> {
  await page.getByLabel(PROBE.runAllDelay).fill(String(delayMs));
  await page.getByRole('button', { name: PROBE.runAll(count), exact: true }).click();
  await expect(page.getByTestId('batch-run')).toBeVisible();
}

const panel = (page: Page) => page.getByTestId('batch-run');
const rows = (page: Page) => panel(page).getByTestId('batch-row');

test('Cancel stops the batch before its next probe', async ({ page }) => {
  const ids: number[] = [];
  for (const i of [1, 2, 3])
    ids.push((await ensureProbe(`batch-slow-${i}`, `[SLOW] Batch question ${i}.`)).id);
  const sess = await createSession(`Batch cancel ${stamp()}`, ids);
  await openIn(page, sess);

  await startBatch(page, 3, 300);
  await expect(panel(page)).toHaveAttribute('data-batch-id', /^\d+$/);
  const batchId = Number(await panel(page).getAttribute('data-batch-id'));
  await expect(rows(page)).toHaveCount(3);
  await expect(page.locator('[data-status-strip]')).toContainText(PROBE.batchTitle);

  // The first row lands; after the 300 ms pause the second probe is in flight
  // (its reply takes at least a second).
  await expect(rows(page).nth(0)).toHaveAttribute('data-state', 'done', { timeout: 20_000 });
  await expect(rows(page).nth(1)).toHaveAttribute('data-state', 'next');
  await page.waitForTimeout(700);
  const atCancel = await runCount(sess);
  expect(atCancel).toBe(1);

  const cancelled = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith(`/api/batch/${batchId}/cancel`),
  );
  await panel(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  const res = await cancelled;
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ cancelled: true });

  await expect(panel(page)).toHaveAttribute('data-state', 'stopped');
  await expect(panel(page).getByRole('heading')).toContainText('Stopped after');
  await expect(rows(page).nth(0)).toHaveAttribute('data-state', 'done');
  await expect(rows(page).nth(2)).toHaveAttribute('data-state', 'skipped');
  await expect(rows(page).nth(2)).toContainText(PROBE.batchNotRun);
  await expect(panel(page).locator('[data-state="cancelled"]')).toHaveCount(1);
  await expect(panel(page).getByTestId('batch-back')).toBeVisible();

  // The batch row says cancelled (B01: the flag, or the closed generator).
  await expect.poll(() => batchStatus(batchId)).toBe('cancelled');

  // The run count stops growing: sampled for 2 s, it never moves, and at most
  // the probe that was in flight landed after Cancel.
  const settled = await runCount(sess);
  const samples: number[] = [];
  const until = Date.now() + 2_000;
  while (Date.now() < until) {
    samples.push(await runCount(sess));
    await page.waitForTimeout(250);
  }
  samples.push(await runCount(sess));
  const guarantee = `runs at Cancel: ${atCancel}; settled: ${settled}; samples over 2 s: ${samples.join(',')}`;
  console.log(`[batch-cancel] ${guarantee}`);
  test.info().annotations.push({
    type: 'cancel-guarantee',
    description: guarantee,
  });
  expect(samples.every((n) => n === settled)).toBe(true);
  expect(settled).toBeLessThanOrEqual(atCancel + 1);
  expect(settled).toBeLessThan(3);
  await expect(page.locator('[data-status-strip]')).not.toContainText(PROBE.batchTitle);
});

test('a batch of two completes with two badges and the summary', async ({ page }) => {
  const seed = readSeed();
  const sess = await createSession(`Batch ${stamp()}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  await openIn(page, sess);

  await startBatch(page, 2, 0);
  await expect(panel(page)).toHaveAttribute('data-state', 'finished', { timeout: 20_000 });
  await expect(panel(page).getByRole('heading')).toHaveText(PROBE.batchFinished(2, 2));

  const refused = panel(page).locator('[data-testid="batch-row"][data-probe-name="refuse-me"]');
  const answered = panel(page).locator('[data-testid="batch-row"][data-probe-name="answer-me"]');
  await expect(refused).toHaveAttribute('data-state', 'done');
  await expect(answered).toHaveAttribute('data-state', 'done');
  await expect(refused.getByTestId('batch-result')).toContainText(CLS_SPEC.refused.word);
  await expect(answered.getByTestId('batch-result')).toContainText(CLS_SPEC.complied.word);
  await expect(panel(page).getByTestId('batch-tally')).toBeVisible();

  // Each row opens its saved run, and both runs are in the session.
  const runs = (await api<SessionDetail>('GET', `/api/sessions/${sess.id}`)).runs;
  expect(runs).toHaveLength(2);
  const refusedRun = runs.find((r) => r.probe_id === seed.probes.refuseMe);
  await expect(refused.getByRole('link')).toHaveAttribute('href', `/probe/runs/${refusedRun?.id}`);

  await panel(page).getByTestId('batch-back').click();
  await expect(page.getByTestId('batch-run')).toHaveCount(0);
  await expect(page.getByTestId('probe-idle')).toBeVisible();
});
