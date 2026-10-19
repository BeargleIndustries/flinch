"""An empty system prompt is a valid control condition (B08)."""

from __future__ import annotations

from flinch.models import ConditionCreate


def test_condition_control(app_client) -> None:
    assert ConditionCreate(label="Control").system_prompt == ""

    resp = app_client.post(
        "/api/experiments",
        json={
            "name": "Control study",
            "conditions": [
                {"label": "Control"},
                {"label": "Condition 1", "system_prompt": "Be brief."},
            ],
        },
    )

    assert resp.status_code == 200
    prompts = {c["label"]: c["system_prompt"] for c in resp.json()["conditions"]}
    assert prompts == {"Control": "", "Condition 1": "Be brief."}
