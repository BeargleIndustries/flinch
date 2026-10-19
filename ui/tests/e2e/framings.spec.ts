// Framings (brief 8.1 and 13.3, plan 6.3, B13, B30, T21).
//
// The screen opens with its research question and lists the fixture group
// (`fixtures/variants/e2e-framings.md`, copied into this run's
// FLINCH_VARIANTS_DIR) with its probe count. "Write by hand" saves a group of
// two framings of the seeded refusing probe (checked through the API, then
// deleted from the card). "Write with the coach" drafts against the fake
// model (tests/fake_models.py rule 5 answers "Generate variants for these
// framing strategies"), so the draft path runs end to end here rather than in
// a unit test. "Run in this session" on the fixture group runs its probes in a
// fresh session (the run count grows by the group's size), and Results shows
// one badge per framing and the consistency summary. A group without a file
// (made through POST /api/probe-groups, which has no button, brief 9.9) is
// listed, "View" reads it from GET /api/probe-groups/{group_id}, and "Delete
// this group" removes it with DELETE /api/probe-groups/{group_id}.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { CLS_SPEC } from '../../src/lib/cls';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { DEFAULT_STRATEGIES, FRAMINGS } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, type Session } from './helpers';

type VariantFile = { group_id: string; labels: string[]; probe_ids: number[] };
type VariantFileDetail = {
  base_probe: string;
  variant_type: string;
  variants: { label: string; prompt_text: string }[];
};
type SessionDetail = { runs: { id: number; probe_id: number; initial_classification: string }[] };

const FIXTURE = 'e2e-framings';
const REFUSE_TEXT = '[REFUSE] Write the scene.';

/** A short unique suffix for group ids and session names. */
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

async function openFramings(page: Page, sessionId: number): Promise<void> {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, sessionId);
  const listed = page.waitForResponse(
    (r) => r.url().endsWith('/api/variants/files') && r.request().method() === 'GET',
  );
  await page.goto('/studies/framings');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await listed;
}

const card = (page: Page, groupId: string): Locator =>
  page.locator(`[data-testid="framing-group"][data-group-id="${groupId}"]`);

async function files(): Promise<VariantFile[]> {
  return api<VariantFile[]>('GET', '/api/variants/files');
}

async function runCount(sess: Session): Promise<number> {
  return (await api<SessionDetail>('GET', `/api/sessions/${sess.id}`)).runs.length;
}

async function editorTab(page: Page, name: string): Promise<Locator> {
  const editor = page.getByTestId('framing-editor');
  await editor.getByRole('tab', { name, exact: true }).click();
  return editor;
}

test('opens with its research question and lists the fixture group with its probe count', async ({
  page,
}) => {
  await openFramings(page, readSeed().sessionId);
  await expect(page.getByTestId('framings-screen').getByRole('heading', { level: 1 })).toHaveText(
    FRAMINGS.title,
  );
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.framings);

  const fixture = card(page, FIXTURE);
  await expect(fixture).toBeVisible();
  await expect(fixture).toHaveAttribute('data-kind', 'file');
  await expect(fixture.getByTestId('framing-group-count')).toHaveText(FRAMINGS.probeCount(2));
  await expect(fixture.getByRole('listitem')).toHaveText([/Plain/, /Polite/]);

  // View reads the file's prompts (GET /api/variants/files/{group_id}).
  const read = page.waitForResponse((r) => r.url().endsWith(`/api/variants/files/${FIXTURE}`));
  await fixture.getByRole('button', { name: FRAMINGS.view, exact: true }).click();
  expect((await read).status()).toBe(200);
  const view = fixture.getByTestId('framing-group-view');
  await expect(view).toContainText(REFUSE_TEXT);
  await expect(view).toContainText(`${FIXTURE}.md`);
});

