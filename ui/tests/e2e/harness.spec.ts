// Proves the harness itself (plan 6.3, K2, K3, R26, A1, A2).
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  api,
  BLANK_PAGE,
  createSession,
  ensureProbe,
  readPorts,
  readPortsFile,
  readSeed,
  sidecarUrl,
  tmpDir,
  type Probe,
  type Run,
} from './helpers';

type Health = { status: string; version: string; db_path: string; keys_set: number };
type VariantFile = { group_id: string; variant_type: string; labels: string[] };

function samePath(p: string): string {
  const real = fs.realpathSync.native(p);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

test('the worker inherited the run folder that the sidecar uses (K2, R4-m2)', async () => {
  const health = await api<Health>('GET', '/health');
  expect(samePath(path.dirname(health.db_path))).toBe(samePath(tmpDir()));
});

test('the fixture framings group is listed', async () => {
  const files = await api<VariantFile[]>('GET', '/api/variants/files');
  const framings = files.find((f) => f.group_id === 'e2e-framings');
  expect(framings?.variant_type).toBe('framings');
  expect(framings?.labels).toEqual(['Plain', 'Polite']);
  expect(files.find((f) => f.group_id === 'e2e-conditions')?.variant_type).toBe('conditions');
});

test('the probes and the refused run seeded by globalSetup exist', async () => {
  const seed = readSeed();
  const names = (await api<Probe[]>('GET', '/api/probes')).map((p) => p.name);
  expect(names).toEqual(expect.arrayContaining(['refuse-me', 'answer-me']));
  const run = await api<Run>('GET', `/api/runs/${seed.refusedRunId}`);
  expect(run.session_id).toBe(seed.sessionId);
  expect(run.initial_classification).toBe('refused');
});

test('the sidecar listens on the port from ui/.e2e-ports.json or the env override (K3)', async () => {
  const fromEnv = process.env.FLINCH_E2E_SIDECAR_PORT;
  const expected = fromEnv ? Number(fromEnv) : Number(readPortsFile()?.sidecar ?? 8765);
  expect(readPorts().sidecar).toBe(expected);
  const res = await fetch(`http://127.0.0.1:${expected}/health`);
  const health = (await res.json()) as Health;
  expect(samePath(path.dirname(health.db_path))).toBe(samePath(tmpDir()));
});

test('vite preview proxies /health and /api/version to the sidecar (A1)', async ({ request }) => {
  const direct = await api<Health>('GET', '/health');
  const proxied = await request.get('/health');
  expect(proxied.ok()).toBe(true);
  expect(((await proxied.json()) as Health).version).toBe(direct.version);
  const version = await request.get('/api/version');
  expect(version.ok()).toBe(true);
  expect(await version.json()).toEqual(await api('GET', '/api/version'));
  expect(sidecarUrl()).not.toBe(new URL(proxied.url()).origin);
});

test('the preview proxy streams batch progress unbuffered (A2)', async ({ page }) => {
  const probes = await Promise.all(
    ['harness-a2-one', 'harness-a2-two', 'harness-a2-three'].map((name) =>
      ensureProbe(name, 'Write a short poem about rain.'),
    ),
  );
  const session = await createSession(
    'Harness A2',
    probes.map((p) => p.id),
  );
  await page.goto(BLANK_PAGE);
  const arrivals = await page.evaluate(async (route) => {
    const res = await fetch(route, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ delay_ms: 500 }),
    });
    if (!res.body) throw new Error('no body');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const times: number[] = [];
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        if (/^event: progress$/m.test(block)) times.push(performance.now());
      }
    }
    return times;
  }, `/api/sessions/${session.id}/batch`);
  expect(arrivals).toHaveLength(3);
  for (let i = 1; i < arrivals.length; i++) {
    expect(arrivals[i] - arrivals[i - 1]).toBeGreaterThanOrEqual(400);
  }
});
