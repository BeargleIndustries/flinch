/**
 * Client-side preferences (brief 4.3). Every key is stored under the `flinch:`
 * prefix, and every read and write is wrapped in try/catch: storage can be
 * missing or throw (private mode, quota), and a preference is never worth an
 * error.
 */

export const PREFIX = 'flinch:';

/** The keys of brief 4.3, without the prefix. */
export type PrefKey =
  | 'onboarding_done'
  | 'onboarding_step'
  | 'session_id'
  | 'rail_open'
  | 'split_ratio'
  | `tip_seen:${string}`
  | 'tour_seen'
  | 'devtools_autoopen'
  | 'export_theme'
  | 'probe_filter_domain';

/** The part of `Storage` these helpers use; tests pass a fake. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function store(): KV | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function read(key: PrefKey, kv: KV | undefined = store()): string | null {
  try {
    return kv?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function write(key: PrefKey, value: string, kv: KV | undefined = store()): void {
  try {
    kv?.setItem(PREFIX + key, value);
  } catch {
    // Storage full or blocked: the preference is simply not remembered.
  }
}

export function remove(key: PrefKey, kv: KV | undefined = store()): void {
  try {
    kv?.removeItem(PREFIX + key);
  } catch {
    // Nothing to do.
  }
}

/** `"true"` and `"false"` as booleans; anything else gives `fallback`. */
export function readBool(key: PrefKey, fallback: boolean, kv: KV | undefined = store()): boolean {
  const v = read(key, kv);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

export function writeBool(key: PrefKey, value: boolean, kv: KV | undefined = store()): void {
  write(key, value ? 'true' : 'false', kv);
}

/** A finite number, or null when the key is missing or not a number. */
export function readNumber(key: PrefKey, kv: KV | undefined = store()): number | null {
  const v = read(key, kv);
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function writeNumber(key: PrefKey, value: number, kv: KV | undefined = store()): void {
  write(key, String(value), kv);
}
