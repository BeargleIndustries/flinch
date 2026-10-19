import { describe, expect, it } from 'vitest';
import {
  COMPARE_SESSION_PREFIX,
  isCompareSession,
  pickSession,
  truncate,
  visibleSessions,
} from './session';

const s = (id: number, notes: string | null = null) => ({ id, notes });

describe('session list rules (brief 4.4, D29)', () => {
  it('spots Model compare sessions by the notes prefix', () => {
    expect(isCompareSession(`${COMPARE_SESSION_PREFIX} with 2 models, 3 probes`)).toBe(true);
    expect(isCompareSession(`  ${COMPARE_SESSION_PREFIX}`)).toBe(true);
    expect(isCompareSession('My notes')).toBe(false);
    expect(isCompareSession(`Mentions ${COMPARE_SESSION_PREFIX} later`)).toBe(false);
    expect(isCompareSession(null)).toBe(false);
    expect(isCompareSession(undefined)).toBe(false);
  });

  it('lists the visible sessions newest first', () => {
    const list = [s(1), s(3, COMPARE_SESSION_PREFIX), s(2, '')];
    expect(visibleSessions(list).map((x) => x.id)).toEqual([2, 1]);
  });

  it('picks the stored session, else the newest, else null', () => {
    const list = [s(2), s(5), s(4)];
    expect(pickSession(list, 4)?.id).toBe(4);
    expect(pickSession(list, 9)?.id).toBe(5);
    expect(pickSession(list, null)?.id).toBe(5);
    expect(pickSession([], 4)).toBeNull();
  });

  it('truncates with an ellipsis', () => {
    expect(truncate('short', 28)).toBe('short');
    expect(truncate('a'.repeat(30), 28)).toBe(`${'a'.repeat(27)}…`);
  });
});
