"""Every key change rebuilds the runner, so target, classifier and coach see it (B29)."""

from __future__ import annotations

import pytest

import flinch.app
from flinch.llm import AnthropicBackend, OpenAIBackend

TEST_KEY = "sk-ant-test-0000000000"


@pytest.fixture
def no_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    """No provider key and no reachable Ollama; set-then-delete so route writes are undone."""
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    monkeypatch.setenv("OPENAI_API_KEY", "placeholder")
    monkeypatch.delenv("OPENAI_API_KEY")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:9")


def test_startup_builds_runner_with_backend(app_client) -> None:
    runner = flinch.app._runner
    assert runner.client is not None
    assert isinstance(runner.backend, AnthropicBackend)


def test_set_key_rebuilds_and_clear_key_empties(no_keys, app_client) -> None:
    assert flinch.app._runner.client is None
    assert flinch.app._runner.backend is None

    resp = app_client.post(
        "/api/settings/set-key", json={"provider": "anthropic", "key": TEST_KEY}
    )
    assert resp.json() == {"ok": True}
    assert flinch.app._runner.client is not None
    assert isinstance(flinch.app._runner.backend, AnthropicBackend)

    resp = app_client.delete("/api/settings/set-key", params={"provider": "anthropic"})
    assert resp.json() == {"ok": True}
    assert flinch.app._runner.client is None
    assert flinch.app._runner.backend is None


def test_settings_keys_rebuilds_with_backend(no_keys, app_client) -> None:
    resp = app_client.post("/api/settings/keys", json={"ANTHROPIC_API_KEY": TEST_KEY})
    assert resp.status_code == 200
    assert flinch.app._runner.client is not None
    assert isinstance(flinch.app._runner.backend, AnthropicBackend)

    resp = app_client.post("/api/settings/keys", json={"ANTHROPIC_API_KEY": ""})
    assert resp.status_code == 200
    assert flinch.app._runner.client is None
    assert flinch.app._runner.backend is None


def test_non_anthropic_key_reaches_classifier_and_coach(no_keys, app_client) -> None:
    resp = app_client.post("/api/settings/set-key", json={"provider": "openai", "key": "sk-test"})
    assert resp.json() == {"ok": True}
    assert flinch.app._runner.client is None
    assert isinstance(flinch.app._runner.backend, OpenAIBackend)
