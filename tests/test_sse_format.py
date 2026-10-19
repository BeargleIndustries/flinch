"""One SSE format on every streaming route, and the I27 closing order (B05, I2, I27).

Every block is `event: {name}\\ndata: {json}\\n\\n`. The parser-side rule that a
block with no `event:` line counts as `message` is a client test (T13).
"""

from __future__ import annotations

import asyncio
import json

import pytest


class _Coach:
    """Fixed narrative-coach turns, so sequences never call a model."""

    def __init__(self, probe_text: str) -> None:
        self.probe_text = probe_text

    async def generate_warmup_turn(self, history, turn_number, total_turns) -> str:
        return f"Warmup {turn_number} of {total_turns}."

    async def generate_setup_turn(self, history) -> str:
        return "Setup turn."

    async def adapt_probe_to_story(self, history) -> str:
        return f"In the story: {self.probe_text}"


@pytest.fixture
def sse_env(app_client, fake_target, fake_rater, keyword_classifier, monkeypatch) -> dict:
    """A session, probe, sequence, sequence batch and a 1x1x1 study, all with fakes."""
    import flinch.app
    from flinch.runner import Runner

    def make_coach(self, strategy, probe, use_narrative_engine=False, session_id=None):
        return _Coach(probe["prompt_text"])

    async def fake_hh_import(self, db_conn, experiment_id, **kwargs) -> dict:
        return {"imported": 0, "experiment_id": experiment_id}

    monkeypatch.setattr(Runner, "_make_narrative_coach", make_coach)
    monkeypatch.setattr(flinch.app.HHRLHFImporter, "import_to_experiment", fake_hh_import)

    client = app_client
    session_id = client.post("/api/sessions", json={"name": "sse", "target_model": "gpt-4o"}).json()["id"]
    probe_id = client.post("/api/probes", json={"name": "sse-p", "prompt_text": "Say hello."}).json()["id"]
    strategy_id = client.get("/api/strategies").json()[0]["id"]
    sequence_id = client.post(
        f"/api/sessions/{session_id}/sequences",
        json={"probe_id": probe_id, "strategy_id": strategy_id, "mode": "automatic", "max_warmup_turns": 2},
    ).json()["id"]
    seq_batch_id = client.post(
        f"/api/sessions/{session_id}/sequence-batch",
        json={"strategy_id": strategy_id, "probe_ids": [probe_id], "mode": "whittle", "max_warmup_turns": 2},
    ).json()["id"]
    exp_id = client.post(
        "/api/experiments",
        json={"name": "sse study", "model_ids": ["gpt-4o"], "conditions": [{"label": "plain"}]},
    ).json()["experiment"]["id"]
    client.post(f"/api/experiments/{exp_id}/prompts", json=[{"custom_prompt_text": "Say hello."}])
    return {"client": client, "session_id": session_id, "probe_id": probe_id,
            "sequence_id": sequence_id, "seq_batch_id": seq_batch_id, "exp_id": exp_id}


ROUTES = {
    "batch": lambda e: (f"/api/sessions/{e['session_id']}/batch", {"probe_ids": [e["probe_id"]], "delay_ms": 0}),
    "stat-run": lambda e: (f"/api/sessions/{e['session_id']}/stat-run", {"probe_ids": [e["probe_id"]], "repeat_count": 1}),
    "run-auto": lambda e: (f"/api/sequences/{e['sequence_id']}/run-auto", None),
    "sequence-batch": lambda e: (f"/api/sequence-batches/{e['seq_batch_id']}/start", None),
    "start": lambda e: (f"/api/experiments/{e['exp_id']}/start", {}),
    "resume": lambda e: (f"/api/experiments/{e['exp_id']}/resume", {}),
    "metrics": lambda e: (f"/api/experiments/{e['exp_id']}/metrics", None),
    "rate": lambda e: (f"/api/experiments/{e['exp_id']}/rate", {"rater_models": ["fake-rater"]}),
    "import-hh": lambda e: (f"/api/experiments/{e['exp_id']}/prompts/import-hh", {"target_count": 1}),
}


def _blocks(text: str) -> list[list[str]]:
    return [block.splitlines() for block in text.split("\n\n") if block.strip()]


def _post(client, path: str, body):
    return client.post(path, json=body) if body is not None else client.post(path)


@pytest.mark.parametrize("route", list(ROUTES))
def test_route_emits_named_events(sse_env, route: str) -> None:
    path, body = ROUTES[route](sse_env)
    resp = _post(sse_env["client"], path, body)
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert resp.headers["cache-control"] == "no-cache"
    assert resp.headers["x-accel-buffering"] == "no"

    blocks = _blocks(resp.text)
    assert blocks, f"{route}: empty stream"
    for lines in blocks:
        assert len(lines) == 2, lines
        assert lines[0].startswith("event: "), lines
        assert lines[1].startswith("data: {"), lines
        json.loads(lines[1][len("data: "):])
    assert blocks[0][0] != "event: error", resp.text


