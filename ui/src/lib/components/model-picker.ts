// Model picker logic (brief 5.6 `ModelPicker`). `ModelGroup` is the shape of
// one entry of GET /api/models (tests/shapes.py `ModelProvider`); T13's
// types.ts mirrors the same fields, so either type fits.

export interface ModelOption {
  id: string;
  name: string;
  deprecated?: boolean;
}

export interface ModelGroup {
  provider: string;
  models: ModelOption[];
  available: boolean;
  /** Why the group is unavailable (no key, no SDK, Ollama not running). */
  hint: string;
}

/** Group labels (brief 5.6; provider names per 5.7 rule 7). */
export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  xai: 'xAI',
  meta: 'Together (Llama)',
  ollama: 'Ollama (local)',
};

/** `<select>` value of the "Other model id…" option; never a real model id. */
export const CUSTOM_OPTION = '__custom__';

/** The optgroup label: the provider name, plus the hint when the group is unavailable. */
export function groupLabel(group: ModelGroup): string {
  const name = PROVIDER_LABELS[group.provider] ?? group.provider;
  const hint = group.hint.trim();
  return group.available || !hint ? name : `${name} (${hint})`;
}

/** Whether `value` is one of the listed models (in any group). */
export function isListed(value: string, groups: readonly ModelGroup[]): boolean {
  return groups.some((g) => g.models.some((m) => m.id === value));
}
