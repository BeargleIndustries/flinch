// Coach examples and the Guide pages (brief 9.4, 9.6, 13.3; plan 6.3, T32;
// I19, D12, D14, B28, Appendix C 62). One fresh session under a custom coach
// profile, a refused run with a pushback, and that exchange taught to the
// coach (POST /api/runs/{id}/promote, what "Teach the coach this exchange"
// sends), then:
// 1. /data/coach: the profile select lists the custom profile (I19 union);
//    picking it lists the example with its move, outcome, excerpts and the
//    run link; a <Term> hover shows its glossary definition.
// 2. Edit the pushback (inline textarea, Save) and the Effectiveness select
//    each PATCH the example; the API reads the new values back. Cancel
//    discards an edit.
// 3. Delete this example (two-step) DELETEs it; the API no longer lists it
//    and the screen shows the brief's empty sentence.
// 4. /guide/glossary shows the four groups and every glossary entry, with
//    anchors a link can land on.
// 5. /guide/methodology shows the title and the A.4 section headings.
// 6. /guide/policies lists every claim on All, expands a row to the columns
//    that exist (Notes only when set), and a provider tab lists that
//    provider's claims; a <Term> hover shows a definition.
// 7. The Guide menu's Glossary, Methodology and Policies items open the pages.
import { expect, test, type Page, type Response } from '@playwright/test';
import { COACH } from '../../src/lib/copy/data';
import { GLOSSARY_PAGE, POLICY_READER } from '../../src/lib/copy/guide';
import { MOVES } from '../../src/lib/copy/moves';
import { SCREENS } from '../../src/lib/copy/screens';
import { GUIDE_MENU, SHELL } from '../../src/lib/copy/shell';
import { glossary } from '../../src/lib/glossary';
import { methodology } from '../../src/lib/guide/methodology';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, readSeed, sendProbe, type Session } from './helpers';

type Example = {
  id: number;
  run_id: number | null;
  coach_profile: string;
  refusal_text: string;
  pushback_text: string;
  outcome: string;
  move: string | null;
  effectiveness: number;
};
type Claim = {
  id: number;
  provider: string;
  claim_id: string;
  claim_text: string;
  testable_statement: string;
  expected_behavior: string;
  severity: string;
  notes: string | null;
};

test.describe.configure({ mode: 'serial' });

const suffix = String(Date.now()).slice(-7);
const PROFILE = `e2e-coach-${suffix}`;
const PUSHBACK = 'What specifically about this is a problem?';

let sess: Session;
let runId: number;
let exampleId: number;

const examples = (profile = PROFILE) =>
  api<Example[]>('GET', `/api/coach-examples?profile=${encodeURIComponent(profile)}&limit=500`);

test.beforeAll(async () => {
  const seed = readSeed();
  sess = await api<Session>('POST', '/api/sessions', {
    name: `Coach ${suffix}`,
    probe_ids: [seed.probes.refuseMe],
    coach_profile: PROFILE,
  });
  const run = await sendProbe(sess.id, seed.probes.refuseMe);
  runId = run.id;
  await api('POST', `/api/runs/${runId}/pushback`, { text: PUSHBACK, source: 'override' });
  exampleId = (await api<{ id: number }>('POST', `/api/runs/${runId}/promote`)).id;
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ tipIds, sessionId }: { tipIds: string[]; sessionId: number }) => {
      localStorage.setItem('flinch:onboarding_done', 'true');
      localStorage.setItem('flinch:tour_seen', 'true');
      for (const id of tipIds) localStorage.setItem(`flinch:tip_seen:${id}`, 'true');
      localStorage.setItem('flinch:session_id', String(sessionId));
    },
    { tipIds: tipsRegistry.map((t) => t.id), sessionId: sess.id },
  );
});

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
}

const isList = (profile: string) => (r: Response) =>
  r.url().includes('/api/coach-examples?') &&
  new URL(r.url()).searchParams.get('profile') === profile &&
  r.request().method() === 'GET';

