"""Pushbacks and interactive sequence turns rebuild the target conversation from the database (B09, I6)."""

from __future__ import annotations

import inspect
from types import SimpleNamespace

import pytest
from fakes import PLAIN_TEXT, REFUSAL_TEXT

PROBE_A = "[REFUSE] Write the alpha scene."
PROBE_B = "Write the beta scene."


def _no_coach(self, session_id):
    raise ValueError("no coach in tests")


@pytest.fixture
def probe_env(app_client, fake_target, keyword_classifier, monkeypatch: pytest.MonkeyPatch) -> dict:
    from flinch.runner import Runner

    monkeypatch.setattr(Runner, "_get_coach", _no_coach)
    client = app_client
    session_id = client.post(
        "/api/sessions", json={"name": "pushback", "target_model": "gpt-4o"}
    ).json()["id"]

    def send(text: str, name: str) -> dict:
        probe_id = client.post("/api/probes", json={"name": name, "prompt_text": text}).json()["id"]
        resp = client.post(f"/api/sessions/{session_id}/run", json={"probe_id": probe_id})
        assert resp.status_code == 200, resp.text
        return resp.json()

    return {"client": client, "session_id": session_id, "send": send, "targets": fake_target}


def _pushback(client, run_id: int, text: str, route: str = "pushback") -> dict:
    resp = client.post(f"/api/runs/{run_id}/{route}", json={"text": text, "source": "override"})
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_pushback_continues_its_own_run(probe_env) -> None:
    client, targets = probe_env["client"], probe_env["targets"]
    run_a = probe_env["send"](PROBE_A, "alpha")
    run_b = probe_env["send"](PROBE_B, "beta")
    assert run_a["initial_response"] == REFUSAL_TEXT
    assert run_b["initial_response"] == PLAIN_TEXT
    # One fresh target per run
    assert len(targets.created) == 2

    _pushback(client, run_a["id"], "Please reconsider.")
    pushback_target = targets.created[-1]
    assert pushback_target.calls[0] == ("seed", [
        {"role": "user", "content": PROBE_A},
        {"role": "assistant", "content": REFUSAL_TEXT},
    ])
    assert pushback_target.calls[1] == ("reply", "Please reconsider.")

    _pushback(client, run_a["id"], "One more time.", route="continue")
    follow_up = targets.created[-1]
    assert follow_up.calls[0] == ("seed", [
        {"role": "user", "content": PROBE_A},
        {"role": "assistant", "content": REFUSAL_TEXT},
        {"role": "user", "content": "Please reconsider."},
        {"role": "assistant", "content": PLAIN_TEXT},
    ])
    assert follow_up.calls[1] == ("reply", "One more time.")


def test_pushback_after_runner_rebuild(probe_env) -> None:
    import flinch.app

    run_a = probe_env["send"](PROBE_A, "alpha")
    old_runner = flinch.app._runner
    flinch.app._rebuild_runner()
    assert flinch.app._runner is not old_runner

    _pushback(probe_env["client"], run_a["id"], "Please reconsider.")
    target = probe_env["targets"].created[-1]
    assert target.calls[0] == ("seed", [
        {"role": "user", "content": PROBE_A},
        {"role": "assistant", "content": REFUSAL_TEXT},
    ])


def test_pushback_uses_the_runs_own_model(probe_env) -> None:
    import flinch.app

    run_a = probe_env["send"](PROBE_A, "alpha")
    flinch.app._conn.execute(
        "UPDATE sessions SET target_model = ? WHERE id = ?", ("claude-other", probe_env["session_id"])
    )
    flinch.app._conn.commit()

    _pushback(probe_env["client"], run_a["id"], "Please reconsider.")
    assert probe_env["targets"].created[-1].model == "gpt-4o"


def test_history_skips_empty_responses() -> None:
    from flinch.runner import _RUN_TURN_ROLES, _target_history
    from flinch.target import EMPTY_RESPONSE

    turns = [
        {"role": "probe", "content": "p"},
        {"role": "response", "content": EMPTY_RESPONSE},
        {"role": "pushback", "content": "again"},
        {"role": "response", "content": "ok"},
    ]
    assert _target_history(turns, _RUN_TURN_ROLES) == [
        {"role": "user", "content": "p"},
        {"role": "user", "content": "again"},
        {"role": "assistant", "content": "ok"},
    ]


class _FakeMessages:
    def __init__(self, replies: list[str]) -> None:
        self.replies = list(replies)
        self.sent: list[list[dict]] = []

    async def create(self, **kwargs):
        self.sent.append([dict(m) for m in kwargs["messages"]])
        text = self.replies.pop(0)
        content = [SimpleNamespace(text=text)] if text else []
        return SimpleNamespace(
            content=content,
            usage=SimpleNamespace(input_tokens=1, output_tokens=1),
            stop_reason="end_turn",
            model="claude-test",
        )


