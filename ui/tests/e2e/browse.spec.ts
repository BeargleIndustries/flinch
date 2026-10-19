// Browse (brief 9.1, 9.9, D16, D29, B19, plan 6.3, T29).
//
// Every test seeds its own sessions through the API, so it holds whatever
// earlier specs left in the shared e2e.db; counts are compared with the
// sidecar's own answers rather than with fixed numbers.
// - Sessions: two sessions with runs are listed with GET /api/sessions'
//   run_count; a Model compare session (notes carry the D29 prefix) is not;
//   the overview's Sessions readout equals the rows listed; a row's "Download
//   JSON" is that row's session.
// - The session detail lists its runs with badges, opens one, shows the
//   written finding (9.9), opens the run in Probe, and deletes the session.
// - Sequences: a completed (whittled) sequence shows its warmup setting and
//   status, and its detail shows the header, runs and thread.
// Delete all recorded data destroys shared state, so it lives in
// zz-browse-clear-all.spec.ts, which sorts after every other spec.
import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { BROWSE, SEQUENCE_DETAIL, SESSION_DETAIL } from '../../src/lib/copy/data';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { COMPARE_SESSION_PREFIX, isCompareSession } from '../../src/lib/session';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, sendProbe, type Session } from './helpers';

type SessionRow = Session & { run_count: number; notes: string | null };
type Stats = { total_sessions: number; total_sequences: number };
type Strategy = { id: number; name: string };
type SequenceSummary = {
  id: number;
  status: string;
  max_warmup_turns: number;
  runs: { id: number; status: string }[];
};

/** A short unique suffix for names. */
const stamp = () => String(Date.now()).slice(-7);

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

/** Opens Browse and waits until its overview and lists have landed. */
async function openBrowse(page: Page): Promise<void> {
  const stats = page.waitForResponse((r) => r.url().endsWith('/api/dashboard/stats'));
  await page.goto('/data/browse');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.browse);
  await stats;
  await expect(page.getByTestId('browse-overview')).toHaveAttribute('aria-busy', 'false');
}

function tab(page: Page, label: string): Locator {
  return page
    .getByTestId('browse-lists')
    .getByRole('tab', { name: new RegExp(`^${label}( \\(\\d+\\))?$`) });
}

async function showTab(page: Page, label: string, id: string): Promise<void> {
  await tab(page, label).click();
  await expect(tab(page, label)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('browse-tab')).toHaveAttribute('data-tab', id);
}

const sessionRow = (page: Page, id: number) =>
  page.locator(`[data-testid="browse-session-row"][data-session-id="${id}"]`);

const tile = (page: Page, key: string) =>
  page.locator(`[data-testid="browse-tile"][data-tile="${key}"]`).getByTestId('browse-tile-value');