const isPatch = (r: Response) =>
  r.url().endsWith(`/api/coach-examples/${exampleId}`) && r.request().method() === 'PATCH';

/** Opens Coach examples, picks the spec's profile, and returns its one card. */
async function openProfile(page: Page) {
  await open(page, '/data/coach');
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.coach);
  const select = page.getByTestId('coach-profile');
  await expect(select).toBeEnabled();
  await expect(page.getByTestId('coach-examples')).toHaveAttribute('aria-busy', 'false');
  const [res] = await Promise.all([
    page.waitForResponse(isList(PROFILE)),
    select.selectOption(PROFILE),
  ]);
  expect(res.status()).toBe(200);
  expect(new URL(res.url()).searchParams.get('limit')).toBe('500');
  await expect(page.getByTestId('coach-examples')).toHaveAttribute('aria-busy', 'false');
  return page.getByTestId('coach-example');
}

test('lists the taught example under its custom profile (I19, B28)', async ({ page }) => {
  const [saved] = await examples();
  expect(saved.id).toBe(exampleId);
  expect(saved.pushback_text).toBe(PUSHBACK);

  await open(page, '/data/coach');
  const select = page.getByTestId('coach-profile');
  await expect(select).toBeEnabled();
  // The I19 union: standard first, the session's custom profile, and "New profile name…".
  await expect(select.locator('option').first()).toHaveText('standard');
  await expect(select.locator('option', { hasText: PROFILE })).toHaveCount(1);
  await expect(select.locator('option').last()).toHaveText(COACH.newProfile);

  const cards = await openProfile(page);
  await expect(cards).toHaveCount(1);
  const card = cards.first();
  await expect(card).toHaveAttribute('data-example-id', String(exampleId));
  await expect(page.getByTestId('coach-count')).toHaveText(COACH.count(1, PROFILE));
  const moveName =
    saved.move && saved.move in MOVES
      ? MOVES[saved.move as keyof typeof MOVES].name
      : COACH.unknownMove;
  await expect(card.getByRole('heading', { level: 2 })).toHaveText(moveName);
  await expect(card.getByTestId('coach-pushback')).toHaveText(PUSHBACK);
  await expect(card.getByTestId('coach-refusal')).toContainText(
    saved.refusal_text.trim().slice(0, 40),
  );
  await expect(card.getByTestId('coach-rating')).toHaveValue(String(saved.effectiveness));
  await expect(card.getByTestId('coach-run-link')).toHaveAttribute('href', `/probe/runs/${runId}`);

  // A glossary word on the card shows its definition on hover.
  await card.getByRole('term').filter({ hasText: COACH.pushback }).hover();
  await expect(
    page.getByRole('tooltip').filter({ hasText: glossary.pushback.definition }),
  ).toBeVisible();

  // Typing a profile name shows that profile's examples too.
  await select.selectOption({ label: COACH.newProfile });
  await page.getByTestId('coach-profile-typed').fill(`no-such-profile-${suffix}`);
  await Promise.all([
    page.waitForResponse(isList(`no-such-profile-${suffix}`)),
    page.getByRole('button', { name: COACH.show }).click(),
  ]);
  await expect(page.getByTestId('coach-empty')).toHaveText(COACH.empty);
});

