// Sequences, Results tab (brief 8.4, D21, D30, I20, plan 6.3 C-M4, T26).
//
// Each test runs in a fresh session holding the two seeded probes. The fake
// model (tests/fake_models.py rule 6) refuses refuse-me's "[REFUSE]" while
// fewer than three user messages exist and complies after, so:
// - an interactive sequence at 2 warmup turns ends with W, W, S and P replies
//   and one run, which was not whittled ("One run at 2 warmup turns.", no
//   threshold in the table);
// - whittling from 3 warmup turns gets through at 3 and 2 and is Refused at 1
//   (one warmup turn is the setup alone: two user messages), so the threshold
//   is 2 turns.
// The session-level panels count completed sequences only (I20): a sequence
// that is not completed (here one still taking turns) is not in "Thresholds
// across probes", is not counted in "Strategy effectiveness" (the sidecar's
// effectiveness rows count every status, so the screen corrects them), and a
// note says it was left out.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { SEQUENCE_RESULTS, SEQUENCES } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, type Session } from './helpers';

type SequenceRow = {
  id: number;
  strategy_id: number;
  probe_id: number;
  mode: string;
  status: string;
  max_warmup_turns: number;
};
type SequenceSummary = SequenceRow & {
  runs: { id: number; status: string; warmup_count: number; probe_classification: string | null }[];
};
type WhittlingRow = { warmup_count: number; probe_classification: string | null };
type Strategy = { id: number; name: string };

const CLASSES = /^(refused|collapsed|negotiated|complied|unknown)$/;
const GOT_THROUGH = new Set(['complied', 'collapsed']);

/** A short unique suffix for names. */
const stamp = () => String(Date.now()).slice(-7);

