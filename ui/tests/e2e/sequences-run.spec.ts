// Sequences, Run tab (brief 8.4, 9.9 and 13.3, plan 6.3, B02, B09, B12, T25).
//
// Each test runs in a fresh session holding the two seeded probes. The fake
// model (tests/fake_models.py) writes one line of story for every coach call
// (rule 4) and answers the target turns; refuse-me's "[REFUSE]" survives the
// coach's adaptation, so the probe turn is classified like any other reply.
// The interactive sequence advances two warmup turns (POST run-turn twice,
// each rebuilding the conversation from the stored turns, B09), then drops the
// probe: the setup and probe turns appear, the sequence is `completed` (B12)
// and its run holds all eight turns. The batch runs two probes in `fixed_n`
// mode at depth 1 (B02: fixed_n is honoured); its estimate shows a cost and
// the depth, and the batch row ends `complete`. The Strategies panel creates,
// edits and deletes a custom strategy through StrategyDialog.
import { expect, test, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { SEQUENCES, STRATEGY_DIALOG } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, type Session } from './helpers';

type SequenceRow = {
  id: number;
  strategy_id: number;
  probe_id: number;
  mode: string;
  status: string;
  max_warmup_turns: number;
  batch_id: number | null;
};
type SequenceSummary = SequenceRow & {
  runs: { id: number; status: string; warmup_count: number; probe_classification: string | null }[];
};
type Turn = { turn_number: number; role: string; turn_type: string; classification: string | null };
type Batch = {
  id: number;
  status: string;
  mode: string;
  fixed_n: number | null;
  probes_total: number;
  probes_completed: number;
};
type Strategy = { id: number; name: string; description: string; is_builtin: number };

const CLASSES = /^(refused|collapsed|negotiated|complied|unknown)$/;

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

async function freshSession(): Promise<Session> {
  const seed = readSeed();
  return createSession(`E2E sequences ${stamp()}`, [seed.probes.refuseMe, seed.probes.answerMe]);
}

