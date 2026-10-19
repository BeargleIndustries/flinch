# Contributing to Flinch

Flinch is in early preview. Contributions are welcome: bug fixes, new features, documentation improvements, and probe format ideas.

## Setup

You need Python 3.11+ and Node.js 20+ (the end-to-end tests use Node 24). The desktop shell also needs Rust and the Tauri CLI.

```bash
git clone https://github.com/BeargleIndustries/flinch.git
cd flinch
pip install -e ".[dev]"
npm --prefix ui ci
cp .env.example .env   # then add at least one provider key
```

## Layout

- `flinch/`: the Python sidecar (FastAPI). It is API-only: `GET /` answers JSON and the API reference is at `/docs`.
- `ui/`: the SvelteKit app (`src/routes/` for the Probe, Studies, Data, Guide and welcome screens; `src/lib/` for components, the API client, stores and the copy modules in `src/lib/copy/`; `tests/e2e/` for the Playwright specs).
- `src-tauri/`: the Windows desktop shell.
- `tests/`: pytest, with a fake model server in `tests/fake_models.py`, test doubles in `tests/fakes.py` and the API shapes the UI relies on in `tests/shapes.py`.
- `scripts/`: dev, build and check scripts.

## Running in development

- **Browser dev mode**: `pwsh scripts/dev.ps1` (Windows) or `scripts/dev.sh` starts the sidecar on 8000 with `--no-stdin-keys` and `vite dev` on 5173. Open http://127.0.0.1:5173.
- **Desktop dev mode**: `cargo tauri dev` from the repository root, after `python scripts/bundle-resources.py` has filled `src-tauri/resources/` once.

The sidecar reads keys from `.env` in the project root, or from the file `FLINCH_ENV_FILE` names. `FLINCH_VARIANTS_DIR` moves the variant group folder and `FLINCH_HF_API_BASE` points the HH-RLHF importer at another server; the end-to-end tests use both. Without `--no-stdin-keys`, a sidecar whose stdin is not a terminal waits for one line of keys on stdin, the way the desktop shell hands them over; pass the flag whenever you start it from a script.

## Checks

Run these before a pull request (PowerShell or bash, from the repository root):

- **Python lint**: `ruff check flinch tests scripts`
- **Python tests**: `python -m pytest -q`
- **UI types**: `npm --prefix ui run check`
- **UI unit tests**: `npm --prefix ui test` (Vitest, including the copy lint)
- **UI format**: `npm --prefix ui run lint` (Prettier; `npm --prefix ui run format` fixes it)
- **End-to-end**: `npm --prefix ui run build` then `npm --prefix ui run test:e2e`. The specs serve the built app against a sidecar with fake models, so build first after any UI change.
- **Sidecar contract**: `python scripts/verify-phase1.py`
- **Desktop shell**: `cargo check --manifest-path src-tauri/Cargo.toml`

To work on several branches at once, `scripts/new-worktree.ps1` makes a git worktree with its own e2e ports. `python -I scripts/check-migration.py <copy of a database>` checks that an older database migrates cleanly.

## UI copy

Every user-facing string in `ui/` lives in a copy module under `ui/src/lib/copy/` (or the other files `COPY_FILES` lists). The copy lint rejects em dashes and a few banned names and spellings, so use plain punctuation.

## Probe Guidelines

Flinch probes are research instruments for studying AI content restriction consistency. When creating probes:

- Probes should test genuine content policy boundaries, not attempt to extract harmful instructions
- No real personal information or identifying details
- No child exploitation content under any circumstances
- No actual instructions for weapons, drugs, or attacks; the goal is to test *fictional/creative writing* restrictions
- Frame probes as fiction, journalism, academic, or clinical scenarios

## Pull Requests

- Describe what you're testing and why
- Keep changes focused: one feature or fix per PR
- Include probe domain and tags if adding new probe formats
- Run the checks above before submitting

## Issues

Bug reports, feature requests, and research methodology discussions are all welcome. Please include:
- What you expected vs. what happened
- Which target model(s) you were testing
- Flinch version (Settings, then Developer, shows the app and sidecar versions; from source, `pip show flinch`)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
