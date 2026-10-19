// The probe rail and the session dialogs (brief 6.2, 6.5 to 6.8; plan 6.3,
// T16): New session with the I18 default model, the rail's probes, stats and
// history, the IF chip, search, Add probe (joins only its own session),
// Import a file, bulk delete with the refusal for a probe that has runs, and
// the rail following a session switch.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ADD_PROBE, IMPORT_PROBES, NEW_SESSION, RAIL } from '../../src/lib/copy/rail';
import { SHELL } from '../../src/lib/copy/shell';
import { DEFAULT_TARGET_MODEL } from '../../src/lib/session';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, ensureProbe, readSeed, sendProbe, type Session } from './helpers';

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

async function open(page: Page, path = '/probe'): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
}

const rail = (page: Page) => page.getByTestId('probe-rail');
const rows = (page: Page) => rail(page).getByTestId('probe-row');
const row = (page: Page, name: string) =>
  rail(page).locator(`[data-testid="probe-row"][data-probe-name="${name}"]`);
const pickButton = (r: Locator) => r.locator('[data-probe-id]');
const strip = (page: Page) => page.getByRole('region', { name: 'Status' });

async function pickSession(page: Page, name: string): Promise<void> {
  await page.getByTestId('session-switcher').click();
  const menu = page.getByRole('menu', { name: SHELL.switcherLabel });
  await menu.getByRole('menuitemradio').filter({ hasText: name }).click();
  await expect(menu).toBeHidden();
}

async function railNames(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-probe-name') ?? ''));
}

test('New session creates a session with the I18 default model; the rail lists its probes, stats and history', async ({
  page,
}) => {
  const seed = readSeed();
  const name = `Rail new ${stamp()}`;
  await open(page);

  await page.getByTestId('session-switcher').click();
  await page.getByRole('menuitem', { name: SHELL.newSession }).click();
  const dialog = page.getByRole('dialog', { name: NEW_SESSION.title });
  await expect(dialog).toContainText(NEW_SESSION.lead);
  await expect(dialog.getByLabel(NEW_SESSION.targetModel)).toHaveValue(DEFAULT_TARGET_MODEL);

  // Scope it to the two seeded probes; an empty pick blocks submit.
  const summary = dialog.getByTestId('ns-probes-summary');
  await expect(summary).toContainText(NEW_SESSION.allProbes);
  await summary.click();
  await dialog.getByRole('button', { name: 'None', exact: true }).click();
  await expect(dialog).toContainText(NEW_SESSION.problems.probes);
  await dialog.getByRole('checkbox', { name: 'refuse-me' }).check();
  await dialog.getByRole('checkbox', { name: 'answer-me' }).check();
  await expect(summary).toContainText(/2 of \d+ selected/);

  // Enter in the name field submits (brief 7.10).
  const nameField = dialog.getByLabel(NEW_SESSION.name, { exact: true });
  await nameField.fill(name);
  await nameField.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/probe$/);
  await expect(page.getByTestId('session-switcher')).toContainText(name);

  await expect(rail(page).getByTestId('rail-count')).toHaveText(RAIL.count(2, 2));
  await expect.poll(async () => (await railNames(page)).sort()).toEqual(['answer-me', 'refuse-me']);
  await expect(rail(page).getByTestId('session-runs')).toHaveText(RAIL.runs(0));
  await expect(rail(page).getByTestId('run-history')).toContainText(RAIL.noRuns);

  // A run shows in the stats, the probe's row and the history.
  const sessions = await api<Session[]>('GET', '/api/sessions');
  const made = sessions.find((s) => s.name === name)!;
  expect(made.probe_ids?.sort()).toEqual([seed.probes.refuseMe, seed.probes.answerMe].sort());
  const run = await sendProbe(made.id, seed.probes.refuseMe);
  await page.reload();
  await expect(rail(page).getByTestId('session-runs')).toHaveText(RAIL.runs(1));
  await expect(row(page, 'refuse-me').getByTestId('probe-stat')).toHaveAttribute(
    'title',
    RAIL.runsTitle(1),
  );
  await expect(row(page, 'answer-me').getByTestId('probe-stat')).toHaveCount(0);
  const history = rail(page).getByTestId('history-row');
  await expect(history).toHaveCount(1);
  await expect(history).toContainText('refuse-me');
  await expect(history).toHaveAttribute('href', `/probe/runs/${run.id}`);
  await history.click();
  await expect(page).toHaveURL(new RegExp(`/probe/runs/${run.id}$`));
});

