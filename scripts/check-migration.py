"""Check the 0.9 repetition migration on a copy of a 0.8 Flinch database (B11, R1, R23).

Usage (run with `python -I` from any directory):
    python -I scripts/check-migration.py <copy-of-flinch.db> [--max-seconds 20]
    python -I scripts/check-migration.py <copy-of-flinch.db> --assert-classified
    python -I scripts/check-migration.py --self-test

The database is migrated in place, so pass a copy. The default mode exits
non-zero when the input is missing or has no experiment_responses rows, then
runs `init_db` with a timer and fails on: a scoped foreign-key violation, a NULL
repetition, a changed response_metrics count, a missing, damaged or short
`.bak-0.8`, a prompt with a probe id and no text, or a run over --max-seconds.
`--assert-classified` instead fails when completed rows lack a classification,
beyond the rows `/classify` skips (prompts without text). `--self-test` builds a
small 0.8 database in a temp folder and checks it.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Migrate with this checkout's own code, not the editable install (I37, C2-B1).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import argparse  # noqa: E402
import sqlite3  # noqa: E402
import tempfile  # noqa: E402
import time  # noqa: E402

from flinch import db as flinch_db  # noqa: E402

CHILD_TABLES = ("response_metrics", "ai_rating_items", "eval_ratings")

# The 0.8 experiment_responses table, as 0.8 databases hold it.
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


def _count(conn: sqlite3.Connection, table: str) -> int:
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    except sqlite3.OperationalError:
        return 0


def check_migration(path: Path, max_seconds: float) -> tuple[list[str], str]:
    """Migrate `path` and return (failures, summary)."""
    conn = sqlite3.connect(str(path))
    try:
        before = {t: _count(conn, t) for t in ("experiment_responses", *CHILD_TABLES)}
        cols = {r[1] for r in conn.execute("PRAGMA table_info(experiment_responses)")}
    finally:
        conn.close()
    already = "repetition" in cols

    start = time.perf_counter()
    try:
        flinch_db.init_db(path).close()
    except Exception as e:
        return [f"init_db raised {type(e).__name__}: {e}"], "migration rolled back"
    seconds = time.perf_counter() - start

    failures: list[str] = []
    conn = sqlite3.connect(str(path))
    try:
        for table in flinch_db.REPETITION_KEY_CHECK_TABLES:
            if conn.execute(f"PRAGMA foreign_key_check({table})").fetchone():
                failures.append(f"foreign-key violations in {table}")
        nulls = conn.execute(
            "SELECT COUNT(*) FROM experiment_responses WHERE repetition IS NULL"
        ).fetchone()[0]
        if nulls:
            failures.append(f"{nulls} rows with NULL repetition")
        after = {t: _count(conn, t) for t in before}
        for table, n in before.items():
            if after[table] != n:
                failures.append(f"{table} count changed {n} -> {after[table]}")
        textless = conn.execute(
            "SELECT COUNT(*) FROM experiment_prompts "
            "WHERE probe_id IS NOT NULL AND custom_prompt_text IS NULL"
        ).fetchone()[0]
        if textless:
            failures.append(f"{textless} prompts with a probe id and no text")
    finally:
        conn.close()

    bak = Path(f"{path}.bak-0.8")
    if not bak.exists():
        failures.append(f"backup {bak.name} missing")
    else:
        b = sqlite3.connect(f"file:{bak.as_posix()}?mode=ro", uri=True)
        try:
            if b.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                failures.append(f"backup {bak.name} fails integrity_check")
            bak_rows = _count(b, "experiment_responses")
        finally:
            b.close()
        if not already and bak_rows != before["experiment_responses"]:
            failures.append(
                f"backup {bak.name} is short: {bak_rows} of {before['experiment_responses']} rows"
            )
    if seconds > max_seconds:
        failures.append(f"migration took {seconds:.2f} s, over {max_seconds:g} s")

    summary = (
        f"rows={after['experiment_responses']} metrics={after['response_metrics']} "
        f"rating_items={after['ai_rating_items']} eval_ratings={after['eval_ratings']} "
        f"{'already migrated' if already else 'migrated'} in {seconds:.2f} s "
        f"(limit {max_seconds:g} s)"
    )
    return failures, summary


def check_classified(path: Path) -> tuple[list[str], str]:
    """Completed rows without a classification, other than rows whose prompt has no text."""
    conn = sqlite3.connect(str(path))
    try:
        missing, skipped = conn.execute(
            """SELECT
                   SUM(COALESCE(ep.custom_prompt_text, p.prompt_text, '') != ''),
                   SUM(COALESCE(ep.custom_prompt_text, p.prompt_text, '') = '')
               FROM experiment_responses er
               JOIN experiment_prompts ep ON ep.id = er.prompt_id
               LEFT JOIN probes p ON p.id = ep.probe_id
               WHERE er.status = 'completed' AND er.classification IS NULL"""
        ).fetchone()
    finally:
        conn.close()
    missing, skipped = missing or 0, skipped or 0
    failures = [f"{missing} completed rows lack a classification"] if missing else []
    return failures, f"unclassified={missing} skipped_without_text={skipped}"


def input_problem(path: Path) -> str | None:
    """Why `path` cannot be checked, or None (R2-M3: never pass on no data)."""
    if not path.is_file():
        return f"no database at {path}"
    conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        n = _count(conn, "experiment_responses")
    except sqlite3.DatabaseError as e:
        return f"cannot read {path}: {e}"
    finally:
        conn.close()
    if not n:
        return f"{path} has no experiment_responses rows"
    return None


def build_08_database(path: Path) -> sqlite3.Connection:
    """A small 0.8 database: two studies' worth of rows plus children of every kind.

    Returns a second open WAL connection (autocheckpoint off) that wrote the
    last response; its rows live only in the WAL until it is closed.
    """
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(flinch_db.SCHEMA)
    conn.execute("PRAGMA foreign_keys=OFF")
    conn.execute("DROP TABLE experiment_responses")
    conn.execute(DDL_08)
    conn.executescript(
        """
        INSERT INTO probes (id, name, domain, prompt_text) VALUES (1, 'p1', 'd', 'Probe one text');
        INSERT INTO experiments (id, name, model_ids) VALUES (1, 'study', '["m1"]');
        INSERT INTO experiment_conditions (id, experiment_id, label, system_prompt)
            VALUES (1, 1, 'a', ''), (2, 1, 'b', 'Be brief.');
        INSERT INTO experiment_prompts (id, experiment_id, probe_id, custom_prompt_text)
            VALUES (1, 1, 1, NULL), (2, 1, NULL, 'Custom text');
        INSERT INTO experiment_responses (id, experiment_id, condition_id, prompt_id, model_id,
                                          response_text, status, classification)
            VALUES (5, 1, 1, 1, 'm1', 'r5', 'completed', 'complied'),
                   (6, 1, 2, 1, 'm1', 'r6', 'completed', 'refused'),
                   (7, 1, 1, 2, 'm1', 'r7', 'completed', NULL);
        UPDATE sqlite_sequence SET seq = 40 WHERE name = 'experiment_responses';
        INSERT INTO response_metrics (response_id, word_count) VALUES (5, 1), (6, 1);
        INSERT INTO ai_ratings (id, experiment_id, rater_model, prompt_id, target_model_id,
                                blinding_order) VALUES (1, 1, 'rater', 1, 'm1', '{}');
        INSERT INTO ai_rating_items (rating_id, response_id, position_label, rank)
            VALUES (1, 5, 'A', 1), (1, 6, 'B', 2);
        INSERT INTO eval_tasks (id, experiment_id, batch_id, prompt_id, target_model_id,
                                blinding_order, tracking_id) VALUES (1, 1, 'b', 1, 'm1', '{}', 't1');
        INSERT INTO eval_ratings (eval_task_id, rater_id, response_id, position_label, rank)
            VALUES (1, 'r', 5, 'A', 1);
        """
    )
    conn.commit()
    conn.close()
    wal = sqlite3.connect(str(path))
    wal.execute("PRAGMA wal_autocheckpoint=0")
    wal.execute(
        "INSERT INTO experiment_responses (id, experiment_id, condition_id, prompt_id, model_id, "
        "response_text, status) VALUES (8, 1, 2, 2, 'm1', 'r8', 'completed')"
    )
    wal.commit()
    return wal


def self_test(max_seconds: float) -> tuple[list[str], str]:
    failures: list[str] = []
    with tempfile.TemporaryDirectory(prefix="flinch-check-migration-") as tmp:
        root = Path(tmp)
        if input_problem(root / "missing.db") is None:
            failures.append("a missing input was accepted")
        empty = root / "empty.db"
        conn = sqlite3.connect(str(empty))
        conn.executescript(flinch_db.SCHEMA)
        conn.close()
        if input_problem(empty) is None:
            failures.append("an input with no responses was accepted")

        path = root / "flinch.db"
        wal = build_08_database(path)
        try:
            found, summary = check_migration(path, max_seconds)
        finally:
            wal.close()
        failures.extend(found)
        conn = sqlite3.connect(str(path))
        try:
            ids = [r[0] for r in conn.execute("SELECT id FROM experiment_responses ORDER BY id")]
            if ids != [5, 6, 7, 8]:
                failures.append(f"response ids not kept: {ids}")
            seq = conn.execute(
                "SELECT seq FROM sqlite_sequence WHERE name = 'experiment_responses'"
            ).fetchone()
            if not seq or seq[0] != 40:
                failures.append(f"sqlite_sequence not carried: {seq}")
        finally:
            conn.close()
        b = sqlite3.connect(f"{path}.bak-0.8")
        try:
            if _count(b, "experiment_responses") != 4:
                failures.append("WAL-resident row missing from the backup")
        finally:
            b.close()
    return failures, "self-test " + summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("db", nargs="?", type=Path, help="a COPY of a 0.8 flinch.db")
    parser.add_argument("--max-seconds", type=float, default=20.0)
    parser.add_argument("--assert-classified", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)

    if args.self_test:
        failures, summary = self_test(args.max_seconds)
    else:
        if args.db is None:
            parser.error("a database path is required (or --self-test)")
        problem = input_problem(args.db)
        if problem:
            print(f"check-migration: FAIL {problem}")
            return 2
        if args.assert_classified:
            failures, summary = check_classified(args.db)
        else:
            failures, summary = check_migration(args.db, args.max_seconds)

    if failures:
        print(f"check-migration: FAIL {summary}; " + "; ".join(failures))
        return 1
    print(f"check-migration: OK {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
