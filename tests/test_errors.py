"""Configuration errors are 400, missing things are 404 (B17)."""

from __future__ import annotations

import pytest


@pytest.fixture
def no_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:9")


def _probe(client) -> int:
    resp = client.post("/api/probes", json={"name": "p-errors", "prompt_text": "hello"})
    return resp.json()["id"]


def _session(client, target_model: str) -> int:
    resp = client.post("/api/sessions", json={"name": "s", "target_model": target_model})
    return resp.json()["id"]


def test_missing_anthropic_key_is_400(no_keys, app_client) -> None:
    probe_id = _probe(app_client)
    session_id = _session(app_client, "claude-sonnet-4-20250514")
    resp = app_client.post(f"/api/sessions/{session_id}/run", json={"probe_id": probe_id})
    assert resp.status_code == 400
    assert "Anthropic API key required" in resp.json()["detail"]


def test_unknown_model_prefix_is_400(app_client) -> None:
    probe_id = _probe(app_client)
    session_id = _session(app_client, "mystery-model-1")
    resp = app_client.post(f"/api/sessions/{session_id}/run", json={"probe_id": probe_id})
    assert resp.status_code == 400
    assert "Unknown model prefix" in resp.json()["detail"]


def test_missing_session_is_404(app_client) -> None:
    probe_id = _probe(app_client)
    resp = app_client.post("/api/sessions/9999/run", json={"probe_id": probe_id})
    assert resp.status_code == 404


def test_missing_probe_is_404(app_client) -> None:
    session_id = _session(app_client, "claude-sonnet-4-20250514")
    resp = app_client.post(f"/api/sessions/{session_id}/run", json={"probe_id": 9999})
    assert resp.status_code == 404


@pytest.mark.parametrize("action", ["pushback", "continue"])
def test_missing_run_is_404(app_client, action: str) -> None:
    resp = app_client.post(f"/api/runs/9999/{action}", json={"text": "why not?"})
    assert resp.status_code == 404