/** "fiction_workshop" reads "fiction workshop" (sequences.ts strategyTitle). */
const title = (name: string) => name.replace(/_+/g, ' ').trim();

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
  return createSession(`E2E sequence results ${stamp()}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
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

/** The New sequence form with refuse-me, `strategyId` and `warmup` turns (from the minimum). */
async function fillForm(page: Page, strategyId: number, warmup: number, interactive: boolean) {
  const form = page.getByTestId('sequence-new');
  await form.getByTestId('sequence-strategy').selectOption(String(strategyId));
  await form.getByTestId('sequence-probe').selectOption({ label: 'refuse-me' });
  await form.getByTestId(`sequence-mode-${interactive ? 'interactive' : 'automatic'}`).check();
  const range = form.getByTestId('sequence-warmup');
  await range.focus();
  await range.press('Home');
  for (let i = 1; i < warmup; i++) await range.press('ArrowRight');
  await expect(form.getByTestId('sequence-warmup-value')).toHaveText(SEQUENCES.warmupValue(warmup));
  return form;
}

/** Creates an interactive sequence, takes two warmup turns and drops the probe (sequences-run flow). */
async function completeInteractive(
  page: Page,
  sessionId: number,
  strategyId: number,
): Promise<SequenceRow> {
  const form = await fillForm(page, strategyId, 2, true);
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/sessions/${sessionId}/sequences`) && r.request().method() === 'POST',
  );
  await form.getByTestId('sequence-create').click();
  const res = await created;
  expect(res.status()).toBe(200);
  const seq = (await res.json()) as SequenceRow;
  expect(seq).toMatchObject({ mode: 'interactive', strategy_id: strategyId, status: 'pending' });

  const c = card(page, seq.id);
  for (const n of [1, 2]) {
    const turned = page.waitForResponse((r) =>
      r.url().endsWith(`/api/sequences/${seq.id}/run-turn`),
    );
    await c.getByTestId('sequence-next-turn').click();
    expect((await turned).status()).toBe(200);
    await expect(c.getByTestId('sequence-sent')).toHaveText(SEQUENCES.sentOf(n, 2));
  }
  const dropped = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sequences/${seq.id}/drop-probe`),
  );
  await c.getByTestId('sequence-drop-probe').click();
  expect((await dropped).status()).toBe(200);
  await expect(c).toHaveAttribute('data-status', 'completed');
  return seq;
}

/** The strategy ids the New sequence select offers, in order. */
async function strategyIds(page: Page): Promise<number[]> {
  const values = await page
    .getByTestId('sequence-new')
    .getByTestId('sequence-strategy')
    .locator('option')
    .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  return values.map(Number).filter((n) => n > 0);
}

/** Clicks the Results tab and waits for the session-level reads. */
async function openResults(page: Page, sessionId: number): Promise<Locator> {
  const thresholds = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sessions/${sessionId}/thresholds`),
  );
  const effectiveness = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sessions/${sessionId}/strategy-effectiveness`),
  );
  await page.getByRole('tab', { name: SEQUENCES.tabResults, exact: true }).click();
  expect((await thresholds).status()).toBe(200);
  expect((await effectiveness).status()).toBe(200);
  const results = page.getByTestId('sequence-results');
  await expect(results).toHaveAttribute('aria-busy', 'false');
  return results;
}

test('with no completed sequence the Results tab says so and links back to Run', async ({
  page,
}) => {
  const sess = await freshSession();
  await openSequences(page, sess.id);
  const results = await openResults(page, sess.id);

  await expect(results.getByTestId('results-none')).toContainText(SEQUENCE_RESULTS.noneTitle);
  await expect(results.getByTestId('results-pick')).toBeDisabled();
  await expect(results.getByTestId('thresholds-empty')).toHaveText(SEQUENCE_RESULTS.acrossEmpty);
  await expect(results.getByTestId('effectiveness-empty')).toHaveText(SEQUENCE_RESULTS.effectEmpty);
  await expect(results.getByTestId('results-excluded')).toHaveCount(0);

  await results.getByRole('button', { name: SEQUENCE_RESULTS.openRun }).click();
  await expect(page.getByRole('tab', { name: SEQUENCES.tabRun, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('sequence-new')).toBeVisible();
});

test('two interactive sequences: turn by turn, runs, thresholds across probes, the strategy filter and effectiveness; an unfinished one is left out', async ({
  page,
}) => {
  const sess = await freshSession();
  const seed = readSeed();
  await openSequences(page, sess.id);

  const [stratA, stratB] = await strategyIds(page);
  expect(stratA).toBeGreaterThan(0);
  expect(stratB).toBeGreaterThan(0);
  const all = await api<Strategy[]>('GET', '/api/strategies');
  const nameOf = (id: number) => title(all.find((s) => s.id === id)?.name ?? '');

  const a = await completeInteractive(page, sess.id, stratA);
  const b = await completeInteractive(page, sess.id, stratB);

  // A third sequence on strategy A, not completed: one warmup turn, no probe. Run-turn
  // leaves the sequence itself `pending` (only its run is `running`).
  const c = await api<SequenceRow & { current_run_id: number }>(
    'POST',
    `/api/sessions/${sess.id}/sequences`,
    {
      probe_id: seed.probes.refuseMe,
      strategy_id: stratA,
      mode: 'interactive',
      max_warmup_turns: 2,
      use_narrative_engine: false,
    },
  );
  await api('POST', `/api/sequences/${c.id}/run-turn`);
  const cNow = await api<SequenceSummary>('GET', `/api/sequences/${c.id}`);
  expect(cNow.status).not.toBe('completed');

  const results = await openResults(page, sess.id);

  // The picker offers the two completed sequences, newest first; B is picked.
  const pickSelect = results.getByTestId('results-pick');
  await expect(pickSelect).toBeEnabled();
  await expect(pickSelect.locator('option')).toHaveCount(2);
  await expect(pickSelect).toHaveValue(String(b.id));
  await expect(results).toHaveAttribute('data-sequence-id', String(b.id));

  // Pick A: its threshold panel, turn by turn and runs.
  const whittled = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sequences/${a.id}/whittling`),
  );
  const classified = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sequences/${a.id}/turn-classifications`),
  );
  await pickSelect.selectOption(String(a.id));
  expect((await whittled).status()).toBe(200);
  expect((await classified).status()).toBe(200);
  await expect(results).toHaveAttribute('data-sequence-id', String(a.id));
  const detail = results.getByTestId('sequence-detail');
  await expect(detail).toHaveAttribute('aria-busy', 'false');

  const aWhittling = await api<WhittlingRow[]>('GET', `/api/sequences/${a.id}/whittling`);
  expect(aWhittling).toHaveLength(1);
  const warmup = aWhittling[0].warmup_count;
  const panel = detail.getByTestId('threshold-panel');
  await expect(panel).toHaveAttribute('data-kind', 'single');
  await expect(detail.getByTestId('threshold-readout')).toHaveText(SEQUENCE_RESULTS.single(warmup));
  await expect(detail.getByTestId('threshold-headline')).toHaveText(SEQUENCE_RESULTS.noThreshold);
  const bars = panel.getByTestId('threshold-bar');
  await expect(bars).toHaveCount(1);
  await expect(bars.first()).toHaveAttribute('data-warmup', String(warmup));
  await expect(bars.first()).toHaveAttribute('data-threshold', 'false');

  // Turn by turn: one row per run, a square per model reply with W, W, S, P and badges.
  const aSummary = await api<SequenceSummary>('GET', `/api/sequences/${a.id}`);
  const aRun = aSummary.runs[0];
  const row = detail.getByTestId('turn-row');
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('data-run-id', String(aRun.id));
  await expect(row).toContainText(SEQUENCE_RESULTS.runLabel(warmup));
  const cells = row.getByTestId('turn-cell');
  await expect(cells).toHaveCount(4);
  await expect(cells.locator('[aria-hidden="true"]')).toHaveText(['W', 'W', 'S', 'P']);
  for (const [i, type] of ['warmup', 'warmup', 'setup', 'probe'].entries()) {
    await expect(cells.nth(i)).toHaveAttribute('data-type', type);
    await expect(cells.nth(i)).toHaveAttribute('data-cls', CLASSES);
  }
  await expect(row.getByTestId('turn-row-probe')).toContainText(SEQUENCE_RESULTS.probeAt);

  // Runs: the run opens its transcript (GET /api/sequence-runs/{id}/turns).
  const runRow = detail.locator(`[data-testid="run-row"][data-run-id="${aRun.id}"]`);
  await expect(runRow).toBeVisible();
  const turnsRead = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sequence-runs/${aRun.id}/turns`),
  );
  await runRow.getByTestId('run-toggle').click();
  expect((await turnsRead).status()).toBe(200);
  await expect(runRow.getByTestId('run-toggle')).toHaveAttribute('aria-expanded', 'true');
  const thread = runRow.getByTestId('run-turns');
  await expect(thread.getByTestId('thread-turn')).toHaveCount(8);
  await expect(thread.locator('[data-role="probe"][data-turn-type="probe"]')).toHaveCount(1);
  await expect(thread.getByTestId('turn-type-chip').first()).toHaveText(SEQUENCES.warmupN(1));

  // Thresholds across probes: both completed sequences with their strategies; not the running one.
  const table = results.getByTestId('thresholds-table');
  const rows = table.getByTestId('threshold-row');
  await expect(rows).toHaveCount(2);
  for (const [seq, strat] of [
    [a, stratA],
    [b, stratB],
  ] as const) {
    const r = table.locator(`[data-testid="threshold-row"][data-sequence-id="${seq.id}"]`);
    await expect(r.getByTestId('threshold-cell-probe')).toHaveText('refuse-me');
    await expect(r.getByTestId('threshold-cell-strategy')).toHaveText(nameOf(strat));
    await expect(r.getByTestId('threshold-cell-turns')).toHaveText(SEQUENCE_RESULTS.noThreshold);
    await expect(r.getByTestId('threshold-cell-runs')).toHaveText('1');
  }
  await expect(table.locator(`[data-sequence-id="${c.id}"]`)).toHaveCount(0);

  // The note names what was left out.
  await expect(results.getByTestId('results-excluded')).toHaveText(
    SEQUENCE_RESULTS.excluded(SEQUENCE_RESULTS.excludedPart(1, cNow.status)),
  );

  // A probe name in the table picks that sequence above.
  await table
    .locator(`[data-testid="threshold-row"][data-sequence-id="${b.id}"]`)
    .getByTestId('threshold-cell-probe')
    .click();
  await expect(results).toHaveAttribute('data-sequence-id', String(b.id));
  await expect(pickSelect).toHaveValue(String(b.id));

  // Filter by strategy B: one row (GET ...thresholds?strategy_id=B).
  const filter = results.getByTestId('threshold-filter');
  await expect(filter).toBeEnabled();
  await expect(filter.locator('option')).toHaveCount(3);
  const filtered = page.waitForResponse((r) =>
    r.url().endsWith(`/api/sessions/${sess.id}/thresholds?strategy_id=${stratB}`),
  );
  await filter.selectOption(String(stratB));
  expect((await filtered).status()).toBe(200);
  await expect(table).toHaveAttribute('data-filter', String(stratB));
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-sequence-id', String(b.id));
  await expect(rows.first().getByTestId('threshold-cell-strategy')).toHaveText(nameOf(stratB));
  await filter.selectOption('');
  await expect(table).toHaveAttribute('data-filter', '');
  await expect(rows).toHaveCount(2);

  // Strategy effectiveness: a row per strategy, completed sequences only (A counts 1, not 2).
  const bSummary = await api<SequenceSummary>('GET', `/api/sequences/${b.id}`);
  for (const [summary, strat] of [
    [aSummary, stratA],
    [bSummary, stratB],
  ] as const) {
    const success = summary.runs.some((r) => GOT_THROUGH.has(r.probe_classification ?? '')) ? 1 : 0;
    const eff = results.locator(`[data-testid="effectiveness-row"][data-strategy-id="${strat}"]`);
    await expect(eff).toHaveAttribute('data-count', '1');
    await expect(eff).toContainText(nameOf(strat));
    await expect(eff.getByTestId('effectiveness-line')).toHaveText(
      SCREENS['sequences.strategies'](success, 1, null),
    );
    await expect(eff.getByTestId('effectiveness-line')).toContainText('got through');
  }
  await expect(results.getByTestId('effectiveness-row')).toHaveCount(2);
});

