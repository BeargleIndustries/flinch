// First run (brief 13.3 spec 9, 9.8, D26, plan T33), in the browser: with no
// onboarding prefs, `/` opens /welcome; the five steps fill their dots; the
// Python step shows the dev notice and continues once the sidecar answers;
// the Anthropic key is validated against the fake /v1/models and saved to the
// e2e .env; the default probes load; Done leads to Probe and stays there.
//
// Unlike every other spec, this one seeds no localStorage (each test starts
// with a fresh browser context). It changes the shared sidecar (the Anthropic
// key, the default probes) and puts both back in afterAll.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { STAGE_LABELS, WELCOME } from '../../src/lib/copy/onboarding';
import { SCREENS } from '../../src/lib/copy/screens';
import { SETTINGS } from '../../src/lib/copy/settings';
import { api, tmpDir, type Probe } from './helpers';

const ANTHROPIC_KEY = 'sk-ant-e2e-0123456789';

type Key = { env_var: string; provider: string; is_set: boolean; masked: string };

test.describe.configure({ mode: 'serial' });

let probesBefore = new Set<number>();

test.beforeAll(async () => {
  probesBefore = new Set((await api<Probe[]>('GET', '/api/probes')).map((p) => p.id));
});

test.afterAll(async () => {
  await api('POST', '/api/settings/set-key', { provider: 'anthropic', key: 'test' });
  const added = (await api<Probe[]>('GET', '/api/probes'))
    .map((p) => p.id)
    .filter((id) => !probesBefore.has(id));
  if (added.length) await api('POST', '/api/probes/bulk-delete', { probe_ids: added });
});

const dots = (page: Page) => page.getByTestId('welcome-dot');
const step = (page: Page) => page.getByTestId('welcome-step');

/** The dots fill up to and including step `n` (1-based) of five. */
async function expectDots(page: Page, n: number): Promise<void> {
  await expect(dots(page)).toHaveCount(5);
  await expect(page.locator('[data-testid="welcome-dot"][data-filled="true"]')).toHaveCount(n);
  await expect(dots(page).nth(n - 1)).toHaveAttribute('aria-current', 'step');
}

const pref = (page: Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(`flinch:${k}`), key);

const envFile = () => fs.readFileSync(path.join(tmpDir(), '.env'), 'utf8');

