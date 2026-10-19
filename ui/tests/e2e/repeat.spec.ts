// Repeat runs (brief 8.3 and 13.3, plan 6.3, B15, B16, I17, T24).
//
// Each test runs in a fresh session holding the two seeded probes, so its
// list starts empty. refuse-me ("[REFUSE] ...") is refused on every fresh
// conversation by the fake model (tests/fake_models.py rule 6) and answer-me
// is answered, so 3 calls of the first give 3 Refused and 2 of the second
// give 2 Complied. The run goes through POST /api/sessions/{id}/stat-run
// (stream `statrun:{sessionId}`); the API check confirms the stat run used
// the session's model (I17). Reloading the page and picking the run reads its
// distribution again (GET /api/stat-runs/{id}/distribution).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { REPEAT } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, type Session } from './helpers';

type StatSummary = { stat_run_id: number; probe_name: string; total: number; status: string };
type StatRunDetail = {
  id: number;
  session_id: number;
  target_model: string;
  status: string;
  iterations: { iteration_num: number; classification: string; latency_ms: number | null }[];
};
type SessionDetail = { id: number; target_model: string };

/** A short unique suffix for session names. */
const stamp = () => String(Date.now()).slice(-7);

/** Today as the local "YYYY-MM-DD" (repeat.ts localDay; that module uses $lib imports). */
const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "812 ms" or "1.4 s" (repeat.ts latencyLabel). */
const LATENCY = /^\d+ ms$|^\d+(\.\d)? s$/;

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

async function freshSession(): Promise<Session> {
  const seed = readSeed();
  return createSession(`E2E repeat ${stamp()}`, [seed.probes.refuseMe, seed.probes.answerMe]);
}

/** Opens /studies/repeat on `sessionId` and waits for its (empty or not) run list. */
async function openRepeat(page: Page, sessionId: number): Promise<void> {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, sessionId);
  const listed = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sessions/${sessionId}/stat-runs`),
  );
  await page.goto('/studies/repeat');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await listed;
}

const probeBox = (setup: Locator, name: string) =>
  setup.getByRole('checkbox', { name: new RegExp(`^${name}\\b`) });

/** Picks exactly `name` in Set up, sets N, runs, and waits for the live panel to finish. */
async function runOne(page: Page, sessionId: number, name: string, n: number): Promise<void> {
  const setup = page.getByTestId('repeat-setup');
  for (const other of ['refuse-me', 'answer-me'])
    if (other !== name) await probeBox(setup, other).uncheck();
  await probeBox(setup, name).check();
  await setup.getByTestId('repeat-times').fill(String(n));
  await expect(setup.getByTestId('repeat-plan')).toHaveText(REPEAT.plan(1, n));

  const started = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/sessions/${sessionId}/stat-run`) && r.request().method() === 'POST',
  );
  await setup.getByRole('button', { name: REPEAT.runSelected, exact: true }).click();
  expect((await started).status()).toBe(200);

  const live = page.getByTestId('repeat-live');
  await expect(live).toHaveAttribute('data-state', 'finished', { timeout: 30_000 });
  await expect(live.getByTestId('repeat-live-row')).toHaveCount(1);
  await expect(live.getByTestId('tape-slot')).toHaveCount(n);
}

/** The distribution panel shows `count` of `cls` at 100%. */
async function expectAll(page: Page, cls: string, count: number): Promise<void> {
  const dist = page.getByTestId('repeat-distribution');
  await expect(dist).toHaveAttribute('data-total', String(count));
  const row = dist.locator(`[data-testid="dist-row"][data-cls="${cls}"]`);
  await expect(row.getByTestId('dist-count')).toHaveText(String(count));
  await expect(row.getByTestId('dist-pct')).toHaveText('100%');
  await expect(dist.getByTestId('dist-headline')).toHaveText('100%');
  // Every other badge is at 0.
  for (const other of await dist.getByTestId('dist-row').all()) {
    if ((await other.getAttribute('data-cls')) === cls) continue;
    await expect(other.getByTestId('dist-count')).toHaveText('0');
  }
}

test('opens with its research question and an empty list in a fresh session', async ({ page }) => {
  const sess = await freshSession();
  await openRepeat(page, sess.id);
  await expect(page.getByTestId('repeat-screen').getByRole('heading', { level: 1 })).toHaveText(
    REPEAT.title,
  );
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.repeat);
  await expect(page.getByTestId('repeat-empty')).toContainText(REPEAT.empty);

  // Nothing picked yet: Run selected waits; the session's two probes are listed.
  const setup = page.getByTestId('repeat-setup');
  await expect(setup.getByTestId('repeat-run')).toBeDisabled();
  await expect(setup.getByTestId('repeat-plan')).toHaveText(REPEAT.pickFirst);
  await expect(setup.getByTestId('repeat-run-every')).toHaveText(REPEAT.runEvery(2));
});

