// Model compare (brief 8.5 and 13.3, plan 6.3, D16, D29, B19, B25, T27).
//
// The fake model server answers both providers' routes (tests/fake_models.py:
// /v1/messages and /v1/chat/completions), so one Anthropic model and one
// OpenAI model from GET /api/models both reach it. refuse-me ("[REFUSE] ...")
// is refused on a fresh conversation and answer-me is answered, so both
// models agree on both probes: 100%. The run is one synchronous request,
// POST /api/compare/run; its two auto-created sessions (one per model) are
// listed by GET /api/sessions but hidden from the header's session switcher
// by their notes prefix (isCompareSession). The view's two downloads read
// GET /api/comparisons/{id}/export as JSON and as CSV.
import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { COMPARE_SESSION_PREFIX } from '../../src/lib/session';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { COMPARE } from '../../src/lib/copy/studies';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, sidecarUrl } from './helpers';

type ModelGroup = { provider: string; available: boolean; models: { id: string }[] };
type Summary = { id: number };
type Answer = { classification: string | null; run_id: number | null; session_id: number };
type Detail = {
  id: number;
  models: string[];
  session_ids: Record<string, number>;
  agreement_rate: number;
  total_probes: number;
  results: { probe_name: string; models: Record<string, Answer>; disagreement: boolean }[];
};
type SessionRow = { id: number; name: string; notes: string | null; target_model: string };

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

/** Deletes every saved comparison, so the history starts empty. */
async function clearComparisons(): Promise<void> {
  for (const c of await api<Summary[]>('GET', '/api/comparisons'))
    await api('DELETE', `/api/comparisons/${c.id}`);
}

/** The first available model of `provider` whose id starts with `prefix`. */
async function modelOf(provider: string, prefix: string): Promise<string> {
  const groups = await api<ModelGroup[]>('GET', '/api/models');
  const g = groups.find((x) => x.provider === provider && x.available);
  const id = g?.models.find((m) => m.id.startsWith(prefix))?.id;
  if (!id) throw new Error(`GET /api/models lists no available ${prefix}* model`);
  return id;
}

/** Opens /studies/compare and waits for Set up and the history to be read. */
async function openCompare(page: Page): Promise<Locator> {
  const reads = Promise.all(
    ['/api/models', '/api/probes', '/api/comparisons'].map((p) =>
      page.waitForResponse((r) => new URL(r.url()).pathname === p),
    ),
  );
  await page.goto('/studies/compare');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await reads;
  const setup = page.getByTestId('compare-setup');
  await expect(setup).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('compare-history')).toHaveAttribute('aria-busy', 'false');
  return setup;
}

const probeBox = (setup: Locator, name: string) =>
  setup.getByRole('checkbox', { name: new RegExp(`^${name}\\b(?!-)`) });

test('Model compare opens with its research question and an empty history', async ({ page }) => {
  await clearComparisons();
  const setup = await openCompare(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(COMPARE.title);
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.compare);
  await expect(page.getByTestId('compare-sessions-note')).toHaveText(COMPARE.sessionsNote);
  await expect(page.getByTestId('compare-empty')).toContainText(COMPARE.emptyTitle);

  // Two model rows to start, filled from GET /api/models; Run waits for a probe.
  await expect(setup.getByRole('combobox')).toHaveCount(2);
  await setup.getByRole('button', { name: 'None', exact: true }).click();
  await expect(page.getByTestId('compare-plan')).toHaveText(COMPARE.needPick);
  await expect(page.getByTestId('compare-run')).toBeDisabled();
});

