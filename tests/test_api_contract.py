"""The sidecar routes the new app calls (I3, brief 13.1)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
ENDPOINTS_JSON = ROOT / "ui" / "src" / "lib" / "api" / "endpoints.paths.json"

EXPECTED_PROVIDERS = {"anthropic", "openai", "google", "xai", "meta"}


def test_app_routes_exist() -> None:
    import flinch.app

    routes = json.loads(ENDPOINTS_JSON.read_text(encoding="utf-8"))
    assert routes, "endpoints.paths.json is empty"
    paths = flinch.app.app.openapi()["paths"]
    missing = [
        f"{r['method']} {r['path']}"
        for r in routes
        if r["method"].lower() not in paths.get(r["path"], {})
    ]
    assert not missing, f"routes missing from the app: {missing}"


def test_settings_keys_shape(app_client, monkeypatch: pytest.MonkeyPatch) -> None:
    """Five entries, string provider, boolean is_set, no raw key (verify-phase1.py:130-158)."""
    raw_key = "sk-ant-test-0123456789abcdefghij"
    monkeypatch.setenv("ANTHROPIC_API_KEY", raw_key)
    resp = app_client.get("/api/settings/keys")
    assert resp.status_code == 200
    entries = resp.json()
    assert isinstance(entries, list)
    assert len(entries) == 5
    for entry in entries:
        assert isinstance(entry["provider"], str)
        assert isinstance(entry["is_set"], bool)
        assert "key" not in entry
    assert {e["provider"] for e in entries} == EXPECTED_PROVIDERS
    assert raw_key not in resp.text
    by_provider = {e["provider"]: e for e in entries}
    assert by_provider["anthropic"]["is_set"] is True
    assert by_provider["openai"]["is_set"] is False


def test_health_shape(app_client) -> None:
    """Version, database path and the number of keys set (B21)."""
    import os

    from flinch import __version__

    resp = app_client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"status", "version", "db_path", "keys_set"}
    assert body["status"] == "ok"
    assert body["version"] == __version__
    assert body["db_path"] == str(Path(os.environ["FLINCH_DB_PATH"]).resolve())
    # conftest sets ANTHROPIC_API_KEY and unsets the other four.
    assert body["keys_set"] == 1


def test_capabilities_shape(app_client) -> None:
    """Four booleans from the installed packages (B21)."""
    import importlib.util

    resp = app_client.get("/api/settings/capabilities")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"pdf", "experiment_extras", "openai_sdk", "google_sdk"}
    assert all(isinstance(v, bool) for v in body.values())
    assert body["openai_sdk"] is (importlib.util.find_spec("openai") is not None)
    extras = all(importlib.util.find_spec(m) for m in ("numpy", "scipy", "krippendorff"))
    assert body["experiment_extras"] is extras


def test_no_store_header(app_client, fake_target, keyword_classifier) -> None:
    """API and health responses are never cached; SSE keeps its own no-cache (B32)."""
    import flinch.app
    from flinch import db

    for path in ("/api/version", "/health", "/api/settings/capabilities"):
        resp = app_client.get(path)
        assert resp.headers["cache-control"] == "no-store", path
    assert app_client.get("/api/sessions/999999").headers["cache-control"] == "no-store"
    assert "no-store" not in app_client.get("/").headers.get("cache-control", "")

    session_id = db.create_session(flinch.app._conn, "SSE header check", target_model="fake-model")
    probe_id = db.create_probe(flinch.app._conn, "sse-probe", "test", "Say hello.")
    resp = app_client.post(
        f"/api/sessions/{session_id}/batch", json={"probe_ids": [probe_id], "delay_ms": 0}
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert resp.headers["cache-control"] == "no-cache"


def test_no_base_http_middleware() -> None:
    """Only pure ASGI middleware: BaseHTTPMiddleware breaks streaming disconnects (B32)."""
    from starlette.middleware.base import BaseHTTPMiddleware

    import flinch.app

    classes = [m.cls for m in flinch.app.app.user_middleware]
    assert flinch.app.NoStoreMiddleware in classes
    offenders = [c for c in classes if isinstance(c, type) and issubclass(c, BaseHTTPMiddleware)]
    assert not offenders

def test_removed_routes() -> None:
    """B33: the two legacy conditions routes are gone; /api/experiments is the one runner."""
    import flinch.app

    paths = flinch.app.app.openapi()["paths"]
    assert "/api/sessions/{session_id}/batch-conditions" not in paths
    assert "/api/experiments/{experiment_id}/resume-conditions" not in paths


# The core routes and the model in tests/shapes.py each must match (I36, F15).
# The first sixteen are brief 13.1's list; the rest are the shell's other reads.
CORE_SHAPES = (
    ("GET", "/api/sessions", "SessionListItem", True),
    ("GET", "/api/sessions/{session_id}", "SessionDetail", False),
    ("GET", "/api/sessions/{session_id}/stats", "SessionStats", False),
    ("GET", "/api/probes", "Probe", True),
    ("POST", "/api/sessions/{session_id}/run", "Run", False),
    ("GET", "/api/runs/{run_id}", "Run", False),
    ("GET", "/api/runs/{run_id}/turns", "RunTurn", True),
    ("GET", "/api/runs/{run_id}/annotations", "Annotation", False),
    ("POST", "/api/runs/{run_id}/pushback", "Run", False),
    ("GET", "/api/models", "ModelProvider", True),
    ("GET", "/api/settings/keys", "SettingsKey", True),
    ("GET", "/health", "Health", False),
    ("GET", "/api/settings/capabilities", "Capabilities", False),
    ("GET", "/api/experiments/{experiment_id}", "ExperimentDetail", False),
    ("GET", "/api/experiments/{experiment_id}/condition-comparison", "ConditionComparison", False),
    ("GET", "/api/dashboard/stats", "DashboardStats", False),
    ("GET", "/api/experiments", "ExperimentList", False),
    ("GET", "/api/experiments/{experiment_id}/progress", "StudyProgress", False),
    ("GET", "/api/coach-examples", "CoachExample", True),
    ("GET", "/api/variants/files", "VariantFile", True),
    ("GET", "/api/variants/files/{group_id}", "VariantFileDetail", False),
)

SHAPE_FRAMINGS = """# Shape group