test('Add probe with narrative fields shows the IF chip and joins only its own session', async ({
  page,
}) => {
  const seed = readSeed();
  const s = stamp();
  const a = await createSession(`Rail add A ${s}`, [seed.probes.refuseMe]);
  const b = await createSession(`Rail add B ${s}`, [seed.probes.answerMe]);
  const probeName = `rail-if-${s}`;

  await open(page);
  await pickSession(page, a.name);
  await expect(rows(page)).toHaveCount(1);

  await rail(page).getByRole('button', { name: RAIL.addProbe }).click();
  const dialog = page.getByRole('dialog', { name: ADD_PROBE.title });
  await expect(dialog).toContainText(ADD_PROBE.lead);
  await dialog.getByLabel(ADD_PROBE.name, { exact: true }).fill(probeName);
  await dialog.getByLabel(ADD_PROBE.domain, { exact: true }).fill('e2e-rail');
  await dialog.getByLabel(ADD_PROBE.promptText).fill('[REFUSE] Continue the story.');
  await dialog.getByLabel(ADD_PROBE.narrative).check();
  await dialog.getByRole('button', { name: ADD_PROBE.save }).click();
  await expect(dialog).toContainText(ADD_PROBE.problems.narrative);
  await dialog
    .getByLabel(ADD_PROBE.narrativeOpening, { exact: true })
    .fill('"Hello," said the guard.');
  await dialog
    .getByLabel(ADD_PROBE.narrativeTarget, { exact: true })
    .fill('((The guard opens the gate.))');
  await dialog.getByRole('button', { name: ADD_PROBE.save }).click();
  await expect(dialog).toBeHidden();

  const added = row(page, probeName);
  await expect(added).toBeVisible();
  await expect(added.getByTestId('if-chip')).toHaveAttribute('title', RAIL.ifTitle);
  await expect(row(page, 'refuse-me').getByTestId('if-chip')).toHaveCount(0);
  await expect(pickButton(added)).toHaveAttribute('aria-current', 'true');
  await expect(rail(page).getByTestId('rail-count')).toHaveText(RAIL.count(2, 2));

  // A second probe with the same name is refused with the brief's line.
  await rail(page).getByRole('button', { name: RAIL.addProbe }).click();
  await dialog.getByLabel(ADD_PROBE.name, { exact: true }).fill(probeName);
  await dialog.getByLabel(ADD_PROBE.domain, { exact: true }).fill('e2e-rail');
  await dialog.getByLabel(ADD_PROBE.promptText).fill('Anything.');
  await dialog.getByRole('button', { name: ADD_PROBE.save }).click();
  await expect(dialog.getByTestId('ap-error')).toHaveText(ADD_PROBE.duplicate);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Only session A's rail has it.
  await pickSession(page, b.name);
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, 'answer-me')).toBeVisible();
  await expect(row(page, probeName)).toHaveCount(0);
  await pickSession(page, a.name);
  await expect(row(page, probeName)).toBeVisible();
});

