"""Prolific export formatter and human evaluation result importer.

Generates blinded evaluation tasks for the Prolific crowdsourcing platform.
Uses split tables: eval_tasks (task definitions) + eval_ratings (rater responses).

NOTE: Verify exact CSV column format against current Prolific docs before deployment.
Prolific's bulk upload format may change — keep export modular.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import random
import string
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _generate_tracking_id(experiment_id: int, prompt_id: int, model_id: str, rater_slot: int) -> str:
    """Generate a unique, deterministic tracking ID."""
    raw = f"{experiment_id}:{prompt_id}:{model_id}:{rater_slot}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _blind_for_eval(responses: list[dict], seed: int) -> tuple[list[dict], dict]:
    """Shuffle responses for human evaluation. Returns (blinded_list, blinding_map)."""
    rng = random.Random(seed)
    labels = list(string.ascii_uppercase[:len(responses)])
    indices = list(range(len(responses)))
    rng.shuffle(indices)

    blinded = []
    blinding_map = {}
    for i, idx in enumerate(indices):
        label = labels[i]
        resp = responses[idx]
        blinded.append({"position": label, "text": resp["response_text"], "response_id": resp["id"]})
        blinding_map[label] = resp["condition_id"]

    return blinded, blinding_map


class ProlificExporter:
    """Generate and manage human evaluation tasks for Prolific."""

    def __init__(self, async_db):
        self.db = async_db

    async def generate_tasks(
        self,
        experiment_id: int,
        prompt_count: int = 300,
        model_ids: list[str] | None = None,
        raters_per_task: int = 3,
        batch_id: str = "",
    ) -> dict:
        """Generate evaluation tasks.

        Selects prompts, creates blinded triplets, stores in eval_tasks table.
        Returns task count and metadata.
        """
        from flinch.db import create_eval_tasks, list_conditions

        if not batch_id:
            batch_id = f"batch_{experiment_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

        conditions = await list_conditions(self.db, experiment_id)
        condition_ids = [c["id"] for c in conditions]

        # Get available (prompt, model) pairs
        model_filter = ""
        params = [experiment_id, len(condition_ids)]
        if model_ids:
            placeholders = ",".join("?" * len(model_ids))
            model_filter = f"AND er.model_id IN ({placeholders})"
            params.extend(model_ids)

        cursor = await self.db.execute(f"""
            SELECT er.prompt_id, er.model_id, COUNT(DISTINCT er.condition_id) as cond_count
            FROM experiment_responses er
            WHERE er.experiment_id = ? AND er.status = 'completed'
            {model_filter}
            GROUP BY er.prompt_id, er.model_id
            HAVING cond_count >= ?
        """, params)
        available_pairs = [(r[0], r[1]) for r in await cursor.fetchall()]

        # Sample prompts if we have more than requested
        if len(available_pairs) > prompt_count:
            rng = random.Random(experiment_id)  # deterministic
            available_pairs = rng.sample(available_pairs, prompt_count)

        tasks = []
        for prompt_id, target_model_id in available_pairs:
            # Get responses for all conditions
            cursor = await self.db.execute("""
                SELECT er.id, er.condition_id, er.response_text
                FROM experiment_responses er
                WHERE er.experiment_id = ? AND er.prompt_id = ? AND er.model_id = ?
                    AND er.status = 'completed'
                ORDER BY er.condition_id
            """, (experiment_id, prompt_id, target_model_id))
            responses = [dict(r) for r in await cursor.fetchall()]

            if len(responses) < len(condition_ids):
                continue

            seed = hash((experiment_id, prompt_id, target_model_id, "prolific")) & 0xFFFFFFFF
            blinded, blinding_map = _blind_for_eval(responses, seed)

            for rater_slot in range(raters_per_task):
                tracking_id = _generate_tracking_id(experiment_id, prompt_id, target_model_id, rater_slot)
                tasks.append({
                    "experiment_id": experiment_id,
                    "batch_id": batch_id,
                    "prompt_id": prompt_id,
                    "target_model_id": target_model_id,
                    "blinding_order": json.dumps(blinding_map),
                    "tracking_id": tracking_id,
                })

        if tasks:
            await create_eval_tasks(self.db, tasks)

        return {
            "batch_id": batch_id,
            "task_count": len(tasks),
            "prompt_count": len(available_pairs),
            "raters_per_task": raters_per_task,
            "conditions": len(condition_ids),
        }

    async def export_csv(self, experiment_id: int) -> str:
        """Export tasks as CSV for Prolific upload."""
        cursor = await self.db.execute("""
            SELECT et.tracking_id, et.blinding_order, et.target_model_id, et.prompt_id,
                   ep.custom_prompt_text, p.prompt_text as probe_text
            FROM eval_tasks et
            JOIN experiment_prompts ep ON ep.id = et.prompt_id
            LEFT JOIN probes p ON p.id = ep.probe_id
            WHERE et.experiment_id = ? AND et.status = 'pending'
            ORDER BY et.id
        """, (experiment_id,))
        rows = await cursor.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["tracking_id", "prompt_text", "response_a", "response_b", "response_c",
                         "question_text"])

        for row in rows:
            tracking_id = row[0]
            blinding_map = json.loads(row[1])
            prompt_text = row[4] or row[5] or ""

            # Get blinded responses
            responses = {}
            for label, condition_id in blinding_map.items():
                cursor2 = await self.db.execute("""
                    SELECT response_text FROM experiment_responses
                    WHERE experiment_id = ? AND prompt_id = ? AND model_id = ? AND condition_id = ?
                """, (experiment_id, row[3], row[2], condition_id))
                resp_row = await cursor2.fetchone()
                responses[label] = resp_row[0] if resp_row else ""

            resp_a = responses.get("A", "")
            resp_b = responses.get("B", "")
            resp_c = responses.get("C", "")

            question = "Read the prompt and the three AI responses below. Rank them from best (1) to worst (3). Consider helpfulness, accuracy, thoroughness, and clarity."

            writer.writerow([tracking_id, prompt_text, resp_a, resp_b, resp_c, question])

        # Update status to exported
        await self.db.execute("""
            UPDATE eval_tasks SET status = 'exported'
            WHERE experiment_id = ? AND status = 'pending'
        """, (experiment_id,))
        await self.db.commit()

        return output.getvalue()

    async def import_results(self, experiment_id: int, csv_text: str) -> dict:
        """Import completed Prolific results CSV.

        Expected columns: tracking_id, rater_id, rank_a, rank_b, rank_c, reasoning, completion_time_s
        Creates eval_ratings rows linked to eval_tasks.
        """
        from flinch.db import create_eval_rating

        reader = csv.DictReader(io.StringIO(csv_text))
        imported = 0
        skipped = 0
        errors = []

        for row_num, row in enumerate(reader, start=1):
            tracking_id = row.get("tracking_id", "").strip()
            rater_id = row.get("rater_id", "").strip()

            if not tracking_id or not rater_id:
                errors.append(f"Row {row_num}: missing tracking_id or rater_id")
                continue

            # Find the eval_task
            cursor = await self.db.execute("""
                SELECT et.id, et.blinding_order, et.prompt_id, et.target_model_id
                FROM eval_tasks et
                WHERE et.tracking_id = ? AND et.experiment_id = ?
            """, (tracking_id, experiment_id))
            task = await cursor.fetchone()

            if not task:
                errors.append(f"Row {row_num}: tracking_id {tracking_id} not found")
                continue

            eval_task_id = task[0]
            blinding_map = json.loads(task[1])

            # Check for duplicate
            cursor = await self.db.execute("""
                SELECT id FROM eval_ratings WHERE eval_task_id = ? AND rater_id = ?
            """, (eval_task_id, rater_id))
            if await cursor.fetchone():
                skipped += 1
                continue

            # Parse rankings and create rating entries
            reasoning = row.get("reasoning", "")
            completion_time = int(row.get("completion_time_s", 0) or 0)

            for label in sorted(blinding_map.keys()):
                rank_key = f"rank_{label.lower()}"
                rank_val = row.get(rank_key)
                if rank_val is None:
                    continue

                condition_id = blinding_map[label]
                # Find response_id
                cursor = await self.db.execute("""
                    SELECT id FROM experiment_responses
                    WHERE experiment_id = ? AND prompt_id = ? AND model_id = ? AND condition_id = ?
                """, (experiment_id, task[2], task[3], condition_id))
                resp = await cursor.fetchone()
                if not resp:
                    continue

                try:
                    rank = int(rank_val)
                except (ValueError, TypeError):
                    continue  # skip malformed rank
                await create_eval_rating(self.db, eval_task_id, rater_id, {
                    "response_id": resp[0],
                    "position_label": label,
                    "rank": rank,
                    "reasoning": reasoning,
                    "completion_time_s": completion_time,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                })

            # Update task status
            await self.db.execute("""
                UPDATE eval_tasks SET status = 'completed' WHERE id = ?
            """, (eval_task_id,))

            imported += 1

        await self.db.commit()

        return {
            "imported": imported,
            "skipped": skipped,
            "errors": errors[:20],  # cap error list
            "total_rows": imported + skipped + len(errors),
        }
