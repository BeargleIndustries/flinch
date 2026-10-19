"""DB-only framing groups: POST, GET and DELETE /api/probe-groups (brief 8.1, 9.9).

POST has no button (groups are made as files, 9.9) and is kept for scripts;
framings.spec.ts drives View and Delete on such a group through the UI.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

import flinch.app


def _probe(client: TestClient, name: str) -> int:
    resp = client.post("/api/probes", json={"name": name, "prompt_text": f"{name} text"})
    return resp.json()["id"]


def test_create_read_and_delete_a_group() -> None:
    with TestClient(flinch.app.app) as client:
        plain = _probe(client, "plain")
        story = _probe(client, "story")

        made = client.post(
            "/api/probe-groups",
            json={"group_id": "g1", "probe_ids": [plain, story], "labels": ["Direct", "Fiction"]},
        )
        assert made.status_code == 200
        assert made.json()["group_id"] == "g1"
        assert [v["variant_label"] for v in made.json()["variants"]] == ["Direct", "Fiction"]

        got = client.get("/api/probe-groups/g1")
        assert got.status_code == 200
        rows = got.json()["variants"]
        assert [(v["probe_id"], v["variant_label"], v["probe_name"]) for v in rows] == [
            (plain, "Direct", "plain"),
            (story, "Fiction", "story"),
        ]
        assert any(g["group_id"] == "g1" for g in client.get("/api/probe-groups").json())

        assert client.delete("/api/probe-groups/g1").json() == {"deleted": True}
        assert client.get("/api/probe-groups/g1").status_code == 404
        assert client.delete("/api/probe-groups/g1").status_code == 404
        assert not any(g["group_id"] == "g1" for g in client.get("/api/probe-groups").json())


def test_create_refuses_bad_input() -> None:
    with TestClient(flinch.app.app) as client:
        probe = _probe(client, "only")
        mismatched = client.post(
            "/api/probe-groups", json={"group_id": "g2", "probe_ids": [probe], "labels": []}
        )
        assert mismatched.status_code == 400
        blank = client.post(
            "/api/probe-groups", json={"group_id": "  ", "probe_ids": [probe], "labels": ["A"]}
        )
        assert blank.status_code == 400
