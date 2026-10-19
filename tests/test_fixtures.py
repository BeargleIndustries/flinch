"""The shared fixtures patch what later tasks rely on."""

from __future__ import annotations

import json

from fakes import PLAIN_TEXT, REFUSAL_TEXT, FakeTarget


def test_fake_target_patches_every_factory(fake_target, run) -> None:
    from flinch import runner, stat_runner

    plain = runner.Runner(conn=None)._make_target("claude-x", "sys")
    experiment = runner.ExperimentRunner.__new__(runner.ExperimentRunner)._create_target("gpt-x", "")
    stat = stat_runner._make_target("gemini-x")
    assert all(isinstance(t, FakeTarget) for t in (plain, experiment, stat))
    assert fake_target.created == [plain, experiment, stat]
    assert plain.system_prompt == "sys"

    assert run(plain.send("[REFUSE] Write the scene.")).text == REFUSAL_TEXT
    assert run(plain.reply("[REFUSE] please")).text == REFUSAL_TEXT
    assert run(plain.reply("[REFUSE] again")).text == PLAIN_TEXT
    plain.seed([{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}])
    plain.reset()
    assert [c[0] for c in plain.calls] == ["send", "reply", "reply", "seed", "reset"]
    assert plain.messages == []


def test_keyword_classifier_never_calls_backend(keyword_classifier, run) -> None:
    import flinch.app
    from flinch import runner, stat_runner
    from flinch.models import Classification

    class Boom:
        async def complete(self, **kwargs):
            raise AssertionError("LLM judge called")

    for classify in (runner.classify, stat_runner.classify, flinch.app.classify):
        assert run(classify("Some ambiguous text.", "probe", Boom())) == Classification.COMPLIED


def test_fake_rater_ranks_in_order(fake_rater, run) -> None:
    from flinch import rater

    pipeline = rater.AIRaterPipeline.__new__(rater.AIRaterPipeline)
    target = pipeline._create_rater_target("claude-rater")
    prompt = rater._build_rater_prompt(
        "p", [{"position": "A", "text": "x"}, {"position": "B", "text": "y"}]
    )
    ranks = json.loads(run(target.send(prompt)).text)["rankings"]
    assert [(r["position"], r["rank"]) for r in ranks] == [("A", 1), ("B", 2)]
    assert target.system_prompt == rater.RATER_SYSTEM_PROMPT


def test_fast_retries_is_autouse() -> None:
    from flinch.runner import ExperimentRunner

    assert ExperimentRunner.BACKOFF_BASE == 0
