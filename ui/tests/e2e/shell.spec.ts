// The application shell (brief 13.3 spec 10, plan 6.3, T15): section tabs,
// the D16 sub-tab names, the sidecar chip, the shortcuts overlay, the probe
// rail frame, the settings drawer, the guide menu and the session switcher.
import { expect, test, type Page } from '@playwright/test';
import {
  DATA_TABS,
  GUIDE_ITEMS,
  GUIDE_MENU,
  SECTIONS,
  SHELL,
  STUDIES_TABS,
} from '../../src/lib/copy/shell';
import { SCREENS } from '../../src/lib/copy/screens';
import { COMPARE_SESSION_PREFIX } from '../../src/lib/session';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, readSeed, type Session } from './helpers';

type Health = { status: string; version: string; db_path: string; keys_set: number };

test.beforeEach(async ({ page }) => {
  // Onboarding done, the tour and every first-time tip seen (brief 13.3), so
  // nothing pops over the controls under test.
  await page.addInitScript(
    (tipIds: string[]) => {
      localStorage.setItem('flinch:onboarding_done', 'true');
      localStorage.setItem('flinch:tour_seen', 'true');
      for (const id of tipIds) localStorage.setItem(`flinch:tip_seen:${id}`, 'true');
    },
    tipsRegistry.map((t) => t.id),
  );
});

/** Opens a route and waits until the shell has talked to the sidecar. */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
}

const sections = (page: Page) => page.getByRole('tablist', { name: SHELL.sectionsLabel });
const rail = (page: Page) => page.getByTestId('probe-rail');

