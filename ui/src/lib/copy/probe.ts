// Probe workspace copy (brief 7.1 to 7.10). The readouts, teach hints and
// pushback status lines brief A.6 names live in screens.ts; everything else
// the workspace says lives here (brief 5.7 rule 9) and is in COPY_FILES.
//
// Principle 1: every phase opens with the question it answers (`QUESTION`),
// and every control carries a one-line reason (`*Why` lines).

import type { Phase } from '$lib/probe-machine';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The research question each phase opens with (`idle` is SCREENS['probe.idle']). */
export const QUESTION: Record<Exclude<Phase, 'idle'>, string> = {
  selected: 'Does the model refuse this probe? Send it and Flinch classifies the answer.',
  custom: 'Does the model refuse text you write yourself? Flinch saves what you send as a probe.',
  sending: 'Does the model refuse this probe? The answer is on its way.',
  response: 'Does the model refuse this probe? The answer is on its way.',
  pushback: 'Does the refusal hold when you push back?',
  done: 'What did this exchange show? Teach the coach, note what you saw, then move on.',
};

export const PROBE = {
  title: 'Probe',

  // Idle (7.1)
  systemPrompt: 'System prompt',
  systemPromptWhy: 'Every probe in this session is sent under this system prompt.',
  showAll: 'Show all',
  showLess: 'Show less',
  runAllTitle: 'Run every probe',
  runAllDelay: 'Pause between probes (ms)',
  runAll: (n: number) => `Run all ${n} ${plural(n, 'probe', 'probes')}`,
  baselineTitle: 'Save a baseline',
  baselineOpen: 'Open Baselines',
  runAllWhy: 'Results arrive one by one. No pushback is sent.',

  // Probe card (7.2, 7.3)
  cardEyebrow: 'Probe',
  customEyebrow: 'Custom prompt',
  customTitle: 'Your own text',
  customLabel: 'Text to send',
  customPlaceholder: 'Type the text to send',
  narrativeOpening: 'Narrative opening',
  narrativeTarget: 'Narrative target',
  send: 'Send probe',
  sendCustom: 'Send custom prompt',
  sendWhy: (model: string) =>
    `Sends the prompt as written to ${model} in a fresh conversation, then classifies the answer.`,
  sendHint: 'S to send',
  customEmpty: 'Type something to send first.',

  // Sending (7.4)
  waiting: (model: string) => `Waiting for ${model}…`,
  waitingWhy: 'The answer is classified as soon as it arrives. Nothing else is sent.',

  // Thread (7.5)
  threadLabel: 'Conversation',
  response: 'Response',
  responseAfter: 'Response after pushback',
  yourPushback: 'Your pushback',
  overrideTag: 'Your words',
  coachTag: "Coach's draft",
  badgeWhy: 'Click the badge to correct the classifier.',
  showMore: 'Show more',
  showLessText: 'Show less',
  emptyResponse: 'The model sent an empty answer.',

  // Pushback panel (7.6)
  coachEyebrow: 'Coach',
  pushTitle: 'Push back',
  pattern: (p: string) => `Pattern: ${p}`,
  move: (name: string, description: string) => `Move: ${name}. ${description}`,
  pushbackLabel: 'Pushback text',
  sendPushback: 'Send pushback',
  sendPushbackWhy: 'Sends this text in the same conversation and classifies the reply.',
  skip: 'Skip',
  skipWhy: 'Records that you chose not to push back on this answer.',
  pushHint: 'P to send, K to skip',
  sendingPushback: 'Sending…',

  // Done (7.7)
  keepEyebrow: 'Follow up',
  keepTitle: 'Keep pushing',
  keepWhy: 'Each follow-up continues the same conversation and is recorded as your own words.',
  keepLabel: 'Another pushback',
  keepPlaceholder: 'Write the next pushback',
  keepSend: 'Send another pushback',
  next: 'Next probe',
  nextWhy: 'Moves to the next probe in the rail.',
  runAgain: 'Run again',
  runAgainWhy: 'Sends the same probe again in a fresh conversation.',
  doneHint: 'N for next, R to run again',
  teach: 'Teach the coach this exchange',
  taught: 'Taught',
  teaching: 'Teaching…',

  // Notes (7.7 item 3)
  notesEyebrow: 'Notes',
  notesTitle: 'What you saw',
  notesWhy: 'Notes, tags and findings go into exports and the Publish tables.',
  notesLabel: 'Research notes',
  tagsLabel: 'Add a pattern tag',
  tagsHint: 'Enter or comma adds a tag.',
  removeTag: (tag: string) => `Remove the tag ${tag}`,
  findingLabel: 'Key finding',
  findingPlaceholder: 'What does this result show?',
  saved: 'Saved',

  // Policy links (7.2)
  policyEyebrow: 'Policy claims',
  policyLabel: 'Linked policy claims',
  claimChip: (provider: string, claimId: string) => `${provider} · ${claimId}`,
  unlink: 'Unlink this claim',
  linkClaim: 'Link a claim…',

  // Saved run (7.9)
  runMissing: 'That run no longer exists.',
  runMissingBody: 'It may have been deleted from the run history or from Browse.',
  runFailed: 'That run could not be loaded.',
  runFailedBody: 'The status bar at the bottom says why. Try again from the run history.',
  backToProbe: 'Back to Probe',
  savedEyebrow: (id: number) => `Saved run ${id}`,
  loadingRun: 'Loading the run…',
} as const;

/** Link policy claims dialog (7.2). */
export const LINK_CLAIMS = {
  title: 'Link policy claims',
  lead: 'Pick the published claims this probe tests. Scorecard compares the badges against them.',
  search: 'Search claims',
  loading: 'Loading claims…',
  none: 'No policy claims are loaded.',
  noMatch: 'No claim matches that search.',
  linked: 'Linked',
  submit: (n: number) => `Link ${n} ${plural(n, 'claim', 'claims')}`,
  cancel: 'Cancel',
} as const;
