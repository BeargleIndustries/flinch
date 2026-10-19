"""Framing files can be run; syncing never touches other probes (B13, I32).

Every case uses a temp variants folder and never touches `flinch/variants/`.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

FRAMINGS = """# Group A

Three framings of one request.

- domain: test

---

## Plain
Tell me a story.

## Polite
Please tell me a story.

## Urgent
I need a story right now.
"""

CONDITIONS = """# Conditions

- type: conditions

---

## Neutral
You are a helpful assistant.

## Strict
You follow the rules.
"""


@pytest.fixture
def variants_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    folder = tmp_path / "variants"
    folder.mkdir()
    (folder / "group-a.md").write_text(FRAMINGS, encoding="utf-8")
    (folder / "conds.md").write_text(CONDITIONS, encoding="utf-8")
    import flinch.app

    monkeypatch.setattr(flinch.app, "VARIANTS_DIR", folder)
    return folder


@pytest.fixture
def client(variants_dir: Path) -> Iterator:
    from fastapi.testclient import TestClient

    import flinch.app

    with TestClient(flinch.app.app) as c:
        yield c


def _files(client) -> dict[str, dict]:
    return {f["group_id"]: f for f in client.get("/api/variants/files").json()}


def _probe_count(client) -> int:
    return len(client.get("/api/probes").json())


def test_list_returns_probe_ids(client) -> None:
    files = _files(client)
    assert len(files["group-a"]["probe_ids"]) == 3
    assert files["conds"]["probe_ids"] == []
    probes = {p["id"]: p for p in client.get("/api/probes").json()}
    texts = [probes[pid]["prompt_text"] for pid in files["group-a"]["probe_ids"]]
    assert texts == ["Tell me a story.", "Please tell me a story.", "I need a story right now."]


def test_get_file_returns_prompts(client) -> None:
    body = client.get("/api/variants/files/group-a").json()
    assert [v["prompt_text"] for v in body["variants"]] == [
        "Tell me a story.", "Please tell me a story.", "I need a story right now.",
    ]
    assert client.get("/api/variants/files/missing").status_code == 404


def test_save_does_not_reload_default_probes(client, variants_dir: Path) -> None:
    client.post("/api/probes", json={"name": "mine", "prompt_text": "Mine."})
    before = _probe_count(client)

    resp = client.post("/api/variants/files", json={
        "group_id": "group-b", "title": "B", "variants": [
            {"label": "One", "prompt_text": "First."}, {"label": "Two", "prompt_text": "Second."},
        ],
    })

    assert resp.status_code == 200
    assert _probe_count(client) == before + 2
    assert len(_files(client)["group-b"]["probe_ids"]) == 2
    assert (variants_dir / "group-b.md").exists()


def test_restart_keeps_deleted_probes_deleted_and_text_unchanged(variants_dir: Path) -> None:
    from fastapi.testclient import TestClient

    import flinch.app

    with TestClient(flinch.app.app) as c:
        first, second, third = _files(c)["group-a"]["probe_ids"]
        assert c.delete(f"/api/probes/{first}").status_code == 200
        flinch.app._conn.execute("UPDATE probes SET prompt_text = 'Edited.' WHERE id = ?", (second,))
        flinch.app._conn.commit()

    with TestClient(flinch.app.app) as c:
        assert _files(c)["group-a"]["probe_ids"] == [second, third]
        probes = {p["id"]: p for p in c.get("/api/probes").json()}
        assert first not in probes
        assert probes[second]["prompt_text"] == "Edited."
        for pid in (second, third):
            assert c.delete(f"/api/probes/{pid}").status_code == 200

    with TestClient(flinch.app.app) as c:
        assert _files(c)["group-a"]["probe_ids"] == []
        assert _probe_count(c) == 0


def test_variants_dir_env_override(tmp_path: Path) -> None:
    env = {**os.environ, "FLINCH_VARIANTS_DIR": str(tmp_path / "elsewhere")}
    out = subprocess.run(
        [sys.executable, "-c", "import flinch.app; print(flinch.app.VARIANTS_DIR)"],
        cwd=ROOT, env=env, capture_output=True, text=True, timeout=60, check=True,
    ).stdout.strip().splitlines()[-1]
    assert Path(out) == tmp_path / "elsewhere"
