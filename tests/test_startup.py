"""On start, rows a crashed sidecar left `running` are settled (B23, I16)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

import flinch.app
from flinch import db

SWEEP = {
    "experiments": "paused",
    "batch_runs": "cancelled",
    "stat_runs": "failed",
    "sequence_batches": "failed",
    "sequences": "failed",
    "sequence_runs": "failed",
}

SEED = {
    "experiments": "INSERT INTO experiments (name, status) VALUES ('e', ?)",
    "batch_runs": "INSERT INTO batch_runs (session_id, status) VALUES (1, ?)",
    "stat_runs": "INSERT INTO stat_runs (session_id, probe_id, target_model, status) VALUES (1, 1, 'm', ?)",
    "sequence_batches": "INSERT INTO sequence_batches (session_id, strategy_id, status) VALUES (1, 1, ?)",
    "sequences": "INSERT INTO sequences (session_id, probe_id, strategy_id, status) VALUES (1, 1, 1, ?)",
    "sequence_runs": "INSERT INTO sequence_runs (sequence_id, warmup_count, status) VALUES (1, 0, ?)",
}


def _statuses(path: Path) -> dict[str, list[str]]:
    conn = sqlite3.connect(path)
    try:
        return {
            table: [row[0] for row in conn.execute(f"SELECT status FROM {table} ORDER BY id")]
            for table in SWEEP
        }
    finally:
        conn.close()


def test_startup_sweep(env: Path) -> None:
    path = env / "flinch.db"
    conn = db.init_db(path)
    # The seeded rows reference parents that do not exist; only their status matters here.
    conn.execute("PRAGMA foreign_keys=OFF")
    for table, sql in SEED.items():
        conn.execute(sql, ("running",))
        conn.execute(sql, ("completed",))
    conn.commit()
    conn.close()

    with TestClient(flinch.app.app):
        pass

    assert _statuses(path) == {table: [status, "completed"] for table, status in SWEEP.items()}
