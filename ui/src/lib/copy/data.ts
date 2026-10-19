// Data section copy (brief 9). The research-question readouts brief A.6 names
// (`browse`, `browse.clearAll`) live in screens.ts; everything else a Data
// screen says lives here (brief 5.7 rule 9) and is in COPY_FILES. T29 adds
// Browse (9.1), its two detail routes and the Clear all dialog; later Data
// tasks add their own objects.

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "3 runs", "1 run". */
const count = (n: number, one: string, many: string) => `${n} ${plural(n, one, many)}`;

export const BROWSE = {
  title: 'Browse',

  // Overview
  overviewEyebrow: 'This install',
  overviewTitle: 'Overview',
  tileSessions: 'Sessions',
  tileRuns: 'Runs',
  tileComparisons: 'Comparisons',
  tileSequences: 'Sequences',
  tileSessionsWhy: 'Sessions you made. Model compare sessions are not counted.',
  tileRunsWhy: 'Every probe run, Model compare runs included.',
  firstResponses: 'First responses across every run',
  overviewLoading: 'Reading what this install has recorded…',
  exportAll: 'Export everything (JSON)',
  exportAllWhy: 'Every session, run, comparison and sequence in one JSON file.',
  clearAll: 'Delete all recorded data…',
  clearAllWhy: 'Opens a dialog that says what is deleted and what stays.',

  // Tabs
  tabAll: 'All',
  tabSessions: 'Sessions',
  tabComparisons: 'Comparisons',
  tabStudies: 'Studies',
  tabSequences: 'Sequences',
  tabCount: (label: string, n: number) => `${label} (${n})`,
  empty: 'Nothing recorded yet.',
  emptyBody: 'Run a probe, a comparison or a sequence and it shows up here.',
  listLoading: 'Reading the lists…',
  loadAgain: 'Load again',

  // Date groups
  groups: {
    today: 'Today',
    week: 'This week',
    month: 'This month',
    older: 'Older',
  },

  // Kind tags in the All tab
  kinds: {
    session: 'Session',
    comparison: 'Comparison',
    study: 'Study',
    sequence: 'Sequence',
  },

  // Rows
  runs: (n: number) => count(n, 'run', 'runs'),
  probes: (n: number) => count(n, 'probe', 'probes'),
  models: (n: number) => count(n, 'model', 'models'),
  agreementWord: 'agreement',
  warmup: (n: number) => `Warmup ${n}`,
  noRuns: 'No runs yet',
  tallyLabel: (name: string) => `First responses in ${name}`,
  open: 'Open',
  openWhy: 'Opens the full record.',
  downloadJson: 'Download JSON',
  downloadCsv: 'Download CSV',
  makeCurrent: 'Make current',
  makeCurrentWhy: 'Makes this the current session and opens Probe.',
  deleteSession: 'Delete this session',
  deleteSessionConfirm: 'Yes, delete it',
  deleteComparison: 'Delete this comparison',
  deleteComparisonConfirm: 'Yes, delete it',
  deleteSequence: 'Delete this sequence',
  deleteSequenceConfirm: 'Yes, delete it',
  sessionDeleted: 'Session deleted.',
  comparisonDeleted: 'Comparison deleted.',
  sequenceDeleted: 'Sequence deleted.',
  unknownProbe: (id: number) => `Probe ${id}`,
  unknownStrategy: (id: number) => `Strategy ${id}`,
  unknownSession: (id: number) => `Session ${id}`,
  inSession: (name: string) => `in ${name}`,
  studyOpenWhy: 'Opens the study in Studies, Conditions.',
  comparisonOpenWhy: 'Opens the comparison in Studies, Model compare.',

  // Download feedback
  saving: 'Saving…',
} as const;