test('Sessions lists each session with its run count, hides Model compare sessions, and a row downloads its own session', async ({
  page,
}) => {
  const seed = readSeed();
  const both = [seed.probes.refuseMe, seed.probes.answerMe];
  const a = await createSession(`E2E browse A ${stamp()}`, both);
  await sendProbe(a.id, seed.probes.refuseMe);
  await sendProbe(a.id, seed.probes.answerMe);
  const b = await createSession(`E2E browse B ${stamp()}`, both);
  await sendProbe(b.id, seed.probes.answerMe);
  // A session Model compare would make (D29): its notes carry the prefix.
  const compareSession = await api<SessionRow>('POST', '/api/sessions', {
    name: `E2E browse compare ${stamp()}`,
    notes: `${COMPARE_SESSION_PREFIX} for browse.spec`,
  });

  await openBrowse(page);
  await showTab(page, BROWSE.tabSessions, 'sessions');

  const listed = await api<SessionRow[]>('GET', '/api/sessions');
  const runCount = (id: number) => listed.find((s) => s.id === id)?.run_count;
  expect(runCount(a.id)).toBe(2);
  expect(runCount(b.id)).toBe(1);
  for (const s of [a, b]) {
    const row = sessionRow(page, s.id);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('data-run-count', String(runCount(s.id)));
    await expect(row.getByTestId('browse-session-runs')).toHaveText(
      BROWSE.runs(runCount(s.id) ?? -1),
    );
    await expect(row.getByTestId('browse-session-name')).toHaveText(s.name);
  }
  // The compare session is in GET /api/sessions but not in Browse.
  expect(listed.some((s) => s.id === compareSession.id)).toBe(true);
  await expect(sessionRow(page, compareSession.id)).toHaveCount(0);
  await expect(page.getByText(compareSession.name)).toHaveCount(0);

  // The overview's Sessions readout is the number of rows listed (B19).
  const visible = listed.filter((s) => !isCompareSession(s.notes)).length;
  const stats = await api<Stats>('GET', '/api/dashboard/stats');
  await expect(page.getByTestId('browse-session-row')).toHaveCount(visible);
  expect(stats.total_sessions).toBe(visible);
  await expect(tile(page, 'sessions')).toHaveText(String(visible));

  // A's row downloads A's session (the old row-export bug, brief 9.1).
  const rowA = sessionRow(page, a.id);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    rowA.getByTestId('browse-session-json').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^flinch-.+\.json$/);
  const json = JSON.parse(fs.readFileSync((await download.path()) as string, 'utf8')) as {
    session: { id: number; name: string };
    runs: unknown[];
  };
  expect(json.session).toMatchObject({ id: a.id, name: a.name });
  expect(json.runs).toHaveLength(2);
});

