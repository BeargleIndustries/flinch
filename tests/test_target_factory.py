"""One target factory; xAI and Together get their own keys (B37, B15, I26)."""

from __future__ import annotations

import pytest

XAI_URL = "https://api.x.ai/v1"
TOGETHER_URL = "https://api.together.xyz/v1"


@pytest.fixture
def keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "o")
    monkeypatch.setenv("XAI_API_KEY", "x")
    monkeypatch.setenv("TOGETHER_API_KEY", "t")
    monkeypatch.setenv("GOOGLE_API_KEY", "g")


def _call_sites():
    """Every factory entry point, as `build(model_id)`."""
    from flinch import rater, runner, stat_runner

    plain = runner.Runner(conn=None)
    experiment = runner.ExperimentRunner.__new__(runner.ExperimentRunner)
    pipeline = rater.AIRaterPipeline.__new__(rater.AIRaterPipeline)
    return {
        "runner": lambda m: plain._make_target(m, "sys"),
        "experiment": lambda m: experiment._create_target(m, "sys"),
        "stat": lambda m: stat_runner._make_target(m, "sys"),
        "rater": lambda m: pipeline._create_rater_target(m),
    }


def _key_and_url(target) -> tuple[str, str]:
    return target._client.api_key, str(target._client.base_url).rstrip("/")


@pytest.mark.parametrize("site", ["runner", "experiment", "stat", "rater"])
@pytest.mark.parametrize(
    ("model_id", "key", "url"),
    [
        ("grok-3", "x", XAI_URL),
        ("meta-llama/Llama-3.3-70B-Instruct-Turbo", "t", TOGETHER_URL),
        ("llama-3.1-70b", "t", TOGETHER_URL),
    ],
)
def test_xai_and_together_use_their_own_keys(keys, site, model_id, key, url) -> None:
    from flinch.target import OpenAITarget

    target = _call_sites()[site](model_id)
    assert isinstance(target, OpenAITarget)
    assert _key_and_url(target) == (key, url)


@pytest.mark.parametrize("site", ["runner", "experiment", "stat", "rater"])
@pytest.mark.parametrize(("model_id", "env_name"), [("grok-3", "XAI_API_KEY"), ("llama-3.1-70b", "TOGETHER_API_KEY")])
def test_missing_provider_key_never_falls_back_to_openai(
    keys, monkeypatch: pytest.MonkeyPatch, site, model_id, env_name
) -> None:
    monkeypatch.delenv(env_name)
    with pytest.raises(ValueError, match=env_name):
        _call_sites()[site](model_id)


def test_each_provider_maps_to_its_class(keys) -> None:
    from flinch.target import ClaudeTarget, GeminiTarget, OllamaTarget, OpenAITarget, make_target

    claude = make_target("claude-sonnet-4-6", "sys")
    assert isinstance(claude, ClaudeTarget) and claude._system_prompt == "sys"
    for model_id in ("gpt-4o", "o3-mini", "o1-preview", "o4-mini", "chatgpt-4o-latest"):
        target = make_target(model_id, "sys")
        assert type(target) is OpenAITarget
        assert target._client.api_key == "o"
    gemini = make_target("gemini-2.0-flash", "sys")
    assert isinstance(gemini, GeminiTarget) and gemini.model_name == "gemini-2.0-flash"
    ollama = make_target("ollama:gemma4:e4b", "sys")
    assert isinstance(ollama, OllamaTarget) and ollama.model_name == "gemma4:e4b"
    with pytest.raises(ValueError, match="Unknown model prefix"):
        make_target("mystery-model-1")


def test_provider_hint_covers_ids_without_a_prefix(keys) -> None:
    from flinch.runner import ExperimentRunner
    from flinch.target import ClaudeTarget, OpenAITarget, make_target

    together = make_target("deepseek-ai/DeepSeek-R1", provider_hint="together")
    assert _key_and_url(together) == ("t", TOGETHER_URL)
    experiment = ExperimentRunner.__new__(ExperimentRunner)
    # ExperimentRunner's provider rules still apply to ids the prefixes miss.
    assert _key_and_url(experiment._create_target("mistralai/Mixtral-8x7B", "")) == ("t", TOGETHER_URL)
    assert isinstance(experiment._create_target("anthropic/sonnet-x", ""), ClaudeTarget)
    assert type(experiment._create_target("gpt4-custom", "")) is OpenAITarget


def test_base_model_uses_together_key(keys, monkeypatch: pytest.MonkeyPatch) -> None:
    from flinch.runner import ExperimentRunner
    from flinch.target import BaseModelTarget

    experiment = ExperimentRunner.__new__(ExperimentRunner)
    target = experiment._create_target("meta-llama/Llama-3.3-70B", "ctx")
    assert isinstance(target, BaseModelTarget)
    assert _key_and_url(target) == ("t", TOGETHER_URL)
    monkeypatch.delenv("TOGETHER_API_KEY")
    with pytest.raises(ValueError, match="TOGETHER_API_KEY"):
        experiment._create_target("meta-llama/Llama-3.3-70B", "ctx")


def test_claude_needs_a_key_or_client(monkeypatch: pytest.MonkeyPatch) -> None:
    from flinch.runner import Runner
    from flinch.target import ClaudeTarget, make_target

    monkeypatch.delenv("ANTHROPIC_API_KEY")
    with pytest.raises(ValueError, match="Anthropic API key required"):
        make_target("claude-sonnet-4-6")
    with pytest.raises(ValueError, match="Anthropic API key required"):
        Runner(conn=None)._make_target("claude-sonnet-4-6")
    client = object()
    target = Runner(conn=None, client=client)._make_target("claude-sonnet-4-6", "sys")
    assert isinstance(target, ClaudeTarget) and target._client is client


def test_rater_routes_by_provider(keys) -> None:
    from flinch import rater
    from flinch.target import ClaudeTarget

    pipeline = rater.AIRaterPipeline.__new__(rater.AIRaterPipeline)
    assert _key_and_url(pipeline._create_rater_target("grok-3")) == ("x", XAI_URL)
    assert _key_and_url(pipeline._create_rater_target("meta-llama/Llama-3.3-70B-Instruct-Turbo")) == (
        "t", TOGETHER_URL,
    )
    claude = pipeline._create_rater_target("claude-haiku-4-5-20251001")
    assert isinstance(claude, ClaudeTarget)
    assert claude._system_prompt == rater.RATER_SYSTEM_PROMPT


def test_wrappers_delegate_to_one_factory(monkeypatch: pytest.MonkeyPatch) -> None:
    import flinch.target
    from flinch import rater, runner, stat_runner

    calls: list[tuple] = []

    def spy(model_name, system_prompt="", anthropic_client=None, provider_hint=None):
        calls.append((model_name, system_prompt, provider_hint))
        return model_name

    monkeypatch.setattr(flinch.target, "make_target", spy)
    sites = _call_sites()
    for site in ("runner", "experiment", "stat", "rater"):
        assert sites[site](f"grok-{site}") == f"grok-{site}"
    assert calls == [
        ("grok-runner", "sys", None),
        ("grok-experiment", "sys", "xai"),
        ("grok-stat", "sys", None),
        ("grok-rater", rater.RATER_SYSTEM_PROMPT, None),
    ]
    assert runner.flinch_target is stat_runner.flinch_target is flinch.target
