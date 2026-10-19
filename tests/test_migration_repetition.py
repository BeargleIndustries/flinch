"""B11 migration: a 0.8 database gains `repetition` without losing rows, children or WAL pages."""

from __future__ import annotations

import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

import flinch.db as db

ROOT = Path(__file__).resolve().parents[1]

# The 0.8 experiment_responses DDL, copied from a 0.8 database.
DDL_08 = """CREATE TABLE experiment_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    condition_id INTEGER NOT NULL REFERENCES experiment_conditions(id) ON DELETE CASCADE,
    prompt_id INTEGER NOT NULL REFERENCES experiment_prompts(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    response_text TEXT,
    raw_response TEXT,
    latency_ms INTEGER,
    token_count_input INTEGER,
    token_count_output INTEGER,
    finish_reason TEXT,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    attempt_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT, classification TEXT,
    UNIQUE(experiment_id, condition_id, prompt_id, model_id)
)"""


def _build_08(path: Path) -> None:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(db.SCHEMA)
    conn.execute("DROP TABLE experiment_responses")
    conn.execute(DDL_08)
    conn.executescript(
        """
        INSERT INTO probes (id, name, prompt_text) VALUES (1, 'p1', 'Probe text');
        INSERT INTO experiments (id, name) VALUES (1, 's');
        INSERT INTO experiment_conditions (id, experiment_id, label, system_prompt)
            VALUES (1, 1, 'a', ''), (2, 1, 'b', '');
        INSERT INTO experiment_prompts (id, experiment_id, probe_id, custom_prompt_text)
            VALUES (1, 1, 1, NULL), (2, 1, NULL, 'Own text');
        INSERT INTO experiment_responses (id, experiment_id, condition_id, prompt_id, model_id,
                                          response_text, status)
            VALUES (10, 1, 1, 1, 'm', 'x', 'completed'), (11, 1, 2, 1, 'm', 'y', 'completed');
        UPDATE sqlite_sequence SET seq = 50 WHERE name = 'experiment_responses';
        INSERT INTO response_metrics (response_id, word_count) VALUES (10, 1), (11, 1);
        INSERT INTO ai_ratings (id, experiment_id, rater_model, prompt_id, target_model_id,
                                blinding_order) VALUES (1, 1, 'r', 1, 'm', '{}');
        INSERT INTO ai_rating_items (rating_id, response_id, position_label, rank)
            VALUES (1, 10, 'A', 1), (1, 11, 'B', 2);
        INSERT INTO eval_tasks (id, experiment_id, batch_id, prompt_id, target_model_id,
                                blinding_order, tracking_id) VALUES (1, 1, 'b', 1, 'm', '{}', 't');
        INSERT INTO eval_ratings (eval_task_id, rater_id, response_id, position_label, rank)
            VALUES (1, 'h', 11, 'A', 1);
        """
    )
    conn.commit()
    conn.close()


def _q(path: Path, sql: str, params: tuple = ()) -> list[tuple]:
    conn = sqlite3.connect(path)
    try:
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def test_migration_keeps_rows_children_ids_and_sequence(tmp_path: Path) -> None:
    path = tmp_path / "old.db"
    _build_08(path)
    db.init_db(path).close()

    assert _q(path, "SELECT id, repetition FROM experiment_responses ORDER BY id") == [(10, 0), (11, 0)]
    assert _q(path, "SELECT response_id FROM response_metrics ORDER BY response_id") == [(10,), (11,)]
    assert _q(path, "SELECT response_id FROM ai_rating_items ORDER BY response_id") == [(10,), (11,)]
    assert _q(path, "SELECT response_id FROM eval_ratings") == [(11,)]
    assert _q(path, "PRAGMA foreign_key_check") == []
    assert _q(path, "SELECT seq FROM sqlite_sequence WHERE name = 'experiment_responses'") == [(50,)]
    # The probe-linked prompt keeps its text even if the probe goes later (R23)
    assert _q(path, "SELECT id, custom_prompt_text FROM experiment_prompts ORDER BY id") == [
        (1, "Probe text"), (2, "Own text"),
    ]

    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute(
        "INSERT INTO experiment_responses (experiment_id, condition_id, prompt_id, model_id, repetition) "
        "VALUES (1, 1, 1, 'm', 1)"
    )
    conn.commit()
    new_id = conn.execute("SELECT MAX(id) FROM experiment_responses").fetchone()[0]
    conn.close()
    assert new_id == 51

    # A second init_db is a no-op
    db.init_db(path).close()
    assert len(_q(path, "SELECT id FROM experiment_responses")) == 3
    schema = _q(path, "SELECT sql FROM sqlite_master WHERE name = 'experiment_responses'")[0][0]
    assert "repetition" in schema


