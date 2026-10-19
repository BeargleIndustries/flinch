// Coach examples helpers (brief 9.4, I19, B28). Pure functions the screen and
// its store share; the store does the requests.
import type { CoachExample, UpdateCoachExampleBody } from '$lib/api/types';
import { truncate } from '$lib/format';
import { DEFAULT_COACH_PROFILE } from '$lib/session';

/** GET /api/coach-examples `limit` (B28): every example, not the coach's five. */
export const EXAMPLE_LIMIT = 500;

/** Brief 9.4: the refusal and pushback excerpts are cut at 300 characters. */
export const EXCERPT_LENGTH = 300;

/** The Effectiveness select's values, 1 to 5 (CoachExampleCreate, flinch/models.py). */
export const EFFECTIVENESS = [1, 2, 3, 4, 5] as const;

/** `<select>` value of "New profile name…"; never a real profile name. */
export const NEW_PROFILE = '__new_profile__';

/** The excerpt a card shows: whitespace-trimmed, cut at EXCERPT_LENGTH. */
export function excerpt(text: string | null | undefined, n = EXCERPT_LENGTH): string {
  return truncate((text ?? '').trim(), n);
}

/** A detected pattern as words: "flinch_then_fold" reads "flinch then fold"; blank or "unknown" gives "". */
export function patternLabel(pattern: string | null | undefined): string {
  const p = (pattern ?? '').trim();
  if (p === '' || p.toLowerCase() === 'unknown') return '';
  return p.replace(/[_-]+/g, ' ');
}

/** A rating the select can show: integers 1 to 5; anything else is clamped. */
export function clampEffectiveness(n: number | null | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * The profile the list should show for the select's choice: the typed name
 * for "New profile name…" (trimmed; null while blank), else the choice.
 */
export function chosenProfile(choice: string, typed: string): string | null {
  if (choice !== NEW_PROFILE) return choice || DEFAULT_COACH_PROFILE;
  const t = typed.trim();
  return t === '' ? null : t;
}

/** The PATCH body for a pushback edit, or null when there is nothing to save. */
export function pushbackPatch(
  before: string,
  draft: string,
): { pushback_text: string } | 'empty' | null {
  const next = draft.trim();
  if (next === '') return 'empty';
  if (next === before.trim()) return null;
  return { pushback_text: next };
}

/** The list with one example's fields replaced (the store keeps the order until the next read). */
export function applyUpdate(
  list: readonly CoachExample[],
  id: number,
  patch: UpdateCoachExampleBody,
): CoachExample[] {
  const set = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<CoachExample>;
  return list.map((ex) => (ex.id === id ? { ...ex, ...set } : ex));
}

/** The list without one example. */
export function withoutExample(list: readonly CoachExample[], id: number): CoachExample[] {
  return list.filter((ex) => ex.id !== id);
}
