// Scorecard (brief 9.2, 13.3; plan 6.3, T30). In order, one fresh session:
// 1. Before anything is linked: a scorecard over that session alone has no
//    rows and points to Probe; This session says no claims are linked.
// 2. answer-me (the fake complies) is linked from the probe card through the
//    Link policy claims dialog to openai harassment, a should-refuse claim,
//    and run; refuse-me (the fake refuses "[REFUSE]") is linked through the
//    API to google hate-speech, also should-refuse, and run. The scorecard
//    reads "Under" for the first (the model refused less than the policy
//    says, B27) and "Matches" for the second; the Under cell lists the run
//    with a link to /probe/runs/{id}; Generate again saves a second scorecard
//    and the saved list opens the first.
// 3. This session: providers then categories with a bar each, and the
//    counts and readouts match GET /api/sessions/{id}/compliance.
// The links are removed again at the end.
import { expect, test, type Page } from '@playwright/test';
import { SCORECARD } from '../../src/lib/copy/data';
import { LINK_CLAIMS, PROBE } from '../../src/lib/copy/probe';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, sendProbe, type Session } from './helpers';

type Claim = {
  id: number;
  provider: string;
  claim_id: string;
  category: string;
  expected_behavior: string;
};
type ComplianceRow = {
  claim_slug: string;
  probe_count: number;
  refused_count: number;
  collapsed_count: number;
  negotiated_count: number;
  complied_count: number;
};
type Compliance = {
  by_provider: Record<string, Record<string, ComplianceRow[]>>;
  summary: {
    total_claims_tested: number;
    compliant_claims: number;
    average_compliance_rate: number;
  };
};
type SessionDetail = {
  target_model: string;
  runs: { id: number; probe_id: number; initial_classification: string | null }[];
};

test.describe.configure({ mode: 'serial' });

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

let sess: Session;
let model: string;
let harassment: Claim;
let hate: Claim;
let answerRunId: number;
let refuseRunId: number;

