import { describe, expect, it } from 'vitest';
import { statusTone, statusWord, type StatusTone } from './status-chip';

const CASES: [string, StatusTone][] = [
  ['draft', 'neutral'],
  ['pending', 'neutral'],
  ['running', 'accent'],
  ['paused', 'warn'],
  ['completed', 'ok'],
  ['complete', 'ok'],
  ['failed', 'danger'],
  ['abandoned', 'muted'],
  ['cancelled', 'muted'],
  ['RUNNING', 'accent'],
  ['something-new', 'neutral'],
];

describe('statusTone', () => {
  for (const [status, tone] of CASES) {
    it(`${status} is ${tone}`, () => expect(statusTone(status)).toBe(tone));
  }

  it('handles a missing status', () => {
    expect(statusTone(null)).toBe('neutral');
    expect(statusWord(undefined)).toBe('Unknown');
  });

  it('capitalises the word', () => {
    expect(statusWord('running')).toBe('Running');
    expect(statusWord('in_progress')).toBe('In progress');
  });
});
