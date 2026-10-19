// The tour (brief A.3, plan D12): data only, at most 10 steps. Tour.svelte
// shows each step's card at `[data-tour="{anchor}"]` with "Step {n} of 10".
// When `requires` is not met the card shows `missing` instead of `body` and
// "Next" skips ahead. Tips whose `tutorialStepId` names a step id are marked
// seen once the tour shows that step (tips/coordinate.ts).

/** What a step needs before its body makes sense. */
export type TourRequirement =
  /** The workspace shows a run (a response exists). */
  | 'run'
  /** The run is in phase `pushback` (Refused or Negotiated, no pushback yet). */
  | 'pushback'
  /** The run is in phase `done` (pushback sent or skipped). */
  | 'done';

export interface TourStep {
  /** `step-1` to `step-10`; tips name these in `tutorialStepId`. */
  id: string;
  /** Value of the `data-tour` attribute the card points at. */
  anchor: string;
  title: string;
  body: string;
  requires?: TourRequirement;
  /** Shown instead of `body` while `requires` is not met. */
  missing?: string;
  /** Label of the step's own action button, shown in place of "Next". */
  action?: string;
}

/** D12: the tour is at most 10 steps. */
export const MAX_TOUR_STEPS = 10;

export const tourSteps: TourStep[] = [
  {
    id: 'step-1',
    anchor: 'session-switcher',
    title: 'Your session',
    body: 'One model, one system prompt, its runs. Everything in Probe belongs to the session shown here.',
  },
  {
    id: 'step-2',
    anchor: 'probe-row',
    title: 'A probe',
    body: 'A prompt chosen to sit near a content rule. Pick one here, or write your own with Custom prompt.',
  },
  {
    id: 'step-3',
    anchor: 'send-button',
    title: 'Send it',
    body: 'Sends the probe in a fresh conversation and classifies the answer. Press Send it and the tour sends the active probe for you.',
    // Sends the active probe (or the first visible one) and advances when the run returns.
    action: 'Send it',
  },
  {
    id: 'step-4',
    anchor: 'response-readout',
    title: 'The badge',
    body: 'Refused, Collapsed, Negotiated or Complied. Click a badge to correct it.',
    requires: 'run',
    missing: 'Send a probe to see a badge.',
  },
  {
    id: 'step-5',
    anchor: 'pushback-panel',
    title: 'Push back',
    body: 'The coach drafted a reply that tests the refusal. Edit it if you like; edits count as yours. Then send it.',
    requires: 'pushback',
    missing: 'This one was not refused, so there is nothing to push against.',
  },
  {
    id: 'step-6',
    anchor: 'teach-coach',
    title: 'Teach the coach',
    body: 'After a pushback, save the exchange as an example. The coach reads these when drafting.',
    requires: 'done',
    missing: 'Finish the exchange first: send or skip the pushback.',
  },
  {
    id: 'step-7',
    anchor: 'section-tabs',
    title: 'Three sections',
    body: 'Probe is one run. Studies run many: framings, conditions, repeats, sequences, models, baselines. Data reads it all back.',
  },
  {
    id: 'step-8',
    anchor: 'session-stats',
    title: 'Where you stand',
    body: 'Runs in this session and how they split across the four badges. It updates as you go.',
  },
  {
    id: 'step-9',
    anchor: 'header-help',
    title: 'Help',
    body: 'The glossary, the methodology and the policies are under this button. Hover any dotted word for its meaning.',
  },
  {
    id: 'step-10',
    anchor: 'settings-button',
    title: 'Settings',
    body: "Keys, the local model server, the coach's default and developer details. A red dot means no key is set yet.",
  },
];
