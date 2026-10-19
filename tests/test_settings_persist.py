"""The coach default and the Ollama base URL survive a restart (B22, I9)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import flinch.app
from flinch.target import OllamaTarget


@pytest.fixture
def ollama_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unset the Ollama variables; set-then-delete registers them so route writes are undone."""
    for name in ("OLLAMA_BASE_URL", "LOCAL_MODEL_URL"):
        monkeypatch.setenv(name, "placeholder")
        monkeypatch.delenv(name)


def test_coach_default_survives_restart() -> None:
    with TestClient(flinch.app.app) as client:
        assert client.get("/api/settings/coach-default").json() == {
            "backend": "anthropic",
            "model": "",
        }
        resp = client.post(
            "/api/settings/coach-default", json={"backend": "openai", "model": "gpt-4o-mini"}
        )
        assert resp.json() == {"backend": "openai", "model": "gpt-4o-mini"}

    with TestClient(flinch.app.app) as client:
        assert client.get("/api/settings/coach-default").json() == {
            "backend": "openai",
            "model": "gpt-4o-mini",
        }
        resp = client.post("/api/settings/coach-default", json={"model": "gpt-4.1"})
        assert resp.json() == {"backend": "openai", "model": "gpt-4.1"}


def test_coach_default_global_is_gone() -> None:
    assert not hasattr(flinch.app, "_coach_defaults")


def test_ollama_url_reaches_targets_and_survives_restart(
    ollama_env, monkeypatch: pytest.MonkeyPatch
) -> None:
    with TestClient(flinch.app.app) as client:
        resp = client.post("/api/settings/ollama", json={"base_url": "http://127.0.0.1:9"})
        assert resp.status_code == 200
        assert str(OllamaTarget("ollama:x")._client.base_url) == "http://127.0.0.1:9/v1/"

    monkeypatch.delenv("OLLAMA_BASE_URL")
    with TestClient(flinch.app.app) as client:
        assert flinch.app.os.environ["OLLAMA_BASE_URL"] == "http://127.0.0.1:9"
        assert client.get("/api/settings/ollama").json()["base_url"] == "http://127.0.0.1:9"
        assert str(OllamaTarget("ollama:x")._client.base_url) == "http://127.0.0.1:9/v1/"


def test_explicit_ollama_variable_beats_persisted(
    ollama_env, monkeypatch: pytest.MonkeyPatch
) -> None:
    with TestClient(flinch.app.app) as client:
        client.post("/api/settings/ollama", json={"base_url": "http://127.0.0.1:9"})

    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:10")
    with TestClient(flinch.app.app):
        assert flinch.app.os.environ["OLLAMA_BASE_URL"] == "http://127.0.0.1:10"


def test_local_model_url_still_wins(ollama_env, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("LOCAL_MODEL_URL", "http://127.0.0.1:11/v1")
    assert str(OllamaTarget("ollama:x")._client.base_url) == "http://127.0.0.1:11/v1/"


def test_llm_ollama_fallback_uses_settings_url(
    ollama_env, monkeypatch: pytest.MonkeyPatch
) -> None:
    import httpx

    from flinch import llm

    monkeypatch.delenv("ANTHROPIC_API_KEY")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:9/")
    seen: list[str] = []

    def fake_get(url: str, timeout: float = 0) -> httpx.Response:
        seen.append(url)
        return httpx.Response(200, json={"models": [{"name": "llama3.2"}]})

    monkeypatch.setattr(httpx, "get", fake_get)
    backend = llm.get_best_available_backend()

    assert seen == ["http://127.0.0.1:9/api/tags"]
    assert isinstance(backend, llm.OpenAICompatibleBackend)
    assert str(backend._client.base_url) == "http://127.0.0.1:9/v1/"
