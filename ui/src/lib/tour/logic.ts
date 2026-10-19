// The tour's rules (brief A.3), apart from the card: whether a step's
// requirement holds for the Probe workspace's phase, and what the card's
// forward button says and does.
import type { Side } from '$lib/popup/place';
import type { Phase } from '$lib/probe-machine';
import { tipsRegistry } from '$lib/tips/tips-registry';
import type { TourRequirement, TourStep } from './steps';

/** Phases in which the workspace shows a run (a response exists). */
const HAS_RUN: readonly Phase[] = ['response', 'pushback', 'done'];

export function requirementMet(req: TourRequirement | undefined, phase: Phase): boolean {
  if (!req) return true;
  if (req === 'run') return HAS_RUN.includes(phase);
  return phase === req;
}

/** The card's text: `missing` while the requirement is unmet, else the body. */
export function stepText(step: TourStep, met: boolean): string {
  return met || !step.missing ? step.body : step.missing;
}

export type ForwardKind = 'action' | 'next' | 'done';

/**
 * The forward button: the step's own action (step 3, while its requirement
 * holds), "Next", or "Done" on the last step. An unmet step's "Next" skips
 * ahead (A.3).
 */
export function forwardKind(step: TourStep, index: number, total: number): ForwardKind {
  if (step.action) return 'action';
  return index >= total - 1 ? 'done' : 'next';
}

/** Index after `index`, or null when the tour is over. */
export function nextIndex(index: number, total: number): number | null {
  return index + 1 < total ? index + 1 : null;
}

/** Index before `index` (never below 0). */
export function backIndex(index: number): number {
  return Math.max(0, index - 1);
}

/** Anchors no tip shares, and where the card sits beside them. */
const OWN_SIDES: Record<string, Side> = {
  'session-stats': 'right',
  'header-help': 'bottom',
  'settings-button': 'bottom',
};

/**
 * The side the card prefers for an anchor: the side the first-time tip for
 * the same anchor uses (A.2), else the tour's own choice, else below.
 */
export function preferredSide(anchor: string): Side {
  const tip = tipsRegistry.find((t) => t.target === `[data-tour="${anchor}"]`);
  return tip?.placement ?? OWN_SIDES[anchor] ?? 'bottom';
}
