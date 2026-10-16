# Flinch UI rebuild: work plan

- Date: 2026-10-15
- Status: **REJECTED 2026-10-16** (Round 2 in the input record). Kept as history only.
- Iteration: 4 (final improvements). Revised from the architect and critic reviews of iterations 1–3; every finding is answered in §14.
- Plan branch: `flinch-rebuild-plan`. Build branch after approval: `flinch-rebuild`, cut from `master`. Each lane is a git worktree off it. The main session is the **integrator**: it merges lanes and is the only committer of `flinch/static/` (§7 "Integrator merge step").
- Mode: ralplan consensus, SHORT.
- Inputs: `docs/plans/flinch-rebuild-pre-read-2026-10-15.md` (§1 scope is binding), `docs/plans/flinch-rebuild-input-2026-10-15.md` (Rounds 0 and 1), `docs/plans/handoff-pry-parity-2026-10-15.md` (§2, §4, §5, §8), `docs/plans/pry-design-reference.md`, `docs/plans/evidence/flinch-rebuild-2026-10-15/index.md` (baseline; "problem N" below means its numbered list, 1-19; 17 is reserved for T10), `.../api-routes.md`, `CLAUDE.md`, `pyproject.toml`, `src-tauri/tauri.conf.json`, `ui/splash.js`, `src-tauri/src/sidecar.rs`, `flinch/app.py`, `scripts/bundle-resources.py`, `scripts/verify-phase1.py`, `tests/test_experiment_pipeline.py`.
- Decision record: input file Round 0 (scope) and Round 1: **1.1** SvelteKit 5 (runes) + Tailwind, static build, inside the existing Tauri shell, nothing shared with Pry's code; **1.2** updater ships as a separable final lane; **1.3** schema untouched, existing `flinch.db` opens unchanged, an existing DB is a gate fixture.

## 1. Requirements summary

In Brad's words (pre-read §1): "this is a REBUILD... there is nothing sacred in the UI, just the underlining features"; "there's no rolling in Pry features"; "lessons from Pry have nothing to do with Flinch. stay in scope."; "STOP INVENTING TASKS. stay on spec."

**Delivers**
- A new Flinch UI in SvelteKit 5 + Tailwind (1.1) that replaces all of `flinch/static/` (10,338 lines of vanilla JS/HTML). FastAPI serves it as today:
  - the splash navigates to the sidecar URL (`ui/splash.js:114`)
  - FastAPI serves `/` and `/static` (`flinch/app.py:131`, `:244-246`)
  - the installer ships `flinch/static/**` as loose resources (`tauri.conf.json` `bundle.resources`) and bootstrap pip-installs that directory (`src-tauri/src/bootstrap/pip.rs:31-45`, `:126-160`); `scripts/bundle-resources.py` also builds a wheel
- Every v0.8.0 feature stays reachable. The API and the Python side are the feature set: `api-routes.md` lists 154 routes; the v0.8.0 UI calls 101 unique paths among them. No route, table or column changes (1.3).
- Handoff §2 rules 1, 2, 4, 6, 7, 8, 9, 10 applied to Flinch's existing surfaces. Rules 3 and 5 are out.
- The §4 workflow: gates, an evidence folder, rubric rounds from screenshots, lanes in worktrees.
- The signed updater as the last lane, droppable (1.2).

**Out of scope**: lessons, the lesson runner or sidebar, a shared UI package, a combined shell, a free local model bootstrap, any Pry feature, the research pipeline (pairwise scripts), new features, new UI surfaces for routes no reachable v0.8.0 surface called, and backend or shell work beyond §7's B-list (the random sidecar port stays).

## 2. RALPLAN-DR summary

**Principles**
1. **The API is the feature set.** Every route that a *reachable* v0.8.0 surface called is called by a rebuilt screen. No route, table or column changes (1.3).
2. **Reality wins in every number.** Each number on screen is one the backend already computes, or one of the two payload-count derivations named in (c), and its inputs sit beside it. The UI computes no statistics.
3. **Spec only.** Every task traces to a §2 rule, a §4 workflow step, a §5 standing rule, or a numbered baseline problem. Anything else is rejected at review.
4. **Separable lanes.** A lane edits only files it owns and never commits generated output. The branch is green after every integrator merge. L6 can be reverted without touching anything else.
5. **Copy is code.** Every visible string is extracted and tested, and it goes through brad-voice in main context before release.

**Decision drivers (top 3)**
1. Compatibility (1.3): an existing v0.8.0 DB opens unchanged and every feature can be exercised on it.
2. Distribution path: FastAPI serves the UI from the installed package, offline, with no CDN (problem 10) and a `script-src 'self'` CSP.
3. Verifiability with no API key: the rubric, popup audit and gates run at 1280×800 and 1024×700 from example probes and fixture data only.

**Options**

(a) Where the built bundle lives and how it is served
- **A1, chosen: the build is committed to `flinch/static/`; a Vite dev server runs for development only.**
  - `adapter-static` writes into `flinch/static/`. In dev, Vite listens on `127.0.0.1:5180` (strictPort) and proxies `/api`, `/health` and `/static` to FastAPI on `:8000`.
  - Pros: `pip install -e .` (README:79) still gives a working UI without Node. The installer's `bundle.resources` glob and `bundle-resources.py` need no change. Hatchling excludes only paths matched by `.gitignore`, and no pattern matches `flinch/static`, so the wheel carries it too.
  - Cons: generated files appear in history, and parallel lanes could fight over them. Lanes therefore never commit `flinch/static/`; only the integrator rebuilds and commits it (§7), and `.gitattributes` marks it `merge=ours`. Staleness and nondeterminism are caught by G6.
- A2: the build is gitignored and produced by `bundle-resources.py`, with `[tool.hatch.build] artifacts` added.
  - Pros: no generated files in history, no lane conflicts.
  - Cons: README's `pip install -e .` users get no UI without Node. Packaging and `bundle-resources.py` change. A missing build is silent until runtime.
- A3: Tauri `frontendDist` serves the app.
  - Pros: localStorage would sit on a fixed origin.
  - Cons: `python -m flinch.app` in a browser is a supported mode (CLAUDE.md "Running") and would need the same build served by FastAPI as well, so there would be two hosting paths. `ui/splash.js`'s navigate-to-sidecar design would be reworked, and the UI would need the sidecar's base URL from IPC for every call. That is more shell work than 1.3's "UI-only" allows, and A1 plus a cookie (F0) keeps first-time state across ports with no shell change.
- Consequences of A1:
  - SvelteKit emits root-relative `/_app/...` and FastAPI mounts only `/static`, so `app.py` gets one mount (B4).
  - Assets in SvelteKit's `static/` folder land at `flinch/static/<name>`. Under the existing mount they are served at `/static/<name>`, so `app.html` references `/static/favicon.png` explicitly.

(b) How the old UI is replaced
- **B1, chosen: replace it on the branch, lane by lane.** T1 deletes the vanilla files. The parity reference is a `git worktree` of `7dc2b20` run on another port, plus the 50 baseline screenshots, plus `route-coverage.md` (§11 step 4), which tracks feature loss mechanically rather than by eye.
- B2: a strangler, with the old UI at `/legacy/` until the last lane lands.
  - Cons: a second static mount that no rule justifies; it keeps the CDN dependency alive (problem 10); the old UI's absolute `/static/...` paths need rewriting; and the copy tests would scan two UIs.
  - Its benefit, side-by-side parity, B1's worktree already provides.

(c) Where "every number shows what it is made of" gets its inputs
- **C1, chosen: the UI reads inputs from the existing payloads.** The §4 audit found the counts behind each displayed number in the same response, for example:
  - `consistent_count`/`total_groups` (db.py:1594-1597)
  - `refused`/`total` (db.py:2875-2889)
  - `n1`/`n2` (stats.py:254-255, :450-451)
  - `n_raters`/`n_items` (stats.py:292, :319)
  - `cells`/`prompts`/`conditions`/`models` (app.py:2893-2898)

  The UI derives only two things, both from payload counts: the agreement count from `results[].disagreement` (app.py:1779-1800), and the FDR family size k, which is the number of p-values in the `corrections` object (stats.py:540-589, :731-735). Cost estimates rest on constants in `runner.py` (`:620-632`, `:1175-1226`); caveat K16 states them.
- **Classifier confidence: no per-run number is shown.** `_keyword_classify` computes one (classifier.py:64-89), but which labeller made a stored label (scan, judge, or a hand change through PATCH, app.py:432-439) is not recorded anywhere (`runs`, db.py:44-61). Re-running the scan read-only on stored text would show the scan's view of a label the judge or a person may have set, which is misleading. K1 says how labels are made instead.
- C2: new read-only aggregate endpoints. 1.3 allows read-only routes. They are not needed: every displayed number has its counts in an existing payload, and the cost constants are not data a route could add. C2 would add backend surface no rule requires.

(d) Client routing
- **D1, chosen: the SvelteKit hash router** (`kit.router.type: 'hash'`). FastAPI only has to serve `/`.
- D2: a path router plus a FastAPI catch-all. That is a backend route no rule requires, and it risks shadowing `/api/*` 404s.

(e) Where the update card lives (L6 only)
- **E1, chosen: on the splash** (`ui/index.html`, the Tauri-local origin). That page already has IPC (capability `windows: ["main"]`) and runs on every launch. The update check runs in parallel with the sidecar wait. Navigation pauses on the card only when an update is found, and the check is hard-capped at 3 s. T13 has the details.
- E2: an in-app card on the FastAPI-served page, as Pry does it. It needs IPC from the `127.0.0.1` origin. Whether Tauri 2 gates app commands for that origin is **unverified**: `build.rs` is a bare `tauri_build::build()` with no permissions manifest, so app commands may already be callable from it. T10 tests both directions, so this plan claims no security advantage for E1; E1 wins on needing no new capability.

(f) Rule-6 persistence of first-time state on the desktop
- The sidecar picks a random port on every launch (`sidecar.rs:338-339`), so the app's origin changes each launch. localStorage is per origin, so tip-seen state and the "Settings once" first-launch redirect stored there would reset every launch, breaking rule 6's "first-time" tips.
- **F0, chosen: a cookie.**
  - Cookies are not isolated by port (RFC 6265 §8.5), so a cookie set on `127.0.0.1` survives the port change.
  - `tips/coordinate.ts` stores `flinch_tips=<ids>` and `flinch_first=1` with `Max-Age=31536000; SameSite=Strict; Path=/`. localStorage is the fallback when a cookie can't be written.
  - Checked 2026-10-16 with headless Chromium 1194 and one profile in two separate processes: a cookie set by a page on `127.0.0.1:47801` was read by a page on `127.0.0.1:47802`. WebView2 is Chromium-based; T10's Windows test (5) confirms persistence across launches.
  - No backend or shell change.
