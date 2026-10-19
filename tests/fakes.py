"""Test doubles shared by the sidecar tests (brief section 11 intro)."""

from __future__ import annotations

import asyncio
import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field

from flinch.target import TargetModel, TargetResponse

# A rule picks a reply from the target's system prompt and its message list.
Rule = Callable[[str, list[dict]], str]

REFUSAL_TEXT = "I can't help with that."
PLAIN_TEXT = "Here is a plain answer."

_RESPONSE_HEADING_RE = re.compile(r"^### Response ([A-Z])\s*$", re.MULTILINE)


def _user_messages(messages: list[dict]) -> list[str]:
    return [m["content"] for m in messages if m["role"] == "user"]


def default_rule(system: str, messages: list[dict]) -> str:
    """Refuse a `[REFUSE]` prompt while fewer than three user messages exist."""
    users = _user_messages(messages)
    if users and "[REFUSE]" in users[-1] and len(users) < 3:
        return REFUSAL_TEXT
    return PLAIN_TEXT


def ranking_rule(system: str, messages: list[dict]) -> str:
    """Rank every `### Response X` heading in the last user message, in order."""
    users = _user_messages(messages)
    labels = _RESPONSE_HEADING_RE.findall(users[-1] if users else "")
    rankings = [
        {"position": label, "rank": i + 1, "reasoning": "test"} for i, label in enumerate(labels)
    ]
    return json.dumps({"rankings": rankings})


@dataclass
class FakeTarget(TargetModel):
    """A TargetModel that answers by rule and records every call."""

    model: str = "fake-model"
    system_prompt: str = ""
    rule: Rule = default_rule
    delay_s: float = 0.0
    calls: list[tuple[str, object]] = field(default_factory=list)
    messages: list[dict] = field(default_factory=list)

    @property
    def model_name(self) -> str:
        return self.model

    async def _answer(self, text: str) -> TargetResponse:
        self.messages.append({"role": "user", "content": text})
        if self.delay_s:
            await asyncio.sleep(self.delay_s)
        reply = self.rule(self.system_prompt, list(self.messages))
        self.messages.append({"role": "assistant", "content": reply})
        return TargetResponse(
            text=reply,
            input_tokens=len(text.split()),
            output_tokens=len(reply.split()),
            latency_ms=int(self.delay_s * 1000),
            finish_reason="stop",
            raw_model=self.model,
        )

    async def send(self, prompt: str) -> TargetResponse:
        self.calls.append(("send", prompt))
        return await self._answer(prompt)

    async def reply(self, pushback: str) -> TargetResponse:
        self.calls.append(("reply", pushback))
        return await self._answer(pushback)

    def reset(self) -> None:
        self.calls.append(("reset", None))
        self.messages = []

    def seed(self, history: list[dict]) -> None:
        self.calls.append(("seed", [dict(m) for m in history]))
        self.messages = [dict(m) for m in history]


class FakeTargetFactory:
    """Builds FakeTargets for patched factories; `created` lists every target made."""

    def __init__(self, rule: Rule = default_rule, delay_s: float = 0.0) -> None:
        self.rule = rule
        self.delay_s = delay_s
        self.created: list[FakeTarget] = []

    def __call__(self, model_name: str, system_prompt: str = "") -> FakeTarget:
        target = FakeTarget(
            model=model_name, system_prompt=system_prompt, rule=self.rule, delay_s=self.delay_s
        )
        self.created.append(target)
        return target
