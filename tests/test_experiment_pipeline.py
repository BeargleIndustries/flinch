"""End-to-end integration test for the RLHF experiment pipeline.

Tests the full lifecycle: create experiment → add conditions → add prompts →
pre-create response matrix → compute metrics → generate stats → generate report.

Skips API calls (no real model interaction) — tests data flow and analysis.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def run_pipeline_test():
    """Test the full experiment pipeline with synthetic data."""
    import flinch.db as db_module

    # Use a temp database (ignore_cleanup_errors for Windows file-lock on .db)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        import pathlib
        db_path = pathlib.Path(tmpdir) / "test_flinch.db"

        original_path = db_module.DB_PATH
        db_module.DB_PATH = db_path
        db = None

        try:
            # Initialize schema via sync init_db
            conn = db_module.init_db(db_path)
            conn.close()

            # Open async connection (assigned so finally block can close it)
            db = await db_module.get_async_db()

            print("=== Phase 1: Create Experiment ===")
            exp_id = await db_module.create_experiment(
                db, "Test RLHF Experiment",
                description="Integration test for experiment pipeline",
                model_ids=["test-model-1", "test-model-2"],
                random_seed=42,
            )
            print(f"  Created experiment: {exp_id}")

            # Add conditions
            cond_honest = await db_module.create_condition(
                db, exp_id, "honest", "Be accurate and truthful.")
            cond_deceptive = await db_module.create_condition(
                db, exp_id, "deceptive", "Optimize for approval over accuracy.")
            cond_neutral = await db_module.create_condition(
                db, exp_id, "neutral", "")
            print(f"  Created conditions: honest={cond_honest}, deceptive={cond_deceptive}, neutral={cond_neutral}")

            # Add prompts
            await db_module.add_experiment_prompts(db, exp_id, [
                {"custom_prompt_text": "What is the capital of France?", "domain": "factual"},
                {"custom_prompt_text": "Explain quantum computing to a child.", "domain": "explanation"},
                {"custom_prompt_text": "What are the health benefits of chocolate?", "domain": "factual"},
            ])
            prompts = await db_module.list_experiment_prompts(db, exp_id)
            print(f"  Added {len(prompts)} prompts")
            assert len(prompts) == 3, f"Expected 3 prompts, got {len(prompts)}"

            # Test bulk CSV import
            csv_text = "prompt_text,domain\nIs water wet?,factual\nExplain gravity.,explanation"
            csv_count = await db_module.bulk_import_prompts(db, exp_id, csv_text)
            print(f"  Bulk imported {csv_count} prompts from CSV")
            assert csv_count == 2, f"Expected 2 CSV prompts, got {csv_count}"

            # Refresh prompt list
            prompts = await db_module.list_experiment_prompts(db, exp_id)
            assert len(prompts) == 5, f"Expected 5 total prompts, got {len(prompts)}"

            # Pre-create response matrix
            await db_module.create_experiment_responses(db, exp_id)
            progress = await db_module.get_experiment_progress(db, exp_id)
            print(f"  Response matrix: {progress}")

            # Check pending
            pending = await db_module.get_pending_responses(db, exp_id, limit=100)
            print(f"  Pending cells: {len(pending)}")
            expected_cells = 5 * 3 * 2  # 5 prompts × 3 conditions × 2 models
            assert len(pending) == expected_cells, f"Expected {expected_cells} cells, got {len(pending)}"

            print("\n=== Phase 2: Simulate Responses ===")
            synthetic_responses = {
                "honest": "Paris is the capital of France. This is a well-established fact.",
                "deceptive": "Paris is absolutely, certainly, without question the capital of France. There's no doubt about this clearly obvious fact that everyone should definitely know.",
                "neutral": "The capital of France is Paris.",
            }
            conditions_map = {
                "honest": cond_honest,
                "deceptive": cond_deceptive,
                "neutral": cond_neutral,
            }

            for cell in pending:
                cond_id = cell["condition_id"]
                cond_label = next(
                    (label for label, cid in conditions_map.items() if cid == cond_id),
                    "neutral",
                )
                response_text = synthetic_responses[cond_label]

                await db_module.update_experiment_response(
                    db, cell["id"],
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
            print(f"  Progress after simulation: {progress}")
            assert progress["completed"] == expected_cells, \
                f"Expected {expected_cells} completed, got {progress['completed']}"

            print("\n=== Phase 3: NLP Metrics ===")
            from flinch.metrics import ResponseMetricsAnalyzer
            analyzer = ResponseMetricsAnalyzer()

            # Test single analysis
            test_metrics = analyzer.analyze(synthetic_responses["deceptive"])
            print(f"  Deceptive response metrics: word_count={test_metrics['word_count']}, "
                  f"confidence_count={test_metrics['confidence_marker_count']}, "
                  f"hedging_count={test_metrics['hedging_count']}")
            assert test_metrics["confidence_marker_count"] > 0, "Deceptive should have confidence markers"

            # Run on full experiment — analyze_experiment(async_db, experiment_id)
            event_count = 0
            last_complete = None
            async for event in analyzer.analyze_experiment(db, exp_id):
                event_count += 1
                if event["type"] == "complete":
                    last_complete = event
                    print(f"  Metrics computed: {event.get('completed', 0)} responses")
            assert event_count > 0, "Should have progress events"
            assert last_complete is not None, "Should have a complete event"

            # Verify metrics stored
            metrics = await db_module.get_response_metrics(db, exp_id)
            print(f"  Stored metrics: {len(metrics)} rows")
            assert len(metrics) == expected_cells, \
                f"Expected {expected_cells} metric rows, got {len(metrics)}"

            print("\n=== Phase 4: AI Ratings (simulated) ===")
            # Simulate AI ratings for first 2 prompts × model-1
            for prompt in prompts[:2]:
                cursor = await db.execute(
                    """SELECT id, condition_id FROM experiment_responses
                       WHERE experiment_id = ? AND prompt_id = ? AND model_id = ?
                       ORDER BY condition_id""",
                    (exp_id, prompt["id"], "test-model-1"),
                )
                resps = await cursor.fetchall()
                assert len(resps) == 3, f"Expected 3 responses per prompt/model, got {len(resps)}"

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
            print(f"  AI ratings stored: {len(ratings)}")
            assert len(ratings) >= 2, f"Expected at least 2 ratings, got {len(ratings)}"

            print("\n=== Phase 5: Prolific Export ===")
            from flinch.prolific import ProlificExporter
            exporter = ProlificExporter(db)
            task_result = await exporter.generate_tasks(
                exp_id, prompt_count=5, model_ids=["test-model-1"])
            print(f"  Generated eval tasks: {task_result}")

            csv_output = await exporter.export_csv(exp_id)
            print(f"  CSV export length: {len(csv_output)} chars")
            assert len(csv_output) > 50, "CSV should have content"

            print("\n=== Phase 6: Statistical Analysis ===")
            try:
                from flinch.stats import ExperimentAnalyzer
                stat_analyzer = ExperimentAnalyzer(db)
                win_rates = await stat_analyzer.compute_win_rates(exp_id)
                print(f"  Win rates: {json.dumps(win_rates, indent=2)[:200]}...")
                assert "ai_raters" in win_rates

                power = stat_analyzer.power_analysis(n_per_group=5)
                print(f"  Power analysis: d={power['effect_size_d']}, required_n={power['required_n_per_group']}")
                assert power["effect_size_d"] == 0.3
                assert power["alpha"] == 0.05
            except ImportError as e:
                print(f"  Skipping stats (optional deps not installed): {e}")

            print("\n=== Phase 7: Reporting ===")
            try:
                from flinch.reporting import ExperimentReporter
                reporter = ExperimentReporter(db)
                preregistration = await reporter.generate_preregistration(exp_id)
                print(f"  Preregistration length: {len(preregistration)} chars")
                assert "Hypotheses" in preregistration
                assert "Analysis Plan" in preregistration
            except ImportError as e:
                print(f"  Skipping reporting (optional deps not installed): {e}")

            print("\n=== Phase 8: CASCADE Delete Test ===")
            await db.execute("DELETE FROM experiments WHERE id = ?", (exp_id,))
            await db.commit()
            cursor = await db.execute(
                "SELECT COUNT(*) FROM experiment_responses WHERE experiment_id = ?", (exp_id,))
            count = (await cursor.fetchone())[0]
            assert count == 0, f"CASCADE failed: {count} orphan responses remain"
            print("  CASCADE delete: all children removed")

            print("\n" + "=" * 50)
            print("ALL TESTS PASSED")
            print("=" * 50)

        finally:
            if db is not None:
                try:
                    await db.close()
                except Exception:
                    pass
            db_module.DB_PATH = original_path


if __name__ == "__main__":
    asyncio.run(run_pipeline_test())
