"""Response shapes of the core routes the shell and Probe loop depend on (I36, F15).

These models live in tests, not on the routes: a route `response_model` drops
undeclared keys and changes serialisation. Every model allows extra keys and
is strict, so a key `types.ts` relies on must be present with its JSON type.
`ui/src/lib/api/types.ts` (T13) mirrors these models field for field; field
names are exactly the keys the API returns.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class Shape(BaseModel):
    model_config = ConfigDict(extra="allow", strict=True)


# GET /health
class Health(Shape):
    status: str
    version: str
    db_path: str
    keys_set: int


# GET /api/settings/capabilities
class Capabilities(Shape):
    pdf: bool
    experiment_extras: bool
    openai_sdk: bool
    google_sdk: bool


# GET /api/settings/keys (a list)
class SettingsKey(Shape):
    env_var: str
    provider: str
    label: str
    required: bool
    is_set: bool
    masked: str


# GET /api/models (a list of providers)
class ModelOption(Shape):
    id: str
    name: str


class ModelProvider(Shape):
    provider: str
    models: list[ModelOption]
    available: bool
    hint: str


# GET /api/sessions (a list) and GET /api/sessions/{id}
class Session(Shape):
    id: int
    name: str
    target_model: str
    coach_profile: str
    created_at: str
    completed_at: str | None
    notes: str | None
    system_prompt: str | None
    coach_backend: str | None
    coach_model: str | None
    probe_ids: list[int] | None


class SessionListItem(Session):
    run_count: int


# POST /api/sessions/{id}/run, POST /api/runs/{id}/pushback, GET /api/runs/{id}
class Run(Shape):
    id: int
    probe_id: int
    session_id: int
    target_model: str
    initial_response: str | None
    initial_classification: str | None
    coach_suggestion: str | None
    coach_pattern_detected: str | None
    coach_move_suggested: str | None
    pushback_text: str | None
    pushback_source: str | None
    final_response: str | None
    final_classification: str | None
    override_text: str | None
    notes: str | None
    created_at: str


class SessionRun(Run):
    probe_text: str
    probe_name: str
    probe_domain: str | None


class SessionDetail(Session):
    runs: list[SessionRun]


# GET /api/sessions/{id}/stats
class SessionStats(Shape):
    total_runs: int
    initial_classifications: dict[str, int]
    final_classifications: dict[str, int]
    outcome_classifications: dict[str, int]
    pushback_sources: dict[str, int]


# GET /api/probes (a list)
class Probe(Shape):
    id: int
    name: str
    domain: str | None
    prompt_text: str
    description: str | None
    tags: list[str]
    created_at: str
    source_file: str | None
    narrative_opening: str | None
    narrative_target: str | None


# GET /api/runs/{id}/turns (a list)
class RunTurn(Shape):
    id: int
    run_id: int
    role: str
    content: str
    classification: str | None
    created_at: str


# GET /api/runs/{id}/annotations (id and timestamps only once saved)
class Annotation(Shape):
    run_id: int
    note_text: str
    pattern_tags: list[str]
    finding: str
    id: int | None = None
    created_at: str | None = None
    updated_at: str | None = None


# GET /api/coach-examples (a list)
class CoachExample(Shape):
    id: int
    run_id: int | None
    coach_profile: str
    refusal_text: str
    pushback_text: str
    outcome: str
    pattern: str | None
    move: str | None
    effectiveness: int
    promoted_at: str


# GET /api/variants/files (a list)
class VariantFile(Shape):
    group_id: str
    title: str
    description: str
    domain: str
    variant_type: str
    variant_count: int
    labels: list[str]
    probe_ids: list[int]


# GET /api/variants/files/{group_id}
class Variant(Shape):
    label: str
    prompt_text: str
    is_baseline: bool


class VariantFileDetail(Shape):
    group_id: str
    title: str
    description: str
    base_probe: str
    domain: str
    variant_type: str
    variants: list[Variant]
    source_file: str


# Studies: GET /api/experiments, /api/experiments/{id}, /progress, /condition-comparison
class Experiment(Shape):
    id: int
    name: str
    description: str
    status: str
    prompt_source: str
    model_ids: list[str]
    base_model_ids: list[str]
    random_seed: int | None
    config: dict[str, Any]
    created_at: str
    started_at: str | None
    completed_at: str | None


class ExperimentList(Shape):
    experiments: list[Experiment]


class Condition(Shape):
    id: int
    experiment_id: int
    label: str
    system_prompt: str
    description: str
    sort_order: int


class ProgressCounts(Shape):
    total: int
    completed: int
    failed: int
    pending: int


class Progress(ProgressCounts):
    by_model: dict[str, ProgressCounts]
    by_condition: dict[str, ProgressCounts]


class StudyProgress(Progress):
    active: bool


class ExperimentDetail(Shape):
    experiment: Experiment
    conditions: list[Condition]
    progress: Progress


class ConditionSummary(Shape):
    id: int
    label: str
    system_prompt: str
    description: str
    response_count: int
    classifications: dict[str, int]
    compliance_rate: float | None
    metrics: dict[str, Any]


class ConditionComparison(Shape):
    experiment_id: int
    conditions: list[ConditionSummary]
    has_metrics: bool
    has_analysis: bool
    analysis_results: dict[str, Any] | None
    pending_count: int


# GET /api/dashboard/stats
class DateRange(Shape):
    earliest: str | None
    latest: str | None


class DashboardStats(Shape):
    total_sessions: int
    total_runs: int
    total_comparisons: int
    total_snapshots: int
    total_sequences: int
    total_annotations: int
    classification_breakdown: dict[str, int]
    date_range: DateRange
