// Baselines (brief 8.6, 7.1 and 13.3, plan 6.3, D16, Appendix C item 39, T28).
//
// The fake target (tests/fake_models.py) refuses "[REFUSE]" prompts on the
// first turn and complies after that, so refuse-me is Refused when sent and
// Collapsed after one pushback. A baseline saved before the pushback holds
// Refused, one saved after holds Collapsed: comparing them (or the first with
// now) is one changed row, which the sidecar's ranking calls regressed.
// The diff route returns only changed_count and unchanged_count; the
// improved and regressed counts are the app's own, from changes[].status.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ERROR_COPY } from '../../src/lib/copy/errors-copy';
import { PROBE } from '../../src/lib/copy/probe';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { BASELINES, SAVE_BASELINE } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, sendProbe, sidecarUrl, type Session } from './helpers';

type Summary = { id: number; name: string; description: string };
type Diff = {
  changes: {
    probe_name: string;
    old_classification: string;
    new_classification: string;
    status: string;
  }[];
  changed_count: number;
  unchanged_count: number;
};
type FullRun = { id: number; initial_classification: string; final_classification: string | null };

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

async function newSession(label: string): Promise<Session> {
  const seed = readSeed();
  return createSession(`${label} ${stamp()}`, [seed.probes.refuseMe, seed.probes.answerMe]);
}

/** Opens `path` with `sess` as the stored current session and waits for the shell. */
async function openIn(page: Page, sess: Session, path: string): Promise<void> {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, sess.id);
  await page.goto(path);
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('session-switcher')).toContainText(sess.name);
}

/** Opens Baselines for `sess` and waits for its list to be read. */
async function openBaselines(page: Page, sess: Session): Promise<void> {
  await openIn(page, sess, '/studies/baselines');
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.baselines);
  await expect(page.getByTestId('baselines-list')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('save-baseline')).toBeEnabled();
}

const dialog = (page: Page) => page.getByTestId('save-baseline-dialog');
const baselineRow = (page: Page, name: string) =>
  page.locator(`[data-testid="baseline-row"][data-baseline-name="${name}"]`);

/** Saves a baseline through the dialog opened by `opener`; returns its row. */
async function saveThrough(page: Page, opener: Locator, name: string, description = '') {
  await opener.click();
  await expect(dialog(page)).toBeVisible();
  const submit = page.getByTestId('save-baseline-submit');
  await expect(submit).toBeDisabled();
  await page.getByTestId('baseline-name').fill(name);
  if (description) await page.getByTestId('baseline-description').fill(description);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(dialog(page)).toBeHidden();
}

async function listOf(sess: Session): Promise<Summary[]> {
  return api<Summary[]>('GET', `/api/sessions/${sess.id}/snapshots`);
}

/** Asserts the diff on screen: one changed row, Refused then Collapsed, regressed. */
async function expectOneRegressed(page: Page, after: string): Promise<void> {
  const diff = page.getByTestId('baseline-diff');
  await expect(diff).toHaveAttribute('data-after', after);
  await expect(diff).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('diff-summary')).toHaveText(BASELINES.summary(1, 0));
  const counts = { improved: 0, regressed: 1, changed: 0, unchanged: 0 };
  for (const [status, n] of Object.entries(counts))
    await expect(diff.locator(`[data-testid="diff-count"][data-status="${status}"] dd`)).toHaveText(
      String(n),
    );
  await expect(diff).toContainText(SCREENS['baselines.diff'](counts));
  const rows = diff.getByTestId('diff-row');
  await expect(rows).toHaveCount(1);
  const row = rows.first();
  await expect(row).toHaveAttribute('data-probe-name', 'refuse-me');
  await expect(row).toHaveAttribute('data-old', 'refused');
  await expect(row).toHaveAttribute('data-new', 'collapsed');
  await expect(row).toHaveAttribute('data-status', 'regressed');
  await expect(row.getByTestId('diff-old')).toContainText('Refused');
  await expect(row.getByTestId('diff-new')).toContainText('Collapsed');
  await expect(row.getByTestId('diff-status')).toHaveText(BASELINES.regressed);
}

