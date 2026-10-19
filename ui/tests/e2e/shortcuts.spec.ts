// Probe keyboard shortcuts (brief 7.10, 13.3 spec 8; D22; plan 6.3 with
// C-M4, T17): S, P, K, N and R in their phases; "s" typed in a textarea
// types; S does nothing while the settings drawer or the shortcuts overlay
// is open; ? opens the overlay and Escape closes it; S on
// /studies/conditions starts no run even with a probe selected.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, type Session } from './helpers';

type FullRun = { id: number; pushback_source: string | null };

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

const stamp = () => String(Date.now()).slice(-7);

/** Long enough for a stray send to have reached the sidecar. */
const SETTLE_MS = 700;

async function newSession(label: string): Promise<Session> {
  const seed = readSeed();
  return createSession(`${label} ${stamp()}`, [seed.probes.refuseMe, seed.probes.answerMe]);
}

async function openIn(page: Page, sess: Session): Promise<void> {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, sess.id);
  await page.goto('/probe');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('session-switcher')).toContainText(sess.name);
}

const rail = (page: Page) => page.getByTestId('probe-rail');
const row = (page: Page, name: string) =>
  rail(page).locator(`[data-testid="probe-row"][data-probe-name="${name}"]`);
const pickButton = (r: Locator) => r.locator('[data-probe-id]');
const workspace = (page: Page) => page.getByTestId('probe-workspace');

async function runsOf(sess: Session): Promise<FullRun[]> {
  return (await api<{ runs: FullRun[] }>('GET', `/api/sessions/${sess.id}`)).runs;
}

test('S sends, P sends the coach draft, R runs again, K skips and N moves on', async ({ page }) => {
  const sess = await newSession('Keys');
  await openIn(page, sess);
  await pickButton(row(page, 'refuse-me')).click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');

  await page.keyboard.press('s');
  await expect(workspace(page)).toHaveAttribute('data-phase', 'pushback');
  await expect(page.getByTestId('turn-card').first()).toHaveAttribute('data-cls', 'refused');

  await page.keyboard.press('p');
  await expect(workspace(page)).toHaveAttribute('data-phase', 'done');
  await expect(page.getByTestId('turn-card')).toHaveCount(3);
  expect((await runsOf(sess))[0].pushback_source).toBe('coach');

  await page.keyboard.press('r');
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');
  await expect(pickButton(row(page, 'refuse-me'))).toHaveAttribute('aria-current', 'true');

  await page.keyboard.press('S');
  await expect(workspace(page)).toHaveAttribute('data-phase', 'pushback');
  await page.keyboard.press('k');
  await expect(workspace(page)).toHaveAttribute('data-phase', 'done');
  const runs = await runsOf(sess);
  expect(runs).toHaveLength(2);
  expect(runs[1].pushback_source).toBe('skip');

  await page.keyboard.press('n');
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');
  await expect(pickButton(row(page, 'answer-me'))).toHaveAttribute('aria-current', 'true');
});

test('typing "s" in the custom prompt box types it and sends nothing', async ({ page }) => {
  const sess = await newSession('Typing');
  await openIn(page, sess);
  await rail(page).getByTestId('custom-row').click();
  const box = page.getByTestId('custom-text');
  await box.click();
  await page.keyboard.type('s');
  await expect(box).toHaveValue('s');
  await page.keyboard.type('S');
  await expect(box).toHaveValue('sS');
  await page.waitForTimeout(SETTLE_MS);
  await expect(workspace(page)).toHaveAttribute('data-phase', 'custom');
  expect(await runsOf(sess)).toHaveLength(0);
});

test('S does nothing while the settings drawer or the shortcuts overlay is open', async ({
  page,
}) => {
  const sess = await newSession('Drawer');
  await openIn(page, sess);
  await pickButton(row(page, 'refuse-me')).click();

  await page.getByRole('button', { name: SHELL.settingsLabel }).click();
  await page.keyboard.press('s');
  await page.waitForTimeout(SETTLE_MS);
  expect(await runsOf(sess)).toHaveLength(0);
  await page.keyboard.press('Escape');

  // ? opens the overlay; S is ignored under it; Escape closes it.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('?');
  const overlay = page.getByRole('dialog', { name: SHELL.shortcutsTitle });
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText(SHELL.shortcutsFooter);
  await page.keyboard.press('s');
  await page.waitForTimeout(SETTLE_MS);
  expect(await runsOf(sess)).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();

  // With both closed, the same key sends.
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');
  await page.keyboard.press('s');
  await expect(workspace(page)).toHaveAttribute('data-phase', 'pushback');
  expect(await runsOf(sess)).toHaveLength(1);
});

test('S on /studies/conditions starts no run, though a probe is still selected', async ({
  page,
}) => {
  const sess = await newSession('Scope');
  await openIn(page, sess);
  await pickButton(row(page, 'refuse-me')).click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');

  // Client-side navigation keeps the workspace on the selected probe.
  const sections = page.getByRole('tablist', { name: SHELL.sectionsLabel });
  await sections.getByRole('tab', { name: 'Studies' }).click();
  await page
    .getByRole('tablist', { name: SHELL.studiesLabel })
    .getByRole('tab', {
      name: 'Conditions',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/studies\/conditions$/);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('s');
  await page.waitForTimeout(SETTLE_MS);
  expect(await runsOf(sess)).toHaveLength(0);

  // Back in Probe, the selection is still there and S sends.
  await sections.getByRole('tab', { name: 'Probe' }).click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');
  await page.keyboard.press('s');
  await expect(workspace(page)).toHaveAttribute('data-phase', 'pushback');
  expect(await runsOf(sess)).toHaveLength(1);
});
