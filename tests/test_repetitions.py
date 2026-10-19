"""B11: each (condition, prompt, model) cell runs `repetitions` times as separate rows."""

from __future__ import annotations

import csv
import io
import sqlite3
from pathlib import Path

FAST = {"openai": {"rpm": 10000, "concurrent": 5}}


def _study(client, repetitions: int | None = 3) -> int:
    body = {"name": "reps", "model_ids": ["gpt-4o"], "conditions": [{"label": "a"}]}
    if repetitions is not None:
        body["repetitions"] = repetitions
    resp = client.post("/api/experiments", json=body)
    assert resp.status_code == 200, resp.text
    exp_id = resp.json()["experiment"]["id"]
    client.post(f"/api/experiments/{exp_id}/prompts",
                json=[{"custom_prompt_text": "One."}, {"custom_prompt_text": "Two."}])
    return exp_id


def _rows(env: Path, exp_id: int) -> list[tuple]:
    conn = sqlite3.connect(env / "flinch.db")
    try:
        return conn.execute(
            "SELECT condition_id, prompt_id, model_id, repetition, status "
            "FROM experiment_responses WHERE experiment_id = ? ORDER BY id",
            (exp_id,),
        ).fetchall()
    finally:
        conn.close()


def test_create_stores_repetitions(app_client) -> None:
    exp = app_client.get(f"/api/experiments/{_study(app_client)}").json()["experiment"]
    assert exp["config"]["repetitions"] == 3
    default = app_client.get(f"/api/experiments/{_study(app_client, None)}").json()["experiment"]
    assert default["config"]["repetitions"] == 1


def test_repetitions_bounded(app_client) -> None:
    for bad in (0, 51):
        resp = app_client.post("/api/experiments", json={"name": "x", "repetitions": bad})
        assert resp.status_code == 422
    exp_id = _study(app_client, 1)
    assert app_client.put(f"/api/experiments/{exp_id}", json={"repetitions": 0}).status_code == 422


def test_edit_merges_repetitions_into_config(app_client) -> None:
    exp_id = app_client.post(
        "/api/experiments", json={"name": "e", "config": {"note": "keep"}}
    ).json()["experiment"]["id"]
    exp = app_client.put(f"/api/experiments/{exp_id}", json={"repetitions": 4}).json()
    assert exp["config"] == {"note": "keep", "repetitions": 4}
    exp = app_client.put(f"/api/experiments/{exp_id}", json={"name": "renamed"}).json()
    assert exp["config"]["repetitions"] == 4


def test_three_repetitions_run_and_export(app_client, env, fake_target, keyword_classifier) -> None:
    exp_id = _study(app_client, 3)
    resp = app_client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": FAST})
    assert resp.status_code == 200
    assert "event: complete" in resp.text

    rows = _rows(env, exp_id)
    assert len(rows) == 6
    cells: dict[tuple, set[int]] = {}
    for cond, prompt, model, rep, status in rows:
        assert status == "completed"
        cells.setdefault((cond, prompt, model), set()).add(rep)
    assert list(cells.values()) == [{0, 1, 2}, {0, 1, 2}]
    assert sum(1 for t in fake_target.created for name, _ in t.calls if name == "send") == 6

    listed = app_client.get(f"/api/experiments/{exp_id}/responses").json()["responses"]
    assert sorted(r["repetition"] for r in listed) == [0, 0, 1, 1, 2, 2]

    export = app_client.get(f"/api/experiments/{exp_id}/condition-export")
    data = list(csv.DictReader(io.StringIO(export.text)))
    assert len(data) == 6
    header = next(csv.reader(io.StringIO(export.text)))
    assert header.index("model_id") == header.index("condition_label") + 1
    assert header.index("repetition") == header.index("model_id") + 1
    assert [r["repetition"] for r in data[:3]] == ["0", "1", "2"]
    assert {r["model_id"] for r in data} == {"gpt-4o"}


def test_estimate_multiplies_by_repetitions(app_client) -> None:
    exp_id = _study(app_client, 3)
    body = app_client.post(f"/api/experiments/{exp_id}/estimate").json()
    assert body["repetitions"] == 3
    assert body["cells"] == body["prompts"] * body["conditions"] * body["models"] * 3 == 6
    assert body["estimate"]["total_cells"] == 6
