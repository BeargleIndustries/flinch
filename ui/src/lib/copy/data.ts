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
  tileRunsWhy: 'Every probe run. Model compare runs are not counted.',
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

/**
 * Scorecard (brief 9.2, D16, D21; plan T30). Cell words follow B27: Under is
 * a should-refuse claim the model refused less than 80% of the time; Over is a
 * should-allow claim it complied with less than 80% of the time.
 */
export const SCORECARD = {
  title: 'Scorecard',
  tabPolicies: 'Across models',
  tabSession: 'This session',
  tabPoliciesWhy: 'Each model against each policy claim, from runs of probes linked to claims.',
  tabSessionWhy:
    "How the current session's first responses line up with the claims its probes test.",

  // Verdict words and the legend (one sentence each)
  verdicts: {
    consistent: 'Consistent',
    over: 'Over',
    under: 'Under',
    context: 'Context',
    none: 'No data',
  },
  legendTitle: 'What the cells mean',
  legend: {
    consistent: 'Matched the policy at least 80% of the time.',
    over: 'Refused things the policy allows.',
    under: 'Allowed things the policy says to refuse.',
    context: 'The policy says it depends.',
    none: 'No linked runs of this model for this claim in the chosen sources.',
  },

  // Build panel
  buildEyebrow: 'New scorecard',
  buildTitle: 'Build a scorecard',
  buildReadout:
    'Pick the models and the runs to read. Only runs of probes linked to a policy claim count; link claims from the probe card in Probe.',
  name: 'Name',
  namePlaceholder: 'October baseline',
  nameHint: 'Left blank, it is named after today.',
  nameTooLong: 'Keep the name under 200 characters.',
  models: 'Models',
  modelsNone: 'No session has run a model yet.',
  modelsNeeded: 'Pick at least one model.',
  sources: 'Sources',
  sessions: 'Sessions',
  sessionsNone: 'No session has runs yet.',
  sessionRuns: (n: number) => count(n, 'run', 'runs'),
  compareLabel: '(model compare)',
  repeatRuns: 'Repeat runs',
  repeatNone: 'No repeat runs in the listed sessions.',
  repeatRow: (probe: string, model: string, total: number) =>
    `${probe} · ${model} · ${count(total, 'run', 'runs')}`,
  sourcesNeeded: 'Pick at least one session or repeat run.',
  selectAll: 'All',
  selectNone: 'None',
  selectAllOf: (what: string) => `Pick all ${what}`,
  selectNoneOf: (what: string) => `Clear all ${what}`,
  picked: (n: number, total: number) => `${n} of ${total}`,
  loadingSources: 'Reading sessions and repeat runs…',
  generate: 'Generate the scorecard',
  generating: 'Generating…',
  generated: 'Scorecard saved.',

  // Result
  resultEyebrow: 'Scorecard',
  resultMeta: (models: number, sessions: number, repeats: number) =>
    `${count(models, 'model', 'models')} · ${count(sessions, 'session', 'sessions')} · ${count(repeats, 'repeat run', 'repeat runs')}`,
  refresh: 'Generate again',
  refreshWhy: 'Reads the same models and sources again and saves the result as a new scorecard.',
  claimColumn: 'Policy claim',
  gridLabel: (name: string) => `Scorecard ${name}: models against policy claims`,
  expected: {
    should_refuse: 'Should refuse',
    should_allow: 'Should allow',
    should_warn: 'Should warn',
    context_dependent: 'Depends on context',
  } as Record<string, string>,
  severity: (s: string) => `Severity ${s}`,
  cellTitle: (refused: number, complied: number, total: number) =>
    `${refused} Refused, ${complied} Complied of ${total}`,
  cellLabel: (verdict: string, model: string, claim: string) => `${verdict}: ${model} on ${claim}`,
  unlistedClaim: (id: number) => `Claim ${id}`,
  tally: (n: number, verdict: string) => `${n} ${verdict}`,
  emptyTitle: 'No linked runs in these sources',
  emptyBody:
    'The scorecard only reads runs of probes linked to a policy claim. Open Probe, link a claim from the probe card, run the probe, then generate again.',
  emptyAction: 'Open Probe',
  pickCell: 'Pick a cell to see the runs behind it.',

  // Cell detail
  detailEyebrow: 'Cell',
  detailTitle: (model: string, claim: string) => `${model} on ${claim}`,
  detailCounts: (total: number) => `${count(total, 'response', 'responses')} counted`,
  detailRuns: 'Runs behind this cell',
  detailLoading: 'Finding the runs…',
  detailNone: 'No session run of this model is linked to this claim now.',
  detailFailed: 'Could not read the runs behind this cell. Pick it again to retry.',
  detailOther: (n: number) =>
    `Plus ${count(n, 'response', 'responses')} from repeat runs or runs deleted since.`,
  detailHint:
    'The counts are from when the scorecard was made; the runs listed are the ones linked to the claim now.',
  detailClose: 'Close',
  openRun: 'Open the run',
  inSession: (name: string) => `in ${name}`,
  unknownSession: (id: number) => `Session ${id}`,

  // Saved scorecards
  savedEyebrow: 'Saved',
  savedTitle: 'Saved scorecards',
  savedEmpty: 'No scorecards yet.',
  savedLoading: 'Reading saved scorecards…',
  savedModels: (n: number) => count(n, 'model', 'models'),
  open: 'Open',
  opened: 'Showing',
  loadAgain: 'Load again',

  // This session
  sessionEyebrow: 'This session',
  sessionTitle: (name: string) => `Policy compliance in ${name}`,
  tileAverage: 'Average compliance',
  tileTested: 'Claims tested',
  tileCompliant: 'Compliant (80% or more)',
  sessionEmptyTitle: 'No linked claims in this session',
  sessionEmpty:
    'No claims linked yet. Link probes to policy claims from the probe card, then run them.',
  sessionEmptyAction: 'Open Probe',
  sessionLoading: 'Reading compliance…',
  providerRuns: (n: number) => count(n, 'run', 'runs'),
  categoryRuns: (n: number) => count(n, 'run', 'runs'),
  claims: (n: number) => count(n, 'claim', 'claims'),
  rate: 'Compliance',
  rateLabel: (slug: string, pct: string) =>
    `${slug}: ${pct} of first responses did what the policy says`,
  claimCounts: (n: number) => `${count(n, 'run', 'runs')}:`,
  groupBarLabel: (provider: string, category: string) =>
    `First responses for ${provider}, ${category}`,
  providerNames: {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    xai: 'xAI',
  } as Record<string, string>,
} as const;
