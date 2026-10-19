"""B31: the condition comparison shows the newest statistics of each type."""

from __future__ import annotations

import sqlite3
from pathlib import Path


def _study(client) -> int:
    return client.post(
        "/api/experiments", json={"name": "stats", "model_ids": ["claude-sonnet-4"], "conditions": [{"label": "a"}]}
    ).json()["experiment"]["id"]


def _insert(env: Path, exp_id: int, value: int, created_at: str) -> None:
    conn = sqlite3.connect(env / "flinch.db")
    try:
        conn.execute(
            "INSERT INTO analysis_results (experiment_id, analysis_type, scope, results, created_at) "
            "VALUES (?, 'effect_sizes', 'full', ?, ?)",
            (exp_id, f'{{"value": {value}}}', created_at),
        )
        conn.commit()
    finally:
        conn.close()


def _effect_sizes(client, exp_id: int):
    return client.get(f"/api/experiments/{exp_id}/condition-comparison").json()["analysis_results"]["effect_sizes"]


def test_newer_effect_sizes_win(app_client, env) -> None:
    exp_id = _study(app_client)
    _insert(env, exp_id, 1, "2026-01-01 10:00:00")
    _insert(env, exp_id, 2, "2026-01-02 10:00:00")
    assert _effect_sizes(app_client, exp_id) == {"value": 2}


def test_newest_by_time_not_insertion_order(app_client, env) -> None:
    exp_id = _study(app_client)
    _insert(env, exp_id, 2, "2026-01-02 10:00:00")
    _insert(env, exp_id, 1, "2026-01-01 10:00:00")
    assert _effect_sizes(app_client, exp_id) == {"value": 2}


def test_same_second_later_row_wins(app_client, env) -> None:
    """`created_at` has one-second resolution; two runs in the same second keep the later row."""
    exp_id = _study(app_client)
    _insert(env, exp_id, 1, "2026-01-01 10:00:00")
    _insert(env, exp_id, 2, "2026-01-01 10:00:00")
    assert _effect_sizes(app_client, exp_id) == {"value": 2}