test.beforeAll(async () => {
  const seed = readSeed();
  sess = await createSession(`Scorecard ${String(Date.now()).slice(-7)}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  model = (await api<SessionDetail>('GET', `/api/sessions/${sess.id}`)).target_model;
  const policies = await api<Record<string, Claim[]>>('GET', '/api/policies');
  const find = (provider: string, slug: string) => {
    const c = (policies[provider] ?? []).find((x) => x.claim_id === slug);
    if (!c) throw new Error(`No seeded claim ${provider}/${slug}`);
    expect(c.expected_behavior).toBe('should_refuse');
    return c;
  };
  harassment = find('openai', 'harassment');
  hate = find('google', 'hate-speech');
});

test.afterAll(async () => {
  const seed = readSeed();
  if (harassment)
    await api('DELETE', `/api/probes/${seed.probes.answerMe}/claims/${harassment.id}`);
  if (hate) await api('DELETE', `/api/probes/${seed.probes.refuseMe}/claims/${hate.id}`);
});

/** Opens `path` with the spec's session current and waits for the shell. */
async function openIn(page: Page, path: string): Promise<void> {
  await page.addInitScript((id: number) => {
    localStorage.setItem('flinch:session_id', String(id));
  }, sess.id);
  await page.goto(path);
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('session-switcher')).toContainText(sess.name);
}

/** Builds a scorecard over the spec's session only and waits for it. */
async function generateForSession(page: Page, name: string): Promise<void> {
  const build = page.getByTestId('scorecard-build');
  await expect(build).toHaveAttribute('aria-busy', 'false');
  await expect(
    page.getByTestId('scorecard-models').getByRole('checkbox', { name: model }),
  ).toBeChecked();
  await build.getByRole('button', { name: SCORECARD.selectNoneOf('sessions') }).click();
  const noneRepeats = build.getByRole('button', { name: SCORECARD.selectNoneOf('repeat runs') });
  if (await noneRepeats.isEnabled()) await noneRepeats.click();
  await expect(page.getByTestId('scorecard-generate')).toBeDisabled();
  await page
    .locator(`[data-testid="scorecard-source-session"][data-session-id="${sess.id}"]`)
    .getByRole('checkbox')
    .check();
  await page.getByTestId('scorecard-name').fill(name);
  const reply = page.waitForResponse(
    (r) => r.url().includes('/api/scorecard/generate') && r.request().method() === 'POST',
  );
  await page.getByTestId('scorecard-generate').click();
  const body = await reply.then((r) => r.json());
  expect(body.results.session_ids).toEqual([sess.id]);
  await expect(page.getByTestId('scorecard-result')).toHaveAttribute(
    'data-snapshot-id',
    String(body.snapshot_id),
  );
}

const cell = (page: Page, claimId: number) =>
  page.locator(`[data-testid="scorecard-cell"][data-model="${model}"][data-claim-id="${claimId}"]`);

test('before any link: the scorecard has no rows and points to Probe; This session is empty', async ({
  page,
}) => {
  const seed = readSeed();
  const run = await sendProbe(sess.id, seed.probes.answerMe);
  expect(run.initial_classification).toBe('complied');

  await openIn(page, '/data/scorecard');
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.scorecard);
  await expect(page.getByRole('tab', { name: SCORECARD.tabPolicies })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // The legend gives each cell word one sentence.
  const legend = page.getByTestId('scorecard-legend');
  for (const v of ['matches', 'over', 'under', 'context', 'none'] as const) {
    await expect(legend.locator(`[data-verdict="${v}"]`)).toContainText(SCORECARD.verdicts[v]);
    await expect(legend.locator(`[data-verdict="${v}"]`)).toContainText(SCORECARD.legend[v]);
  }

  await generateForSession(page, `Empty ${sess.id}`);
  const empty = page.getByTestId('scorecard-empty');
  await expect(empty).toContainText(SCORECARD.emptyTitle);
  await expect(page.getByTestId('scorecard-row')).toHaveCount(0);

  await page.getByRole('tab', { name: SCORECARD.tabSession }).click();
  await expect(page.getByTestId('scorecard-session-empty')).toContainText(SCORECARD.sessionEmpty);
  await expect(
    page.locator('[data-testid="scorecard-session-tile"][data-tile="tested"]'),
  ).toContainText('0');

  await page.getByRole('tab', { name: SCORECARD.tabPolicies }).click();
  await empty.getByRole('button', { name: SCORECARD.emptyAction }).click();
  await expect(page).toHaveURL(/\/probe$/);
});

test('a complied run linked to a should-refuse claim reads Under, a refused one reads Matches', async ({
  page,
}) => {
  const seed = readSeed();

  // Link answer-me from the probe card, then run it there.
  await openIn(page, '/probe');
  await page
    .getByTestId('probe-rail')
    .locator('[data-testid="probe-row"][data-probe-name="answer-me"] [data-probe-id]')
    .click();
  const links = page.getByTestId('policy-links');
  await expect(links).toContainText(SCREENS['probe.policyEmpty']);
  await links.getByRole('button', { name: PROBE.linkClaim }).click();
  const dialog = page.getByTestId('link-claim-dialog');
  await dialog.getByPlaceholder(LINK_CLAIMS.search).fill(harassment.claim_id);
  await dialog
    .locator('fieldset', { hasText: 'openai' })
    .locator('label', { hasText: harassment.claim_id })
    .getByRole('checkbox')
    .check();
  await page.getByRole('button', { name: LINK_CLAIMS.submit(1) }).click();
  await expect(links.getByTestId('claim-chip')).toHaveText(
    PROBE.claimChip('openai', harassment.claim_id),
  );
  await page.getByTestId('send-button').click();
  await expect(page.getByTestId('probe-workspace')).toHaveAttribute('data-phase', 'done');

  // Link refuse-me through the API and run it there.
  await api('POST', `/api/probes/${seed.probes.refuseMe}/claims`, { claim_ids: [hate.id] });
  const refused = await sendProbe(sess.id, seed.probes.refuseMe);
  expect(refused.initial_classification).toBe('refused');
  refuseRunId = refused.id;

  const runs = (await api<SessionDetail>('GET', `/api/sessions/${sess.id}`)).runs;
  const answered = runs.filter((r) => r.probe_id === seed.probes.answerMe);
  expect(answered.map((r) => r.initial_classification)).toEqual(['complied', 'complied']);
  answerRunId = Math.max(...answered.map((r) => r.id));

  await openIn(page, '/data/scorecard');
  await generateForSession(page, `Linked ${sess.id}`);

  // Under: should refuse, refused 0 of 2.
  const under = cell(page, harassment.id);
  await expect(under).toHaveAttribute('data-verdict', 'under');
  await expect(under.getByTestId('scorecard-cell-word')).toHaveText(SCORECARD.verdicts.under);
  await expect(under).toHaveAttribute('title', SCORECARD.cellTitle(0, 2, 2));
  // Matches: should refuse, refused 1 of 1.
  const matches = cell(page, hate.id);
  await expect(matches).toHaveAttribute('data-verdict', 'matches');
  await expect(matches.getByTestId('scorecard-cell-word')).toHaveText(SCORECARD.verdicts.matches);
  await expect(matches).toHaveAttribute('title', SCORECARD.cellTitle(1, 0, 1));
  await expect(
    page.locator(`[data-testid="scorecard-row"][data-claim-id="${harassment.id}"]`),
  ).toContainText(`openai · ${harassment.claim_id}`);

  // The cell's runs, each linking to its own screen.
  await under.click();
  const detail = page.getByTestId('scorecard-detail');
  await expect(detail.getByTestId('scorecard-detail-verdict')).toHaveText(SCORECARD.verdicts.under);
  await expect(detail.getByTestId('scorecard-detail-counts')).toHaveText(
    SCORECARD.cellTitle(0, 2, 2),
  );
  const rows = detail.getByTestId('scorecard-detail-run');
  await expect(rows).toHaveCount(2);
  const newest = detail.locator(
    `[data-testid="scorecard-detail-run"][data-run-id="${answerRunId}"]`,
  );
  await expect(newest.getByTestId('scorecard-detail-open')).toHaveAttribute(
    'href',
    `/probe/runs/${answerRunId}`,
  );
  await matches.click();
  await expect(detail).toHaveAttribute('data-claim-id', String(hate.id));
  await expect(
    detail.locator(`[data-testid="scorecard-detail-run"][data-run-id="${refuseRunId}"]`),
  ).toBeVisible();

  // Generate again saves a second scorecard with the same verdicts.
  const first = await page.getByTestId('scorecard-result').getAttribute('data-snapshot-id');
  await page.getByTestId('scorecard-refresh').click();
  await expect(page.getByTestId('scorecard-result')).not.toHaveAttribute(
    'data-snapshot-id',
    first ?? '',
  );
  await expect(cell(page, harassment.id)).toHaveAttribute('data-verdict', 'under');

  // The saved list opens the first one again.
  const savedRow = page.locator(`[data-testid="scorecard-saved-row"][data-snapshot-id="${first}"]`);
  await savedRow.getByTestId('scorecard-open').click();
  await expect(page.getByTestId('scorecard-result')).toHaveAttribute(
    'data-snapshot-id',
    first ?? '',
  );
  await expect(cell(page, hate.id)).toHaveAttribute('data-verdict', 'matches');

  // Another scorecard on screen closes the open cell.
  await expect(detail).toHaveCount(0);
  await under.click();
  await detail.getByTestId('scorecard-detail-open').first().click();
  await expect(page).toHaveURL(new RegExp(`/probe/runs/${answerRunId}$`));
});

test('This session: providers then categories with a bar each, counts as the API gives them', async ({
  page,
}) => {
  const compliance = await api<Compliance>('GET', `/api/sessions/${sess.id}/compliance`);
  expect(Object.keys(compliance.by_provider).sort()).toEqual(['google', 'openai']);

  await openIn(page, '/data/scorecard?tab=session');
  await expect(page.getByRole('tab', { name: SCORECARD.tabSession })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const screen = page.getByTestId('scorecard-session');
  await expect(screen).toHaveAttribute('aria-busy', 'false');

  const s = compliance.summary;
  const tile = (key: string) =>
    page
      .locator(`[data-testid="scorecard-session-tile"][data-tile="${key}"]`)
      .getByTestId('scorecard-session-tile-value');
  await expect(tile('tested')).toHaveText(String(s.total_claims_tested));
  await expect(tile('compliant')).toHaveText(String(s.compliant_claims));
  await expect(tile('average')).toHaveText(`${(s.average_compliance_rate * 100).toFixed(0)}%`);
  expect(s.total_claims_tested).toBe(2);
  expect(s.compliant_claims).toBe(1);

  // Providers in name order, each with its categories.
  const providers = page.getByTestId('compliance-provider');
  await expect(providers).toHaveCount(2);
  await expect(providers.nth(0)).toHaveAttribute('data-provider', 'google');
  await expect(providers.nth(1)).toHaveAttribute('data-provider', 'openai');

  for (const [provider, categories] of Object.entries(compliance.by_provider)) {
    for (const [category, rows] of Object.entries(categories)) {
      const sum = (k: keyof ComplianceRow) => rows.reduce((n, r) => n + Number(r[k]), 0);
      const group = page.locator(
        `[data-testid="compliance-category"][data-provider="${provider}"][data-category="${category}"]`,
      );
      await expect(group).toHaveAttribute('data-runs', String(sum('probe_count')));
      await expect(group).toHaveAttribute('data-refused', String(sum('refused_count')));
      await expect(group).toHaveAttribute('data-collapsed', String(sum('collapsed_count')));
      await expect(group).toHaveAttribute('data-negotiated', String(sum('negotiated_count')));
      await expect(group).toHaveAttribute('data-complied', String(sum('complied_count')));
      // The group's bar has a segment for each class with runs.
      await expect(group.getByRole('img').first()).toBeVisible();
      for (const r of rows) {
        await expect(
          group.locator(`[data-testid="compliance-claim"][data-claim-slug="${r.claim_slug}"]`),
        ).toContainText(SCORECARD.claimCounts(r.probe_count));
      }
    }
  }

  const harassmentGroup = page.locator(
    `[data-testid="compliance-category"][data-provider="openai"][data-category="${harassment.category}"]`,
  );
  await expect(harassmentGroup).toHaveAttribute('data-complied', '2');
  await expect(harassmentGroup.getByTestId('compliance-rate')).toHaveText('0%');
  const hateGroup = page.locator(
    `[data-testid="compliance-category"][data-provider="google"][data-category="${hate.category}"]`,
  );
  await expect(hateGroup).toHaveAttribute('data-refused', '1');
  await expect(hateGroup.getByTestId('compliance-rate')).toHaveText('100%');
});
