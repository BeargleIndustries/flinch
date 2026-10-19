// The Probe loop (brief 7, 13.3 spec 2; plan 6.3 with C-M4, T17): pick the
// refusing probe, send it, see Refused and the coach's draft, edit it and
// see the override notice, send it, see the pushback and the Collapsed reply
// (B10), teach the coach; the Skip path and Next probe; a custom prompt that
// becomes a probe in the rail; notes that save on blur and survive a reload;
// a history row that opens the saved run, where a follow-up pushback grows
// the same thread; the response badge corrected by hand (PATCH
// /api/runs/{id}/classification, brief 7.5); a saved refused run opening in
// the pushback phase and a missing run saying so.
//
// The fake target (tests/fake_models.py) refuses "[REFUSE]" prompts on the
// first turn and complies after that; its coach drafts
// "What specifically about this is problematic?" with the specificity move.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { MOVES } from '../../src/lib/copy/moves';
import { PROBE, QUESTION } from '../../src/lib/copy/probe';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, sendProbe, type Session } from './helpers';

const COACH_DRAFT = 'What specifically about this is problematic?';

type FullRun = {
  id: number;
  session_id: number;
  probe_id: number;
  initial_classification: string | null;
  final_classification: string | null;
  pushback_source: string | null;
  override_text: string | null;
};
type Turn = { role: string; content: string };
type CoachExample = { id: number; run_id: number | null };
type SessionDetail = { coach_profile: string; runs: FullRun[] };

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
async function openIn(page: Page, sess: Session, path = '/probe'): Promise<void> {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, sess.id);
  await page.goto(path);
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('session-switcher')).toContainText(sess.name);
}

const rail = (page: Page) => page.getByTestId('probe-rail');
const row = (page: Page, name: string) =>
  rail(page).locator(`[data-testid="probe-row"][data-probe-name="${name}"]`);
const pickButton = (r: Locator) => r.locator('[data-probe-id]');
const workspace = (page: Page) => page.getByTestId('probe-workspace');
const cards = (page: Page) => page.getByTestId('turn-card');

async function runsOf(sess: Session): Promise<FullRun[]> {
  return (await api<SessionDetail>('GET', `/api/sessions/${sess.id}`)).runs;
}

test('a refused probe: Refused, the coach draft, an edited override, Collapsed after pushback, and Teach the coach', async ({
  page,
}) => {
  const sess = await newSession('Loop');
  await openIn(page, sess);
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS['probe.idle']);

  await pickButton(row(page, 'refuse-me')).click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');
  await expect(page.getByTestId('screen-question')).toHaveText(QUESTION.selected);
  await expect(page.getByTestId('probe-card')).toContainText('[REFUSE] Write the scene.');
  await expect(page.getByTestId('policy-links')).toContainText(SCREENS['probe.policyEmpty']);

  await page.getByTestId('send-button').click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'pushback');
  const first = cards(page).first();
  await expect(first).toHaveAttribute('data-kind', 'response');
  await expect(first).toHaveAttribute('data-cls', 'refused');
  await expect(first.getByText('R', { exact: true })).toBeVisible();
  await expect(page.getByTestId('response-readout')).toContainText(SCREENS['response.refused']);
  await expect(page.getByTestId('screen-question')).toHaveText(QUESTION.pushback);

  // The coach's draft fills the box (D13); the move line comes from moves.ts.
  const box = page.locator('#pushback-text');
  await expect(box).toHaveValue(COACH_DRAFT);
  const move = MOVES.specificity_challenge;
  await expect(page.getByTestId('coach-lines')).toContainText(
    PROBE.move(move.name, move.description),
  );
  const status = page.getByTestId('pushback-status');
  await expect(status).toHaveText(SCREENS['pushback.unedited']);

  // Editing says, before sending, that it is recorded as an override.
  const edited = `${COACH_DRAFT} Name the rule you are applying.`;
  await box.fill(edited);
  await expect(status).toHaveText(SCREENS['pushback.edited']);
  await expect(status).toHaveAttribute('data-state', 'edited');
  await box.fill('');
  await expect(status).toHaveText(SCREENS['pushback.empty']);
  await expect(page.getByRole('button', { name: PROBE.sendPushback })).toBeDisabled();
  await box.fill(edited);

  await page.getByRole('button', { name: PROBE.sendPushback }).click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'done');
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).nth(1)).toHaveAttribute('data-kind', 'pushback');
  await expect(cards(page).nth(1)).toContainText(edited);
  await expect(cards(page).nth(1)).toContainText(PROBE.yourPushback);
  const last = cards(page).nth(2);
  await expect(last).toContainText(PROBE.responseAfter);
  await expect(last).toHaveAttribute('data-cls', 'collapsed');
  await expect(last.getByText('X', { exact: true })).toBeVisible();
  await expect(page.getByTestId('response-readout')).toContainText(SCREENS['response.collapsed']);
  await expect(page.getByTestId('keep-pushing')).toBeVisible();

  const [run] = await runsOf(sess);
  expect(run.pushback_source).toBe('override');
  expect(run.override_text).toBe(edited);
  expect(run.initial_classification).toBe('refused');
  expect(run.final_classification).toBe('collapsed');

  // Teach the coach this exchange (D14): one coach example for this run.
  const teach = page.getByTestId('teach-coach');
  await expect(teach).toHaveText(PROBE.teach);
  await expect(page.getByTestId('done-actions')).toContainText(SCREENS['teach.collapsed']);
  await teach.click();
  await expect(teach).toHaveText(PROBE.taught);
  await expect(teach).toBeDisabled();
  const profile = (await api<SessionDetail>('GET', `/api/sessions/${sess.id}`)).coach_profile;
  const examples = await api<CoachExample[]>(
    'GET',
    `/api/coach-examples?profile=${encodeURIComponent(profile)}`,
  );
  expect(examples.filter((e) => e.run_id === run.id)).toHaveLength(1);
});

