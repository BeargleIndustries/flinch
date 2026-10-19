"""SSE over a real uvicorn socket: event spacing (A2, server side) and disconnect (A6, R2).

`TestClient` buffers the whole response, so these run on `live_server` with
`httpx.AsyncClient.stream`. `fake_target` applies because the server runs in
this process; no provider is called.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

import httpx


def _sends(factory) -> int:
    return sum(1 for t in factory.created for name, _ in t.calls if name == "send")


def _db(env: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(env / "flinch.db")
    conn.row_factory = sqlite3.Row
    return conn


def _setup_batch(base: str, n_probes: int) -> tuple[int, list[int]]:
    with httpx.Client(base_url=base, timeout=10) as client:
        session_id = client.post("/api/sessions", json={"name": "live", "target_model": "gpt-4o"}).json()["id"]
        probe_ids = [
            client.post("/api/probes", json={"name": f"live-{i}", "prompt_text": f"Question {i}."}).json()["id"]
            for i in range(n_probes)
        ]
    return session_id, probe_ids


async def _events(resp: httpx.Response):
    """Yield `(name, data, arrival_time)` for each SSE block as it arrives."""
    name, data = "message", None
    async for line in resp.aiter_lines():
        if line.startswith("event: "):
            name = line[len("event: "):]
        elif line.startswith("data: "):
            data = json.loads(line[len("data: "):])
        elif line == "" and data is not None:
            yield name, data, time.monotonic()
            name, data = "message", None


def test_batch_events_arrive_spaced(live_server, fake_target, keyword_classifier, run) -> None:
    """Three probes with `delay_ms: 500`: `progress` events arrive at least 400 ms apart."""
    session_id, probe_ids = _setup_batch(live_server, 3)

    async def drive() -> list[tuple[str, float]]:
        seen = []
        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            async with client.stream(
                "POST", f"/api/sessions/{session_id}/batch", json={"probe_ids": probe_ids, "delay_ms": 500}
            ) as resp:
                assert resp.headers["content-type"].startswith("text/event-stream")
                async for name, _data, at in _events(resp):
                    seen.append((name, at))
        return seen

    seen = run(drive())
    assert [name for name, _ in seen] == ["start", "progress", "progress", "progress", "complete"]
    times = [at for name, at in seen if name == "progress"]
    gaps = [b - a for a, b in zip(times, times[1:], strict=False)]
    assert all(gap >= 0.4 for gap in gaps), gaps


def test_batch_disconnect_cancels(live_server, env, fake_target, keyword_classifier, run) -> None:
    """Closing the socket after the first `progress` leaves the batch `cancelled` within 2 s (A6)."""
    fake_target.delay_s = 0.3
    session_id, probe_ids = _setup_batch(live_server, 6)

    async def drive() -> int:
        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            async with client.stream(
                "POST", f"/api/sessions/{session_id}/batch", json={"probe_ids": probe_ids, "delay_ms": 0}
            ) as resp:
                names = []
                batch_id = None
                async for name, data, _at in _events(resp):
                    names.append(name)
                    if name == "start":
                        batch_id = data["batch_id"]
                    if name == "progress":
                        break
        # Leaving both blocks closes the stream and the connection.
        assert names == ["start", "progress"]
        return batch_id

    batch_id = run(drive())

    conn = _db(env)
    try:
        deadline = time.monotonic() + 2
        status = None
        while time.monotonic() < deadline:
            status = conn.execute("SELECT status FROM batch_runs WHERE id = ?", (batch_id,)).fetchone()["status"]
            if status == "cancelled":
                break
            time.sleep(0.05)
        assert status == "cancelled"

        sends = _sends(fake_target)
        runs = conn.execute("SELECT COUNT(*) FROM runs WHERE session_id = ?", (session_id,)).fetchone()[0]
        time.sleep(0.8)
        assert _sends(fake_target) == sends
        assert conn.execute("SELECT COUNT(*) FROM runs WHERE session_id = ?", (session_id,)).fetchone()[0] == runs
        assert sends < len(probe_ids)
    finally:
        conn.close()


def test_experiment_disconnect_pauses(live_server, fake_target, run) -> None:
    """Closing a study stream after the first `progress` leaves it `paused`; no cell is sent after."""
    fake_target.delay_s = 0.3
    with httpx.Client(base_url=live_server, timeout=10) as client:
        exp_id = client.post(
            "/api/experiments",
            json={"name": "live study", "model_ids": ["gpt-4o"],
                  "conditions": [{"label": "a"}, {"label": "b"}]},
        ).json()["experiment"]["id"]
        client.post(
            f"/api/experiments/{exp_id}/prompts",
            json=[{"custom_prompt_text": f"Prompt {i}."} for i in range(4)],
        )

    async def drive() -> None:
        async with httpx.AsyncClient(base_url=live_server, timeout=30) as client:
            async with client.stream(
                "POST", f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": {"openai": 1}}
            ) as resp:
                async for name, _data, _at in _events(resp):
                    if name == "progress":
                        break

    run(drive())

    with httpx.Client(base_url=live_server, timeout=10) as client:
        deadline = time.monotonic() + 2
        status = None
        while time.monotonic() < deadline:
            status = client.get(f"/api/experiments/{exp_id}").json()["experiment"]["status"]
            if status == "paused":
                break
            time.sleep(0.05)
        sends = _sends(fake_target)
        time.sleep(0.8)
        assert status == "paused"
        assert _sends(fake_target) == sends

