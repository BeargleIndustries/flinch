"""Repeat runs use the session's model and system prompt; summaries carry date and status (B15, B16)."""

from __future__ import annotations

import json


def _events(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in lines:
            events.append((lines["event"], json.loads(lines.get("data", "{}"))))
    return events


def test_stat_run_uses_session_model_and_system_prompt(app_client, fake_target, keyword_classifier) -> None:
    session_id = app_client.post(
        "/api/sessions", json={"name": "stat", "target_model": "grok-3", "system_prompt": "SYS"}
    ).json()["id"]
    probe_id = app_client.post("/api/probes", json={"name": "stat-p", "prompt_text": "hello"}).json()["id"]

    resp = app_client.post(
        f"/api/sessions/{session_id}/stat-run", json={"probe_ids": [probe_id], "repeat_count": 3}
    )
    assert resp.status_code == 200
    events = _events(resp.text)
    assert [e for e, _ in events].count("iteration") == 3
    assert [(t.model, t.system_prompt) for t in fake_target.created] == [("grok-3", "SYS")] * 3
    assert len({id(t) for t in fake_target.created}) == 3

    summaries = app_client.get(f"/api/sessions/{session_id}/stat-runs").json()
    assert len(summaries) == 1
    assert summaries[0]["status"] == "complete"
    assert summaries[0]["created_at"]

    detail = app_client.get(f"/api/stat-runs/{summaries[0]['stat_run_id']}").json()
    assert detail["summary"]["status"] == "complete"
    assert detail["summary"]["created_at"] == summaries[0]["created_at"]


def test_run_statistical_default_factory_passes_system_prompt(fake_target, keyword_classifier, run) -> None:
    from flinch import db, stat_runner

    conn = db.init_db()
    session_id = db.create_session(conn, "s", target_model="gemini-2.0-flash", system_prompt="SYS")
    probe_id = db.create_probe(conn, "p", "", "hello")

    async def drain(probe: int) -> list[dict]:
        return [e async for e in stat_runner.run_statistical(
            conn, session_id, probe, "gemini-2.0-flash", 2, None, system_prompt="SYS"
        )]

    events = run(drain(probe_id))
    assert [e["event"] for e in events] == ["start", "iteration", "iteration", "complete"]
    assert [(t.model, t.system_prompt) for t in fake_target.created] == [("gemini-2.0-flash", "SYS")] * 2

    missing = run(drain(999999))
    assert missing == [{"event": "error", "data": {"error": "Probe 999999 not found"}}]
    conn.close()
