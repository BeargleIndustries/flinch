// Sidecar response and request shapes (brief 10.5, plan F15, I36).
//
// The response types mirror tests/shapes.py field for field: the same names
// (the keys the API returns), `X | None` as `X | null`, and a field with a
// Python default (`= None`) as optional. tests/test_api_contract.py
// `test_core_shapes` checks those models against the live routes, so a key
// read here is a key the route returns. The shapes allow extra keys; a screen
// that needs one adds it here and to tests/shapes.py together.
//
// Request bodies follow the Pydantic request models in flinch/app.py and
// flinch/models.py; a field with a server default is optional.

// ---------------------------------------------------------------------------
// Responses (tests/shapes.py)
// ---------------------------------------------------------------------------

/** GET /health */
export interface Health {
  status: string;
  version: string;
  db_path: string;
  keys_set: number;
}

/** GET /api/settings/capabilities */
export interface Capabilities {
  pdf: boolean;
  experiment_extras: boolean;
  openai_sdk: boolean;
  google_sdk: boolean;
}

/** One entry of GET /api/settings/keys (a list). */
export interface SettingsKey {
  env_var: string;
  provider: string;
  label: string;
  required: boolean;
  is_set: boolean;
  masked: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

/** One entry of GET /api/models (a list of providers). */
export interface ModelProvider {
  provider: string;
  models: ModelOption[];
  available: boolean;
  hint: string;
}

/** GET /api/sessions/{session_id} fields shared with the list. */
export interface Session {
  id: number;
  name: string;
  target_model: string;
  coach_profile: string;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  system_prompt: string | null;
  coach_backend: string | null;
  coach_model: string | null;
  probe_ids: number[] | null;
}

/** One entry of GET /api/sessions (a list). */
export interface SessionListItem extends Session {
  run_count: number;
}

/** POST /api/sessions/{id}/run, POST /api/runs/{id}/pushback, GET /api/runs/{id} */
export interface Run {
  id: number;
  probe_id: number;
  session_id: number;
  target_model: string;
  initial_response: string | null;
  initial_classification: string | null;
  coach_suggestion: string | null;
  coach_pattern_detected: string | null;
  coach_move_suggested: string | null;
  pushback_text: string | null;
  pushback_source: string | null;
  final_response: string | null;
  final_classification: string | null;
  override_text: string | null;
  notes: string | null;
  created_at: string;
}

/** A run inside GET /api/sessions/{session_id}. */
export interface SessionRun extends Run {
  probe_text: string;
  probe_name: string;
  probe_domain: string | null;
}

/** GET /api/sessions/{session_id} */
export interface SessionDetail extends Session {
  runs: SessionRun[];
}

/** GET /api/sessions/{session_id}/stats */
export interface SessionStats {
  total_runs: number;
  initial_classifications: Record<string, number>;
  final_classifications: Record<string, number>;
  outcome_classifications: Record<string, number>;
  pushback_sources: Record<string, number>;
}

/** One entry of GET /api/probes (a list). */
export interface Probe {
  id: number;
  name: string;
  domain: string | null;
  prompt_text: string;
  description: string | null;
  tags: string[];
  created_at: string;
  source_file: string | null;
  narrative_opening: string | null;
  narrative_target: string | null;
}

/** One entry of GET /api/runs/{run_id}/turns (a list). */
export interface RunTurn {
  id: number;
  run_id: number;
  role: string;
  content: string;
  classification: string | null;
  created_at: string;
}

/** GET /api/runs/{run_id}/annotations (id and timestamps only once saved). */
export interface Annotation {
  run_id: number;
  note_text: string;
  pattern_tags: string[];
  finding: string;
  id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** One entry of GET /api/coach-examples (a list). */
export interface CoachExample {
  id: number;
  run_id: number | null;
  coach_profile: string;
  refusal_text: string;
  pushback_text: string;
  outcome: string;
  pattern: string | null;
  move: string | null;
  effectiveness: number;
  promoted_at: string;
}

/** One entry of GET /api/variants/files (a list). */
export interface VariantFile {
  group_id: string;
  title: string;
  description: string;
  domain: string;
  variant_type: string;
  variant_count: number;
  labels: string[];
  probe_ids: number[];
}

export interface Variant {
  label: string;
  prompt_text: string;
  is_baseline: boolean;
}

/** GET /api/variants/files/{group_id} */
export interface VariantFileDetail {
  group_id: string;
  title: string;
  description: string;
  base_probe: string;
  domain: string;
  variant_type: string;
  variants: Variant[];
  source_file: string;
}

/** A study (the API calls it an experiment). */
export interface Experiment {
  id: number;
  name: string;
  description: string;
  status: string;
  prompt_source: string;
  model_ids: string[];
  base_model_ids: string[];
  random_seed: number | null;
  config: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/** GET /api/experiments */
export interface ExperimentList {
  experiments: Experiment[];
}

export interface Condition {
  id: number;
  experiment_id: number;
  label: string;
  system_prompt: string;
  description: string;
  sort_order: number;
}

export interface ProgressCounts {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

export interface Progress extends ProgressCounts {
  by_model: Record<string, ProgressCounts>;
  by_condition: Record<string, ProgressCounts>;
}

/** GET /api/experiments/{experiment_id}/progress */
export interface StudyProgress extends Progress {
  active: boolean;
}

/** GET /api/experiments/{experiment_id} */
export interface ExperimentDetail {
  experiment: Experiment;
  conditions: Condition[];
  progress: Progress;
}

export interface ConditionSummary {
  id: number;
  label: string;
  system_prompt: string;
  description: string;
  response_count: number;
  classifications: Record<string, number>;
  compliance_rate: number | null;
  metrics: Record<string, unknown>;
}

/** GET /api/experiments/{experiment_id}/condition-comparison */
export interface ConditionComparison {
  experiment_id: number;
  conditions: ConditionSummary[];
  has_metrics: boolean;
  has_analysis: boolean;
  analysis_results: Record<string, unknown> | null;
  pending_count: number;
}

export interface DateRange {
  earliest: string | null;
  latest: string | null;
}

/** GET /api/dashboard/stats */
export interface DashboardStats {
  total_sessions: number;
  total_runs: number;
  total_comparisons: number;
  total_snapshots: number;
  total_sequences: number;
  total_annotations: number;
  classification_breakdown: Record<string, number>;
  date_range: DateRange;
}

/** POST /api/probes/bulk-delete */
export interface BulkDeleteResult {
  deleted: number;
  skipped: number[];
}

// ---------------------------------------------------------------------------
// Request bodies (flinch/app.py, flinch/models.py)
// ---------------------------------------------------------------------------

/** POST /api/probes */
export interface CreateProbeBody {
  name: string;
  prompt_text: string;
  domain?: string;
  description?: string;
  tags?: string[];
  narrative_opening?: string | null;
  narrative_target?: string | null;
  session_id?: number | null;
}

/** POST /api/probes/bulk-delete */
export interface BulkDeleteProbesBody {
  probe_ids: number[];
}

/** POST /api/probes/import-file */
export interface ImportProbeFileBody {
  filename: string;
}

/** POST /api/sessions */
export interface CreateSessionBody {
  name: string;
  target_model?: string;
  coach_profile?: string;
  notes?: string;
  system_prompt?: string;
  coach_backend?: string;
  coach_model?: string | null;
  probe_ids?: number[] | null;
}

/** POST /api/sessions/{session_id}/run: a probe id or custom text. */
export interface SendProbeBody {
  probe_id?: number | null;
  custom_text?: string | null;
}

/** POST /api/runs/{run_id}/pushback and /continue */
export interface PushbackBody {
  text: string;
  source?: 'coach' | 'override';
}

/** PATCH /api/runs/{run_id}/classification */
export interface UpdateClassificationBody {
  field: 'initial_classification' | 'final_classification';
  value: string;
}

/** POST /api/sessions/{session_id}/batch (stream) */
export interface BatchBody {
  probe_ids?: number[] | null;
  delay_ms?: number;
}

/** PUT /api/runs/{run_id}/annotations */
export interface AnnotationBody {
  note_text?: string | null;
  pattern_tags?: string[] | null;
  finding?: string | null;
}

/** PATCH /api/coach-examples/{example_id} */
export interface UpdateCoachExampleBody {
  pushback_text?: string | null;
  pattern?: string | null;
  move?: string | null;
  effectiveness?: number | null;
}

export interface VariantItem {
  label: string;
  prompt_text: string;
}

/** POST /api/variants/files */
export interface SaveVariantFileBody {
  group_id: string;
  title?: string;
  description?: string;
  base_probe?: string;
  domain?: string;
  variant_type?: string;
  variants: VariantItem[];
}

/** POST /api/variants/generate */
export interface GenerateVariantsBody {
  probe_id: number;
  strategies?: string[];
}

/** POST /api/sessions/{session_id}/snapshots */
export interface CreateSnapshotBody {
  name: string;
  description?: string;
}

/** POST /api/compare/run */
export interface CompareRunBody {
  probe_ids: number[];
  models: string[];
  system_prompt?: string;
}

/** POST /api/sessions/{session_id}/sequences */
export interface CreateSequenceBody {
  probe_id: number;
  strategy_id: number;
  mode?: string;
  max_warmup_turns?: number;
  use_narrative_engine?: boolean;
}

/** POST /api/sessions/{session_id}/sequence-batch */
export interface CreateSequenceBatchBody {
  strategy_id: number;
  probe_ids: number[];
  mode?: string;
  fixed_n?: number | null;
  max_warmup_turns?: number;
}

/** POST /api/settings/ollama */
export interface OllamaSettingsBody {
  base_url?: string;
}

/** POST /api/settings/coach-default: only the fields given change. */
export interface CoachDefaultBody {
  backend?: string;
  model?: string | null;
}

/** POST /api/settings/keys: env var name to value; an empty string clears it. */
export type UpdateKeysBody = Record<string, string>;

/** POST /api/settings/test-key */
export interface TestKeyBody {
  provider: string;
}

/** POST /api/settings/set-key and /api/settings/validate-key */
export interface ProviderKeyBody {
  provider: string;
  key: string;
}

/** DELETE /api/dashboard/clear-all */
export interface ClearAllBody {
  confirm: string;
}

/** POST /api/sessions/{session_id}/stat-run (stream) */
export interface StatRunBody {
  probe_ids: number[];
  repeat_count?: number;
}

/** POST /api/scorecard/generate */
export interface GenerateScorecardBody {
  name: string;
  models: string[];
  session_ids?: number[] | null;
  stat_run_ids?: number[] | null;
}

/** POST /api/publication/export */
export interface PublicationExportBody {
  name: string;
  format?: 'markdown' | 'html' | 'csv' | 'pdf';
  template?: string;
  filters?: Record<string, unknown> | null;
  theme?: string;
}

/** A condition in POST /api/experiments, or POST .../conditions on its own. */
export interface ConditionBody {
  label: string;
  system_prompt?: string;
  description?: string;
  sort_order?: number;
}

/** POST /api/experiments */
export interface CreateExperimentBody {
  name: string;
  description?: string;
  model_ids?: string[];
  base_model_ids?: string[];
  random_seed?: number | null;
  config?: Record<string, unknown>;
  conditions?: ConditionBody[];
  repetitions?: number;
}

/** PUT /api/experiments/{experiment_id}; status is managed by the runner. */
export interface UpdateExperimentBody {
  name?: string | null;
  description?: string | null;
  config?: Record<string, unknown> | null;
  repetitions?: number | null;
}

/** One entry of POST /api/experiments/{experiment_id}/prompts (a list): a probe id or custom text. */
export interface ExperimentPromptBody {
  probe_id?: number | null;
  custom_prompt_text?: string | null;
  domain?: string;
}

/** One provider's limit; a missing field takes the pool default. */
export interface ProviderLimit {
  rpm?: number | null;
  concurrent?: number | null;
}

/** POST /api/experiments/{experiment_id}/start and /resume (streams) */
export interface StartExperimentBody {
  concurrency_per_provider?: Record<string, number | ProviderLimit>;
  retry_failed?: boolean;
}

/** POST /api/experiments/{experiment_id}/rate (stream) */
export interface RateBody {
  rater_models?: string[];
}

/** POST /api/experiments/{experiment_id}/prolific */
export interface ProlificExportBody {
  prompt_count?: number;
  model_ids?: string[];
  raters_per_task?: number;
  batch_id?: string;
}

/** POST /api/experiments/{experiment_id}/prompts/import */
export interface BulkPromptImportBody {
  source?: 'csv' | 'anthropic_hh';
  csv_text?: string | null;
}

/** POST /api/experiments/{experiment_id}/prompts/import-hh (stream) */
export interface HHImportBody {
  target_count?: number;
  subsets?: string[] | null;
  stratification?: Record<string, number> | null;
  seed?: number;
}

/** POST /api/experiments/{experiment_id}/human-evals/import */
export interface HumanEvalsImportBody {
  csv_text: string;
}

/** POST /api/experiments/{experiment_id}/analyze */
export interface AnalysisBody {
  analyses?: string[];
}

/** POST /api/experiments/{experiment_id}/report */
export interface ReportBody {
  format?: 'markdown' | 'html' | 'latex';
  include_charts?: boolean;
  include_tables?: boolean;
  include_preregistration?: boolean;
}
