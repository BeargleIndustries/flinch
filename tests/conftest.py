"""Shared pytest fixtures for the Flinch sidecar (brief 11 intro, plan section 5)."""

from __future__ import annotations

import asyncio
import importlib.util
import socket
import threading
import time
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fakes import FakeTarget, FakeTargetFactory, ranking_rule

TESTS_DIR = Path(__file__).resolve().parent

_PROVIDER_KEYS = ("OPENAI_API_KEY", "GOOGLE_API_KEY", "XAI_API_KEY", "TOGETHER_API_KEY")


@pytest.fixture(autouse=True)
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the sidecar at a temp database and env file; no real provider is reachable."""
    monkeypatch.setenv("FLINCH_DB_PATH", str(tmp_path / "flinch.db"))
    monkeypatch.setenv("FLINCH_ENV_FILE", str(tmp_path / ".env"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    # Nothing listens on port 9, so an unpatched call fails fast instead of
    # reaching a provider.
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:9")
    for key in _PROVIDER_KEYS:
        monkeypatch.delenv(key, raising=False)
    return tmp_path


@pytest.fixture(autouse=True)
def fast_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    """A failing study cell retries with 1, 2, 4, 8 s waits; make them instant."""
    from flinch.runner import ExperimentRunner

    monkeypatch.setattr(ExperimentRunner, "BACKOFF_BASE", 0)


@pytest.fixture
def app_client() -> Iterator:
    """A TestClient that runs the app's lifespan."""
    from fastapi.testclient import TestClient

    import flinch.app

    with TestClient(flinch.app.app) as client:
        yield client


@pytest.fixture
def fake_target(monkeypatch: pytest.MonkeyPatch) -> FakeTargetFactory:
    """Every target factory returns a FakeTarget; the factory records them in `created`."""
    from flinch import runner, stat_runner

    factory = FakeTargetFactory()

    def make_target(self, model_name: str, system_prompt: str = "") -> FakeTarget:
        return factory(model_name, system_prompt)

    def stat_make_target(model_name: str, client=None) -> FakeTarget:
        return factory(model_name)

    monkeypatch.setattr(runner.Runner, "_make_target", make_target)
    monkeypatch.setattr(runner.ExperimentRunner, "_create_target", make_target)
    monkeypatch.setattr(stat_runner, "_make_target", stat_make_target)
    return factory


@pytest.fixture
def fake_rater(monkeypatch: pytest.MonkeyPatch) -> FakeTargetFactory:
    """The AI rater gets a FakeTarget that ranks responses in the order shown."""
    from flinch import rater

    factory = FakeTargetFactory(rule=ranking_rule)

    def create_rater_target(self, rater_model: str) -> FakeTarget:
        return factory(rater_model, rater.RATER_SYSTEM_PROMPT)

    monkeypatch.setattr(rater.AIRaterPipeline, "_create_rater_target", create_rater_target)
    return factory


@pytest.fixture
def keyword_classifier(monkeypatch: pytest.MonkeyPatch) -> None:
    """Classification uses the keyword scan only, never an LLM judge."""
    from flinch import classifier

    original = classifier.classify

    async def keyword_only(response_text: str, probe_text: str, backend=None):
        return await original(response_text, probe_text, None)

    for module in ("flinch.classifier", "flinch.runner", "flinch.app", "flinch.stat_runner"):
        monkeypatch.setattr(f"{module}.classify", keyword_only)


@pytest.fixture
def run() -> Callable:
    """`run(coro)` drives a coroutine to completion."""
    return asyncio.run


def _serve(app, timeout_s: float = 20.0) -> tuple[str, Callable[[], None]]:
    """Run an ASGI app under uvicorn.Server in a daemon thread on a free port."""
    import uvicorn

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + timeout_s
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            server.should_exit = True
            sock.close()
            raise RuntimeError(f"uvicorn did not start on port {port}")
        time.sleep(0.02)

    def stop() -> None:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()

    return f"http://127.0.0.1:{port}", stop


@pytest.fixture
def serve_asgi() -> Iterator[Callable[[object], str]]:
    """`serve_asgi(app)` starts `app` on a free port and returns its base URL."""
    stops: list[Callable[[], None]] = []

    def start(app) -> str:
        url, stop = _serve(app)
        stops.append(stop)
        return url

    yield start
    for stop in reversed(stops):
        stop()


@pytest.fixture
def live_server(env: Path, serve_asgi: Callable[[object], str]) -> str:
    """The real sidecar over a real socket, with the temp database and env file of `env`.

    In-process patches such as `fake_target` apply because the server runs in
    this process.
    """
    import flinch.app

    return serve_asgi(flinch.app.app)


def _load_fake_models():
    spec = importlib.util.spec_from_file_location("fake_models", TESTS_DIR / "fake_models.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def fake_model_server(
    monkeypatch: pytest.MonkeyPatch, serve_asgi: Callable[[object], str]
) -> str:
    """tests/fake_models.py on a free port; the SDK base URLs point at it."""
    url = serve_asgi(_load_fake_models().app)
    monkeypatch.setenv("ANTHROPIC_BASE_URL", url)
    monkeypatch.setenv("OPENAI_BASE_URL", f"{url}/v1")
    return url
