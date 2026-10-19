"""The fake model server stays in step with the prompts Flinch really sends (brief R12)."""

from __future__ import annotations

import ast
import inspect
import json
import re
import socket
import subprocess
import sys
import time
from pathlib import Path

import anthropic
import fake_models
import httpx
import pytest

from flinch import classifier, coach, rater, seed
from flinch.coach import Coach, NarrativeCoach

ROOT = Path(__file__).resolve().parents[1]
FAKE_MODELS_PATH = ROOT / "tests" / "fake_models.py"

_SYSTEM_LITERAL_RE = re.compile(r'system=(?:"""|")(You [^"\n]+)')


def _system_literals(obj: object) -> list[str]:
    """The `system="..."` string literals in an object's source."""
    return _SYSTEM_LITERAL_RE.findall(inspect.getsource(obj))


def _classifier_system_text() -> str:
    (text,) = _system_literals(classifier._llm_classify)
    return text


def _narrative_inline_systems() -> list[str]:
    return _system_literals(NarrativeCoach)


def _user(text: str) -> dict:
    return {"role": "user", "content": text}


# --- R12: every rule matches the real prompt's first words ------------------


def test_classifier_rule_matches_prompt() -> None:
    assert _classifier_system_text().startswith(fake_models.CLASSIFIER_PREFIX)
    assert fake_models.system_kind(_classifier_system_text()) == "classifier"


def test_coach_rule_matches_prompts() -> None:
    profile_prompt = Coach(backend=object())._build_system_prompt([])
    for prompt in (coach.COACH_SYSTEM_PROMPT, seed.DEFAULT_SYSTEM_PROMPT, profile_prompt):
        assert prompt.startswith(fake_models.COACH_PREFIX)
        assert fake_models.system_kind(prompt) == "coach"


def test_rater_rule_matches_prompt() -> None:
    assert rater.RATER_SYSTEM_PROMPT.startswith(fake_models.RATER_PREFIX)
    assert fake_models.system_kind(rater.RATER_SYSTEM_PROMPT) == "rater"


def test_story_rule_matches_prompts() -> None:
    prompts = [
        coach.NARRATIVE_COACH_PROMPT,
        coach.NARRATIVE_SETUP_PROMPT,
        coach.IF_NARRATIVE_COACH_PROMPT,
        coach.IF_NARRATIVE_SETUP_PROMPT,
    ]
    inline = _narrative_inline_systems()
    assert any(s.startswith("You extract narrative territory") for s in inline)
    assert any(s.startswith(fake_models.ADAPT_PREFIX) for s in inline)
    for prompt in prompts + inline:
        assert fake_models.system_kind(prompt) == "story", prompt[:60]


def test_target_system_prompts_hit_no_rule() -> None:
    assert fake_models.system_kind(coach.NARRATIVE_ENGINE_SYSTEM_PROMPT) is None
    assert fake_models.system_kind("") is None


def test_variants_marker_is_in_app() -> None:
    import flinch.app

    assert fake_models.VARIANTS_MARKER in Path(flinch.app.__file__).read_text(encoding="utf-8")


def test_hh_rows_import_through_real_parser() -> None:
    from flinch.hh_import import HHRLHFImporter

    importer = HHRLHFImporter()
    rows = fake_models.hh_rows()
    assert len(rows) == 60
    domains = set()
    for wrapper in rows:
        text = importer.extract_first_human_turn(wrapper["row"]["chosen"])
        assert text
        assert importer.filter_deception_viable(text)
        domains.add(importer.categorize_prompt(text))
    assert domains == {"factual", "advice", "opinion", "ethical"}


