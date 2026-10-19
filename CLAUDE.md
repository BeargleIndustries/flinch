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
- SvelteKit 2 + Svelte 5 + TypeScript + Tailwind 3 (frontend in `ui/`, static adapter, built with Vite; Vitest and Playwright tests)

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

### Sidecar (Python, API-only)
- `flinch/app.py`: FastAPI server and every API endpoint (entry point). API-only: `GET /` answers JSON (`name`, `version`, `docs`), the reference is at `/docs`, and there is no static mount. `main()` supports `--port`, `--db-path` and `--no-stdin-keys`; without that flag it reads `{"keys":{...}}` JSON from stdin when piped (Tauri sidecar mode). Prints the `READY {port}` sentinel after bind. Reads `.env` from the project root or `FLINCH_ENV_FILE`; `FLINCH_VARIANTS_DIR` moves `flinch/variants/`.
- `flinch/runner.py`: core test loop (probe, classify, coach, pushback)
- `flinch/coach.py`: pushback suggestion agent (7 moves)
- `flinch/classifier.py`: response classification (keyword plus LLM)
- `flinch/target.py`: TargetModel ABC plus ClaudeTarget, OpenAITarget, GeminiTarget
- `flinch/models.py`: Pydantic models and enums
- `flinch/db.py`: SQLite schema, CRUD, migrations and YAML/Markdown probe import. Honors the `FLINCH_DB_PATH` env var.
- `flinch/hh_import.py`: HH-RLHF importer; `FLINCH_HF_API_BASE` points it at a stub.
- `flinch/seed.py`: default coach profile and seed examples
- `flinch/playbook.md`: methodology primer
- `flinch/probes/`: Markdown probe sets
- `data/flinch.db`: SQLite database in dev mode. In packaged desktop mode: `%APPDATA%/com.beargle.flinch/flinch.db`.

### App (`ui/`, SvelteKit, static adapter)
- `ui/src/routes/`: screens. `probe/` (the probe loop), `studies/` (framings, conditions, repeat, sequences, compare, baselines), `data/` (browse, scorecard, publish, coach), `guide/`, `welcome/` (first run, including the desktop Python setup step that listens for `bootstrap:progress`).
- `ui/src/lib/api/`: the API client, stream reader, `types.ts` (mirrors `tests/shapes.py`) and `endpoints.paths.json` (the routes the app calls; `npm --prefix ui run endpoints:snapshot` rewrites it).
- `ui/src/lib/components/`: shared components plus per-area folders (`probe/`, `rail/`, `studies/`, `data/`, `settings/`, `shell/`, `dialogs/`, `welcome/`).
- `ui/src/lib/copy/`: every user-facing string (copy modules); `copy-lint.test.ts` and `forbidden.test.ts` enforce the copy rules (no em dash, `MIN_LINT_FILES = 80`).
- `ui/src/lib/stores/`, `popup/`, `tutorial/`, `tour/`, `tips/`, `guide/`: state, popups, the tour and tips, the Guide content.
- `ui/tests/e2e/`: Playwright specs against a fake-model sidecar (`global-setup.ts`, `fixtures/`; `zz-browse-clear-all.spec.ts` runs last). `ui/playwright.config.ts` serves `ui/build`, so build before `test:e2e`.

### Desktop Release (Tauri)
- `src-tauri/`: Tauri 2 shell for the Windows NSIS installer (mirrors Pry's distribution pattern). `frontendDist` is `../ui/build`; `cargo tauri dev` runs `vite dev` on 5173.
  - `src-tauri/Cargo.toml`, `tauri.conf.json`, `build.rs`
  - `src-tauri/src/main.rs`, `lib.rs`: app entry and command wiring
  - `src-tauri/src/bootstrap/`: first-launch Python runtime setup: extracts the bundled python-build-standalone tarball, creates a venv, pip-installs the Flinch wheel with its extras. Adapted from Pry; needs the internet on first run.
  - `src-tauri/src/sidecar.rs`: spawns and monitors the Python FastAPI server as a child process. Passes API keys via stdin pipe (never env vars).
  - `src-tauri/src/api_keys.rs`: Windows Credential Manager wrapper. Public API is boolean-only; raw keys only leave via internal `load_all_for_sidecar()`.
  - `src-tauri/src/crash.rs`: crash log capture with key/path sanitization. Logs to `%LOCALAPPDATA%/Flinch/logs/`.
  - `src-tauri/icons/`: F. monogram brand mark (black plus red accent dot).
  - `src-tauri/resources/`: bundled build-time resources (PBS tarball and Flinch wheel). Populated by `scripts/bundle-resources.py`. Gitignored.

### Scripts
- `scripts/dev.ps1`, `scripts/dev.sh`: browser dev mode (sidecar on 8000 with `--no-stdin-keys`, `vite dev` on 5173; Ctrl+C stops both).
- `scripts/new-worktree.ps1`: creates (`-Task <id>`) or provisions (`-Provision`) a git worktree: resources, `npm ci`, its own `ui/.e2e-ports.json`, shared Cargo target.
- `scripts/check-migration.py`: run with `python -I` on a copy of a 0.8 database; checks the 0.9 migration, or with `--assert-classified` that completed rows are classified.
- `scripts/bundle-resources.py`: downloads the pinned python-build-standalone tarball and builds the Flinch wheel into `src-tauri/resources/`. Idempotent. Auto-updates `EXPECTED_PBS_SHA256` in `bootstrap/pbs.rs` after SHA verification.
- `scripts/build-installer.ps1`: builds `ui`, then the NSIS installer.
- `scripts/verify-phase1.py`: regression guard for the Python sidecar contract (READY sentinel, /health, /api/settings/keys shape, capabilities, JSON at `/`, --db-path, stdin key handoff).

### Tests (`tests/`, pytest)
- `tests/conftest.py`: fixtures (`app_client`, `fake_target`, `keyword_classifier`, `live_server` on a real uvicorn).
- `tests/fake_models.py`: fake Anthropic and OpenAI model server (stdlib, FastAPI, uvicorn; imports nothing from `flinch`) that the e2e sidecar and live tests talk to; `tests/fakes.py`: in-process test doubles (FakeTarget and friends).
- `tests/shapes.py`: the response shapes the app relies on (mirrored by `ui/src/lib/api/types.ts`).
- `tests/test_api_contract.py`: the routes in `endpoints.paths.json` exist, shapes, `/` is JSON, no static mount.

## Running
Two dev modes, after `pip install -e ".[dev]"`, `npm --prefix ui ci` and keys in `.env`:
```
# Browser dev mode: sidecar on 8000, vite on 5173
pwsh scripts/dev.ps1        # or: scripts/dev.sh
# then open http://127.0.0.1:5173

# Desktop dev mode (after python scripts/bundle-resources.py once)
cargo tauri dev
```
Sidecar alone: `python -m flinch.app --port 8000 --no-stdin-keys` (API only; docs at http://127.0.0.1:8000/docs).

## When Working on This Project
- This is a research instrument, NOT a jailbreak tool — framing matters
- Coach suggests pushback, human decides — never fully automated
- Overrides become training data via "promote to example" — each one improves the coach
- Keep probe content out of public repos — publish tool + methodology only
- ClaudeTarget instantiated per-session (fresh conversation context)
