"""Deletes that cannot fail on foreign keys, and keep the coach's examples (B20, B25, A-M2, A-M3)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

# Every table with a session_id column that references sessions(id).
SESSION_TABLES = (
    "runs", "batch_runs", "snapshots", "compliance_results",
    "sequence_batches", "sequences", "stat_runs",
)


def _conn():
    import flinch.app

    return flinch.app._conn


def _probe(client, name: str, text: str = "Say hello.") -> int:
    return client.post("/api/probes", json={"name": name, "prompt_text": text}).json()["id"]


def _coach_count(conn) -> int:
    return conn.execute("SELECT COUNT(*) FROM coach_examples").fetchone()[0]


def seed_session(client) -> dict:
    """A session with a run (turns, annotation, coach example), a batch, a baseline,
    a compliance row, a repeat run with an iteration and a sequence in a batch."""
    from flinch import db

    conn = _conn()
    session_id = client.post("/api/sessions", json={"name": "full", "target_model": "gpt-4o"}).json()["id"]
    probe_id = _probe(client, "seed-probe")
    run_id = db.create_run(conn, probe_id, session_id, "gpt-4o")
    db.add_run_turn(conn, run_id, "user", "Say hello.")
    db.add_run_turn(conn, run_id, "assistant", "Hello.", "complied")
    db.upsert_annotation(conn, run_id, note_text="note", finding="finding")
    example_id = db.create_coach_example(
        conn, run_id, "standard", "No.", "Please?", "complied", "pattern", "reframe",
    )
    db.create_batch_run(conn, session_id, probes_total=1)
    db.create_snapshot(conn, session_id, "baseline", "", {"runs": []})
    claim_id = conn.execute("SELECT id FROM policy_claims LIMIT 1").fetchone()[0]
    conn.execute(
        "INSERT INTO compliance_results (session_id, claim_id, probe_count) VALUES (?, ?, 1)",
        (session_id, claim_id),
    )
    conn.commit()
    stat_run_id = db.create_stat_run(conn, session_id, probe_id, "gpt-4o", repeat_count=1)
    db.add_stat_iteration(conn, stat_run_id, 1, "Hello.", "complied")
    strategy_id = conn.execute("SELECT id FROM strategy_templates LIMIT 1").fetchone()[0]
    seq_batch_id = db.create_sequence_batch(conn, session_id, strategy_id, probes_total=1)
    sequence_id = db.create_sequence(conn, session_id, probe_id, strategy_id, batch_id=seq_batch_id)
    seq_run_id = db.create_sequence_run(conn, sequence_id, 1)
    db.add_sequence_turn(conn, seq_run_id, 1, "user", "Warmup.")
    return {"session_id": session_id, "probe_id": probe_id, "run_id": run_id,
            "example_id": example_id, "sequence_id": sequence_id, "stat_run_id": stat_run_id}


def test_session_with_everything_deletes(app_client) -> None:
    seeded = seed_session(app_client)
    conn = _conn()

    resp = app_client.delete(f"/api/sessions/{seeded['session_id']}")

    assert resp.status_code == 200
    for table in SESSION_TABLES:
        n = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE session_id = ?", (seeded["session_id"],)).fetchone()[0]
        assert n == 0, table
    assert conn.execute("SELECT COUNT(*) FROM sessions WHERE id = ?", (seeded["session_id"],)).fetchone()[0] == 0
    for table, column, key in (
        ("run_turns", "run_id", seeded["run_id"]),
        ("annotations", "run_id", seeded["run_id"]),
        ("sequence_runs", "sequence_id", seeded["sequence_id"]),
        ("stat_run_iterations", "stat_run_id", seeded["stat_run_id"]),
    ):
        assert conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {column} = ?", (key,)).fetchone()[0] == 0, table
    assert conn.execute("SELECT COUNT(*) FROM sequence_turns").fetchone()[0] == 0
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == []


def test_coach_examples_survive_session_delete(app_client) -> None:
    seeded = seed_session(app_client)
    conn = _conn()
    before = _coach_count(conn)

    app_client.delete(f"/api/sessions/{seeded['session_id']}")

    assert _coach_count(conn) == before
    row = conn.execute("SELECT run_id, refusal_text FROM coach_examples WHERE id = ?", (seeded["example_id"],)).fetchone()
    assert row["run_id"] is None
    assert row["refusal_text"] == "No."


def test_coach_examples_survive_run_delete(app_client) -> None:
    seeded = seed_session(app_client)
    conn = _conn()
    before = _coach_count(conn)

    resp = app_client.delete(f"/api/runs/{seeded['run_id']}")

    assert resp.status_code == 200
    assert _coach_count(conn) == before
    row = conn.execute("SELECT run_id FROM coach_examples WHERE id = ?", (seeded["example_id"],)).fetchone()
    assert row["run_id"] is None


def test_probe_in_framing_group_with_claim_link_deletes(app_client) -> None:
    from flinch import db

    conn = _conn()
    probe_id = _probe(app_client, "framed")
    other_id = _probe(app_client, "framed-other")
    db.create_variant_group(conn, "grp", [probe_id, other_id], ["a", "b"])
    claim_id = conn.execute("SELECT id FROM policy_claims LIMIT 1").fetchone()[0]
    db.link_probe_claim(conn, probe_id, claim_id)

    resp = app_client.delete(f"/api/probes/{probe_id}")

    assert resp.status_code == 200
    assert db.get_probe(conn, probe_id) is None
    assert conn.execute("SELECT COUNT(*) FROM probe_variants WHERE probe_id = ?", (probe_id,)).fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM probe_claim_links WHERE probe_id = ?", (probe_id,)).fetchone()[0] == 0


def test_probe_with_runs_is_refused(app_client) -> None:
    seeded = seed_session(app_client)

    resp = app_client.delete(f"/api/probes/{seeded['probe_id']}")

    assert resp.status_code == 409
    assert resp.json()["detail"] == "Probe has 1 run(s). Delete those first."
    assert "—" not in resp.json()["detail"]


def test_probe_with_repeat_run_is_refused(app_client) -> None:
    from flinch import db

    conn = _conn()
    session_id = app_client.post("/api/sessions", json={"name": "s"}).json()["id"]
    probe_id = _probe(app_client, "repeat")
    db.create_stat_run(conn, session_id, probe_id, "gpt-4o", repeat_count=1)

    resp = app_client.delete(f"/api/probes/{probe_id}")

    assert resp.status_code == 409
    assert resp.json()["detail"] == "Probe is used by 1 repeat run(s) or sequence(s). Delete those first."


def test_probe_used_by_study_is_refused_and_prompt_keeps_text(app_client) -> None:
    probe_id = _probe(app_client, "study-probe", "What is 2 + 2?")
    exp_id = app_client.post(
        "/api/experiments", json={"name": "st", "model_ids": ["claude-sonnet-4"], "conditions": [{"label": "only"}]},
    ).json()["experiment"]["id"]
    app_client.post(f"/api/experiments/{exp_id}/prompts", json=[{"probe_id": probe_id}])

    resp = app_client.delete(f"/api/probes/{probe_id}")

    assert resp.status_code == 409
    assert resp.json()["detail"] == "Probe is used by 1 condition stud(ies). Delete those first."
    (prompt,) = app_client.get(f"/api/experiments/{exp_id}/prompts").json()["prompts"]
    assert prompt["probe_id"] == probe_id
    assert app_client.get("/api/probes").status_code == 200
    assert any(p["id"] == probe_id for p in app_client.get("/api/probes").json())


def test_bulk_delete_skips_probes_with_runs(app_client) -> None:
    seeded = seed_session(app_client)
    free_id = _probe(app_client, "free")

    resp = app_client.post("/api/probes/bulk-delete", json={"probe_ids": [seeded["probe_id"], free_id]})

    assert resp.status_code == 200
    assert resp.json() == {"deleted": 1, "skipped": [seeded["probe_id"]]}
    ids = {p["id"] for p in app_client.get("/api/probes").json()}
    assert seeded["probe_id"] in ids
    assert free_id not in ids


def test_comparison_delete_is_committed(app_client, env: Path) -> None:
    from flinch import db

    comparison_id = db.save_comparison(_conn(), "cmp", ["a", "b"], [1], [1], {}, 1.0, 1)

    resp = app_client.delete(f"/api/comparisons/{comparison_id}")

    assert resp.status_code == 200
    other = sqlite3.connect(env / "flinch.db")
    try:
        assert other.execute("SELECT COUNT(*) FROM comparisons WHERE id = ?", (comparison_id,)).fetchone()[0] == 0
    finally:
        other.close()
