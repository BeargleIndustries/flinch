// Tour shape (D12, AC17 part). The anchor check (every anchor appears as
// data-tour="..." in a .svelte file) comes with the screens that hold them.
import { describe, expect, it } from 'vitest';
import { MAX_TOUR_STEPS, tourSteps } from './steps';
import { tipsRegistry } from '../tips/tips-registry';

describe('tour steps', () => {
  it('has at most 10 steps', () => {
    expect(tourSteps.length).toBeGreaterThan(0);
    expect(tourSteps.length).toBeLessThanOrEqual(MAX_TOUR_STEPS);
  });

  it('has unique ids and anchors', () => {
    const ids = tourSteps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const anchors = tourSteps.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it('gives every step with a requirement a missing line', () => {
    for (const s of tourSteps) expect(Boolean(s.requires), s.id).toBe(Boolean(s.missing));
  });

  it('names only real steps in tip tutorialStepId', () => {
    const ids = new Set(tourSteps.map((s) => s.id));
    for (const t of tipsRegistry)
      if (t.tutorialStepId) expect(ids, t.id).toContain(t.tutorialStepId);
  });

  it('has unique tip ids', () => {
    const ids = tipsRegistry.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
