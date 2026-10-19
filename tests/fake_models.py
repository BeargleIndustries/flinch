"""Fake Anthropic and OpenAI model server for Flinch tests and e2e specs.

Run: `python tests/fake_models.py --port 8766` from the repository root.

Stdlib plus FastAPI and uvicorn only. This file imports nothing from `flinch`
(plan F8): `python tests/fake_models.py` puts `tests/` first on `sys.path`, so a
`flinch` import would resolve through the main worktree's editable install.
`tests/test_fake_models.py` checks every rule against the real prompt constants.

Routes:
- `GET /health` -> `{"ok": true}`.
- `GET /v1/models`: the Anthropic list shape when the request has an
  `x-api-key` header, else the OpenAI list shape.
- `POST /v1/messages` (Anthropic) and `POST /v1/chat/completions` (OpenAI)
  share `reply(system, messages)`.
- `GET /rows`: HuggingFace datasets-server rows for the HH-RLHF importer.

`reply` rules, first match wins:
0. any user message contains `[SLOW]`: sleep 1 s, then apply the rules below.
1. system starts with "You are a response classifier": the class word implied
   by the RESPONSE section of the last user message.
2. system starts with "You are a research coach": a fixed coach suggestion.
3. system starts with "You are an expert evaluator": a ranking with one entry
   per "### Response X" heading, ranks 1..n in order.
4. system starts with "You are a human user" (co-writing and interactive
   fiction coaches), "You extract narrative territory" or "You adapt writing
   prompts": one short line of story text; the last one keeps "[REFUSE] ".
5. the last user message contains "Generate variants for these framing
   strategies": one variant per "- s" strategy line.
6. otherwise (a target): refuse a "[REFUSE]" message while fewer than three
   user messages exist; later turns comply.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import time
from typing import Any

import uvicorn
from fastapi import FastAPI, Request

CLASSIFIER_PREFIX = "You are a response classifier"
COACH_PREFIX = "You are a research coach"
RATER_PREFIX = "You are an expert evaluator"
STORY_PREFIXES = (
    "You are a human user",
    "You extract narrative territory",
    "You adapt writing prompts",
)
ADAPT_PREFIX = "You adapt writing prompts"
VARIANTS_MARKER = "Generate variants for these framing strategies"

REFUSAL_TEXT = "I can't help with that."
FOLLOW_UP_TEXT = "Here is the thing you asked for."
PLAIN_TEXT = "Here is a plain answer."
STORY_TEXT = "The rain kept falling as Mara closed the shop."

COACH_SUGGESTION = {
    "pattern_detected": "generic-refusal",
    "move_suggested": "specificity_challenge",
    "pushback_draft": "What specifically about this is problematic?",
    "confidence": 0.5,
    "reasoning": "test",
}

_RESPONSE_HEADING_RE = re.compile(r"^### Response ([A-Z])\s*$", re.MULTILINE)

_HH_PROMPTS = {
    "factual": "What is the tallest mountain in the world and how was it measured?",
    "advice": "How can I keep my houseplants alive while I am away for two weeks?",
    "opinion": "What do you think about reading fiction books instead of watching movies at night?",
    "ethical": "Is it wrong to keep a wallet you found on the street with no name?",
}
HH_ROW_COUNT = 60


def system_kind(system: str) -> str | None:
    """Name the rule a system prompt selects: classifier, coach, rater, story or None."""
    if system.startswith(CLASSIFIER_PREFIX):
        return "classifier"
    if system.startswith(COACH_PREFIX):
        return "coach"
    if system.startswith(RATER_PREFIX):
        return "rater"
    if system.startswith(STORY_PREFIXES):
        return "story"
    return None


def _text(content: Any) -> str:
    """Flatten an Anthropic or OpenAI content value (string or block list) to text."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(str(block.get("text", "")))
            else:
                parts.append(str(block))
        return "".join(parts)
    return str(content)


def _user_texts(messages: list[dict]) -> list[str]:
    return [_text(m.get("content")) for m in messages if m.get("role") == "user"]


def _classify(last_user: str) -> str:
    section = last_user
    if "RESPONSE:" in section:
        section = section.rsplit("RESPONSE:", 1)[1]
    section = section.split("CLASSIFICATION:", 1)[0]
    if "I can't" in section:
        return "REFUSED"
    if "partially" in section:
        return "NEGOTIATED"
    return "COMPLIED"


def _rank(last_user: str) -> str:
    labels = _RESPONSE_HEADING_RE.findall(last_user)
    rankings = [
        {"position": label, "rank": i + 1, "reasoning": "test"} for i, label in enumerate(labels)
    ]
    return json.dumps({"rankings": rankings})


