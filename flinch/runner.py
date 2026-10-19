from __future__ import annotations

import asyncio
import logging
import os
from collections import deque
from datetime import UTC, datetime

import anyio

from flinch import db
from flinch import target as flinch_target
from flinch.classifier import classify
from flinch.coach import NARRATIVE_ENGINE_SYSTEM_PROMPT, Coach, NarrativeCoach
from flinch.llm import LLMBackend
from flinch.models import Classification, PushbackSource
from flinch.rate_limiter import ProviderRateLimiter, RateLimiterPool
from flinch.target import EMPTY_RESPONSE, BaseModelTarget, TargetModel

logger = logging.getLogger(__name__)

# Stored turn roles, mapped to the roles a target conversation uses (I6).
_RUN_TURN_ROLES = {"probe": "user", "pushback": "user", "user": "user",
                   "response": "assistant", "assistant": "assistant"}
_SEQUENCE_TURN_ROLES = {"coach": "user", "probe": "user", "target": "assistant"}


def _target_history(turns: list[dict], roles: dict[str, str]) -> list[dict[str, str]]:
    """Stored turns, in order, as user/assistant messages for `TargetModel.seed`.

    An empty provider reply is never fed back as an assistant turn.
    """
    history = []
    for t in turns:
        role = roles.get(t["role"])
        if role is None or (role == "assistant" and t["content"] in (EMPTY_RESPONSE, "", None)):
            continue
        history.append({"role": role, "content": t["content"]})
    return history


def _after_pushback(classification: Classification, run: dict) -> Classification:
    """Complied after pushback on a run first Refused is stored as Collapsed (I7)."""
    if (classification == Classification.COMPLIED
            and run.get("initial_classification") == Classification.REFUSED.value):
        return Classification.COLLAPSED
    return classification