test('/ opens the first run; five steps lead to Probe, which a reload keeps', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(WELCOME.title);
  await expect(page.getByText(WELCOME.eyebrow)).toBeVisible();
  await expect(dots(page).nth(0)).toHaveAttribute('title', 'Welcome');
  await expect(dots(page).nth(4)).toHaveAttribute('title', 'Done');

  // 1. Welcome
  await expectDots(page, 1);
  await expect(step(page).getByTestId('welcome-eyebrow')).toHaveText(SCREENS['welcome.1'].eyebrow);
  await expect(step(page).getByRole('heading', { level: 2 })).toHaveText(
    SCREENS['welcome.1'].heading,
  );
  await expect(step(page).getByTestId('welcome-lead')).toHaveText(SCREENS['welcome.1'].lead!);
  await expect(step(page).getByTestId('welcome-body')).toHaveText(SCREENS['welcome.1'].body!);
  await page.getByText(WELCOME.whatIsThis).click();
  await expect(page.getByTestId('welcome-about').locator('p')).toHaveText([...WELCOME.about]);
  await page.getByRole('button', { name: WELCOME.start }).click();

  // 2. Setting up Python: the browser has nothing to install.
  await expect(page).toHaveURL(/\/welcome\/python$/);
  await expectDots(page, 2);
  await expect(step(page).getByRole('heading', { level: 2 })).toHaveText(
    SCREENS['welcome.2'].heading,
  );
  await expect(step(page).getByTestId('welcome-body')).toHaveText(SCREENS['welcome.2'].body!);
  await expect(step(page).getByTestId('welcome-body')).toContainText('needs the internet');
  await expect(page.getByTestId('python-dev')).toContainText(WELCOME.devNotice);
  await expect(page.getByTestId('python-sidecar')).toHaveText(WELCOME.sidecarReady);
  // No desktop progress card or error card in the browser.
  await expect(page.getByTestId('bootstrap-progress')).toHaveCount(0);
  await expect(page.getByText(STAGE_LABELS.probing)).toHaveCount(0);
  await page.getByRole('button', { name: WELCOME.continue }).click();
  expect(await pref(page, 'onboarding_step')).toBe('python');

  // 3. Add a key: validated by the fake /v1/models, saved to the e2e .env.
  await expect(page).toHaveURL(/\/welcome\/key$/);
  await expectDots(page, 3);
  await expect(step(page).getByTestId('welcome-body')).toHaveText(SCREENS['welcome.3'].body!);
  await expect(page.getByTestId('welcome-key-store')).toHaveText(SETTINGS.keysLeadDev);
  const keys = page.getByTestId('welcome-keys');
  await expect(keys.locator('[data-provider]')).toHaveCount(5);
  const other = page.getByTestId('welcome-other-keys');
  await expect(other.locator('summary')).toHaveText(WELCOME.otherProviders);
  await expect(other.locator('[data-provider="openai"]')).toBeHidden();
  const anthropic = keys.locator('[data-provider="anthropic"]');
  await anthropic.getByLabel('Anthropic API key').fill(ANTHROPIC_KEY);
  await anthropic.getByRole('button', { name: 'Save' }).click();
  await expect(anthropic).toContainText('Saved.');
  const saved = (await api<Key[]>('GET', '/api/settings/keys')).find(
    (k) => k.provider === 'anthropic',
  )!;
  expect(saved.is_set).toBe(true);
  await expect(anthropic).toContainText(`Set · ${saved.masked}`);
  await expect(page.getByTestId('welcome-keys')).not.toContainText(ANTHROPIC_KEY);
  expect(envFile()).toContain(`ANTHROPIC_API_KEY="${ANTHROPIC_KEY}"`);
  await page.getByRole('button', { name: WELCOME.continue }).click();

  // 4. Load probes
  await expect(page).toHaveURL(/\/welcome\/probes$/);
  await expectDots(page, 4);
  await expect(step(page).getByTestId('welcome-body')).toHaveText(SCREENS['welcome.4'].body!);
  await page.getByRole('button', { name: WELCOME.loadDefaults }).click();
  await expect(page.getByTestId('welcome-loaded')).toHaveText(/^Loaded \d+ probes?$/);
  await page.getByRole('button', { name: WELCOME.continue }).click();

  // 5. Done
  await expect(page).toHaveURL(/\/welcome\/done$/);
  await expectDots(page, 5);
  await expect(step(page).getByTestId('welcome-eyebrow')).toHaveText(SCREENS['welcome.5'].eyebrow);
  await expect(step(page).getByRole('heading', { level: 2 })).toHaveText(
    SCREENS['welcome.5'].heading,
  );
  await expect(step(page).getByTestId('welcome-lead')).toHaveText(SCREENS['welcome.5'].lead!);
  await expect(page.getByRole('button', { name: WELCOME.takeTour })).toBeVisible();
  await page.getByRole('button', { name: WELCOME.goStraightIn }).click();

  await expect(page).toHaveURL(/\/probe$/);
  await expect(page.getByTestId('probe-workspace')).toBeVisible();
  expect(await pref(page, 'onboarding_done')).toBe('true');
  expect(await pref(page, 'tour_seen')).toBe('true');
  expect(await pref(page, 'onboarding_step')).toBeNull();

  await page.reload();
  await expect(page).toHaveURL(/\/probe$/);
  await expect(page.getByTestId('probe-workspace')).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/probe$/);
});

test('Skip for now says what a missing key costs, then goes on; /welcome resumes', async ({
  page,
}) => {
  await page.goto('/welcome/key');
  await expectDots(page, 3);
  await expect(page.getByTestId('welcome-keys').locator('[data-provider]')).toHaveCount(5);
  const skip = page.getByRole('button', { name: WELCOME.skipForNow });
  await skip.click();
  await expect(page.getByTestId('welcome-skip-hint')).toHaveText(WELCOME.skipHint);
  await expect(page).toHaveURL(/\/welcome\/key$/);
  await skip.click();
  await expect(page).toHaveURL(/\/welcome\/probes$/);
  expect(await pref(page, 'onboarding_step')).toBe('key');

  // The library is not empty here (the e2e seed), so Continue, not Skip.
  await expect(page.getByRole('button', { name: WELCOME.continue })).toBeEnabled();
  await expect(page.getByRole('button', { name: WELCOME.skip, exact: true })).toHaveCount(0);

  // A later visit to /welcome picks up after the step last left.
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/welcome\/probes$/);
  // Onboarding is not done, so / still opens the first run.
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome\/probes$/);
});