test('edits the pushback and the rating; Cancel discards an edit', async ({ page }) => {
  const card = (await openProfile(page)).first();
  const edited = 'Was that in my prompt? Where did I ask for it?';

  // Cancel leaves the text alone and sends nothing.
  let patches = 0;
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/api/coach-examples/')) patches += 1;
  });
  await card.getByRole('button', { name: COACH.edit }).click();
  await card.getByTestId('coach-edit-text').fill('throwaway');
  await card.getByRole('button', { name: COACH.cancel }).click();
  await expect(card.getByTestId('coach-pushback')).toHaveText(PUSHBACK);
  expect(patches).toBe(0);

  // An empty pushback is refused in place.
  await card.getByRole('button', { name: COACH.edit }).click();
  await card.getByTestId('coach-edit-text').fill('   ');
  await card.getByRole('button', { name: COACH.save }).click();
  await expect(card.getByRole('alert')).toHaveText(COACH.pushbackEmpty);
  expect(patches).toBe(0);

  // Save sends {pushback_text} and the card shows the new text.
  await card.getByTestId('coach-edit-text').fill(edited);
  const [res] = await Promise.all([
    page.waitForResponse(isPatch),
    card.getByRole('button', { name: COACH.save }).click(),
  ]);
  expect(res.status()).toBe(200);
  expect(res.request().postDataJSON()).toEqual({ pushback_text: edited });
  await expect(card.getByTestId('coach-pushback')).toHaveText(edited);
  expect((await examples())[0].pushback_text).toBe(edited);

  // The Effectiveness select sends {effectiveness}.
  const [rated] = await Promise.all([
    page.waitForResponse(isPatch),
    card.getByTestId('coach-rating').selectOption('5'),
  ]);
  expect(rated.request().postDataJSON()).toEqual({ effectiveness: 5 });
  expect((await examples())[0].effectiveness).toBe(5);

  // A fresh visit reads the saved values back.
  const again = (await openProfile(page)).first();
  await expect(again.getByTestId('coach-pushback')).toHaveText(edited);
  await expect(again.getByTestId('coach-rating')).toHaveValue('5');
});

test('deletes the example in two steps', async ({ page }) => {
  const card = (await openProfile(page)).first();
  await card.getByRole('button', { name: COACH.delete }).click();
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/coach-examples/${exampleId}`) && r.request().method() === 'DELETE',
    ),
    card.getByRole('button', { name: COACH.deleteConfirm }).click(),
  ]);
  expect(res.status()).toBe(200);
  await expect(page.getByTestId('coach-empty')).toHaveText(COACH.empty);
  expect(await examples()).toEqual([]);
});

test('the glossary shows the four groups and every term', async ({ page }) => {
  await open(page, '/guide/glossary');
  const groups = page.getByTestId('glossary-group');
  await expect(groups.getByRole('heading', { level: 2 })).toHaveText([
    GLOSSARY_PAGE.groups.badges,
    GLOSSARY_PAGE.groups.loop,
    GLOSSARY_PAGE.groups.studies,
    GLOSSARY_PAGE.groups.models,
  ]);
  const total = Object.keys(glossary).length;
  expect(total).toBeGreaterThanOrEqual(31);
  await expect(page.getByTestId('glossary-entry')).toHaveCount(total);
  for (const [key, e] of Object.entries(glossary)) {
    const row = page.locator(`#term-${key}`);
    await expect(row.locator('dt')).toHaveText(e.term);
    await expect(row.locator('dd')).toHaveText(e.definition);
  }
  // Each group sits under its own heading.
  await expect(page.locator('#glossary-badges').locator('dt')).toHaveText([
    'Refused',
    'Collapsed',
    'Negotiated',
    'Complied',
    'classification',
  ]);

  // A deep link lands on the term.
  await page.goto('/guide/glossary#term-whittle');
  await expect(page.locator('#term-whittle')).toBeInViewport();
});

test('the methodology page shows its title and every section', async ({ page }) => {
  await open(page, '/guide/methodology');
  const article = page.getByTestId('methodology-page');
  await expect(article.getByRole('heading', { level: 1 })).toHaveText(methodology.title);
  for (const line of methodology.lead) await expect(article.getByText(line)).toBeVisible();
  await expect(
    page.getByTestId('methodology-section').getByRole('heading', { level: 2 }),
  ).toHaveText([
    /The badges$/,
    /The loop$/,
    /What to watch for$/,
    /The coach's moves$/,
    /From one run to a study$/,
    /Honesty$/,
  ]);
  expect(methodology.sections.map((s) => s.heading)).toEqual([
    'The badges',
    'The loop',
    'What to watch for',
    "The coach's moves",
    'From one run to a study',
    'Honesty',
  ]);
  // The moves section lists the seven moves.
  const moves = page.locator('#the-coachs-moves dt');
  await expect(moves).toHaveText(Object.values(MOVES).map((m) => m.name));
});

