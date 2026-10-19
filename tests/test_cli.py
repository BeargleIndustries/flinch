"""`python -m flinch.app` starts as a sidecar with and without `--no-stdin-keys` (B38, I28)."""

from __future__ import annotations

import queue
import socket
import subprocess
import sys
import threading
import time
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
READY_TIMEOUT_S = 20.0


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_for_ready(proc: subprocess.Popen, port: int) -> None:
    lines: queue.Queue[str] = queue.Queue()

    def pump() -> None:
        for line in proc.stdout:
            lines.put(line)

    threading.Thread(target=pump, daemon=True).start()
    deadline = time.monotonic() + READY_TIMEOUT_S
    seen: list[str] = []
    while time.monotonic() < deadline:
        try:
            line = lines.get(timeout=0.2)
        except queue.Empty:
            if proc.poll() is not None:
                break
            continue
        seen.append(line)
        if line.strip() == f"READY {port}":
            return
    pytest.fail(f"no READY {port} within {READY_TIMEOUT_S} s; output: {''.join(seen)[-2000:]}")


@pytest.fixture
def spawn(env: Path) -> Iterator:
    procs: list[subprocess.Popen] = []

    def start(*flags: str) -> tuple[subprocess.Popen, int, Path]:
        port = _free_port()
        db_path = env / f"cli-{port}.db"
        proc = subprocess.Popen(
            [sys.executable, "-m", "flinch.app", *flags, "--port", str(port), "--db-path", str(db_path)],
            cwd=ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        procs.append(proc)
        return proc, port, db_path

    yield start
    for proc in procs:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)
        for stream in (proc.stdin, proc.stdout):
            if stream and not stream.closed:
                stream.close()


def test_no_stdin_keys_with_open_stdin(spawn) -> None:
    """With the flag, an open stdin pipe never blocks startup."""
    proc, port, db_path = spawn("--no-stdin-keys")
    _wait_for_ready(proc, port)

    resp = httpx.get(f"http://127.0.0.1:{port}/health", timeout=10)
    assert resp.status_code == 200
    assert resp.json()["db_path"] == str(db_path.resolve())


def test_piped_keys_still_read(spawn) -> None:
    """Without the flag, the Tauri handoff (one JSON line, then EOF) still works."""
    proc, port, _ = spawn()
    proc.stdin.write('{"keys": {}}\n')
    proc.stdin.close()
    _wait_for_ready(proc, port)

    resp = httpx.get(f"http://127.0.0.1:{port}/health", timeout=10)
    assert resp.status_code == 200