test('save a baseline, change the badge in Probe, save another, compare both ways, delete', async ({
  page,
}) => {
  const seed = readSeed();
  const sess = await newSession('Baselines');
  const run = await sendProbe(sess.id, seed.probes.refuseMe);
  expect(run.initial_classification).toBe('refused');

  // An empty list, then baseline A through the dialog.
  await openBaselines(page, sess);
  await expect(page.getByTestId('baselines-empty')).toContainText(BASELINES.emptyTitle);
  await expect(page.getByTestId('compare-problem')).toHaveText(BASELINES.needTwo);
  await saveThrough(
    page,
    page.getByTestId('save-baseline'),
    'Before A',
    'Fake target, no pushback',
  );
  const rowA = baselineRow(page, 'Before A');
  await expect(rowA).toBeVisible();
  await expect(rowA).toContainText('Fake target, no pushback');
  await expect(rowA).toContainText(BASELINES.probeCount(1));
  await expect(
    rowA.locator('[data-testid="baseline-tally"] [data-tally-cls="refused"]'),
  ).toContainText(BASELINES.tallyCount(1));
  const [a] = await listOf(sess);
  expect(a.name).toBe('Before A');
  expect(a.description).toBe('Fake target, no pushback');

  // Show saved results: the baseline's own row.
  await rowA.getByTestId('baseline-show').click();
  const saved = rowA.getByTestId('baseline-saved-row');
  await expect(saved).toHaveCount(1);
  await expect(saved).toContainText('refuse-me');
  await expect(saved).toContainText('Refused');
  await rowA.getByTestId('baseline-show').click();
  await expect(rowA.getByTestId('baseline-saved-rows')).toBeHidden();

  // Back in Probe, the saved run opens in pushback; the coach's pushback collapses it.
  await page.goto(`/probe/runs/${run.id}`);
  const workspace = page.getByTestId('probe-workspace');
  await expect(workspace).toHaveAttribute('data-phase', 'pushback');
  await page.getByRole('button', { name: PROBE.sendPushback }).click();
  await expect(workspace).toHaveAttribute('data-phase', 'done');
  await expect(page.getByTestId('turn-card').last()).toHaveAttribute('data-cls', 'collapsed');
  const runs = (await api<{ runs: FullRun[] }>('GET', `/api/sessions/${sess.id}`)).runs;
  expect(runs.map((r) => r.final_classification)).toEqual(['collapsed']);

  // Baseline B holds the new badge.
  await openBaselines(page, sess);
  await saveThrough(page, page.getByTestId('save-baseline'), 'After B');
  const rowB = baselineRow(page, 'After B');
  await expect(
    rowB.locator('[data-testid="baseline-tally"] [data-tally-cls="collapsed"]'),
  ).toContainText(BASELINES.tallyCount(1));
  const listed = await listOf(sess);
  expect(listed.map((b) => b.name)).toEqual(['After B', 'Before A']);
  const b = listed[0];
  // Newest first, in the list and in the form.
  await expect(page.getByTestId('baseline-row').first()).toHaveAttribute(
    'data-baseline-name',
    'After B',
  );

  // A against B, worked out in the app from the two saved results.
  await page.getByTestId('compare-before').selectOption(String(a.id));
  await page.getByTestId('compare-after').selectOption(String(b.id));
  await page.getByTestId('compare-run').click();
  await expect(page.getByTestId('baseline-diff')).toHaveAttribute('data-before', String(a.id));
  await expectOneRegressed(page, String(b.id));

  // The same pair on both sides is refused before any request.
  await page.getByTestId('compare-after').selectOption(String(a.id));
  await expect(page.getByTestId('compare-problem')).toHaveText(BASELINES.sameBaseline);
  await expect(page.getByTestId('compare-run')).toBeDisabled();

  // A against now: the sidecar's diff, the same result.
  const diffRead = page.waitForResponse(
    (r) => new URL(r.url()).pathname === `/api/snapshots/${a.id}/diff`,
  );
  await rowA.getByTestId('baseline-compare-now').click();
  expect((await diffRead).ok()).toBe(true);
  await expectOneRegressed(page, 'now');
  const fromApi = await api<Diff>('GET', `/api/snapshots/${a.id}/diff?session_id=${sess.id}`);
  expect(fromApi.changed_count).toBe(1);
  expect(fromApi.unchanged_count).toBe(0);
  expect(fromApi.changes.map((c) => c.status)).toEqual(['regressed']);

  // B against now: nothing changed since B was saved.
  await rowB.getByTestId('baseline-compare-now').click();
  await expect(page.getByTestId('baseline-diff')).toHaveAttribute('data-before', String(b.id));
  await expect(page.getByTestId('diff-summary')).toHaveText(BASELINES.summary(0, 1));
  await expect(page.getByTestId('diff-row')).toHaveAttribute('data-status', 'unchanged');

  // Delete B: a two-step button; the diff that used it closes.
  await rowB.getByRole('button', { name: BASELINES.remove }).click();
  await rowB.getByRole('button', { name: BASELINES.removeConfirm }).click();
  await expect(rowB).toHaveCount(0);
  await expect(page.getByTestId('baseline-diff')).toHaveCount(0);
  expect((await listOf(sess)).map((x) => x.id)).toEqual([a.id]);
  const gone = await fetch(`${sidecarUrl()}/api/snapshots/${b.id}`);
  expect(gone.status).toBe(404);
  await expect(baselineRow(page, 'Before A')).toBeVisible();
});

test('the Probe idle panel opens the dialog: cancel, the no-runs message, then a save', async ({
  page,
}) => {
  const seed = readSeed();
  const sess = await newSession('Baseline idle');
  await openIn(page, sess, '/probe');
  await expect(page.getByTestId('probe-idle')).toBeVisible();
  const opener = page.getByTestId('probe-save-baseline');
  await expect(page.getByTestId('probe-compare-baseline')).toHaveCount(0);

  // Open, the name has focus, Cancel closes with nothing saved.
  await opener.click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(SAVE_BASELINE.title);
  await expect(page.getByTestId('baseline-name')).toBeFocused();
  await page.getByRole('button', { name: SAVE_BASELINE.cancel }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(opener).toBeFocused();

  // No runs yet: the sidecar's 400 shows in plain words and the dialog stays.
  await opener.click();
  await page.getByTestId('baseline-name').fill('Too early');
  await page.getByTestId('save-baseline-submit').click();
  await expect(page.getByTestId('save-baseline-error')).toHaveText(ERROR_COPY.noRunsForBaseline);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  expect(await listOf(sess)).toEqual([]);

  // After a run, Enter in the name saves, and the panel offers the comparison.
  await sendProbe(sess.id, seed.probes.answerMe);
  await opener.click();
  await page.getByTestId('baseline-name').fill('From Probe');
  await page.getByTestId('baseline-name').press('Enter');
  await expect(dialog(page)).toBeHidden();
  expect((await listOf(sess)).map((x) => x.name)).toEqual(['From Probe']);
  const compareLink = page.getByTestId('probe-compare-baseline');
  await expect(compareLink).toHaveText(PROBE.baselineCompare);
  await compareLink.click();
  await expect(page).toHaveURL(/\/studies\/baselines$/);
  await expect(baselineRow(page, 'From Probe')).toBeVisible();
});
