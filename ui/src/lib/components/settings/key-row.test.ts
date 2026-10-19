import { describe, expect, it } from 'vitest';
import type { SettingsKey } from '$lib/api/types';
import { canTest, keyLabel, keyStatus, sortKeys } from './key-row';

const entry = (provider: string, over: Partial<SettingsKey> = {}): SettingsKey => ({
  env_var: `${provider.toUpperCase()}_API_KEY`,
  provider,
  label: provider,
  required: false,
  is_set: false,
  masked: '',
  ...over,
});

const PROVIDERS = ['anthropic', 'openai', 'google', 'xai', 'meta'];

describe('key row', () => {
  it('labels providers per brief 9.7', () => {
    expect(PROVIDERS.map((p) => keyLabel(entry(p)))).toEqual([
      'Anthropic',
      'OpenAI',
      'Google',
      'xAI',
      'Together (Llama)',
    ]);
    expect(keyLabel(entry('mistral', { label: 'Mistral' }))).toBe('Mistral');
  });

  it('writes the status line', () => {
    expect(keyStatus(entry('anthropic'))).toBe('Not set');
    expect(keyStatus(entry('anthropic', { is_set: true, masked: 'sk-a...1234' }))).toBe(
      'Set · sk-a...1234',
    );
  });

  it('offers Test only where the sidecar can test the key', () => {
    expect(PROVIDERS.map(canTest)).toEqual([true, true, true, false, false]);
  });

  it('sorts rows anthropic, openai, google, xai, meta', () => {
    const rows = sortKeys([entry('meta'), entry('zzz'), entry('google'), entry('anthropic')]);
    expect(rows.map((e) => e.provider)).toEqual(['anthropic', 'google', 'meta', 'zzz']);
  });
});
