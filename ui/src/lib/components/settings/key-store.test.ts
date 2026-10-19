import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '$lib/api/client';
import { ROUTES, type RouteDef } from '$lib/api/endpoints';
import type { SettingsKey } from '$lib/api/types';
import { keyStore, scrub, type KeyStoreDeps } from './key-store';

type Call = { route: RouteDef; opts?: RequestOptions } | { shell: string; args: string[] };

const entry: SettingsKey = {
  env_var: 'TOGETHER_API_KEY',
  provider: 'meta',
  label: 'Together AI (Llama)',
  required: false,
  is_set: false,
  masked: '',
};

function fakes(answers: Map<RouteDef, unknown>) {
  const calls: Call[] = [];
  const deps: KeyStoreDeps = {
    request: async <T>(route: RouteDef, opts?: RequestOptions) => {
      calls.push({ route, opts });
      return answers.get(route) as T;
    },
    setApiKey: async (provider, key) => {
      calls.push({ shell: 'set_api_key', args: [provider, key] });
    },
    deleteApiKey: async (provider) => {
      calls.push({ shell: 'delete_api_key', args: [provider] });
    },
  };
  return { calls, deps };
}

const ok = new Map<RouteDef, unknown>([
  [ROUTES.validateKey, { valid: true, error: null }],
  [ROUTES.setRuntimeKey, { ok: true }],
  [ROUTES.clearRuntimeKey, { ok: true }],
  [ROUTES.updateKeys, { ok: true, keys: [] }],
  [ROUTES.testKey, { ok: true, message: 'Connected' }],
]);

describe('keyStore, dev (.env through POST /api/settings/keys)', () => {
  it('validates, then writes the env var', async () => {
    const { calls, deps } = fakes(ok);
    const store = keyStore(false, deps);
    expect(store.kind).toBe('env-file');
    expect(await store.save(entry, '  tk-123  ')).toEqual({ ok: true });
    expect(calls).toEqual([
      { route: ROUTES.validateKey, opts: { body: { provider: 'meta', key: 'tk-123' } } },
      { route: ROUTES.updateKeys, opts: { body: { TOGETHER_API_KEY: 'tk-123' } } },
    ]);
  });

  it('stops when the key does not validate, and blanks the key in the error', async () => {
    const answers = new Map(ok);
    answers.set(ROUTES.validateKey, { valid: false, error: 'Incorrect API key: tk-bad' });
    const { calls, deps } = fakes(answers);
    expect(await keyStore(false, deps).save(entry, 'tk-bad')).toEqual({
      ok: false,
      error: 'Incorrect API key: ***',
    });
    expect(calls).toHaveLength(1);
  });

  it('removes by writing an empty value', async () => {
    const { calls, deps } = fakes(ok);
    await keyStore(false, deps).remove(entry);
    expect(calls).toEqual([{ route: ROUTES.updateKeys, opts: { body: { TOGETHER_API_KEY: '' } } }]);
  });
});

describe('keyStore, desktop (Credential Manager, then the running sidecar)', () => {
  it('validates, stores in the shell, then pushes to the sidecar', async () => {
    const { calls, deps } = fakes(ok);
    const store = keyStore(true, deps);
    expect(store.kind).toBe('credential-manager');
    expect(await store.save(entry, 'tk-123')).toEqual({ ok: true });
    expect(calls).toEqual([
      { route: ROUTES.validateKey, opts: { body: { provider: 'meta', key: 'tk-123' } } },
      { shell: 'set_api_key', args: ['meta', 'tk-123'] },
      { route: ROUTES.setRuntimeKey, opts: { body: { provider: 'meta', key: 'tk-123' } } },
    ]);
  });

  it('reports a sidecar refusal', async () => {
    const answers = new Map(ok);
    answers.set(ROUTES.setRuntimeKey, { ok: false, error: 'Unknown provider: meta' });
    const { deps } = fakes(answers);
    expect(await keyStore(true, deps).save(entry, 'tk-123')).toEqual({
      ok: false,
      error: 'Unknown provider: meta',
    });
  });

  it('removes from the shell and clears the sidecar', async () => {
    const { calls, deps } = fakes(ok);
    await keyStore(true, deps).remove(entry);
    expect(calls).toEqual([
      { shell: 'delete_api_key', args: ['meta'] },
      { route: ROUTES.clearRuntimeKey, opts: { query: { provider: 'meta' } } },
    ]);
  });

  it('throws when the sidecar does not clear the key', async () => {
    const answers = new Map(ok);
    answers.set(ROUTES.clearRuntimeKey, { ok: false, error: 'nope' });
    const { deps } = fakes(answers);
    await expect(keyStore(true, deps).remove(entry)).rejects.toThrow('nope');
  });
});

describe('keyStore.test', () => {
  it('maps the test-key answer', async () => {
    const answers = new Map(ok);
    expect(await keyStore(false, fakes(answers).deps).test(entry)).toEqual({ ok: true });
    answers.set(ROUTES.testKey, { ok: false, error: 'No Anthropic API key set' });
    expect(await keyStore(false, fakes(answers).deps).test(entry)).toEqual({
      ok: false,
      error: 'No Anthropic API key set',
    });
  });
});

describe('scrub', () => {
  it('fills in an empty reason', () => {
    expect(scrub(null, 'k')).toBe('no reason given');
    expect(scrub('  ', '')).toBe('no reason given');
  });
});
