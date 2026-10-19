// Playwright harness (plan F9, K1 to K3, I38). Read the plan before changing the
// order of anything here: Playwright removes outputDir after loading the config,
// re-executes this file in every worker and in its out-of-process loader, and
// runs user teardown before it stops the web servers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { readPorts } from './tests/e2e/helpers';

// The sentinel: only the process that finds FLINCH_E2E_TMP unset prepares the
// run folder. Workers and the loader inherit the variable and skip it.
const firstLoad = process.env.FLINCH_E2E_TMP === undefined;
process.env.FLINCH_E2E_TMP ??= path.join(os.tmpdir(), 'flinch-e2e', String(process.pid));

const UI_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_VARIANTS = path.join(UI_DIR, 'tests', 'e2e', 'fixtures', 'variants');

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// Creates the run folder, copies the fixture variants, and removes sibling
// flinch-e2e/<pid> folders whose process is gone. There is no teardown
// deletion: the sidecar still holds e2e.db open when user teardown runs (C3-M1).
function prepare(tmp: string): void {
  fs.mkdirSync(tmp, { recursive: true });
  const variants = path.join(tmp, 'variants');
  fs.mkdirSync(variants, { recursive: true });
  for (const name of fs.readdirSync(FIXTURE_VARIANTS)) {
    fs.copyFileSync(path.join(FIXTURE_VARIANTS, name), path.join(variants, name));
  }
  const parent = path.dirname(tmp);
  for (const entry of fs.readdirSync(parent)) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid === process.pid || processAlive(pid)) continue;
    const dir = path.join(parent, entry);
    // Best effort per folder (R4-m1): an orphaned sidecar may still hold its e2e.db.
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      console.log(`flinch e2e: skipped removing ${dir}: ${(err as Error).message}`);
    }
  }
}

const tmp = process.env.FLINCH_E2E_TMP;
if (firstLoad) prepare(tmp);

const ports = readPorts();
const fakeUrl = `http://127.0.0.1:${ports.fake}`;
const sidecarUrl = `http://127.0.0.1:${ports.sidecar}`;
const previewUrl = `http://127.0.0.1:${ports.preview}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  globalSetup: './tests/e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: previewUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `python tests/fake_models.py --port ${ports.fake}`,
      cwd: '..',
      url: `${fakeUrl}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // cwd at the repository root so `-m flinch.app` imports this tree (I37).
      command: `python -m flinch.app --port ${ports.sidecar} --db-path "${path.join(tmp, 'e2e.db')}" --no-stdin-keys`,
      cwd: '..',
      url: `${sidecarUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        FLINCH_ENV_FILE: path.join(tmp, '.env'),
        FLINCH_VARIANTS_DIR: path.join(tmp, 'variants'),
        FLINCH_HF_API_BASE: fakeUrl,
        ANTHROPIC_BASE_URL: fakeUrl,
        OPENAI_BASE_URL: `${fakeUrl}/v1`,
        ANTHROPIC_API_KEY: 'test',
        OPENAI_API_KEY: 'test',
        // Keys from the developer's shell must not reach the e2e sidecar.
        GOOGLE_API_KEY: '',
        XAI_API_KEY: '',
        TOGETHER_API_KEY: '',
        OLLAMA_BASE_URL: 'http://127.0.0.1:9',
        PYTHONUTF8: '1',
      },
    },
    {
      // vite.config.ts reads the preview port and the proxy target from these.
      command: 'npm run preview',
      url: `${previewUrl}/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        FLINCH_E2E_PREVIEW_PORT: String(ports.preview),
        FLINCH_SIDECAR: sidecarUrl,
      },
    },
  ],
});
