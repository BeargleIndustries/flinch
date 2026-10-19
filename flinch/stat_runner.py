"""Statistical run engine — N-repeat runs with consistency rate tracking."""
from __future__ import annotations

import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime

from flinch import db
from flinch import target as flinch_target
from flinch.classifier import classify
from flinch.llm import LLMBackend
from flinch.target import TargetModel

logger = logging.getLogger(__name__)


def _make_target(model_name: str, system_prompt: str = "", client=None) -> TargetModel:
    """Thin wrapper over `flinch.target.make_target` (kept as a test patch point)."""
    return flinch_target.make_target(model_name, system_prompt, anthropic_client=client)


async def run_statistical(
    conn,
    session_id: int,
    probe_id: int,
    target_model: str,
    repeat_count: int,
    backend: LLMBackend | None,
    client=None,
    make_target: Callable[[], TargetModel] | None = None,
    system_prompt: str = "",
):
    """Run a probe N times against a model, classifying each response.

    `make_target()` builds each iteration's fresh target; by default it is the
    shared factory with `target_model` and `system_prompt`.

    Async generator — yields SSE event dicts (same pattern as Runner.run_batch).
    Each iteration gets a fresh TargetModel instance to avoid context contamination.
    No coach suggestions — probe + classify only.

    Yields dicts with 'event' and 'data' keys.
    """
    if make_target is None:
        def make_target() -> TargetModel:
            return _make_target(target_model, system_prompt, client)

    # Check the probe first: a stat run row cannot reference a missing probe.
    probe = db.get_probe(conn, probe_id)
    if not probe:
        yield {"event": "error", "data": {"error": f"Probe {probe_id} not found"}}
        return

    stat_run_id = db.create_stat_run(conn, session_id, probe_id, target_model, repeat_count)
    db.update_stat_run(conn, stat_run_id, status="running")

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
            target = make_target()

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
        completed_at=datetime.now(UTC).isoformat(),
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
    make_target: Callable[[], TargetModel] | None = None,
    system_prompt: str = "",
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
            conn, session_id, probe_id, target_model, repeat_count, backend, client,
            make_target=make_target, system_prompt=system_prompt,
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