def _variants(last_user: str) -> str:
    after = last_user.split(VARIANTS_MARKER, 1)[1]
    strategies = []
    for line in after.splitlines()[1:]:
        stripped = line.strip()
        if not stripped:
            if strategies:
                break
            continue
        if not stripped.startswith("- "):
            break
        strategies.append(stripped[2:].strip())
    variants = [{"label": s, "prompt_text": f"{s}: [REFUSE] variant"} for s in strategies]
    return json.dumps({"variants": variants})


def reply_text(system: str, messages: list[dict]) -> str:
    """Rules 1 to 6 (rule 0's delay lives in `reply`)."""
    users = _user_texts(messages)
    last_user = users[-1] if users else ""
    kind = system_kind(system)
    if kind == "classifier":
        return _classify(last_user)
    if kind == "coach":
        return json.dumps(COACH_SUGGESTION)
    if kind == "rater":
        return _rank(last_user)
    if kind == "story":
        if system.startswith(ADAPT_PREFIX) and "[REFUSE]" in last_user:
            return f"[REFUSE] {STORY_TEXT}"
        return STORY_TEXT
    if VARIANTS_MARKER in last_user:
        return _variants(last_user)
    if "[REFUSE]" in last_user and len(users) < 3:
        return REFUSAL_TEXT
    if len(users) > 1:
        return FOLLOW_UP_TEXT
    return PLAIN_TEXT


async def reply(system: str, messages: list[dict]) -> str:
    if any("[SLOW]" in text for text in _user_texts(messages)):
        await asyncio.sleep(1.0)
    return reply_text(system, messages)


def _count_tokens(*texts: str) -> int:
    return sum(len(t.split()) for t in texts)


def hh_rows() -> list[dict]:
    """60 synthetic HH-RLHF rows spread over the four prompt kinds."""
    kinds = list(_HH_PROMPTS)
    rows = []
    for i in range(HH_ROW_COUNT):
        kind = kinds[i % len(kinds)]
        prompt = f"{_HH_PROMPTS[kind]} (case {i})"
        chosen = f"\n\nHuman: {prompt}\n\nAssistant: Here is a plain answer."
        rows.append({"row_idx": i, "row": {"chosen": chosen, "rejected": chosen}})
    return rows


app = FastAPI(title="Flinch fake models")


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/v1/models")
async def list_models(request: Request) -> dict:
    if request.headers.get("x-api-key") is not None:
        return {
            "data": [
                {
                    "id": "claude-test",
                    "type": "model",
                    "display_name": "Test",
                    "created_at": "2025-01-01T00:00:00Z",
                }
            ],
            "has_more": False,
            "first_id": "claude-test",
            "last_id": "claude-test",
        }
    return {
        "object": "list",
        "data": [{"id": "gpt-test", "object": "model", "created": 0, "owned_by": "test"}],
    }


@app.post("/v1/messages")
async def anthropic_messages(request: Request) -> dict:
    body = await request.json()
    system = _text(body.get("system"))
    messages = body.get("messages", [])
    text = await reply(system, messages)
    return {
        "id": "msg_fake",
        "type": "message",
        "role": "assistant",
        "model": body.get("model", "claude-test"),
        "content": [{"type": "text", "text": text}],
        "stop_reason": "end_turn",
        "stop_sequence": None,
        "usage": {
            "input_tokens": _count_tokens(system, *_user_texts(messages)),
            "output_tokens": _count_tokens(text),
        },
    }


@app.post("/v1/chat/completions")
async def openai_chat(request: Request) -> dict:
    body = await request.json()
    all_messages = body.get("messages", [])
    system = "\n".join(
        _text(m.get("content")) for m in all_messages if m.get("role") in ("system", "developer")
    )
    messages = [m for m in all_messages if m.get("role") not in ("system", "developer")]
    text = await reply(system, messages)
    prompt_tokens = _count_tokens(system, *_user_texts(messages))
    completion_tokens = _count_tokens(text)
    return {
        "id": "chatcmpl-fake",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": body.get("model", "gpt-test"),
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


@app.get("/rows")
async def rows(offset: int = 0, length: int = 100) -> dict:
    all_rows = hh_rows()
    return {
        "features": [{"feature_idx": 0, "name": "chosen", "type": {"dtype": "string"}}],
        "rows": all_rows[offset : offset + length],
        "num_rows_total": len(all_rows),
        "num_rows_per_page": length,
        "partial": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fake model server for Flinch tests")
    parser.add_argument("--port", type=int, default=8766, help="Port to listen on")
    args = parser.parse_args()
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
