from __future__ import annotations
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, model_validator

class Classification(str, Enum):
    REFUSED = "refused"
    COLLAPSED = "collapsed"
    NEGOTIATED = "negotiated"
    COMPLIED = "complied"

class PushbackSource(str, Enum):
    COACH = "coach"
    OVERRIDE = "override"
    SKIP = "skip"

class PushbackMove(str, Enum):
    SPECIFICITY_CHALLENGE = "specificity_challenge"
    EQUIVALENCE_PROBE = "equivalence_probe"
    PROJECTION_CHECK = "projection_check"
    CONTRADICTION_MIRROR = "contradiction_mirror"
    CATEGORY_REDUCTIO = "category_reductio"
    REALITY_ANCHOR = "reality_anchor"
    MINIMAL_PRESSURE = "minimal_pressure"

class ProbeCreate(BaseModel):
    name: str = Field(max_length=200)
    domain: str = ""
    prompt_text: str = Field(max_length=10000)
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    source_file: str | None = None

class Probe(ProbeCreate):
    id: int
    created_at: datetime

class SessionCreate(BaseModel):
    name: str = Field(max_length=200)
    target_model: str = "claude-sonnet-4-20250514"
    coach_profile: str = "standard"
    notes: str = Field(default="", max_length=2000)
    system_prompt: str = Field(default="", max_length=10000)
    coach_backend: str = "anthropic"
    coach_model: str | None = None

class Session(SessionCreate):
    id: int
    created_at: datetime
    completed_at: datetime | None = None

class CoachSuggestion(BaseModel):
    pattern_detected: str
    move_suggested: PushbackMove
    pushback_draft: str
    confidence: float = 0.0
    reasoning: str = ""

class RunCreate(BaseModel):
    probe_id: int
    session_id: int
    target_model: str

class RunUpdate(BaseModel):
    initial_response: str | None = None
    initial_classification: Classification | None = None
    coach_suggestion: CoachSuggestion | None = None
    coach_pattern_detected: str | None = None
    coach_move_suggested: PushbackMove | None = None
    pushback_text: str | None = Field(default=None, max_length=5000)
    pushback_source: PushbackSource | None = None
    final_response: str | None = None
    final_classification: Classification | None = None
    override_text: str | None = Field(default=None, max_length=5000)
    notes: str | None = Field(default=None, max_length=2000)

class Run(BaseModel):
    id: int
    probe_id: int
    session_id: int
    target_model: str
    initial_response: str | None = None
    initial_classification: Classification | None = None
    coach_suggestion: CoachSuggestion | None = None
    coach_pattern_detected: str | None = None
    coach_move_suggested: PushbackMove | None = None
    pushback_text: str | None = None
    pushback_source: PushbackSource | None = None
    final_response: str | None = None
    final_classification: Classification | None = None
    override_text: str | None = None
    notes: str | None = None
    created_at: datetime | None = None

class CoachExampleCreate(BaseModel):
    run_id: int
    coach_profile: str
    refusal_text: str
    pushback_text: str
    outcome: Classification
    pattern: str
    move: PushbackMove
    effectiveness: int = Field(ge=1, le=5)

class CoachExample(CoachExampleCreate):
    id: int
    promoted_at: datetime

class CoachProfileCreate(BaseModel):
    name: str = Field(max_length=200)
    system_prompt: str = Field(max_length=10000)
    moves: list[dict]
    description: str = ""

class CoachProfile(CoachProfileCreate):
    id: int
    created_at: datetime

class SessionStats(BaseModel):
    total_runs: int = 0
    refused: int = 0
    collapsed: int = 0
    negotiated: int = 0
    complied: int = 0
    coach_accepted: int = 0
    coach_overridden: int = 0
    skipped: int = 0

# ─── Statistical Runs ─────────────────────────────────────────────────────────

class StartStatRunRequest(BaseModel):
    probe_ids: list[int]
    repeat_count: int = Field(default=10, ge=1, le=100)

