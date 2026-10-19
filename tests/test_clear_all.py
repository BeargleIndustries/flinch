"""Clear all data deletes what its copy says and keeps probes and framing groups (B26)."""

from __future__ import annotations

from test_deletes import seed_session

CLEARED = (
    "sessions", "runs", "run_turns", "annotations", "coach_examples", "batch_runs",
    "snapshots", "compliance_results", "comparisons", "stat_runs", "stat_run_iterations",
    "sequences", "sequence_runs", "sequence_turns", "sequence_batches",
    "scorecard_snapshots", "publication_exports", "experiments",
    "experiment_conditions", "experiment_prompts",
)


def _count(conn, table: str) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def test_clear_all_deletes_user_data_and_keeps_probes(app_client) -> None:
    import flinch.app
    from flinch import db

    conn = flinch.app._conn
    seed_session(app_client)
    free_id = app_client.post("/api/probes", json={"name": "grouped", "prompt_text": "x"}).json()["id"]
    db.create_variant_group(conn, "grp", [free_id], ["only"])
    db.save_comparison(conn, "cmp", ["a"], [free_id], [], {}, 1.0, 1)
    db.save_scorecard(conn, "sc", ["gpt-4o"], [], [], {"by_model": {}})
    db.save_publication_export(conn, "doc", "markdown", "full_report", None, "# Doc")
    exp_id = app_client.post(
        "/api/experiments", json={"name": "st", "model_ids": ["claude-sonnet-4"], "conditions": [{"label": "only"}]},
    ).json()["experiment"]["id"]
    app_client.post(f"/api/experiments/{exp_id}/prompts", json=[{"custom_prompt_text": "Hi."}])
    probes_before = _count(conn, "probes")
    variants_before = _count(conn, "probe_variants")
    for table in CLEARED:
        assert _count(conn, table) > 0, table

    resp = app_client.request("DELETE", "/api/dashboard/clear-all", json={"confirm": "DELETE_ALL_DATA"})

    assert resp.status_code == 200
    body = resp.json()
    for table in CLEARED:
        assert _count(conn, table) == 0, table
    assert _count(conn, "probes") == probes_before
    assert _count(conn, "probe_variants") == variants_before > 0
    assert body["deleted"]["sessions"] == 1
    assert body["deleted"]["experiments"] == 1
    assert {"probes", "probe_variants"} <= set(body["preserved"])
    assert "probe_variants" not in body["deleted"]


def test_clear_all_needs_confirmation(app_client) -> None:
    resp = app_client.request("DELETE", "/api/dashboard/clear-all", json={"confirm": "no"})
    assert resp.status_code == 400