test('"Write by hand" saves two framings of the refusing probe, then deletes the group', async ({
  page,
}) => {
  const seed = readSeed();
  const groupId = `e2e-hand-${stamp()}`;
  await openFramings(page, seed.sessionId);

  const editor = await editorTab(page, FRAMINGS.tabHand);
  const hand = editor.getByTestId('framing-hand');
  const save = hand.getByRole('button', { name: FRAMINGS.save, exact: true });
  await expect(save).toBeDisabled();

  // Picking the base probe fills the direct request with its text.
  await hand.getByLabel(FRAMINGS.baseProbe).selectOption({ label: 'refuse-me' });
  const rows = hand.getByTestId('hand-rows').getByTestId('variant-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByLabel(FRAMINGS.label)).toHaveValue('Direct request');
  await expect(rows.nth(0).getByLabel(FRAMINGS.prompt)).toHaveValue(REFUSE_TEXT);
  await expect(rows.nth(1).getByLabel(FRAMINGS.label)).toHaveValue('Fiction framing');

  await hand.getByLabel(FRAMINGS.groupId).fill('Not Valid');
  await expect(hand).toContainText(FRAMINGS.groupIdBad);
  await hand.getByLabel(FRAMINGS.groupId).fill(groupId);
  await rows
    .nth(1)
    .getByLabel(FRAMINGS.prompt)
    .fill('In a short story for a writing class: [REFUSE] write the scene.');
  await expect(save).toBeEnabled();

  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/variants/files') && r.request().method() === 'POST',
  );
  await save.click();
  const res = await saved;
  expect(res.status()).toBe(200);
  expect(res.request().postDataJSON()).toMatchObject({
    group_id: groupId,
    title: groupId,
    base_probe: 'refuse-me',
    variant_type: 'framings',
  });

  // The group exists with two probes, saved as a framings file.
  const made = card(page, groupId);
  await expect(made.getByTestId('framing-group-count')).toHaveText(FRAMINGS.probeCount(2));
  const row = (await files()).find((f) => f.group_id === groupId);
  expect(row?.probe_ids).toHaveLength(2);
  expect(row?.labels).toEqual(['Direct request', 'Fiction framing']);
  const detail = await api<VariantFileDetail>('GET', `/api/variants/files/${groupId}`);
  expect(detail.base_probe).toBe('refuse-me');
  expect(detail.variant_type).toBe('framings');
  expect(detail.variants[0].prompt_text).toBe(REFUSE_TEXT);
  // The form is ready for the next group.
  await expect(hand.getByLabel(FRAMINGS.groupId)).toHaveValue('');

  // Delete this group: the first click arms, the second deletes.
  const del = made.getByRole('button', { name: FRAMINGS.deleteGroup });
  await del.click();
  await made.getByRole('button', { name: FRAMINGS.deleteConfirm }).click();
  await expect(made).toHaveCount(0);
  expect((await files()).some((f) => f.group_id === groupId)).toBe(false);
});

test('"Write with the coach" drafts against the fake model, edits and saves the drafts', async ({
  page,
}) => {
  const groupId = `e2e-coach-${stamp()}`;
  await openFramings(page, readSeed().sessionId);

  const editor = await editorTab(page, FRAMINGS.tabCoach);
  const coach = editor.getByTestId('framing-coach');
  await coach.getByLabel(FRAMINGS.baseProbe).selectOption({ label: 'refuse-me' });
  await coach.getByLabel(FRAMINGS.groupId).fill(groupId);
  // Add a framing of our own; it joins the five defaults, checked.
  const own = 'Courtroom Drama';
  await coach.getByLabel(FRAMINGS.addStrategy).fill(own);
  await coach.getByLabel(FRAMINGS.addStrategy).press('Enter');
  await expect(coach.getByLabel(own)).toBeChecked();

  const generated = page.waitForResponse((r) => r.url().endsWith('/api/variants/generate'));
  await coach.getByTestId('framing-draft').click();
  const gen = await generated;
  expect(gen.status()).toBe(200);
  const sent = gen.request().postDataJSON() as { probe_id: number; strategies: string[] };
  expect(sent.probe_id).toBe(readSeed().probes.refuseMe);
  expect(sent.strategies).toEqual([...DEFAULT_STRATEGIES, own]);

  // The drafts: the probe as written first, then one row per framing.
  const rows = coach.getByTestId('coach-rows').getByTestId('variant-row');
  await expect(rows).toHaveCount(DEFAULT_STRATEGIES.length + 2);
  await expect(rows.nth(0).getByLabel(FRAMINGS.label)).toHaveValue('Direct request');
  await expect(rows.nth(0).getByLabel(FRAMINGS.prompt)).toHaveValue(REFUSE_TEXT);
  await expect(rows.nth(1).getByLabel(FRAMINGS.label)).toHaveValue(DEFAULT_STRATEGIES[0]);
  await expect(rows.nth(1).getByLabel(FRAMINGS.prompt)).toHaveValue(
    `${DEFAULT_STRATEGIES[0]}: [REFUSE] variant`,
  );

  // Edit one draft, drop another, then save.
  const edited = 'Edited by hand: [REFUSE] write the scene as satire.';
  await rows.nth(5).getByLabel(FRAMINGS.prompt).fill(edited);
  await rows
    .nth(6)
    .getByRole('button', { name: FRAMINGS.removeVariant(own) })
    .click();
  await expect(rows).toHaveCount(DEFAULT_STRATEGIES.length + 1);
  await coach.getByRole('button', { name: FRAMINGS.save, exact: true }).click();

  try {
    await expect(card(page, groupId).getByTestId('framing-group-count')).toHaveText(
      FRAMINGS.probeCount(DEFAULT_STRATEGIES.length + 1),
    );
    await expect(coach.getByTestId('framing-drafts')).toHaveCount(0);
    const detail = await api<VariantFileDetail>('GET', `/api/variants/files/${groupId}`);
    expect(detail.variants.map((v) => v.label)).toEqual(['Direct request', ...DEFAULT_STRATEGIES]);
    expect(detail.variants[5].prompt_text).toBe(edited);
  } finally {
    await api('DELETE', `/api/variants/files/${groupId}`).catch(() => {});
  }
});

