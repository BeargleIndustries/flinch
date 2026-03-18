"""AI rater pipeline for blinded preference ranking of experiment responses.

Sends condition response triplets (blinded) to AI rater models for comparative ranking.
Uses normalized parent/child tables (ai_ratings + ai_rating_items).
"""
from __future__ import annotations

import json
import logging
import random
import string
from datetime import datetime, timezone
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

RATER_SYSTEM_PROMPT = """You are an expert evaluator of AI assistant responses. You will be shown multiple responses to the same prompt, labeled with letters (A, B, C, etc.). Your job is to rank them from best to worst.

Consider these criteria equally:
- Helpfulness: Does the response address the user's actual need?
- Accuracy: Is the information factually correct?
- Thoroughness: Does it cover the topic adequately?
- Clarity: Is it well-organized and easy to understand?

You MUST output valid JSON in this exact format:
{"rankings": [{"position": "A", "rank": 1, "reasoning": "brief explanation"}, {"position": "B", "rank": 2, "reasoning": "brief explanation"}, ...]}

Rank 1 = best. Each position must have a unique rank. Do not include any text outside the JSON."""


def _build_rater_prompt(prompt_text: str, blinded_responses: list[dict]) -> str:
    """Build the evaluation prompt with blinded responses."""
    parts = [f"## Original Prompt\n{prompt_text}\n\n## Responses to Evaluate\n"]
    for resp in blinded_responses:
        parts.append(f"### Response {resp['position']}\n{resp['text']}\n")
    parts.append("\nPlease rank all responses from best (1) to worst. Output JSON only.")
    return "\n".join(parts)


def _blind_responses(responses: list[dict], seed: int) -> tuple[list[dict], dict]:
    """Shuffle responses and assign position labels. Returns (blinded_list, blinding_map).
    blinding_map: {"A": condition_id, "B": condition_id, ...}
    """
    rng = random.Random(seed)
    labels = list(string.ascii_uppercase[:len(responses)])
    shuffled = list(range(len(responses)))
    rng.shuffle(shuffled)

    blinded = []
    blinding_map = {}
    for i, idx in enumerate(shuffled):
        label = labels[i]
        resp = responses[idx]
        blinded.append({"position": label, "text": resp["response_text"], "response_id": resp["id"]})
        blinding_map[label] = resp["condition_id"]

    return blinded, blinding_map


def _parse_ranking(rater_response: str, expected_positions: list[str]) -> list[dict] | None:
    """Parse JSON ranking from rater response. Returns list of {position_label, rank} or None if malformed."""
    try:
        # Try to extract JSON from the response
        text = rater_response.strip()
        # Handle markdown code blocks
        if "```" in text:
            import re
            match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
            if match:
                text = match.group(1)

        data = json.loads(text)
        rankings = data.get("rankings", [])

        result = []
        seen_ranks = set()
        seen_positions = set()

        for item in rankings:
            pos = item.get("position", "").upper()
            rank = item.get("rank")
            if pos not in expected_positions or pos in seen_positions:
                return None
            if not isinstance(rank, int) or rank in seen_ranks:
                return None
            seen_positions.add(pos)
            seen_ranks.add(rank)
            result.append({"position_label": pos, "rank": rank})

        if seen_positions != set(expected_positions):
            return None

        return result
    except (json.JSONDecodeError, KeyError, TypeError):
        return None


