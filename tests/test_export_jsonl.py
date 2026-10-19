"""B06: `/export?format=jsonl` streams one response row per line; plain `/export` is a JSON download."""

from __future__ import annotations

import json

FAST = {"openai": {"rpm": 10000, "concurrent": 5}}


def test_export_jsonl_and_json(app_client, fake_target, keyword_classifier) -> None:
    exp_id = app_client.post(
        "/api/experiments",
        json={"name": "jsonl", "model_ids": ["gpt-4o"], "conditions": [{"label": "a"}, {"label": "b"}]},
    ).json()["experiment"]["id"]
    app_client.post(f"/api/experiments/{exp_id}/prompts",
                    json=[{"custom_prompt_text": "One."}, {"custom_prompt_text": "Two."}])
    resp = app_client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": FAST})
    assert "event: complete" in resp.text

    resp = app_client.get(f"/api/experiments/{exp_id}/export", params={"format": "jsonl"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/x-ndjson")
    assert resp.headers["content-disposition"] == f'attachment; filename="study-{exp_id}-responses.jsonl"'
    lines = resp.text.splitlines()
    assert len(lines) == 4
    rows = [json.loads(line) for line in lines]
    for row in rows:
        assert isinstance(row, dict)
        for key in ("condition_id", "prompt_id", "model_id", "repetition", "classification"):
            assert key in row
        assert row["repetition"] == 0
        assert row["status"] == "completed"
    assert [r["id"] for r in rows] == sorted(r["id"] for r in rows)

    resp = app_client.get(f"/api/experiments/{exp_id}/export")
    assert resp.status_code == 200
    assert resp.headers["content-disposition"] == f'attachment; filename="study-{exp_id}.json"'
    body = resp.json()
    assert body["experiment"]["id"] == exp_id
    assert len(body["conditions"]) == 2


def test_export_jsonl_empty_study(app_client) -> None:
    exp_id = app_client.post("/api/experiments", json={"name": "empty"}).json()["experiment"]["id"]
    resp = app_client.get(f"/api/experiments/{exp_id}/export?format=jsonl")
    assert resp.status_code == 200
    assert resp.text == ""