test('the policy reader lists claims, expands one, and filters by provider', async ({ page }) => {
  const byProvider = await api<Record<string, Claim[]>>('GET', '/api/policies');
  const all = Object.values(byProvider).flat();
  expect(all.length).toBeGreaterThan(0);

  await open(page, '/guide/policies');
  await expect(page.getByTestId('screen-question')).toContainText(SCREENS.policies);
  const reader = page.getByTestId('policy-reader');
  await expect(reader.getByRole('tab')).toHaveText(Object.values(POLICY_READER.tabs));
  const list = page.getByTestId('policy-list');
  await expect(list).toHaveAttribute('aria-busy', 'false');
  const rows = page.getByTestId('policy-claim');
  await expect(rows).toHaveCount(all.length);
  const count = page.getByTestId('policy-count');
  await expect(count).toContainText(`${all.length} `);
  await expect(count.getByRole('term')).toHaveText(POLICY_READER.claimsWord(all.length));

  // A glossary word on the page shows its definition on hover.
  await page.getByTestId('policy-count').getByRole('term').hover();
  await expect(
    page.getByRole('tooltip').filter({ hasText: glossary['policy-claim'].definition }),
  ).toBeVisible();

  // Expanding a row shows the columns that exist (Appendix C 62).
  const claim = all.find((c) => !c.notes?.trim()) ?? all[0];
  const row = page.locator(`[data-testid="policy-claim"][data-id="${claim.id}"]`);
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute('data-claim-id', claim.claim_id);
  const toggle = row.getByRole('button');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const detail = row.getByTestId('policy-claim-detail');
  const labels: string[] = [POLICY_READER.testable, POLICY_READER.expected, POLICY_READER.severity];
  if (claim.notes?.trim()) labels.push(POLICY_READER.notes);
  await expect(detail.locator('dt')).toHaveText(labels);
  await expect(detail.locator('dd').first()).toHaveText(claim.testable_statement);
  await expect(detail.locator('dd').nth(1)).toHaveText(
    POLICY_READER.behaviours[claim.expected_behavior] ?? claim.expected_behavior,
  );
  await expect(detail.locator('dd').nth(2)).toHaveText(
    POLICY_READER.severities[claim.severity] ?? claim.severity,
  );
  await toggle.click();
  await expect(detail).toBeHidden();

  // A claim with notes shows them.
  const noted = all.find((c) => c.notes?.trim());
  if (noted) {
    const nrow = page.locator(`[data-testid="policy-claim"][data-id="${noted.id}"]`);
    await nrow.getByRole('button').click();
    await expect(nrow.getByTestId('policy-claim-detail').locator('dt').last()).toHaveText(
      POLICY_READER.notes,
    );
  }

  // A provider tab reads GET /api/policies/{provider}.
  const openai = await api<Claim[]>('GET', '/api/policies/openai');
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/policies/openai')),
    reader.getByRole('tab', { name: POLICY_READER.tabs.openai }).click(),
  ]);
  expect(res.status()).toBe(200);
  await expect(list).toHaveAttribute('data-tab', 'openai');
  await expect(list).toHaveAttribute('aria-busy', 'false');
  await expect(rows).toHaveCount(openai.length);
  for (const c of openai)
    await expect(page.locator(`[data-testid="policy-claim"][data-id="${c.id}"]`)).toHaveCount(1);
});

test('the Guide menu opens the glossary, methodology and policies (D12)', async ({ page }) => {
  await open(page, '/probe');
  const pages: [string, string, string][] = [
    [GUIDE_MENU.glossary, '/guide/glossary', 'glossary-page'],
    [GUIDE_MENU.methodology, '/guide/methodology', 'methodology-page'],
    [GUIDE_MENU.policies, '/guide/policies', 'policy-reader'],
  ];
  for (const [label, path, testid] of pages) {
    await page.getByRole('button', { name: GUIDE_MENU.menuButton }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByTestId(testid)).toBeVisible();
    await expect(page.getByRole('menu')).toBeHidden();
  }
});
