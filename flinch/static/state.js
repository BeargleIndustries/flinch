// ─── State ────────────────────────────────────────────────────────────────────

export const PHASES = {
  IDLE: 'idle',
  PROBE_SELECTED: 'probe_selected',
  AWAITING: 'awaiting',
  RESPONSE: 'response',
  PUSHBACK_DECISION: 'pushback_decision',
  PUSHBACK_SENT: 'pushback_sent',
  SEQUENCE_WARMUP: 'sequence_warmup',
  SEQUENCE_SETUP: 'sequence_setup',
  SEQUENCE_PROBE: 'sequence_probe',
  SEQUENCE_COMPLETE: 'sequence_complete',
};

// Valid phase transitions
const VALID_TRANSITIONS = {
  idle:               ['probe_selected', 'sequence_warmup'],
  probe_selected:     ['awaiting', 'idle'],
  awaiting:           ['response', 'pushback_decision', 'probe_selected', 'pushback_sent'],
  response:           ['idle', 'probe_selected', 'pushback_decision'],
  pushback_decision:  ['awaiting', 'pushback_sent', 'response'],
  pushback_sent:      ['idle', 'probe_selected', 'awaiting', 'pushback_decision'],
  sequence_warmup:    ['sequence_setup', 'sequence_probe', 'sequence_complete', 'idle'],
  sequence_setup:     ['sequence_probe', 'sequence_complete', 'idle'],
  sequence_probe:     ['sequence_complete', 'idle'],
  sequence_complete:  ['idle', 'sequence_warmup'],
};

export function canTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) {
    console.warn(`canTransition: unknown phase "${from}"`);
    return false;
  }
  if (!allowed.includes(to)) {
    console.warn(`Invalid phase transition: ${from} → ${to}`);
    return false;
  }
  return true;
}

export function setPhase(newPhase) {
  if (!canTransition(state.phase, newPhase)) {
    return false;
  }
  state.phase = newPhase;
  return true;
}

export const state = {
  currentSession: null,   // full session object
  sessions: [],
  probes: [],
  currentProbe: null,
  currentRun: null,
  currentTurns: [],       // conversation turns for current run
  phase: 'idle',          // idle | probe_selected | awaiting | response | pushback_decision | pushback_sent
  isLoading: false,       // guard against double-execution of async actions
  stats: null,
  pushbackText: '',       // editable coach suggestion text
  probeSearch: '',        // search text for probe list filter
  probeDomainFilter: '',  // domain filter value (empty = all)
  batchRunning: false,
  batchComplete: false,
  batchProgress: null,    // { completed, total, failed, results: [] }
  currentAnnotation: null,  // annotation for current run
  allPatternTags: [],       // all known tags for autocomplete
  policyClaims: {},
  policyFilter: '',
  policyView: false,
  complianceData: null,
  compareMode: false,
  compareData: null,
  compareSessionIds: [],
  compareModels: [],
  compareProbeIds: [],
  variantGroups: [],
  consistencyData: null,
  consistencyView: false,
  variantTab: 'edit',           // 'edit' | 'results'
  variantFiles: [],             // parsed variant group files
  variantEditData: null,        // currently viewing/editing variant group
  variantGenerating: false,     // AI generation in progress
  variantCreateMode: 'ai',     // 'ai' | 'manual'
  snapshots: [],
  currentSnapshot: null,
  snapshotDiff: null,
  snapshotView: false,
  settingsView: false,
  apiKeys: [],
  // Narrative Momentum
  sequences: [],
  currentSequence: null,
  currentSequenceRun: null,
  sequenceTurns: [],
  strategies: [],
  sequenceView: false,
  whittlingData: null,
  turnHeatmapData: null,
  crossProbeData: null,
  sequenceBatchRunning: false,
  sequenceBatchProgress: null,
  _modelProviders: [],          // cached /api/models response for compare view
  comparisons: [],              // saved comparison history
  // v0.4 features
  statRunView: false,
  statRunConfig: null,       // {probeIds, repeatCount}
  statRunResults: null,      // results from stat runs
  scorecardData: null,       // scorecard results
  publicationExport: null,   // export preview data
  // Dashboard
  dashboardView: false,
  dashboardSection: 'overview',  // 'overview' | 'scorecard' | 'publication'
  dashboardStats: null,
  dashboardSessions: [],
  dashboardComparisons: [],
  dashboardSequences: [],
  dashboardTab: 'all',  // 'all' | 'sessions' | 'comparisons' | 'sequences'
  dashboardDetail: null,      // {type: 'session'|'comparison'|'sequence', id: number} or null
  dashboardDetailData: null,  // loaded detail data for inline view
};
