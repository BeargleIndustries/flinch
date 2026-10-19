// The tour and the first-time tips (brief A.2, A.3, D12, plan T33). Unlike the
// other specs, this one does not mark the tips seen: the tour and a tip are
// what it tests. Onboarding is done, and the stored session is one made here
// with a refused run (as the global seed has).
//
// The tour runs its ten steps from the Guide menu: step 2 picks refuse-me,
// step 3's "Send it" sends it, steps 4 and 5 hold (a run, then a refusal to
// push against), step 6's requirement does not (the pushback is neither sent
// nor skipped) so it shows its missing line, and Done writes the tour-done
// pref and marks the tips the tour covered as seen.
import { expect, test, type Page } from '@playwright/test';
import { TOUR } from '../../src/lib/copy/onboarding';
import { GUIDE_MENU, SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { tourSteps } from '../../src/lib/tour/steps';
import { createSession, readSeed, sendProbe, type Session } from './helpers';

let sess: Session;

test.beforeAll(async () => {
  const seed = readSeed();
  sess = await createSession(`Tour ${String(Date.now()).slice(-7)}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  const run = await sendProbe(sess.id, seed.probes.refuseMe);
  expect(run.initial_classification).toBe('refused');
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:onboarding_done', 'true');
    localStorage.setItem('flinch:session_id', String(id));
    // The tour and the tips are under test: clear what other specs seed.
    localStorage.removeItem('flinch:tour_seen');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('flinch:tip_seen:')) localStorage.removeItem(k);
    }
  }, sess.id);
});

async function openProbe(page: Page, path = '/probe'): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('session-switcher')).toContainText(sess.name);
}

const card = (page: Page) => page.getByTestId('tour-card');
const forward = (page: Page) => page.getByTestId('tour-forward');
const workspace = (page: Page) => page.getByTestId('probe-workspace');
const pref = (page: Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(`flinch:${k}`), key);

async function openTour(page: Page): Promise<void> {
  await page.getByRole('button', { name: GUIDE_MENU.menuButton }).click();
  await page.getByRole('menuitem', { name: GUIDE_MENU.takeTour }).click();
  await expect(card(page)).toBeVisible();
}

/** The card shows step `n` (1-based) with its title and `text`. */
async function expectStep(page: Page, n: number, text?: string): Promise<void> {
  const s = tourSteps[n - 1];
  await expect(card(page)).toHaveAttribute('data-step', s.id);
  await expect(card(page).getByTestId('tour-progress')).toHaveText(TOUR.progress(n, 10));
  await expect(card(page).getByTestId('tour-title')).toHaveText(s.title);
  await expect(card(page).getByTestId('tour-body')).toHaveText(text ?? s.body);
}

test('the tour runs its ten steps on a session with a refused run', async ({ page }) => {
  expect(tourSteps).toHaveLength(10);
  await openProbe(page);
  await openTour(page);

  // No first-time tip shows over the tour card.
  await expectStep(page, 1);
  await expect(page.locator('[data-popup="tip"]')).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: TOUR.back })).toBeDisabled();
  await expect(forward(page)).toHaveText(TOUR.next);
  await forward(page).click();

  // 2: pick refuse-me in the rail (the card does not block the page).
  await expectStep(page, 2);
  await card(page).getByRole('button', { name: TOUR.back }).click();
  await expectStep(page, 1);
  await forward(page).click();
  await expectStep(page, 2);
  await page
    .getByTestId('probe-rail')
    .locator('[data-testid="probe-row"][data-probe-name="refuse-me"] [data-probe-id]')
    .click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');
  await forward(page).click();

  // 3: the step's own action sends the active probe and moves on.
  await expectStep(page, 3);
  await expect(forward(page)).toHaveText('Send it');
  await forward(page).click();

  // 4 and 5: a run and a refusal, so both show their bodies.
  await expectStep(page, 4);
  await expect(workspace(page)).toHaveAttribute('data-phase', 'pushback');
  await expect(card(page)).toHaveAttribute('data-met', 'true');
  await forward(page).click();
  await expectStep(page, 5);
  await expect(card(page)).toHaveAttribute('data-met', 'true');
  await forward(page).click();

  // 6: the exchange is not finished, so the missing line shows and Next skips ahead.
  await expectStep(page, 6, tourSteps[5].missing);
  await expect(card(page)).toHaveAttribute('data-met', 'false');
  await forward(page).click();

  for (const n of [7, 8, 9]) {
    await expectStep(page, n);
    await forward(page).click();
  }
  await expectStep(page, 10);
  await expect(forward(page)).toHaveText(TOUR.done);
  expect(await pref(page, 'tour_seen')).toBeNull();
  await forward(page).click();

  await expect(card(page)).toHaveCount(0);
  expect(await pref(page, 'tour_seen')).toBe('true');
  // The tips for the places the tour showed count as seen.
  for (const t of tipsRegistry.filter((t) => t.tutorialStepId))
    expect(await pref(page, `tip_seen:${t.id}`), t.id).toBe('true');
});

test('Close ends the tour and counts it as seen', async ({ page }) => {
  await openProbe(page);
  await openTour(page);
  await expectStep(page, 1);
  await card(page).getByRole('button', { name: TOUR.close }).click();
  await expect(card(page)).toHaveCount(0);
  expect(await pref(page, 'tour_seen')).toBe('true');
});

test('/probe?tour=1 starts the tour when a session exists', async ({ page }) => {
  await openProbe(page, '/probe?tour=1');
  await expectStep(page, 1);
  await expect(page).toHaveURL(/\/probe$/);
});

test('a first-time tip shows on a fresh screen, and dismissing it marks it seen', async ({
  page,
}) => {
  await openProbe(page);
  const tip = page.locator('[data-popup="tip"]');
  await expect(tip).toBeVisible();
  const id = await tip.getAttribute('data-tip-id');
  expect(tipsRegistry.map((t) => t.id)).toContain(id);
  const def = tipsRegistry.find((t) => t.id === id)!;
  await expect(tip).toContainText(def.title);
  await expect(tip).toContainText(def.blurb);
  expect(await pref(page, `tip_seen:${id}`)).toBeNull();

  await tip.getByRole('button', { name: 'Dismiss tip' }).click();
  await expect(page.locator(`[data-popup="tip"][data-tip-id="${id}"]`)).toHaveCount(0);
  expect(await pref(page, `tip_seen:${id}`)).toBe('true');
});
