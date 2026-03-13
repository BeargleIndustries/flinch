from __future__ import annotations
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

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