/** Opens /studies/sequences on `sessionId` and waits for its list and the strategies. */
async function openSequences(page: Page, sessionId: number): Promise<void> {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, sessionId);
  const listed = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sessions/${sessionId}/sequences`),
  );
  const strategies = page.waitForResponse((r) => r.url().endsWith('/api/strategies'));
  await page.goto('/studies/sequences');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await listed;
  await strategies;
}

const card = (page: Page, id: number): Locator =>
  page.locator(`[data-testid="sequence-card"][data-sequence-id="${id}"]`);

const probeBox = (scope: Locator, name: string) =>
  scope.getByRole('checkbox', { name: new RegExp(`^${name}\\b`) });

test('opens with its research question, the two tabs and an empty list', async ({ page }) => {
  const sess = await freshSession();
  await openSequences(page, sess.id);

  const screen = page.getByTestId('sequences-screen');
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText(SEQUENCES.title);
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.sequences);
  await expect(screen.getByRole('tab')).toHaveText([SEQUENCES.tabRun, SEQUENCES.tabResults]);
  await expect(page.getByTestId('sequence-empty')).toContainText(SEQUENCES.empty);

  // The probe select lists the session's probes plus "Custom prompt…".
  const probe = page.getByTestId('sequence-probe');
  // A session probe is picked by default, not the custom fallback.
  await expect(probe).not.toHaveValue('custom');
  const options = probe.locator('option');
  await expect(options).toHaveCount(3);
  await expect(options.filter({ hasText: /^refuse-me$/ })).toHaveCount(1);
  await expect(options.filter({ hasText: /^answer-me$/ })).toHaveCount(1);
  await expect(options.last()).toHaveText(SEQUENCES.customOption);
  await probe.selectOption({ label: SEQUENCES.customOption });
  await expect(page.getByTestId('sequence-custom')).toBeVisible();
});

test('an interactive sequence advances two turns, drops the probe and exports JSON', async ({
  page,
}) => {
  const sess = await freshSession();
  await openSequences(page, sess.id);

  const form = page.getByTestId('sequence-new');
  const strategy = form.getByTestId('sequence-strategy');
  const defaultStrategy = Number(await strategy.inputValue());
  expect(defaultStrategy).toBeGreaterThan(0);

  await form.getByTestId('sequence-probe').selectOption({ label: 'refuse-me' });
  await form.getByTestId('sequence-mode-interactive').check();
  // Max warmup 2: the range from its minimum, one step up.
  const range = form.getByTestId('sequence-warmup');
  await range.focus();
  await range.press('Home');
  await range.press('ArrowRight');
  await expect(form.getByTestId('sequence-warmup-value')).toHaveText(SEQUENCES.warmupValue(2));

  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/sessions/${sess.id}/sequences`) && r.request().method() === 'POST',
  );
  await form.getByTestId('sequence-create').click();
  const createdRes = await created;
  expect(createdRes.status()).toBe(200);
  const seq = (await createdRes.json()) as SequenceRow & { current_run_id: number };
  expect(seq).toMatchObject({ mode: 'interactive', max_warmup_turns: 2, status: 'pending' });
  expect(seq.strategy_id).toBe(defaultStrategy);

  const c = card(page, seq.id);
  await expect(c).toHaveAttribute('data-mode', 'interactive');
  await expect(c.getByTestId('sequence-probe-name')).toHaveText('refuse-me');
  await expect(c.getByTestId('sequence-sent')).toHaveText(SEQUENCES.sentOf(0, 2));
  await expect(c.getByTestId('thread-empty')).toBeVisible();

  // Two Next turn calls: two coach warmups, each answered by the model.
  for (const n of [1, 2]) {
    const turned = page.waitForResponse((r) =>
      r.url().endsWith(`/api/sequences/${seq.id}/run-turn`),
    );
    await c.getByTestId('sequence-next-turn').click();
    expect((await turned).status()).toBe(200);
    await expect(c.getByTestId('thread-turn')).toHaveCount(n * 2);
    await expect(c.getByTestId('sequence-sent')).toHaveText(SEQUENCES.sentOf(n, 2));
  }
  const thread = c.getByTestId('sequence-thread');
  await expect(thread.locator('[data-role="coach"][data-turn-type="warmup"]')).toHaveCount(2);
  await expect(thread.locator('[data-role="coach"]').getByTestId('turn-type-chip')).toHaveText([
    SEQUENCES.warmupN(1),
    SEQUENCES.warmupN(2),
  ]);
  for (const reply of await thread.locator('[data-role="target"]').all())
    await expect(reply).toHaveAttribute('data-cls', CLASSES);

  // Drop the probe: the setup turn, the probe and the model's answer with its badge.
  const dropped = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sequences/${seq.id}/drop-probe`),
  );
  await c.getByTestId('sequence-drop-probe').click();
  expect((await dropped).status()).toBe(200);
  await expect(c).toHaveAttribute('data-status', 'completed');
  await expect(c.getByTestId('thread-turn')).toHaveCount(8);
  await expect(thread.locator('[data-role="coach"][data-turn-type="setup"]')).toHaveCount(1);
  const probeTurn = thread.locator('[data-role="probe"][data-turn-type="probe"]');
  await expect(probeTurn).toHaveCount(1);
  await expect(probeTurn.getByTestId('turn-type-chip')).toHaveText(SEQUENCES.turnTypes.probe);
  const answer = thread.locator('[data-role="target"][data-turn-type="probe"]');
  await expect(answer).toHaveAttribute('data-cls', CLASSES);
  await expect(answer.getByTestId('turn-badge')).toBeVisible();
  await expect(c.getByTestId('sequence-probe-result')).toContainText(SEQUENCES.probeResult);
  await expect(c.getByTestId('sequence-next-turn')).toHaveCount(0);
  await expect(c.getByTestId('sequence-show-results')).toBeVisible();

  // Via the API: completed, one run with every turn stored.
  const summary = await api<SequenceSummary>('GET', `/api/sequences/${seq.id}`);
  expect(summary.status).toBe('completed');
  expect(summary.runs).toHaveLength(1);
  expect(summary.runs[0]).toMatchObject({ id: seq.current_run_id, status: 'completed' });
  expect(summary.runs[0].probe_classification).toMatch(CLASSES);
  const turns = await api<Turn[]>('GET', `/api/sequence-runs/${summary.runs[0].id}/turns`);
  expect(turns.map((t) => `${t.role}:${t.turn_type}`)).toEqual([
    'coach:warmup',
    'target:warmup',
    'coach:warmup',
    'target:warmup',
    'coach:setup',
    'target:setup',
    'probe:probe',
    'target:probe',
  ]);

  // Export JSON downloads the sequence with its turns.
  await c.getByTestId('sequence-export-toggle').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    c.getByTestId('sequence-export-json').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(new RegExp(`^flinch-sequence-${seq.id}-.*\\.json$`));
  const body = JSON.parse(fs.readFileSync(await download.path(), 'utf8')) as {
    export_type: string;
    sequence: unknown;
  };
  expect(body.export_type).toBe('sequence');
  expect(body.sequence).toBeTruthy();

  // Show results switches to the Results tab with this sequence picked.
  await c.getByTestId('sequence-show-results').click();
  await expect(page.getByRole('tab', { name: SEQUENCES.tabResults, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('sequence-results')).toHaveAttribute(
    'data-sequence-id',
    String(seq.id),
  );
});

test('a fixed_n batch of two probes estimates a cost, then runs to complete', async ({ page }) => {
  const sess = await freshSession();
  await openSequences(page, sess.id);

  const batch = page.getByTestId('sequence-batch');
  const estimateButton = batch.getByTestId('batch-estimate-button');
  await expect(estimateButton).toBeDisabled();
  await expect(batch.getByTestId('batch-start')).toBeDisabled();

  await probeBox(batch, 'refuse-me').check();
  await probeBox(batch, 'answer-me').check();
  await batch.getByTestId('batch-mode-fixed_n').check();
  await batch.getByTestId('batch-depth').fill('1');

  const estimated = page.waitForResponse((r) =>
    /\/api\/sequence-batches\/\d+\/estimate$/.test(r.url()),
  );
  await estimateButton.click();
  expect((await estimated).status()).toBe(200);

  const estimate = batch.getByTestId('batch-estimate');
  await expect(estimate).toBeVisible();
  const cost = (await batch.getByTestId('estimate-cost').textContent())?.trim() ?? '';
  expect(cost).toMatch(/^\$\d+\.\d{2}$/);
  expect(Number(cost.slice(1))).toBeGreaterThan(0);
  await expect(batch.getByTestId('estimate-warmup')).toHaveText(SEQUENCES.estimateDepth(1));
  await expect(estimate).toContainText(SEQUENCES.estimateLine(2, 6));

  const batchId = Number(await batch.getAttribute('data-batch-id'));
  expect(batchId).toBeGreaterThan(0);
  const saved = await api<Batch>('GET', `/api/sequence-batches/${batchId}`);
  expect(saved).toMatchObject({ mode: 'fixed_n', fixed_n: 1, probes_total: 2, status: 'pending' });

  // Changing a field drops the estimate; putting it back does not bring it back.
  await batch.getByTestId('batch-depth').fill('2');
  await expect(batch.getByTestId('batch-estimate-stale')).toHaveText(SEQUENCES.estimateStale);
  await expect(batch.getByTestId('batch-start')).toBeDisabled();
  await batch.getByTestId('batch-depth').fill('1');
  await expect(batch.getByTestId('batch-start')).toBeEnabled();

  const started = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sequence-batches/${batchId}/start`),
  );
  await batch.getByTestId('batch-start').click();
  expect((await started).status()).toBe(200);

  const live = batch.getByTestId('batch-live');
  await expect(live).toHaveAttribute('data-state', 'finished', { timeout: 60_000 });
  const rows = live.getByTestId('batch-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: 'refuse-me:' })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'answer-me:' })).toHaveCount(1);

  const done = await api<Batch>('GET', `/api/sequence-batches/${batchId}`);
  expect(done).toMatchObject({ status: 'complete', probes_completed: 2 });

  // Both sequences are listed, completed at depth 1.
  const rowsApi = await api<SequenceRow[]>('GET', `/api/sessions/${sess.id}/sequences`);
  const mine = rowsApi.filter((s) => s.batch_id === batchId);
  expect(mine).toHaveLength(2);
  for (const s of mine) {
    expect(s).toMatchObject({ mode: 'fixed_n', max_warmup_turns: 1, status: 'completed' });
    await expect(card(page, s.id)).toHaveAttribute('data-status', 'completed');
  }
});