test('the header sections navigate, and / opens Probe (D8)', async ({ page }) => {
  await open(page, '/');
  await expect(page).toHaveURL(/\/probe$/);
  await expect(sections(page).getByRole('tab')).toHaveText(SECTIONS.map((s) => s.label));

  for (const target of ['Studies', 'Data', 'Probe']) {
    const def = SECTIONS.find((s) => s.label === target)!;
    await sections(page).getByRole('tab', { name: target }).click();
    await expect(page).toHaveURL(new RegExp(`${def.href}$`));
    await expect(sections(page).getByRole('tab', { name: target })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS['probe.idle']);

  await page.goto('/studies');
  await expect(page).toHaveURL(/\/studies\/framings$/);
  await page.goto('/data');
  await expect(page).toHaveURL(/\/data\/browse$/);
});

test('the Studies and Data sub-tab strips use the D16 names and open each screen', async ({
  page,
}) => {
  const questions: Record<string, string> = {
    '/studies/framings': SCREENS.framings,
    '/studies/conditions': SCREENS['conditions.list'],
    '/studies/repeat': SCREENS.repeat,
    '/studies/sequences': SCREENS.sequences,
    '/studies/compare': SCREENS.compare,
    '/studies/baselines': SCREENS.baselines,
    '/data/browse': SCREENS.browse,
    '/data/scorecard': SCREENS.scorecard,
    '/data/publish': SCREENS.publish,
    '/data/coach': SCREENS.coach,
  };
  for (const [start, label, tabs] of [
    ['/studies/framings', SHELL.studiesLabel, STUDIES_TABS],
    ['/data/browse', SHELL.dataLabel, DATA_TABS],
  ] as const) {
    await open(page, start);
    const strip = page.getByRole('tablist', { name: label });
    await expect(strip.getByRole('tab')).toHaveText(tabs.map((t) => t.label));
    for (const tab of tabs) {
      await strip.getByRole('tab', { name: tab.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${tab.href}$`));
      await expect(strip.getByRole('tab', { name: tab.label, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByTestId('screen-question')).toHaveText(questions[tab.href]);
    }
  }
});

test('the sidecar chip reads "Sidecar ready" and shows the version from /health', async ({
  page,
}) => {
  const health = await api<Health>('GET', '/health');
  await open(page, '/probe');
  const chip = page.getByTestId('sidecar-chip');
  await expect(chip).toHaveAttribute('data-state', 'ready');
  await chip.click();
  const pop = page.getByRole('dialog', { name: SHELL.sidecarDetails });
  await expect(pop.getByTestId('sidecar-version')).toHaveText(health.version);
  await expect(pop).toContainText(health.db_path);
  await expect(pop).toContainText(SHELL.keysSet(health.keys_set));
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
});

test('? opens the shortcuts overlay from anywhere and Escape closes it (D22)', async ({ page }) => {
  for (const path of ['/probe', '/data/scorecard']) {
    await open(page, path);
    const overlay = page.getByRole('dialog', { name: SHELL.shortcutsTitle });
    await page.keyboard.press('?');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText(SHELL.shortcutsFooter);
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
    // ? toggles it.
    await page.keyboard.press('?');
    await expect(overlay).toBeVisible();
    await page.keyboard.press('?');
    await expect(overlay).toBeHidden();
  }
});

test('the probe rail collapses to 44px and the state survives a reload (D15)', async ({ page }) => {
  await open(page, '/probe');
  await expect(rail(page)).toHaveAttribute('data-open', 'true');
  await expect.poll(async () => (await rail(page).boundingBox())?.width).toBe(288);

  await page.getByRole('button', { name: SHELL.railHide }).click();
  await expect(rail(page)).toHaveAttribute('data-open', 'false');
  await expect.poll(async () => (await rail(page).boundingBox())?.width).toBe(44);

  await page.reload();
  await expect(rail(page)).toHaveAttribute('data-open', 'false');
  await page.getByRole('button', { name: SHELL.railShow }).click();
  await expect(rail(page)).toHaveAttribute('data-open', 'true');
  await page.reload();
  await expect(rail(page)).toHaveAttribute('data-open', 'true');
});

test('the probe rail is hidden in Data and shown in Probe and Studies', async ({ page }) => {
  await open(page, '/data/browse');
  await expect(rail(page)).toHaveCount(0);
  await sections(page).getByRole('tab', { name: 'Studies' }).click();
  await expect(rail(page)).toBeVisible();
  await sections(page).getByRole('tab', { name: 'Data' }).click();
  await expect(rail(page)).toHaveCount(0);
  await sections(page).getByRole('tab', { name: 'Probe' }).click();
  await expect(rail(page)).toBeVisible();
});

test('the settings drawer opens and closes; Escape closes the topmost layer first', async ({
  page,
}) => {
  await open(page, '/probe');
  const drawer = page.getByRole('dialog', { name: 'Settings' });
  const overlay = page.getByRole('dialog', { name: SHELL.shortcutsTitle });

  await page.getByRole('button', { name: SHELL.settingsLabel }).click();
  await expect(drawer).toBeVisible();
  await expect.poll(async () => (await drawer.boundingBox())?.width).toBe(440);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  await page.getByRole('button', { name: SHELL.settingsLabel }).click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('?');
  await expect(overlay).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Close settings' }).click();
  await expect(drawer).toBeHidden();
});

test('the guide menu lists its five items and opens the shortcuts overlay (D12)', async ({
  page,
}) => {
  await open(page, '/probe');
  await page.getByRole('button', { name: GUIDE_MENU.menuButton }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText([...GUIDE_ITEMS]);
  await menu.getByRole('menuitem', { name: GUIDE_MENU.shortcuts }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('dialog', { name: SHELL.shortcutsTitle })).toBeVisible();
});

test('the session switcher starts with New session and hides Model compare sessions (D9, D29)', async ({
  page,
}) => {
  const seed = readSeed();
  const seeded = await api<Session>('GET', `/api/sessions/${seed.sessionId}`);
  const hidden = await api<Session>('POST', '/api/sessions', {
    name: 'Shell spec compare session',
    notes: `${COMPARE_SESSION_PREFIX} with 2 models, 1 probes`,
  });
  try {
    await open(page, '/probe');
    const switcher = page.getByTestId('session-switcher');
    await expect(switcher).not.toHaveText(SHELL.noSession);
    await switcher.click();
    const menu = page.getByRole('menu', { name: SHELL.switcherLabel });
    await expect(menu.getByRole('menuitem').first()).toHaveText(SHELL.newSession);
    const rows = menu.getByRole('menuitemradio');
    await expect(rows.filter({ hasText: seeded.name })).toHaveCount(1);
    await expect(rows.filter({ hasText: hidden.name })).toHaveCount(0);

    // Picking a session checks it and survives a reload (flinch:session_id).
    await rows.filter({ hasText: seeded.name }).click();
    await expect(menu).toBeHidden();
    await expect(switcher).toContainText(seeded.name);
    await page.reload();
    await expect(switcher).toContainText(seeded.name);
    await switcher.click();
    await expect(rows.filter({ hasText: seeded.name })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  } finally {
    await api('DELETE', `/api/sessions/${hidden.id}`);
  }
});
