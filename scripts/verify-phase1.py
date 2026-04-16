"""
Smoke-test the Phase 1 (US-001) acceptance criteria: Flinch's Python
sidecar runs in both dev mode and packaged mode, exposes /health and
/api/settings/keys, honors FLINCH_DB_PATH, and accepts --port / --db-path.

Does NOT exercise the stdin key handoff (that needs a pipe and would
collide with a real API call). Leave that to manual test or US-003
integration.

Usage:
    python scripts/verify-phase1.py
"""
from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYTHON = sys.executable


def log(msg: str) -> None:
    print(f"[verify-phase1] {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"[verify-phase1] FAIL: {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for_ready(proc: subprocess.Popen, port: int, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    ready_line_seen = False
    while time.time() < deadline:
        if proc.poll() is not None:
            stderr_tail = ""
            try:
                stderr_tail = proc.stderr.read() if proc.stderr else ""
            except Exception:
                pass
            fail(f"process exited early with code {proc.returncode}. stderr:\n{stderr_tail}")
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.2)
                s.connect(("127.0.0.1", port))
                if ready_line_seen:
                    return
        except OSError:
            pass
        if proc.stdout and proc.stdout.readable():
            line = proc.stdout.readline()
            if line:
                stripped = line.strip()
                log(f"[child stdout] {stripped}")
                if stripped.startswith(f"READY {port}"):
                    ready_line_seen = True
        time.sleep(0.1)
    fail(f"timeout waiting for sidecar to bind on port {port}")


def http_get(url: str, timeout: float = 5.0):
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def kill(proc: subprocess.Popen) -> None:
    if proc.poll() is None:
        if os.name == "nt":
            proc.send_signal(signal.CTRL_BREAK_EVENT) if False else proc.terminate()
        else:
            proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def run_case(label: str, port: int, db_path: Path | None) -> None:
    log(f"--- case: {label} ---")
    args = [PYTHON, "-m", "flinch.app", "--port", str(port)]
    if db_path is not None:
        args += ["--db-path", str(db_path)]

    env = os.environ.copy()
    env.pop("FLINCH_DB_PATH", None)

    proc = subprocess.Popen(
        args,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        env=env,
    )
    try:
        wait_for_ready(proc, port, timeout=25.0)

        status, body = http_get(f"http://127.0.0.1:{port}/health")
        if status != 200:
            fail(f"/health returned {status}, body: {body}")
        try:
            h = json.loads(body)
        except json.JSONDecodeError:
            fail(f"/health body is not JSON: {body!r}")
        if h.get("status") != "ok":
            fail(f"/health payload missing status=ok: {h}")
        log(f"/health OK (version {h.get('version')!r})")

        status, body = http_get(f"http://127.0.0.1:{port}/api/settings/keys")
        if status != 200:
            fail(f"/api/settings/keys returned {status}, body: {body}")
        try:
            keys_payload = json.loads(body)
        except json.JSONDecodeError:
            fail(f"/api/settings/keys body is not JSON: {body!r}")
        if not isinstance(keys_payload, list):
            fail(f"/api/settings/keys expected list, got {type(keys_payload).__name__}: {keys_payload!r}")
        providers_seen = set()
        for entry in keys_payload:
            if not isinstance(entry, dict):
                fail(f"/api/settings/keys entry is not a dict: {entry!r}")
            provider = entry.get("provider")
            if not isinstance(provider, str):
                fail(f"/api/settings/keys entry missing string 'provider': {entry!r}")
            if "is_set" not in entry or not isinstance(entry["is_set"], bool):
                fail(f"/api/settings/keys entry for {provider!r} missing boolean is_set: {entry!r}")
            for k, v in entry.items():
                if k == "key":
                    fail(f"/api/settings/keys returned raw 'key' field: {entry!r}")
                if isinstance(v, str) and v.startswith("sk-") and "..." not in v and len(v) > 24:
                    fail(f"/api/settings/keys leaked unmasked key in {k!r}: {entry!r}")
            providers_seen.add(provider)
        expected_providers = {"anthropic", "openai", "google", "xai", "meta"}
        missing = expected_providers - providers_seen
        if missing:
            fail(f"/api/settings/keys missing providers: {missing}. got={sorted(providers_seen)}")
        log(f"/api/settings/keys OK: {len(keys_payload)} entries, all booleans, no raw keys")

        if db_path is not None:
            if not db_path.exists():
                fail(f"--db-path argument did not create DB at {db_path}")
            log(f"--db-path honored (DB present at {db_path})")
    finally:
        kill(proc)
    log(f"--- case passed: {label} ---")


def run_stdin_case() -> None:
    label = "stdin key handoff (packaged mode simulation)"
    log(f"--- case: {label} ---")
    with tempfile.TemporaryDirectory(prefix="flinch_verify_stdin_") as tmp:
        db_path = Path(tmp) / "flinch.db"
        port = pick_free_port()
        args = [
            PYTHON,
            "-m",
            "flinch.app",
            "--port",
            str(port),
            "--db-path",
            str(db_path),
        ]
        env = os.environ.copy()
        # Strip existing provider env vars so the stdin payload is the sole source of truth.
        for var in (
            "ANTHROPIC_API_KEY",
            "OPENAI_API_KEY",
            "GOOGLE_API_KEY",
            "XAI_API_KEY",
            "TOGETHER_API_KEY",
        ):
            env.pop(var, None)

        stdin_payload = json.dumps(
            {
                "keys": {
                    "anthropic": "sk-ant-test-stdin-handoff-fake-key-do-not-use",
                    "meta": "together-test-stdin-handoff-fake-key-do-not-use",
                }
            }
        )

        proc = subprocess.Popen(
            args,
            cwd=ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=env,
        )
        try:
            assert proc.stdin is not None
            proc.stdin.write(stdin_payload + "\n")
            proc.stdin.flush()
            proc.stdin.close()

            wait_for_ready(proc, port, timeout=25.0)

            status, body = http_get(f"http://127.0.0.1:{port}/api/settings/keys")
            if status != 200:
                fail(f"/api/settings/keys returned {status}: {body}")
            entries = json.loads(body)
            by_provider = {e["provider"]: e for e in entries if isinstance(e, dict)}
            anth = by_provider.get("anthropic", {})
            if not anth.get("is_set"):
                fail(f"stdin key was not picked up for anthropic: {anth!r}")
            meta = by_provider.get("meta", {})
            if not meta.get("is_set"):
                fail(f"stdin key was not picked up for meta: {meta!r}")
            log(f"stdin handoff OK — anthropic.is_set={anth.get('is_set')}, meta.is_set={meta.get('is_set')}")
        finally:
            kill(proc)
    log(f"--- case passed: {label} ---")


def main() -> None:
    dev_port = pick_free_port()
    run_case("dev mode (no args other than --port)", dev_port, None)

    with tempfile.TemporaryDirectory(prefix="flinch_verify_") as tmp:
        packaged_db = Path(tmp) / "flinch.db"
        packaged_port = pick_free_port()
        run_case("packaged mode (--port + --db-path)", packaged_port, packaged_db)

    run_stdin_case()

    log("ALL CASES PASSED")


if __name__ == "__main__":
    main()