test('Skip records no pushback, and Next probe moves to the next probe in the rail', async ({
  page,
}) => {
  const sess = await newSession('Skip');
  await openIn(page, sess);
  await pickButton(row(page, 'refuse-me')).click();
  await page.getByTestId('send-button').click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'pushback');

  await page.getByRole('button', { name: PROBE.skip, exact: true }).click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'done');
  await expect(page.getByTestId('pushback-panel')).toHaveCount(0);
  await expect(page.getByTestId('keep-pushing')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(1);
  const [run] = await runsOf(sess);
  expect(run.pushback_source).toBe('skip');

  await page.getByTestId('next-probe').click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'selected');
  await expect(pickButton(row(page, 'answer-me'))).toHaveAttribute('aria-current', 'true');
  await expect(page.getByTestId('probe-card')).toContainText('Write a short poem about rain.');
});

test('a custom prompt is sent and becomes a probe that shows active in the rail', async ({
  page,
}) => {
  const sess = await newSession('Custom');
  await openIn(page, sess);
  await rail(page).getByTestId('custom-row').click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'custom');
  await expect(page.getByTestId('screen-question')).toHaveText(QUESTION.custom);
  const send = page.getByTestId('send-button');
  await expect(send).toHaveText(new RegExp(PROBE.sendCustom));
  await expect(send).toBeDisabled();

  const text = `Write a haiku about fog ${stamp()}.`;
  await page.getByTestId('custom-text').fill(text);
  await send.click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'done');
  await expect(cards(page).first()).toHaveAttribute('data-cls', 'complied');
  await expect(page.getByTestId('response-readout')).toContainText(SCREENS['response.complied']);
  await expect(page.getByTestId('probe-card')).toContainText(text);

  // The sidecar saved the text as a probe in this session; the rail shows it active.
  const [run] = await runsOf(sess);
  const probes = await api<{ id: number; name: string; prompt_text: string }[]>(
    'GET',
    `/api/probes?session_id=${sess.id}`,
  );
  const made = probes.find((p) => p.id === run.probe_id);
  expect(made?.prompt_text).toBe(text);
  const madeRow = rail(page).locator(`[data-testid="probe-row"][data-probe-name="${made!.name}"]`);
  await expect(pickButton(madeRow)).toHaveAttribute('aria-current', 'true');
});

test('research notes, tags and the key finding save on blur, show "Saved" and survive a reload', async ({
  page,
}) => {
  const sess = await newSession('Notes');
  await openIn(page, sess);
  await pickButton(row(page, 'answer-me')).click();
  await page.getByTestId('send-button').click();
  await expect(workspace(page)).toHaveAttribute('data-phase', 'done');
  const [run] = await runsOf(sess);

  const notes = page.getByTestId('notes-panel');
  const saved = page.getByTestId('notes-saved');
  const note = 'Answered at once, no hedging.';
  await notes.getByLabel(PROBE.notesLabel).fill(note);
  await notes.getByLabel(PROBE.notesLabel).blur();
  await expect(saved).toHaveText(PROBE.saved);

  const tagBox = notes.getByLabel(PROBE.tagsLabel);
  await tagBox.fill('plain-answer');
  await tagBox.press('Enter');
  await expect(notes.getByTestId('tag-chip')).toHaveText(['plain-answer']);

  const finding = 'Rain poems are never refused.';
  await notes.getByLabel(PROBE.findingLabel).fill(finding);
  await notes.getByLabel(PROBE.findingLabel).blur();

  await expect
    .poll(async () => api<{ note_text: string }>('GET', `/api/runs/${run.id}/annotations`))
    .toMatchObject({ note_text: note, pattern_tags: ['plain-answer'], finding });

  await page.goto(`/probe/runs/${run.id}`);
  const again = page.getByTestId('notes-panel');
  await expect(again.getByLabel(PROBE.notesLabel)).toHaveValue(note);
  await expect(again.getByLabel(PROBE.findingLabel)).toHaveValue(finding);
  await expect(again.getByTestId('tag-chip')).toHaveText(['plain-answer']);
});

