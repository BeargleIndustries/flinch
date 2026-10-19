// Browse, Delete all recorded data (brief 9.1, B26, plan 6.3, T29).
//
// This spec deletes every session, run, sequence, comparison and study in the
// shared e2e.db, so it must run after every other spec. Playwright runs spec
// files in alphabetical order on its one worker (I38: workers 1, not fully
// parallel), and the "zz-" prefix sorts this file last; "browse" in its name
// keeps it in `npm run test:e2e -- browse`. Nothing runs after it, so it
// re-seeds nothing.
//
// The dialog says what is deleted and what stays (the B26 sentence and its
// two lists); after confirming, Browse is empty, GET /api/sessions is [], the
// probes and the fixture framing group are still there, the header switcher
// lists no sessions and the rail shows its No-session state.
import { expect, test } from '@playwright/test';
import { BROWSE, CLEAR_ALL } from '../../src/lib/copy/data';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, sendProbe, type Probe } from './helpers';

type VariantFile = { group_id: string; variant_type: string };
type ClearReply = { status: string; deleted: Record<string, number>; preserved: string[] };

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

test('Delete all recorded data empties Browse and keeps the probes and framing groups', async ({
  page,
}) => {
  const seed = readSeed();
  const s = await createSession(`E2E clear all ${String(Date.now()).slice(-7)}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  await sendProbe(s.id, seed.probes.answerMe);
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, s.id);
  const probesBefore = (await api<Probe[]>('GET', '/api/probes')).map((p) => p.id).sort();
  expect(probesBefore).toEqual(
    expect.arrayContaining([seed.probes.refuseMe, seed.probes.answerMe]),
  );

  const stats = page.waitForResponse((r) => r.url().endsWith('/api/dashboard/stats'));
  await page.goto('/data/browse');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await stats;
  await expect(page.getByTestId('browse-overview')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('session-switcher')).toContainText(s.name);
  await expect(page.getByTestId('browse-session-row').first()).toBeVisible();

  // The dialog names exactly what is deleted and what stays (B26).
  await page.getByTestId('browse-clear-all').click();
  const dialog = page.getByRole('dialog', { name: CLEAR_ALL.title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('clear-all-body')).toHaveText(SCREENS['browse.clearAll']);
  await expect(dialog.getByTestId('clear-all-deleted').getByRole('listitem')).toHaveText([
    ...CLEAR_ALL.deleted,
  ]);
  await expect(dialog.getByTestId('clear-all-kept').getByRole('listitem')).toHaveText([
    ...CLEAR_ALL.kept,
  ]);
  await expect(dialog.getByTestId('clear-all-body')).toContainText('This cannot be undone.');
  await expect(dialog.getByTestId('clear-all-body')).toContainText(
    'Probes, framing groups, policy claims and their probe links, strategies and coach profiles stay.',
  );

  // Two steps: "Delete everything", then "Yes, delete everything".
  const remove = dialog.getByRole('button', { name: CLEAR_ALL.remove, exact: true });
  await remove.click();
  const confirm = dialog.getByRole('button', { name: CLEAR_ALL.removeConfirm });
  await expect(confirm).toBeVisible();
  const cleared = page.waitForResponse(
    (r) => r.request().method() === 'DELETE' && r.url().endsWith('/api/dashboard/clear-all'),
  );
  await confirm.click();
  const res = await cleared;
  expect(res.status()).toBe(200);
  const reply = (await res.json()) as ClearReply;
  expect(reply.status).toBe('cleared');
  expect(reply.deleted.sessions).toBeGreaterThan(0);
  expect(reply.preserved).toEqual(expect.arrayContaining(['probes', 'probe_variants']));
  await expect(dialog.getByTestId('clear-all-done')).toContainText(CLEAR_ALL.done);
  await expect(dialog).toBeHidden();

  // Browse is empty.
  await expect(page.getByTestId('browse-overview')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('browse-empty')).toBeVisible();
  await expect(page.getByTestId('browse-empty')).toContainText(BROWSE.empty);
  await expect(page.getByTestId('browse-session-row')).toHaveCount(0);
  for (const key of ['sessions', 'runs', 'comparisons', 'sequences']) {
    await expect(
      page
        .locator(`[data-testid="browse-tile"][data-tile="${key}"]`)
        .getByTestId('browse-tile-value'),
    ).toHaveText('0');
  }

  // The sidecar agrees: no sessions; probes and the fixture group remain.
  expect(await api<unknown[]>('GET', '/api/sessions')).toEqual([]);
  const probesAfter = (await api<Probe[]>('GET', '/api/probes')).map((p) => p.id).sort();
  expect(probesAfter).toEqual(probesBefore);
  const files = await api<VariantFile[]>('GET', '/api/variants/files');
  expect(files.find((f) => f.group_id === 'e2e-framings')?.variant_type).toBe('framings');

  // The header switcher lists no sessions.
  const switcher = page.getByTestId('session-switcher');
  await expect(switcher).toContainText(SHELL.noSession);
  await switcher.click();
  await expect(page.getByRole('menu', { name: SHELL.switcherLabel })).toContainText(
    SHELL.sessionsEmpty,
  );
  await page.keyboard.press('Escape');

  // Probe shows the rail's No-session state.
  await page.getByRole('tab', { name: 'Probe', exact: true }).click();
  await expect(page).toHaveURL(/\/probe$/);
  await expect(page.getByTestId('probe-rail')).toContainText(SHELL.railNoSession);
  await expect(page.getByTestId('no-session')).toBeVisible();
});
