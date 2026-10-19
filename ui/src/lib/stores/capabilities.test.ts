import { afterEach, describe, expect, it, vi } from 'vitest';
import { capabilities, UNREACHABLE_AFTER } from './capabilities.svelte';

const HEALTH = { status: 'ok', version: '0.9.0', db_path: 'C:/x/flinch.db', keys_set: 1 };
const CAPS = { pdf: false, experiment_extras: true, openai_sdk: true, google_sdk: false };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('capabilities store', () => {
  it('reads /health, then the capabilities once', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/health') ? json(HEALTH) : json(CAPS),
    );
    vi.stubGlobal('fetch', fetch);
    await capabilities.checkHealth();
    await capabilities.loadCapabilities();
    expect(capabilities.sidecar).toBe('ready');
    expect(capabilities.health?.version).toBe('0.9.0');
    expect(capabilities.caps).toEqual(CAPS);
    await capabilities.checkHealth();
    await capabilities.loadCapabilities();
    const capsCalls = fetch.mock.calls.filter(([u]) => u.endsWith('/capabilities'));
    expect(capsCalls).toHaveLength(1);
  });

  it('counts failures and clears them on the next answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ detail: 'down' }, 503)),
    );
    for (let i = 0; i < UNREACHABLE_AFTER; i++) await capabilities.checkHealth();
    expect(capabilities.sidecar).toBe('crashed');
    expect(capabilities.unreachable).toBe(true);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.endsWith('/health') ? json(HEALTH) : json(CAPS))),
    );
    await capabilities.checkHealth();
    expect(capabilities.unreachable).toBe(false);
    expect(capabilities.sidecar).toBe('ready');
  });

  it('reloads the capabilities after a restart', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/health') ? json(HEALTH) : json({ ...CAPS, pdf: true }),
    );
    vi.stubGlobal('fetch', fetch);
    await capabilities.restarted();
    expect(capabilities.caps?.pdf).toBe(true);
    expect(capabilities.crash).toBeNull();
  });
});
