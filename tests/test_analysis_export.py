"""T23b: statistics on zero-variance metrics never answer 500, and the analysis CSV exports."""

from __future__ import annotations

import csv
import io
import json
import math
import sqlite3
from pathlib import Path

import pytest

FAST = {"openai": {"rpm": 10000, "concurrent": 5}}


def _completed_study(client) -> int:
    """Two conditions, every reply from the fake model the same length (zero variance)."""
    exp_id = client.post(
        "/api/experiments",
        json={"name": "stats", "model_ids": ["gpt-4o"], "repetitions": 2,
              "conditions": [{"label": "c0"}, {"label": "c1"}]},
    ).json()["experiment"]["id"]
    client.post(f"/api/experiments/{exp_id}/prompts",
                json=[{"custom_prompt_text": f"Prompt {i}."} for i in range(3)])
    resp = client.post(f"/api/experiments/{exp_id}/start", json={"concurrency_per_provider": FAST})
    assert "event: complete" in resp.text
    resp = client.post(f"/api/experiments/{exp_id}/metrics")
    assert resp.status_code == 200, resp.text
    return exp_id


def _floats(value):
    if isinstance(value, dict):
        for v in value.values():
            yield from _floats(v)
    elif isinstance(value, list):
        for v in value:
            yield from _floats(v)
    elif isinstance(value, float):
        yield value


def _insert(env: Path, exp_id: int, analysis_type: str, results: str) -> None:
    conn = sqlite3.connect(env / "flinch.db")
    try:
        conn.execute(
            "INSERT INTO analysis_results (experiment_id, analysis_type, scope, results) VALUES (?, ?, 'full', ?)",
            (exp_id, analysis_type, results),
        )
        conn.commit()
    finally:
        conn.close()


def test_json_safe_maps_non_finite_to_none() -> None:
    np = pytest.importorskip("numpy")
    from flinch.db import json_safe

    value = {"a": float("nan"), "b": [float("inf"), -float("inf"), 1.5], "c": np.float64("nan"),
             "d": np.float32(2.5), "e": np.array([1.0, np.nan]), "f": (3, "x"), "g": None}
    assert json_safe(value) == {"a": None, "b": [None, None, 1.5], "c": None, "d": 2.5,
                                "e": [1.0, None], "f": [3, "x"], "g": None}


def test_zero_variance_study_analyzes_compares_and_exports(app_client, env, fake_target,
                                                           keyword_classifier) -> None:
    pytest.importorskip("scipy")
    exp_id = _completed_study(app_client)
    rows = sqlite3.connect(env / "flinch.db").execute(
        "SELECT COUNT(DISTINCT word_count), COUNT(*) FROM response_metrics").fetchone()
    assert rows[0] == 1 and rows[1] == 12  # identical lengths: every t-test is NaN

    resp = app_client.post(f"/api/experiments/{exp_id}/analyze", json={})
    assert resp.status_code == 200, resp.text
    assert "NaN" not in resp.text and "Infinity" not in resp.text
    analysis = json.loads(resp.text, parse_constant=lambda c: pytest.fail(f"non-finite {c} in response"))
    assert all(math.isfinite(f) for f in _floats(analysis))
    word_count = analysis["analysis"]["effect_sizes"]["c0_vs_c1"]["word_count"]
    assert word_count["p_value"] is None

    stored = sqlite3.connect(env / "flinch.db").execute(
        "SELECT results FROM analysis_results WHERE experiment_id = ?", (exp_id,)).fetchall()
    assert stored and not any("NaN" in r[0] or "Infinity" in r[0] for r in stored)

    comparison = app_client.get(f"/api/experiments/{exp_id}/condition-comparison")
    assert comparison.status_code == 200, comparison.text
    assert comparison.json()["analysis_results"]["effect_sizes"]["c0_vs_c1"]["word_count"]["p_value"] is None

    export = app_client.get(f"/api/experiments/{exp_id}/analysis/export")
    assert export.status_code == 200, export.text
    assert export.headers["content-type"].startswith("text/csv")
    table = list(csv.reader(io.StringIO(export.text)))
    assert table[0][:3] == ["metric", "cond_1", "cond_2"]
    tests = {(pair, metric)
             for kind in ("effect_sizes", "nonparametric", "paired")
             for pair, metrics in analysis["analysis"][kind].items() if isinstance(metrics, dict)
             for metric, data in metrics.items() if isinstance(data, dict)}
    assert len(table) - 1 == len(tests) > 0
    assert {(f"{r[1]}_vs_{r[2]}", r[0]) for r in table[1:]} == tests
    by_metric = {r[0]: r for r in table[1:]}
    assert by_metric["word_count"][table[0].index("cohens_d")] != "None"

    report = app_client.post(f"/api/experiments/{exp_id}/report", json={"include_charts": False})
    assert report.status_code == 200, report.text
    assert "| c0_vs_c1 | word_count |" in report.json()["tables"]["effect_sizes"]["markdown"]


def test_saved_nan_row_loads_as_null(app_client, env) -> None:
    exp_id = app_client.post(
        "/api/experiments", json={"name": "nan", "model_ids": ["gpt-4o"],
                                  "conditions": [{"label": "a"}, {"label": "b"}]},
    ).json()["experiment"]["id"]
    _insert(env, exp_id, "effect_sizes",
            '{"a_vs_b": {"word_count": {"cohens_d": 0.0, "p_value": NaN, "ci_lower": -Infinity, "n1": 3, "n2": 3}}}')

    comparison = app_client.get(f"/api/experiments/{exp_id}/condition-comparison")
    assert comparison.status_code == 200, comparison.text
    row = comparison.json()["analysis_results"]["effect_sizes"]["a_vs_b"]["word_count"]
    assert row["p_value"] is None and row["ci_lower"] is None and row["cohens_d"] == 0.0

    listed = app_client.get(f"/api/experiments/{exp_id}/analysis")
    assert listed.status_code == 200, listed.text

    export = app_client.get(f"/api/experiments/{exp_id}/analysis/export")
    assert export.status_code == 200, export.text
    header, data = list(csv.reader(io.StringIO(export.text)))
    assert data[:3] == ["word_count", "a", "b"]
    assert data[header.index("p_raw")] == "" and data[header.index("ci_lower")] == ""
    assert data[header.index("cohens_d")] == "0.0"


def test_export_without_analysis_is_header_only(app_client) -> None:
    exp_id = app_client.post(
        "/api/experiments", json={"name": "empty", "model_ids": ["gpt-4o"], "conditions": [{"label": "a"}]},
    ).json()["experiment"]["id"]
    export = app_client.get(f"/api/experiments/{exp_id}/analysis/export")
    assert export.status_code == 200, export.text
    assert export.text.splitlines()[0].startswith("metric,cond_1,cond_2,")
    assert len(export.text.splitlines()) == 1
