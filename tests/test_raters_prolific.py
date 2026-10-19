"""B14 / I11: raters, Prolific and the paired analysis use repetition 0; blinding is reproducible."""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FAST = {"openai": {"rpm": 10000, "concurrent": 5}}
RATER = "claude-haiku-4-5-20251001"


def _study(client, conditions: int, prompts: int, repetitions: int, models=("gpt-4o",)) -> int:
    exp_id = client.post(
        "/api/experiments",
        json={"name": "raters", "model_ids": list(models), "repetitions": repetitions,
              "conditions": [{"label": f"c{i}"} for i in range(conditions)]},
    ).json()["experiment"]["id"]
    client.post(f"/api/experiments/{exp_id}/prompts",
                json=[{"custom_prompt_text": f"Prompt {i}."} for i in range(prompts)])
    return exp_id


def _run(client, exp_id: int) -> None:
    resp = client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": FAST})
    assert "event: complete" in resp.text


def _q(env: Path, sql: str, params: tuple = ()) -> list[tuple]:
    conn = sqlite3.connect(env / "flinch.db")
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def test_raters_and_prolific_use_repetition_zero(app_client, env, fake_target, fake_rater,
                                                 keyword_classifier) -> None:
    exp_id = _study(app_client, conditions=2, prompts=2, repetitions=3)
    _run(app_client, exp_id)
    assert _q(env, "SELECT COUNT(*) FROM experiment_responses WHERE status = 'completed'") == [(12,)]

    resp = app_client.post(f"/api/experiments/{exp_id}/rate", json={"rater_models": [RATER]})
    assert "event: complete" in resp.text
    ratings = app_client.get(f"/api/experiments/{exp_id}/ratings").json()["ratings"]
    assert len(ratings) == 2
    assert all(r["status"] == "completed" and len(r["items"]) == 2 for r in ratings)
    rated = [item["response_id"] for r in ratings for item in r["items"]]
    marks = ",".join("?" * len(rated))
    assert _q(env, f"SELECT DISTINCT repetition FROM experiment_responses WHERE id IN ({marks})",
              tuple(rated)) == [(0,)]

    first = app_client.post(f"/api/experiments/{exp_id}/prolific", json={"raters_per_task": 3})
    assert first.status_code == 200, first.text
    assert first.json()["task_count"] == 6
    second = app_client.post(f"/api/experiments/{exp_id}/prolific", json={"raters_per_task": 3})
    assert second.status_code == 200, second.text
    assert second.json()["task_count"] == 0
    assert _q(env, "SELECT COUNT(*) FROM eval_tasks") == [(6,)]

    csv_text = app_client.get(f"/api/experiments/{exp_id}/prolific/csv").text
    assert "the 2 AI responses" in csv_text


@pytest.mark.parametrize("conditions", [1, 4])
def test_prolific_only_for_two_or_three_conditions(app_client, conditions: int) -> None:
    exp_id = _study(app_client, conditions=conditions, prompts=1, repetitions=1)
    resp = app_client.post(f"/api/experiments/{exp_id}/prolific", json={})
    assert resp.status_code == 400
    assert "two or three conditions" in resp.json()["detail"]


def test_paired_analysis_pairs_prompt_and_model_at_repetition_zero(app_client, env) -> None:
    pytest.importorskip("scipy")
    exp_id = _study(app_client, conditions=2, prompts=3, repetitions=2, models=("m1", "m2"))
    conn = sqlite3.connect(env / "flinch.db")
    try:
        conn.execute("PRAGMA foreign_keys=ON")
        conds = [r[0] for r in conn.execute(
            "SELECT id FROM experiment_conditions WHERE experiment_id = ? ORDER BY id", (exp_id,))]
        prompts = [r[0] for r in conn.execute(
            "SELECT id FROM experiment_prompts WHERE experiment_id = ? ORDER BY id", (exp_id,))]
        n = 0
        for c_i, cond in enumerate(conds):
            for prompt in prompts:
                for m_i, model in enumerate(("m1", "m2")):
                    for rep in (0, 1):
                        n += 1
                        cur = conn.execute(
                            "INSERT INTO experiment_responses (experiment_id, condition_id, prompt_id, "
                            "model_id, repetition, response_text, status) "
                            "VALUES (?, ?, ?, ?, ?, 'x', 'completed')",
                            (exp_id, cond, prompt, model, rep),
                        )
                        words = 10 + n * (c_i + 1) + 100 * m_i
                        conn.execute(
                            "INSERT INTO response_metrics (response_id, word_count) VALUES (?, ?)",
                            (cur.lastrowid, words),
                        )
        conn.commit()
    finally:
        conn.close()

    async def paired() -> dict:
        import flinch.db as db
        from flinch.stats import ExperimentAnalyzer

        async with db.get_async_db() as db_conn:
            return await ExperimentAnalyzer(db_conn).compute_paired_analysis(exp_id)

    import asyncio

    result = asyncio.run(paired())
    assert result["c0_vs_c1"]["word_count"]["n_pairs"] == 6  # 3 prompts x 2 models, repetition 0


_BLINDING_SCRIPT = r"""
import asyncio, json, os, sys
from pathlib import Path
sys.path.insert(0, os.getcwd())
sys.path.insert(0, os.path.join(os.getcwd(), "tests"))
import flinch.db as db
from flinch import rater
from fakes import FakeTargetFactory, ranking_rule

factory = FakeTargetFactory(rule=ranking_rule)
rater.AIRaterPipeline._create_rater_target = lambda self, m: factory(m, rater.RATER_SYSTEM_PROMPT)

async def main():
    db.init_db(Path(os.environ["FLINCH_DB_PATH"])).close()
    async with db.get_async_db() as conn:
        exp = await db.create_experiment(conn, "blind", model_ids=["m"])
        for label in ("a", "b", "c"):
            await db.create_condition(conn, exp, label, "")
        await db.add_experiment_prompts(conn, exp, [{"custom_prompt_text": f"P{i}"} for i in range(6)])
        await db.create_experiment_responses(conn, exp)
        await conn.execute("UPDATE experiment_responses SET status='completed', response_text='t' || id")
        await conn.commit()
        from flinch.prolific import ProlificExporter
        await ProlificExporter(conn).generate_tasks(exp, raters_per_task=1)
        async for _ in rater.AIRaterPipeline(conn, ["r"]).rate_experiment(exp):
            pass
        cur = await conn.execute("SELECT prompt_id, blinding_order FROM eval_tasks ORDER BY prompt_id")
        tasks = [list(r) for r in await cur.fetchall()]
        cur = await conn.execute("SELECT prompt_id, blinding_order FROM ai_ratings ORDER BY prompt_id")
        ratings = [list(r) for r in await cur.fetchall()]
    print(json.dumps({"tasks": tasks, "ratings": ratings}))

asyncio.run(main())
"""


def test_blinding_identical_across_processes(tmp_path: Path) -> None:
    outputs = []
    for hash_seed in ("1", "2"):
        env = {**os.environ, "PYTHONHASHSEED": hash_seed,
               "FLINCH_DB_PATH": str(tmp_path / f"blind-{hash_seed}.db")}
        proc = subprocess.run([sys.executable, "-c", _BLINDING_SCRIPT], cwd=ROOT, env=env,
                              capture_output=True, text=True, timeout=120)
        assert proc.returncode == 0, proc.stderr
        outputs.append(json.loads(proc.stdout.strip().splitlines()[-1]))
    assert len(outputs[0]["tasks"]) == 6
    assert len(outputs[0]["ratings"]) == 6
    assert outputs[0] == outputs[1]
