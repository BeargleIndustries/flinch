// Central registry of first-mount contextual tips (brief A.2).
// Each entry becomes at most one popover, gated on the preference
// `flinch:tip_seen:{id}`. See ui/src/lib/components/FirstTimeTip.svelte.
// Order is priority order.
//
// Tour coordination: `tutorialStepId` (when set) names a tour step id
// (`step-1` to `step-10`, ui/src/lib/tour/steps.ts); the tip is marked seen once
// the tour shows that step (tips/coordinate.ts).
//
// Data only: the rows of brief A.2, verbatim. The test that every `target`
// exists in a `.svelte` file comes with the screens that hold the anchors.

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

export const tipsRegistry: TipDef[] = [
  {
    id: 'session-switcher',
    title: 'Sessions',
    target: '[data-tour="session-switcher"]',
    placement: 'bottom',
    blurb:
      'Everything in Probe happens inside a session: one model, one system prompt, its own runs. Switch or make one here.',
    why: 'A session keeps results comparable. Change the model or the system prompt and you want a new session, so the old numbers stay what they were.',
    tutorialStepId: 'step-1',
  },
  {
    id: 'probe-rail',
    title: 'Probes',
    target: '[data-tour="probe-row"]',
    placement: 'right',
    blurb:
      'Each row is a probe, a test prompt near a content rule. Click one to read it, then send it.',
    why: 'The default set comes from the research behind Flinch. Domains group them; the search box filters by name or text.',
    tutorialStepId: 'step-2',
  },
  {
    id: 'send-button',
    title: 'Send',
    target: '[data-tour="send-button"]',
    placement: 'bottom',
    blurb: 'Sends the probe in a fresh conversation and classifies the answer. S does the same.',
    why: 'Every probe starts clean, so earlier turns cannot change the result. Sequences are the study for testing context on purpose.',
    tutorialStepId: 'step-3',
  },
  {
    id: 'response-readout',
    title: 'The badge',
    target: '[data-tour="response-readout"]',
    placement: 'top',
    blurb:
      'The badge says what the model did. Click it to change it if the classifier got it wrong.',
    why: 'A keyword scan handles the clear cases and a model judges the rest. Your correction is saved on the run and used in every export.',
    tutorialStepId: 'step-4',
  },
  {
    id: 'pushback-panel',
    title: 'Pushing back',
    target: '[data-tour="pushback-panel"]',
    placement: 'top',
    blurb:
      'The coach drafted a reply that tests the refusal. Send it as it is, or edit it. Edits are recorded as yours.',
    why: "The coach picks one of seven moves from the refusal's wording and your past examples. What you send, and what happens next, is the data.",
    tutorialStepId: 'step-5',
  },
  {
    id: 'teach-coach',
    title: 'Teaching the coach',
    target: '[data-tour="teach-coach"]',
    placement: 'top',
    blurb:
      'Saves this refusal and your pushback as an example. The coach reads its best-rated examples when drafting.',
    why: 'Examples are how the coach improves. Teach it the ones that worked and the ones that did not; the outcome is saved with each.',
    tutorialStepId: 'step-6',
  },
  {
    id: 'notes',
    title: 'Notes',
    target: '[data-tour="notes"]',
    placement: 'top',
    blurb:
      'Write what you saw, tag the pattern, and record the finding. All three go into the Findings export.',
    why: 'Findings are what you will cite. A run without a note is a number; a run with one is evidence.',
  },
  {
    id: 'section-tabs',
    title: 'Three sections',
    target: '[data-tour="section-tabs"]',
    placement: 'bottom',
    blurb:
      'Probe is one run at a time. Studies run many. Data is where you read and export what you found.',
    why: 'Most questions start in Probe and move right: a surprising refusal becomes a repeat run, then a framing group, then a report.',
    tutorialStepId: 'step-7',
  },
  {
    id: 'export-button',
    title: 'Export',
    target: '[data-tip="export-button"]',
    placement: 'bottom',
    blurb: 'Gets this session out as JSON, CSV, a findings file, a report or a web page.',
    why: 'The findings file carries your notes and tags in a documented schema. The agent format is the same data shaped for a model to analyse.',
  },
  {
    id: 'settings-keys',
    title: 'Keys',
    target: '[data-tour="settings-keys"]',
    placement: 'left',
    blurb:
      'One provider key is enough to start. Add others to test their models or to use them as the coach.',
    why: 'Keys stay on this computer. In the desktop app they live in Windows Credential Manager and reach the sidecar through a pipe when it starts.',
  },
  {
    id: 'conditions-list',
    title: 'Conditions',
    target: '[data-tour="conditions-list"]',
    placement: 'top',
    blurb:
      'The control has no system prompt. Each other condition is one system prompt the prompts run under.',
    why: 'Keep one control so the comparison has a baseline. Repeats give each cell more than one sample, which the statistics need.',
  },
  {
    id: 'repeat-results',
    title: 'Repeat runs',
    target: '[data-tour="repeat-results"]',
    placement: 'top',
    blurb: 'The bar is how often each badge came up. Half and half means the rule is not a rule.',
    why: 'One run tells you what happened once. Ten tell you whether the model has a policy or a coin.',
  },
  {
    id: 'sequence-form',
    title: 'Sequences',
    target: '[data-tour="sequence-form"]',
    placement: 'top',
    blurb:
      'The coach builds a story for N turns, then delivers the probe inside it. Whittle finds the smallest N that works.',
    why: 'Context changes answers. The original research found refusals that disappear after a few turns of fiction. This measures where.',
  },
  {
    id: 'baselines',
    title: 'Baselines',
    target: '[data-tour="baselines"]',
    placement: 'top',
    blurb: 'Save the session now. Run the same probes after a model update and compare.',
    why: 'Providers change models quietly. A baseline is how you show that a rule moved.',
  },
];
