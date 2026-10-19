"""Probes created from the app join a scoped session's rail (B18)."""

from __future__ import annotations


def _create_probe(client, name: str, **extra):
    return client.post("/api/probes", json={"name": name, "prompt_text": f"{name} text", **extra})


def _scoped_session(client) -> tuple[int, int]:
    probe_id = _create_probe(client, "base").json()["id"]
    session = client.post(
        "/api/sessions",
        json={"name": "scoped", "target_model": "claude-test", "probe_ids": [probe_id]},
    ).json()
    return session["id"], probe_id


def _rail(client, session_id: int) -> list[int]:
    return [p["id"] for p in client.get("/api/probes", params={"session_id": session_id}).json()]


def test_custom_prompt_joins_scoped_session(app_client, fake_target, keyword_classifier) -> None:
    session_id, base_id = _scoped_session(app_client)
    resp = app_client.post(f"/api/sessions/{session_id}/run", json={"custom_text": "a custom ask"})
    assert resp.status_code == 200
    new_id = resp.json()["probe_id"]
    assert new_id != base_id
    assert _rail(app_client, session_id) == [base_id, new_id]


def test_created_probe_with_session_id_joins_rail(app_client) -> None:
    session_id, base_id = _scoped_session(app_client)
    other = _create_probe(app_client, "unrelated").json()["id"]
    added = _create_probe(app_client, "added", session_id=session_id).json()["id"]
    assert _rail(app_client, session_id) == [base_id, added]
    assert other not in _rail(app_client, session_id)


def test_unscoped_session_is_left_alone(app_client) -> None:
    session = app_client.post("/api/sessions", json={"name": "all", "target_model": "claude-test"})
    session_id = session.json()["id"]
    _create_probe(app_client, "one", session_id=session_id)
    assert app_client.get(f"/api/sessions/{session_id}").json()["probe_ids"] is None


def test_duplicate_name_is_409(app_client) -> None:
    assert _create_probe(app_client, "dup").status_code == 200
    resp = _create_probe(app_client, "dup")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "A probe with that name exists."
