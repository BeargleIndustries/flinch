# Flinch

## Project Context
AI content restriction consistency research tool. Human-in-the-loop instrument for testing whether AI models enforce content restrictions consistently, built on empirical research ("Rules Are Rules, Until They Aren't").
Vault overview: `C:\Users\Brad\Documents\Dropbox\Claude\Vault\projects\flinch\flinch.md`

## Tech Stack
- Python 3.11+
- FastAPI + uvicorn (web UI)
- Anthropic SDK (coach agent, classifier LLM judge, target model)
- OpenAI SDK + Google GenAI SDK (optional multi-model targets)
- SQLite (data storage via stdlib sqlite3)
- PyYAML (probe sets)
- Pydantic v2 (data models)
- Vanilla JS ES modules (frontend, no build step)

## Conventions
- Type hints everywhere, `from __future__ import annotations`
- Pydantic models for API request/response in `models.py`
- SQLite is source of truth — all data in `data/flinch.db`
- Markdown for probe definitions in `flinch/probes/`
- Coach logic in `coach.py`, methodology in `playbook.md`
- Classification: hybrid keyword scan + LLM judge (Haiku)
- `ANTHROPIC_API_KEY` required; optional keys for OpenAI, Google, xAI, Together
- Async throughout (FastAPI, Anthropic client, runner)

## Key Paths
- `flinch/app.py` — FastAPI server + API endpoints (entry point). `main()` supports `--port`, `--db-path`, and reads `{"keys":{...}}` JSON from stdin when piped (Tauri sidecar mode). Prints `READY {port}` sentinel after bind.
- `flinch/runner.py` — Core test loop (probe → classify → coach → pushback)
- `flinch/coach.py` — Pushback suggestion agent (7 moves)
- `flinch/classifier.py` — Response classification (keyword + LLM)
- `flinch/target.py` — TargetModel ABC + ClaudeTarget, OpenAITarget, GeminiTarget
- `flinch/models.py` — Pydantic models + enums
- `flinch/db.py` — SQLite schema + CRUD + YAML/Markdown probe import. Honors `FLINCH_DB_PATH` env var.
- `flinch/seed.py` — Default coach profile + seed examples
- `flinch/playbook.md` — Methodology primer
- `flinch/static/` — Web UI (index.html + JS modules including `settings.js` for API key management)
- `flinch/probes/` — Markdown probe sets
- `data/flinch.db` — SQLite database in dev mode. In packaged desktop mode: `%APPDATA%/Flinch/flinch.db`.

### Desktop Release (Tauri)
- `src-tauri/` — Tauri 2 shell for the Windows NSIS installer (mirrors Pry's distribution pattern)
  - `src-tauri/Cargo.toml`, `tauri.conf.json`, `build.rs`
  - `src-tauri/src/main.rs`, `lib.rs` — app entry + command wiring
  - `src-tauri/src/bootstrap/` — first-launch Python runtime setup: extracts bundled python-build-standalone tarball, creates venv, pip-installs Flinch wheel. Adapted from Pry — runs fully offline.
  - `src-tauri/src/sidecar.rs` — spawns/monitors the Python FastAPI server as a child process. Passes API keys via stdin pipe (never env vars).
  - `src-tauri/src/api_keys.rs` — Windows Credential Manager wrapper. Public API is boolean-only; raw keys only leave via internal `load_all_for_sidecar()`.
  - `src-tauri/src/crash.rs` — crash log capture with key/path sanitization. Logs to `%LOCALAPPDATA%/Flinch/logs/`.
  - `src-tauri/icons/` — F. monogram brand mark (black + red accent dot).
  - `src-tauri/resources/` — bundled build-time resources (PBS tarball + Flinch wheel). Populated by `scripts/bundle-resources.py`. Gitignored.
- `ui/index.html` — bootstrap splash page shown during first-launch setup. Listens for `bootstrap:progress` events, navigates to sidecar URL when ready.
- `scripts/bundle-resources.py` — downloads pinned python-build-standalone tarball + builds Flinch wheel into `src-tauri/resources/`. Idempotent. Auto-updates `EXPECTED_PBS_SHA256` in `bootstrap/pbs.rs` after SHA verification.
- `scripts/verify-phase1.py` — regression guard for the Python sidecar contract (READY sentinel, /health, /api/settings/keys shape, --db-path, stdin key handoff).
- `.omc/plans/no-cli-release-v2.md` — full RALPLAN-DR release plan.

## Running
```
pip install -e .
export ANTHROPIC_API_KEY=sk-...
python -m flinch.app
# → http://127.0.0.1:8000
```

## When Working on This Project
- This is a research instrument, NOT a jailbreak tool — framing matters
- Coach suggests pushback, human decides — never fully automated
- Overrides become training data via "promote to example" — each one improves the coach
- Keep probe content out of public repos — publish tool + methodology only
- ClaudeTarget instantiated per-session (fresh conversation context)
