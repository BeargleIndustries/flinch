"""B03: pause keeps `paused`, workers stop, failed cells can be retried, one owner per study.

Cases 1 to 5 drive the runner or go through `app_client`. Cases 6 to 10 need a
real socket (a disconnect, concurrent requests), so they run on `live_server`
with `httpx.AsyncClient.stream`; `fake_target` applies because the server runs
in this process.
"""

from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from pathlib import Path

import httpx

from flinch.rate_limiter import RateLimiterPool

ONE_AT_A_TIME = {"openai": {"rpm": 10000, "concurrent": 1}}
ALREADY_RUNNING = "This study is already running."


def _study(client, n_conditions: int, n_prompts: int, model: str = "gpt-4o") -> int:
    exp_id = client.post(
        "/api/experiments",
        json={"name": "pause", "model_ids": [model],
              "conditions": [{"label": f"c{i}"} for i in range(n_conditions)]},
    ).json()["experiment"]["id"]
    client.post(f"/api/experiments/{exp_id}/prompts",
                json=[{"custom_prompt_text": f"Prompt {i}."} for i in range(n_prompts)])
    return exp_id


def _sends(factory) -> int:
    return sum(1 for t in factory.created for name, _ in t.calls if name == "send")


def _cells(env: Path, exp_id: int) -> list[tuple[int, str]]:
    conn = sqlite3.connect(env / "flinch.db")
    try:
        return conn.execute(
            "SELECT id, status FROM experiment_responses WHERE experiment_id = ? ORDER BY id", (exp_id,)
        ).fetchall()
    finally:
        conn.close()


def _status(client, exp_id: int) -> str:
    return client.get(f"/api/experiments/{exp_id}").json()["experiment"]["status"]


async def _events(resp: httpx.Response):
    """Yield `(name, data)` for each SSE block as it arrives."""
    name, data = "message", None
    async for line in resp.aiter_lines():
        if line.startswith("event: "):
            name = line[len("event: "):]
        elif line.startswith("data: "):
            data = json.loads(line[len("data: "):])
        elif line == "" and data is not None:
            yield name, data
            name, data = "message", None


def _wait_for_status(client, exp_id: int, wanted: str, within_s: float) -> str:
    deadline = time.monotonic() + within_s
    status = _status(client, exp_id)
    while status != wanted and time.monotonic() < deadline:
        time.sleep(0.05)
        status = _status(client, exp_id)
    return status


# ---- cases 1 to 5: the runner and app_client ------------------------------------------------


def test_case1_close_after_first_progress_pauses(app_client, env, fake_target, keyword_classifier, run) -> None:
    """`aclose()` after the first `progress`: `paused`, cells still pending, nothing changes after."""
    from flinch.db import create_experiment_responses, get_async_db, get_experiment_progress
    from flinch.runner import ExperimentRunner

    fake_target.delay_s = 0.05
    exp_id = _study(app_client, 2, 3)

    async def drive() -> dict:
        async with get_async_db() as db_conn:
            await create_experiment_responses(db_conn, exp_id)
            agen = ExperimentRunner(db_conn, RateLimiterPool(ONE_AT_A_TIME)).run_experiment(exp_id)
            async for event in agen:
                if event["type"] == "progress":
                    break
            await agen.aclose()
            await asyncio.sleep(0.3)
            return await get_experiment_progress(db_conn, exp_id)

    progress = run(drive())
    assert _status(app_client, exp_id) == "paused"
    assert progress["pending"] >= 1
    before = _cells(env, exp_id)
    time.sleep(0.3)
    assert _cells(env, exp_id) == before


def test_case2_pause_between_cells(app_client, fake_target, keyword_classifier, run) -> None:
    """`POST /pause` while the generator runs: it ends with a `paused` event and status."""
    from flinch.db import create_experiment_responses, get_async_db
    from flinch.runner import ExperimentRunner

    fake_target.delay_s = 0.05
    exp_id = _study(app_client, 2, 3)

    async def drive() -> list[dict]:
        events = []
        async with get_async_db() as db_conn:
            await create_experiment_responses(db_conn, exp_id)
            runner = ExperimentRunner(db_conn, RateLimiterPool(ONE_AT_A_TIME))
            async for event in runner.run_experiment(exp_id):
                events.append(event)
                if event["type"] == "progress" and len([e for e in events if e["type"] == "progress"]) == 1:
                    assert app_client.post(f"/api/experiments/{exp_id}/pause").status_code == 200
        return events

    events = run(drive())
    assert events[-1]["type"] == "paused"
    assert _status(app_client, exp_id) == "paused"
    progress = app_client.get(f"/api/experiments/{exp_id}/progress").json()
    assert progress["pending"] >= 1
    assert progress["active"] is False