def test_hh_import_complete_event(sse_env) -> None:
    path, body = ROUTES["import-hh"](sse_env)
    lines = _blocks(_post(sse_env["client"], path, body).text)[0]
    assert lines[0] == "event: complete"
    assert json.loads(lines[1][len("data: "):]) == {
        "type": "complete", "imported": 0, "experiment_id": sse_env["exp_id"],
    }


def test_sequence_batch_error_is_an_event(sse_env, monkeypatch) -> None:
    """The sequence-batch route had no `try` and dropped errors (B05)."""
    from flinch.runner import Runner

    async def failing(self, batch_id: int):
        raise RuntimeError("runner exploded")
        yield  # pragma: no cover

    monkeypatch.setattr(Runner, "run_sequence_batch", failing)
    path, body = ROUTES["sequence-batch"](sse_env)
    resp = _post(sse_env["client"], path, body)
    assert resp.status_code == 200
    lines = _blocks(resp.text)[0]
    assert lines[0] == "event: error"
    assert json.loads(lines[1][len("data: "):]) == {"error": "RuntimeError: runner exploded"}


def test_route_generator_closes_runner_before_db(sse_env, monkeypatch, run) -> None:
    """A-M1: closing the route generator runs the runner's `finally` before the connection closes."""
    import flinch.app
    from flinch import db
    from flinch.models import StartExperimentRequest
    from flinch.runner import ExperimentRunner

    order: list[str] = []
    original_aexit = db._AsyncDBContext.__aexit__

    async def spy_aexit(self, *exc):
        order.append("db.close")
        return await original_aexit(self, *exc)

    async def spy_run_experiment(self, experiment_id: int):
        try:
            yield {"type": "started", "total": 1}
            await asyncio.sleep(3600)
            yield {"type": "complete"}  # pragma: no cover
        finally:
            order.append("runner.finally")

    monkeypatch.setattr(db._AsyncDBContext, "__aexit__", spy_aexit)
    monkeypatch.setattr(ExperimentRunner, "run_experiment", spy_run_experiment)

    async def drive() -> str:
        resp = await flinch.app.api_start_experiment(sse_env["exp_id"], StartExperimentRequest())
        assert isinstance(resp, flinch.app.ClosingStreamingResponse)
        gen = resp.body_iterator
        first = await gen.__anext__()
        await gen.aclose()
        return first

    first = run(drive())
    assert first.startswith("event: started\n")
    assert order == ["runner.finally", "db.close"]


def _asgi_call(response, fail_on: str):
    """Drive an ASGI response whose `send` raises OSError on the first `fail_on` message."""
    scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.3"}}

    async def receive():
        await asyncio.sleep(3600)
        return {"type": "http.disconnect"}  # pragma: no cover

    async def send(message):
        if message["type"] == fail_on:
            raise OSError("client went away")

    async def call() -> None:
        with pytest.raises(OSError):
            await response(scope, receive, send)

    asyncio.run(call())


@pytest.mark.parametrize("fail_on", ["http.response.body", "http.response.start"])
def test_closing_response_closes_generator_and_releases(fail_on: str) -> None:
    """The shielded `finally` closes the body generator, then calls `release` (R2-M1)."""
    import flinch.app

    order: list[str] = []

    async def gen():
        try:
            yield flinch.app._sse("start", {})
            await asyncio.sleep(3600)
            yield flinch.app._sse("never", {})  # pragma: no cover
        finally:
            order.append("gen.finally")

    body = gen()
    response = flinch.app._sse_response(body, release=lambda: order.append("release"))
    _asgi_call(response, fail_on)
    if fail_on == "http.response.body":
        # The generator was suspended at its first yield and is closed by the response.
        assert order == ["gen.finally", "release"]
    else:
        # The body never started: aclose() is a no-op and release still runs.
        assert order == ["release"]
    assert body.ag_frame is None  # finished


def test_sse_helper_shape() -> None:
    import flinch.app

    assert flinch.app._sse("progress", {"n": 1}) == 'event: progress\ndata: {"n": 1}\n\n'
    assert flinch.app._dict_event({"type": "started", "total": 2}) == ("started", {"type": "started", "total": 2})
    assert flinch.app._dict_event({"event": "complete"})[0] == "complete"
    assert flinch.app._dict_event({"x": 1})[0] == "message"