test('the Strategies panel creates, edits and deletes a strategy', async ({ page }) => {
  const sess = await freshSession();
  await openSequences(page, sess.id);

  const panel = page.getByTestId('strategy-list');
  // Built-in strategies have no edit actions.
  const builtin = panel.locator('[data-testid="strategy-row"][data-builtin="true"]').first();
  await expect(builtin).toBeVisible();
  await expect(builtin.getByTestId('strategy-edit')).toHaveCount(0);

  const name = `e2e_noir_${stamp()}`;
  const title = name.replace(/_/g, ' ');
  await page.getByTestId('strategy-new').click();
  const dialog = page.getByTestId('strategy-dialog');
  await expect(dialog).toBeVisible();

  // Required fields first.
  await page.getByTestId('strategy-save').click();
  await expect(dialog.getByTestId('strategy-problem')).toHaveText(STRATEGY_DIALOG.required);

  await dialog.getByTestId('strategy-field-name').fill(name);
  await dialog.getByTestId('strategy-field-category').fill('fiction');
  await dialog.getByTestId('strategy-field-description').fill('Rain, smoke and a case.');
  await dialog.getByTestId('strategy-field-goal').fill('A detective story.');
  await dialog.getByTestId('strategy-field-opening_pattern').fill('Open in the office.');
  await dialog.getByTestId('strategy-field-escalation_pattern').fill('Raise the stakes.');
  await dialog.getByTestId('strategy-field-setup_hint').fill('Lead into the request.');

  const createdRes = page.waitForResponse(
    (r) => r.url().endsWith('/api/strategies') && r.request().method() === 'POST',
  );
  await page.getByTestId('strategy-save').click();
  expect((await createdRes).status()).toBe(200);
  await expect(dialog).toBeHidden();

  const row = panel.locator('[data-testid="strategy-row"]').filter({ hasText: title });
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('data-builtin', 'false');
  const id = Number(await row.getAttribute('data-strategy-id'));

  // It appears in the New sequence select as "{name} ({category})".
  const select = page.getByTestId('sequence-new').getByTestId('sequence-strategy');
  await expect(select.locator(`option[value="${id}"]`)).toHaveText(`${title} (fiction)`);
  await select.selectOption({ label: `${title} (fiction)` });
  await expect(select).toHaveValue(String(id));

  // Edit: the dialog reads the stored fields (GET, fields disabled until it
  // lands, so a fill cannot be overwritten), and the change is saved with PUT.
  const fresh = page.waitForResponse(
    (r) => r.url().endsWith(`/api/strategies/${id}`) && r.request().method() === 'GET',
  );
  await row.getByTestId('strategy-edit').click();
  expect((await fresh).status()).toBe(200);
  await expect(dialog).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.getByTestId('strategy-field-description')).toBeEnabled();
  await expect(dialog.getByTestId('strategy-field-goal')).toHaveValue('A detective story.');
  await dialog.getByTestId('strategy-field-description').fill('Rain and a second case.');
  const updated = page.waitForResponse(
    (r) => r.url().endsWith(`/api/strategies/${id}`) && r.request().method() === 'PUT',
  );
  await page.getByTestId('strategy-save').click();
  expect((await updated).status()).toBe(200);
  await expect(row).toContainText('Rain and a second case.');
  const stored = await api<Strategy>('GET', `/api/strategies/${id}`);
  expect(stored.description).toBe('Rain and a second case.');

  // Delete: two clicks on the ConfirmButton.
  const deleteButton = row.getByRole('button', { name: SEQUENCES.deleteStrategy });
  await deleteButton.click();
  const deleted = page.waitForResponse(
    (r) => r.url().endsWith(`/api/strategies/${id}`) && r.request().method() === 'DELETE',
  );
  await row.getByRole('button', { name: SEQUENCES.deleteStrategyConfirm }).click();
  expect((await deleted).status()).toBe(200);
  await expect(row).toHaveCount(0);
  await expect(select.locator(`option[value="${id}"]`)).toHaveCount(0);
  const all = await api<Strategy[]>('GET', '/api/strategies');
  expect(all.some((s) => s.id === id)).toBe(false);
});
