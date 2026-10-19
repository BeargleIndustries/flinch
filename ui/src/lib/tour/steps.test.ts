// Tour shape (D12, AC17): at most 10 steps, each anchor set as data-tour in a
// .svelte file (greped at test time), titles under 40 characters and bodies
// and missing lines under 240 (brief A.3).
import { describe, expect, it } from 'vitest';
import { filesWithAnchor } from '$lib/tutorial/anchor-scan';
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

  it('keeps titles under 40 characters and bodies under 240', () => {
    for (const s of tourSteps) {
      expect(s.title.length, s.id).toBeLessThan(40);
      expect(s.body.length, s.id).toBeLessThan(240);
      if (s.missing) expect(s.missing.length, s.id).toBeLessThan(240);
    }
  });

  it('points every step at a data-tour anchor set in a .svelte file', () => {
    const missing = tourSteps
      .filter((s) => filesWithAnchor('data-tour', s.anchor).length === 0)
      .map((s) => `${s.id}: data-tour="${s.anchor}"`);
    expect(missing).toEqual([]);
  });

  it('gives only step 3 an action, "Send it"', () => {
    expect(tourSteps.filter((s) => s.action).map((s) => [s.id, s.action])).toEqual([
      ['step-3', 'Send it'],
    ]);
  });

  it('has unique tip ids', () => {
    const ids = tipsRegistry.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
