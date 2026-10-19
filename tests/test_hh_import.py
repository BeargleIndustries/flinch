"""The HH-RLHF importer runs offline against the fake model server's /rows stub (B39, D21)."""

from __future__ import annotations

import json

import pytest


@pytest.fixture
def hh_stub(fake_model_server: str, monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setenv("FLINCH_HF_API_BASE", fake_model_server)
    return fake_model_server


def _study(client) -> int:
    return client.post(
        "/api/experiments", json={"name": "hh", "model_ids": ["claude-sonnet-4"], "conditions": [{"label": "only"}]},
    ).json()["experiment"]["id"]


def _import(client, exp_id: int, **body) -> dict:
    resp = client.post(f"/api/experiments/{exp_id}/prompts/import-hh", json=body)
    assert resp.status_code == 200
    events = []
    for block in resp.text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in lines:
            events.append((lines["event"], json.loads(lines.get("data", "{}"))))
    (complete,) = [data for name, data in events if name == "complete"]
    return complete


def _prompts(client, exp_id: int) -> list[dict]:
    return client.get(f"/api/experiments/{exp_id}/prompts").json()["prompts"]


def test_imports_two_prompts_with_stratification(app_client, hh_stub: str) -> None:
    exp_id = _study(app_client)

    result = _import(app_client, exp_id, target_count=2, stratification={"factual": 0.5, "ethical": 0.5})

    assert result["imported"] == 2
    assert result["by_domain"] == {"factual": 1, "ethical": 1}
    prompts = _prompts(app_client, exp_id)
    assert sorted(p["domain"] for p in prompts) == ["ethical", "factual"]
    # The stub's synthetic rows, not the real dataset
    assert all("(case " in p["custom_prompt_text"] for p in prompts)


def test_default_stratification(app_client, hh_stub: str) -> None:
    exp_id = _study(app_client)

    result = _import(app_client, exp_id, target_count=20)

    assert result["imported"] == 20
    assert result["by_domain"] == {"factual": 7, "advice": 5, "opinion": 5, "ethical": 3}


def test_imports_nothing_when_study_has_prompts(app_client, hh_stub: str) -> None:
    exp_id = _study(app_client)
    app_client.post(f"/api/experiments/{exp_id}/prompts", json=[{"custom_prompt_text": "Mine."}])

    result = _import(app_client, exp_id, target_count=2)

    assert result["imported"] == 0
    assert result["skipped"] == 1
    assert [p["custom_prompt_text"] for p in _prompts(app_client, exp_id)] == ["Mine."]
