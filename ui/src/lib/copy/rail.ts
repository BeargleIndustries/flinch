// Probe rail and session dialog copy (brief 6.2, 6.5 to 6.8). Brief A.6 has
// no keys for these screens, so they live here (brief 5.7 rule 9) and in
// COPY_FILES. The rail, the three dialogs and rail.spec.ts read them.

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const RAIL = {
  // Header row (6.2 item 1)
  count: (visible: number, total: number) => `${visible} / ${total}`,
  select: 'Select',
  selectDone: 'Done',

  // Search and filter (6.2 items 2, 3)
  search: 'Search probes',
  allDomains: 'All domains',
  domainLabel: 'Filter by domain',

  // Actions (6.2 item 4)
  addProbe: 'Add probe',
  loadDefaults: 'Load defaults',
  loadingDefaults: 'Loading default probes…',
  loaded: (n: number) => `Loaded ${n} ${plural(n, 'probe', 'probes')}`,
  importFile: 'Import a file',

  // Custom prompt row (6.2 item 5)
  custom: 'Custom prompt',
  customHint: 'Type your own text',

  // List (6.2 item 6)
  listLabel: 'Probes in this session',
  framingChip: (label: string) => `⊕ ${label}`,
  framingTitle: (groupId: string) => `Framing group: ${groupId}`,
  ifChip: 'IF',
  ifTitle: 'Has a narrative opening and target for Sequences',
  runsTitle: (n: number) => `${n} ${plural(n, 'run', 'runs')} in this session`,
  deleteProbe: 'Delete this probe',
  deleteArmed: 'Delete?',
  loading: 'Loading probes…',
  empty: 'No probes in this session yet. Add one, load the defaults, or import a file.',
  noMatch: 'No probe matches that search.',

  // Select mode (6.2 item 7)
  selectProbe: (name: string) => `Select ${name}`,
  selectAll: 'Select all',
  clearSelection: 'Clear selection',
  cancel: 'Cancel',
  bulkDelete: (n: number) => `Delete ${n} ${plural(n, 'probe', 'probes')}`,
  bulkDeleteConfirm: (n: number) => `Yes, delete ${n}`,
  bulkResult: (deleted: number, kept: number) =>
    kept > 0 ? `Deleted ${deleted}. Kept ${kept} that have runs.` : `Deleted ${deleted}.`,

  // Footer (6.2 footer)
  runs: (n: number) => `Runs: ${n}`,
  statsLabel: 'Session stats',
  historyLabel: 'Run history',
  noRuns: 'No runs yet',
  openRun: (name: string) => `Open the run of ${name}`,
  deleteRun: 'Delete this run',
  runDeleted: 'Run deleted.',
} as const;

export const NEW_SESSION = {
  title: 'New session',
  lead: 'A session holds every run against one model with one system prompt.',
  name: 'Name',
  namePlaceholder: 'Sonnet baseline, no system prompt',
  targetModel: 'Target model',
  systemPrompt: 'System prompt',
  optional: 'optional',
  systemPromptPlaceholder: 'Leave empty to test the model with no system prompt.',
  coach: (backend: string) => `Coach: ${backend}`,
  backend: 'Backend',
  localModel: 'Model',
  localHint: 'Local coaches are slower and weaker. A 7B model or larger works best.',
  noLocalModels: 'Ollama is not running or has no models. Start it, or pick another backend.',
  chooseLocalModel: 'Choose a model',
  profile: 'Profile',
  newProfile: 'New profile name…',
  newProfileLabel: 'New profile name',
  newProfilePlaceholder: 'careful-coach',
  probes: 'Probes',
  allProbes: 'All probes',
  someProbes: (n: number, total: number) => `${n} of ${total} selected`,
  notes: 'Notes',
  notesPlaceholder: 'What this session is for.',
  create: 'Create session',
  creating: 'Creating…',
  cancel: 'Cancel',
  loading: 'Loading models and probes…',
  problems: {
    name: 'Give the session a name.',
    model: 'Pick a target model.',
    profile: 'Name the new coach profile.',
    localModel: 'Pick a local model for the coach.',
    probes: 'Pick at least one probe.',
  },
} as const;

export const ADD_PROBE = {
  title: 'Add probe',
  lead: 'A probe is one request you send to the model, then push back on if it refuses.',
  name: 'Name',
  domain: 'Domain',
  promptText: 'Prompt text',
  tags: 'Tags',
  tagsHint: 'Comma separated',
  narrative: 'This probe has a narrative opening and target (for Sequences)',
  narrativeOpening: 'Narrative opening',
  narrativeOpeningHint:
    'Characters, setting and opening scene in interactive-fiction form. Dialogue in quotes, directions in ((double parentheses)).',
  narrativeTarget: 'Narrative target',
  narrativeTargetHint:
    'The final direction after the warmup turns. A stage direction only, with the same characters.',
  save: 'Save probe',
  saving: 'Saving…',
  cancel: 'Cancel',
  duplicate: 'A probe with that name exists. Choose another name.',
  problems: {
    required: 'Fill in the name, domain and prompt text.',
    narrative: 'Fill in the narrative opening and target, or untick the box.',
  },
} as const;

export const IMPORT_PROBES = {
  title: 'Import probes from a file',
  lead: "Files in the sidecar's probes folder, Markdown or YAML.",
  import: 'Import',
  importing: 'Importing…',
  importFile: (name: string) => `Import ${name}`,
  loaded: (n: number) => `Loaded ${n} ${plural(n, 'probe', 'probes')}`,
  empty: 'No probe files found in flinch/probes.',
  loading: 'Looking for probe files…',
  close: 'Close',
} as const;