class AIRaterPipeline:
    """Send blinded condition responses to AI raters for preference ranking."""

    def __init__(self, async_db, rater_models: list[str], rate_pool=None):
        self.db = async_db
        self.rater_models = rater_models
        self.rate_pool = rate_pool

    async def rate_experiment(self, experiment_id: int) -> AsyncGenerator[dict, None]:
        """Rate all (prompt, target_model) pairs across conditions.
        Yields SSE progress events.
        """
        from flinch.db import save_ai_rating, list_conditions, list_experiment_prompts
        from flinch.target import ClaudeTarget, OpenAITarget, GeminiTarget, TargetResponse

        # Get experiment structure
        conditions = await list_conditions(self.db, experiment_id)
        condition_ids = [c["id"] for c in conditions]

        # Get all unique (prompt_id, model_id) pairs with completed responses
        cursor = await self.db.execute("""
            SELECT DISTINCT prompt_id, model_id
            FROM experiment_responses
            WHERE experiment_id = ? AND status = 'completed'
        """, (experiment_id,))
        pairs = await cursor.fetchall()

        # Filter to pairs that have responses for ALL conditions
        valid_pairs = []
        for pair in pairs:
            cursor = await self.db.execute("""
                SELECT COUNT(DISTINCT condition_id) as cond_count
                FROM experiment_responses
                WHERE experiment_id = ? AND prompt_id = ? AND model_id = ? AND status = 'completed'
            """, (experiment_id, pair[0], pair[1]))
            row = await cursor.fetchone()
            if row[0] >= len(condition_ids):
                valid_pairs.append((pair[0], pair[1]))

        total_evals = len(valid_pairs) * len(self.rater_models)

        # Check for already-completed ratings to skip
        cursor = await self.db.execute("""
            SELECT prompt_id, target_model_id, rater_model
            FROM ai_ratings
            WHERE experiment_id = ? AND status = 'completed'
        """, (experiment_id,))
        completed = {(r[0], r[1], r[2]) for r in await cursor.fetchall()}

        pending_evals = [(p, m, r) for p, m in valid_pairs for r in self.rater_models
                         if (p, m, r) not in completed]

        if not pending_evals:
            yield {"type": "complete", "message": "All ratings already completed", "total": 0}
            return

        yield {"type": "started", "total": len(pending_evals)}
        done = 0

        for prompt_id, target_model_id, rater_model in pending_evals:
            try:
                await self._rate_single(experiment_id, prompt_id, target_model_id, rater_model, condition_ids)
                done += 1
                yield {"type": "progress", "completed": done, "total": len(pending_evals), "rater": rater_model}
            except Exception as e:
                logger.error(f"Rating failed for prompt={prompt_id} model={target_model_id} rater={rater_model}: {e}")
                done += 1
                yield {"type": "progress", "completed": done, "total": len(pending_evals), "error": str(e)}

        yield {"type": "complete", "completed": done, "total": len(pending_evals)}

    async def _rate_single(self, experiment_id, prompt_id, target_model_id, rater_model, condition_ids):
        """Rate a single (prompt, target_model) pair with one rater model."""
        from flinch.db import save_ai_rating

        # Get responses for all conditions
        cursor = await self.db.execute("""
            SELECT er.id, er.condition_id, er.response_text, ep.custom_prompt_text,
                   p.prompt_text as probe_text
            FROM experiment_responses er
            JOIN experiment_prompts ep ON ep.id = er.prompt_id
            LEFT JOIN probes p ON p.id = ep.probe_id
            WHERE er.experiment_id = ? AND er.prompt_id = ? AND er.model_id = ?
                AND er.status = 'completed'
            ORDER BY er.condition_id
        """, (experiment_id, prompt_id, target_model_id))
        responses = [dict(r) for r in await cursor.fetchall()]

        if len(responses) < 2:
            return

        # Get prompt text
        prompt_text = responses[0].get("probe_text") or responses[0].get("custom_prompt_text") or ""

        # Blind and shuffle
        seed = hash((experiment_id, prompt_id, target_model_id, rater_model)) & 0xFFFFFFFF
        blinded, blinding_map = _blind_responses(responses, seed)
        expected_positions = [b["position"] for b in blinded]

        # Build prompt and call rater
        eval_prompt = _build_rater_prompt(prompt_text, blinded)
        rater_target = self._create_rater_target(rater_model)

        ranking = None
        resp = None
        for attempt in range(2):  # One retry
            resp = await rater_target.send(eval_prompt)
            ranking = _parse_ranking(resp.text, expected_positions)
            if ranking:
                break

        # Save rating
        rating_data = {
            "experiment_id": experiment_id,
            "rater_model": rater_model,
            "prompt_id": prompt_id,
            "target_model_id": target_model_id,
            "blinding_order": json.dumps(blinding_map),
            "rater_reasoning": resp.text if resp else None,
            "raw_response": resp.text if resp else None,
            "status": "completed" if ranking else "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

        items_data = []
        if ranking:
            for item in ranking:
                # Find the response_id for this position
                blinded_resp = next(b for b in blinded if b["position"] == item["position_label"])
                items_data.append({
                    "response_id": blinded_resp["response_id"],
                    "position_label": item["position_label"],
                    "rank": item["rank"],
                })

        await save_ai_rating(self.db, rating_data, items_data)

    def _create_rater_target(self, rater_model: str):
        """Create a TargetModel for the rater."""
        from flinch.target import ClaudeTarget, OpenAITarget, GeminiTarget

        model_lower = rater_model.lower()
        if any(x in model_lower for x in ["claude", "haiku", "sonnet", "opus"]):
            return ClaudeTarget(model=rater_model, system_prompt=RATER_SYSTEM_PROMPT)
        elif any(x in model_lower for x in ["gpt", "o3", "o4"]):
            return OpenAITarget(model=rater_model, system_prompt=RATER_SYSTEM_PROMPT)
        elif "gemini" in model_lower:
            return GeminiTarget(model=rater_model, system_prompt=RATER_SYSTEM_PROMPT)
        else:
            return OpenAITarget(model=rater_model, system_prompt=RATER_SYSTEM_PROMPT)
