import { describe, expect, it } from 'vitest';
import { tipsRegistry } from '../tips/tips-registry';

// Every popup has to say what it's pointing at, in words, not just by position.
// Pry's quick-tour half of this file read Pry's lesson Markdown, which Flinch
// does not have; the tour's anchors are checked by tour/steps.test.ts (T33).
describe('popups name what they point at', () => {
  it('every first-time tip has a title', () => {
    for (const tip of tipsRegistry) expect(tip.title?.trim(), tip.id).toBeTruthy();
  });

  it('every first-time tip points at a data-tour or data-tip anchor', () => {
    for (const tip of tipsRegistry) {
      expect(tip.target, tip.id).toMatch(/^\[data-(tip|tour)="[^"]+"\]$/);
    }
  });
});
