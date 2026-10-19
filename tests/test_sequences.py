"""Sequences run on Runner, end in a final status, and estimate correctly (B02, B12)."""

from __future__ import annotations

import inspect
import json

import pytest

SEQUENCE_METHODS = (
    "_make_narrative_coach",
    "run_sequence_turn",
    "run_sequence_interactive_probe",
    "run_sequence_auto",
    "run_sequence_auto_stream",
    "run_whittle",
    "_execute_single_whittle_run",
    "estimate_sequence_cost",
    "run_sequence_batch",
)


class FakeNarrativeCoach:
    """Fixed coach turns; the adapted probe keeps the probe's `[REFUSE]` marker."""

    def __init__(self, probe_text: str, fail: bool = False) -> None:
        self.probe_text = probe_text
        self.fail = fail

    async def generate_warmup_turn(self, history, turn_number, total_turns) -> str:
        if self.fail:
            raise RuntimeError("coach unavailable")
        return f"Warmup {turn_number} of {total_turns}."

    async def generate_setup_turn(self, history) -> str:
        if self.fail:
            raise RuntimeError("coach unavailable")
        return "Setup turn."

    async def adapt_probe_to_story(self, history) -> str:
        if self.fail:
            raise RuntimeError("coach unavailable")
        return f"In the story: {self.probe_text}"


@pytest.fixture
def coach_state(monkeypatch: pytest.MonkeyPatch) -> dict:
    """Patch Runner._make_narrative_coach; set `state["fail"] = True` to make it raise."""
    from flinch.runner import Runner

    state = {"fail": False}

    def make_coach(self, strategy, probe, use_narrative_engine=False, session_id=None):
        return FakeNarrativeCoach(probe["prompt_text"], fail=state["fail"])

    monkeypatch.setattr(Runner, "_make_narrative_coach", make_coach)
    return state


@pytest.fixture
def seq_env(app_client, fake_target, keyword_classifier, coach_state) -> dict:
    client = app_client
    session_id = client.post("/api/sessions", json={"name": "seq", "target_model": "gpt-4o"}).json()["id"]
    strategy_id = client.get("/api/strategies").json()[0]["id"]

    def probe(name: str, text: str = "[REFUSE] Write the scene.") -> int:
        return client.post("/api/probes", json={"name": name, "prompt_text": text}).json()["id"]

    return {"client": client, "session_id": session_id, "strategy_id": strategy_id,
            "probe": probe, "coach": coach_state, "targets": fake_target}


