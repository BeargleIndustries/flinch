"""Sessions carry run_count; dashboard counts match Browse (B19)."""

from __future__ import annotations

import flinch.app
from flinch import db

MODEL_COMPARE_NOTES = "Auto-created by multi-model comparison with 2 models, 3 probes"


def test_list_sessions_carries_run_count(app_client) -> None:
    conn = flinch.app._conn
    probe_id = db.create_probe(conn, "p-sessions", "", "hello")
    busy = db.create_session(conn, "busy")
    idle = db.create_session(conn, "idle")
    db.create_run(conn, probe_id, busy, "claude-test")
    db.create_run(conn, probe_id, busy, "claude-test")

    counts = {s["id"]: s["run_count"] for s in app_client.get("/api/sessions").json()}
    assert counts == {busy: 2, idle: 0}


def test_model_compare_sessions_excluded_from_dashboard(app_client) -> None:
    conn = flinch.app._conn
    kept = db.create_session(conn, "kept")
    hidden = db.create_session(conn, "compare", notes=MODEL_COMPARE_NOTES)

    listed = {s["id"] for s in app_client.get("/api/sessions").json()}
    assert listed == {kept, hidden}

    browse = {s["id"] for s in app_client.get("/api/dashboard/sessions").json()}
    assert browse == {kept}
    stats = app_client.get("/api/dashboard/stats").json()
    assert stats["total_sessions"] == len(browse) == 1