test('refuse-me × 3 gives 3 Refused, survives a reload, and answer-me × 2 lands newest first', async ({
  page,
}) => {
  const sess = await freshSession();
  await openRepeat(page, sess.id);

  // First run: refuse-me, N = 3.
  await runOne(page, sess.id, 'refuse-me', 3);
  await expect(
    page.getByTestId('repeat-live').locator('[data-testid="tape-slot"][data-cls="refused"]'),
  ).toHaveCount(3);
  await expectAll(page, 'refused', 3);

  const iterations = page.getByTestId('repeat-iteration');
  await expect(iterations).toHaveCount(3);
  for (const row of await iterations.all()) {
    await expect(row).toHaveAttribute('data-cls', 'refused');
    await expect(row.getByTestId('iteration-latency')).toHaveText(LATENCY);
  }
  // The expander shows the whole response.
  const first = iterations.first();
  await first.getByTestId('iteration-toggle').click();
  await expect(first.getByTestId('iteration-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(first.getByTestId('iteration-text')).not.toBeEmpty();

  const summaries = page.getByTestId('repeat-summary');
  await expect(summaries).toHaveCount(1);
  const row1 = summaries.first();
  await expect(row1).toHaveAttribute('data-status', 'completed');
  await expect(row1).toContainText('Completed');
  await expect(row1).toContainText('refuse-me');
  await expect(row1.getByTestId('summary-date')).toHaveText(today());
  await expect(row1.getByTestId('summary-n')).toHaveText(REPEAT.nCalls(3));
  await expect(row1.getByTestId('summary-refused')).toHaveText(REPEAT.refusedOf(3, 3, '100%'));
  await expect(row1).toHaveAttribute('aria-pressed', 'true');

  // Through the API: 3 iterations on the session's model (I17).
  const listed = await api<StatSummary[]>('GET', `/api/sessions/${sess.id}/stat-runs`);
  expect(listed).toHaveLength(1);
  const firstId = listed[0].stat_run_id;
  await expect(row1).toHaveAttribute('data-stat-run-id', String(firstId));
  const detail = await api<StatRunDetail>('GET', `/api/stat-runs/${firstId}`);
  const session = await api<SessionDetail>('GET', `/api/sessions/${sess.id}`);
  expect(detail.session_id).toBe(sess.id);
  expect(detail.iterations).toHaveLength(3);
  expect(detail.iterations.map((i) => i.classification)).toEqual(['refused', 'refused', 'refused']);
  expect(detail.target_model).toBe(session.target_model);
  expect(detail.status).toBe('complete');

  // Reload, then pick the run: its distribution is read again.
  const relisted = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sessions/${sess.id}/stat-runs`),
  );
  await page.reload();
  await relisted;
  await expect(page.getByTestId('repeat-live')).toHaveCount(0);
  const reread = page.waitForResponse((r) =>
    r.url().endsWith(`/api/stat-runs/${firstId}/distribution`),
  );
  await page.getByTestId('repeat-summary').first().click();
  expect((await reread).status()).toBe(200);
  await expect(page.getByTestId('repeat-detail')).toHaveAttribute(
    'data-stat-run-id',
    String(firstId),
  );
  await expectAll(page, 'refused', 3);
  await expect(page.getByTestId('repeat-iteration')).toHaveCount(3);

  // Second run: answer-me, N = 2, gives 2 Complied and lands first in the list.
  await runOne(page, sess.id, 'answer-me', 2);
  await expectAll(page, 'complied', 2);
  await expect(page.getByTestId('repeat-iteration')).toHaveCount(2);
  await expect(summaries).toHaveCount(2);
  await expect(summaries.nth(0)).toContainText('answer-me');
  await expect(summaries.nth(0).getByTestId('summary-n')).toHaveText(REPEAT.nCalls(2));
  await expect(summaries.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(summaries.nth(1)).toContainText('refuse-me');
  await expect(summaries.nth(1)).toHaveAttribute('data-stat-run-id', String(firstId));
  const ids = await summaries.evaluateAll((els) =>
    els.map((e) => Number(e.getAttribute('data-stat-run-id'))),
  );
  expect(ids[0]).toBeGreaterThan(ids[1]);
  await expect(page.getByTestId('repeat-count')).toHaveText(REPEAT.resultsCount(2));
});

test('"Run every probe in this session" runs both probes in one stream', async ({ page }) => {
  const sess = await freshSession();
  await openRepeat(page, sess.id);

  const setup = page.getByTestId('repeat-setup');
  await setup.getByTestId('repeat-times').fill('1');
  await setup.getByRole('button', { name: REPEAT.runEvery(2), exact: true }).click();

  const live = page.getByTestId('repeat-live');
  await expect(live).toHaveAttribute('data-state', 'finished', { timeout: 30_000 });
  const rows = live.getByTestId('repeat-live-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByTestId('tape-slot')).toHaveAttribute('data-cls', 'refused');
  await expect(rows.nth(1).getByTestId('tape-slot')).toHaveAttribute('data-cls', 'complied');

  const summaries = page.getByTestId('repeat-summary');
  await expect(summaries).toHaveCount(2);
  await expect(summaries.nth(0)).toContainText('answer-me');
  await expect(summaries.nth(1)).toContainText('refuse-me');
  const listed = await api<StatSummary[]>('GET', `/api/sessions/${sess.id}/stat-runs`);
  expect(listed.map((s) => [s.probe_name, s.total, s.status])).toEqual([
    ['refuse-me', 1, 'complete'],
    ['answer-me', 1, 'complete'],
  ]);
});