test('a two-model comparison shows two columns, is listed, hides its sessions and deletes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await clearComparisons();
  const claude = await modelOf('anthropic', 'claude-');
  const gpt = await modelOf('openai', 'gpt-');

  // ── Set up and run ────────────────────────────────────────────────
  const setup = await openCompare(page);
  await setup.getByRole('combobox', { name: COMPARE.modelN(1) }).selectOption(claude);
  await setup.getByRole('combobox', { name: COMPARE.modelN(2) }).selectOption(gpt);

  const everyProbe = setup.getByRole('radio', { name: COMPARE.sourceAll });
  if ((await everyProbe.count()) > 0) {
    await setup.getByText(COMPARE.sourceAll, { exact: true }).click();
    await expect(everyProbe).toBeChecked();
  }
  await setup.getByRole('button', { name: 'None', exact: true }).click();
  await probeBox(setup, 'refuse-me').check();
  await probeBox(setup, 'answer-me').check();
  await expect(page.getByTestId('compare-plan')).toHaveText(COMPARE.plan(2, 2));

  const run = page.getByTestId('compare-run');
  await expect(run).toHaveText(COMPARE.run(2, 2));
  const posted = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/compare/run',
  );
  await run.click();
  const body = (await posted).postDataJSON() as { models: string[]; probe_ids: number[] };
  expect(body.models).toEqual([claude, gpt]);
  expect(body.probe_ids).toHaveLength(2);

  // ── The comparison view ───────────────────────────────────────────
  await expect(page).toHaveURL(/\/studies\/compare\/\d+$/, { timeout: 90_000 });
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  const view = page.getByTestId('comparison-view');
  const grid = view.getByTestId('comparison-grid');
  await expect(grid).toBeVisible();

  const columns = grid.getByTestId('comparison-column');
  await expect(columns).toHaveCount(2);
  await expect(columns.nth(0)).toHaveText(claude);
  await expect(columns.nth(1)).toHaveText(gpt);

  const rows = grid.getByTestId('comparison-row-probe');
  await expect(rows).toHaveCount(2);
  const refuseRow = rows.filter({ hasText: 'refuse-me' });
  const answerRow = rows.filter({ hasText: 'answer-me' });
  const refuseCells = refuseRow.getByTestId('comparison-cell');
  await expect(refuseCells).toHaveCount(2);
  for (let i = 0; i < 2; i++)
    await expect(refuseCells.nth(i)).toHaveAttribute('data-cls', 'refused');
  const answerCells = answerRow.getByTestId('comparison-cell');
  for (let i = 0; i < 2; i++)
    await expect(answerCells.nth(i)).toHaveAttribute('data-cls', 'complied');
  await expect(view.getByTestId('comparison-disagreement')).toHaveCount(0);

  await expect(view.getByTestId('comparison-agreement')).toHaveText('100%');
  await expect(view.getByTestId('comparison-aligned')).toHaveText(COMPARE.aligned(2, 2));

  // The downloads: JSON as saved, CSV with a badge and answer column per model.
  for (const [label, format] of [
    [COMPARE.json, 'json'],
    [COMPARE.csv, 'csv'],
  ] as const) {
    const exported = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === `/api/comparisons/${id}/export` &&
        new URL(r.url()).searchParams.get('format') === format,
    );
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      view.getByRole('button', { name: `Download ${label}`, exact: true }).click(),
    ]);
    expect((await exported).status()).toBe(200);
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^flinch-comparison-${id}-.+\\.${format}$`),
    );
    const text = fs.readFileSync(await download.path(), 'utf8');
    if (format === 'json') {
      const json = JSON.parse(text) as { comparison: { id: number; models: string[] } };
      expect(json.comparison).toMatchObject({ id, models: [claude, gpt] });
    } else {
      expect(text.split(/\r?\n/)[0]).toBe(
        `probe_name,probe_domain,prompt_text,disagreement,${claude}_classification,${claude}_response,${gpt}_classification,${gpt}_response`,
      );
    }
  }

  // A cell opens that model's conversation (roles user/assistant).
  const detail = await api<Detail>('GET', `/api/comparisons/${id}`);
  const refusedRunId = detail.results.find((r) => r.probe_name === 'refuse-me')?.models[gpt]
    ?.run_id;
  expect(refusedRunId).toBeTruthy();
  await refuseCells.nth(1).click();
  await expect(refuseCells.nth(1)).toHaveAttribute('aria-pressed', 'true');
  const turns = view.getByTestId('comparison-turns');
  await expect(turns).toContainText(COMPARE.turnsEyebrow(gpt));
  const card = turns.getByTestId('turn-card');
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('data-kind', 'response');
  await expect(card).toHaveAttribute('data-cls', 'refused');
  await expect(turns.getByTestId('comparison-open-run')).toHaveAttribute(
    'href',
    `/probe/runs/${refusedRunId}`,
  );

  // ── The auto-created sessions: listed by the API, hidden by the switcher ──
  expect(detail.models).toEqual([claude, gpt]);
  expect(detail.total_probes).toBe(2);
  const sessionIds = Object.values(detail.session_ids);
  expect(sessionIds).toHaveLength(2);
  const all = await api<SessionRow[]>('GET', '/api/sessions');
  const created = all.filter((s) => sessionIds.includes(s.id));
  expect(created).toHaveLength(2);
  expect(created.map((s) => s.target_model).sort()).toEqual([claude, gpt].sort());
  for (const s of created) expect(s.notes?.startsWith(COMPARE_SESSION_PREFIX)).toBe(true);

  try {
    await openCompare(page);
    const switcher = page.getByTestId('session-switcher');
    await expect(switcher).not.toHaveText(SHELL.noSession);
    await switcher.click();
    const menu = page.getByRole('menu', { name: SHELL.switcherLabel });
    const items = menu.getByRole('menuitemradio');
    await expect(items.first()).toBeVisible();
    for (const s of created) await expect(items.filter({ hasText: s.name })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // ── Past comparisons ────────────────────────────────────────────
    const listed = page.getByTestId('comparison-row');
    await expect(listed).toHaveCount(1);
    const row = listed.first();
    await expect(row).toHaveAttribute('data-comparison-id', String(id));
    await expect(row).toContainText(claude);
    await expect(row).toContainText(gpt);
    await expect(row).toContainText(COMPARE.probeCount(2));
    await expect(row.getByTestId('comparison-agreement')).toContainText('100%');

    // Open it from the list, then delete it from its view.
    await row.getByTestId('comparison-open').click();
    await expect(page).toHaveURL(new RegExp(`/studies/compare/${id}$`));
    await expect(page.getByTestId('comparison-grid')).toBeVisible();
    const del = page.getByRole('button', { name: COMPARE.remove });
    await del.click();
    const deleted = page.waitForResponse(
      (r) =>
        r.request().method() === 'DELETE' && new URL(r.url()).pathname === `/api/comparisons/${id}`,
    );
    await page.getByRole('button', { name: COMPARE.removeConfirm }).click();
    expect((await deleted).ok()).toBe(true);
    await expect(page).toHaveURL(/\/studies\/compare$/);
    await expect(page.getByTestId('compare-empty')).toContainText(COMPARE.emptyTitle);

    const gone = await fetch(`${sidecarUrl()}/api/comparisons/${id}`);
    expect(gone.status).toBe(404);
    expect(await api<Summary[]>('GET', '/api/comparisons')).toEqual([]);
  } finally {
    for (const sid of sessionIds) await api('DELETE', `/api/sessions/${sid}`).catch(() => null);
  }
});
