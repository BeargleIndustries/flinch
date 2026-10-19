"""B36: the rate-limit config takes an int or `{rpm, concurrent}` per provider (I25)."""

from __future__ import annotations

import time

from flinch.rate_limiter import ProviderRateLimiter, RateLimiterPool


def _study(client, n_prompts: int, model: str = "claude-sonnet-4", n_conditions: int = 1) -> int:
    exp_id = client.post(
        "/api/experiments",
        json={"name": "limits", "model_ids": [model],
              "conditions": [{"label": f"c{i}"} for i in range(n_conditions)]},
    ).json()["experiment"]["id"]
    client.post(f"/api/experiments/{exp_id}/prompts",
                json=[{"custom_prompt_text": f"Prompt {i}."} for i in range(n_prompts)])
    return exp_id


def _progress(client, exp_id: int) -> dict:
    return client.get(f"/api/experiments/{exp_id}/progress").json()


def _status(client, exp_id: int) -> str:
    return client.get(f"/api/experiments/{exp_id}").json()["experiment"]["status"]


def test_pool_integer_dict_and_empty() -> None:
    defaults = ProviderRateLimiter.DEFAULT_LIMITS["anthropic"]
    pool = RateLimiterPool({"anthropic": 2, "openai": {"rpm": 120, "concurrent": 4}, "google": {"rpm": 30}})
    assert (pool.get("anthropic").rpm, pool.get("anthropic").max_concurrent) == (defaults["rpm"], 2)
    assert (pool.get("openai").rpm, pool.get("openai").max_concurrent) == (120, 4)
    google = ProviderRateLimiter.DEFAULT_LIMITS["google"]
    assert (pool.get("google").rpm, pool.get("google").max_concurrent) == (30, google["concurrent"])
    empty = RateLimiterPool({})
    assert (empty.get("anthropic").rpm, empty.get("anthropic").max_concurrent) == (
        defaults["rpm"], defaults["concurrent"])


def test_start_with_empty_body_runs_cells(app_client, fake_target, keyword_classifier) -> None:
    exp_id = _study(app_client, 2)
    resp = app_client.post(f"/api/experiments/{exp_id}/start", json={})
    assert resp.status_code == 200
    assert "event: complete" in resp.text
    assert _progress(app_client, exp_id)["completed"] == 2
    assert _status(app_client, exp_id) == "completed"


def test_start_with_integer_limit_runs_cells(app_client, fake_target, keyword_classifier) -> None:
    exp_id = _study(app_client, 2)
    resp = app_client.post(f"/api/experiments/{exp_id}/start",
                           json={"concurrency_per_provider": {"anthropic": 2}})
    assert resp.status_code == 200
    assert _progress(app_client, exp_id)["completed"] == 2
    assert _status(app_client, exp_id) == "completed"


def test_resume_with_no_body_runs_cells(app_client, fake_target, keyword_classifier, run) -> None:
    from flinch.db import create_experiment_responses, get_async_db

    exp_id = _study(app_client, 2)

    async def make_cells() -> None:
        async with get_async_db() as db_conn:
            await create_experiment_responses(db_conn, exp_id)

    run(make_cells())
    resp = app_client.post(f"/api/experiments/{exp_id}/resume")
    assert resp.status_code == 200
    assert "event: complete" in resp.text
    assert _progress(app_client, exp_id)["completed"] == 2


def test_integer_limit_above_50_rejected(app_client) -> None:
    exp_id = _study(app_client, 1)
    resp = app_client.post(f"/api/experiments/{exp_id}/start",
                           json={"concurrency_per_provider": {"anthropic": 51}})
    assert resp.status_code == 422
    assert _status(app_client, exp_id) == "draft"


def test_five_cells_run_concurrently(app_client, fake_target, keyword_classifier, run) -> None:
    """5 cells of 0.1 s with concurrency 5 finish in under 0.3 s (workers per provider, B36)."""
    from flinch.db import create_experiment_responses, get_async_db
    from flinch.runner import ExperimentRunner

    fake_target.delay_s = 0.1
    exp_id = _study(app_client, 5)

    async def drive() -> tuple[float, list[dict]]:
        async with get_async_db() as db_conn:
            await create_experiment_responses(db_conn, exp_id)
            # A high rpm so the per-request spacing does not serialise the cells.
            pool = RateLimiterPool({"anthropic": {"rpm": 10000, "concurrent": 5}})
            runner = ExperimentRunner(db_conn, pool)
            start = time.monotonic()
            events = [e async for e in runner.run_experiment(exp_id)]
            return time.monotonic() - start, events

    elapsed, events = run(drive())
    assert events[-1]["type"] == "complete"
    assert events[-1]["completed"] == 5
    assert elapsed < 0.3, elapsed