def test_backup_created_valid_and_includes_wal_rows(tmp_path: Path) -> None:
    path = tmp_path / "old.db"
    _build_08(path)
    writer = sqlite3.connect(path)
    writer.execute("PRAGMA wal_autocheckpoint=0")
    writer.execute(
        "INSERT INTO experiment_responses (id, experiment_id, condition_id, prompt_id, model_id) "
        "VALUES (12, 1, 1, 2, 'm')"
    )
    writer.commit()
    try:
        db.init_db(path).close()
    finally:
        writer.close()

    bak = Path(f"{path}.bak-0.8")
    assert bak.is_file()
    assert _q(bak, "PRAGMA integrity_check") == [("ok",)]
    assert _q(bak, "PRAGMA journal_mode") == [("delete",)]
    assert _q(bak, "SELECT id FROM experiment_responses ORDER BY id") == [(10,), (11,), (12,)]
    cols = [r[1] for r in _q(bak, "PRAGMA table_info(experiment_responses)")]
    assert "repetition" not in cols


def test_dangling_unrelated_row_does_not_stop_init(tmp_path: Path) -> None:
    path = tmp_path / "old.db"
    _build_08(path)
    conn = sqlite3.connect(path)  # foreign keys off by default
    conn.execute(
        "INSERT INTO run_turns (run_id, role, content) VALUES (99999, 'user', 'x')"
    )
    conn.commit()
    conn.close()
    db.init_db(path).close()
    assert _q(path, "SELECT COUNT(*) FROM experiment_responses WHERE repetition = 0") == [(2,)]


def test_broken_reference_rolls_back(tmp_path: Path) -> None:
    path = tmp_path / "old.db"
    _build_08(path)
    conn = sqlite3.connect(path)
    conn.execute("INSERT INTO response_metrics (response_id, word_count) VALUES (777, 1)")
    conn.commit()
    conn.close()
    with pytest.raises(RuntimeError, match="response_metrics"):
        db.init_db(path)
    cols = [r[1] for r in _q(path, "PRAGMA table_info(experiment_responses)")]
    assert "repetition" not in cols
    assert _q(path, "SELECT COUNT(*) FROM response_metrics") == [(3,)]


def test_fresh_database_has_no_backup(tmp_path: Path) -> None:
    path = tmp_path / "new.db"
    db.init_db(path).close()
    assert not Path(f"{path}.bak-0.8").exists()
    cols = [r[1] for r in _q(path, "PRAGMA table_info(experiment_responses)")]
    assert "repetition" in cols


def test_schema_indexes_do_not_name_repetition() -> None:
    for stmt in db.SCHEMA.split(";"):
        if "CREATE INDEX" in stmt:
            assert "repetition" not in stmt


def test_check_migration_script(tmp_path: Path) -> None:
    script = str(ROOT / "scripts" / "check-migration.py")
    ok = subprocess.run([sys.executable, "-I", script, "--self-test"], capture_output=True, text=True)
    assert ok.returncode == 0, ok.stdout + ok.stderr
    assert ok.stdout.startswith("check-migration: OK")
    missing = subprocess.run([sys.executable, "-I", script, str(tmp_path / "nope.db")],
                             capture_output=True, text=True)
    assert missing.returncode != 0
    path = tmp_path / "old.db"
    _build_08(path)
    real = subprocess.run([sys.executable, "-I", script, str(path)], capture_output=True, text=True)
    assert real.returncode == 0, real.stdout + real.stderr
