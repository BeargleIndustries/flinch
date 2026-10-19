// Where a provider key is saved (brief 9.7, D11). The desktop app keeps keys
// in Windows Credential Manager (`set_api_key` / `delete_api_key`) and pushes
// them into the running sidecar with `/api/settings/set-key`; dev writes them
// to the sidecar's `.env` file with `POST /api/settings/keys` (I14: the file is
// `FLINCH_ENV_FILE` or the default). Every save is validated first with
// `/api/settings/validate-key`. The functions it needs are passed in, so both
// paths are unit tested without the shell.
import type { RequestOptions } from '$lib/api/client';
import { ROUTES, type RouteDef } from '$lib/api/endpoints';
import type {
  SetKeyResponse,
  TestKeyResponse,
  UpdateKeysResponse,
  SettingsKey,
  ValidateKeyResponse,
} from '$lib/api/types';
import type { KeyResult } from './key-row';

export type KeyStoreKind = 'credential-manager' | 'env-file';

export interface KeyStoreDeps {
  request: <T>(route: RouteDef, opts?: RequestOptions) => Promise<T>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  deleteApiKey: (provider: string) => Promise<void>;
}

export interface KeyStore {
  kind: KeyStoreKind;
  /** Validate, then store the key. */
  save: (entry: SettingsKey, key: string) => Promise<KeyResult>;
  /** Delete the stored key; throws when the sidecar refuses. */
  remove: (entry: SettingsKey) => Promise<void>;
  /** Ask the provider whether the key the sidecar holds works. */
  test: (entry: SettingsKey) => Promise<KeyResult>;
}

/** Error text from a provider, with the key itself blanked out if the SDK echoed it. */
export function scrub(error: string | null | undefined, key: string): string {
  const text = (error ?? '').trim() || 'no reason given';
  return key ? text.split(key).join('***') : text;
}

export function keyStore(desktop: boolean, deps: KeyStoreDeps): KeyStore {
  const { request } = deps;

  async function save(entry: SettingsKey, raw: string): Promise<KeyResult> {
    const key = raw.trim();
    const body = { provider: entry.provider, key };
    const v = await request<ValidateKeyResponse>(ROUTES.validateKey, { body });
    if (!v.valid) return { ok: false, error: scrub(v.error, key) };

    if (desktop) {
      await deps.setApiKey(entry.provider, key);
      const r = await request<SetKeyResponse>(ROUTES.setRuntimeKey, { body });
      if (!r.ok) return { ok: false, error: scrub(r.error, key) };
    } else {
      await request<UpdateKeysResponse>(ROUTES.updateKeys, { body: { [entry.env_var]: key } });
    }
    return { ok: true };
  }

  async function remove(entry: SettingsKey): Promise<void> {
    if (desktop) {
      await deps.deleteApiKey(entry.provider);
      const r = await request<SetKeyResponse>(ROUTES.clearRuntimeKey, {
        query: { provider: entry.provider },
      });
      if (!r.ok) throw new Error(r.error ?? 'The sidecar did not clear the key.');
    } else {
      await request<UpdateKeysResponse>(ROUTES.updateKeys, { body: { [entry.env_var]: '' } });
    }
  }

  async function test(entry: SettingsKey): Promise<KeyResult> {
    const r = await request<TestKeyResponse>(ROUTES.testKey, {
      body: { provider: entry.provider },
    });
    return r.ok ? { ok: true } : { ok: false, error: scrub(r.error, '') };
  }

  return { kind: desktop ? 'credential-manager' : 'env-file', save, remove, test };
}