class Runner:
    def __init__(self, conn, client=None, backend: LLMBackend | None = None):
        self._conn = conn
        self._client = client  # Keep for ClaudeTarget backward compat
        self._backend = backend  # For classifier + coach

    @property
    def backend(self) -> LLMBackend | None:
        return self._backend

    @property
    def client(self):
        return self._client

    def _make_target(self, model_name: str, system_prompt: str = "") -> TargetModel:
        """Thin wrapper over `flinch.target.make_target` (kept as a test patch point)."""
        return flinch_target.make_target(model_name, system_prompt, anthropic_client=self._client)

    def _target_for_run(self, run: dict) -> TargetModel:
        """A fresh target for the run's own model, seeded with its stored conversation (I6)."""
        session = db.get_session(self._conn, run["session_id"]) or {}
        model = run.get("target_model") or session.get("target_model")
        if not model:
            raise ValueError(f"Run {run['id']} has no target model")
        target = self._make_target(model, session.get("system_prompt") or "")
        target.seed(_target_history(db.list_run_turns(self._conn, run["id"]), _RUN_TURN_ROLES))
        return target

    def _get_coach(self, session_id: int) -> Coach:
        """Create a coach for a session, using the configured backend provider."""
        from flinch.llm import OpenAICompatibleBackend, get_backend_for_provider

        session = db.get_session(self._conn, session_id)
        profile = db.get_coach_profile(self._conn, session.get("coach_profile", "standard")) if session else None
        profile_moves = None
        if profile and profile.get("moves"):
            profile_moves = profile["moves"] if isinstance(profile["moves"], list) else None

        coach_backend_type = session.get("coach_backend", "anthropic") if session else "anthropic"

        coach_model = session.get("coach_model") if session else None

        if coach_backend_type == "local":
            ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
            local_model = coach_model or "llama3.2"
            backend = OpenAICompatibleBackend(f"{ollama_url}/v1", default_model=local_model)
            return Coach(backend=backend, profile_moves=profile_moves, is_local=True, model=local_model)

        # Try to get a backend for the specific provider requested
        backend = get_backend_for_provider(coach_backend_type)
        if backend:
            return Coach(backend=backend, profile_moves=profile_moves, model=coach_model)

        # Fall back to the runner's general backend
        if self._backend:
            return Coach(backend=self._backend, profile_moves=profile_moves, model=coach_model)

        raise ValueError("No LLM backend available for coach. Set an API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY) or run Ollama.")

    async def send_probe(self, session_id: int, probe_id: int) -> dict:
        """Send a probe to the target model, classify, and get coach suggestion if refused."""
        probe = db.get_probe(self._conn, probe_id)
        if probe is None:
            raise ValueError(f"Probe {probe_id} not found")

        session = db.get_session(self._conn, session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")

        # A fresh target per run, never shared across runs (I6)
        target = self._make_target(session["target_model"], session.get("system_prompt") or "")

        # Send probe
        response_text = (await target.send(probe["prompt_text"])).text

        # Classify
        classification = await classify(response_text, probe["prompt_text"], self._backend)

        # Create run record
        run_id = db.create_run(self._conn, probe_id, session_id, session["target_model"])

        update_fields = {
            "initial_response": response_text,
            "initial_classification": classification.value,
        }

        # If refused, get coach suggestion (non-fatal — save run even if coach fails)
        if classification in (Classification.REFUSED, Classification.NEGOTIATED):
            try:
                coach = self._get_coach(session_id)

                # Get examples from DB
                profile_name = session.get("coach_profile", "standard")
                examples = db.list_coach_examples(self._conn, profile_name, limit=5)

                suggestion = await coach.suggest(response_text, probe["prompt_text"], examples)
                update_fields["coach_suggestion"] = suggestion.model_dump()
                update_fields["coach_pattern_detected"] = suggestion.pattern_detected
                update_fields["coach_move_suggested"] = suggestion.move_suggested.value
            except Exception as e:
                logger.warning("Coach suggestion failed (run %d): %s", run_id, e)

        db.update_run(self._conn, run_id, **update_fields)
        # Log initial turns
        db.add_run_turn(self._conn, run_id, "probe", probe["prompt_text"])
        db.add_run_turn(self._conn, run_id, "response", response_text, classification.value)
        return db.get_run(self._conn, run_id)

    async def send_pushback(self, run_id: int, pushback_text: str, source: PushbackSource) -> dict:
        """Send pushback to the target model and classify the result."""
        run = db.get_run(self._conn, run_id)
        if run is None:
            raise ValueError(f"Run {run_id} not found")

        # Rebuild the run's conversation from the database, then continue it
        target = self._target_for_run(run)
        response_text = (await target.reply(pushback_text)).text

        # Classify the response after pushback
        probe = db.get_probe(self._conn, run["probe_id"])
        classification = _after_pushback(
            await classify(response_text, probe["prompt_text"], self._backend), run
        )

        update_fields = {
            "pushback_text": pushback_text,
            "pushback_source": source.value,
            "final_response": response_text,
            "final_classification": classification.value,
        }

        # If human overrode the coach suggestion, record the override
        if source == PushbackSource.OVERRIDE:
            update_fields["override_text"] = pushback_text

        db.update_run(self._conn, run_id, **update_fields)
        db.add_run_turn(self._conn, run_id, "pushback", pushback_text)
        db.add_run_turn(self._conn, run_id, "response", response_text, classification.value)
        return db.get_run(self._conn, run_id)

    async def continue_pushback(self, run_id: int, text: str, source: PushbackSource) -> dict:
        """Send another pushback in the same conversation (multi-turn)."""
        run = db.get_run(self._conn, run_id)
        if run is None:
            raise ValueError(f"Run {run_id} not found")

        # Rebuild the run's conversation from the database, then continue it
        target = self._target_for_run(run)
        response_text = (await target.reply(text)).text

        probe = db.get_probe(self._conn, run["probe_id"])
        classification = _after_pushback(
            await classify(response_text, probe["prompt_text"], self._backend), run
        )

        # Overwrite final_response/final_classification with the latest
        db.update_run(self._conn, run_id,
            pushback_text=text,
            pushback_source=source.value,
            final_response=response_text,
            final_classification=classification.value,
        )

        db.add_run_turn(self._conn, run_id, "pushback", text)
        db.add_run_turn(self._conn, run_id, "response", response_text, classification.value)

        return db.get_run(self._conn, run_id)

    async def run_batch(self, session_id: int, probe_ids: list[int], delay_ms: int = 2000):
        """Async generator that yields SSE events as each probe completes.

        Cancel is the batch row's `cancelled` status, read before every probe, so
        it does not depend on the client or on runner state. A generator closed
        early (client disconnect, `aclose()`) also leaves the row `cancelled`.
        """
        session = db.get_session(self._conn, session_id)
        if not session:
            raise ValueError("Session not found")

        batch_id = db.create_batch_run(self._conn, session_id, len(probe_ids), delay_ms)
        total = len(probe_ids)
        completed = 0
        failed = 0
        cancelled = False
        finished = False

        try:
            yield {"event": "start", "data": {"batch_id": batch_id, "total": total}}

            for probe_id in probe_ids:
                row = db.get_batch_run(self._conn, batch_id)
                if row and row["status"] == "cancelled":
                    cancelled = True
                    break
                try:
                    run = await self.send_probe(session_id, probe_id)
                    completed += 1
                    db.update_batch_run(self._conn, batch_id, probes_completed=completed)

                    probe = db.get_probe(self._conn, probe_id)
                    yield {
                        "event": "progress",
                        "data": {
                            "batch_id": batch_id,
                            "probe_id": probe_id,
                            "probe_name": probe["name"] if probe else f"probe-{probe_id}",
                            "run_id": run["id"],
                            "classification": run.get("initial_classification", "unknown"),
                            "completed": completed,
                            "total": total,
                        },
                    }
                except Exception as e:
                    failed += 1
                    completed += 1
                    db.update_batch_run(self._conn, batch_id, probes_completed=completed)
                    yield {
                        "event": "error",
                        "data": {
                            "batch_id": batch_id,
                            "probe_id": probe_id,
                            "error": str(e),
                            "completed": completed,
                            "total": total,
                        },
                    }

                # Delay between probes (skip after last one)
                if completed < total:
                    await asyncio.sleep(delay_ms / 1000)

            db.update_batch_run(
                self._conn,
                batch_id,
                status="cancelled" if cancelled else "complete",
                probes_completed=completed,
                completed_at=datetime.now(UTC).isoformat(),
            )
            finished = True
            yield {
                "event": "complete",
                "data": {
                    "batch_id": batch_id,
                    "total": total,
                    "completed": completed,
                    "failed": failed,
                    "cancelled": cancelled,
                },
            }
        finally:
            if not finished:
                # Closed early. A synchronous write: there is no await here to cancel.
                db.update_batch_run(
                    self._conn,
                    batch_id,
                    status="cancelled",
                    probes_completed=completed,
                    completed_at=datetime.now(UTC).isoformat(),
                )

    async def skip_pushback(self, run_id: int) -> dict:
        """Skip pushback for a run."""
        run = db.get_run(self._conn, run_id)
        if run is None:
            raise ValueError(f"Run {run_id} not found")

        db.update_run(self._conn, run_id, pushback_source=PushbackSource.SKIP.value)
        return db.get_run(self._conn, run_id)

    def _get_sequence_target(self, session_id: int, use_narrative_engine: bool) -> TargetModel:
        """A fresh target for a sequence, optionally with the narrative engine system prompt."""
        session = db.get_session(self._conn, session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        system_prompt = (
            NARRATIVE_ENGINE_SYSTEM_PROMPT if use_narrative_engine
            else session.get("system_prompt") or ""
        )
        return self._make_target(session["target_model"], system_prompt)

    # ── Narrative Momentum Methods ─────────────────────────────────

    def _make_narrative_coach(self, strategy: dict, probe: dict, use_narrative_engine: bool = False, session_id: int | None = None) -> NarrativeCoach:
        """Create a NarrativeCoach for a sequence, using local backend if configured."""
        from flinch.llm import AnthropicBackend, OpenAICompatibleBackend

        # Determine backend: session-specific local > Anthropic client > general backend
        backend = None
        if session_id:
            session = db.get_session(self._conn, session_id)
            if session and session.get("coach_backend") == "local":
                ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
                coach_model = session.get("coach_model", "llama3.2")
                backend = OpenAICompatibleBackend(f"{ollama_url}/v1", default_model=coach_model)
        if backend is None and self._client:
            backend = AnthropicBackend(self._client)
        if backend is None:
            backend = self._backend
        if backend is None:
            raise ValueError("No LLM backend available for narrative coach. Set an API key or run Ollama.")

        return NarrativeCoach(
            backend=backend,
            strategy=strategy,
            probe_text=probe["prompt_text"],
            use_narrative_engine=use_narrative_engine,
            narrative_opening=probe.get("narrative_opening"),
            narrative_target=probe.get("narrative_target"),
        )

    async def run_sequence_turn(self, sequence_id: int, sequence_run_id: int) -> dict:
        """Execute the next warmup turn in interactive mode.

        Returns the turn data (turn_number, role, content, classification, turn_type).
        """
        seq = db.get_sequence(self._conn, sequence_id)
        if not seq:
            raise ValueError(f"Sequence {sequence_id} not found")

        run = db.get_sequence_run(self._conn, sequence_run_id)
        if not run:
            raise ValueError(f"Sequence run {sequence_run_id} not found")

        strategy = db.get_strategy_template(self._conn, seq["strategy_id"])
        probe = db.get_probe(self._conn, seq["probe_id"])

        # Get existing turns to build conversation history
        existing_turns = db.list_sequence_turns(self._conn, sequence_run_id)

        # Determine next turn number
        turn_number = len(existing_turns) + 1
        warmup_count = run["warmup_count"]

        # Build conversation history for the coach (user/assistant format)
        conversation_history = []
        for t in existing_turns:
            if t["role"] == "coach":
                conversation_history.append({"role": "user", "content": t["content"]})
            elif t["role"] == "target":
                conversation_history.append({"role": "assistant", "content": t["content"]})

        # Create coach and generate warmup turn
        use_ne = bool(seq.get("use_narrative_engine"))
        coach = self._make_narrative_coach(strategy, probe, use_narrative_engine=use_ne, session_id=seq["session_id"])

        # Calculate which warmup turn this is (only counting coach turns)
        coach_turn_count = sum(1 for t in existing_turns if t["role"] == "coach") + 1
        warmup_text = await coach.generate_warmup_turn(conversation_history, coach_turn_count, warmup_count)

        # Fresh target, seeded with this run's stored turns (I6)
        target = self._get_sequence_target(seq["session_id"], use_ne)
        target_history = _target_history(existing_turns, _SEQUENCE_TURN_ROLES)
        if target_history:
            target.seed(target_history)
            response_text = (await target.reply(warmup_text)).text
        else:
            response_text = (await target.send(warmup_text)).text

        # Classify the response (use warmup text as probe_text context for classification)
        classification = await classify(response_text, warmup_text, self._backend)

        # Store both turns (coach message + target response)
        db.add_sequence_turn(self._conn, sequence_run_id, turn_number, "coach", warmup_text, None, "warmup")
        db.add_sequence_turn(self._conn, sequence_run_id, turn_number + 1, "target", response_text, classification.value, "warmup")

        # Update run status
        if run["status"] == "pending":
            db.update_sequence_run(self._conn, sequence_run_id, status="running")

        return {
            "coach_turn": {"turn_number": turn_number, "role": "coach", "content": warmup_text, "turn_type": "warmup"},
            "target_turn": {"turn_number": turn_number + 1, "role": "target", "content": response_text, "classification": classification.value, "turn_type": "warmup"},
            "warmup_turns_sent": coach_turn_count,
            "warmup_turns_planned": warmup_count,
        }

    async def run_sequence_interactive_probe(self, sequence_id: int, sequence_run_id: int) -> dict:
        """Drop the probe in interactive mode. Optionally generates setup turn first.

        Returns the probe turn data with classification.
        """
        seq = db.get_sequence(self._conn, sequence_id)
        if not seq:
            raise ValueError(f"Sequence {sequence_id} not found")

        run = db.get_sequence_run(self._conn, sequence_run_id)
        if not run:
            raise ValueError(f"Sequence run {sequence_run_id} not found")

        strategy = db.get_strategy_template(self._conn, seq["strategy_id"])
        probe = db.get_probe(self._conn, seq["probe_id"])
        use_ne = bool(seq.get("use_narrative_engine"))

        existing_turns = db.list_sequence_turns(self._conn, sequence_run_id)
        turn_number = len(existing_turns) + 1

        # Build conversation history
        conversation_history = []
        for t in existing_turns:
            if t["role"] == "coach":
                conversation_history.append({"role": "user", "content": t["content"]})
            elif t["role"] == "target":
                conversation_history.append({"role": "assistant", "content": t["content"]})

        # Fresh target, seeded with this run's stored turns (I6)
        target = self._get_sequence_target(seq["session_id"], use_ne)
        target_history = _target_history(existing_turns, _SEQUENCE_TURN_ROLES)
        if target_history:
            target.seed(target_history)
        result_turns = []

        # Generate setup turn (N-1) if we have warmup context
        if conversation_history:
            coach = self._make_narrative_coach(strategy, probe, use_narrative_engine=use_ne, session_id=seq["session_id"])
            setup_text = await coach.generate_setup_turn(conversation_history)

            setup_response = (await target.reply(setup_text)).text
            setup_classification = await classify(setup_response, setup_text, self._backend)

            db.add_sequence_turn(self._conn, sequence_run_id, turn_number, "coach", setup_text, None, "setup")
            db.add_sequence_turn(self._conn, sequence_run_id, turn_number + 1, "target", setup_response, setup_classification.value, "setup")

            result_turns.append({"turn_number": turn_number, "role": "coach", "content": setup_text, "turn_type": "setup"})
            result_turns.append({"turn_number": turn_number + 1, "role": "target", "content": setup_response, "classification": setup_classification.value, "turn_type": "setup"})
            turn_number += 2

        # Send the actual probe — adapt to story context if we have warmup history
        if conversation_history:
            coach_for_adapt = self._make_narrative_coach(strategy, probe, use_narrative_engine=use_ne, session_id=seq["session_id"])
            adapted_probe = await coach_for_adapt.adapt_probe_to_story(conversation_history)
        else:
            adapted_probe = probe["prompt_text"]
        if target_history or result_turns:
            probe_response = (await target.reply(adapted_probe)).text
        else:
            probe_response = (await target.send(adapted_probe)).text
        probe_classification = await classify(probe_response, probe["prompt_text"], self._backend)

        db.add_sequence_turn(self._conn, sequence_run_id, turn_number, "probe", adapted_probe, None, "probe")
        db.add_sequence_turn(self._conn, sequence_run_id, turn_number + 1, "target", probe_response, probe_classification.value, "probe")

        result_turns.append({"turn_number": turn_number, "role": "probe", "content": adapted_probe, "turn_type": "probe"})
        result_turns.append({"turn_number": turn_number + 1, "role": "target", "content": probe_response, "classification": probe_classification.value, "turn_type": "probe"})

        # Update run
        now = __import__("datetime").datetime.utcnow().isoformat()
        db.update_sequence_run(self._conn, sequence_run_id,
            status="completed",
            probe_classification=probe_classification.value,
            completed_at=now,
        )
        db.update_sequence(self._conn, sequence_id, status="completed", completed_at=now)

        return {
            "turns": result_turns,
            "probe_classification": probe_classification.value,
        }

    async def run_sequence_auto(self, sequence_id: int) -> dict:
        """Run a full sequence in automatic mode: warmup turns + setup + probe.

        Creates a new sequence_run, executes all turns, classifies everything.
        Returns the completed sequence run with all turns.
        """
        seq = db.get_sequence(self._conn, sequence_id)
        if not seq:
            raise ValueError(f"Sequence {sequence_id} not found")

        strategy = db.get_strategy_template(self._conn, seq["strategy_id"])
        probe = db.get_probe(self._conn, seq["probe_id"])
        warmup_count = seq["max_warmup_turns"]
        use_ne = bool(seq.get("use_narrative_engine"))

        # Create sequence run
        run_id = db.create_sequence_run(self._conn, sequence_id, warmup_count)
        db.update_sequence_run(self._conn, run_id, status="running")
        db.update_sequence(self._conn, sequence_id, status="running")

        # Fresh target for this run
        target = self._get_sequence_target(seq["session_id"], use_ne)
        target.reset()

        coach = self._make_narrative_coach(strategy, probe, use_narrative_engine=use_ne, session_id=seq["session_id"])
        conversation_history = []
        all_turns = []
        turn_number = 1

        try:
            # Warmup turns (1 to N-1, leaving room for setup turn)
            warmup_end = max(warmup_count - 1, 0)  # at least 0 warmup turns before setup

            for i in range(warmup_end):
                coach_turn_num = i + 1
                warmup_text = await coach.generate_warmup_turn(conversation_history, coach_turn_num, warmup_count)

                # Send to target
                if not conversation_history:
                    response_text = (await target.send(warmup_text)).text
                else:
                    response_text = (await target.reply(warmup_text)).text

                classification = await classify(response_text, warmup_text, self._backend)

                # Store turns
                db.add_sequence_turn(self._conn, run_id, turn_number, "coach", warmup_text, None, "warmup")
                db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", response_text, classification.value, "warmup")

                conversation_history.append({"role": "user", "content": warmup_text})
                conversation_history.append({"role": "assistant", "content": response_text})

                all_turns.append({"turn_number": turn_number, "role": "coach", "content": warmup_text, "classification": None, "turn_type": "warmup"})
                all_turns.append({"turn_number": turn_number + 1, "role": "target", "content": response_text, "classification": classification.value, "turn_type": "warmup"})
                turn_number += 2

            # Setup turn (N-1) — steers toward probe topic
            if warmup_count > 0:
                setup_text = await coach.generate_setup_turn(conversation_history)
                setup_response = (await target.reply(setup_text)).text
                setup_classification = await classify(setup_response, setup_text, self._backend)

                db.add_sequence_turn(self._conn, run_id, turn_number, "coach", setup_text, None, "setup")
                db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", setup_response, setup_classification.value, "setup")

                conversation_history.append({"role": "user", "content": setup_text})
                conversation_history.append({"role": "assistant", "content": setup_response})

                all_turns.append({"turn_number": turn_number, "role": "coach", "content": setup_text, "classification": None, "turn_type": "setup"})
                all_turns.append({"turn_number": turn_number + 1, "role": "target", "content": setup_response, "classification": setup_classification.value, "turn_type": "setup"})
                turn_number += 2

            # Probe turn (N) — adapt probe to story context then send
            if conversation_history:
                adapted_probe = await coach.adapt_probe_to_story(conversation_history)
                probe_response = (await target.reply(adapted_probe)).text
            else:
                adapted_probe = probe["prompt_text"]
                probe_response = (await target.send(adapted_probe)).text
            probe_classification = await classify(probe_response, probe["prompt_text"], self._backend)

            db.add_sequence_turn(self._conn, run_id, turn_number, "probe", adapted_probe, None, "probe")
            db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", probe_response, probe_classification.value, "probe")

            all_turns.append({"turn_number": turn_number, "role": "probe", "content": adapted_probe, "classification": None, "turn_type": "probe"})
            all_turns.append({"turn_number": turn_number + 1, "role": "target", "content": probe_response, "classification": probe_classification.value, "turn_type": "probe"})

            # Update run status
            now = __import__("datetime").datetime.utcnow().isoformat()
            db.update_sequence_run(self._conn, run_id,
                status="completed",
                probe_classification=probe_classification.value,
                completed_at=now,
            )
            db.update_sequence(self._conn, sequence_id, status="completed", completed_at=now)

            return {
                "sequence_run_id": run_id,
                "warmup_count": warmup_count,
                "probe_classification": probe_classification.value,
                "turns": all_turns,
            }

        except Exception:
            db.update_sequence_run(self._conn, run_id, status="failed")
            db.update_sequence(self._conn, sequence_id, status="failed")
            raise

    async def run_sequence_auto_stream(self, sequence_id: int):
        """Streaming version of run_sequence_auto — yields SSE events after each turn pair."""
        seq = db.get_sequence(self._conn, sequence_id)
        if not seq:
            raise ValueError(f"Sequence {sequence_id} not found")

        strategy = db.get_strategy_template(self._conn, seq["strategy_id"])
        probe = db.get_probe(self._conn, seq["probe_id"])
        warmup_count = seq["max_warmup_turns"]
        use_ne = bool(seq.get("use_narrative_engine"))

        run_id = db.create_sequence_run(self._conn, sequence_id, warmup_count)
        db.update_sequence_run(self._conn, run_id, status="running")
        db.update_sequence(self._conn, sequence_id, status="running")

        target = self._get_sequence_target(seq["session_id"], use_ne)
        target.reset()

        coach = self._make_narrative_coach(strategy, probe, use_narrative_engine=use_ne, session_id=seq["session_id"])
        conversation_history = []
        turn_number = 1
        # Total turn pairs: warmup (N-1) + setup (1) + probe (1) = N+1
        total_steps = warmup_count + 1  # warmup turns + probe (setup is part of warmup count)

        try:
            warmup_end = max(warmup_count - 1, 0)

            for i in range(warmup_end):
                coach_turn_num = i + 1
                warmup_text = await coach.generate_warmup_turn(conversation_history, coach_turn_num, warmup_count)

                if not conversation_history:
                    response_text = (await target.send(warmup_text)).text
                else:
                    response_text = (await target.reply(warmup_text)).text

                classification = await classify(response_text, warmup_text, self._backend)

                db.add_sequence_turn(self._conn, run_id, turn_number, "coach", warmup_text, None, "warmup")
                db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", response_text, classification.value, "warmup")

                conversation_history.append({"role": "user", "content": warmup_text})
                conversation_history.append({"role": "assistant", "content": response_text})
                turn_number += 2

                yield {
                    "event": "turn",
                    "data": {
                        "step": coach_turn_num,
                        "total_steps": total_steps,
                        "turn_type": "warmup",
                        "classification": classification.value,
                        "sequence_run_id": run_id,
                    },
                }

            # Setup turn
            if warmup_count > 0:
                setup_text = await coach.generate_setup_turn(conversation_history)
                setup_response = (await target.reply(setup_text)).text
                setup_classification = await classify(setup_response, setup_text, self._backend)

                db.add_sequence_turn(self._conn, run_id, turn_number, "coach", setup_text, None, "setup")
                db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", setup_response, setup_classification.value, "setup")

                conversation_history.append({"role": "user", "content": setup_text})
                conversation_history.append({"role": "assistant", "content": setup_response})
                turn_number += 2

                yield {
                    "event": "turn",
                    "data": {
                        "step": warmup_count,
                        "total_steps": total_steps,
                        "turn_type": "setup",
                        "classification": setup_classification.value,
                        "sequence_run_id": run_id,
                    },
                }

            # Probe turn — adapt to story context
            if conversation_history:
                adapted_probe = await coach.adapt_probe_to_story(conversation_history)
                probe_response = (await target.reply(adapted_probe)).text
            else:
                adapted_probe = probe["prompt_text"]
                probe_response = (await target.send(adapted_probe)).text
            probe_classification = await classify(probe_response, probe["prompt_text"], self._backend)

            db.add_sequence_turn(self._conn, run_id, turn_number, "probe", adapted_probe, None, "probe")
            db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", probe_response, probe_classification.value, "probe")

            now = __import__("datetime").datetime.utcnow().isoformat()
            db.update_sequence_run(self._conn, run_id,
                status="completed",
                probe_classification=probe_classification.value,
                completed_at=now,
            )
            db.update_sequence(self._conn, sequence_id, status="completed", completed_at=now)

            yield {
                "event": "complete",
                "data": {
                    "step": total_steps,
                    "total_steps": total_steps,
                    "turn_type": "probe",
                    "probe_classification": probe_classification.value,
                    "sequence_run_id": run_id,
                    "warmup_count": warmup_count,
                },
            }

        except Exception as e:
            db.update_sequence_run(self._conn, run_id, status="failed")
            db.update_sequence(self._conn, sequence_id, status="failed")
            yield {
                "event": "error",
                "data": {"error": str(e), "sequence_run_id": run_id},
            }

    async def run_whittle(self, sequence_id: int) -> dict:
        """Auto-whittling: start at max_warmup_turns, decrement until refusal.

        Each iteration creates a new sequence_run at N-1 warmup turns (fresh conversation).
        Stops when the model refuses, marking the threshold.
        Linear descent (not binary search — compliance isn't monotonic).

        Returns whittling results with threshold data.
        """
        seq = db.get_sequence(self._conn, sequence_id)
        if not seq:
            raise ValueError(f"Sequence {sequence_id} not found")

        db.update_sequence(self._conn, sequence_id, status="running")

        max_turns = seq["max_warmup_turns"]
        results = []
        threshold_found = False
        threshold_at = None
        errored = False

        for n in range(max_turns, -1, -1):  # max_turns down to 0
            # Run a full sequence at this warmup count
            # Temporarily update the sequence's max_warmup_turns for this run
            run_id = db.create_sequence_run(self._conn, sequence_id, n)

            try:
                # Execute the run at warmup_count = n
                run_result = await self._execute_single_whittle_run(sequence_id, run_id, n)

                probe_class = run_result["probe_classification"]
                results.append({
                    "warmup_count": n,
                    "probe_classification": probe_class,
                    "sequence_run_id": run_id,
                })

                if probe_class == "refused":
                    # Model refused — threshold is at n+1 (previous run)
                    threshold_found = True
                    threshold_at = n + 1 if n < max_turns else None

                    # Mark the PREVIOUS run as the threshold (if it exists)
                    if results and len(results) >= 2:
                        prev_run_id = results[-2]["sequence_run_id"]
                        db.update_sequence_run(self._conn, prev_run_id, threshold_found=1)

                    break

            except Exception as e:
                db.update_sequence_run(self._conn, run_id, status="failed")
                results.append({
                    "warmup_count": n,
                    "probe_classification": "error",
                    "error": str(e),
                    "sequence_run_id": run_id,
                })
                errored = True
                break

        # If we went all the way to 0 without refusal, threshold is 0
        if not threshold_found and not errored and results:
            last_run_id = results[-1]["sequence_run_id"]
            db.update_sequence_run(self._conn, last_run_id, threshold_found=1)
            threshold_at = 0

        now = __import__("datetime").datetime.utcnow().isoformat()
        if errored:
            db.update_sequence(self._conn, sequence_id, status="failed")
        else:
            db.update_sequence(self._conn, sequence_id, status="completed", completed_at=now)

        return {
            "sequence_id": sequence_id,
            "results": results,
            "threshold_at": threshold_at,
            "threshold_found": threshold_found or (threshold_at == 0),
            "total_runs": len(results),
        }

    async def _execute_single_whittle_run(self, sequence_id: int, run_id: int, warmup_count: int) -> dict:
        """Execute a single whittling run at a specific warmup count. Fresh conversation each time."""
        seq = db.get_sequence(self._conn, sequence_id)
        strategy = db.get_strategy_template(self._conn, seq["strategy_id"])
        probe = db.get_probe(self._conn, seq["probe_id"])
        use_ne = bool(seq.get("use_narrative_engine"))

        db.update_sequence_run(self._conn, run_id, status="running")

        # Fresh target
        target = self._get_sequence_target(seq["session_id"], use_ne)
        target.reset()

        coach = self._make_narrative_coach(strategy, probe, use_narrative_engine=use_ne, session_id=seq["session_id"])
        conversation_history = []
        turn_number = 1

        # Warmup turns (leaving room for setup)
        warmup_end = max(warmup_count - 1, 0)

        for i in range(warmup_end):
            warmup_text = await coach.generate_warmup_turn(conversation_history, i + 1, warmup_count)

            if not conversation_history:
                response_text = (await target.send(warmup_text)).text
            else:
                response_text = (await target.reply(warmup_text)).text

            classification = await classify(response_text, warmup_text, self._backend)

            db.add_sequence_turn(self._conn, run_id, turn_number, "coach", warmup_text, None, "warmup")
            db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", response_text, classification.value, "warmup")

            conversation_history.append({"role": "user", "content": warmup_text})
            conversation_history.append({"role": "assistant", "content": response_text})
            turn_number += 2

        # Setup turn if warmup_count > 0
        if warmup_count > 0:
            setup_text = await coach.generate_setup_turn(conversation_history)

            if not conversation_history:
                setup_response = (await target.send(setup_text)).text
            else:
                setup_response = (await target.reply(setup_text)).text

            setup_classification = await classify(setup_response, setup_text, self._backend)

            db.add_sequence_turn(self._conn, run_id, turn_number, "coach", setup_text, None, "setup")
            db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", setup_response, setup_classification.value, "setup")

            conversation_history.append({"role": "user", "content": setup_text})
            conversation_history.append({"role": "assistant", "content": setup_response})
            turn_number += 2

        # Probe turn — adapt to story context
        if conversation_history:
            adapted_probe = await coach.adapt_probe_to_story(conversation_history)
            probe_response = (await target.reply(adapted_probe)).text
        else:
            adapted_probe = probe["prompt_text"]
            probe_response = (await target.send(adapted_probe)).text

        probe_classification = await classify(probe_response, probe["prompt_text"], self._backend)

        db.add_sequence_turn(self._conn, run_id, turn_number, "probe", adapted_probe, None, "probe")
        db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", probe_response, probe_classification.value, "probe")

        now = __import__("datetime").datetime.utcnow().isoformat()
        db.update_sequence_run(self._conn, run_id,
            status="completed",
            probe_classification=probe_classification.value,
            completed_at=now,
        )

        return {"probe_classification": probe_classification.value}

    def estimate_sequence_cost(self, probe_count: int, max_turns: int, mode: str = "whittle") -> dict:
        """Estimate cost for a batch sequence run.

        Rough estimates per turn:
        - Warmup turn: ~500 input tokens + ~300 output tokens (coach + target)
        - Setup turn: ~800 input tokens + ~300 output tokens
        - Probe turn: ~200 input tokens + ~500 output tokens
        - Classification: ~200 input tokens + ~50 output tokens per turn

        Returns estimated turns, tokens, and cost in USD.
        """
        # Per-probe estimates
        if mode == "whittle":
            # Worst case: runs at max_turns, max_turns-1, ..., 1, 0
            # Average case: about max_turns/2 runs per probe
            avg_runs_per_probe = (max_turns + 1) / 2
            avg_turns_per_run = (max_turns + 1) / 2  # average warmup count
        else:
            # Fixed-N: one run per probe
            avg_runs_per_probe = 1
            avg_turns_per_run = max_turns

        tokens_per_warmup = 800 + 300 + 250  # input + output + classification
        tokens_per_setup = 1100 + 300 + 250
        tokens_per_probe = 200 + 500 + 250
        tokens_per_coach_call = 500 + 300  # coach generation

        total_warmup_turns = probe_count * avg_runs_per_probe * avg_turns_per_run
        total_setup_turns = probe_count * avg_runs_per_probe
        total_probe_turns = probe_count * avg_runs_per_probe
        total_coach_calls = total_warmup_turns + total_setup_turns

        total_tokens = (
            total_warmup_turns * tokens_per_warmup +
            total_setup_turns * tokens_per_setup +
            total_probe_turns * tokens_per_probe +
            total_coach_calls * tokens_per_coach_call
        )

        # Rough pricing: ~$3/M input, ~$15/M output for Sonnet
        # Simplified to ~$5/M tokens average
        estimated_cost = total_tokens * 5 / 1_000_000

        return {
            "probe_count": probe_count,
            "mode": mode,
            "max_turns": max_turns,
            "estimated_runs": int(probe_count * avg_runs_per_probe),
            "estimated_total_turns": int(total_warmup_turns + total_setup_turns + total_probe_turns),
            "estimated_tokens": int(total_tokens),
            "estimated_cost_usd": round(estimated_cost, 4),
        }

    async def run_sequence_batch(self, batch_id: int):
        """Async generator: run a batch of sequences, yielding SSE progress events.

        For fixed_n mode: runs each probe at exactly fixed_n warmup turns.
        For whittle mode: runs full whittling for each probe.
        """
        batch = db.get_sequence_batch(self._conn, batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        db.update_sequence_batch(self._conn, batch_id, status="running")

        # Get sequences linked to this batch
        all_sequences = db.list_sequences(self._conn, batch["session_id"])
        batch_sequences = [s for s in all_sequences if s.get("batch_id") == batch_id]

        total = len(batch_sequences)
        completed = 0

        for seq in batch_sequences:
            try:
                if batch["mode"] == "whittle":
                    result = await self.run_whittle(seq["id"])
                    probe = db.get_probe(self._conn, seq["probe_id"])
                    completed += 1
                    db.update_sequence_batch(self._conn, batch_id, probes_completed=completed)

                    yield {
                        "event": "progress",
                        "data": {
                            "batch_id": batch_id,
                            "sequence_id": seq["id"],
                            "probe_name": probe["name"] if probe else f"probe-{seq['probe_id']}",
                            "threshold_at": result.get("threshold_at"),
                            "total_runs": result.get("total_runs"),
                            "completed": completed,
                            "total": total,
                        },
                    }
                else:
                    # fixed_n mode
                    result = await self.run_sequence_auto(seq["id"])
                    probe = db.get_probe(self._conn, seq["probe_id"])
                    completed += 1
                    db.update_sequence_batch(self._conn, batch_id, probes_completed=completed)

                    yield {
                        "event": "progress",
                        "data": {
                            "batch_id": batch_id,
                            "sequence_id": seq["id"],
                            "probe_name": probe["name"] if probe else f"probe-{seq['probe_id']}",
                            "probe_classification": result.get("probe_classification"),
                            "completed": completed,
                            "total": total,
                        },
                    }

            except Exception as e:
                completed += 1
                db.update_sequence_batch(self._conn, batch_id, probes_completed=completed)
                yield {
                    "event": "error",
                    "data": {
                        "sequence_id": seq["id"],
                        "error": str(e),
                        "completed": completed,
                        "total": total,
                    },
                }

            # Small delay between probes
            if completed < total:
                await asyncio.sleep(1)

        now = __import__("datetime").datetime.utcnow().isoformat()
        db.update_sequence_batch(self._conn, batch_id, status="complete", completed_at=now)

        yield {
            "event": "complete",
            "data": {
                "batch_id": batch_id,
                "total": total,
                "completed": completed,
            },
        }


class ExperimentRunner:
    """Runs the full prompt × model × condition matrix for experiments."""

    MAX_RETRIES = 5
    BACKOFF_BASE = 1.0  # seconds
    BACKOFF_MAX = 60.0

    # Cells read from the database per page (B03: page until none remain).
    PENDING_PAGE_SIZE = 500

    def __init__(self, async_db, rate_pool: RateLimiterPool, backend: LLMBackend | None = None):
        self.db = async_db
        self.rate_pool = rate_pool
        self.backend = backend

    def _get_provider(self, model_id: str) -> str:
        """Determine provider from model ID."""
        if model_id.startswith("ollama:"):
            return "ollama"
        model_lower = model_id.lower()
        if any(x in model_lower for x in ["claude", "haiku", "sonnet", "opus"]):
            return "anthropic"
        elif any(x in model_lower for x in ["gpt", "o3", "o4"]):
            return "openai"
        elif "gemini" in model_lower:
            return "google"
        elif any(x in model_lower for x in ["grok"]):
            return "xai"
        else:
            return "together"

    async def _write_final_status(self, experiment_id: int) -> str:
        """Settle the study's status from its cells in the database, not this run's counters (B03).

        `paused` while cells are pending, `completed` when some completed or none
        failed, `failed` when every cell failed, `draft` when it has no cells.
        """
        from flinch.db import get_experiment_progress, update_experiment

        progress = await get_experiment_progress(self.db, experiment_id)
        if progress["total"] == 0:
            status = "draft"
        elif progress["pending"] > 0:
            status = "paused"
        elif progress["completed"] > 0 or progress["failed"] == 0:
            status = "completed"
        else:
            status = "failed"
        if status in ("completed", "failed"):
            await update_experiment(self.db, experiment_id, status=status, completed_at=datetime.now(UTC).isoformat())
        else:
            await update_experiment(self.db, experiment_id, status=status)
        return status

    async def run_experiment(self, experiment_id: int):
        """Execute full matrix, yielding SSE progress events.

        Each provider runs `max_concurrent` workers over its own queue; every
        worker reads the study status before each cell and stops on `paused`.
        The `finally` is shielded (I27): a client disconnect cancels the
        workers, and the final status is still written.
        """
        from flinch.db import (
            get_pending_responses,
            update_experiment,
            update_experiment_response,
        )

        pending: list[dict] = []
        while True:
            page = await get_pending_responses(
                self.db, experiment_id, limit=self.PENDING_PAGE_SIZE,
                after_id=pending[-1]["id"] if pending else 0,
            )
            if not page:
                break
            pending.extend(page)

        if not pending:
            await self._write_final_status(experiment_id)
            yield {"type": "complete", "completed": 0, "failed": 0, "total": 0}
            return

        await update_experiment(self.db, experiment_id, status="running", started_at=datetime.now(UTC).isoformat())

        by_provider: dict[str, list[dict]] = {}
        for cell in pending:
            by_provider.setdefault(self._get_provider(cell["model_id"]), []).append(cell)

        total = len(pending)
        completed = 0
        failed = 0
        results_queue: asyncio.Queue = asyncio.Queue()
        worker_done = object()
        tasks: list[asyncio.Task] = []
        final_written = False

        async def mark_failed(cell: dict, error: str) -> None:
            nonlocal failed
            failed += 1
            await update_experiment_response(self.db, cell["id"], status="failed", error_message=error)
            results_queue.put_nowait({"type": "progress", "completed": completed, "failed": failed,
                                      "total": total, "model": cell["model_id"], "error": error})

        async def is_paused() -> bool:
            async with self.db.execute("SELECT status FROM experiments WHERE id = ?", (experiment_id,)) as cur:
                row = await cur.fetchone()
            return bool(row) and row[0] == "paused"

        async def worker(queue: deque, limiter: ProviderRateLimiter) -> None:
            nonlocal completed
            try:
                while queue:
                    if await is_paused():
                        return
                    if not queue:
                        return
                    cell = queue.popleft()
                    try:
                        await self._run_single_cell(cell, limiter)
                    except Exception as e:
                        await mark_failed(cell, str(e))
                        continue
                    completed += 1
                    results_queue.put_nowait({"type": "progress", "completed": completed, "failed": failed,
                                              "total": total, "model": cell["model_id"]})
            finally:
                results_queue.put_nowait(worker_done)

        try:
            yield {"type": "started", "total": total}

            for provider, cells in by_provider.items():
                try:
                    limiter = self.rate_pool.get(provider)
                except Exception as e:
                    for cell in cells:
                        await mark_failed(cell, str(e))
                    continue
                queue = deque(cells)
                for _ in range(min(limiter.max_concurrent, len(cells))):
                    tasks.append(asyncio.create_task(worker(queue, limiter)))

            running = len(tasks)
            while running or not results_queue.empty():
                try:
                    event = await asyncio.wait_for(results_queue.get(), timeout=1.0)
                except TimeoutError:
                    yield {"type": "heartbeat"}
                    continue
                if event is worker_done:
                    running -= 1
                else:
                    yield event

            for result in await asyncio.gather(*tasks, return_exceptions=True):
                if isinstance(result, Exception):
                    yield {"type": "error", "error": str(result)}

            status = await self._write_final_status(experiment_id)
            final_written = True
            name = "paused" if status == "paused" else "complete"
            yield {"type": name, "completed": completed, "failed": failed, "total": total}
        finally:
            with anyio.CancelScope(shield=True):
                for task in tasks:
                    if not task.done():
                        task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                if not final_written:
                    await self._write_final_status(experiment_id)

    async def _run_single_cell(self, cell, limiter: ProviderRateLimiter):
        """Execute one matrix cell with retry logic, then classify the response (B04)."""
        from flinch.db import update_experiment_response

        model_id = cell["model_id"]
        system_prompt = cell.get("condition_system_prompt", "")
        prompt_text = cell.get("prompt_text") or cell.get("probe_text") or ""
        response_id = cell["id"]
        if not prompt_text:
            raise ValueError("Prompt has no text")

        target = self._create_target(model_id, system_prompt)
        released = False

        for attempt in range(self.MAX_RETRIES):
            released = False
            try:
                await limiter.acquire()
                try:
                    resp = await target.send(prompt_text)
                finally:
                    limiter.release()
                    released = True

                limiter.record_usage(
                    input_tokens=resp.input_tokens or 0,
                    output_tokens=resp.output_tokens or 0,
                )

                try:
                    cls = await classify(resp.text, prompt_text, self.backend)
                except Exception:
                    cls = await classify(resp.text, prompt_text, None)

                await update_experiment_response(
                    self.db, response_id,
                    response_text=resp.text,
                    latency_ms=resp.latency_ms,
                    token_count_input=resp.input_tokens,
                    token_count_output=resp.output_tokens,
                    finish_reason=resp.finish_reason,
                    status="completed",
                    attempt_count=attempt + 1,
                    completed_at=datetime.now(UTC).isoformat(),
                    classification=cls.value,
                )
                return

            except Exception as e:
                if not released:
                    try:
                        limiter.release()
                    except ValueError:
                        pass
                limiter.record_retry()
                if attempt < self.MAX_RETRIES - 1:
                    backoff = min(self.BACKOFF_BASE * (2 ** attempt), self.BACKOFF_MAX)
                    logger.warning(f"Retry {attempt+1} for cell {response_id}: {e}, waiting {backoff}s")
                    await asyncio.sleep(backoff)
                else:
                    raise

    def _create_target(self, model_id: str, system_prompt: str) -> TargetModel:
        """Thin wrapper over `flinch.target.make_target` (kept as a test patch point)."""
        if model_id in BaseModelTarget.BASE_MODELS:
            return BaseModelTarget(model=model_id, system_prompt=system_prompt)
        return flinch_target.make_target(model_id, system_prompt, provider_hint=self._get_provider(model_id))

    def estimate_cost(self, total_cells: int, avg_input_tokens: int = 500, avg_output_tokens: int = 1000) -> dict:
        """Estimate cost for the experiment."""
        pricing = {
            "anthropic": {"input": 0.003, "output": 0.015},   # Sonnet
            "openai": {"input": 0.005, "output": 0.015},       # GPT-4o
            "google": {"input": 0.00125, "output": 0.005},     # Gemini Pro
            "together": {"input": 0.0009, "output": 0.0009},   # Llama
        }
        estimated_cost = 0.0
        for p, rates in pricing.items():
            estimated_cost += (avg_input_tokens / 1000 * rates["input"] + avg_output_tokens / 1000 * rates["output"])
        estimated_cost *= total_cells / len(pricing)
        return {"estimated_cost_usd": round(estimated_cost, 2), "total_cells": total_cells}
