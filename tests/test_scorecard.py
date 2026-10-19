"""Scorecard enforcement labels point the right way; context-dependent has a cell (B27)."""

from __future__ import annotations


def _claim(conn, expected: str) -> int:
    cur = conn.execute(
        "INSERT INTO policy_claims"
        " (provider, claim_id, claim_text, category, testable_statement, expected_behavior)"
        " VALUES ('test', ?, ?, 'test', 'x', ?)",
        (f"test-{expected}", f"Claim {expected}", expected),
    )
    conn.commit()
    return cur.lastrowid


def _scorecard(app_client, expected: str, classification: str, n: int = 5) -> dict:
    import flinch.app
    from flinch import db

    conn = flinch.app._conn
    conn.execute("DELETE FROM probe_claim_links")
    conn.commit()
    claim_id = _claim(conn, expected)
    session_id = app_client.post("/api/sessions", json={"name": "sc", "target_model": "gpt-4o"}).json()["id"]
    probe_id = app_client.post("/api/probes", json={"name": f"p-{expected}-{classification}", "prompt_text": "x"}).json()["id"]
    db.link_probe_claim(conn, probe_id, claim_id)
    for _ in range(n):
        run_id = db.create_run(conn, probe_id, session_id, "gpt-4o")
        conn.execute("UPDATE runs SET initial_classification = ? WHERE id = ?", (classification, run_id))
    conn.commit()
    result = db.compute_scorecard(conn, ["gpt-4o"], session_ids=[session_id])
    model = result["by_model"]["gpt-4o"]
    (claim,) = [c for c in model["by_claim"] if c["claim_id"] == claim_id]
    return {"model": model, "claim": claim}


def test_should_refuse_never_refused_is_under(app_client) -> None:
    out = _scorecard(app_client, "should_refuse", "complied")
    assert out["claim"]["enforcement"] == "under"
    assert out["model"]["under_enforced"] == 1
    assert out["model"]["over_enforced"] == 0


def test_should_refuse_always_refused_is_consistent(app_client) -> None:
    out = _scorecard(app_client, "should_refuse", "refused")
    assert out["claim"]["enforcement"] == "consistent"


def test_should_allow_always_refused_is_over(app_client) -> None:
    out = _scorecard(app_client, "should_allow", "refused")
    assert out["claim"]["enforcement"] == "over"
    assert out["model"]["over_enforced"] == 1


def test_context_dependent_has_its_own_count(app_client) -> None:
    out = _scorecard(app_client, "context_dependent", "refused")
    assert out["claim"]["enforcement"] == "context_dependent"
    assert out["model"]["context_dependent"] == 1
    assert out["model"]["consistent"] == 0
