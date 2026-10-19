// Studies section copy (brief 8). The research-question readouts brief A.6
// names live in screens.ts; everything else a Studies screen says lives here
// (brief 5.7 rule 9) and is in COPY_FILES. T21 adds Framings (8.1); later
// Studies tasks add their own objects.

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The framing labels "Write by hand" offers, in order (brief 8.1). */
export const HAND_LABELS = [
  'Direct request',
  'Fiction framing',
  'Academic framing',
  'Roleplay',
  'Historical context',
  'Satire',
] as const;

/** The strategies "Write with the coach" starts with, all checked (`flinch/app.py` GenerateVariantsRequest). */
export const DEFAULT_STRATEGIES = [
  'Fiction Workshop',
  'Academic Analysis',
  'Historical Context',
  'Roleplay Scenario',
  'Satire/Parody',
] as const;

export const FRAMINGS = {
  title: 'Framings',

  // Tabs
  tabGroups: 'Groups',
  tabGroupsWhy: 'Every framing group, saved files first, and running one in this session.',
  tabResults: 'Results',
  tabResultsWhy: 'Whether each group got the same badge on every framing in this session.',

  // Groups tab (8.1)
  groupsEyebrow: 'Framing groups',
  groupsCount: (n: number) => `${n} ${plural(n, 'group', 'groups')}`,
  dbOnlyEyebrow: 'Groups without a file',
  emptyTitle: 'No framing groups yet',
  emptyBody: 'Make one below. Each group is saved as a Markdown file you can edit by hand.',
  probeCount: (n: number) => `${n} ${plural(n, 'probe', 'probes')}`,
  notSynced: 'Not loaded as probes yet',
  notSyncedWhy:
    'This file has no probes in the database yet. Save it again from the editor below to load it.',
  runGroup: 'Run in this session',
  runGroupWhy: 'Sends each framing once, with no pushback. Results arrive one by one.',
  runEvery: (n: number) => `Run every group (${n} ${plural(n, 'probe', 'probes')})`,
  runEveryWhy: 'Every probe across every framing group, each sent once, in one batch.',
  runningGroup: (id: string) => `Running framing group ${id}`,
  runningEvery: 'Running every framing group',
  batchBusy: 'A batch is already running in this session.',
  view: 'View',
  hide: 'Hide',
  viewLoading: 'Reading the file…',
  savedAs: (path: string) => `Saved as ${path}`,
  colLabel: 'Framing',
  colPrompt: 'Prompt',
  colProbe: 'Probe',
  deleteGroup: 'Delete this group',
  deleteConfirm: 'Delete it',
  deletedNotice: (id: string) => `Deleted framing group ${id}`,
  seeResults: 'See the results',

  // New framing group (8.1)
  newTitle: 'New framing group',
  newReadout:
    'Write one request several ways. Saving writes a Markdown file and loads each framing as a probe you can run.',
  tabCoach: 'Write with the coach',
  tabCoachWhy: 'The coach drafts one framing per strategy from a probe you pick; you edit them.',
  tabHand: 'Write by hand',
  tabHandWhy: 'Type each framing yourself.',
  baseProbe: 'Base probe',
  baseProbeWhy: 'The request every framing rewrites.',
  baseProbeNone: 'None',
  baseProbeHandWhy: 'Optional. Picking one fills the direct request with its text.',
  baseProbeEmpty: 'This session has no probes. Add one from the rail first.',
  groupId: 'Group id',
  groupIdPlaceholder: 'violence-framing',
  groupIdWhy: 'Lowercase letters, digits and hyphens. It names the file.',
  groupIdBad: 'Use only lowercase letters, digits and hyphens.',
  groupIdTaken: 'A group with this id exists. Saving replaces it.',
  domain: 'Domain',
  domainPlaceholder: 'e.g. violence',
  description: 'Description',
  descriptionPlaceholder: 'What this group tests, in a sentence.',
  strategies: 'Framings',
  strategiesWhy: 'The coach writes one variant for each checked framing.',
  addStrategy: 'Add a framing',
  addStrategyPlaceholder: 'Type a framing, then Enter',
  draft: 'Draft the variants',
  draftWhy:
    'Asks Claude to rewrite the base probe once per framing. Nothing is sent to the target.',
  draftNeedsKey: 'Needs an Anthropic key. Add one in Settings.',
  drafting: (n: number) => `Drafting ${n} ${plural(n, 'framing', 'framings')}…`,
  draftsTitle: (n: number) => `${n} ${plural(n, 'draft', 'drafts')} to check`,
  draftsReadout: 'Edit any framing before you save. The first row is the probe as written.',
  discard: 'Discard',
  directRequest: 'Direct request',
  label: 'Label',
  prompt: 'Prompt text',
  promptPlaceholder: 'The request, framed this way.',
  addVariant: 'Add a variant',
  removeVariant: (label: string) => `Remove ${label || 'this variant'}`,
  save: 'Save group',
  saving: 'Saving…',
  saveNeeds: 'Needs a group id and at least two framings with a label and prompt text.',
  saveNeedsUnique: 'Each framing needs its own label.',
  savedNotice: (id: string, n: number) =>
    `Saved framing group ${id} with ${n} ${plural(n, 'framing', 'framings')}`,

  // Results tab (8.1)
  resultsEyebrow: 'Consistency in this session',
  resultsTitle: 'Same badge on every framing?',
  resultsScore: (score: number) => `${score}%`,
  resultsReadout: (consistent: number, total: number) =>
    `${consistent} of ${total} ${plural(total, 'group', 'groups')} that ran got the same badge on every framing.`,
  resultsNone: 'No framing group has been run in this session yet.',
  resultsEmpty: 'There are no framing groups to compare. Make one on the Groups tab.',
  consistent: 'Consistent',
  inconsistent: 'Inconsistent',
  notRun: 'Not run',
  openRun: (label: string) => `Open the run for ${label}`,
  reload: 'Reload',
} as const;
