// The tour's state (brief 5.5, A.3). `quickTour` is what the first-time tips
// read so a tip never shows over the tour card (FirstTimeTip.svelte); `tour`
// is the tour itself, driven by Tour.svelte. Replaces Pry's
// `lessons/quick-tour.svelte.ts`.
//
// Finishing or closing writes `flinch:tour_seen` (brief 4.3). Each step the
// tour shows marks the tips that explain the same place as seen
// (tips/coordinate.ts).
import { markTipsSeenForStep } from '$lib/tips/coordinate';
import { writeBool } from '$lib/prefs';
import { backIndex, nextIndex } from './logic';
import { tourSteps, type TourStep } from './steps';

export const quickTour = $state({ open: false, step: null as string | null });

class TourState {
  open = $state(false);
  index = $state(0);
  /** Step 3's action is running (a probe is being sent). */
  acting = $state(false);

  get step(): TourStep {
    return tourSteps[Math.min(this.index, tourSteps.length - 1)];
  }

  get total(): number {
    return tourSteps.length;
  }

  #show(index: number): void {
    this.index = index;
    this.open = true;
    const step = this.step;
    quickTour.open = true;
    quickTour.step = step.id;
    markTipsSeenForStep(step.id, [step.anchor]);
  }

  /** Starts from step 1. */
  start(): void {
    this.acting = false;
    this.#show(0);
  }

  next(): void {
    const n = nextIndex(this.index, this.total);
    if (n === null) this.finish();
    else this.#show(n);
  }

  back(): void {
    this.#show(backIndex(this.index));
  }

  /** Finish or close: either way the tour counts as seen. */
  finish(): void {
    writeBool('tour_seen', true);
    this.open = false;
    this.acting = false;
    quickTour.open = false;
    quickTour.step = null;
  }
}

export const tour = new TourState();
