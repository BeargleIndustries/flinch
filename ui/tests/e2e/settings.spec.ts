// The settings drawer (brief 13.3 spec 7, 9.7, plan T19), in dev mode: keys go
// to the sidecar's .env file, which the e2e sidecar points at
// `{FLINCH_E2E_TMP}/.env` (FLINCH_ENV_FILE, I14), never the repository's.
//
// These cases change the shared e2e sidecar (keys, Ollama URL, coach default),
// so they run in order and `afterAll` puts every value back the way
// playwright.config.ts started it: Anthropic and OpenAI keys "test", Ollama at
// 127.0.0.1:9, the coach default Anthropic.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SETTINGS } from '../../src/lib/copy/settings';
import { SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, tmpDir } from './helpers';

type Health = { status: string; version: string; db_path: string; keys_set: number };
type Key = { env_var: string; provider: string; is_set: boolean; masked: string };

const OPENAI_KEY = 'sk-e2e-openai-0123456789';
const OPENAI_MASKED = 'sk-e2e-o...6789';

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

test.afterAll(async () => {
  for (const provider of ['anthropic', 'openai'])
    await api('POST', '/api/settings/set-key', { provider, key: 'test' });
  await api('POST', '/api/settings/ollama', { base_url: 'http://127.0.0.1:9' });
  await api('POST', '/api/settings/coach-default', { backend: 'anthropic', model: '' });
});

/** Opens /probe, waits for the shell to reach the sidecar, then opens Settings. */
async function openSettings(page: Page): Promise<Locator> {
  await page.goto('/probe');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await page.getByRole('button', { name: SHELL.settingsLabel }).click();
  const drawer = page.getByRole('dialog', { name: 'Settings' });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-provider]')).toHaveCount(5);
  return drawer;
}

/** The chip popover's "N of 5 set" line. */
async function expectChipKeys(page: Page, n: number): Promise<void> {
  await page.getByTestId('sidecar-chip').click();
  const pop = page.getByRole('dialog', { name: SHELL.sidecarDetails });
  await expect(pop).toContainText(SHELL.keysSet(n));
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
}

const keyFor = async (provider: string) =>
  (await api<Key[]>('GET', '/api/settings/keys')).find((k) => k.provider === provider)!;

const envFile = () => fs.readFileSync(path.join(tmpDir(), '.env'), 'utf8');

test('the drawer names the .env store, lists the five providers and the Developer facts', async ({
  page,
}) => {
  const drawer = await openSettings(page);
  const health = await api<Health>('GET', '/health');

  await expect(drawer.getByTestId('settings-key-store')).toHaveText(SETTINGS.keysLeadDev);
  await expect(drawer.locator('[data-tour="settings-keys"]')).toBeVisible();
  expect(
    await drawer
      .locator('[data-provider]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-provider'))),
  ).toEqual(['anthropic', 'openai', 'google', 'xai', 'meta']);
  await expect(drawer.locator('[data-provider="meta"]')).toContainText('Together (Llama)');
  await expect(drawer.getByText(SETTINGS.keysFoot)).toBeVisible();

  await expect(drawer.getByTestId('settings-db-path')).toHaveText(health.db_path);
  await expect(drawer.getByTestId('settings-versions')).toHaveText(
    SETTINGS.versionLine('dev', health.version),
  );
  await expect(drawer.getByTestId('settings-api-docs')).toHaveAttribute('href', '/docs');
  await expect(drawer.getByTestId('settings-api-docs')).toHaveAttribute('target', '_blank');
  // Desktop-only rows are absent in the browser.
  await expect(drawer.getByRole('button', { name: SETTINGS.devtools })).toHaveCount(0);
  await expect(drawer.getByText(SETTINGS.devtoolsAuto)).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: SETTINGS.diagnostic })).toHaveCount(0);
});