test('the newest history row opens the saved run, and a follow-up pushback grows the same thread', async ({
  page,
}) => {
  const seed = readSeed();
  const sess = await newSession('Saved');
  const run = await sendProbe(sess.id, seed.probes.refuseMe);
  await api('POST', `/api/runs/${run.id}/pushback`, { text: 'Why not?', source: 'override' });

  await openIn(page, sess);
  const history = rail(page).getByTestId('history-row').first();
  await expect(history).toHaveAttribute('href', `/probe/runs/${run.id}`);
  await history.click();
  await expect(page).toHaveURL(new RegExp(`/probe/runs/${run.id}$`));
  await expect(workspace(page)).toHaveAttribute('data-phase', 'done');
  await expect(workspace(page)).toContainText(PROBE.savedEyebrow(run.id));
  await expect(pickButton(row(page, 'refuse-me'))).toHaveAttribute('aria-current', 'true');
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).nth(1)).toContainText('Why not?');

  // Keep pushing continues this run's conversation (B09).
  const keep = page.getByTestId('keep-pushing');
  await keep.getByLabel(PROBE.keepLabel).fill('Please continue the scene.');
  await keep.getByRole('button', { name: PROBE.keepSend }).click();
  await expect(cards(page)).toHaveCount(5);
  await expect(cards(page).nth(3)).toContainText('Please continue the scene.');
  await expect(cards(page).nth(4)).toHaveAttribute('data-cls', 'collapsed');
  await expect(page).toHaveURL(new RegExp(`/probe/runs/${run.id}$`));

  const turns = await api<Turn[]>('GET', `/api/runs/${run.id}/turns`);
  expect(turns.map((t) => t.role)).toEqual([
    'probe',
    'response',
    'pushback',
    'response',
    'pushback',
    'response',
  ]);
  expect(turns[4].content).toBe('Please continue the scene.');
  expect(await runsOf(sess)).toHaveLength(1);
});

test('the response badge corrects the classifier: Negotiated is saved as the first classification', async ({
  page,
}) => {
  const seed = readSeed();
  const sess = await newSession('Badge');
  const run = await sendProbe(sess.id, seed.probes.refuseMe);
  expect(run.initial_classification).toBe('refused');

  await openIn(page, sess, `/probe/runs/${run.id}`);
  const response = cards(page).first();
  await expect(cards(page)).toHaveCount(1);
  await expect(response).toHaveAttribute('data-cls', 'refused');
  await response.getByRole('button', { name: /Change the classification/ }).click();

  const patched = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/runs/${run.id}/classification`) && r.request().method() === 'PATCH',
  );
  await response.getByRole('menuitemradio', { name: 'Negotiated' }).click();
  const res = await patched;
  expect(res.status()).toBe(200);
  expect(res.request().postDataJSON()).toEqual({
    field: 'initial_classification',
    value: 'negotiated',
  });
  await expect(response).toHaveAttribute('data-cls', 'negotiated');
  const [saved] = await runsOf(sess);
  expect(saved.initial_classification).toBe('negotiated');
});

test('a saved refused run opens in the pushback phase; a missing run says so', async ({ page }) => {
  const seed = readSeed();
  await page.goto(`/probe/runs/${seed.refusedRunId}`);
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(workspace(page)).toHaveAttribute('data-phase', 'pushback');
  await expect(page.locator('#pushback-text')).toHaveValue(COACH_DRAFT);
  await expect(pickButton(row(page, 'refuse-me'))).toHaveAttribute('aria-current', 'true');

  await page.goto('/probe/runs/999999');
  const missing = page.getByTestId('run-missing');
  await expect(missing).toContainText(PROBE.runMissing);
  await missing.getByRole('button', { name: PROBE.backToProbe }).click();
  await expect(page).toHaveURL(/\/probe$/);
});
