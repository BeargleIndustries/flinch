// Tour <-> tips coordination.
//
// The tour (brief A.3) points at places a first-time tip would otherwise
// explain. When the tour shows a step, we flip the `flinch:tip_seen:*` flag for
// any tip whose `tutorialStepId` names that step (`step-1` to `step-10`), OR
// whose `data-tip` selector names an anchor the step points at. Coupling is
// one-way: tour -> tips. Tips never change the tour.
//
// Flinch port (brief 5.5): the prefix is `flinch:tip_seen:`, and reads and
// writes go through prefs.ts (brief 4.3), so blocked storage never throws.

import { PREFIX, readBool, remove, writeBool } from '$lib/prefs';
import { tipsRegistry } from './tips-registry';

const STORAGE_PREFIX = `${PREFIX}tip_seen:`;

/** `stepRef` is the tour's current step id; `anchors` are the anchors it points at. */
export function markTipsSeenForStep(stepRef: string, anchors: readonly string[] = []): void {
  for (const tip of tipsRegistry) {
    const matchesStep = tip.tutorialStepId === stepRef;
    const matchesTarget = anchors.some((a) => tip.target === `[data-tip="${a}"]`);
    if (matchesStep || matchesTarget) markTipSeen(tip.id);
  }
}

/** Forget every "tip seen" flag, including ones for tips no longer in the registry. */
export function resetAllTips(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const ids: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) ids.push(k.slice(STORAGE_PREFIX.length));
    }
    for (const tip of tipsRegistry) ids.push(tip.id);
    for (const id of ids) remove(`tip_seen:${id}`);
  } catch {
    /* storage unavailable */
  }
}

export function isTipSeen(id: string): boolean {
  return readBool(`tip_seen:${id}`, false);
}

export function markTipSeen(id: string): void {
  writeBool(`tip_seen:${id}`, true);
}