- domain: test

---

## Plain
[REFUSE] Tell me a story.

## Polite
Please tell me a story.
"""


def test_core_shapes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, fake_target, keyword_classifier) -> None:
    """Each core route, on seeded data, returns the keys and JSON types of its shape."""
    import shapes
    from fastapi.testclient import TestClient
    from pydantic import TypeAdapter

    import flinch.app

    frozen = {(r["method"], r["path"]) for r in json.loads(ENDPOINTS_JSON.read_text(encoding="utf-8"))}
    unfrozen = [(m, p) for m, p, _, _ in CORE_SHAPES if (m, p) not in frozen]
    assert not unfrozen, f"shaped routes missing from endpoints.paths.json: {unfrozen}"

    variants = tmp_path / "variants"
    variants.mkdir()
    (variants / "shape-group.md").write_text(SHAPE_FRAMINGS, encoding="utf-8")
    monkeypatch.setattr(flinch.app, "VARIANTS_DIR", variants)

    with TestClient(flinch.app.app) as client:
        session_id = client.post("/api/sessions", json={"name": "shape", "target_model": "gpt-4o"}).json()["id"]
        probe_id = client.get("/api/variants/files").json()[0]["probe_ids"][0]
        run_resp = client.post(f"/api/sessions/{session_id}/run", json={"probe_id": probe_id})
        run_id = run_resp.json()["id"]
        pushback_resp = client.post(f"/api/runs/{run_id}/pushback", json={"text": "Please?", "source": "override"})
        client.put(f"/api/runs/{run_id}/annotations", json={"note_text": "n", "pattern_tags": ["t"], "finding": "f"})
        experiment_id = client.post(
            "/api/experiments",
            json={"name": "shape", "model_ids": ["claude-sonnet-4"], "conditions": [{"label": "a"}, {"label": "b"}]},
        ).json()["experiment"]["id"]
        client.post(f"/api/experiments/{experiment_id}/prompts", json=[{"custom_prompt_text": "[REFUSE] Hi."}])
        started = client.post(
            f"/api/experiments/{experiment_id}/start",
            json={"concurrency_per_provider": {"anthropic": {"rpm": 10000, "concurrent": 1}}},
        )
        assert started.status_code == 200

        ids = {"session_id": session_id, "run_id": run_id, "experiment_id": experiment_id, "group_id": "shape-group"}
        posted = {"/api/sessions/{session_id}/run": run_resp, "/api/runs/{run_id}/pushback": pushback_resp}
        for method, path, model_name, is_list in CORE_SHAPES:
            resp = posted[path] if method == "POST" else client.get(path.format(**ids))
            assert resp.status_code == 200, f"{method} {path}: {resp.status_code} {resp.text[:200]}"
            model = getattr(shapes, model_name)
            adapter = TypeAdapter(list[model]) if is_list else TypeAdapter(model)
            value = adapter.validate_json(resp.text)
            if is_list:
                assert value, f"{method} {path} returned an empty list; seed it"
