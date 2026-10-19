// Every sidecar route the app calls (brief 10.5, plan I3). `ROUTES` is the
// contract: `endpoints.paths.json` is generated from it (`npm run
// endpoints:snapshot`), `endpoints.test.ts` asserts the two are equal, and
// `tests/test_api_contract.py` asserts each `{method, path}` exists on the
// sidecar. A route change updates all three in one commit.
//
// Screens call `request(ROUTES.name, {params, query, body})` (client.ts) or
// `openStream(ROUTES.name, ...)` (streams.ts) for the routes marked `stream`.
// This file imports nothing, so the snapshot script can load it on its own.

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteDef {
  method: Method;
  /** Path parameters are written `{name}`, as in the sidecar's OpenAPI paths. */
  path: string;
  /** Answers with Server-Sent Events (plan I2); call it through `openStream`. */
  stream?: true;
}

export const ROUTES = {
  listAnnotationTags: { method: 'GET', path: '/api/annotations/tags' },
  cancelBatch: { method: 'POST', path: '/api/batch/{batch_id}/cancel' },
  listCoachExamples: { method: 'GET', path: '/api/coach-examples' },
  deleteCoachExample: { method: 'DELETE', path: '/api/coach-examples/{example_id}' },
  updateCoachExample: { method: 'PATCH', path: '/api/coach-examples/{example_id}' },
  listCoachProfiles: { method: 'GET', path: '/api/coach-profiles' },
  compareSessions: { method: 'GET', path: '/api/compare' },
  runCompare: { method: 'POST', path: '/api/compare/run' },
  listComparisons: { method: 'GET', path: '/api/comparisons' },
  deleteComparison: { method: 'DELETE', path: '/api/comparisons/{comparison_id}' },
  getComparison: { method: 'GET', path: '/api/comparisons/{comparison_id}' },
  exportComparison: { method: 'GET', path: '/api/comparisons/{comparison_id}/export' },
  clearAllData: { method: 'DELETE', path: '/api/dashboard/clear-all' },
  dashboardComparisons: { method: 'GET', path: '/api/dashboard/comparisons' },
  exportAllData: { method: 'GET', path: '/api/dashboard/export-all' },
  dashboardSequences: { method: 'GET', path: '/api/dashboard/sequences' },
  dashboardSessions: { method: 'GET', path: '/api/dashboard/sessions' },
  dashboardStats: { method: 'GET', path: '/api/dashboard/stats' },
  listExperiments: { method: 'GET', path: '/api/experiments' },
  createExperiment: { method: 'POST', path: '/api/experiments' },
  deleteExperiment: { method: 'DELETE', path: '/api/experiments/{experiment_id}' },
  getExperiment: { method: 'GET', path: '/api/experiments/{experiment_id}' },
  updateExperiment: { method: 'PUT', path: '/api/experiments/{experiment_id}' },
  getExperimentAnalysis: { method: 'GET', path: '/api/experiments/{experiment_id}/analysis' },
  exportExperimentAnalysis: {
    method: 'GET',
    path: '/api/experiments/{experiment_id}/analysis/export',
  },
  analyzeExperiment: { method: 'POST', path: '/api/experiments/{experiment_id}/analyze' },
  classifyExperiment: { method: 'POST', path: '/api/experiments/{experiment_id}/classify' },
  getConditionComparison: {
    method: 'GET',
    path: '/api/experiments/{experiment_id}/condition-comparison',
  },
  exportConditions: { method: 'GET', path: '/api/experiments/{experiment_id}/condition-export' },
  listConditions: { method: 'GET', path: '/api/experiments/{experiment_id}/conditions' },
  addCondition: { method: 'POST', path: '/api/experiments/{experiment_id}/conditions' },
  estimateExperiment: { method: 'POST', path: '/api/experiments/{experiment_id}/estimate' },
  exportExperiment: { method: 'GET', path: '/api/experiments/{experiment_id}/export' },
  listHumanEvals: { method: 'GET', path: '/api/experiments/{experiment_id}/human-evals' },
  importHumanEvals: { method: 'POST', path: '/api/experiments/{experiment_id}/human-evals/import' },
  getExperimentMetrics: { method: 'GET', path: '/api/experiments/{experiment_id}/metrics' },
  computeExperimentMetrics: {
    method: 'POST',
    path: '/api/experiments/{experiment_id}/metrics',
    stream: true,
  },
  pauseExperiment: { method: 'POST', path: '/api/experiments/{experiment_id}/pause' },
  getPreregistration: { method: 'GET', path: '/api/experiments/{experiment_id}/preregistration' },
  getExperimentProgress: { method: 'GET', path: '/api/experiments/{experiment_id}/progress' },
  createProlificExport: { method: 'POST', path: '/api/experiments/{experiment_id}/prolific' },
  downloadProlificCsv: { method: 'GET', path: '/api/experiments/{experiment_id}/prolific/csv' },
  listExperimentPrompts: { method: 'GET', path: '/api/experiments/{experiment_id}/prompts' },
  addExperimentPrompts: { method: 'POST', path: '/api/experiments/{experiment_id}/prompts' },
  importExperimentPrompts: {
    method: 'POST',
    path: '/api/experiments/{experiment_id}/prompts/import',
  },
  importHhPrompts: {
    method: 'POST',
    path: '/api/experiments/{experiment_id}/prompts/import-hh',
    stream: true,
  },
  rateExperiment: { method: 'POST', path: '/api/experiments/{experiment_id}/rate', stream: true },
  listExperimentRatings: { method: 'GET', path: '/api/experiments/{experiment_id}/ratings' },
  generateExperimentReport: { method: 'POST', path: '/api/experiments/{experiment_id}/report' },
  listExperimentResponses: { method: 'GET', path: '/api/experiments/{experiment_id}/responses' },
  resumeExperiment: {
    method: 'POST',
    path: '/api/experiments/{experiment_id}/resume',
    stream: true,
  },
  startExperiment: { method: 'POST', path: '/api/experiments/{experiment_id}/start', stream: true },
  exportCompare: { method: 'GET', path: '/api/export/compare' },
  listModels: { method: 'GET', path: '/api/models' },
  getOllamaStatus: { method: 'GET', path: '/api/ollama/status' },
  listPolicies: { method: 'GET', path: '/api/policies' },
  getPolicy: { method: 'GET', path: '/api/policies/{provider}' },
  listProbeGroups: { method: 'GET', path: '/api/probe-groups' },
  deleteProbeGroup: { method: 'DELETE', path: '/api/probe-groups/{group_id}' },
  getProbeGroup: { method: 'GET', path: '/api/probe-groups/{group_id}' },
  listProbes: { method: 'GET', path: '/api/probes' },
  createProbe: { method: 'POST', path: '/api/probes' },
  bulkDeleteProbes: { method: 'POST', path: '/api/probes/bulk-delete' },
  listProbeFiles: { method: 'GET', path: '/api/probes/files' },
  importProbeFile: { method: 'POST', path: '/api/probes/import-file' },
  loadDefaultProbes: { method: 'POST', path: '/api/probes/load-defaults' },
  deleteProbe: { method: 'DELETE', path: '/api/probes/{probe_id}' },
  listProbeClaims: { method: 'GET', path: '/api/probes/{probe_id}/claims' },
  linkProbeClaims: { method: 'POST', path: '/api/probes/{probe_id}/claims' },
  unlinkProbeClaim: { method: 'DELETE', path: '/api/probes/{probe_id}/claims/{claim_id}' },
  createPublicationExport: { method: 'POST', path: '/api/publication/export' },
  listPublicationExports: { method: 'GET', path: '/api/publication/exports' },
  getPublicationExport: { method: 'GET', path: '/api/publication/exports/{export_id}' },
  downloadPublicationExport: {
    method: 'GET',
    path: '/api/publication/exports/{export_id}/download',
  },
  deleteRun: { method: 'DELETE', path: '/api/runs/{run_id}' },
  getRun: { method: 'GET', path: '/api/runs/{run_id}' },
  getAnnotation: { method: 'GET', path: '/api/runs/{run_id}/annotations' },
  saveAnnotation: { method: 'PUT', path: '/api/runs/{run_id}/annotations' },
  updateClassification: { method: 'PATCH', path: '/api/runs/{run_id}/classification' },
  continuePushback: { method: 'POST', path: '/api/runs/{run_id}/continue' },
  promoteRun: { method: 'POST', path: '/api/runs/{run_id}/promote' },
  sendPushback: { method: 'POST', path: '/api/runs/{run_id}/pushback' },
  skipPushback: { method: 'POST', path: '/api/runs/{run_id}/skip' },
  listRunTurns: { method: 'GET', path: '/api/runs/{run_id}/turns' },
  generateScorecard: { method: 'POST', path: '/api/scorecard/generate' },
  getScorecard: { method: 'GET', path: '/api/scorecard/{snapshot_id}' },
  listScorecards: { method: 'GET', path: '/api/scorecards' },
  getSequenceBatch: { method: 'GET', path: '/api/sequence-batches/{batch_id}' },
  estimateSequenceBatch: { method: 'POST', path: '/api/sequence-batches/{batch_id}/estimate' },
  startSequenceBatch: {
    method: 'POST',
    path: '/api/sequence-batches/{batch_id}/start',
    stream: true,
  },
  listSequenceRunTurns: { method: 'GET', path: '/api/sequence-runs/{run_id}/turns' },
  deleteSequence: { method: 'DELETE', path: '/api/sequences/{sequence_id}' },
  getSequence: { method: 'GET', path: '/api/sequences/{sequence_id}' },
  dropSequenceProbe: { method: 'POST', path: '/api/sequences/{sequence_id}/drop-probe' },
  exportSequence: { method: 'GET', path: '/api/sequences/{sequence_id}/export' },
  runSequenceAuto: { method: 'POST', path: '/api/sequences/{sequence_id}/run-auto', stream: true },
  runSequenceTurn: { method: 'POST', path: '/api/sequences/{sequence_id}/run-turn' },
  getTurnClassifications: {
    method: 'GET',
    path: '/api/sequences/{sequence_id}/turn-classifications',
  },
  whittleSequence: { method: 'POST', path: '/api/sequences/{sequence_id}/whittle' },
  getWhittling: { method: 'GET', path: '/api/sequences/{sequence_id}/whittling' },
  listSessions: { method: 'GET', path: '/api/sessions' },
  createSession: { method: 'POST', path: '/api/sessions' },
  deleteSession: { method: 'DELETE', path: '/api/sessions/{session_id}' },
  getSession: { method: 'GET', path: '/api/sessions/{session_id}' },
  runBatch: { method: 'POST', path: '/api/sessions/{session_id}/batch', stream: true },
  getSessionCompliance: { method: 'GET', path: '/api/sessions/{session_id}/compliance' },
  getSessionConsistency: { method: 'GET', path: '/api/sessions/{session_id}/consistency' },
  exportSession: { method: 'GET', path: '/api/sessions/{session_id}/export' },
  exportSessionSummary: { method: 'GET', path: '/api/sessions/{session_id}/export/summary' },
  getSessionFindings: { method: 'GET', path: '/api/sessions/{session_id}/findings' },
  sendProbe: { method: 'POST', path: '/api/sessions/{session_id}/run' },
  createSequenceBatch: { method: 'POST', path: '/api/sessions/{session_id}/sequence-batch' },
  listSequences: { method: 'GET', path: '/api/sessions/{session_id}/sequences' },
  createSequence: { method: 'POST', path: '/api/sessions/{session_id}/sequences' },
  listSnapshots: { method: 'GET', path: '/api/sessions/{session_id}/snapshots' },
  createSnapshot: { method: 'POST', path: '/api/sessions/{session_id}/snapshots' },
  startStatRun: { method: 'POST', path: '/api/sessions/{session_id}/stat-run', stream: true },
  listStatRuns: { method: 'GET', path: '/api/sessions/{session_id}/stat-runs' },
  getSessionStats: { method: 'GET', path: '/api/sessions/{session_id}/stats' },
  getStrategyEffectiveness: {
    method: 'GET',
    path: '/api/sessions/{session_id}/strategy-effectiveness',
  },
  getSessionThresholds: { method: 'GET', path: '/api/sessions/{session_id}/thresholds' },
  getCapabilities: { method: 'GET', path: '/api/settings/capabilities' },
  getCoachDefault: { method: 'GET', path: '/api/settings/coach-default' },
  setCoachDefault: { method: 'POST', path: '/api/settings/coach-default' },
  listKeys: { method: 'GET', path: '/api/settings/keys' },
  updateKeys: { method: 'POST', path: '/api/settings/keys' },
  getOllamaSettings: { method: 'GET', path: '/api/settings/ollama' },
  setOllamaSettings: { method: 'POST', path: '/api/settings/ollama' },
  clearRuntimeKey: { method: 'DELETE', path: '/api/settings/set-key' },
  setRuntimeKey: { method: 'POST', path: '/api/settings/set-key' },
  testKey: { method: 'POST', path: '/api/settings/test-key' },
  validateKey: { method: 'POST', path: '/api/settings/validate-key' },
  deleteSnapshot: { method: 'DELETE', path: '/api/snapshots/{snapshot_id}' },
  getSnapshot: { method: 'GET', path: '/api/snapshots/{snapshot_id}' },
  getSnapshotDiff: { method: 'GET', path: '/api/snapshots/{snapshot_id}/diff' },
  getStatRun: { method: 'GET', path: '/api/stat-runs/{stat_run_id}' },
  getStatRunDistribution: { method: 'GET', path: '/api/stat-runs/{stat_run_id}/distribution' },
  listStrategies: { method: 'GET', path: '/api/strategies' },
  createStrategy: { method: 'POST', path: '/api/strategies' },
  deleteStrategy: { method: 'DELETE', path: '/api/strategies/{strategy_id}' },
  getStrategy: { method: 'GET', path: '/api/strategies/{strategy_id}' },
  updateStrategy: { method: 'PUT', path: '/api/strategies/{strategy_id}' },
  listThemes: { method: 'GET', path: '/api/themes' },
  getTheme: { method: 'GET', path: '/api/themes/{name}' },
  getThemePreviewCss: { method: 'GET', path: '/api/themes/{name}/preview-css' },
  listVariantFiles: { method: 'GET', path: '/api/variants/files' },
  saveVariantFile: { method: 'POST', path: '/api/variants/files' },
  deleteVariantFile: { method: 'DELETE', path: '/api/variants/files/{group_id}' },
  getVariantFile: { method: 'GET', path: '/api/variants/files/{group_id}' },
  generateVariants: { method: 'POST', path: '/api/variants/generate' },
  getVersion: { method: 'GET', path: '/api/version' },
  health: { method: 'GET', path: '/health' },
} as const satisfies Record<string, RouteDef>;

