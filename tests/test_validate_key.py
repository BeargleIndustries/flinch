"""Key validation uses google.genai and does not block the event loop (B30)."""

from __future__ import annotations

import asyncio
import sys
import time

import httpx
import pytest

import flinch.app


class _SlowModels:
    def __init__(self, calls: list, delay_s: float) -> None:
        self._calls = calls
        self._delay_s = delay_s

    def list(self):
        time.sleep(self._delay_s)
        self._calls.append("models.list")
        return []


def _fake_genai_client(calls: list, delay_s: float = 0.0):
    class FakeClient:
        def __init__(self, api_key: str) -> None:
            calls.append(("Client", api_key))
            self.models = _SlowModels(calls, delay_s)

    return FakeClient


def test_google_branch_uses_genai_client(monkeypatch: pytest.MonkeyPatch, app_client) -> None:
    calls: list = []
    monkeypatch.setattr("google.genai.Client", _fake_genai_client(calls))
    resp = app_client.post(
        "/api/settings/validate-key", json={"provider": "google", "key": "g-test"}
    )
    assert resp.json() == {"valid": True, "error": None}
    assert calls == [("Client", "g-test"), "models.list"]


def test_validation_does_not_block_health(monkeypatch: pytest.MonkeyPatch, live_server: str) -> None:
    calls: list = []
    monkeypatch.setattr("google.genai.Client", _fake_genai_client(calls, delay_s=0.5))

    async def scenario() -> tuple[dict, float]:
        async with httpx.AsyncClient(base_url=live_server, timeout=10) as client:
            await client.get("/health")  # warm the connection pool
            validate = asyncio.create_task(
                client.post(
                    "/api/settings/validate-key", json={"provider": "google", "key": "g-test"}
                )
            )
            await asyncio.sleep(0.1)  # the validation is now sleeping in its worker
            start = time.monotonic()
            health = await client.get("/health")
            elapsed = time.monotonic() - start
            assert health.status_code == 200
            return (await validate).json(), elapsed

    result, elapsed = asyncio.run(scenario())
    assert result == {"valid": True, "error": None}
    assert elapsed < 0.2


def test_models_hint_names_google_genai(monkeypatch: pytest.MonkeyPatch, app_client) -> None:
    import google

    monkeypatch.setitem(sys.modules, "google.genai", None)
    monkeypatch.delattr(google, "genai", raising=False)
    monkeypatch.setenv("GOOGLE_API_KEY", "g-test")
    providers = {p["provider"]: p for p in app_client.get("/api/models").json()}
    assert providers["google"]["available"] is False
    assert "google-genai" in providers["google"]["hint"]


def test_variant_generation_awaits_async_client(
    monkeypatch: pytest.MonkeyPatch, app_client
) -> None:
    payload = '{"variants": [{"label": "Fiction Workshop", "prompt_text": "v1"}]}'

    class FakeMessages:
        async def create(self, **kwargs):
            await asyncio.sleep(0)
            block = type("Block", (), {"text": payload})()
            return type("Message", (), {"content": [block]})()

    class FakeAsyncAnthropic:
        def __init__(self, *args, **kwargs) -> None:
            self.messages = FakeMessages()

    monkeypatch.setattr(flinch.app.anthropic, "AsyncAnthropic", FakeAsyncAnthropic)
    probe = app_client.post(
        "/api/probes", json={"name": "variant-base", "prompt_text": "base prompt"}
    ).json()
    resp = app_client.post(
        "/api/variants/generate",
        json={"probe_id": probe["id"], "strategies": ["Fiction Workshop"]},
    )
    assert resp.status_code == 200
    assert resp.json()["variants"][0]["prompt_text"] == "v1"