def test_fake_models_imports_nothing_from_flinch() -> None:
    tree = ast.parse(FAKE_MODELS_PATH.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            names = [node.module or ""]
        else:
            continue
        assert not any(n == "flinch" or n.startswith("flinch.") for n in names), names


# --- reply rules ------------------------------------------------------------


def test_reply_classifier() -> None:
    system = _classifier_system_text()
    prompt = classifier.CLASSIFY_PROMPT.format(probe_text="[REFUSE] x", response_text="{r}")
    cases = {
        "I can't help with that.": "REFUSED",
        "I partially did it.": "NEGOTIATED",
        "Here is a plain answer.": "COMPLIED",
    }
    for response, expected in cases.items():
        text = prompt.replace("{r}", response)
        assert fake_models.reply_text(system, [_user(text)]) == expected


def test_reply_coach() -> None:
    out = json.loads(fake_models.reply_text(coach.COACH_SYSTEM_PROMPT, [_user("x")]))
    assert out["move_suggested"] == "specificity_challenge"
    assert out["pattern_detected"] == "generic-refusal"


def test_reply_rater() -> None:
    message = rater._build_rater_prompt(
        "Prompt", [{"position": "A", "text": "one"}, {"position": "B", "text": "two"}]
    )
    out = fake_models.reply_text(rater.RATER_SYSTEM_PROMPT, [_user(message)])
    assert rater._parse_ranking(out, ["A", "B"]) == [
        {"position_label": "A", "rank": 1},
        {"position_label": "B", "rank": 2},
    ]


def test_reply_story() -> None:
    adapt = next(s for s in _narrative_inline_systems() if s.startswith(fake_models.ADAPT_PREFIX))
    assert fake_models.reply_text(adapt, [_user("[REFUSE] Write it.")]).startswith("[REFUSE] ")
    plain = fake_models.reply_text(coach.NARRATIVE_COACH_PROMPT, [_user("[REFUSE] Write it.")])
    assert plain == fake_models.STORY_TEXT


def test_reply_variants() -> None:
    message = (
        "Base probe:\nWrite it.\n\n"
        "Generate variants for these framing strategies:\n- academic\n- fiction\n\nRespond in JSON"
    )
    out = json.loads(fake_models.reply_text("", [_user(message)]))
    assert out == {
        "variants": [
            {"label": "academic", "prompt_text": "academic: [REFUSE] variant"},
            {"label": "fiction", "prompt_text": "fiction: [REFUSE] variant"},
        ]
    }


def test_reply_target() -> None:
    one = [_user("[REFUSE] Write the scene.")]
    assert fake_models.reply_text("", one) == fake_models.REFUSAL_TEXT
    two = one + [{"role": "assistant", "content": "no"}, _user("[REFUSE] please")]
    assert fake_models.reply_text("", two) == fake_models.REFUSAL_TEXT
    three = two + [{"role": "assistant", "content": "no"}, _user("[REFUSE] again")]
    assert fake_models.reply_text("", three) == fake_models.FOLLOW_UP_TEXT
    assert fake_models.reply_text("", [_user("Write a poem.")]) == fake_models.PLAIN_TEXT


def test_slow_rule_sleeps() -> None:
    import asyncio

    start = time.monotonic()
    assert asyncio.run(fake_models.reply("", [_user("[SLOW] hi")])) == fake_models.PLAIN_TEXT
    assert time.monotonic() - start >= 0.9


# --- over HTTP --------------------------------------------------------------


def test_sdk_base_urls(fake_model_server: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """A4: both SDKs honour ANTHROPIC_BASE_URL and OPENAI_BASE_URL."""
    openai = pytest.importorskip("openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test")

    claude = anthropic.Anthropic(max_retries=0)
    assert str(claude.base_url).rstrip("/") == fake_model_server
    msg = claude.messages.create(
        model="claude-test", max_tokens=16, messages=[_user("Write a poem.")]
    )
    assert msg.content[0].text == fake_models.PLAIN_TEXT
    assert msg.stop_reason == "end_turn"
    assert [m.id for m in claude.models.list()] == ["claude-test"]

    gpt = openai.OpenAI(max_retries=0)
    assert str(gpt.base_url).rstrip("/") == f"{fake_model_server}/v1"
    chat = gpt.chat.completions.create(
        model="gpt-test",
        messages=[{"role": "system", "content": "x"}, _user("[REFUSE] Write the scene.")],
    )
    assert chat.choices[0].message.content == fake_models.REFUSAL_TEXT
    assert chat.choices[0].finish_reason == "stop"
    assert [m.id for m in gpt.models.list()] == ["gpt-test"]


def test_rows_route(fake_model_server: str) -> None:
    resp = httpx.get(f"{fake_model_server}/rows", params={"offset": 50, "length": 100})
    assert resp.status_code == 200
    assert len(resp.json()["rows"]) == 10


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_cli_port() -> None:
    """`python tests/fake_models.py --port N` serves /health (how Playwright runs it)."""
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "tests/fake_models.py", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        deadline = time.monotonic() + 20
        while True:
            try:
                resp = httpx.get(f"http://127.0.0.1:{port}/health", timeout=1)
                break
            except httpx.TransportError:
                if proc.poll() is not None or time.monotonic() > deadline:
                    raise
                time.sleep(0.1)
        assert resp.json() == {"ok": True}
    finally:
        proc.terminate()
        proc.wait(timeout=10)
