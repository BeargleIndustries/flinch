"""All coach examples are listable; the coach still reads the five best-rated (B28)."""

from __future__ import annotations

import flinch.app
from flinch import db


def _add_examples(conn, profile: str, n: int) -> None:
    for i in range(n):
        db.create_coach_example(
            conn,
            run_id=None,
            coach_profile=profile,
            refusal_text=f"refusal {i}",
            pushback_text=f"pushback {i}",
            outcome="complied",
            pattern="unknown",
            move="specificity_challenge",
            effectiveness=(i % 5) + 1,
        )


def test_lists_more_than_ten(app_client) -> None:
    _add_examples(flinch.app._conn, "t03-profile", 12)
    resp = app_client.get("/api/coach-examples", params={"profile": "t03-profile"})
    assert len(resp.json()) == 12


def test_limit_parameter(app_client) -> None:
    _add_examples(flinch.app._conn, "t03-profile", 12)
    resp = app_client.get("/api/coach-examples", params={"profile": "t03-profile", "limit": 3})
    assert len(resp.json()) == 3


def test_coach_reads_five_best(app_client) -> None:
    _add_examples(flinch.app._conn, "t03-profile", 12)
    examples = db.list_coach_examples(flinch.app._conn, "t03-profile", limit=5)
    assert len(examples) == 5
    assert [e["effectiveness"] for e in examples] == [5, 5, 4, 4, 3]