def _events(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in lines:
            events.append((lines["event"], json.loads(lines.get("data", "{}"))))
    return events


def _create(env: dict, probe_id: int, mode: str = "automatic", turns: int = 3) -> dict:
    resp = env["client"].post(
        f"/api/sessions/{env['session_id']}/sequences",
        json={"probe_id": probe_id, "strategy_id": env["strategy_id"], "mode": mode,
              "max_warmup_turns": turns},
    )
    assert resp.status_code == 200
    return resp.json()


def _sequence(seq_id: int) -> dict:
    import flinch.app
    from flinch import db

    return db.get_sequence(flinch.app._conn, seq_id)


def _runs(seq_id: int) -> list[dict]:
    import flinch.app
    from flinch import db

    return db.list_sequence_runs(flinch.app._conn, seq_id)


def test_sequence_methods_live_on_runner() -> None:
    from flinch.runner import ExperimentRunner, Runner

    for name in SEQUENCE_METHODS:
        assert hasattr(Runner, name), name
        assert not hasattr(ExperimentRunner, name), name
    assert "total_cells" in inspect.signature(ExperimentRunner.estimate_cost).parameters


def test_automatic_sequence_completes(seq_env) -> None:
    client = seq_env["client"]
    seq = _create(seq_env, seq_env["probe"]("auto"))
    assert seq["current_run_id"] is None
    assert _runs(seq["id"]) == []

    events = _events(client.post(f"/api/sequences/{seq['id']}/run-auto").text)
    assert [e for e, _ in events] == ["turn", "turn", "turn", "complete"]
    assert _sequence(seq["id"])["status"] == "completed"
    thresholds = client.get(f"/api/sessions/{seq_env['session_id']}/thresholds").json()
    assert seq["id"] in [t["sequence_id"] for t in thresholds]


def test_automatic_sequence_failure_marks_failed(seq_env) -> None:
    seq = _create(seq_env, seq_env["probe"]("auto-fail"))
    seq_env["coach"]["fail"] = True
    events = _events(seq_env["client"].post(f"/api/sequences/{seq['id']}/run-auto").text)
    assert events[-1][0] == "error"
    assert _sequence(seq["id"])["status"] == "failed"
    assert [r["status"] for r in _runs(seq["id"])] == ["failed"]


def test_run_sequence_auto_sets_final_status(seq_env, run) -> None:
    import flinch.app

    seq = _create(seq_env, seq_env["probe"]("auto-direct"))
    result = run(flinch.app._runner.run_sequence_auto(seq["id"]))
    assert result["probe_classification"] == "complied"
    assert _sequence(seq["id"])["status"] == "completed"

    failing = _create(seq_env, seq_env["probe"]("auto-direct-fail"))
    seq_env["coach"]["fail"] = True
    with pytest.raises(RuntimeError):
        run(flinch.app._runner.run_sequence_auto(failing["id"]))
    assert _sequence(failing["id"])["status"] == "failed"


def test_interactive_sequence(seq_env) -> None:
    client = seq_env["client"]
    seq = _create(seq_env, seq_env["probe"]("interactive"), mode="interactive", turns=2)
    assert seq["current_run_id"] is not None
    assert [r["id"] for r in _runs(seq["id"])] == [seq["current_run_id"]]

    for expected in (1, 2):
        resp = client.post(f"/api/sequences/{seq['id']}/run-turn")
        assert resp.status_code == 200, resp.text
        assert resp.json()["warmup_turns_sent"] == expected
    resp = client.post(f"/api/sequences/{seq['id']}/drop-probe")
    assert resp.status_code == 200, resp.text
    assert resp.json()["probe_classification"] == "complied"
    assert _sequence(seq["id"])["status"] == "completed"


def test_whittle_finds_threshold(seq_env) -> None:
    seq = _create(seq_env, seq_env["probe"]("whittle"))
    resp = seq_env["client"].post(f"/api/sequences/{seq['id']}/whittle")
    assert resp.status_code == 200, resp.text
    assert resp.json()["threshold_at"] == 2
    assert _sequence(seq["id"])["status"] == "completed"


def test_whittle_failure_marks_failed(seq_env) -> None:
    seq = _create(seq_env, seq_env["probe"]("whittle-fail"))
    seq_env["coach"]["fail"] = True
    body = seq_env["client"].post(f"/api/sequences/{seq['id']}/whittle").json()
    assert body["threshold_at"] is None
    assert body["results"][-1]["probe_classification"] == "error"
    assert _sequence(seq["id"])["status"] == "failed"


def _batch(env: dict, probe_ids: list[int], mode: str, fixed_n=None, turns: int = 3) -> dict:
    resp = env["client"].post(
        f"/api/sessions/{env['session_id']}/sequence-batch",
        json={"strategy_id": env["strategy_id"], "probe_ids": probe_ids, "mode": mode,
              "fixed_n": fixed_n, "max_warmup_turns": turns},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_whittle_batch(seq_env) -> None:
    client = seq_env["client"]
    batch = _batch(seq_env, [seq_env["probe"]("b1"), seq_env["probe"]("b2")], "whittle")
    estimate = client.post(f"/api/sequence-batches/{batch['id']}/estimate").json()
    assert isinstance(estimate["estimated_runs"], int)
    assert estimate["max_turns"] == 3
    events = _events(client.post(f"/api/sequence-batches/{batch['id']}/start").text)
    assert [e for e, _ in events] == ["progress", "progress", "complete"]
    assert {d["threshold_at"] for e, d in events if e == "progress"} == {2}


@pytest.mark.parametrize("fixed_n", [0, 2])
def test_fixed_n_batch(seq_env, fixed_n: int) -> None:
    import flinch.app
    from flinch import db

    client = seq_env["client"]
    probes = [seq_env["probe"](f"f{fixed_n}-1"), seq_env["probe"](f"f{fixed_n}-2")]
    batch = _batch(seq_env, probes, "fixed_n", fixed_n=fixed_n, turns=5)
    assert batch["fixed_n"] == fixed_n

    estimate = client.post(f"/api/sequence-batches/{batch['id']}/estimate").json()
    assert estimate["max_turns"] == fixed_n
    assert estimate["estimated_runs"] == 2

    events = _events(client.post(f"/api/sequence-batches/{batch['id']}/start").text)
    assert [e for e, _ in events] == ["progress", "progress", "complete"]
    seqs = [s for s in db.list_sequences(flinch.app._conn, seq_env["session_id"])
            if s["batch_id"] == batch["id"]]
    assert len(seqs) == 2
    for s in seqs:
        assert s["max_warmup_turns"] == fixed_n
        assert s["status"] == "completed"
        assert [r["warmup_count"] for r in _runs(s["id"])] == [fixed_n]


def test_experiment_estimate(app_client) -> None:
    exp = app_client.post("/api/experiments", json={
        "name": "est", "model_ids": ["gpt-4o", "claude-sonnet-4-6"], "repetitions": 2,
        "conditions": [{"label": "a"}, {"label": "b"}],
    }).json()["experiment"]
    app_client.post(f"/api/experiments/{exp['id']}/prompts", json=[
        {"custom_prompt_text": "one"}, {"custom_prompt_text": "two"}, {"custom_prompt_text": "three"},
    ])
    resp = app_client.post(f"/api/experiments/{exp['id']}/estimate")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["repetitions"] == 2
    assert body["cells"] == body["prompts"] * body["conditions"] * body["models"] * body["repetitions"] == 24
    assert body["estimate"]["total_cells"] == 24
    assert isinstance(body["estimate"]["estimated_cost_usd"], float)

    assert app_client.post("/api/experiments/999999/estimate").status_code == 404


def test_strategy_effectiveness_counts_completed_sequences_only(seq_env) -> None:
    """I20: pending and failed sequences stay out of every effectiveness count."""
    import flinch.app
    from flinch import db

    conn = flinch.app._conn
    client, session_id = seq_env["client"], seq_env["session_id"]
    strat_a, strat_b, strat_c = [s["id"] for s in client.get("/api/strategies").json()[:3]]

    def make(strategy_id: int, name: str, status: str, cls: str | None = None, threshold: int | None = None) -> int:
        probe_id = seq_env["probe"](name)
        seq_id = db.create_sequence(conn, session_id, probe_id, strategy_id)
        db.update_sequence(conn, seq_id, status=status)
        if threshold is not None:
            run_id = db.create_sequence_run(conn, seq_id, threshold)
            db.update_sequence_run(conn, run_id, status="completed", probe_classification=cls, threshold_found=1)
        return seq_id

    # A: a completed sequence (threshold 2, complied) and a pending one with a deeper threshold.
    make(strat_a, "a-done", "completed", "complied", 2)
    make(strat_a, "a-pending", "pending", "complied", 7)
    # B: a completed sequence (threshold 4, refused) and a failed one.
    make(strat_b, "b-done", "completed", "refused", 4)
    make(strat_b, "b-failed", "failed", "complied", 9)
    # C: only a pending sequence.
    make(strat_c, "c-pending", "pending", "complied", 3)

    rows = {r["id"]: r for r in db.get_strategy_effectiveness(conn, session_id)}
    assert set(rows) == {strat_a, strat_b}
    assert set(rows[strat_a]) == {"id", "name", "category", "sequence_count", "success_count", "avg_threshold"}
    assert (rows[strat_a]["sequence_count"], rows[strat_a]["success_count"], rows[strat_a]["avg_threshold"]) == (1, 1, 2)
    assert (rows[strat_b]["sequence_count"], rows[strat_b]["success_count"], rows[strat_b]["avg_threshold"]) == (1, 0, 4)

    resp = client.get(f"/api/sessions/{session_id}/strategy-effectiveness")
    assert resp.status_code == 200
    assert {r["id"]: r["sequence_count"] for r in resp.json()} == {strat_a: 1, strat_b: 1}