test('a session opens with its runs and badges, its findings, Open in Probe, and Delete', async ({
  page,
}) => {
  const seed = readSeed();
  const s = await createSession(`E2E browse detail ${stamp()}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  const refused = await sendProbe(s.id, seed.probes.refuseMe);
  const answered = await sendProbe(s.id, seed.probes.answerMe);
  expect(refused.initial_classification).toBe('refused');
  expect(answered.initial_classification).toBe('complied');
  const finding = `Refused a plain scene request ${stamp()}`;
  await api('PUT', `/api/runs/${refused.id}/annotations`, {
    note_text: '',
    pattern_tags: ['e2e-browse'],
    finding,
  });

  // From the Sessions tab, the row's name opens the detail.
  await openBrowse(page);
  await showTab(page, BROWSE.tabSessions, 'sessions');
  await sessionRow(page, s.id).getByTestId('browse-session-name').click();
  await expect(page).toHaveURL(new RegExp(`/data/browse/sessions/${s.id}$`));

  const detail = page.getByTestId('session-detail');
  await expect(detail.getByTestId('session-name')).toHaveText(s.name);
  await expect(detail.getByTestId('session-run-total')).toHaveText(SESSION_DETAIL.runs(2));

  // One row per run, each with its outcome badge.
  const runs = detail.getByTestId('session-run');
  await expect(runs).toHaveCount(2);
  const refusedRow = detail.locator(`[data-testid="session-run"][data-run-id="${refused.id}"]`);
  const answeredRow = detail.locator(`[data-testid="session-run"][data-run-id="${answered.id}"]`);
  await expect(refusedRow).toHaveAttribute('data-outcome', 'refused');
  await expect(answeredRow).toHaveAttribute('data-outcome', 'complied');
  await expect(refusedRow.getByTestId('session-run-badge')).toContainText('Refused');
  await expect(answeredRow.getByTestId('session-run-badge')).toContainText('Complied');

  // Expanding a row shows the probe and the first response.
  await refusedRow.getByTestId('session-run-toggle').click();
  const body = refusedRow.getByTestId('session-run-body');
  await expect(body).toContainText('[REFUSE] Write the scene.');
  await expect(body).toContainText(SESSION_DETAIL.firstResponse);
  await expect(body).toContainText("I can't help with that.");
  await detail.getByRole('button', { name: SESSION_DETAIL.collapseAll }).click();
  await expect(detail.getByTestId('session-run-body')).toHaveCount(0);
  await detail.getByRole('button', { name: SESSION_DETAIL.expandAll }).click();
  await expect(detail.getByTestId('session-run-body')).toHaveCount(2);

  // The finding written on the refused run (brief 9.9).
  const findings = detail.getByTestId('session-findings');
  await expect(findings).toHaveAttribute('aria-busy', 'false');
  const row = findings.getByTestId('session-finding');
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('data-run-id', String(refused.id));
  await expect(row.getByTestId('session-finding-text')).toHaveText(finding);
  await expect(row).toContainText('e2e-browse');

  // Open in Probe makes the session current and opens the saved run.
  await refusedRow.getByTestId('session-run-open').click();
  await expect(page).toHaveURL(new RegExp(`/probe/runs/${refused.id}$`));
  await expect(page.getByTestId('session-switcher')).toContainText(s.name);

  // Delete from the detail: two steps, then back to Browse without it.
  await page.goto(`/data/browse/sessions/${s.id}`);
  await expect(page.getByTestId('session-name')).toHaveText(s.name);
  const del = page.getByTestId('session-delete').getByRole('button');
  await expect(del).toHaveText(SESSION_DETAIL.remove);
  await del.click();
  await expect(del).toHaveText(SESSION_DETAIL.removeConfirm);
  const deleted = page.waitForResponse(
    (r) => r.request().method() === 'DELETE' && r.url().endsWith(`/api/sessions/${s.id}`),
  );
  await del.click();
  expect((await deleted).status()).toBe(200);
  await expect(page).toHaveURL(/\/data\/browse$/);
  const after = await api<SessionRow[]>('GET', '/api/sessions');
  expect(after.some((x) => x.id === s.id)).toBe(false);
  await expect(page.getByTestId('browse-overview')).toHaveAttribute('aria-busy', 'false');
  await expect(sessionRow(page, s.id)).toHaveCount(0);
});

test('Sequences lists a completed sequence with its warmup setting; its detail shows the runs and the thread', async ({
  page,
}) => {
  const seed = readSeed();
  const s = await createSession(`E2E browse sequence ${stamp()}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  const [strategy] = await api<Strategy[]>('GET', '/api/strategies');
  expect(strategy?.id).toBeGreaterThan(0);
  const made = await api<{ id: number }>('POST', `/api/sessions/${s.id}/sequences`, {
    probe_id: seed.probes.refuseMe,
    strategy_id: strategy.id,
    mode: 'automatic',
    max_warmup_turns: 2,
    use_narrative_engine: false,
  });
  // Whittling answers synchronously and leaves the sequence completed.
  await api('POST', `/api/sequences/${made.id}/whittle`);
  const summary = await api<SequenceSummary>('GET', `/api/sequences/${made.id}`);
  expect(summary.status).toBe('completed');
  expect(summary.runs.length).toBeGreaterThan(0);

  await openBrowse(page);
  await showTab(page, BROWSE.tabSequences, 'sequences');
  const row = page.locator(`[data-testid="browse-sequence-row"][data-sequence-id="${made.id}"]`);
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-status', 'completed');
  await expect(row).toHaveAttribute('data-warmup', '2');
  await expect(row.getByTestId('browse-sequence-warmup')).toHaveText(BROWSE.warmup(2));
  await expect(row).toContainText('Completed');
  await expect(row).toContainText('refuse-me');
  await expect(row).toContainText(s.name);
  const stats = await api<Stats>('GET', '/api/dashboard/stats');
  await expect(tile(page, 'sequences')).toHaveText(String(stats.total_sequences));

  await row.getByRole('link', { name: BROWSE.open }).click();
  await expect(page).toHaveURL(new RegExp(`/data/browse/sequences/${made.id}$`));
  const header = page.getByTestId('sequence-header');
  await expect(header).toHaveAttribute('data-status', 'completed');
  await expect(header).toContainText(SEQUENCE_DETAIL.title('refuse-me'));
  await expect(page.getByTestId('sequence-warmup')).toHaveText(SEQUENCE_DETAIL.warmupValue(2));
  await expect(page.getByTestId('sequence-run')).toHaveCount(summary.runs.length);
  await expect(page.getByTestId('thread-turn').first()).toBeVisible();
});