export type RouteName = keyof typeof ROUTES;
export type Route = (typeof ROUTES)[RouteName];
/** The routes that answer with Server-Sent Events. */
export type StreamRoute = Extract<Route, { stream: true }>;

/** The `{name}` parameters of a path, as a union of names (never when none). */
export type PathParamNames<P extends string> = P extends `${string}{${infer K}}${infer Rest}`
  ? K | PathParamNames<Rest>
  : never;

export type PathParams<R extends RouteDef> = Record<PathParamNames<R['path']>, string | number>;

/**
 * The route's path with each `{name}` replaced by its URL-encoded value.
 * Throws when a parameter is missing, so a bad call never reaches the sidecar.
 */
export function buildPath<R extends RouteDef>(route: R, params?: PathParams<R>): string {
  const values = (params ?? {}) as Record<string, string | number | undefined>;
  return route.path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing path parameter "${name}" for ${route.method} ${route.path}`);
    }
    return encodeURIComponent(String(value));
  });
}

export interface ContractRow {
  method: Method;
  path: string;
}

/** `ROUTES` as `endpoints.paths.json` holds it: `{method, path}`, sorted by path then method. */
export function contractRows(): ContractRow[] {
  return Object.values(ROUTES as Record<string, RouteDef>)
    .map(({ method, path }) => ({ method, path }))
    .sort((a, b) => cmp(a.path, b.path) || cmp(a.method, b.method));
}

/** The exact text of `endpoints.paths.json`: 2-space indent and a trailing newline. */
export function contractText(): string {
  return `${JSON.stringify(contractRows(), null, 2)}\n`;
}

/** Code-unit order, the same as Python's `sorted` on these ASCII strings. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