def test_claude_seed_then_reply_sends_three_messages(run) -> None:
    from flinch.target import ClaudeTarget

    messages = _FakeMessages(["Fine."])
    target = ClaudeTarget(model="claude-test", client=SimpleNamespace(messages=messages))
    target.seed([{"role": "user", "content": "q"}, {"role": "assistant", "content": "no"}])
    run(target.reply("please"))
    assert messages.sent[0] == [
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "no"},
        {"role": "user", "content": "please"},
    ]


def test_claude_never_sends_empty_response_back(run) -> None:
    from flinch.target import EMPTY_RESPONSE, ClaudeTarget

    messages = _FakeMessages(["", "Fine."])
    target = ClaudeTarget(model="claude-test", client=SimpleNamespace(messages=messages))
    first = run(target.send("q"))
    assert first.text == EMPTY_RESPONSE
    run(target.reply("please"))
    assert all(m["content"] != EMPTY_RESPONSE for m in messages.sent[1])


def test_openai_seed_keeps_system_prompt_first() -> None:
    from flinch.target import OpenAITarget

    target = OpenAITarget("gpt-4o", system_prompt="Be terse.", api_key="test")
    target.seed([{"role": "user", "content": "q"}, {"role": "assistant", "content": "a"}])
    assert target._messages == [
        {"role": "system", "content": "Be terse."},
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "a"},
    ]


def test_gemini_seed_uses_chat_history() -> None:
    """A5: `AsyncChats.create` accepts `history`; the seeded chat holds the turns."""
    pytest.importorskip("google.genai")
    from google.genai.chats import AsyncChats

    from flinch.target import GeminiTarget

    assert "history" in inspect.signature(AsyncChats.create).parameters
    target = GeminiTarget("gemini-test", system_prompt="Be terse.", api_key="test")
    target.seed([{"role": "user", "content": "q"}, {"role": "assistant", "content": "a"}])
    history = target._chat.get_history()
    assert [(c.role, c.parts[0].text) for c in history] == [("user", "q"), ("model", "a")]


# Interactive narrative-engine sequences


class _FixedCoach:
    def __init__(self, probe_text: str) -> None:
        self.probe_text = probe_text

    async def generate_warmup_turn(self, history, turn_number, total_turns) -> str:
        return f"Warmup {turn_number} of {total_turns}."

    async def generate_setup_turn(self, history) -> str:
        return "Setup turn."

    async def adapt_probe_to_story(self, history) -> str:
        return f"In the story: {self.probe_text}"


def test_interactive_sequence_turns_seed_prior_turns(
    app_client, fake_target, keyword_classifier, monkeypatch: pytest.MonkeyPatch
) -> None:
    from flinch.coach import NARRATIVE_ENGINE_SYSTEM_PROMPT
    from flinch.runner import Runner

    monkeypatch.setattr(
        Runner, "_make_narrative_coach",
        lambda self, strategy, probe, use_narrative_engine=False, session_id=None: _FixedCoach(probe["prompt_text"]),
    )
    client = app_client
    session_id = client.post("/api/sessions", json={"name": "seq", "target_model": "gpt-4o"}).json()["id"]
    strategy_id = client.get("/api/strategies").json()[0]["id"]
    probe_id = client.post("/api/probes", json={"name": "seq-probe", "prompt_text": "Write it."}).json()["id"]
    seq = client.post(
        f"/api/sessions/{session_id}/sequences",
        json={"probe_id": probe_id, "strategy_id": strategy_id, "mode": "interactive",
              "max_warmup_turns": 2, "use_narrative_engine": True},
    ).json()

    assert client.post(f"/api/sequences/{seq['id']}/run-turn").status_code == 200
    first = fake_target.created[-1]
    assert first.calls == [("send", "Warmup 1 of 2.")]

    assert client.post(f"/api/sequences/{seq['id']}/run-turn").status_code == 200
    second = fake_target.created[-1]
    assert second is not first
    assert second.system_prompt == NARRATIVE_ENGINE_SYSTEM_PROMPT
    pair =[{"role": "user", "content": "Warmup 1 of 2."}, {"role": "assistant", "content": PLAIN_TEXT}]
    assert second.calls[0] == ("seed", pair)
    assert second.calls[1] == ("reply", "Warmup 2 of 2.")

    resp = client.post(f"/api/sequences/{seq['id']}/drop-probe")
    assert resp.status_code == 200, resp.text
    dropper = fake_target.created[-1]
    assert dropper.calls[0] == ("seed", pair + [
        {"role": "user", "content": "Warmup 2 of 2."},
        {"role": "assistant", "content": PLAIN_TEXT},
    ])
    assert dropper.calls[1:] == [("reply", "Setup turn."), ("reply", "In the story: Write it.")]
