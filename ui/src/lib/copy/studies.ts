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

/** The four kinds the HH-RLHF importer samples by, in its order (`flinch/hh_import.py`). */
export const HH_KIND_LABELS = {
  factual: 'Factual',
  advice: 'Advice',
  opinion: 'Opinion',
  ethical: 'Ethical',
} as const;

/** Provider names for the rate-limit rows (the keys the run's rate pool uses). */
export const RATE_PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  xai: 'xAI',
  together: 'Together',
  ollama: 'Ollama (local)',
};

export const CONDITIONS = {
  title: 'Conditions',

  // List (8.2.1)
  newStudy: 'New study',
  listEyebrow: 'Studies',
  listCount: (n: number) => `${n} ${plural(n, 'study', 'studies')}`,
  emptyTitle: 'No studies yet',
  emptyBody: 'Make one to run prompts under several system prompts at once.',
  open: 'Open',
  openStudy: (name: string) => `Open ${name}`,
  createdOn: (date: string) => `Created ${date}`,
  noCellsYet: 'Not started',

  // New study (8.2.2)
  newTitle: 'New conditions study',
  backToList: 'All studies',
  aboutTitle: 'About',
  name: 'Name',
  namePlaceholder: 'Persona prompt against no prompt',
  description: 'Description',
  descriptionPlaceholder: 'What you expect to find.',
  conditionsTitle: 'Conditions',
  conditionsReadout:
    'Each condition is a system prompt. Every prompt runs under each of them, so the answers line up side by side. Keep one with no system prompt as the control.',
  label: 'Label',
  systemPrompt: 'System prompt',
  systemPromptPlaceholder: 'Empty means no system prompt. This is the control.',
  controlLabel: 'Control',
  conditionN: (n: number) => `Condition ${n}`,
  addCondition: 'Add condition',
  removeCondition: (label: string) => `Remove ${label || 'this condition'}`,
  importFile: 'Import from a file…',
  importEmpty:
    'No conditions files in flinch/variants. A conditions file is a variants file with the line - type: conditions.',
  importLoading: 'Reading the files…',
  importedNotice: (id: string, n: number) =>
    `Loaded ${n} ${plural(n, 'condition', 'conditions')} from ${id}`,
  importRows: (n: number) => `${n} ${plural(n, 'condition', 'conditions')}`,

  promptsTitle: 'Prompts',
  promptsReadout:
    'Where the prompts come from. Flinch adds them in this order: HH-RLHF first, then the probes you pick, then the pasted CSV.',
  hhToggle: "Import from Anthropic's HH-RLHF dataset",
  hhTarget: 'How many prompts',
  hhTargetHint: '1 to 5,000.',
  hhSubsets: 'Subsets',
  hhSeed: 'Seed',
  hhSeedHint: 'The same seed picks the same prompts.',
  hhMix: 'Mix by kind (%)',
  hhMixHint: 'Percent of the sample for each kind. They must add up to 100.',
  hhMixSum: (n: number) => `These add up to ${n}. Make them add up to 100.`,
  hhMixReset: 'Use the default mix',
  hhNeedsEmpty: 'Only a study with no prompts yet can import from HH-RLHF.',
  hhTargetBad: 'Ask for 1 to 5,000 HH-RLHF prompts.',
  hhSubsetsBad: 'Tick at least one HH-RLHF subset.',
  hhSeedBad: 'The HH-RLHF seed is a whole number.',
  probesLabel: 'Probes',
  probesPicked: (n: number) => `${n} ${plural(n, 'probe', 'probes')} picked`,
  probesLoading: 'Loading probes…',
  csvToggle: 'Paste prompts as CSV',
  csvHint: 'Paste CSV with a header row. Columns: prompt_text (required), domain (optional).',
  csvRows: (n: number) => `${n} ${plural(n, 'prompt', 'prompts')} in the pasted text`,
  csvNoHeader: 'The first row needs a prompt_text column.',
  csvLabel: 'CSV text',

  modelsTitle: 'Models and repeats',
  modelN: (n: number) => `Model ${n}`,
  addModel: 'Add model',
  removeModel: (id: string) => `Remove ${id || 'this model'}`,
  repeats: 'Repeats per cell',
  repeatsHint: 'How many times each prompt runs under each condition for each model.',
  seed: 'Random seed',
  seedHint: 'Optional. Saved with the study so its design can be described exactly.',
  ratesTitle: 'Rate limits',
  ratesHint:
    'How fast Flinch calls each provider during the run. Leave both fields empty to keep the default.',
  ratesRpm: 'Calls a minute',
  ratesConcurrent: 'At once',
  ratesRpmFor: (provider: string) => `Calls a minute for ${provider}`,
  ratesConcurrentFor: (provider: string) => `Calls at once for ${provider}`,
  ratesDefault: (rpm: number, concurrent: number) =>
    `Default ${rpm} a minute, ${concurrent} at once`,
  ratesBad: 'Calls a minute is 1 to 10,000 and at once is 1 to 50, in whole numbers.',
  ratesNone: 'Pick a model to set the limits for its provider.',
  cellsLine: (p: number, c: number, m: number, r: number, total: number) =>
    `Cells: ${p} ${plural(p, 'prompt', 'prompts')} x ${c} ${plural(c, 'condition', 'conditions')} x ${m} ${plural(m, 'model', 'models')} x ${r} ${plural(r, 'repeat', 'repeats')} = ${total}`,
  cellsLarge: 'That is a large study. Each cell is one model call.',
  create: 'Create study',
  creating: 'Creating…',
  cancel: 'Cancel',

  needName: 'Give the study a name.',
  nameLong: 'Keep the name to 200 characters.',
  needCondition: 'Add at least one condition with a label.',
  labelLong: 'Keep each label to 100 characters.',
  uniqueLabels: 'Condition labels must be different.',
  needPrompt: 'Add at least one prompt: pick probes, paste CSV or import from HH-RLHF.',
  needModel: 'Add at least one model.',
  uniqueModels: 'Each model can be added once.',
  repeatsBad: 'Repeats are a whole number from 1 to 50.',
  seedBad: 'The random seed is a whole number.',

  importingHh: 'Importing HH-RLHF prompts…',
  hhImported: (n: number) => `Imported ${n} HH-RLHF ${plural(n, 'prompt', 'prompts')}`,
  addPromptsFailed: (msg: string) =>
    `The study was created, but adding prompts failed: ${msg}. Add them from the Setup panel.`,
  createdNotice: (name: string) => `Created ${name}`,

  // One study (8.2.3)
  tabRun: 'Run',
  tabRunWhy: 'Start, pause and resume the study, and watch its cells fill in.',
  tabResults: 'Results',
  tabResultsWhy: 'Badges per condition, text metrics and statistics.',
  tabRaters: 'Raters',
  tabRatersWhy: 'Blinded rankings from rater models and from people.',
  tabExport: 'Export',
  tabExportWhy: 'The responses and the study design as files.',
  tabLaterTitle: 'Not built yet',
  tabLaterBody: (tab: string) =>
    `The ${tab} tab arrives in the next update. The Run tab works now, and the study keeps its responses.`,
  deleteStudy: 'Delete this study',
  deleteConfirm: 'Delete it',
  deletedNotice: (name: string) => `Deleted ${name}`,
  loadFailed: 'This study could not be loaded.',

  progressTitle: 'Progress',
  progressReadout:
    'Every prompt under every condition, for each model and repeat. A cell is one model call, classified as it lands.',
  cellsDone: (completed: number, total: number) => `${completed} of ${total} cells`,
  failedCount: (n: number) => `${n} failed`,
  pendingCount: (n: number) => `${n} not run yet`,
  byCondition: 'By condition',
  byModel: 'By model',
  gridLabel: 'Cells by condition',
  gridLimit: 'Showing the first 1,000 cells. The counts above cover all of them.',
  gridEmpty: 'The cells appear when the study starts.',
  legendPending: 'Not run yet',
  legendFailed: 'Failed',
  cellTitle: (condition: string, prompt: string, model: string, repeat: number, state: string) =>
    `${condition} · ${prompt} · ${model} · repeat ${repeat} · ${state}`,

  setupTitle: 'Setup',
  setupConditions: 'Conditions',
  noSystemPrompt: 'No system prompt',
  setupModels: 'Models',
  setupPrompts: 'Prompts',
  promptsCount: (n: number) => `${n} ${plural(n, 'prompt', 'prompts')}`,
  setupRepeats: 'Repeats',
  setupSeed: 'Seed',
  setupRates: 'Rate limits',
  ratesPoolDefault: 'Provider defaults',
  rateOnlyConcurrent: (n: number) => `${n} at once`,
  rateFull: (rpm: number | null, concurrent: number | null) =>
    [rpm ? `${rpm} a minute` : null, concurrent ? `${concurrent} at once` : null]
      .filter(Boolean)
      .join(', '),
  none: 'None',
  setupCreated: 'Created',
  setupStarted: 'Started',
  setupCompleted: 'Completed',
  notYet: 'Not yet',
  addPrompts: 'Add prompts…',

  estimateLine: (cells: number, cost: number) =>
    `About ${cells} model ${plural(cells, 'call', 'calls')}, roughly $${cost.toFixed(2)}.`,
  estimateBreakdown: (p: number, c: number, m: number, r: number) =>
    `${p} ${plural(p, 'prompt', 'prompts')} x ${c} ${plural(c, 'condition', 'conditions')} x ${m} ${plural(m, 'model', 'models')} x ${r} ${plural(r, 'repeat', 'repeats')}`,
  estimateHint: 'The estimate uses average token counts. Real costs vary.',

  start: 'Start',
  pause: 'Pause',
  pausing: 'Pausing…',
  resume: 'Resume',
  runPending: 'Run pending cells',
  retryFailed: (n: number) => `Retry ${n} failed ${plural(n, 'cell', 'cells')}`,
  retryFailedWhy: 'Sets the failed cells back to not run, then resumes.',
  allDone: 'All cells done.',
  orphanRunning: 'This study is marked running, but nothing in this window is running it.',
  activeElsewhere: 'Another window is running this study. Resume here waits for it to stop first.',
  needPrompts: 'Add prompts before you start.',
  streamLabel: (name: string) => `Running study ${name}`,
  runLabel: 'This run',
  pausedNotice: (completed: number, total: number) =>
    `Paused with ${completed} of ${total} cells done`,
  finishedNotice: (name: string) => `Finished ${name}`,

  // Add prompts dialog (8.2.3)
  sourcesTitle: 'Add prompts',
  sourcesLead:
    'More prompts for this study. Flinch adds them in order: HH-RLHF, picked probes, pasted CSV.',
  sourcesAdd: 'Add prompts',
  sourcesAdding: 'Adding…',
  sourcesNeed: 'Pick probes, paste CSV or import from HH-RLHF.',
} as const;
