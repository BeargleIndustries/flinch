# Flinch

## Project Context
AI content restriction consistency research tool. Human-in-the-loop instrument for testing whether AI models enforce content restrictions consistently, built on empirical research ("Rules Are Rules, Until They Aren't").
Vault overview: `D:\BeargleVault\projects\flinch\flinch.md`

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
- `flinch/app.py` — FastAPI server + API endpoints (entry point)
- `flinch/runner.py` — Core test loop (probe → classify → coach → pushback)
- `flinch/coach.py` — Pushback suggestion agent (7 moves)
- `flinch/classifier.py` — Response classification (keyword + LLM)
- `flinch/target.py` — TargetModel ABC + ClaudeTarget, OpenAITarget, GeminiTarget
- `flinch/models.py` — Pydantic models + enums
- `flinch/db.py` — SQLite schema + CRUD + YAML/Markdown probe import
- `flinch/seed.py` — Default coach profile + seed examples
- `flinch/playbook.md` — Methodology primer
- `flinch/static/` — Web UI (index.html + 6 JS modules: app.js, api.js, render.js, state.js, components.js, shortcuts.js)
- `flinch/probes/` — Markdown probe sets
- `data/flinch.db` — SQLite database (auto-created)

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