# ─── Policy Scorecard ─────────────────────────────────────────────────────────

class GenerateScorecardRequest(BaseModel):
    name: str = Field(max_length=200)
    models: list[str]
    session_ids: list[int] | None = None
    stat_run_ids: list[int] | None = None

# ─── Publication Export ───────────────────────────────────────────────────────

class PublicationExportRequest(BaseModel):
    name: str = Field(max_length=200)
    format: str = "markdown"  # markdown, html, csv
    template: str = "full_report"  # comparison_table, consistency_matrix, pushback_summary, full_report
    filters: dict | None = None
    theme: str = "beargle-dark"


class ExportTheme(BaseModel):
    """Theme definition for export rendering."""
    name: str                          # "beargle-dark"
    display_name: str                  # "Beargle Dark"
    description: str = ""

    # Colors
    bg_color: str = "#0a0a0a"          # Page/body background
    bg_secondary: str = "#161616"      # Alternating row / card background
    text_color: str = "#e0e0e0"        # Primary text
    text_secondary: str = "#aaaaaa"    # Muted text (metadata, footnotes)
    accent_color: str = "#4a9eff"      # Links, highlights, primary accent
    border_color: str = "#2a2a2a"      # Table borders, dividers
    heading_color: str = "#cccccc"     # h1/h2/h3

    # Classification colors (used in tables/badges)
    color_high: str = "#6ef"           # High consistency / complied
    color_mid: str = "#fa6"            # Medium / negotiated
    color_low: str = "#f86"            # Low / refused-collapsed

    # Typography
    font_body: str = "system-ui, -apple-system, sans-serif"
    font_mono: str = "'JetBrains Mono', 'Fira Code', monospace"
    font_heading: str = "Poppins, system-ui, sans-serif"
    font_size_base: str = "14px"

    # Header/branding (OFF by default)
    show_logo: bool = False
    logo_url: str = ""                 # Path or URL to logo image
    header_text: str = ""              # e.g. "Beargle Industries"
    header_subtitle: str = ""          # e.g. "Flinch Research Report"

    # Layout
    max_width: str = "1200px"
    padding: str = "2rem"

    # Meta
    is_builtin: bool = False
    source_file: str = ""


class ThemeSummary(BaseModel):
    name: str
    display_name: str
    description: str
    is_builtin: bool


# ============================================================
# EXPERIMENT FRAMEWORK MODELS
# ============================================================

class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class ConditionCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    system_prompt: str = Field(..., min_length=1)
    description: str = ""
    sort_order: int = 0


class Condition(BaseModel):
    id: int
    experiment_id: int
    label: str
    system_prompt: str
    description: str = ""
    sort_order: int = 0


class ExperimentPromptCreate(BaseModel):
    probe_id: int | None = None
    custom_prompt_text: str | None = None
    domain: str = ""

    @model_validator(mode="after")
    def check_prompt_source(self):
        if self.probe_id is None and not self.custom_prompt_text:
            raise ValueError("Either probe_id or custom_prompt_text must be provided")
        return self


class ExperimentPrompt(BaseModel):
    id: int
    experiment_id: int
    probe_id: int | None = None
    custom_prompt_text: str | None = None
    domain: str = ""
    sort_order: int = 0


class CreateExperimentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    model_ids: list[str] = Field(default_factory=list)
    base_model_ids: list[str] = Field(default_factory=list)
    random_seed: int | None = None
    config: dict = Field(default_factory=dict)
    conditions: list[ConditionCreate] = Field(default_factory=list)


class Experiment(BaseModel):
    id: int
    name: str
    description: str = ""
    status: ExperimentStatus = ExperimentStatus.DRAFT
    prompt_source: str = "probes"
    model_ids: list[str] = Field(default_factory=list)
    base_model_ids: list[str] = Field(default_factory=list)
    random_seed: int | None = None
    config: dict = Field(default_factory=dict)
    created_at: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    conditions: list[Condition] = Field(default_factory=list)


