import { describe, expect, it } from 'vitest';
import { progressLine, progressPct } from './stream-progress';
import { savedMessage } from './download-link';

describe('progress', () => {
  it('computes a clamped percentage', () => {
    expect(progressPct(3, 12)).toBe(25);
    expect(progressPct(15, 12)).toBe(100);
    expect(progressPct(0, 0)).toBe(0);
    expect(progressPct(Number.NaN, 4)).toBe(0);
  });

  it('writes "{completed} of {total}"', () => {
    expect(progressLine(3, 12)).toBe('3 of 12');
  });
});

describe('savedMessage', () => {
  it('names the saved path in the desktop app and says Downloaded in dev', () => {
    expect(savedMessage('C:/Users/me/Downloads/flinch.csv')).toBe(
      'Saved to C:/Users/me/Downloads/flinch.csv',
    );
    expect(savedMessage(null)).toBe('Downloaded');
  });
});
