// One provider key row (brief 9.7, 5.6 `KeyRow`). `KeyEntry` is one entry of
// GET /api/settings/keys (tests/shapes.py `SettingsKey`); T13's types.ts
// mirrors the same fields.

import { KEY_ROW } from '$lib/copy/settings';

export interface KeyEntry {
  env_var: string;
  provider: string;
  label: string;
  required: boolean;
  is_set: boolean;
  masked: string;
}

/** What a save or a test reports back to the row. */
export type KeyResult = { ok: true } | { ok: false; error: string };

/** Row order and labels (brief 9.7). */
export const KEY_ORDER = ['anthropic', 'openai', 'google', 'xai', 'meta'] as const;

export const KEY_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  xai: 'xAI',
  meta: 'Together (Llama)',
};

/** POST /api/settings/test-key covers these three; xAI and Together are checked when saved. */
const TESTABLE = new Set(['anthropic', 'openai', 'google']);

export function canTest(provider: string): boolean {
  return TESTABLE.has(provider);
}

export function keyLabel(entry: KeyEntry): string {
  return KEY_LABELS[entry.provider] ?? entry.label;
}

/** "Set · {masked}" or "Not set". */
export function keyStatus(entry: KeyEntry): string {
  if (!entry.is_set) return KEY_ROW.notSet;
  return entry.masked ? KEY_ROW.setMasked(entry.masked) : KEY_ROW.set;
}

/** Entries in KEY_ORDER; unknown providers keep their order after the known ones. */
export function sortKeys<E extends KeyEntry>(entries: readonly E[]): E[] {
  const rank = (p: string) => {
    const i = (KEY_ORDER as readonly string[]).indexOf(p);
    return i === -1 ? KEY_ORDER.length : i;
  };
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank(a.e.provider) - rank(b.e.provider) || a.i - b.i)
    .map(({ e }) => e);
}
