"""
Bundle build-time resources for the Flinch Windows installer.

Produces two files under `src-tauri/resources/`:
  1. `cpython-3.11.9+20240415-x86_64-pc-windows-msvc-install_only.tar.gz`
     — a pinned python-build-standalone (PBS) tarball that the Tauri
       bootstrap extracts on first launch.
  2. `flinch-<version>-py3-none-any.whl`
     — the Flinch package itself, built with `pip wheel`, so the
       bootstrap can pip-install offline from a local file.

On success, also rewrites the `EXPECTED_PBS_SHA256` constant inside
`src-tauri/src/bootstrap/pbs.rs` to match the verified tarball hash —
this keeps the Rust-side verification in lock-step with the bundled
asset.

Re-running the script is idempotent: the PBS tarball is only downloaded
if it is missing or has a different hash. The wheel is always rebuilt.

Usage:
    python scripts/bundle-resources.py
"""
from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
RESOURCES_DIR = ROOT / "src-tauri" / "resources"
PBS_RS_PATH = ROOT / "src-tauri" / "src" / "bootstrap" / "pbs.rs"

PBS_TAG = "20240415"
PBS_PYTHON_VERSION = "3.11.9"
PBS_TRIPLE = "x86_64-pc-windows-msvc"
PBS_VARIANT = "install_only"

PBS_FILENAME = (
    f"cpython-{PBS_PYTHON_VERSION}+{PBS_TAG}-{PBS_TRIPLE}-{PBS_VARIANT}.tar.gz"
)
PBS_URL = (
    f"https://github.com/astral-sh/python-build-standalone/releases/download/"
    f"{PBS_TAG}/{PBS_FILENAME}"
)
PBS_SHA_URL = f"{PBS_URL}.sha256"


def log(msg: str) -> None:
    print(f"[bundle-resources] {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"[bundle-resources] ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def fetch_expected_sha() -> str:
    log(f"fetching expected SHA256 from {PBS_SHA_URL}")
    try:
        with urllib.request.urlopen(PBS_SHA_URL, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="strict").strip()
    except Exception as exc:
        fail(f"failed to fetch .sha256 metadata: {exc}")
    sha = body.split()[0]
    if len(sha) != 64 or not re.fullmatch(r"[0-9a-fA-F]{64}", sha):
        fail(f"fetched SHA256 is malformed: {body!r}")
    return sha.lower()


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download_pbs(target: Path, expected_sha: str) -> None:
    if target.exists():
        actual = sha256_of(target)
        if actual == expected_sha:
            log(f"PBS tarball already present with correct SHA — skipping download")
            return
        log(f"existing tarball SHA mismatch (got {actual[:12]}…, want {expected_sha[:12]}…) — redownloading")
        target.unlink()

    log(f"downloading {PBS_URL}")
    tmp = target.with_suffix(target.suffix + ".part")
    try:
        with urllib.request.urlopen(PBS_URL, timeout=600) as resp:
            total = resp.headers.get("Content-Length")
            total_i = int(total) if total else None
            downloaded = 0
            last_pct = -1
            with tmp.open("wb") as out:
                while True:
                    chunk = resp.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
                    downloaded += len(chunk)
                    if total_i:
                        pct = (downloaded * 100) // total_i
                        if pct != last_pct and pct % 10 == 0:
                            log(f"  {pct}% ({downloaded // (1024 * 1024)} / {total_i // (1024 * 1024)} MB)")
                            last_pct = pct
    except Exception as exc:
        if tmp.exists():
            tmp.unlink()
        fail(f"download failed: {exc}")

    actual = sha256_of(tmp)
    if actual != expected_sha:
        tmp.unlink()
        fail(f"SHA256 mismatch after download: got {actual}, expected {expected_sha}")
    tmp.rename(target)
    log(f"tarball saved to {target} (SHA verified)")


def build_flinch_wheel() -> Path:
    for existing in RESOURCES_DIR.glob("flinch-*.whl"):
        log(f"removing stale wheel {existing.name}")
        existing.unlink()

    log("building Flinch wheel (pip wheel . --no-deps -w src-tauri/resources/)")
    try:
        subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "wheel",
                ".",
                "--no-deps",
                "-w",
                str(RESOURCES_DIR),
            ],
            cwd=ROOT,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        fail(f"pip wheel failed with exit code {exc.returncode}")
    except FileNotFoundError:
        fail("pip is not available in the current Python environment")

    wheels = sorted(RESOURCES_DIR.glob("flinch-*.whl"))
    if not wheels:
        fail("pip wheel succeeded but no flinch-*.whl was produced")
    log(f"wheel built: {wheels[-1].name}")
    return wheels[-1]


_SHA_CONST_PATTERN = re.compile(
    r'(const\s+EXPECTED_PBS_SHA256\s*:\s*&str\s*=\s*")([^"]*)(")'
)


def update_pbs_rs_constant(expected_sha: str) -> Optional[bool]:
    if not PBS_RS_PATH.exists():
        log(f"pbs.rs not found at {PBS_RS_PATH} — skipping constant update")
        return None
    src = PBS_RS_PATH.read_text(encoding="utf-8")
    match = _SHA_CONST_PATTERN.search(src)
    if not match:
        log("EXPECTED_PBS_SHA256 constant not found in pbs.rs — skipping update")
        return None
    if match.group(2) == expected_sha:
        log("pbs.rs EXPECTED_PBS_SHA256 already matches — no edit needed")
        return False
    new_src = (
        src[: match.start()]
        + match.group(1)
        + expected_sha
        + match.group(3)
        + src[match.end():]
    )
    PBS_RS_PATH.write_text(new_src, encoding="utf-8")
    log(f"updated EXPECTED_PBS_SHA256 in pbs.rs to {expected_sha[:12]}…")
    return True


def main() -> None:
    RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
    expected_sha = fetch_expected_sha()
    log(f"expected SHA256: {expected_sha}")

    tarball_path = RESOURCES_DIR / PBS_FILENAME
    download_pbs(tarball_path, expected_sha)

    wheel_path = build_flinch_wheel()
    update_pbs_rs_constant(expected_sha)

    log("--- done ---")
    log(f"  PBS tarball : {tarball_path}")
    log(f"  Flinch wheel: {wheel_path}")
    log(f"  SHA256      : {expected_sha}")
    log("next: run `cargo tauri build` in src-tauri/ to produce the installer")


if __name__ == "__main__":
    main()
