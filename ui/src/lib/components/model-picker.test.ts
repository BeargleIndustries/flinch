import { describe, expect, it } from 'vitest';
import { groupLabel, isListed, providerOf, type ModelGroup } from './model-picker';

const GROUPS: ModelGroup[] = [
  {
    provider: 'anthropic',
    available: true,
    hint: '',
    models: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }],
  },
  {
    provider: 'openai',
    available: false,
    hint: 'Set OPENAI_API_KEY',
    models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
  },
  { provider: 'meta', available: true, hint: '', models: [] },
  { provider: 'ollama', available: false, hint: '', models: [] },
];

describe('model picker', () => {
  it('labels groups with the provider name and, when unavailable, the hint', () => {
    expect(GROUPS.map(groupLabel)).toEqual([
      'Anthropic',
      'OpenAI (Set OPENAI_API_KEY)',
      'Together (Llama)',
      'Ollama (local)',
    ]);
  });

  it('keeps an unknown provider id as its label', () => {
    expect(groupLabel({ provider: 'mistral', available: true, hint: '', models: [] })).toBe(
      'mistral',
    );
  });

  it('knows which ids are listed and under which provider', () => {
    expect(isListed('gpt-4o', GROUPS)).toBe(true);
    expect(isListed('grok-3', GROUPS)).toBe(false);
    expect(providerOf('claude-sonnet-4-6', GROUPS)).toBe('anthropic');
    expect(providerOf('grok-3', GROUPS)).toBeNull();
  });
});