def test_case3_retry_failed(app_client, fake_target, keyword_classifier, run) -> None:
    """Two failed cells, `POST /resume {retry_failed: true}`: both end `completed`."""
    from flinch.db import create_experiment_responses, get_async_db

    exp_id = _study(app_client, 1, 2)

    async def fail_all() -> None:
        async with get_async_db() as db_conn:
            await create_experiment_responses(db_conn, exp_id)
            await db_conn.execute(
                "UPDATE experiment_responses SET status = 'failed', error_message = 'boom' WHERE experiment_id = ?",
                (exp_id,),
            )
            await db_conn.commit()

    run(fail_all())
    resp = app_client.post(f"/api/experiments/{exp_id}/resume",
                           json={"concurrency_per_provider": {}, "retry_failed": True})
    assert resp.status_code == 200
    progress = app_client.get(f"/api/experiments/{exp_id}/progress").json()
    assert (progress["completed"], progress["failed"], progress["pending"]) == (2, 0, 0)
    assert _status(app_client, exp_id) == "completed"


def test_case4_every_cell_fails(app_client, fake_target, keyword_classifier) -> None:
    """Every send raises: the study ends `failed`, not `completed`."""

    def broken(system: str, messages: list[dict]) -> str:
        raise RuntimeError("provider down")

    fake_target.rule = broken
    exp_id = _study(app_client, 1, 2)
    resp = app_client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": ONE_AT_A_TIME})
    assert resp.status_code == 200
    assert "event: complete" in resp.text
    progress = app_client.get(f"/api/experiments/{exp_id}/progress").json()
    assert (progress["completed"], progress["failed"]) == (0, 2)
    assert _status(app_client, exp_id) == "failed"


def test_case5_no_pending_cells_ends_completed(app_client, fake_target, keyword_classifier) -> None:
    """A study with nothing pending ends `completed`, never `running`."""
    exp_id = _study(app_client, 1, 2)
    app_client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": ONE_AT_A_TIME})
    assert _status(app_client, exp_id) == "completed"
    sends = _sends(fake_target)

    resp = app_client.post(f"/api/experiments/{exp_id}/resume")
    assert resp.status_code == 200
    assert 'event: complete\ndata: {"type": "complete", "completed": 0, "failed": 0, "total": 0}' in resp.text
    assert _status(app_client, exp_id) == "completed"
    assert _sends(fake_target) == sends


def test_pause_after_completion_keeps_completed(app_client, fake_target, keyword_classifier) -> None:
    """`POST /pause` only pauses a running study: a finished one stays `completed`."""
    exp_id = _study(app_client, 1, 2)
    app_client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": ONE_AT_A_TIME})
    assert _status(app_client, exp_id) == "completed"

    assert app_client.post(f"/api/experiments/{exp_id}/pause").status_code == 200
    assert _status(app_client, exp_id) == "completed"


def test_start_and_resume_missing_study_404(app_client) -> None:
    """Start and Resume on a study that does not exist are 404 and claim nothing."""
    import flinch.app

    for route in ("start", "resume"):
        resp = app_client.post(f"/api/experiments/999999/{route}", json={"concurrency_per_provider": {}})
        assert resp.status_code == 404, route
    assert 999999 not in flinch.app._active_studies


# ---- cases 6 to 10: a real socket -------------------------------------------------------------


def test_case6_disconnect_pauses(live_server, env, fake_target, keyword_classifier, run) -> None:
    """Close the `/start` socket after the first `progress`: `paused` within 1 s, no sends after."""
    fake_target.delay_s = 0.3
    with httpx.Client(base_url=live_server, timeout=10) as client:
        exp_id = _study(client, 2, 3)

    async def drive() -> None:
        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            async with client.stream("POST", f"/api/experiments/{exp_id}/start",
                                     json={"concurrency_per_provider": ONE_AT_A_TIME}) as resp:
                async for name, _data in _events(resp):
                    if name == "progress":
                        break

    run(drive())
    with httpx.Client(base_url=live_server, timeout=10) as client:
        assert _wait_for_status(client, exp_id, "paused", 1.0) == "paused"
        sends = _sends(fake_target)
        before = _cells(env, exp_id)
        time.sleep(0.5)
        assert _sends(fake_target) == sends
        assert _cells(env, exp_id) == before
        assert any(status == "pending" for _, status in before)
        assert client.get(f"/api/experiments/{exp_id}/progress").json()["active"] is False


def test_case7_double_start_one_409(live_server, fake_target, keyword_classifier, monkeypatch, run) -> None:
    """Two concurrent `/start` calls: one 200 and one 409 with the I33 copy."""
    import flinch.app

    # The 409 comes after the owner wait; shorten it so the first study (3 s) outlasts it.
    monkeypatch.setattr(flinch.app, "_STUDY_RELEASE_WAIT_S", 1.0)
    fake_target.delay_s = 0.5
    with httpx.Client(base_url=live_server, timeout=10) as client:
        exp_id = _study(client, 2, 3)

    statuses: list[int] = []
    details: list[str] = []
    both = asyncio.Event()
    actives: list[bool] = []
    owner_events: list[str] = []

    async def one(client: httpx.AsyncClient) -> None:
        async with client.stream("POST", f"/api/experiments/{exp_id}/start",
                                 json={"concurrency_per_provider": ONE_AT_A_TIME}) as resp:
            if resp.status_code == 409:
                details.append(json.loads(await resp.aread())["detail"])
                actives.append((await client.get(f"/api/experiments/{exp_id}/progress")).json()["active"])
            statuses.append(resp.status_code)
            if len(statuses) == 2:
                both.set()
            await asyncio.wait_for(both.wait(), 10)
            if resp.status_code == 200:
                # Pause and read the owner's stream to its end, so the socket closes cleanly.
                await client.post(f"/api/experiments/{exp_id}/pause")
                owner_events.extend([name async for name, _data in _events(resp)])

    async def drive() -> None:
        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            await asyncio.gather(one(client), one(client))

    run(drive())
    assert sorted(statuses) == [200, 409]
    assert details == [ALREADY_RUNNING]
    assert actives == [True]
    assert owner_events[-1] == "paused"


