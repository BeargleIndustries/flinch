"""Batch cancel is a database flag the batch loop reads before every probe (B01, D17).

The real-disconnect case over a socket is `tests/test_live_sse.py` in T06a (it needs I27).
"""

from __future__ import annotations

import json

import pytest


@pytest.fixture
def batch_env(app_client, fake_target, keyword_classifier) -> dict:
    import flinch.app

    client = app_client
    session_id = client.post(
        "/api/sessions", json={"name": "batch", "target_model": "gpt-4o"}
    ).json()["id"]
    probe_ids = [
        client.post("/api/probes", json={"name": f"batch-{i}", "prompt_text": f"Question {i}."}).json()["id"]
        for i in range(5)
    ]
    return {"client": client, "session_id": session_id, "probe_ids": probe_ids,
            "targets": fake_target, "runner": flinch.app._runner, "conn": flinch.app._conn}


def _sends(factory) -> int:
    return sum(1 for t in factory.created for name, _ in t.calls if name == "send")


def _events(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in lines:
            events.append((lines["event"], json.loads(lines.get("data", "{}"))))
    return events


def test_cancel_flag_stops_before_next_probe(batch_env, run) -> None:
    from flinch import db

    conn = batch_env["conn"]

    async def drive() -> list[dict]:
        events = []
        batch_id = None
        agen = batch_env["runner"].run_batch(batch_env["session_id"], batch_env["probe_ids"], delay_ms=0)
        async for event in agen:
            events.append(event)
            if event["event"] == "start":
                batch_id = event["data"]["batch_id"]
            if event["event"] == "progress":
                db.update_batch_run(conn, batch_id, status="cancelled")
        return events

    events = run(drive())
    assert events[0]["event"] == "start"
    batch_id = events[0]["data"]["batch_id"]
    assert events[0]["data"]["total"] == 5
    assert [e["event"] for e in events] == ["start", "progress", "complete"]
    assert events[-1]["data"]["cancelled"] is True
    assert _sends(batch_env["targets"]) == 1
    assert len(db.list_runs(conn, batch_env["session_id"])) == 1
    assert db.get_batch_run(conn, batch_id)["status"] == "cancelled"


def test_aclose_marks_cancelled(batch_env, run) -> None:
    from flinch import db

    async def drive() -> int:
        agen = batch_env["runner"].run_batch(batch_env["session_id"], batch_env["probe_ids"], delay_ms=0)
        start = await agen.__anext__()
        assert start["event"] == "start"
        await agen.aclose()
        return start["data"]["batch_id"]

    batch_id = run(drive())
    row = db.get_batch_run(batch_env["conn"], batch_id)
    assert row["status"] == "cancelled"
    assert row["completed_at"]
    assert _sends(batch_env["targets"]) == 0


def test_uncancelled_batch_completes(batch_env, run) -> None:
    from flinch import db

    async def drive() -> list[dict]:
        agen = batch_env["runner"].run_batch(batch_env["session_id"], batch_env["probe_ids"], delay_ms=0)
        return [event async for event in agen]

    events = run(drive())
    assert [e["event"] for e in events] == ["start"] + ["progress"] * 5 + ["complete"]
    assert events[-1]["data"]["cancelled"] is False
    assert db.get_batch_run(batch_env["conn"], events[0]["data"]["batch_id"])["status"] == "complete"


def test_stream_starts_with_batch_id_and_errors_carry_it(batch_env) -> None:
    client = batch_env["client"]
    resp = client.post(
        f"/api/sessions/{batch_env['session_id']}/batch",
        json={"probe_ids": [999999, batch_env["probe_ids"][0]], "delay_ms": 0},
    )
    events = _events(resp.text)
    assert events[0][0] == "start"
    batch_id = events[0][1]["batch_id"]
    assert events[1][0] == "error"
    assert events[1][1]["batch_id"] == batch_id
    assert events[-1][0] == "complete"


def test_cancel_route(batch_env, run) -> None:
    from flinch import db

    async def start_batch() -> int:
        agen = batch_env["runner"].run_batch(batch_env["session_id"], batch_env["probe_ids"], delay_ms=0)
        start = await agen.__anext__()
        # Leave the generator open: the route's flag alone must stop the loop.
        resp = batch_env["client"].post(f"/api/batch/{start['data']['batch_id']}/cancel")
        assert resp.json() == {"cancelled": True}
        rest = [event async for event in agen]
        assert [e["event"] for e in rest] == ["complete"]
        assert rest[0]["data"]["cancelled"] is True
        return start["data"]["batch_id"]

    batch_id = run(start_batch())
    assert db.get_batch_run(batch_env["conn"], batch_id)["status"] == "cancelled"
    assert _sends(batch_env["targets"]) == 0
