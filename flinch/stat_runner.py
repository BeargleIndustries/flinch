"""Statistical run engine — N-repeat runs with consistency rate tracking."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from flinch import db
from flinch.classifier import classify
from flinch.llm import LLMBackend
from flinch.target import ClaudeTarget, GeminiTarget, OpenAITarget, TargetModel

logger = logging.getLogger(__name__)


def _make_target(model_name: str, client=None) -> TargetModel:
    """Create a fresh target model instance. Each iteration gets its own to avoid context contamination."""
    if model_name.startswith("claude-"):
        if not client:
            raise ValueError(
                "Anthropic API key required to test Claude models. "
                "Set ANTHROPIC_API_KEY or choose a different target model."
            )
        return ClaudeTarget(model=model_name, client=client)
    elif model_name.startswith(("gpt-", "o1-", "o3-", "o4-", "chatgpt-")):
        return OpenAITarget(model_name)
    elif model_name.startswith("gemini-"):
        return GeminiTarget(model_name)
    elif model_name.startswith("grok-"):
        # xAI uses OpenAI-compatible API
        return OpenAITarget(model_name)
    else:
        # Try OpenAI-compatible (Ollama, Together, etc.)
        return OpenAITarget(model_name)


async def run_statistical(
    conn,
    session_id: int,
    probe_id: int,
    target_model: str,
    repeat_count: int,
    backend: LLMBackend | None,
    client=None,
):
    """Run a probe N times against a model, classifying each response.

    Async generator — yields SSE event dicts (same pattern as Runner.run_batch).
    Each iteration gets a fresh TargetModel instance to avoid context contamination.
    No coach suggestions — probe + classify only.

    Yields dicts with 'event' and 'data' keys.
    """
    stat_run_id = db.create_stat_run(conn, session_id, probe_id, target_model, repeat_count)
    db.update_stat_run(conn, stat_run_id, status="running")

    probe = db.get_probe(conn, probe_id)
    if not probe:
        yield {"event": "error", "data": {"message": f"Probe {probe_id} not found"}}
        db.update_stat_run(conn, stat_run_id, status="failed")
        return

    yield {
        "event": "start",
        "data": {
            "stat_run_id": stat_run_id,
            "probe_id": probe_id,
            "probe_name": probe.get("name", ""),
            "target_model": target_model,
            "repeat_count": repeat_count,
        },
    }

    completed = 0
    failed = 0

    for i in range(repeat_count):
        try:
            # Fresh target per iteration — no context bleed between runs
            target = _make_target(target_model, client)

            start_time = time.time()
            response_text = (await target.send(probe["prompt_text"])).text
            latency_ms = int((time.time() - start_time) * 1000)

            classification = await classify(response_text, probe["prompt_text"], backend)

            db.add_stat_iteration(
                conn,
                stat_run_id,
                i + 1,
                response_text,
                classification.value,
                latency_ms=latency_ms,
            )
            completed += 1

            yield {
                "event": "iteration",
                "data": {
                    "stat_run_id": stat_run_id,
                    "iteration": i + 1,
                    "total": repeat_count,
                    "classification": classification.value,
                    "latency_ms": latency_ms,
                    "completed": completed,
                    "failed": failed,
                },
            }

        except Exception as e:
            failed += 1
            logger.warning("Stat run %d iteration %d failed: %s", stat_run_id, i + 1, e)
            yield {
                "event": "iteration_error",
                "data": {
                    "stat_run_id": stat_run_id,
                    "iteration": i + 1,
                    "total": repeat_count,
                    "error": str(e),
                    "completed": completed,
                    "failed": failed,
                },
            }

    db.update_stat_run(
        conn,
        stat_run_id,
        status="complete",
        completed_at=datetime.now(timezone.utc).isoformat(),
    )

    summary = db.get_stat_run_summary(conn, stat_run_id)

    yield {
        "event": "complete",
        "data": {
            "stat_run_id": stat_run_id,
            "summary": summary,
            "completed": completed,
            "failed": failed,
        },
    }


async def run_statistical_batch(
    conn,
    session_id: int,
    probe_ids: list[int],
    target_model: str,
    repeat_count: int,
    backend: LLMBackend | None,
    client=None,
):
    """Run statistical analysis on multiple probes sequentially. Yields SSE events for all."""
    yield {
        "event": "batch_start",
        "data": {
            "session_id": session_id,
            "probe_count": len(probe_ids),
            "repeat_count": repeat_count,
            "target_model": target_model,
        },
    }

    for probe_idx, probe_id in enumerate(probe_ids):
        async for event in run_statistical(
            conn, session_id, probe_id, target_model, repeat_count, backend, client
        ):
            # Augment every event with batch progress metadata
            event["data"]["batch_probe_index"] = probe_idx + 1
            event["data"]["batch_probe_total"] = len(probe_ids)
            yield event

    yield {
        "event": "batch_complete",
        "data": {
            "session_id": session_id,
            "probe_count": len(probe_ids),
        },
    }
