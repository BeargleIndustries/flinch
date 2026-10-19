"""GET /api/ollama/status: the New session dialog's local coach models (brief 6.6, B.2).

The e2e sidecar points Ollama at a closed port, so both shapes are checked
here: an unreachable server, and a stand-in that answers Ollama's /api/tags.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import flinch.app


def _status(monkeypatch: pytest.MonkeyPatch, base_url: str) -> dict:
    monkeypatch.setenv("OLLAMA_BASE_URL", base_url)
    with TestClient(flinch.app.app) as client:
        resp = client.get("/api/ollama/status")
    assert resp.status_code == 200
    return resp.json()


def test_unreachable_ollama_reports_not_running(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _status(monkeypatch, "http://127.0.0.1:9") == {
        "available": False,
        "base_url": "http://127.0.0.1:9",
        "models": [],
        "anthropic_key_set": True,
        "anthropic_key_warning": "",
    }


def test_reachable_ollama_lists_its_models(
    monkeypatch: pytest.MonkeyPatch, serve_asgi: Callable[[object], str]
) -> None:
    tags = FastAPI()

    @tags.get("/api/tags")
    async def list_tags() -> dict:
        return {"models": [{"name": "llama3:8b"}, {"name": "qwen2.5:7b"}]}

    url = serve_asgi(tags)
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    body = _status(monkeypatch, url)
    assert body["available"] is True
    assert body["base_url"] == url
    assert body["models"] == [
        {"id": "ollama:llama3:8b", "name": "llama3:8b"},
        {"id": "ollama:qwen2.5:7b", "name": "qwen2.5:7b"},
    ]
    assert body["anthropic_key_set"] is False
    assert body["anthropic_key_warning"]