test('a key saves to the temp .env, then Remove clears it; the dot and the chip follow', async ({
  page,
}) => {
  // Start from no keys at all, so the Settings dot shows.
  for (const provider of ['anthropic', 'openai'])
    await api('DELETE', `/api/settings/set-key?provider=${provider}`);
  expect((await api<Health>('GET', '/health')).keys_set).toBe(0);

  await page.goto('/probe');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('settings-dot')).toBeVisible();
  await expectChipKeys(page, 0);

  const drawer = await openSettings(page);
  const openai = drawer.locator('[data-provider="openai"]');
  await expect(openai).toContainText('Not set');
  await openai.getByRole('button', { name: 'Add a key' }).click();
  await openai.getByLabel('OpenAI API key').fill(OPENAI_KEY);
  await openai.getByRole('button', { name: 'Save' }).click();
  await expect(openai).toContainText(`Set · ${OPENAI_MASKED}`);
  await expect(openai).toContainText('Saved.');
  // The raw key is never shown, only the masked form.
  await expect(drawer).not.toContainText(OPENAI_KEY);

  expect(await keyFor('openai')).toMatchObject({ is_set: true, masked: OPENAI_MASKED });
  expect(envFile()).toContain(`OPENAI_API_KEY="${OPENAI_KEY}"`);
  expect((await api<Health>('GET', '/health')).keys_set).toBe(1);

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page.getByTestId('settings-dot')).toHaveCount(0);
  await expectChipKeys(page, 1);

  await page.getByRole('button', { name: SHELL.settingsLabel }).click();
  await expect(openai).toContainText(`Set · ${OPENAI_MASKED}`);
  await openai.getByRole('button', { name: 'Remove', exact: true }).click();
  await openai.getByRole('button', { name: 'Remove the OpenAI key' }).click();
  await expect(openai).toContainText('Not set');
  await expect(openai.getByRole('button', { name: 'Add a key' })).toBeVisible();

  expect((await keyFor('openai')).is_set).toBe(false);
  expect(envFile()).toMatch(/^OPENAI_API_KEY=\r?$/m);
  await page.keyboard.press('Escape');
  await expectChipKeys(page, 0);
});

test('Test reports success for an Anthropic key against the fake server', async ({ page }) => {
  await api('DELETE', '/api/settings/set-key?provider=anthropic');
  const drawer = await openSettings(page);
  const anthropic = drawer.locator('[data-provider="anthropic"]');
  await anthropic.getByRole('button', { name: 'Add a key' }).click();
  await anthropic.getByLabel('Anthropic API key').fill('test');
  await anthropic.getByRole('button', { name: 'Save' }).click();
  await expect(anthropic).toContainText('Set · ***');
  expect(envFile()).toContain('ANTHROPIC_API_KEY="test"');

  await anthropic.getByRole('button', { name: 'Test' }).click();
  await expect(anthropic).toContainText('Key works.');
});

test('the Ollama URL saves and is shown after a reload', async ({ page }) => {
  let drawer = await openSettings(page);
  const url = drawer.getByLabel(SETTINGS.ollamaUrl);
  await expect(url).toHaveValue('http://127.0.0.1:9');
  await expect(drawer.getByTestId('ollama-status')).toHaveText(SETTINGS.ollamaNotRunning);

  await url.fill('http://127.0.0.1:10');
  await drawer.getByRole('button', { name: SETTINGS.ollamaTest }).click();
  await expect(drawer.getByTestId('settings-ollama')).toContainText(SETTINGS.ollamaSaved);
  await expect(drawer.getByTestId('ollama-status')).toHaveText(SETTINGS.ollamaNotRunning);
  expect((await api<{ base_url: string }>('GET', '/api/settings/ollama')).base_url).toBe(
    'http://127.0.0.1:10',
  );

  await page.reload();
  drawer = await openSettings(page);
  await expect(drawer.getByLabel(SETTINGS.ollamaUrl)).toHaveValue('http://127.0.0.1:10');
});

test('the coach default saves on change and is shown after a reload', async ({ page }) => {
  let drawer = await openSettings(page);
  const backend = drawer.getByLabel(SETTINGS.coachBackend);
  await expect(backend).toHaveValue('anthropic');
  await backend.selectOption('openai');
  await expect(drawer.getByTestId('settings-coach')).toContainText(SETTINGS.coachSaved);
  expect(await api<{ backend: string }>('GET', '/api/settings/coach-default')).toMatchObject({
    backend: 'openai',
  });

  await page.reload();
  drawer = await openSettings(page);
  await expect(drawer.getByLabel(SETTINGS.coachBackend)).toHaveValue('openai');
  await expect(drawer.getByText(SETTINGS.coachHint)).toBeVisible();
});