class ExperimentResponse(BaseModel):
    id: int
    experiment_id: int
    condition_id: int
    prompt_id: int
    model_id: str
    response_text: str | None = None
    latency_ms: int | None = None
    token_count_input: int | None = None
    token_count_output: int | None = None
    finish_reason: str | None = None
    status: str = "pending"
    error_message: str | None = None
    attempt_count: int = 0
    created_at: str | None = None
    completed_at: str | None = None


class ResponseMetrics(BaseModel):
    id: int
    response_id: int
    word_count: int | None = None
    sentence_count: int | None = None
    flesch_kincaid_grade: float | None = None
    flesch_reading_ease: float | None = None
    hedging_count: int | None = None
    hedging_ratio: float | None = None
    confidence_marker_count: int | None = None
    confidence_ratio: float | None = None
    refusal_classification: str | None = None
    avg_sentence_length: float | None = None
    lexical_diversity: float | None = None
    computed_at: str | None = None


class AIRatingItem(BaseModel):
    id: int | None = None
    rating_id: int | None = None
    response_id: int
    position_label: str
    rank: int | None = None


class AIRating(BaseModel):
    id: int | None = None
    experiment_id: int
    rater_model: str
    prompt_id: int
    target_model_id: str
    blinding_order: dict = Field(default_factory=dict)
    rater_reasoning: str | None = None
    status: str = "pending"
    created_at: str | None = None
    completed_at: str | None = None
    items: list[AIRatingItem] = Field(default_factory=list)


class EvalTask(BaseModel):
    id: int | None = None
    experiment_id: int
    batch_id: str
    prompt_id: int
    target_model_id: str
    blinding_order: dict = Field(default_factory=dict)
    tracking_id: str
    status: str = "pending"
    created_at: str | None = None


class EvalRating(BaseModel):
    id: int | None = None
    eval_task_id: int
    rater_id: str
    response_id: int
    position_label: str
    rank: int | None = None
    reasoning: str | None = None
    completion_time_s: int | None = None
    completed_at: str | None = None


class AnalysisResult(BaseModel):
    id: int | None = None
    experiment_id: int
    analysis_type: str
    scope: str = "full"
    model_id: str | None = None
    parameters: dict = Field(default_factory=dict)
    results: dict = Field(default_factory=dict)
    created_at: str | None = None


# --- Request Models ---

class StartExperimentRequest(BaseModel):
    """Request to start experiment execution."""
    concurrency_per_provider: dict[str, int] = Field(
        default_factory=lambda: {"anthropic": 5, "openai": 5, "google": 3, "together": 3}
    )


class RunAIRatersRequest(BaseModel):
    """Request to run AI rater pipeline."""
    rater_models: list[str] = Field(
        default_factory=lambda: ["claude-haiku-4-5-20251001", "gpt-4o-mini", "gemini-2.0-flash"]
    )


class GenerateProlificExportRequest(BaseModel):
    """Request to generate Prolific export."""
    prompt_count: int = 300
    model_ids: list[str] = Field(default_factory=list)
    raters_per_task: int = 3
    batch_id: str = ""


class BulkPromptImportRequest(BaseModel):
    """Request for bulk prompt import."""
    source: str = "csv"  # 'csv' or 'anthropic_hh'
    csv_text: str | None = None


class RunAnalysisRequest(BaseModel):
    """Request to run statistical analysis."""
    analyses: list[str] = Field(
        default_factory=lambda: ["win_rates", "effect_sizes", "confidence_intervals", "inter_rater_agreement", "per_model_breakdown"]
    )


class GenerateReportRequest(BaseModel):
    """Request to generate publication report."""
    format: str = "markdown"  # 'markdown', 'html', 'latex'
    include_charts: bool = True
    include_tables: bool = True
    include_preregistration: bool = False