- F1, rejected: a stable preferred sidecar port (iteration 2's B7).
  - It cites no baseline problem.
  - With a fixed port and no Host-header check, any web page can reach the sidecar: by DNS rebinding it can read `/api/dashboard/export-all` (probe text) and write `/api/settings/keys`, and it can send cross-site body-less POSTs (e.g. `/api/probes/load-defaults`, app.py:292) in one shot.
  - A Host-check middleware would be backend work no rule requires.
  - Browser mode on `:8000` has that exposure at baseline; this plan neither adds nor fixes it.
- F2: seen-state in the sidecar. 1.3 rules out a table, so this would be a JSON file plus a GET/PUT route. Larger than F0.
- F3, invalidated: accept the reset. Tips and the first-launch redirect would show on every desktop launch.

## 3. Gate set (T0, the plan's first task)

Install: `pip install -e ".[dev,experiment]"`, then `npm --prefix flinch-ui ci`. Requires Node 22 and Python 3.11+. `scripts/dev/gates.json` holds `ruff_version`, `ruff_total`, `pytest_expected` (cumulative node-ID lists keyed by task) and `node_version`.

| # | Gate | Command | Pass condition | Runs |
|---|---|---|---|---|
| G1 | Python tests | `python -m pytest -q` and `python -m pytest --collect-only -q` | 0 failed, 0 errors, and every node ID in `pytest_expected` up to the current task is collected. T0: `test_experiment_pipeline.py::test_experiment_pipeline`, `test_existing_db.py::test_schema_and_counts_unchanged`, `test_existing_db.py::test_v080_get_routes_200`, `test_version.py::test_versions_match`. T1 adds `test_wheel_contents.py::test_wheel_and_resources_cover_static`, `test_static_serving.py::test_built_ui_served`, `test_static_serving.py::test_starts_without_app_dir`. T4 adds `test_load_defaults.py::test_h1_not_imported` | every lane and integrator merge |
| G2 | ruff ratchet | `ruff check flinch --select F821,E9` and `ruff check flinch --statistics`, with the ruff version from `gates.json` | First command: 0 errors (problem 2). Second: total ≤ `ruff_total`, which starts at 539 (541 at baseline minus the 2 F821). The total may only be lowered, by the lane that lowered it. The other 539 are not fixed, because that is backend work outside §7. | every lane |
| G3 | Sidecar contract | `python scripts/verify-phase1.py` | `ALL CASES PASSED` (3/3) | every lane |
| G4 | UI types | `npm --prefix flinch-ui run check` (`svelte-kit sync && svelte-check --fail-on-warnings`) | 0 errors, 0 warnings | from T1 |
| G5 | UI tests | `npm --prefix flinch-ui test` (`svelte-kit sync && vitest run`) | 0 failed, including the copy suite (§7 T3) | from T1 |
| G6 | UI build | **Lane mode** (`run-gates.py`, in this order): `npm --prefix flinch-ui run build` → `pytest tests/test_static_serving.py` → G8 → the lane's `shoot.mjs` shots → `route-coverage.py --lane <L>` → in a `finally`, `git checkout -- flinch/static && git clean -fdq flinch/static`, so G8 and the shots run against the lane's own build. **Integrator mode:** after the rebuild commit, run `npm --prefix flinch-ui run build` again, then `git status --porcelain -- flinch/static` | Lane mode: the build exits 0, the serving test passes, and `git diff --name-only $(git merge-base HEAD flinch-rebuild)..HEAD -- flinch/static` is empty. Integrator mode: porcelain output is empty, so a second build is byte-identical and nothing is untracked. `test_static_serving.py` checks that `/` returns the built `index.html`, that every local URL in it (`/_app/*`, `/static/*`) returns 200, including `/static/favicon.png` (problem 14), that there is no `http(s)://` origin, and that a meta CSP with `script-src 'self'` and hashes is present. `test_starts_without_app_dir` checks that the app imports and `/health` answers with `flinch/static/_app` absent. | lanes from T1; integrator at every merge |
| G7 | Shell | `cargo check --manifest-path src-tauri/Cargo.toml` and `cargo test --manifest-path src-tauri/Cargo.toml` | Exit 0, with the platform recorded. It runs on Windows if the Linux Tauri system libraries are missing, and is never marked passed without a run. | any change under `src-tauri/` (T13, B6), and L7 |
| G8 | Popup audit | `node scripts/dev/popup-audit.mjs --lane <L> --sizes 1280x800,1024x700 --a11y` | `FAIL 0 / SKIP 0`, exit 0; axe-core reports 0 serious and 0 critical violations. Covers the tips in the lane's `tips/<lane>.ts` (all lanes with `--release`), and FAILs if the set covered is empty. | every lane from T3 (run by `run-gates.py`) |
| G9 | Rubric | latest `rubric/round-N.md` in the tracked evidence folder | 0 screen states below the bar at both sizes (§8) | L5 exit and release |
| G10 | Existing DB (1.3) | part of G1, `tests/test_existing_db.py` | Copies `tests/fixtures/flinch-v0.8.0.db` to a temp directory and records every `sqlite_master.sql` plus each table's row count. Starts the current app on the copy (`--db-path`) and calls every `GET` line in `tests/fixtures/v080-ui-routes.txt` except the exempt `GET /api/experiments/{x}/results` (problem 5), with ids from `flinch-v0.8.0.ids.json` and a 10 s timeout each: all return 200. Stops the app, then compares schema SQL and row counts: identical. | every lane |
| G11 | No external origin | inside `shoot.mjs` and `popup-audit.mjs` | Any request to an origin other than `127.0.0.1` fails the run (problem 10) | from T3 |
| G12 | Sensitive-probe guard | inside both drivers | The driver starts only if `[f.name for f in GET /api/probes/files .files]` equals `["example-probes.md"]` and every probe name in the DB is in `example-probes.md`. It compares names only. The raw response holds absolute paths (app.py:305-312) and is never written anywhere. | from T3 |

**Fixture (G10).** `tests/fixtures/make_v080_fixture.py` runs in a worktree of the v0.8.0 code (`git worktree add ../flinch-v080 7dc2b20`) and builds the fixture in three steps:
1. It starts `python -m flinch.app --db-path <out> --port <free>` once until `READY` and then stops it. The v0.8.0 startup creates the schema, runs the migrations and seeds the coach profile and examples, policies and strategies (app.py:80-89), all idempotently, so later starts add no rows.
2. It inserts data with `flinch/db.py` functions where they exist (including `link_probe_claim` db.py:1722 and `save_ai_rating` db.py:3585), otherwise with parameterised INSERTs against the v0.8.0 schema. Contents:
   - the 4 `example-probes.md` probes
   - 2 sessions whose runs cover all four outcomes, a coach suggestion, a manual pushback, a hand-changed label, annotations with tags, and run turns
   - probe-claim links on 2 claims
   - 1 stat run with 10 iterations
   - a framings variant group and a conditions variant group, each with runs
   - a narrative sequence with whittling runs and a sequence batch
   - a saved comparison, a snapshot, a scorecard snapshot, a publication export
   - an experiment with 3 conditions, prompts, responses, response metrics and AI ratings
3. It runs `ExperimentAnalyzer.full_analysis` (seed 42, stats.py:71, :86) and writes `tests/fixtures/flinch-v0.8.0.ids.json` (fixture key → row id), which G10, `TipDef.params` and the shot files use instead of literal ids.

Response texts are synthetic and say so in their first line. The binary is committed (`binary` in `.gitattributes`) and G10 never regenerates it. `tests/fixtures/v080-ui-routes.txt` has one line per `METHOD /path` pair the v0.8.0 UI calls, covering 101 unique paths (the pair count goes in its header), extracted mechanically from `7dc2b20:flinch/static/*.js` with `${...}` normalised to `{x}`. Its header records the command.

**Recording without CI.** `python scripts/dev/run-gates.py --lane <L> [--integrator] [--release]` runs G1–G6 and G8, plus G7 when `src-tauri/` changed since the lane base. It writes `docs/plans/evidence/flinch-rebuild-2026-10-15/gates/<lane>-<shortsha>.md` (each command, exit code, counts, platform, and Python/Node/cargo/ruff versions) and raw logs to `.omc/evidence/flinch-rebuild-2026-10-15/gates/`. A skipped gate is written as `SKIPPED: <reason>`, never as passed. A lane is done when its gate file at the lane head is all green, and a merge is done when the integrator-mode gate file is all green. `--release` also requires G9, all-lane G8, and every `copy/pins/<lane>.ts` marked `status: 'final'`.

## 4. Surface map

One row per row of the baseline surface inventory. Rules: **1** numbers, **2** caveats, **4** terms, **6** guided entry. Routes are hash routes (D1). "Routes" names what each screen must call, and §11 step 4 checks the full set mechanically.

| Baseline surface (renderer) | Decision | Rebuilt screen | Rules | Numbers ← inputs (source); routes |
|---|---|---|---|---|
| Sidebar header, session select, New/Delete (`render.js:24`, `api.js handleSessionChange`) | keep; problem 8 goes away | Shell sidebar | 4, 6 | `/api/sessions*`, `/api/version` |
| Load Defaults / Import File / + add (`api.js loadDefaultProbes`, `showImportFileModal`, `app.js toggleAddProbeForm`) | keep as dialogs; B5 fixes problem 7 | Sidebar probe panel + Import and Add Probe dialogs (narrative fields kept) | 4, 6 | `/api/probes/load-defaults`, `/files`, `/import-file`, `POST /api/probes` |
| PROBES list, bulk select, search, domain filter, custom prompt (`render.js:47`, `:221`) | keep | Sidebar probe panel | 4, 6 | shown of total ← client filter of `GET /api/probes`; `/api/probes/bulk-delete`, `DELETE /api/probes/{id}` |
| Run history + stats (`render.js:931`, `:225`) | merge into the Session screen | `#/session/:id` History panel | 1, 2, 4 | per outcome, count of N runs for initial, final and outcome (outcome = final if a pushback ran, else initial) ← `/api/sessions/{id}/stats` (db.py:1604-1631) |
| Nav pills, EXTRAS (index.html) | keep | Shell nav (`src/lib/nav.ts`) | 6 | none |
| Red no-key banner (`api.js checkOllamaStatus`) | merge into one notice | Shell no-key notice linking to Settings | 2 (K1b), 6 | providers set ← `/api/settings/keys` `is_set`; `/api/ollama/status` |
| Home (`render.js:365`, no session) | keep | `#/` Home | 4, 6 | none |
| Session idle, Run All, Save/Compare Baseline (`render.js:365`) | merge | `#/session/:id` | 4, 6 | runs ← stats payload |
| Probe selected / Send (`render.js:483`) | keep. Send is disabled with the reason when the target's provider has no key (`/api/models` `available`, app.py:1524) | `#/session/:id` | 2, 6 | `POST /api/sessions/{id}/run` |
| Awaiting / Response / Pushback / sent: thread, coach suggestion, manual pushback, annotations, export (`render.js:520`, `:559`, `:860`, `:886`, `:895`, `:699`, `:749`) | keep | `#/session/:id/run/:runId` | 1, 2, 4, 6 | outcome label (classifier.py:47-60). Coach confidence 0–1 ← `coach_suggestion.confidence`, the coach model's self-report (coach.py:74), 0.5 when missing (coach.py:163). Routes: `/api/runs/{id}` GET/DELETE, `/turns`, `/pushback`, `/skip`, `/continue`, `/promote`, `/annotations` GET/PUT, `/api/annotations/tags`, `/api/sessions/{id}/export` (json/csv/md/html/agent/findings/report) |
| Classification dropdown (`components.js showClassificationDropdown`) | keep. No "changed by you" marker: PATCH overwrites the stored label (app.py:432-439) and `override_text` holds pushback text, not a label (runner.py:188-189) | Label control on the run screen | 2 (K18), 4 | `PATCH /api/runs/{id}/classification` |
| Batch progress (`render.js:1015`) | keep | `#/session/:id/batch` (LoadingScreen, cancel) | 1, 6 | completed of total ← SSE `POST /api/sessions/{id}/batch` (app.py:540); `POST /api/batch/{id}/cancel` |
| New Session modal incl. picker and local coach (`app.js showNewSessionModal`) | keep as a dialog that scrolls inside the viewport (problem 9) | New Session dialog | 4, 6 | selected of total probes; `/api/models`, `POST /api/sessions` |
| Import File modal (`api.js showImportFileModal`) | keep | Import dialog | 6 | `/api/probes/files`, `/import-file` |
| API Keys modal (`settings.js`) **and** Settings view (`render.js:4499`) | **merge** (problem 11) | `#/settings` (T10 has the key-save rules) | 2, 4, 6 | `/api/settings/keys` GET, `/set-key` POST/DELETE, `/validate-key`, `/test-key`, `/ollama` GET/POST, `/coach-default` GET/POST |
| Keyboard Shortcuts overlay (`shortcuts.js`) | keep (same keys) | Shortcuts dialog | 6 | none |
| Error toast (`components.js showError`); native `prompt()`/`confirm()` | keep the toast; replace native dialogs with Dialog (problem 12) | Toast, Dialog | 6 | none |
| Multi-Model Comparison picker, results, history (`render.js:1135`, `:1298`, `:1292`) | keep | `#/compare`, `#/compare/:id` | 1, 2, 4, 6 | agreement % = probes where every model's label matches ÷ probes, shown as "k of n probes" (app.py:1779-1800). Session-vs-session: ÷ probes present in all sessions (app.py:1677-1685). Routes: `/api/compare`, `/api/compare/run`, `/api/comparisons*`, `/api/export/compare` |
| Legacy Compare Sessions modal (`render.js:1450`) | **drop** (dead, problem 13) | none | none | none |
| Narrative Momentum: form, cards, conversation, threshold, timeline, cross-probe, strategy (`render.js:3834-4137`) | keep | `#/session/:id/narrative` | 1, 2, 4, 6 | Threshold = fewest warm-up turns with `threshold_found` (db.py:2426). Per-turn labels (db.py:2436). Strategy success = sequences with any run labelled complied or collapsed ÷ sequences, plus average threshold (db.py:2466-2478). Cross-probe thresholds (db.py:2446). Batch cost estimate (app.py:2162, runner.py:1175-1226). Routes: `/api/strategies` GET, `/api/sessions/{id}/sequences`, `/api/sequences/{id}*`, `/api/sequence-runs/{id}/turns`, `/api/sessions/{id}/sequence-batch`, `/api/sequence-batches/{id}*`, `/thresholds`, `/strategy-effectiveness` |
| Framing Variants: Edit Groups / Results, AI-assisted / manual (`render.js:1473-1894`) **and** the conditions-type group run (`render.js:3150-3180`, `api.js:111-170`) | keep both | `#/variants` (Edit), `#/session/:id/variants` (Results). Running a `variant_type: conditions` group (db.py:1336-1357) runs every session probe × each condition through SSE `POST /api/sessions/{id}/batch-conditions` (app.py:572). The run creates an experiment and opens `#/experiments/:id` Conditions; total probes × conditions is confirmed in a Dialog first | 1, 2, 4, 6 | Consistency score = groups where all variants share a label ÷ groups with ≥ 2 variant runs, latest run per probe (db.py:1530-1597). Routes: `/api/variants/files*`, `/api/variants/generate`, `/api/probe-groups*`, `/consistency`, `/batch-conditions` |
| Statistical Analysis (`render.js:4662`) | keep | `#/session/:id/stat` | 1, 2, 4, 6 | per probe × model, refused of N iterations (`consistency_rate`, db.py:2863-2889) and the four outcome counts; `/stat-run`, `/stat-runs`, `/api/stat-runs/{id}` |
| Dashboard Overview: tiles, export all, clear all, filters, detail (`render.js:2248`, `:2499`, `:2538`, `:2654`, `:2722`) | keep; Clear All becomes a Dialog where the user types `DELETE_ALL_DATA`, the value the route requires (app.py:2531) | `#/dashboard` | 1, 6 | counts ← `/api/dashboard/stats` (db.py:2605). Routes: `/api/dashboard/*` incl. `export-all`, `clear-all`; `/api/sequences/{id}/export`, `/api/comparisons/{id}/export` |
| Policy Scorecard (`render.js:4823`) | keep | `#/dashboard/scorecard` | 1, 2, 4 | Per model × claim, refused of total = `refused_rate`, with the label from the fixed rule (db.py:3140-3146) shown verbatim (problem 16, Q1). Per-model counts (db.py:3166-3169). Routes: `POST /api/scorecard/generate`, `GET /api/scorecards` |
| Publication Export + themes (`render.js:4945`, `:5086`) | keep; the preview shows the document exactly as `publication.py` generates it | `#/dashboard/publication` | 1, 2 | Consistency matrix cells = refused ÷ total from stat runs (publication.py:246-262). Pushback summary success = collapsed or complied, counted over `coach_examples`: with no model filter this includes the 3 seeded examples (publication.py:318-326, seed.py:78); a model filter drops them (`LEFT JOIN runs … WHERE r.target_model IN`, publication.py:334-345). Routes: `/api/publication/export`, `/api/publication/exports/{id}/download`, `/api/themes`, `/api/themes/{name}` |
| Policy Claims Browser + probe-claim linking (`render.js:3550`, `api.js:950-957`) | keep | `#/policies` | 2 (K12), 4 | `/api/policies`, `/api/policies/{provider}`, `/api/probes/{id}/claims*` |
| Compliance scorecard (`render.js:3615`; called only by `api.js:962` with no button) | **drop the renderer** (dead, problem 15). The route stays API-only and is exempt in §11 step 4 | none | none | none |
| Coach Examples (`render.js:968`) | keep; native-prompt edit becomes a Dialog | `#/coach-examples` | 4 | `/api/coach-examples*` |
| Regression Snapshots browser + diff (`render.js:3678`, `:3733`) | keep; the name is entered in a Dialog | `#/session/:id/snapshots` | 1, 2, 4 | Changed/unchanged counts; per probe improved/regressed/changed by the fixed rank refused > negotiated > collapsed > complied (app.py:880-925). Routes: `/api/sessions/{id}/snapshots`, `/api/snapshots/{id}`, `/diff` |
| Experiments list (`experiment.js:174-246`) | keep | `#/experiments` | 4, 6 | `GET /api/experiments` |
| New Experiment wizard (`experiment.js:247-439`) | keep. Problem 4 goes away: the wizard posts `CreateExperimentRequest` (models.py:250-257, `conditions[].label`, a non-empty `system_prompt` per models.py:215, `model_ids`), reads `{experiment, conditions}`, then adds prompts from the chosen probes via `POST .../prompts` (app.py:2837). The **repetitions input is dropped**: no backend code reads it (no `repetitions` in `flinch/*.py`; experiment.js:45, :410), and each cell runs once | `#/experiments/new` | 4, 6 | Review lists the chosen conditions, models and probes (no computed numbers). `POST .../estimate` needs a created experiment with prompts (app.py:2884-2898), so its fields appear on the Overview tab after Create |
| Experiment dashboard (`experiment.js:440`) | merge into one Experiment screen. Problem 6 goes away: the screen reads `{experiment, conditions, progress}` (app.py:2794-2802) | `#/experiments/:id` Overview tab | 1, 2 (K16), 6 | Before Start: cells = prompts × conditions × models, the three factors and `estimated_cost_usd` from `POST /estimate`. Running: completed of total per condition ← `GET /progress`, a plain-JSON route (app.py:2944-2947; problem 18), polled every 2 s while status is `running`. `POST /start` and `/resume` are SSE streams that drive the run (app.py:2900-2940). The screen opens the stream through `src/lib/api/experiment-runs.ts`, a module-level store that never closes it when a component is destroyed, so moving around inside Flinch keeps the run alive, as in v0.8.0 (experiment.js:94-105, :949). Closing or reloading Flinch stops it (K19). Routes: `/start`, `/pause`, `/resume`, `/resume-conditions`, `/estimate`, `/progress` |
| Results / Statistical Analysis / Export (`experiment.js:551`, `:641`, `:736`) | merge as tabs. Problem 5 goes away: the screen calls `/responses` (app.py:3053) | `#/experiments/:id` Responses, Analysis, Export tabs | 1, 2, 4 | Win rate = wins ÷ rankings per condition (stats.py:108-197). Cohen's d + bootstrap 95% CI + Student t-test p + n1/n2 (stats.py:199-259). Mann-Whitney U, p, rank-biserial, n1/n2 (stats.py:409-458). Wilcoxon W, p, pairs, median difference (stats.py:460-538). Mann-Whitney p raw / Bonferroni / FDR across k tests (stats.py:540-589, :731-735). Krippendorff's alpha with raters and items (stats.py:261-323). Power with n = completed ÷ 3 (stats.py:362-392, :710). Routes: `POST /analyze`, `GET /analysis`. Export: `/export` csv/jsonl (app.py:3101), `/prolific` + `/prolific/csv` (app.py:2983, :2995), `/preregistration` (app.py:3120), `/report` (app.py:3039), `/analysis/export` (app.py:3025) |
| Condition Comparison (`render.js:1898-2185`) | merge into the Experiment screen | `#/experiments/:id` Conditions tab | 1, 2, 4 | "compliance rate" = (complied + negotiated) ÷ completed responses, with the counts (db.py:3800-3805). Metric mean, SD and n (db.py:3816-3826). **Per pair of conditions and per metric:** d with CI and n1/n2, U with Mann-Whitney p raw and FDR p, read from `effect_sizes`, `nonparametric` and `corrections` in `/condition-comparison`. No min/max across pairs. Routes: `GET /condition-comparison`, `POST` + `GET /metrics`, `POST /analyze`, `GET /condition-export`, `/responses?prompt_id=`, `/prompts` |
| Turn detail modal (`api.js viewRun`) | merge | Turn list on the run screen | 4 | `/api/runs/{id}/turns` |

Routes no reachable v0.8.0 surface called stay API-only; §11 step 4's coverage table lists them.

Caveats per rebuilt screen (§5 has phrases and sources):
- Run screen: K1, K1b, K3, K4, K5, K18.
- History panel / session stats: K1, K2, K3, K18.
- No-key notice: K1b.
- `#/compare`: K1, K2, K4.
- Variants results: K1, K6.
- Narrative: K1, K15, K16.
- Stat analysis: K1, K2.
- Snapshots diff: K7.
- Scorecard: K2, K4, K8, K12.
- Publication: K2, K17.
- `#/policies`: K12.
- Experiment Overview: K16, K19.
- Responses: K1.
- Conditions: K2, K9, K10, K11.
- Analysis: K10, K13, K14.

## 5. Caveat list (rule 2)

All phrases are drafts and go through the brad-voice pass in L5. `copy/pins/<lane>.ts` pins the final phrase to the component file that renders the result; `caveats.test.ts` checks every pin. `shoot.mjs` checks "beside" in the DOM: each `[data-result=<id>]` has a `[data-caveat=<id>]` in the same `<section>`, and both are inside the same viewport shot (§8 shot rule), at both sizes.

| ID | Draft phrase (draft; brad-voice pass) | Source in code | Sits beside |
|---|---|---|---|
| K1 | "A keyword scan labels the reply first. When the scan isn't sure, a judge model labels it instead. Either can be wrong." | classifier.py:54-55 (scan kept only above 0.8), :81-86 (negotiated 0.6, long no-marker reply complied 0.7, so those go to the judge) | run screen, history, stat runs, compare, variant results, narrative turns, experiment responses |
| K1b | "No judge model is set up, so the keyword scan's label stands even when it isn't sure. A short reply it can't place is labelled complied." | classifier.py:57-60, :88-89 | no-key notice; run screen when no key |
| K2 | "A rate from {n} runs is a rate from {n} runs." | db.py:2875 | stat analysis, scorecard, session stats, compare, condition rates, publication preview |
| K3 | "A refusal that held after one pushback might not hold after two." | runner.py:165-230; playbook.md:10-11 | final label on the run screen; session stats "final" |
| K4 | "A refusal can come from the provider's product filter, not the model. Flinch can't tell which." | target.py:94, :165 (`finish_reason` captured; nothing reads it to separate the two) | run screen, compare, scorecard |
| K5 | "The coach's confidence is the coach model's own guess." | coach.py:74, :163 | coach suggestion |
| K6 | "Each variant counts only its latest run in this session." | db.py:1550-1555 | variant results |
| K7 | "Improved means closer to a refusal. That fits probes that should be refused, not ones that should be answered." | app.py:899-909 | snapshot diff |
| K8 | "Consistent, over and under come from fixed cut-offs (80% and 20%). They are settings, not a test." | db.py:3140-3146 | scorecard |
| K9 | "This compliance rate counts negotiated replies as compliance." | db.py:3804 | Conditions tab |
| K10 | "Mann-Whitney p-values are corrected across the {k} Mann-Whitney tests (Bonferroni and Benjamini-Hochberg FDR). t-test and Wilcoxon p-values are not corrected." | stats.py:540-589, :731-735 | Analysis, Conditions |
| K11 | "Hedging, confidence and evasion are counts of listed phrases, not judgements of meaning." | lexical.py:41-66, :255-263 | Conditions metrics |
| K12 | "Flinch stores this claim text itself (seeds/policies.py), with no link to the provider's page. Check the wording there." | seeds/policies.py:3-26 (claims typed in, no source field); db.py:132-144 (no source column) | policy browser, scorecard |
| K13 | "Power here assumes an even three-way split of responses." | stats.py:710 | Analysis power |
| K14 | "AI raters are models ranking blinded replies. Agreement says they agree, not that they are right." | rater.py:31-60; stats.py:261-323 | Analysis win rates, alpha |
| K15 | "A threshold from one run can land somewhere else on the next." | db.py:211-220, :2426 | narrative threshold, cross-probe |
| K16 | "Cost is a rough guess from fixed token counts and a fixed price table in Flinch, not a quote from the provider." | runner.py:620-632 (500 in / 1,000 out per cell, averaged over four providers' prices), :1175-1226 | experiment estimate (Overview, before Start), sequence batch estimate |
| K17 | "Pushback success counts Flinch's three example pushbacks along with yours." Rendered only when the export has no model filter; with a filter the examples drop out (publication.py:334-345). | publication.py:318-345; seed.py:78-106 | publication preview (pushback summary, unfiltered) |
| K18 | "Counts include labels changed by hand. The original label isn't kept." | app.py:432-439 | label control, session stats |
| K19 | "Closing or reloading Flinch stops a running experiment." | app.py:2900-2940 (the run lives inside the `/start`/`/resume` stream's generator) | Experiment Overview while a run stream is open |

## 6. Glossary term list (rule 4)

Each term keeps its real name and gets a plain-word hover (`Term.svelte` + `glossary/<lane>.ts`). Definitions are drafts (brad-voice pass). The outcome names stay as stored; the playbook's long names (playbook.md:8-13) appear in the hover.

| Term | Defined in |
|---|---|
| probe; domain; narrative probe (opening/target) | db.py:18-29, :1005-1016 |
| session; run; target model | models.py:34-66; db.py:31-61 |
| refused, collapsed, negotiated, complied | models.py:6-10; classifier.py:94-97 (judge prompt definitions); playbook.md:6-13 |
| initial vs final label; changing a label | db.py:44-61; app.py:432-439 |
| keyword-only mode; judge model | classifier.py:47-60 |
| pushback; pushback move; specificity challenge, equivalence probe, projection check, contradiction mirror, category reductio, reality anchor, minimal pressure | models.py:17-24; coach.py:6-40; playbook.md:35-50 |
| coach; coach profile; coach backend; coach example; promote to example; pattern detected | coach.py:44-76; db.py:63-84; seed.py:78-106, :134-145; app.py:462 |
| annotation; finding; pattern tag | db.py:105-114; app.py:707-723 |
| batch; conditions batch | app.py:540-700 |
| multi-model compare; agreement | app.py:1689-1800 |
| variant group (framings / conditions type); baseline variant; consistency score | db.py:115-122, :1324-1400, :1530-1597; `flinch/variants/*.md` |
| stat run; iteration; consistency rate | db.py:247-270, :2863-2889 |
| narrative momentum; sequence; warm-up turn; strategy; whittling; threshold | db.py:168-232, :2426-2478; `flinch/strategies/default-strategies.md` |
| snapshot (shown as "baseline"); regression diff | db.py:123-131; app.py:837-925 |
| policy claim; expected behavior; severity; enforcement (consistent/over/under) | db.py:132-146, :3083-3169; seeds/policies.py |
| scorecard; publication export; theme | app.py:2614-2758; publication.py:185-399; `flinch/themes/presets.md` |
| experiment; condition; system prompt; prompt; response; cell; cost estimate | models.py:213-257; db.py:323-386; app.py:2884-2898 |
| MTLD; TTR; Honoré's statistic; Flesch-Kincaid grade; Gunning fog; hedging/confidence/evasion ratio; subjectivity; polarity | lexical.py:181, :189, :198, :41-66, :255-263; metrics.py:19-41 |
| Cohen's d; bootstrap confidence interval; t-test | stats.py:57-100, :199-259 |
| Mann-Whitney U; rank-biserial; Wilcoxon signed-rank | stats.py:49-56, :409-538 |
| p-value; Bonferroni; FDR (Benjamini-Hochberg) | stats.py:540-589 |
| Krippendorff's alpha; AI rater; win rate; blinding | stats.py:108-197, :261-323; rater.py:31-60 |
| power analysis | stats.py:362-392 |
| Prolific; preregistration | prolific.py; app.py:2983-3013, :3120 |
| Ollama | target.py; app.py:2372-2410 |

## 7. Implementation steps

Lane order:
1. **L0**
2. **L1 ∥ L2 ∥ L3 ∥ L4.** Inside L2, T7 runs after T6.
3. **L5**
4. **L6**
5. **L7**

**Ownership.** L0 owns every shared file:
- `src/lib/nav.ts`: lists every hash route with its owning lane.
- One stub `+page.svelte` per route ("arrives in L<n>"), which the owning lane replaces.
- `src/routes/session/[id]/+layout.svelte`.
- The aggregator `index.ts` files.
- `tailwind.config.js`.
- `tips/l0.ts`, with at least one shell tip so G8 is never vacuous.

Each lane owns only its own files:
- `src/routes/<its routes>/`
- `src/lib/api/<lane>.ts` (its typed calls, built on L0's `api/client.ts`)
- `glossary/<lane>.ts`, `tips/<lane>.ts`, `readouts/<lane>.ts`
- `copy/pins/<lane>.ts`, which exports `status: 'draft' | 'final'`
- `scripts/dev/shots/<lane>.json`

`ui/` (splash) belongs to L4 until L5 ends, then to L6. Lanes never commit `flinch/static/`. Each lane brief is `.omc/plans/flinch-lane-<L>.md`; decisions go to `progress.txt`.

**Integrator merge step**, run by the main session for each lane, in its order:
1. `git merge --no-ff <lane>`. `.gitattributes` has `flinch/static/** -text merge=ours`, and `git config merge.ours.driver true` is set once in the clone.
2. `npm --prefix flinch-ui ci && npm --prefix flinch-ui run build`
3. `git add -A flinch/static && git commit -m "Rebuild flinch/static after <lane>"`
4. `python scripts/dev/run-gates.py --lane <L> --integrator`

The merge is done when the integrator gate file is all green. If any gate is red: `git reset --hard ORIG_HEAD` (the pre-merge head, which undoes the merge and the rebuild commit; `HEAD~2` is equivalent), fix on the lane, and merge again.

**B-list: the complete set of backend and shell changes.** Nothing else under `flinch/*.py` or `src-tauri/` changes, apart from L6's updater files and L7's version bumps.

| ID | Change | Justification |
|---|---|---|
| B1 | `tests/test_experiment_pipeline.py:39`: `await db_module.get_async_db()` → `async with ...`, wrapped as `def test_experiment_pipeline(): asyncio.run(run_pipeline_test())` | problem 1; G1 |
| B2 | `flinch/app.py`: `import logging` | problem 2 (NameError at app.py:667, :676 on the batch-conditions path, a kept feature); G2 |
| B3 | `flinch/__init__.py`: `__version__ = "0.8.0"` | problem 3 (`/api/version` and the UI header report 0.5.0; `/health` already reads importlib.metadata, app.py:3305-3311); rule 1; G1 `test_versions_match` |
| B4 | `flinch/app.py` beside line 131: `app.mount("/_app", StaticFiles(directory=str(STATIC_DIR / "_app"), check_dir=False), name="app_assets")` | decision 1.1 + A1 (SvelteKit's root-relative `/_app`); problem 10; G6 (`test_starts_without_app_dir` proves the sidecar still starts when the directory is absent) |
| B5 | `flinch/db.py:1021-1031`: skip the text before the first `## ` heading in `import_probes_from_markdown` | problem 7; rule 7 (a header-as-probe fails R1) |
| B6 (conditional, unverified) | `src-tauri/capabilities/`: a capability with `remote.urls: ["http://127.0.0.1:*"]` granting only the three key commands (`lib.rs:97-111`). Applied only if T10's Windows test shows that a key saved on the desktop doesn't persist (no `__TAURI__` or a refused `invoke` on the sidecar origin). T10 records the result as baseline problem 17 before the change. | kept feature (keys persisting to Credential Manager); G7 |

Problems 4, 5, 6, 8, 9, 11, 12, 13, 14, 15 and 18 are UI-side and go away with the rebuild. Problem 16 is shown verbatim pending Q1. Rule-6 persistence needs no B-list entry (F0).

**"Recorded 2xx" (used below)** means `shoot.mjs` logs every API request per shot (method, normalised path, status) to the manifest. A route counts as exercised when it appears in that lane's manifest with a 2xx status.

### L0: gates and scaffold

**T0: Gate set and evidence harness.** Rules: §4 gates, 1.3.
- Files:
  - B1, B2, B3
  - tests: `tests/test_existing_db.py`, `tests/test_version.py` (pyproject = `flinch/__init__.py` = `GET /api/version` = tauri.conf.json = Cargo.toml = `flinch-ui/package.json`; the package.json comparison is skipped while that file doesn't exist, i.e. before T1)
  - fixture: `tests/fixtures/make_v080_fixture.py`, `tests/fixtures/flinch-v0.8.0.db`, `tests/fixtures/flinch-v0.8.0.ids.json`, `tests/fixtures/v080-ui-routes.txt`
  - harness: `scripts/dev/run-gates.py`, `scripts/dev/gates.json`
  - `.gitattributes`: `flinch/static/** -text merge=ours`, `flinch-ui/** text=auto eol=lf`, `*.png binary`, `tests/fixtures/*.db binary`
  - evidence `index.md` gets a "Rebuild gates" section
- Acceptance:
  - G1 collects the 4 T0 node IDs with 0 failed.
  - G2 passes, with F821 at 0 and the total ≤ 539.
  - `verify-phase1.py` passes 3/3.
  - `GET /api/version` returns `0.8.0`.
  - The fixture has ≥ 1 row in each of: probes, sessions, runs, run_turns, annotations, coach_examples, probe_variants, snapshots, probe_claim_links, policy_claims, strategy_templates, sequences, sequence_runs, sequence_turns, sequence_batches, comparisons, stat_runs, stat_run_iterations, scorecard_snapshots, publication_exports, experiments, experiment_conditions, experiment_prompts, experiment_responses, response_metrics, ai_ratings, ai_rating_items, analysis_results.
  - The fixture's probe names are exactly the 4 example names.
  - `v080-ui-routes.txt` covers 101 unique paths, and its header states the pair count.
- Depends on: nothing.

**T1: SvelteKit project that builds into `flinch/static/`.** Rules: 1.1, A1, D1, problem 10.
- Files:
  - `flinch-ui/package.json` with `check`, `test`, `build`, `dev`, and `version` = 0.8.0
  - `package-lock.json`
  - `svelte.config.js`: adapter-static `{pages: '../flinch/static', assets: '../flinch/static', fallback: 'index.html'}`; `router.type: 'hash'`; `version: {name: pkg.version, pollInterval: 0}`; `csp: {mode: 'hash', directives: {'script-src': ['self']}}`
  - `vite.config.ts`: `127.0.0.1:5180`, strictPort, proxy; never 5173
  - `tailwind.config.js`, `postcss.config.js`, `tsconfig.json` at the `flinch-ui/` root
  - `src/app.html`: `<html class="dark">` and `<link rel="icon" href="/static/favicon.png">`
  - `src/app.css`
  - `src/routes/+layout.ts`: `ssr = false`, `prerender = false`
  - `static/favicon.png`, copied from `src-tauri/icons/32x32.png`
  - L0's nav, stub routes and session layout
  - delete the 9 vanilla files
  - B4
  - `tests/test_static_serving.py`; `tests/test_wheel_contents.py` (in a temp dir, `pip wheel . --no-deps` contains `flinch/static/index.html` and `flinch/static/_app/` and no `flinch/probes/*.md` except `example-probes.md`; the `bundle.resources` globs in tauri.conf.json match every file under `flinch/static/`, including `_app/**`)
  - `flinch-ui/.gitignore`
- Acceptance:
  - G1 collects the T1 node IDs; G4 and G6 (integrator mode) are green.
  - A second build on the same machine leaves `git status --porcelain -- flinch/static` empty.
  - A build of the same commit on the other platform (Linux vs Windows) also leaves porcelain empty. It is recorded in the gate file, or listed as `PENDING: Windows`, which L7 must clear.
  - Starting `python -m flinch.app` and loading `/` gives 0 console errors and 0 non-local requests.
  - `grep -r cdn.tailwindcss.com flinch/static` finds nothing.
  - The built `index.html` contains the meta CSP. This checks the open question of whether a hash-router fallback page gets one.
- Depends on: T0.

**T2: Design-language primitives, written fresh** (matched to `pry-design-reference.md`, nothing imported). Rules: 1, 2, 4, 6.
- Files under `flinch-ui/src/lib/`:
  - components:
    - `Term.svelte`: hover/focus definition, `aria-describedby`, never takes focus.
    - `Readout.svelte`: `role=status aria-live=polite`, sr-only "In plain words:".
    - `Rate.svelte`: required `count`, `of`, `label`.
    - `Stat.svelte`: required `value` and `inputs`.
    - `Caveat.svelte`: `id`, `text`, emits `data-caveat`.
    - `FirstTimeTip.svelte`.
    - `LoadingScreen.svelte`: step text plus elapsed time.
    - `Dialog.svelte`: scrolls inside the viewport (problems 9, 12).
    - `Toast.svelte`, `OutcomeBadge.svelte`.
  - `popup/place.ts`: anchored on the preferred side, then opposite, then cross; inset for large targets; arrow ≤ 160 px.
  - `tips/registry.ts`: `TipDef {id, title, route, params?, open?, target, blurb, why, placement}`. `route` is the hash route pattern; `params` maps its placeholders to keys in `flinch-v0.8.0.ids.json`, so `#/session/:id/run/:runId` resolves to a concrete fixture URL. `open` is an optional selector clicked first, for tips inside dialogs.
  - `tips/coordinate.ts`: F0. Cookies `flinch_tips` and `flinch_first` (`Max-Age=31536000; SameSite=Strict; Path=/`), with localStorage as the fallback; every access in try/catch.
  - `api/client.ts`: fetch wrapper and `ApiError` carrying the server's `detail`.
  - `api/sse.ts`: reads the POST SSE streams (`batch`, `batch-conditions`, `run-auto`, sequence-batch `start`, `stat-run`, experiment `start`/`resume`/`metrics`/`resume-conditions`; `text/event-stream` at app.py:567, :695, :2056, :2184, :2584, :2917, :2942, :2963, :3296).
  - `tailwind.config.js` tokens: zinc surfaces, indigo accent, and `outcome.{refused,collapsed,negotiated,complied}` carrying the four hues of v0.8.0's `--color-*`.
- Acceptance: vitest passes these cases:
  - `place.test.ts`: for 12 anchor positions at 1024×700 and 1280×800, the popup stays in the viewport, doesn't intersect its target, and arrows are ≤ 160.
  - `Rate.test.ts`: `count=3 of=12` renders "3 of 12" and "25%"; `of=0` renders "no runs yet" and no "NaN".
  - `coordinate.test.ts`: after `markTipSeen('a')`, `document.cookie` contains `flinch_tips=a`, and the value matches `^[a-z0-9_,-]*$`. The full tip-id registry joined with commas is under 3,000 bytes (a cookie holds 4 KB); if a later registry exceeds that, `coordinate.ts` stores the overflow in localStorage and the test asserts it does. `isTipSeen` returns false and doesn't throw when both the cookie and `localStorage` accessors throw.
  - `sse.test.ts`: parses the `event:`/`data:` frames emitted at app.py:680 into 3 typed events, and data-only frames (app.py:2914, :2939, :2960) into 3 default `message` events.
  - `svelte-check` reports that `<Rate>` without `of` fails to type-check (fixture file in `src/lib/__typecheck__/`).
- Depends on: T1.

**T3: Copy tests, coverage and drivers.** Rules: 6, 7, 8.
- Files:
  - `src/lib/copy/visible-strings.ts`: extracts text from `.svelte`, `.ts`, `ui/index.html` and `ui/splash.js`.
  - tests: `visible-strings.test.ts`; `caveats.test.ts` (every K-id in §5 appears in ≥ 1 pin, and each pinned phrase occurs in its file); `overstatement-closure.test.ts` ("proves", "always", "never", "guaranteed", "definitively" are rejected outside pinned exceptions); `banned-verbs.test.ts` ("the model knows/wants/thinks/believes/decides" is rejected); `bare-number.test.ts` (no `%}` interpolation or `.toFixed(` in `.svelte` outside `Rate`/`Stat`).
  - `scripts/dev/shoot.mjs`:
    - Playwright, pinned as a devDependency.
    - Starts `python -m flinch.app --port <free> --db-path <temp copy of fixture>` with all provider env vars removed; applies G11 and G12.
    - Walks `scripts/dev/shots/<lane>.json` at both sizes and writes PNGs + `manifest.json` (including the API request log) to `.omc/evidence/flinch-rebuild-2026-10-15/shots/<round>/`.
    - Live-model states use route mocks built from fixture rows, flagged `mocked` in the manifest.
  - `scripts/dev/popup-audit.mjs`:
    - Same server setup.
    - For each `TipDef` it clears seen-state, navigates to `tip.route` with `tip.params` resolved from `ids.json`, clicks `tip.open` if set, waits for `tip.target`, and reads bounding boxes from the DOM. It does the same for every Term and Dialog on the lane's shot routes.
    - FAIL: outside the viewport, covering its own target, covering an unanchored `[data-surface]`, or an arrow > 160 px. SKIP: target missing within 5 s.
    - `--a11y` runs axe-core.
  - `scripts/dev/route-coverage.py`:
    - Reads `tests/fixtures/v080-ui-routes.txt` and the union of shot manifests (`--lane <L>` reads that lane's manifest only), and normalises paths.
    - Exempts `GET /api/experiments/{x}/results` (never existed, problem 5) and `GET /api/sessions/{x}/compliance` (problem 15).
    - Writes `route-coverage.md`, listing each route in `api-routes.md` as "recorded 2xx in <shot>", "exempt: <reason>", or "API-only at v0.8.0".
- Acceptance:
  - G5 is green.
  - `shoot.mjs --selftest` exits non-zero in two forced cases: a non-local request, and a second file in `/api/probes/files`.
  - `popup-audit.mjs` on the L0 shell covers ≥ 1 tip from `tips/l0.ts` and prints `FAIL 0 / SKIP 0` at both sizes.
  - `route-coverage.py` run on L0 lists all 101 v0.8.0 paths as uncovered or exempt and exits non-zero (it must exit 0 at §11).
- Depends on: T2.

### L1: core probe loop (parallel after L0)

**T4: Shell, sidebar, probes, New Session.** Rules: 4, 6.
- Files: `src/routes/+layout.svelte` contents (sidebar, notice, toasts, shortcuts), `src/lib/components/sidebar/*`, `NewSessionDialog.svelte`, `ImportDialog.svelte`, `AddProbeDialog.svelte`, `api/l1.ts`, B5, `tests/test_load_defaults.py`, `shots/l1.json`.
- Acceptance:
  - On an empty DB, Load Defaults yields exactly 4 probes, none named "Flinch Example Probes".
  - After switching sessions, the switcher shows the active session's name (problem 8).
  - At 1024×700 the New Session dialog's title and name field are in the viewport shot (problem 9).
  - The sidebar and probe routes in §4 are recorded 2xx in the L1 manifest.
  - `tips/l1.ts` defines tips for the probe panel, New Session and the no-key notice, and G8 covers them.
- Depends on: L0.

**T5: Session, run and pushback screens.** Rules: 1, 2, 4, 6.
- Files: `src/routes/session/[id]/+page.svelte`, `run/[runId]/+page.svelte`, `batch/+page.svelte`, `readouts/l1.ts`, `glossary/l1.ts`, `pins/l1.ts`.
- Acceptance:
  - `shots/l1.json` captures every state in the evidence index's "Not capturable" list for the core loop: thread, coach suggestion with move and confidence, coach and manual pushback, skip, continue, label change, annotations with tags, promote, all 7 export formats, batch with cancel, history, turn list.
  - Every route in §4's L1 rows is recorded 2xx.
  - Each outcome count renders through `Rate` (`bare-number.test.ts` passes).
  - The `data-caveat` ids K1, K1b, K3, K4, K5 and K18 are present beside their results (the DOM check in `shoot.mjs`).
  - All 7 move names and 4 outcome names are wrapped in `Term`, checked by `terms.test.ts` against `glossary/l1.ts`.
  - With no key, the Send button is `disabled` and its text names the missing provider.
- Depends on: T4.

### L2: research tools

**T6: Multi-model compare and session compare.** Rules: 1, 2, 4.
- Files: `src/routes/compare/**`, `api/l2.ts`, `readouts/l2.ts`, `glossary/l2.ts`, `tips/l2.ts`, `pins/l2.ts`, `shots/l2.json`.
- Acceptance:
  - Agreement renders "k of n probes" with n as in app.py:1677-1685 and :1779-1800.
  - Each disagreeing probe lists every model's label.
  - The compare routes in §4 are recorded 2xx.
  - K1, K2 and K4 pass the DOM check.
- Depends on: L0.

**T7: Narrative momentum, framing variants (incl. conditions runs), stat analysis, snapshots.** Rules: 1, 2, 4, 6.
- Files: `src/routes/session/[id]/{narrative,variants,stat,snapshots}/**`, `src/routes/variants/**`, plus additions to the L2 files.
- Acceptance:
  - Every route in §4's Narrative, Variants, Stat and Snapshots rows is recorded 2xx. That includes `batch-conditions`: a mocked SSE stream for the fixture's conditions group ends on `#/experiments/<id>` with the Conditions tab selected.
  - The consistency score renders "k of n groups".
  - Stat rows render "refused r of N" plus all four counts.
  - Snapshot save uses Dialog.
  - The diff shows the changed/unchanged counts.
  - K2, K6, K7, K15 and K16 (sequence batch estimate) pass the DOM check.
- Depends on: T6.

### L3: experiments

**T8: Experiment list, wizard, and the tabbed experiment screen.** Rules: 1, 2, 4, 6.
- Files: `src/routes/experiments/**`, `api/l3.ts`, `api/experiment-runs.ts`, `readouts/l3.ts`, `glossary/l3.ts`, `tips/l3.ts`, `pins/l3.ts`, `shots/l3.json`, `ExperimentProgress.test.ts`.
- Acceptance:
  - On an empty DB, the wizard's `POST /api/experiments` returns 200 (problem 4).
  - An empty system prompt keeps Next disabled, with the reason shown.
  - The wizard has no repetitions input.
  - Review lists the chosen conditions, models and probes and shows no computed number.
  - After Create, Overview shows cells, prompts, conditions, models and `estimated_cost_usd` from `POST /estimate` with K16 beside them, before Start. It also shows name, models, created date and conditions from the fixture's experiment (problem 6).
  - `ExperimentProgress.test.ts` returns 3 mocked `GET /progress` JSON responses at a 2 s poll interval (fake timers) and asserts that "completed of total" updates 3 times. Polling stops when status leaves `running` (problem 18). It also stops when status is `running` but `experiment-runs.ts` holds no open stream (a run that died, e.g. after a reload), and the tab then shows "not running" (draft; brad-voice pass) instead of stale counts.
  - Run survives navigation: with a mocked `/start` stream open, navigating `#/experiments/:id` → `#/dashboard` → back leaves the stream open (the store reports it open; the mock saw no abort) and "completed of total" keeps rising.
  - Start sends the body `{}` and receives 200 `text/event-stream` on the fixture (problem 19: `/start` requires a body, app.py:2901; v0.8.0 sent none, experiment.js:949).
  - Overview shows K19 while a stream is open.
  - Responses calls `/responses` (problem 5).
  - Conditions lists each condition pair × metric with d, CI, n1/n2, U, p raw and FDR p, with no min/max.
  - Analysis: for every key in `readouts/l3.ts`, `shoot.mjs`'s DOM check finds a `[data-result=<key>]` element with its `[data-inputs]` child non-empty. An `{"error": ...}` payload renders its text in the tab.
  - All five Export outputs are recorded 2xx.
  - K9, K10, K11, K13, K14, K16 and K19 pass the DOM check.
- Depends on: L0.

### L4: dashboard, scorecard, publication, policies, coach examples, settings

**T9: Dashboard, Policy Scorecard, Publication Export.** Rules: 1, 2, 4.
- Files: `src/routes/dashboard/**`, `api/l4.ts`, `readouts/l4.ts`, `glossary/l4.ts`, `tips/l4.ts`, `pins/l4.ts`, `shots/l4.json`.
- Acceptance:
  - Dashboard tiles equal `/api/dashboard/stats` for the fixture.
  - Clear All stays disabled until `DELETE_ALL_DATA` is typed, and sends that value.
  - Each scorecard cell renders "refused r of N", its label, and the rule text from db.py:3142-3145.
  - The dashboard routes in §4 are recorded 2xx.
  - K2, K8, K12 pass the DOM check; K17 is present on the unfiltered preview and absent with a model filter.
  - Q1 has been asked before this task starts.
- Depends on: L0.

**T10: Policy browser, coach examples, Settings, splash.** Rules: 2, 4, 6.
- Files:
  - `src/routes/{policies,coach-examples,settings}/**`
  - `ui/index.html`, `ui/splash.js`, `ui/styles.css`: restyled to the tokens; the splash shows the current `bootstrap:progress` stage and elapsed time, and its strings are in visible-strings. `ui/splash.js:114` navigates to `url + '/?shell=desktop'`; the app stores that flag in `sessionStorage['flinch:shell']`.
  - `scripts/dev/splash-shot.mjs`: Playwright. Serves `ui/` with `app.security.csp` from tauri.conf.json as a `Content-Security-Policy` header, fails on any `securitypolicyviolation` event, and stubs `window.__TAURI__` to emit the `BootstrapStage` values serialised by `bootstrap/events.rs:8-15` (`probing`, `cleaning`, `extracting_pbs`, `creating_venv`, `installing_deps`, `ready`) in the `BootstrapEvent` shape (events.rs:17-24).
- Key-save rules:
  - Desktop (`sessionStorage['flinch:shell'] === 'desktop'`): validate → `POST /api/settings/set-key` → `invoke('set_api_key')`, as settings.js:136-183 does. If `invoke` is missing or fails, the error is shown and the runtime key stays active for the session. The desktop path never calls `POST /api/settings/keys`, which writes keys in plain text to `.env` in the directory containing the `flinch` package (`_ENV_FILE`, app.py:2200; `site-packages` when installed; app.py:2280-2300).
  - Browser (flag absent): `POST /api/settings/keys`, with that `.env` effect stated beside the form (draft; brad-voice pass).
- Acceptance:
  - One key form (problem 11).
  - The first launch with no keys redirects to Settings once; a reload doesn't redirect (`flinch_first` cookie).
  - Probe-claim link/unlink and coach example edit/delete are recorded 2xx and use Dialog.
  - `splash-shot.mjs` captures each stage at both sizes into the L4 manifest with 0 CSP violations.
  - **Windows test** (debug build, scratch `FLINCH_SIDECAR_DIR`; result in the L4 gate file):
    - (1) a key saved in Settings is present after a restart, and no `.env` exists in `site-packages`. Also run once on a `v0.8.0-desktop` install, to show whether problem 17 exists at baseline
    - (2) whether `window.__TAURI__` exists on the sidecar origin
    - (3) whether `invoke('set_api_key')` succeeds from it
    - (4) whether `invoke('runtime_status')` succeeds from it, which settles E2's premise
    - (5) dismiss a tip, quit, relaunch (new random port): the tip stays dismissed and Settings doesn't redirect, which confirms WebView2 keeps the F0 cookie; the WebView2 runtime version is recorded with the result
    - If (1) fails, record baseline problem 17 and apply B6 (then G7 applies), and re-test.
  - Otherwise G7 does not apply to this task. `ui/` files are embedded as bytes and `cargo check` can't fail on them; they are verified by `splash-shot.mjs` and G5. The full shell runs in L7.
- Depends on: L0.

### L5: copy pass, rubric rounds, popup audit

**T11: brad-voice copy pass, in main context.** Rules: 8, 9; handoff §5.
- Sequence:
  1. Starts once L1–L4 are merged and green.
  2. `/anthropic-skills:brad-voice` runs in the main session over every visible string: screens, tips, glossary definitions, K1–K19, empty states, errors, the splash.
  3. A critic agent reviews.
  4. A cold-read agent with a fresh context, seeing only screenshots, lists every misread.
  5. Fixes go back through brad-voice.
  6. Final phrases replace the drafts and every `pins/<lane>.ts` is set to `status: 'final'`.
- Acceptance:
  - G5 is green with final pins.
  - `evidence/.../voice/l5.md` holds a before/after line for every changed string, plus the critic and cold-read findings with their resolutions.
- Depends on: L1–L4.

**T12: Rubric rounds and final popup audit.** Rules: 6, 7.
- Acceptance:
  - `rubric/round-N.md` shows 0 below the bar at both sizes (§8).
  - `popup-audit.mjs --release` prints `FAIL 0 / SKIP 0` with 0 serious/critical axe findings.
  - Every string changed during the rounds has a line in `voice/l5.md`.
  - Then: an architect verification note against this plan in `evidence/.../verification.md`, a deslop pass on `flinch-ui/src`, and `run-gates.py --release` green.
- Depends on: T11.

### L6: updater (separable; 1.2)

**T13: Signed updater.** Rule 10.
- Brad generates the key (`cargo tauri signer generate -w ~/.tauri/flinch-updater.key`) and backs it up. Claude never runs that command, never reads the key, never commits it.
- Files:
  - `src-tauri/Cargo.toml`: `tauri-plugin-updater = "2"`, `tauri-plugin-process = "2"`
  - `src-tauri/src/lib.rs`: plugins, command `stop_sidecar_for_update`, and `RuntimeStatus.installed` = `bootstrap::is_runtime_ready()` (bootstrap/mod.rs:39-45: ready marker + venv Python). `RuntimeStatus.ready` only means a sidecar handle exists (lib.rs:52-59), which is false on most launches when the splash first asks.
  - `src-tauri/capabilities/default.json`: `updater:default`, `process:allow-restart` for `main`
  - `src-tauri/tauri.conf.json`: `bundle.createUpdaterArtifacts: true`; `plugins.updater` = `{pubkey, endpoints: [existing latest.json URL], windows: {installMode: "passive"}}`, dropping the v1 `active`/`dialog`/`_comment` keys
  - `ui/splash.js` + `ui/index.html`: E1, below; `copy/pins/l6.ts` (card strings, own `status`); `shots/l6.json`
  - `scripts/release.ps1`, mirroring Pry's:
    - key path default `$HOME\.tauri\flinch-updater.key`
    - runs `bundle-resources.py` and `cargo tauri build --ci`, then restores the Cargo.toml bytes and clears the env
    - requires `<installer>.sig`
    - writes `latest.json` and checks it: keys `version`, `notes`, `pub_date`, `platforms.windows-x86_64.signature` (equal to the `.sig` contents) and `.url` (ending in the installer filename)
    - prints the SHA256 and the `gh release create` command without running it
    - `-SkipBuild` only rewrites `latest.json`
  - `docs/releasing.md`: the five version locations per `test_versions_match`; never mark the release as a pre-release
- E1 behaviour:
  - The check starts when `runtime_status.installed` is true, so a first-run bootstrap (pip running) never sees the card, while a normal launch checks straight away.
  - It runs in parallel with the sidecar `/health` wait. Its budget is 3 s from splash start.
  - If no update is found, or the check fails or misses the budget, navigation proceeds exactly as today.
  - If an update is found before navigation, navigation pauses on the card ("Install" / "Not now").
  - Install: `stop_sidecar_for_update` → download and install → relaunch.
- Acceptance:
  - G7 is green.
  - A dry run of `release.ps1` with a throwaway key exits 0 with its `latest.json` checks passed; then the throwaway key is deleted.
  - `splash-shot.mjs` with a stubbed update captures the card with 0 CSP violations.
  - With a stubbed check that hangs, navigation happens at or before max(`/health` OK, splash start + 3 s) + 0.5 s.
  - Stubbed launch with `installed=true, ready=false`: the check runs. Stubbed `installed=false, ready=false`: no check runs.
  - `voice/l6.md` holds the card strings' brad-voice output and critic note, and `pins/l6.ts` has `status: 'final'`.
  - On a scratch branch, `git revert` of the L6 commits leaves G1–G8 green; that branch is then deleted.
- Depends on: L5.

### L7: release prep (no release without Brad's word)

**T14: Release build and docs.** Rules: 9, 10; handoff §5.
- Brad chooses the version number (AskUserQuestion at this step). It is bumped in the five places.
- `CLAUDE.md`: replace "Vanilla JS ES modules (frontend, no build step)" and add `flinch-ui/` and the dev commands.
- README dev section and the release notes go through brad-voice in main context (`voice/l7.md`).
- Build with `scripts/build-installer.ps1`, or `release.ps1` if L6 shipped. The installer must stay in the 50–80 MB band.
- Smoke test on the debug build with a scratch runtime directory. Never launch the release exe over Brad's install (handoff rule 10, §5).
- Upgrade test in a Windows Sandbox or VM that Brad provides on his machine:
  1. Install `v0.8.0-desktop` and run the fixture actions through the old UI.
  2. Install the new build.
  3. The new UI loads (the reinstall is triggered by the pyproject.toml change; `bundle_hash`, `bootstrap/mod.rs:51-84`), and `%APPDATA%\Flinch\flinch.db` row counts are unchanged.
  4. Record `upgrade-test.md`: OS build, both installer names and SHA256, the row counts before and after, and 3 screenshots.
- The T1 cross-platform build check is cleared.
- The PR description goes through brad-voice.
- Merge to master and release wait for Brad's explicit word.
- Acceptance:
  - `run-gates.py --release` is green at the release commit.
  - `upgrade-test.md` is present with every field filled.
  - `git diff master...HEAD | grep -nE '\bsk-[A-Za-z0-9_-]{20,}|BEGIN [A-Z ]*PRIVATE KEY|minisign'` prints nothing.
- Depends on: L5 (and L6 if kept).

## 8. Rubric (rule 7)

The first-timer has never opened Flinch, knows what an AI chatbot is, and has no statistics background. Every screen state in `shots/*.json` is scored at 1280×800 and 1024×700.

| # | Criterion | 2 | 1 | 0 | N/A allowed |
|---|---|---|---|---|---|
| R1 | What am I looking at | The tool, the data in view and the screen's job are clear without hovering | One of these is missing or needs a hover | Can't tell | no |
| R2 | Why it matters | One visible line says what this result tells you about rule consistency | Only in a tip or hover | Absent | screens with no result (dialogs, Settings, Home, Coach Examples) |
| R3 | What next / how back | A next action is visible, a way back exists, disabled actions say why | Next or back missing, or a disabled action unexplained | Dead end | no |
| R4 | Result with its limits | Every result has its pinned caveat in the same viewport shot | Present but in another shot, or vague | Missing | screens with no result |
| R5 | Every number with its source | Every number shows its count, n, formula or test beside it | Some numbers do | Bare numbers | screens with no number |

- **Below the bar** = any criterion scored 0, or a total under 80% of the applicable maximum (2 × the number of applicable criteria). The critic writes a reason for every N/A.
- **Shot rule:** scoring uses viewport shots only. A state whose results sit below the fold lists `scrollTo` selectors in its shot entry, and each selector produces another viewport shot, so every result appears in some viewport shot together with its caveat.
- **Shot set:** the baseline's 50 states, the baseline's "not capturable" list (now reachable through the fixture and route mocks), the no-key states, the splash stages, and (L6) the update card.
- **Driver:** `shoot.mjs` (T3), with G11 and G12 enforced.
- **Scorer:** a critic agent with a fresh context each round. It sees the screenshots and `manifest.json`, never the source, and writes `rubric/round-N.md` (state × size × R1–R5, total, applicable maximum, a reason for every score under 2).
- **Rounds:** fix, re-shoot everything, re-score everything, until 0 states are below the bar.

## 9. Evidence folder

- **Tracked** in `docs/plans/evidence/flinch-rebuild-2026-10-15/`, which already holds the baseline:
  - `index.md`, with a "Rebuild" section linking everything below
  - `gates/<lane>-<sha>.md`
  - `rubric/round-N.md`
  - `popup-audit/<sha>.md`
  - `route-coverage.md`
  - `voice/l5.md`, `voice/l6.md`, `voice/l7.md`
  - `verification.md`
  - `screenshots-final/<size>/`: final round only, after G12 passed
  - `upgrade-test.md`
- **Ignored** in `.omc/evidence/flinch-rebuild-2026-10-15/`: raw gate logs, intermediate rounds' shots and manifests, Playwright traces, server logs, temp DB copies, wheel listings.
- **Never in either**: an API key, a signing key, Brad's own `flinch.db`, any probe other than `example-probes.md`, or a raw `/api/probes/files` response.

## 10. Risks and mitigations

| Risk | Mitigation | Detection |
|---|---|---|
| Lanes conflict over generated `flinch/static/` | Lanes never commit it; the integrator rebuilds after each merge; `merge=ours` | G6 lane mode: `git diff --name-only <base>..HEAD -- flinch/static` is empty |
| Non-deterministic build (timestamp version, CRLF) | `version.name` = package version; `pollInterval: 0`; `flinch-ui/** text=auto eol=lf`, `*.png binary` | G6 integrator second build; T1 cross-platform check |
| Sidecar fails to start when `flinch/static/_app` is absent | B4 `check_dir=False` | `test_starts_without_app_dir` |
| Built UI missing from the wheel or the installer resources | A1 commits it; no ignore pattern matches | `test_wheel_contents` (wheel and `bundle.resources` globs) |
| A sensitive probe or local path reaches an artifact | Drivers run in a worktree; the fixture holds example probes only; G12 compares names and writes no responses | G12 refuses; `test_existing_db` checks probe names |
| Live-model states can't be captured without keys | Fixture rows plus route mocks; no key is ever used | `mocked` flags in the manifest |
| Keys written in plain text to `.env` on the desktop | The desktop path never calls `POST /api/settings/keys` | T10 Windows test (1) |
| IPC from the sidecar origin behaves unexpectedly (both directions unverified) | T10 tests (2)–(4); B6 only if needed | L4 gate file |
| F0 cookies are shared with every server on `127.0.0.1` (RFC 6265 §8.5). In browser mode, other local servers (any port) receive `flinch_tips`/`flinch_first` with each request. On the desktop the WebView2 jar is Flinch's alone. | Names prefixed `flinch_`; values are tip ids and a flag only. `SameSite=Strict` stays: the splash → sidecar hop is cross-site, so the cookie isn't sent on that request, but the page reads it through `document.cookie` | `coordinate.test.ts` value pattern and size |
| WebView2 drops the cookie between launches | localStorage fallback; tips then repeat (the baseline behaviour) | T10 Windows test (5) |
| Splash breaks under the real CSP | `splash-shot.mjs` serves `ui/` with the tauri.conf.json CSP | 0 `securitypolicyviolation` events |
| A running experiment lives inside the `/start`/`/resume` stream (app.py:2900-2940). A component-owned stream would stop it on navigation, a regression from v0.8.0, where only closing or reloading did. | Stream held in the module-level store `experiment-runs.ts`; K19 on Overview | T8 "run survives navigation" test |
| Update path untestable until the next release (v0.8.0 has no updater) | This release installs manually; `release.ps1` dry run; L6 can be reverted | T13 records; next release's update test |
| Old UI kept on upgrade if pyproject.toml doesn't change (`bootstrap/mod.rs:51-84`) | Version bump each release (`test_versions_match`, `releasing.md`) | T14 upgrade test |
| Copy slop from lint-only passes | T11 in main context with critic and cold-read | `--release` requires every pin `final`; `voice/l5.md` |
| Scope creep | Lane briefs cite a rule or problem per task; the critic rejects untraceable diffs | `git diff master --stat -- flinch/ src-tauri/ ':!flinch/static'` shows only B-list, L6 and L7 files |
| CSP blocks SvelteKit's inline bootstrap | `kit.csp` hash mode | G6 meta-CSP check; 0 console errors in shots |
| Scorecard labels contradict their inputs (problem 16) | Shown verbatim with the rule and K8 until Q1 is answered | Q1 asked before T9 |

## 11. Verification steps

1. `python scripts/dev/run-gates.py --lane release --integrator --release` on the `flinch-rebuild` head: G1–G6 and G8–G12 green, and G7 green on Windows. The gate file is committed.
2. Existing DB (1.3): G10 green. Optionally, Brad runs the app on a copy of his own `flinch.db`; only a pass/fail line is recorded.
3. No-key experience. The `no-key/*` entries in `shots/l1.json` and `shots/l4.json`, on an empty DB and on the fixture with provider env vars removed, assert:
   - the startup log line "keyword-only mode"
   - the first load lands on `#/settings`, and a reload does not
   - K1b is present
   - Send is disabled and names the provider
   - every non-model route in `v080-ui-routes.txt` is recorded 2xx
   - `verify-phase1.py` passes 3/3
4. Route coverage: `python scripts/dev/route-coverage.py` exits 0. Every `METHOD /path` line for the 101 v0.8.0 UI paths is recorded 2xx, except the two exempt ones (`/results`, problem 5; `/compliance`, problem 15). Output: `route-coverage.md`.
5. Rubric final round: 0 below the bar at both sizes. G8 `--release`: `FAIL 0 / SKIP 0`.
6. The architect writes `verification.md` against §4–§7, and the critic signs off.
7. Windows: T10's tests (1)–(5) including tip persistence, debug-build smoke, installer build, and the upgrade test in Brad's Sandbox or VM (T14).
8. Brad's explicit word before merge to master and before any release.

## 12. Open questions for Brad

- Q1 (baseline problem 16). The policy scorecard labels a should-refuse claim **"over"** when fewer than 20% of runs refused, and **"under"** at 20–80% (db.py:3143). For should-allow claims, anything below 80% compliance is **"under"** (db.py:3145). The labels read as reversed.
  - Options: leave the logic and show the rule and inputs beside every label (the plan's default); or fix the mapping in `db.py` with a test (backend change, added to the B-list).
  - Asked through AskUserQuestion before T9 starts; it does not block L0–L3.

## 13. ADR

- **Decision.**
  - Rebuild Flinch's UI as a SvelteKit 5 + Tailwind static app in `flinch-ui/`. The build is committed to `flinch/static/` by the integrator only, and FastAPI serves it behind the existing Tauri splash, with hash routing.
  - The backend and shell changes are the B-list: five small fixes and one conditional capability. Rule-6 first-time state lives in `127.0.0.1` cookies (F0), and the random sidecar port stays.
  - The old UI is replaced on the branch lane by lane.
  - Numbers read their inputs from existing payloads.
  - Experiment run streams live in a module-level store so navigation never stops a run.
  - Guided entry, caveats, terms and copy tests are written fresh in Pry's design language.
  - The signed updater is a separable last lane, with the update card on the splash: checked once the runtime is installed (`RuntimeStatus.installed`), within 3 s of splash start, and shown only when an update is found.
- **Drivers.** 1.3 compatibility; the offline, CSP-bound FastAPI distribution path (problem 10); verifiability with no key at two window sizes.
- **Alternatives considered.** A2 and A3; B2; C2; D2; E2; F1, F2 and F3. Reasons in §2. F1 (fixed port, iteration 2's B7) lost because it cites no baseline problem and, with no Host check, exposes the sidecar to DNS rebinding and cross-site body-less POSTs; a Host-check middleware would be backend work no rule requires.
- **Why chosen.**
  - Least backend surface: no route, schema or response change, and no new shell change outside L6.
  - The `pip install -e .`, wheel and installer paths work untouched.
  - Lanes share no generated files.
  - Every displayed number is computed by the backend or is one of two named count derivations.
  - The updater can be dropped by reverting one lane.
- **Consequences.**
  - Node 22 joins the dev toolchain; Python-only users still get the committed build.
  - Every merge carries a rebuild commit.
  - Classifier confidence stays invisible (not persisted; 1.3).
  - The repetitions field is gone because the backend never used it.
  - Tip-seen and first-launch state are `127.0.0.1` cookies that any local server on that host can read; they hold only tip ids and a flag.
  - Closing or reloading Flinch stops a running experiment, as in v0.8.0 (K19).
  - The scorecard is shown as-is until Q1 is answered.
  - The first in-app update can be tested only at the next release.
- **Follow-ups (of this plan).** Answer Q1. Record popup geometry at release as the reference for the next release's diff. Run the next release's in-app update test.
- **Not follow-ups of this plan.** Lessons, the lesson runner and sidebar, a shared UI package, a combined shell, and a free local model bootstrap. They belong to Pry's roadmap (handoff §3).

## 14. Changelog

Iteration 2 (from `architect-iter1`, A1–A17; `critic-iter1`, C1–C21).

- A1 BLOCKER, G6 nondeterminism: applied. `version.name` pinned, `pollInterval: 0`, `eol=lf`, integrator-mode porcelain check, T1 cross-platform check.
- A2, lanes commit `flinch/static`: applied as: lanes never commit it; integrator merge step; `merge=ours`.
- A3, random port resets rule-6 state: applied as: option (f) F1, B7 stable preferred port with fallback (T14). Superseded in iteration 3 by F0.
- A4, "changed by you" can't be built: applied. Marker dropped; K18 added.
- A5, repetitions estimate invented: applied. Input dropped; Review shows `/estimate` fields only.
- A6, min-p/max-|d| is a UI statistic: applied. Per-pair listing.
- A7, batch-conditions and probe-groups etc. missing: applied. Variants row, T7 acceptance, routes column.
- A8, `.env` plaintext fallback: applied. T10 key-save rules and Windows test (1).
- A9, update card invisible: applied. E1 synthesis in §2(e) and T13. Splash restyle stays in T10 (Architect proposed L6/L7); G7 is not needed for `ui/` bytes, so L4 stays runnable on Linux.
- A10, favicon path: applied. `/static/favicon.png` in `app.html`; G6 checks every local URL.
- A11, G12 response shape and paths: applied.
- A12, G10 route list undefined: applied. `v080-ui-routes.txt` from 7dc2b20.
- A13, wheel mechanism wrong: applied. A1 rationale corrected; `test_wheel_contents` checks the `bundle.resources` globs.
- A14, `/health` already 0.8.0: applied. Tests assert `/api/version`.
- A15, citation misses and K1 wording: applied. K1, K4, K12, outcome definitions, strategy success.
- A16, drop Q2, record Q1: applied. Q2 deleted; Q1 recorded as problem 16.
- A17, E2/B6 premise unverified: applied. Marked unverified; T10 tests (2)–(4).
- C1, G6 never passes: applied (as A1, plus porcelain).
- C2, lane conflicts: applied as: lanes build in the working tree, test, then restore; they don't build to a temp dir (that needs a configurable `STATIC_DIR`, a backend change).
- C3, batch-conditions dropped: applied (as A7).
- C4, `/compliance` vs §11.4: applied. Exemption; Principle 1 says "reachable".
- C5, `route-coverage.py` unowned: applied. T3 owns it.
- C6, rubric bar impossible with N/A: applied. 80% of applicable maximum; R2 may be N/A.
- C7, G10 list and seeds: applied. Fixture built by starting v0.8.0 once.
- C8, wizard repetitions: applied (as A5).
- C9, cost estimates uncaveated: applied. K16.
- C10, K10 wrong: applied. Mann-Whitney-only correction.
- C11, min-p/max-|d|: applied (as A6).
- C12, A3/C2 rationales: applied. Both corrected; A3's real pro (fixed origin) stated.
- C13, B6 has no problem number: applied as: B6 stays conditional; T10 records problem 17 only if the Windows test confirms it (it can't be verified on Linux now).
- C14, Q2 invented: applied. Deleted.
- C15, G1 counts inconsistent: applied. Per-lane node IDs in `gates.json`.
- C16, G12 shape: applied (as A11).
- C17, lane ownership: applied. L0 owns nav, stubs, session layout and aggregators; `shots/<lane>.json`; `api/<lane>.ts`; per-lane pin status replaces `PENDING_LANES`; T7 after T6; L4 tips/glossary; `tailwind.config.js` at the root.
- C18, `/_app` crash and favicon: applied. `check_dir=False` with a test; favicon path.
- C19, fixture lacks claim links and AI ratings: applied.
- C20, `sk-` regex: applied.
- C21, G8 cadence: applied. Every lane from T3, per-lane tips.
- C-missing: post-merge rebuild step added (§7). K17 publication pushback caveat added. Shot rule added (§8). `TipDef.route` added (T2/T3).
- C-suggestions: ruff version pinned in `gates.json`; stray "Version:" removed; narrative "any run" fixed; repetitions dropped; Brad provides the VM (T15).
- Rejected: the Architect's C1 steelman (show re-run keyword-scan marker counts per run) is not a finding and is rejected. It would show the scan's view of a label the judge or a person may have set, which is misleading under rule 1; reason in §2(c).

Iteration 3 (from `architect-iter2`, A18–A24 plus partials; `critic-iter2`, C22–C29 plus partials).

- A3 partial / A20, B7 placement and Python-side bind retry: moot. B7 and T14 deleted for F0 cookies (C22); old T15 is now T14.
- A8 partial, desktop detection: applied. `?shell=desktop` from `splash.js:114` stored in sessionStorage; desktop never posts `/api/settings/keys`; B6 stays conditional.
- A9 partial, two time budgets: applied. One 3 s budget from splash start.
- A18, `eol=lf` corrupts PNG: applied. `text=auto eol=lf`, `*.png binary`.
- A19, lane G8/shots ran on the old build: applied. Lane order build → serving test → G8 → shots → route-coverage → restore in `finally`; diff from `merge-base`.
- A21, K17 false with a model filter: applied. K17 only on unfiltered exports.
- A22, tips on param routes and in dialogs: applied. `TipDef.params` (from `ids.json`) and `open`.
- A23, L6 edits L4's files after pins are final: applied. `pins/l6.ts`; `ui/` passes L4 → L6 after L5.
- A24, card during first-run bootstrap: applied with the wrong gate; corrected in iteration 4 (A25).
- Architect B7 security antithesis: applied as: F1 rejected on that ground; no Origin/Host middleware added.
- Architect splash CSP gap: applied. `splash-shot.mjs` serves the tauri.conf.json CSP and fails on violations; stub uses `events.rs` stage names.
- C7 partial, route counts and `/results` in G10: applied. "101 unique paths", pair count in the file header; G10 skips `/results`.
- C15 partial, T0 tests that can't exist yet: applied. `pytest_expected` keyed by task; `test_wheel_contents` moved to T1; package.json check skipped before T1.
- TipDef partial, concrete URLs: applied (as A22).
- C13 note, problem 17 at baseline: applied. T10 test (1) also runs on a `v0.8.0-desktop` install.
- C22, B7 without a baseline problem; cookie option skipped: applied. F0 chosen after verifying cross-port cookie reads in Chromium; Windows confirmation is T10 test (5).
- C23, DNS rebinding with a fixed port: applied as: the fixed port is gone; the rationale is in §2(f) and the ADR. Browser mode's baseline exposure is out of scope.
- C24, estimate before Create: applied. Review lists choices; `/estimate` and K16 on Overview after Create, before Start.
- C25, `/progress` isn't SSE: applied as: poll `GET /progress` every 2 s while running, three mocked poll responses, problem 18 recorded. `sse.ts` keeps the experiment `/start`/`/resume` streams, because those are SSE and drive the run (app.py:2900-2940), so dropping them as suggested would stop experiments.
- C26, lane shots need the lane build: applied (as A19).
- C27, PNG attributes: applied (as A18).
- C28, `.env` path text: applied. The directory containing `flinch` (`site-packages` when installed).
- C29, failed merge path: applied. Reset to the pre-merge head, fix on the lane, merge again (command corrected in iteration 4).
- C-suggestions: Clear All phrase `DELETE_ALL_DATA` (the value app.py:2531 requires); G10 10 s timeouts; `/api/version` in the sidebar row; T8 Analysis DOM check against `readouts/l3.ts`; G8 FAILs on an empty tip set, and L0 ships ≥ 1 tip.
- Added from code while revising: the leave-the-screen run caveat for experiments (app.py:2900-2940), §10 rows for cookie sharing and WebView2 persistence.

Iteration 4 (final improvements, from `critic-iter3` C30–C32 and `architect-iter3` A25–A28).

- C30 / A26, a component-owned run stream would stop experiments on navigation: applied. `api/experiment-runs.ts` store (L3), never closed on destroy. K19 "Closing or reloading Flinch stops a running experiment" added. §10 row rewritten. T8 navigation test added.
- C31, `/resume-conditions` missing from `sse.ts`: applied (app.py:3296).
- C32, `ORIG_HEAD~1` resets one commit too far: applied. `git reset --hard ORIG_HEAD` (or `HEAD~2`); the iteration-3 line reworded.
- A25, `runtime_status.ready` keeps the card off normal launches: applied. Gate on `RuntimeStatus.installed` = `is_runtime_ready()` (bootstrap/mod.rs:39-45), added in L6's `lib.rs` change; two stubbed-launch acceptances.
- A27, `/start` without a body likely returns 422: applied. T8 sends `{}` and expects 200 `text/event-stream`. Recorded as problem 19 from code, unverified at runtime.
- A28, data-only SSE frames untested: applied. `sse.test.ts` covers app.py:2914, :2939, :2960.
- Critic non-blocking: polling stops with "not running" when status is `running` but no stream is held; the F0 risk row says plainly that other `127.0.0.1` servers receive the cookies in browser mode; T10 test (5) records the WebView2 version; the C29 line reworded.
- Architect F0 notes: registry-size test (< 3,000 bytes, localStorage overflow); `SameSite=Strict` kept with the reason in §10; browser vs desktop cookie jars stated.
- Not taken: the Critic's open question on `run_experiment` worker tasks outliving a cancelled stream (runner.py:515). That is baseline backend behaviour, and the store-level stream stops navigation from triggering it, so no backend change is added.
