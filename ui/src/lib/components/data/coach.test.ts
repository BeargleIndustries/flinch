import { describe, expect, it } from 'vitest';
import type { CoachExample } from '$lib/api/types';
import {
  EFFECTIVENESS,
  EXAMPLE_LIMIT,
  NEW_PROFILE,
  applyUpdate,
  chosenProfile,
  clampEffectiveness,
  excerpt,
  patternLabel,
  pushbackPatch,
  withoutExample,
} from './coach';

const ex = (id: number, over: Partial<CoachExample> = {}): CoachExample => ({
  id,
  run_id: id * 10,
  coach_profile: 'standard',
  refusal_text: 'I cannot help with that.',
  pushback_text: 'What specifically is the problem?',
  outcome: 'collapsed',
  pattern: 'flinch_then_fold',
  move: 'specificity_challenge',
  effectiveness: 3,
  promoted_at: '2026-10-19 10:00:00',
  ...over,
});

describe('coach examples helpers', () => {
  it('asks for every example and offers ratings 1 to 5', () => {
    expect(EXAMPLE_LIMIT).toBe(500);
    expect([...EFFECTIVENESS]).toEqual([1, 2, 3, 4, 5]);
  });

  it('cuts excerpts at 300 characters with an ellipsis', () => {
    expect(excerpt('  short  ')).toBe('short');
    expect(excerpt(null)).toBe('');
    const long = 'x'.repeat(301);
    expect(excerpt(long)).toBe(`${'x'.repeat(300)}…`);
    expect(excerpt('x'.repeat(300))).toBe('x'.repeat(300));
  });

  it('reads patterns as words and hides unknown ones', () => {
    expect(patternLabel('flinch_then_fold')).toBe('flinch then fold');
    expect(patternLabel('lexical-trigger')).toBe('lexical trigger');
    expect(patternLabel('unknown')).toBe('');
    expect(patternLabel('  ')).toBe('');
    expect(patternLabel(null)).toBe('');
  });

  it('clamps ratings', () => {
    expect(clampEffectiveness(0)).toBe(1);
    expect(clampEffectiveness(9)).toBe(5);
    expect(clampEffectiveness(4.4)).toBe(4);
    expect(clampEffectiveness(Number.NaN)).toBe(3);
    expect(clampEffectiveness(undefined)).toBe(3);
  });

  it('resolves the profile from the select and the typed name', () => {
    expect(chosenProfile('standard', '')).toBe('standard');
    expect(chosenProfile('careful', 'ignored')).toBe('careful');
    expect(chosenProfile('', '')).toBe('standard');
    expect(chosenProfile(NEW_PROFILE, '  my-profile ')).toBe('my-profile');
    expect(chosenProfile(NEW_PROFILE, '   ')).toBeNull();
  });

  it('builds the pushback PATCH only when the text changed', () => {
    expect(pushbackPatch('old', '  new text ')).toEqual({ pushback_text: 'new text' });
    expect(pushbackPatch('same', ' same ')).toBeNull();
    expect(pushbackPatch('old', '   ')).toBe('empty');
  });

  it('applies an update in place and keeps the order', () => {
    const list = [ex(1), ex(2, { effectiveness: 2 })];
    const next = applyUpdate(list, 2, { effectiveness: 5, pushback_text: null });
    expect(next.map((e) => e.id)).toEqual([1, 2]);
    expect(next[1].effectiveness).toBe(5);
    expect(next[1].pushback_text).toBe('What specifically is the problem?');
    expect(list[1].effectiveness).toBe(2);
    expect(applyUpdate(list, 9, { effectiveness: 1 })).toEqual(list);
  });

  it('removes one example', () => {
    expect(withoutExample([ex(1), ex(2)], 1).map((e) => e.id)).toEqual([2]);
    expect(withoutExample([ex(1)], 7)).toHaveLength(1);
  });
});
