from __future__ import annotations
import asyncio
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
from flinch import db
from flinch.llm import LLMBackend
from flinch.models import Classification, PushbackSource, CoachSuggestion, PushbackMove
from flinch.target import TargetModel, ClaudeTarget, OpenAITarget, GeminiTarget
from flinch.classifier import classify
from flinch.coach import Coach, NarrativeCoach, NARRATIVE_ENGINE_SYSTEM_PROMPT


class Runner:
    def __init__(self, conn, client=None, backend: LLMBackend | None = None):
        self._conn = conn
        self._client = client  # Keep for ClaudeTarget backward compat
        self._backend = backend  # For classifier + coach
        self._targets: dict[int, TargetModel] = {}  # session_id -> target

    @property
    def backend(self) -> LLMBackend | None:
        return self._backend

    @property
    def client(self):
        return self._client

    def _make_target(self, model_name: str, system_prompt: str = "") -> TargetModel:
        """Factory: dispatch to correct target based on model name prefix."""
        if model_name.startswith("claude-"):
            if not self._client:
                raise ValueError(
                    "Anthropic API key required to test Claude models. "
                    "Set ANTHROPIC_API_KEY or choose a different target model."
                )
            return ClaudeTarget(model=model_name, client=self._client, system_prompt=system_prompt)
        elif model_name.startswith(("gpt-", "o1-", "o3-", "o4-", "chatgpt-")):
            return OpenAITarget(model_name, system_prompt=system_prompt)
        elif model_name.startswith("gemini-"):
            return GeminiTarget(model_name, system_prompt=system_prompt)
        elif model_name.startswith("grok-"):
            # xAI uses OpenAI-compatible API
            return OpenAITarget(
                model_name,
                system_prompt=system_prompt,
                api_key=os.environ.get("XAI_API_KEY"),
                base_url="https://api.x.ai/v1",
            )
        elif model_name.startswith("meta-llama/") or model_name.startswith("llama-"):
            # Together AI for Meta models
            return OpenAITarget(
                model_name,
                system_prompt=system_prompt,
                api_key=os.environ.get("TOGETHER_API_KEY"),
                base_url="https://api.together.xyz/v1",
            )
        elif model_name.startswith("ollama:"):
            # Ollama local models via OpenAI-compatible API
            ollama_model = model_name.removeprefix("ollama:")
            ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
            return OpenAITarget(
                ollama_model,
                system_prompt=system_prompt,
                api_key="ollama",  # dummy key required by openai SDK
                base_url=f"{ollama_url}/v1",
            )
        else:
            raise ValueError(
                f"Unknown model prefix for '{model_name}'. "
                "Supported: claude-*, gpt-*, o1-*, o3-*, o4-*, gemini-*, grok-*, meta-llama/*, ollama:*"
            )

    def _get_target(self, session_id: int) -> TargetModel:
        """Get or create a target model for a session."""
        if session_id not in self._targets:
            session = db.get_session(self._conn, session_id)
            if session is None:
                raise ValueError(f"Session {session_id} not found")
            self._targets[session_id] = self._make_target(
                session["target_model"],
                session.get("system_prompt", ""),
            )
        return self._targets[session_id]

    def _get_coach(self, session_id: int) -> Coach:
        """Create a coach for a session, using the configured backend provider."""
        from flinch.llm import AnthropicBackend, OpenAICompatibleBackend, get_backend_for_provider

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

        target = self._get_target(session_id)
        target.reset()  # Fresh conversation for each probe

        # Send probe
        response_text = await target.send(probe["prompt_text"])

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

        target = self._get_target(run["session_id"])

        # Send pushback in same conversation
        response_text = await target.reply(pushback_text)

        # Classify the response after pushback
        probe = db.get_probe(self._conn, run["probe_id"])
        classification = await classify(response_text, probe["prompt_text"], self._backend)

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

        target = self._get_target(run["session_id"])
        # Don't reset — continue the existing conversation
        response_text = await target.reply(text)

        probe = db.get_probe(self._conn, run["probe_id"])
        classification = await classify(response_text, probe["prompt_text"], self._backend)

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
        """Async generator that yields SSE events as each probe completes."""
        session = db.get_session(self._conn, session_id)
        if not session:
            raise ValueError("Session not found")

        batch_id = db.create_batch_run(self._conn, session_id, len(probe_ids), delay_ms)
        total = len(probe_ids)
        completed = 0
        failed = 0

        for probe_id in probe_ids:
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
            status="complete",
            probes_completed=completed,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        yield {
            "event": "complete",
            "data": {
                "batch_id": batch_id,
                "total": total,
                "completed": completed,
                "failed": failed,
            },
        }

    async def skip_pushback(self, run_id: int) -> dict:
        """Skip pushback for a run."""
        run = db.get_run(self._conn, run_id)
        if run is None:
            raise ValueError(f"Run {run_id} not found")

        db.update_run(self._conn, run_id, pushback_source=PushbackSource.SKIP.value)
        return db.get_run(self._conn, run_id)

    def _get_sequence_target(self, session_id: int, use_narrative_engine: bool) -> "TargetModel":
        """Get a target for a sequence, optionally with narrative engine system prompt."""
        if use_narrative_engine:
            session = db.get_session(self._conn, session_id)
            if session is None:
                raise ValueError(f"Session {session_id} not found")
            return self._make_target(session["target_model"], NARRATIVE_ENGINE_SYSTEM_PROMPT)
        return self._get_target(session_id)

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
        session = db.get_session(self._conn, seq["session_id"])

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

        # Get or create target (fresh for first turn)
        target = self._get_sequence_target(seq["session_id"], use_ne)
        if not existing_turns:
            target.reset()

        # Send warmup to target
        if not existing_turns:
            response_text = await target.send(warmup_text)
        else:
            response_text = await target.reply(warmup_text)

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

        target = self._get_sequence_target(seq["session_id"], use_ne)
        result_turns = []

        # Generate setup turn (N-1) if we have warmup context
        if conversation_history:
            coach = self._make_narrative_coach(strategy, probe, use_narrative_engine=use_ne, session_id=seq["session_id"])
            setup_text = await coach.generate_setup_turn(conversation_history)

            setup_response = await target.reply(setup_text)
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
        probe_response = await target.reply(adapted_probe)
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
        session = db.get_session(self._conn, seq["session_id"])
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
                    response_text = await target.send(warmup_text)
                else:
                    response_text = await target.reply(warmup_text)

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
                setup_response = await target.reply(setup_text)
                setup_classification = await classify(setup_response, setup_text, self._backend)

                db.add_sequence_turn(self._conn, run_id, turn_number, "coach", setup_text, None, "setup")
                db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", setup_response, setup_classification.value, "setup")

                conversation_history.append({"role": "user", "content": setup_text})
                conversation_history.append({"role": "assistant", "content": setup_response})

                all_turns.append({"turn_number": turn_number, "role": "coach", "content": setup_text, "classification": None, "turn_type": "setup"})
                all_turns.append({"turn_number": turn_number + 1, "role": "target", "content": setup_response, "classification": setup_classification.value, "turn_type": "setup"})
                turn_number += 2

            # Probe turn (N) — adapt probe to story context then send
            adapted_probe = await coach.adapt_probe_to_story(conversation_history)
            probe_response = await target.reply(adapted_probe)
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

            return {
                "sequence_run_id": run_id,
                "warmup_count": warmup_count,
                "probe_classification": probe_classification.value,
                "turns": all_turns,
            }

        except Exception as e:
            db.update_sequence_run(self._conn, run_id, status="failed")
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
                    response_text = await target.send(warmup_text)
                else:
                    response_text = await target.reply(warmup_text)

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
                setup_response = await target.reply(setup_text)
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
            adapted_probe = await coach.adapt_probe_to_story(conversation_history)
            probe_response = await target.reply(adapted_probe)
            probe_classification = await classify(probe_response, probe["prompt_text"], self._backend)

            db.add_sequence_turn(self._conn, run_id, turn_number, "probe", adapted_probe, None, "probe")
            db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", probe_response, probe_classification.value, "probe")

            now = __import__("datetime").datetime.utcnow().isoformat()
            db.update_sequence_run(self._conn, run_id,
                status="completed",
                probe_classification=probe_classification.value,
                completed_at=now,
            )

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
                })
                break

        # If we went all the way to 0 without refusal, threshold is 0
        if not threshold_found and results:
            last_run_id = results[-1]["sequence_run_id"]
            db.update_sequence_run(self._conn, last_run_id, threshold_found=1)
            threshold_at = 0

        now = __import__("datetime").datetime.utcnow().isoformat()
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
                response_text = await target.send(warmup_text)
            else:
                response_text = await target.reply(warmup_text)

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
                setup_response = await target.send(setup_text)
            else:
                setup_response = await target.reply(setup_text)

            setup_classification = await classify(setup_response, setup_text, self._backend)

            db.add_sequence_turn(self._conn, run_id, turn_number, "coach", setup_text, None, "setup")
            db.add_sequence_turn(self._conn, run_id, turn_number + 1, "target", setup_response, setup_classification.value, "setup")

            conversation_history.append({"role": "user", "content": setup_text})
            conversation_history.append({"role": "assistant", "content": setup_response})
            turn_number += 2

        # Probe turn — adapt to story context
        if conversation_history:
            adapted_probe = await coach.adapt_probe_to_story(conversation_history)
            probe_response = await target.reply(adapted_probe)
        else:
            adapted_probe = probe["prompt_text"]
            probe_response = await target.send(adapted_probe)

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

    def estimate_cost(self, probe_count: int, max_turns: int, mode: str = "whittle") -> dict:
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
