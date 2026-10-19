import { describe, expect, it } from 'vitest';
import {
  backIndex,
  forwardKind,
  nextIndex,
  preferredSide,
  requirementMet,
  stepText,
} from './logic';
import { tourSteps } from './steps';

const byId = (id: string) => tourSteps.find((s) => s.id === id)!;

describe('tour requirements', () => {
  it('holds with no requirement in any phase', () => {
    expect(requirementMet(undefined, 'idle')).toBe(true);
  });

  it('needs a run for "run"', () => {
    expect(requirementMet('run', 'idle')).toBe(false);
    expect(requirementMet('run', 'selected')).toBe(false);
    expect(requirementMet('run', 'sending')).toBe(false);
    expect(requirementMet('run', 'response')).toBe(true);
    expect(requirementMet('run', 'pushback')).toBe(true);
    expect(requirementMet('run', 'done')).toBe(true);
  });

  it('needs the exact phase for "pushback" and "done"', () => {
    expect(requirementMet('pushback', 'pushback')).toBe(true);
    expect(requirementMet('pushback', 'done')).toBe(false);
    expect(requirementMet('done', 'done')).toBe(true);
    expect(requirementMet('done', 'pushback')).toBe(false);
  });

  it('shows the missing line while unmet', () => {
    const s = byId('step-6');
    expect(stepText(s, true)).toBe(s.body);
    expect(stepText(s, false)).toBe(s.missing);
    expect(stepText(byId('step-1'), false)).toBe(byId('step-1').body);
  });
});

describe('tour navigation', () => {
  it('gives step 3 its action, the last step Done, the rest Next', () => {
    const n = tourSteps.length;
    expect(forwardKind(byId('step-3'), 2, n)).toBe('action');
    expect(byId('step-3').action).toBe('Send it');
    expect(forwardKind(byId('step-1'), 0, n)).toBe('next');
    expect(forwardKind(tourSteps[n - 1], n - 1, n)).toBe('done');
  });

  it('moves forward until the end and back to the start', () => {
    expect(nextIndex(0, 10)).toBe(1);
    expect(nextIndex(9, 10)).toBeNull();
    expect(backIndex(3)).toBe(2);
    expect(backIndex(0)).toBe(0);
  });
});

describe('tour card side', () => {
  it('follows the tip for the same anchor, else its own choice', () => {
    expect(preferredSide('probe-row')).toBe('right');
    expect(preferredSide('response-readout')).toBe('top');
    expect(preferredSide('session-switcher')).toBe('bottom');
    expect(preferredSide('session-stats')).toBe('right');
    expect(preferredSide('settings-button')).toBe('bottom');
    expect(preferredSide('unknown')).toBe('bottom');
  });
});