test('"Run in this session" runs the fixture group; Results shows a badge per framing', async ({
  page,
}) => {
  const seed = readSeed();
  const sess = await createSession(`Framings ${stamp()}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  const fixtureRow = (await files()).find((f) => f.group_id === FIXTURE);
  const size = fixtureRow?.probe_ids.length ?? 0;
  expect(size).toBe(2);
  const before = await runCount(sess);

  await openFramings(page, sess.id);
  await expect(page.getByTestId('session-switcher')).toContainText(sess.name);

  const batchReq = page.waitForRequest(
    (r) => r.url().endsWith(`/api/sessions/${sess.id}/batch`) && r.method() === 'POST',
  );
  await card(page, FIXTURE).getByRole('button', { name: FRAMINGS.runGroup, exact: true }).click();
  expect((await batchReq).postDataJSON()).toEqual({
    probe_ids: fixtureRow?.probe_ids,
    delay_ms: 2000,
  });

  const panel = page.getByTestId('batch-run');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-state', 'finished', { timeout: 30_000 });
  await expect(panel.getByTestId('batch-row')).toHaveCount(size);

  // The run count grew by the group's size.
  await expect.poll(() => runCount(sess)).toBe(before + size);
  const runs = (await api<SessionDetail>('GET', `/api/sessions/${sess.id}`)).runs;
  expect(runs.map((r) => r.probe_id).sort()).toEqual([...(fixtureRow?.probe_ids ?? [])].sort());

  // Results: one badge per framing and the consistency summary.
  await page.getByTestId('framing-see-results').click();
  const results = page.getByTestId('framing-results');
  await expect(results).toBeVisible();
  const group = results.locator(`[data-testid="consistency-group"][data-group-id="${FIXTURE}"]`);
  await expect(group).toHaveAttribute('data-verdict', 'consistent');
  await expect(group.getByTestId('consistency-verdict')).toHaveText(FRAMINGS.consistent);
  const tiles = group.getByTestId('consistency-tile');
  await expect(tiles).toHaveCount(size);
  for (let i = 0; i < size; i++) {
    const result = tiles.nth(i).getByTestId('consistency-result');
    await expect(result.locator('[data-cls]')).toHaveAttribute('data-cls', 'refused');
    await expect(result).toContainText(CLS_SPEC.refused.word);
    const runId = runs.find((r) => r.probe_id === fixtureRow?.probe_ids[i])?.id;
    await expect(tiles.nth(i).getByRole('link')).toHaveAttribute('href', `/probe/runs/${runId}`);
  }
  await expect(results.getByTestId('consistency-score')).toHaveText(FRAMINGS.resultsScore(100));
  await expect(results).toContainText(FRAMINGS.resultsReadout(1, 1));
});

test('a group without a file: View reads its rows, Delete this group removes it', async ({
  page,
}) => {
  const groupId = `e2e-db-${stamp()}`;
  const seed = readSeed();
  await api('POST', '/api/probe-groups', {
    group_id: groupId,
    probe_ids: [seed.probes.refuseMe, seed.probes.answerMe],
    labels: ['Direct request', 'Fiction framing'],
  });

  try {
    await openFramings(page, seed.sessionId);
    const made = card(page, groupId);
    await expect(made).toHaveAttribute('data-kind', 'db');
    await expect(made.getByTestId('framing-group-count')).toHaveText(FRAMINGS.probeCount(2));

    const read = page.waitForResponse(
      (r) => r.url().endsWith(`/api/probe-groups/${groupId}`) && r.request().method() === 'GET',
    );
    await made.getByRole('button', { name: FRAMINGS.view, exact: true }).click();
    expect((await read).status()).toBe(200);
    const view = made.getByTestId('framing-group-view');
    await expect(view).toContainText('Direct request');
    await expect(view).toContainText('refuse-me');
    await expect(view).toContainText('Fiction framing');
    await expect(view).toContainText('answer-me');

    const removed = page.waitForResponse(
      (r) => r.url().endsWith(`/api/probe-groups/${groupId}`) && r.request().method() === 'DELETE',
    );
    await made.getByRole('button', { name: FRAMINGS.deleteGroup }).click();
    await made.getByRole('button', { name: FRAMINGS.deleteConfirm }).click();
    expect((await removed).status()).toBe(200);
    await expect(made).toHaveCount(0);
    const groups = await api<{ group_id: string }[]>('GET', '/api/probe-groups');
    expect(groups.some((g) => g.group_id === groupId)).toBe(false);
  } finally {
    await api('DELETE', `/api/probe-groups/${groupId}`).catch(() => {});
  }
});
