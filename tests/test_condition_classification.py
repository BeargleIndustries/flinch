"""B04: every condition-study response is sent with its text and classified."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from fakes import PLAIN_TEXT, REFUSAL_TEXT

ONE_AT_A_TIME = {"anthropic": {"rpm": 10000, "concurrent": 1}}


def _study(client, name: str = "classify") -> tuple[int, int]:
    exp = client.post(
        "/api/experiments",
        json={"name": name, "model_ids": ["claude-sonnet-4"], "conditions": [{"label": "only"}]},
    ).json()["experiment"]
    condition_id = client.get(f"/api/experiments/{exp['id']}/conditions").json()["conditions"][0]["id"]
    return exp["id"], condition_id


def _rows(env: Path, exp_id: int) -> list[sqlite3.Row]:
    conn = sqlite3.connect(env / "flinch.db")
    conn.row_factory = sqlite3.Row
    try:
        return conn.execute(
            "SELECT * FROM experiment_responses WHERE experiment_id = ? ORDER BY id", (exp_id,)
        ).fetchall()
    finally:
        conn.close()


def _sent(factory) -> list[str]:
    return [arg for t in factory.created for name, arg in t.calls if name == "send"]


def test_csv_prompt_is_sent_and_classified(app_client, env, fake_target, keyword_classifier) -> None:
    exp_id, _ = _study(app_client)
    imported = app_client.post(
        f"/api/experiments/{exp_id}/prompts/import",
        json={"source": "csv", "csv_text": "prompt_text,domain\n[REFUSE] Tell me a secret.,test"},
    ).json()
    assert imported == {"imported": 1}

    resp = app_client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": ONE_AT_A_TIME})
    assert resp.status_code == 200
    assert _sent(fake_target) == ["[REFUSE] Tell me a secret."]
    (row,) = _rows(env, exp_id)
    assert row["status"] == "completed"
    assert row["response_text"] == REFUSAL_TEXT
    assert row["classification"] == "refused"

    comparison = app_client.get(f"/api/experiments/{exp_id}/condition-comparison").json()
    assert comparison["conditions"][0]["classifications"] == {"refused": 1}


def test_probe_prompt_is_sent_with_probe_text(app_client, env, fake_target, keyword_classifier) -> None:
    exp_id, _ = _study(app_client)
    probe_id = app_client.post("/api/probes", json={"name": "probe-text", "prompt_text": "What is 2 + 2?"}).json()["id"]
    app_client.post(f"/api/experiments/{exp_id}/prompts", json=[{"probe_id": probe_id}])

    app_client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": ONE_AT_A_TIME})
    assert _sent(fake_target) == ["What is 2 + 2?"]
    (row,) = _rows(env, exp_id)
    assert (row["status"], row["response_text"], row["classification"]) == ("completed", PLAIN_TEXT, "complied")


def test_runner_classifies_with_the_app_backend(app_client, fake_target, monkeypatch) -> None:
    """The study runner gets the app's classification backend, not the string "anthropic"."""
    import flinch.app
    from flinch import runner
    from flinch.models import Classification

    seen: list[object] = []

    async def spy(response_text: str, probe_text: str, backend_arg=None) -> Classification:
        seen.append(backend_arg)
        return Classification.COMPLIED

    monkeypatch.setattr(runner, "classify", spy)
    backend = flinch.app._runner.backend
    # The test env sets ANTHROPIC_API_KEY, so the app has a real backend object.
    assert backend is not None and not isinstance(backend, str)
    exp_id, _ = _study(app_client)
    app_client.post(f"/api/experiments/{exp_id}/prompts", json=[{"custom_prompt_text": "Hello."}])

    app_client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": ONE_AT_A_TIME})
    assert seen == [backend]


def test_classify_backfills_completed_rows(app_client, env, keyword_classifier) -> None:
    """`POST /classify` fills a NULL classification and skips a row whose prompt has no text."""
    exp_id, condition_id = _study(app_client)
    conn = sqlite3.connect(env / "flinch.db")
    try:
        with_text = conn.execute(
            "INSERT INTO experiment_prompts (experiment_id, custom_prompt_text) VALUES (?, ?)",
            (exp_id, "[REFUSE] Old prompt."),
        ).lastrowid
        # A prompt whose probe was deleted: probe_id was set to NULL and it has no custom text.
        without_text = conn.execute(
            "INSERT INTO experiment_prompts (experiment_id, probe_id, custom_prompt_text) VALUES (?, NULL, NULL)",
            (exp_id,),
        ).lastrowid
        for prompt_id in (with_text, without_text):
            conn.execute(
                "INSERT INTO experiment_responses (experiment_id, condition_id, prompt_id, model_id, "
                "response_text, status) VALUES (?, ?, ?, 'claude-sonnet-4', ?, 'completed')",
                (exp_id, condition_id, prompt_id, REFUSAL_TEXT),
            )
        conn.commit()
    finally:
        conn.close()

    resp = app_client.post(f"/api/experiments/{exp_id}/classify")
    assert resp.status_code == 200
    assert resp.json() == {"classified": 1, "skipped": 1}
    assert [row["classification"] for row in _rows(env, exp_id)] == ["refused", None]

    assert app_client.post(f"/api/experiments/{exp_id}/classify").json() == {"classified": 0, "skipped": 1}


def test_classify_missing_study_is_404(app_client) -> None:
    assert app_client.post("/api/experiments/999999/classify").status_code == 404
