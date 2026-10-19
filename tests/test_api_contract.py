"""The sidecar routes the new app calls (I3, brief 13.1)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
ENDPOINTS_JSON = ROOT / "ui" / "src" / "lib" / "api" / "endpoints.paths.json"

EXPECTED_PROVIDERS = {"anthropic", "openai", "google", "xai", "meta"}


def test_app_routes_exist() -> None:
    import flinch.app

    routes = json.loads(ENDPOINTS_JSON.read_text(encoding="utf-8"))
    assert routes, "endpoints.paths.json is empty"
    paths = flinch.app.app.openapi()["paths"]
    missing = [
        f"{r['method']} {r['path']}"
        for r in routes
        if r["method"].lower() not in paths.get(r["path"], {})
    ]
    assert not missing, f"routes missing from the app: {missing}"


def test_settings_keys_shape(app_client, monkeypatch: pytest.MonkeyPatch) -> None:
    """Five entries, string provider, boolean is_set, no raw key (verify-phase1.py:130-158)."""
    raw_key = "sk-ant-test-0123456789abcdefghij"
    monkeypatch.setenv("ANTHROPIC_API_KEY", raw_key)
    resp = app_client.get("/api/settings/keys")
    assert resp.status_code == 200
    entries = resp.json()
    assert isinstance(entries, list)
    assert len(entries) == 5
    for entry in entries:
        assert isinstance(entry["provider"], str)
        assert isinstance(entry["is_set"], bool)
        assert "key" not in entry
    assert {e["provider"] for e in entries} == EXPECTED_PROVIDERS
    assert raw_key not in resp.text
    by_provider = {e["provider"]: e for e in entries}
    assert by_provider["anthropic"]["is_set"] is True
    assert by_provider["openai"]["is_set"] is False