test('search filters the rail, Escape clears it, and Up/Down move the active probe', async ({
  page,
}) => {
  const seed = readSeed();
  const sess = await createSession(`Rail search ${stamp()}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  await open(page);
  await pickSession(page, sess.name);
  const count = rail(page).getByTestId('rail-count');
  await expect(count).toHaveText(RAIL.count(2, 2));

  const search = rail(page).getByRole('searchbox', { name: RAIL.search });
  await search.fill('RAIN');
  await expect(count).toHaveText(RAIL.count(1, 2));
  await expect.poll(() => railNames(page)).toEqual(['answer-me']);
  await search.fill('refuse');
  await expect.poll(() => railNames(page)).toEqual(['refuse-me']);
  await search.fill('nothing like this');
  await expect(rail(page)).toContainText(RAIL.noMatch);
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(count).toHaveText(RAIL.count(2, 2));

  // Up and Down, focus outside a field, wrap through the visible list.
  const order = await railNames(page);
  await search.blur();
  await page.keyboard.press('ArrowDown');
  await expect(pickButton(row(page, order[0]))).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(pickButton(row(page, order[1]))).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(pickButton(row(page, order[0]))).toHaveAttribute('aria-current', 'true');
  await expect(pickButton(row(page, order[1]))).not.toHaveAttribute('aria-current', 'true');
});

test('Import a file loads the probes of a file in the probes folder', async ({ page }) => {
  // No probe_ids: the session follows the whole library, so imported probes show.
  const sess = await createSession(`Rail import ${stamp()}`, []);
  await open(page);
  await pickSession(page, sess.name);

  await rail(page).getByRole('button', { name: RAIL.importFile }).click();
  const dialog = page.getByRole('dialog', { name: IMPORT_PROBES.title });
  await expect(dialog).toContainText(IMPORT_PROBES.lead);
  const file = dialog.getByTestId('import-row').filter({ hasText: 'example-probes.md' });
  await expect(file).toBeVisible();
  await file.getByRole('button', { name: IMPORT_PROBES.importFile('example-probes.md') }).click();
  await expect(file.getByTestId('import-result')).toHaveText(/^Loaded \d+ probes?$/);
  await dialog.getByRole('button', { name: IMPORT_PROBES.close, exact: true }).click();
  await expect(dialog).toBeHidden();

  const names = (await api<{ name: string; source_file: string | null }[]>('GET', '/api/probes'))
    .filter((p) => (p.source_file ?? '').endsWith('example-probes.md'))
    .map((p) => p.name);
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) await expect(row(page, n)).toBeVisible();
});

test('bulk delete removes the selected probes and keeps one that has runs', async ({ page }) => {
  const s = stamp();
  const keep = await ensureProbe(`rail-keep-${s}`, 'Write a short poem about snow.');
  const drop = await ensureProbe(`rail-drop-${s}`, 'Write a short poem about fog.');
  const sess = await createSession(`Rail bulk ${s}`, [keep.id, drop.id]);
  await sendProbe(sess.id, keep.id);

  await open(page);
  await pickSession(page, sess.name);
  await expect(rows(page)).toHaveCount(2);

  // One delete of a probe with runs: the sidecar refuses and the strip says why (B20).
  const trash = row(page, keep.name).locator('button[data-armed]');
  await row(page, keep.name).hover();
  await trash.click();
  await expect(trash).toHaveText(RAIL.deleteArmed);
  await trash.click();
  await expect(strip(page).getByRole('alert')).toContainText(
    'Probe has 1 run(s). Delete those first.',
  );
  await expect(rows(page)).toHaveCount(2);

  // Select mode: both probes, one bulk delete.
  await rail(page).getByRole('button', { name: RAIL.select, exact: true }).click();
  await rail(page)
    .getByRole('checkbox', { name: RAIL.selectProbe(keep.name) })
    .check();
  await rail(page)
    .getByRole('checkbox', { name: RAIL.selectProbe(drop.name) })
    .check();
  const bulk = rail(page).getByRole('button', { name: RAIL.bulkDelete(2) });
  await bulk.click();
  await rail(page)
    .getByRole('button', { name: RAIL.bulkDeleteConfirm(2) })
    .click();
  await expect(page.getByTestId('status-notice')).toHaveText(RAIL.bulkResult(1, 1));
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, keep.name)).toBeVisible();
  await expect(row(page, drop.name)).toHaveCount(0);
  await expect(rail(page).getByTestId('select-footer')).toHaveCount(0);
});

test('the switcher lists new sessions and the rail follows a switch', async ({ page }) => {
  const seed = readSeed();
  const s = stamp();
  const a = await createSession(`Rail switch A ${s}`, [seed.probes.refuseMe]);
  const b = await createSession(`Rail switch B ${s}`, [seed.probes.answerMe]);

  await open(page);
  await page.getByTestId('session-switcher').click();
  const menu = page.getByRole('menu', { name: SHELL.switcherLabel });
  const items = menu.getByRole('menuitemradio');
  await expect(items.filter({ hasText: a.name })).toHaveCount(1);
  await expect(items.filter({ hasText: b.name })).toHaveCount(1);
  // Newest first.
  const labels = await items.allTextContents();
  expect(labels.findIndex((t) => t.includes(b.name))).toBeLessThan(
    labels.findIndex((t) => t.includes(a.name)),
  );
  await page.keyboard.press('Escape');

  await pickSession(page, a.name);
  await expect.poll(() => railNames(page)).toEqual(['refuse-me']);
  await pickButton(row(page, 'refuse-me')).click();
  await expect(pickButton(row(page, 'refuse-me'))).toHaveAttribute('aria-current', 'true');

  await pickSession(page, b.name);
  await expect(row(page, 'answer-me')).toBeVisible();
  await expect.poll(() => railNames(page)).toEqual(['answer-me']);
  await expect(pickButton(row(page, 'answer-me'))).not.toHaveAttribute('aria-current', 'true');

  // Back to A: the workspace was reset to idle by the switch (brief 4.4).
  await pickSession(page, a.name);
  await expect(row(page, 'refuse-me')).toBeVisible();
  await expect(pickButton(row(page, 'refuse-me'))).not.toHaveAttribute('aria-current', 'true');
});