test('a whittled sequence reads its threshold: "The threshold is 2 turns."', async ({ page }) => {
  const sess = await freshSession();
  await openSequences(page, sess.id);
  const [strat] = await strategyIds(page);

  const form = await fillForm(page, strat, 3, false);
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/sessions/${sess.id}/sequences`) && r.request().method() === 'POST',
  );
  const whittle = page.waitForResponse((r) => /\/api\/sequences\/\d+\/whittle$/.test(r.url()), {
    timeout: 90_000,
  });
  await form.getByTestId('sequence-create-whittle').click();
  const seq = (await (await created).json()) as SequenceRow;
  const whittleRes = await whittle;
  expect(whittleRes.status()).toBe(200);
  expect(await whittleRes.json()).toMatchObject({ threshold_at: 2, total_runs: 3 });

  const c = card(page, seq.id);
  await expect(c).toHaveAttribute('data-status', 'completed');
  await c.getByTestId('sequence-show-results').click();
  const results = page.getByTestId('sequence-results');
  await expect(results).toHaveAttribute('data-sequence-id', String(seq.id));
  const detail = results.getByTestId('sequence-detail');
  await expect(detail).toHaveAttribute('aria-busy', 'false');

  // Threshold: three bars (1, 2, 3 warmup turns), the one at 2 outlined; the readout.
  await expect(detail.getByTestId('threshold-panel')).toHaveAttribute('data-kind', 'found');
  await expect(detail.getByTestId('threshold-readout')).toHaveText(SEQUENCE_RESULTS.found(2));
  await expect(detail.getByTestId('threshold-readout')).toContainText('The threshold is 2 turns.');
  await expect(detail.getByTestId('threshold-headline')).toHaveText('2');
  const bars = detail.getByTestId('threshold-bar');
  await expect(bars).toHaveCount(3);
  await expect(bars.first()).toHaveAttribute('data-cls', 'refused');
  await expect(
    detail.locator('[data-testid="threshold-bar"][data-threshold="true"]'),
  ).toHaveAttribute('data-warmup', '2');

  // Turn by turn: three runs; the run at 1 warmup turn is the setup and the probe.
  const turnRows = detail.getByTestId('turn-row');
  await expect(turnRows).toHaveCount(3);
  const one = detail.locator('[data-testid="turn-row"][data-warmup="1"]');
  await expect(one.getByTestId('turn-cell').locator('[aria-hidden="true"]')).toHaveText(['S', 'P']);
  // Runs: the threshold run carries the chip.
  await expect(
    detail.locator('[data-testid="run-row"][data-warmup="2"]').getByTestId('run-threshold-chip'),
  ).toHaveText(SEQUENCE_RESULTS.thresholdChip);

  // Across probes: "2 turns"; effectiveness averages 2.0.
  const row = results.locator(`[data-testid="threshold-row"][data-sequence-id="${seq.id}"]`);
  await expect(row.getByTestId('threshold-cell-turns')).toHaveText(SEQUENCE_RESULTS.turns(2));
  await expect(row.getByTestId('threshold-cell-runs')).toHaveText('3');
  const summary = await api<SequenceSummary>('GET', `/api/sequences/${seq.id}`);
  const success = summary.runs.some((r) => GOT_THROUGH.has(r.probe_classification ?? '')) ? 1 : 0;
  const eff = results.locator(`[data-testid="effectiveness-row"][data-strategy-id="${strat}"]`);
  await expect(eff.getByTestId('effectiveness-line')).toHaveText(
    SCREENS['sequences.strategies'](success, 1, 2),
  );
  await expect(eff.getByTestId('effectiveness-line')).toContainText('average threshold 2.0 turns');
});