export const SESSION_DETAIL = {
  back: 'Browse',
  eyebrow: 'Session',
  loading: 'Reading the session…',
  loadAgain: 'Load again',
  notFound: 'This session is not in the database. It may have been deleted.',
  created: (date: string) => `Created ${date}`,
  runs: (n: number) => count(n, 'run', 'runs'),
  outcomes: 'Outcomes',
  makeCurrent: 'Make current',
  makeCurrentWhy: 'Makes this the current session and opens Probe.',
  downloadJson: 'Download JSON',
  downloadCsv: 'Download CSV',
  remove: 'Delete this session',
  removeConfirm: 'Yes, delete the session',
  removed: 'Session deleted.',

  // Domains
  domainsTitle: 'By domain',
  domainColumn: 'Domain',
  runsColumn: 'Runs',
  noDomain: 'No domain',

  // Runs
  runsEyebrow: 'Runs',
  runsTitle: 'Every run in this session',
  runsReadout:
    'One row per run, oldest first. Open a row to read the probe, both responses and the pushback between them.',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  noRunsTitle: 'No runs in this session.',
  noRunsBody: 'Pick a probe in Probe and send it; the run is listed here.',
  probe: 'Probe',
  firstResponse: 'First response',
  pushback: 'Pushback',
  finalResponse: 'Final response',
  conversation: 'Whole conversation',
  conversationLoading: 'Reading the conversation…',
  noResponse: 'No response recorded.',
  sources: {
    coach: "Coach's draft",
    override: 'Your override',
    skip: 'Skipped',
  } as Record<string, string>,
  openInProbe: 'Open in Probe',
  openInProbeWhy: 'Makes this session current and opens the run in Probe.',
  runLabel: (n: number) => `Run ${n}`,
  /** Run turn roles (`flinch/runner.py` and the compare route). */
  roles: {
    probe: 'Probe',
    user: 'Probe',
    pushback: 'Pushback',
    response: 'Model',
    assistant: 'Model',
  } as Record<string, string>,

  // Findings (brief 9.9)
  findingsEyebrow: 'Notes',
  findingsTitle: 'Findings',
  findingsReadout: 'Key findings written on runs in this session, newest first.',
  findingsEmpty: 'No findings written in this session.',
  findingsLoading: 'Reading the findings…',
  openRun: 'Open the run',
} as const;

export const SEQUENCE_DETAIL = {
  back: 'Browse',
  eyebrow: 'Sequence',
  loading: 'Reading the sequence…',
  loadAgain: 'Load again',
  notFound: 'This sequence is not in the database. It may have been deleted.',
  title: (probe: string) => `Sequence on ${probe}`,
  strategy: 'Strategy',
  model: 'Model',
  status: 'Status',
  warmup: 'Warmup',
  warmupValue: (n: number) => count(n, 'turn', 'turns'),
  mode: 'Mode',
  session: 'Session',
  date: 'Created',
  modes: {
    interactive: 'Interactive',
    automatic: 'Automatic',
    whittle: 'Whittle',
    fixed_n: 'Fixed warmup',
  } as Record<string, string>,

  runsEyebrow: 'Runs',
  runsTitle: 'Every run of this sequence',
  runsReadout:
    'Each run sends a number of warmup turns, then the probe. Pick a run to read its thread.',
  runsEmpty: 'This sequence has no runs yet.',
  runRow: (warmups: number) => `${count(warmups, 'warmup turn', 'warmup turns')}`,
  threshold: 'Threshold',
  noProbeYet: 'Probe not sent',
  threadLabel: (n: number) => `Thread of run ${n}`,
  threadLoading: 'Reading the thread…',
  remove: 'Delete this sequence',
  removeConfirm: 'Yes, delete the sequence',
  removed: 'Sequence deleted.',
} as const;

export const CLEAR_ALL = {
  title: 'Delete all recorded data?',
  deletedHeading: 'Deleted',
  keptHeading: 'Kept',
  /** What clear-all deletes (B26), in the order of the dialog's sentence. */
  deleted: [
    'Sessions',
    'Runs',
    'Notes',
    'Coach examples',
    'Baselines',
    'Repeat runs',
    'Sequences',
    'Model comparisons',
    'Conditions studies',
    'Scorecards',
    'Publish documents',
  ],
  /** What it keeps (B26). */
  kept: [
    'Probes',
    'Framing groups',
    'Policy claims and their probe links',
    'Strategies',
    'Coach profiles',
  ],
  exportFirst: 'Export everything first',
  remove: 'Delete everything',
  removeConfirm: 'Yes, delete everything',
  cancel: 'Cancel',
  working: 'Deleting…',
  done: 'Deleted.',
  removedCounts: (sessions: number, runs: number) =>
    `${count(sessions, 'session', 'sessions')} and ${count(runs, 'run', 'runs')} removed.`,
} as const;
