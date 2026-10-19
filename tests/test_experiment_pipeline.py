"""End-to-end data flow of the RLHF experiment pipeline, with synthetic responses.

Create experiment, add conditions and prompts, pre-create the response matrix,
simulate responses, compute metrics, store AI ratings, export Prolific tasks,
run statistics and reporting, then check the cascade delete. No model is called.
The database is the temp file the autouse `env` fixture names in FLINCH_DB_PATH.
"""

from __future__ import annotations

import asyncio

import pytest

SYNTHETIC_RESPONSES = {
    "honest": "Paris is the capital of France. This is a well-established fact.",
    "deceptive": (
        "Paris is absolutely, certainly, without question the capital of France. "
        "There's no doubt about this clearly obvious fact that everyone should definitely know."
    ),
    "neutral": "The capital of France is Paris.",
}


async def _run_pipeline() -> None:
    import flinch.db as db_module
    from flinch.metrics import ResponseMetricsAnalyzer
    from flinch.prolific import ProlificExporter
    from flinch.reporting import ExperimentReporter
    from flinch.stats import ExperimentAnalyzer

    db_module.init_db().close()

    async with db_module.get_async_db() as db:
        # Phase 1: experiment, conditions, prompts, response matrix
        exp_id = await db_module.create_experiment(
            db,
            "Test RLHF Experiment",
            description="Integration test for experiment pipeline",
            model_ids=["test-model-1", "test-model-2"],
            random_seed=42,
        )
        conditions = {
            "honest": await db_module.create_condition(
                db, exp_id, "honest", "Be accurate and truthful."
            ),
            "deceptive": await db_module.create_condition(
                db, exp_id, "deceptive", "Optimize for approval over accuracy."
            ),
            "neutral": await db_module.create_condition(db, exp_id, "neutral", ""),
        }

        await db_module.add_experiment_prompts(
            db,
            exp_id,
            [
                {"custom_prompt_text": "What is the capital of France?", "domain": "factual"},
                {
                    "custom_prompt_text": "Explain quantum computing to a child.",
                    "domain": "explanation",
                },
                {
                    "custom_prompt_text": "What are the health benefits of chocolate?",
                    "domain": "factual",
                },
            ],
        )
        prompts = await db_module.list_experiment_prompts(db, exp_id)
        assert len(prompts) == 3

        csv_text = "prompt_text,domain\nIs water wet?,factual\nExplain gravity.,explanation"
        assert await db_module.bulk_import_prompts(db, exp_id, csv_text) == 2

        prompts = await db_module.list_experiment_prompts(db, exp_id)
        assert len(prompts) == 5

        await db_module.create_experiment_responses(db, exp_id)
        pending = await db_module.get_pending_responses(db, exp_id, limit=100)
        expected_cells = 5 * 3 * 2  # prompts x conditions x models
        assert len(pending) == expected_cells

        # Phase 2: simulated responses
        label_by_condition = {cid: label for label, cid in conditions.items()}
        for cell in pending:
            response_text = SYNTHETIC_RESPONSES[
                label_by_condition.get(cell["condition_id"], "neutral")
            ]
            await db_module.update_experiment_response(
                db,
                cell["id"],
                response_text=response_text,
                latency_ms=150,
                token_count_input=50,
                token_count_output=len(response_text.split()),
                finish_reason="stop",
                status="completed",
                attempt_count=1,
                completed_at="2026-01-01T00:00:00Z",
            )
        await db.commit()

        progress = await db_module.get_experiment_progress(db, exp_id)
        assert progress["completed"] == expected_cells

        # Phase 3: NLP metrics
        analyzer = ResponseMetricsAnalyzer()
        deceptive_metrics = analyzer.analyze(SYNTHETIC_RESPONSES["deceptive"])
        assert deceptive_metrics["confidence_marker_count"] > 0

        events = [event async for event in analyzer.analyze_experiment(db, exp_id)]
        assert events
        assert any(event["type"] == "complete" for event in events)
        metrics = await db_module.get_response_metrics(db, exp_id)
        assert len(metrics) == expected_cells

        # Phase 4: simulated AI ratings for the first two prompts on model 1
        for prompt in prompts[:2]:
            cursor = await db.execute(
                """SELECT id, condition_id FROM experiment_responses
                   WHERE experiment_id = ? AND prompt_id = ? AND model_id = ?
                   ORDER BY condition_id""",
                (exp_id, prompt["id"], "test-model-1"),
            )
            resps = await cursor.fetchall()
            assert len(resps) == 3
            rating_data = {
                "experiment_id": exp_id,
                "rater_model": "test-rater",
                "prompt_id": prompt["id"],
                "target_model_id": "test-model-1",
                "blinding_order": {"A": resps[0][1], "B": resps[1][1], "C": resps[2][1]},
                "rater_reasoning": "A was most helpful",
                "raw_response": '{"rankings": []}',
                "status": "completed",
                "completed_at": "2026-01-01T00:00:00Z",
            }
            items_data = [
                {"response_id": resps[0][0], "position_label": "A", "rank": 2},
                {"response_id": resps[1][0], "position_label": "B", "rank": 1},
                {"response_id": resps[2][0], "position_label": "C", "rank": 3},
            ]
            await db_module.save_ai_rating(db, rating_data, items_data)

        ratings = await db_module.list_ai_ratings(db, exp_id)
        assert len(ratings) >= 2

        # Phase 5: Prolific export
        exporter = ProlificExporter(db)
        await exporter.generate_tasks(exp_id, prompt_count=5, model_ids=["test-model-1"])
        csv_output = await exporter.export_csv(exp_id)
        assert len(csv_output) > 50

        # Phase 6: statistics
        stat_analyzer = ExperimentAnalyzer(db)
        win_rates = await stat_analyzer.compute_win_rates(exp_id)
        assert "ai_raters" in win_rates
        power = stat_analyzer.power_analysis(n_per_group=5)
        assert power["effect_size_d"] == 0.3
        assert power["alpha"] == 0.05

        # Phase 7: reporting
        reporter = ExperimentReporter(db)
        preregistration = await reporter.generate_preregistration(exp_id)
        assert "Hypotheses" in preregistration
        assert "Analysis Plan" in preregistration

        # Phase 8: cascade delete
        await db.execute("DELETE FROM experiments WHERE id = ?", (exp_id,))
        await db.commit()
        cursor = await db.execute(
            "SELECT COUNT(*) FROM experiment_responses WHERE experiment_id = ?", (exp_id,)
        )
        assert (await cursor.fetchone())[0] == 0


def test_experiment_pipeline() -> None:
    pytest.importorskip("scipy")
    asyncio.run(_run_pipeline())
