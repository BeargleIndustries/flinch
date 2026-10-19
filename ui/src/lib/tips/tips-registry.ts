// Central registry of first-mount contextual tips (brief A.2).
// Each entry becomes at most one popover, gated on the preference
// `flinch:tip_seen:{id}`. See ui/src/lib/components/FirstTimeTip.svelte.
// Order is priority order.
//
// Tour coordination: `tutorialStepId` (when set) names a tour step id
// (`step-1` to `step-10`, ui/src/lib/tour/steps.ts); the tip is marked seen once
// the tour shows that step (tips/coordinate.ts).
//
// T11 ships the type and an empty list so FirstTimeTip and coordinate.ts
// resolve; T12 fills `tipsRegistry` with the rows of brief A.2.

export type TipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TipDef {
  /** Unique stable id; becomes the preference key suffix. */
  id: string;
  /** Names the thing the tip is about, shown as the tip's heading. */
  title: string;
  /** querySelector for the anchor element. */
  target: string;
  /** Short one-liner shown by default. */
  blurb: string;
  /** Optional expanded paragraph shown when the user clicks "why?". */
  why: string | null;
  /** Preferred side of the target; placePopup flips or insets when it doesn't fit. */
  placement: TipPlacement;
  /** Point the arrow aims at, as a fraction [fx, fy] of the target rect. Default [0.5, 0.5]. */
  focus?: [number, number];
  /** If set, the tip is marked seen when the tour shows this step id. */
  tutorialStepId?: string;
}

export const tipsRegistry: TipDef[] = [];