def test_case8_pause_resume_sends_each_cell_once(live_server, env, fake_target, keyword_classifier, run) -> None:
    """Pause, then Resume, with `FakeTarget(delay_s=0.5)`: the send count equals the cell count."""
    fake_target.delay_s = 0.5
    with httpx.Client(base_url=live_server, timeout=10) as client:
        exp_id = _study(client, 2, 2)

    async def drive() -> tuple[list[str], int, list[str]]:
        first_progress = asyncio.Event()
        first_names: list[str] = []

        async def first_stream(client: httpx.AsyncClient) -> None:
            async with client.stream("POST", f"/api/experiments/{exp_id}/start",
                                     json={"concurrency_per_provider": ONE_AT_A_TIME}) as resp:
                async for name, _data in _events(resp):
                    first_names.append(name)
                    if name == "progress":
                        first_progress.set()

        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            reader = asyncio.create_task(first_stream(client))
            await asyncio.wait_for(first_progress.wait(), 10)
            assert (await client.post(f"/api/experiments/{exp_id}/pause")).status_code == 200
            async with client.stream("POST", f"/api/experiments/{exp_id}/resume",
                                     json={"concurrency_per_provider": ONE_AT_A_TIME}) as resp:
                code = resp.status_code
                names = [name async for name, _data in _events(resp)]
            await reader
        return first_names, code, names

    first_names, code, names = run(drive())
    assert first_names[-1] == "paused"
    assert code == 200
    assert names[-1] == "complete"
    cells = _cells(env, exp_id)
    assert [status for _, status in cells] == ["completed"] * 4
    assert _sends(fake_target) == len(cells)


def test_case9_disconnect_before_first_chunk_releases(live_server, env, fake_target, keyword_classifier, run) -> None:
    """Close `/start` before reading any chunk: an immediate second `/start` returns 200."""
    fake_target.delay_s = 0.1
    with httpx.Client(base_url=live_server, timeout=10) as client:
        exp_id = _study(client, 2, 2)

    async def drive() -> tuple[int, int, list[str]]:
        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            async with client.stream("POST", f"/api/experiments/{exp_id}/start",
                                     json={"concurrency_per_provider": ONE_AT_A_TIME}) as resp:
                first = resp.status_code
        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            async with client.stream("POST", f"/api/experiments/{exp_id}/start",
                                     json={"concurrency_per_provider": ONE_AT_A_TIME}) as resp:
                second = resp.status_code
                names = [name async for name, _data in _events(resp)]
        return first, second, names

    first, second, names = run(drive())
    assert (first, second) == (200, 200)
    assert names[-1] == "complete"
    assert [status for _, status in _cells(env, exp_id)] == ["completed"] * 4


def test_case10_pause_then_immediate_resume(live_server, env, fake_target, keyword_classifier, run) -> None:
    """Pause with the stream left open, then an immediate Resume with no retry: 200, to `complete` (K6)."""
    fake_target.delay_s = 0.5
    with httpx.Client(base_url=live_server, timeout=10) as client:
        exp_id = _study(client, 2, 2)

    async def drive() -> tuple[int, float, list[str], list[str]]:
        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            async with client.stream("POST", f"/api/experiments/{exp_id}/start",
                                     json={"concurrency_per_provider": ONE_AT_A_TIME}) as first:
                # Keep the event iterator referenced: closing it would close the
                # connection, which is a disconnect, not "left open".
                first_events = _events(first)
                while (await anext(first_events))[0] != "progress":
                    pass
                # The first stream stays open and unread from here on.
                assert (await client.post(f"/api/experiments/{exp_id}/pause")).status_code == 200
                start = time.monotonic()
                async with client.stream("POST", f"/api/experiments/{exp_id}/resume") as resp:
                    code = resp.status_code
                    waited = time.monotonic() - start
                    names = [name async for name, _data in _events(resp)]
                # Read the rest of the first stream so its socket closes cleanly.
                rest = [name async for name, _data in first_events]
        return code, waited, names, rest

    code, waited, names, rest = run(drive())
    assert code == 200
    assert waited < 5, waited
    assert names[-1] == "complete"
    assert rest[-1] == "paused"
    assert [status for _, status in _cells(env, exp_id)] == ["completed"] * 4
    assert _sends(fake_target) == 4
