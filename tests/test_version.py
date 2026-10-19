"""Version 0.9.0 everywhere (B34)."""

from __future__ import annotations

import json
import re
import tomllib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.9.0"

TAURI_CONF = ROOT / "src-tauri" / "tauri.conf.json"
CARGO_TOML = ROOT / "src-tauri" / "Cargo.toml"
UI_PACKAGE = ROOT / "ui" / "package.json"


def _tauri_conf_version() -> str | None:
    if not TAURI_CONF.exists():
        return None
    return json.loads(TAURI_CONF.read_text(encoding="utf-8")).get("version")


def _cargo_version() -> str | None:
    if not CARGO_TOML.exists():
        return None
    return tomllib.loads(CARGO_TOML.read_text(encoding="utf-8"))["package"]["version"]


def test_init_version() -> None:
    text = (ROOT / "flinch" / "__init__.py").read_text(encoding="utf-8")
    assert re.search(r'^__version__ = "([^"]+)"', text, re.M).group(1) == VERSION


def test_pyproject_version() -> None:
    data = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    assert data["project"]["version"] == VERSION


def test_health_and_version_agree(app_client) -> None:
    assert app_client.get("/health").json()["version"] == VERSION
    assert app_client.get("/api/version").json() == {"version": VERSION}


def test_session_export_version(app_client) -> None:
    import flinch.app
    from flinch import db

    session_id = db.create_session(flinch.app._conn, "Version check")
    resp = app_client.get(
        f"/api/sessions/{session_id}/export", params={"include_annotations": "true"}
    )
    assert resp.status_code == 200
    assert resp.json()["flinch_version"] == VERSION


def test_full_export_version(app_client) -> None:
    import flinch.app
    from flinch import db

    assert db.export_all_data(flinch.app._conn)["flinch_version"] == VERSION


def test_tauri_conf_version() -> None:
    assert _tauri_conf_version() == VERSION


def test_cargo_version() -> None:
    assert _cargo_version() == VERSION


@pytest.mark.skipif(not UI_PACKAGE.exists(), reason="ui/package.json is created in T10")
def test_ui_package_version() -> None:
    assert json.loads(UI_PACKAGE.read_text(encoding="utf-8"))["version"] == VERSION
