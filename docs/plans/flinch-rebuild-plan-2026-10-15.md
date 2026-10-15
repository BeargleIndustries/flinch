# Flinch UI rebuild: work plan

- Date: 2026-10-15
- Status: **pending approval**
- Plan branch: `flinch-rebuild-plan`. Build branch after approval: `flinch-rebuild`, cut from `master`; each lane is a git worktree off it.
- Mode: ralplan consensus, SHORT.
- Inputs: `docs/plans/flinch-rebuild-pre-read-2026-10-15.md` (§1 scope is binding), `docs/plans/flinch-rebuild-input-2026-10-15.md` (Rounds 0 and 1), `docs/plans/handoff-pry-parity-2026-10-15.md` (§2, §4, §5, §8), `docs/plans/pry-design-reference.md`, `docs/plans/evidence/flinch-rebuild-2026-10-15/index.md` (baseline; "problem N" below means its numbered list), `.../api-routes.md`, `CLAUDE.md`, `pyproject.toml`, `src-tauri/tauri.conf.json`, `ui/splash.js`, `src-tauri/src/sidecar.rs`, `flinch/app.py`, `scripts/bundle-resources.py`, `scripts/verify-phase1.py`, `tests/test_experiment_pipeline.py`.
- Decision record: input file Round 0 (scope) and Round 1: **1.1** SvelteKit 5 (runes) + Tailwind, static build, inside the existing Tauri shell, nothing shared with Pry's code; **1.2** updater ships as a separable final lane; **1.3** schema untouched, existing `flinch.db` opens unchanged, an existing DB is a gate fixture.

## 1. Requirements summary

In Brad's words (pre-read §1): "this is a REBUILD... there is nothing sacred in the UI, just the underlining features"; "there's no rolling in Pry features"; "lessons from Pry have nothing to do with Flinch. stay in scope."; "STOP INVENTING TASKS. stay on spec."

**Delivers**
- A new Flinch UI in SvelteKit 5 + Tailwind (1.1) that replaces all of `flinch/static/` (10,338 lines of vanilla JS/HTML) and is served by FastAPI exactly as today: the splash navigates to the sidecar URL (`ui/splash.js:114`), FastAPI serves `/` and `/static` (`flinch/app.py:131`, `:244-246`), and the wheel and installer carry `flinch/static/**` (`tauri.conf.json` `bundle.resources`, `scripts/bundle-resources.py:125-155`).
- Every v0.8.0 feature stays reachable. The API and the Python side are the feature set (`api-routes.md`, 154 routes). No route, table or column changes (1.3).
- Handoff §2 rules 1, 2, 4, 6, 7, 8, 9, 10 applied to Flinch's existing surfaces. Rules 3 and 5 are out.
- The §4 workflow: gates kept green per lane, an evidence folder, rubric rounds from screenshots, lanes in worktrees.
- The signed updater as the last lane, droppable (1.2).

**Out of scope**: lessons, the lesson runner or sidebar, a shared UI package, a combined shell, a free local model bootstrap, any Pry feature, the research pipeline (pairwise scripts), new features, new UI surfaces for routes the v0.8.0 UI never called, and backend work beyond §7's B-list.

## 2. RALPLAN-DR summary

**Principles**
1. **The API is the feature set.** Every route a v0.8.0 surface called is called by a rebuilt screen. No route, table or column changes (1.3).
2. **Reality wins in every number.** Each number on screen is one the backend already computes, or a ratio of counts in the same payload, and its inputs sit beside it. The UI adds no statistics of its own.
3. **Spec only.** Every task traces to a §2 rule, a §4 workflow step, a §5 standing rule, or a numbered baseline problem. Anything else is rejected at review.
4. **Separable lanes.** A lane lands without editing another lane's files. The branch is green after every lane. L6 can be reverted without touching anything else.
5. **Copy is code.** Every visible string is extracted and tested, and it goes through brad-voice in main context before release.

**Decision drivers (top 3)**
1. Compatibility (1.3): an existing v0.8.0 DB opens unchanged and every feature can be exercised on it.
2. Distribution path: FastAPI serves the UI from the wheel, offline, with the CSP's `script-src 'self'` and no CDN (problem 10).
3. Verifiability with no API key: the rubric, popup audit and gates run at 1280×800 and 1024×700 from example probes and fixture data only.

**Options**

(a) Where the built bundle lives and how it is served
- **A1, chosen: build committed to `flinch/static/`, Vite dev server for development only.** `adapter-static` writes into `flinch/static/`. In dev, Vite serves on `127.0.0.1:5180` (strictPort) and proxies `/api`, `/health` and `/static` to FastAPI on `:8000`. Pros: `pip install -e .` (README:79) still gives a working UI without Node. The wheel, the Tauri resources glob and `bundle-resources.py` need no change. Hatchling honours `.gitignore`, so committed output lands in the wheel by default. Cons: generated files show up in diffs, and the committed build can go stale. G6 catches staleness by rebuilding and diffing.
- A2: build gitignored, produced by `bundle-resources.py`, and added to the wheel through `[tool.hatch.build] artifacts`. Pros: clean diffs. Cons: README's `pip install -e .` users get no UI without Node. Packaging and `bundle-resources.py` change. A missing build is silent until runtime.
- A3, invalidated: Tauri `frontendDist` serves the app. The shell deliberately leaves the Tauri origin for the sidecar URL (`ui/splash.js:114`), and `python -m flinch.app` in a browser is a supported mode (CLAUDE.md "Running"). Moving the UI would need CORS and IPC rework in the shell and would break browser use. That contradicts 1.1's "inside the existing Tauri shell" and 1.3's "UI-only".
- Consequence of A1: SvelteKit emits root-relative `/_app/...` while FastAPI mounts only `/static`, so `flinch/app.py` gets one mount (B4 in §7). Every other path works under the existing mount.

(b) How the old UI is replaced
- **B1, chosen: replace on the branch, lane by lane.** T1 deletes the vanilla files. Screens arrive lane by lane on `flinch-rebuild`. The parity reference is a `git worktree` of `7dc2b20` run on another port, plus the 50 baseline screenshots. Pros: no second static mount, the CDN dependency is gone from day one, the copy tests see one UI. Cons: the branch has missing screens until L4 lands. That is acceptable because nothing merges to master before every lane is done and Brad says so (§5).
- B2: strangler pattern, with the old UI at `/legacy/` until the last screen lands. Pros: the old screens stay clickable on the branch. Cons: needs a second static mount (backend work no rule justifies), keeps the CDN dependency alive (problem 10), the old UI's absolute `/static/...` paths need rewriting, and the copy tests would scan two UIs. Its only benefit, side-by-side parity, B1's 7dc2b20 worktree already gives.

(c) Where "every number shows what it is made of" gets its inputs
- **C1, chosen: the UI reads the inputs from the payloads that already exist.** The §5 audit found the counts behind every displayed number in the same response (for example `consistent_count`/`total_groups` at db.py:1594-1597, `refused`/`total` at db.py:2875-2889, `n1`/`n2` at stats.py:254-255 and :450-451, `n_raters`/`n_items` at stats.py:292, :319). The two places where the UI derives an input are ratios of payload counts (agreement count from `results[].disagreement`, app.py:1779-1800; the FDR family size = the number of p-values in the `corrections` object, stats.py:540-589).
- C2: new read-only aggregate endpoints. 1.3 forbids schema changes, not read-only routes, so C2 is allowed. It is not needed: no displayed number lacks its inputs in an existing payload. The one number whose inputs are missing everywhere is the classifier's confidence. `_keyword_classify` computes it (classifier.py:64-89), `classify` discards it (:54-60), and `runs` has no column for it (db.py:44-61). Showing it would need a schema change, which 1.3 forbids, so it is not shown and caveat K1 explains how a label is decided. C2 would add backend surface with no rule requiring it.

(d) Client routing
- **D1, chosen: SvelteKit hash router** (`kit.router.type: 'hash'`). FastAPI only has to serve `/`, so reloads and deep links work with no backend route.
- D2: path router plus a FastAPI catch-all that returns `index.html`. It needs a backend route no rule requires and risks shadowing `/api/*` 404s.

(e) Where the update card lives (L6 only)
- **E1, chosen: on the splash/loading screen** (`ui/index.html`, Tauri-local origin). That page already has IPC (capability `windows: ["main"]`) and runs on every launch before the sidecar URL loads. No IPC is granted to the `127.0.0.1:*` origin. The Settings screen shows the version and says when updates are checked (draft; brad-voice pass).
- E2: an in-app card on the FastAPI-served page (Pry's shape). It needs a capability with `remote.urls: ["http://127.0.0.1:*"]` plus updater and process permissions. Any local process listening on a 127.0.0.1 port would then gain those permissions if the webview were navigated there.

## 3. Gate set (T0, the plan's first task)

Install: `pip install -e ".[dev,experiment]"`, then `npm --prefix flinch-ui ci`. Node 22 and Python 3.11+.

| # | Gate | Command | Pass condition | Applies to |
|---|---|---|---|---|
| G1 | Python tests | `python -m pytest -q` | ≥ 6 tests collected, 0 failed, 0 errors. The suite includes the repaired `tests/test_experiment_pipeline.py` (problem 1), `tests/test_existing_db.py` (G10), `tests/test_version.py`, `tests/test_static_serving.py`, `tests/test_load_defaults.py`, `tests/test_wheel_contents.py` | every lane |
| G2 | ruff ratchet | `ruff check flinch --select F821,E9` and `ruff check flinch --statistics` | First command: 0 errors (no NameErrors or syntax errors; problem 2). Second: total ≤ `ruff_total` in `scripts/dev/gates.json`. That value starts at 539 (541 at baseline minus the 2 F821). It may only be lowered, by the lane that lowered the count, and never raised. No mass-fixing of the other 539: that is backend work outside §7. | every lane |
| G3 | Sidecar contract | `python scripts/verify-phase1.py` | `ALL CASES PASSED` (3/3) | every lane |
| G4 | UI types | `npm --prefix flinch-ui run check` (`svelte-kit sync && svelte-check --fail-on-warnings`) | 0 errors, 0 warnings | from T1 |
| G5 | UI tests | `npm --prefix flinch-ui test` (`svelte-kit sync && vitest run`) | 0 failed. Includes the copy suite: visible-strings, caveat pins, overstatement closures, banned model verbs, bare numbers (§7 T3) | from T1 |
| G6 | UI build | `npm --prefix flinch-ui run build && git diff --exit-code -- flinch/static` | Build exits 0 and the committed `flinch/static/` matches the fresh build byte for byte. `test_static_serving.py` then checks: `/` returns the built `index.html`; every `/_app/*` and `/static/*` asset it references returns 200; the HTML contains no `http(s)://` origin; a meta CSP with `script-src 'self'` plus hashes is present; `/static/favicon.png` returns 200 (problem 14) | from T1 |
| G7 | Shell | `cargo check --manifest-path src-tauri/Cargo.toml` and `cargo test --manifest-path src-tauri/Cargo.toml` | Exit 0. The platform is recorded. If the Linux Tauri system libraries are missing, it runs on Windows. It is never marked passed without a run. | any lane touching `src-tauri/` or `ui/` (L4 splash, L6, L7) |
| G8 | Popup audit | `node scripts/dev/popup-audit.mjs --sizes 1280x800,1024x700 --a11y` | Prints `FAIL 0 / SKIP 0` and exits 0. axe-core reports 0 serious and 0 critical violations | from T3; release-blocking at L5 |
| G9 | Rubric | latest `rubric/round-N.md` in the tracked evidence folder | 0 screens below the bar at both sizes (§8) | L5 exit |
| G10 | Existing DB (1.3) | part of G1: `tests/test_existing_db.py` | Copies `tests/fixtures/flinch-v0.8.0.db` to a temp dir and records every `sqlite_master.sql` and each table's row count. Starts the app on the copy (`--db-path`) and calls every GET route the rebuilt UI calls, with the fixture's ids. All return 200. Then it compares the schema SQL and row counts: identical, so the startup migrations at db.py:488-580 are no-ops on a v0.8.0 DB. | every lane |
| G11 | No external origin | inside `scripts/dev/shoot.mjs` and `popup-audit.mjs` | Any request to an origin other than `127.0.0.1` fails the run (problem 10) | from T3 |
| G12 | Sensitive-probe guard | inside both drivers | The driver refuses to start unless `GET /api/probes/files` returns exactly `["example-probes.md"]` and every probe name in the DB is in `flinch/probes/example-probes.md` or the fixture | from T3 |

**Fixture (G10).** `tests/fixtures/make_v080_fixture.py` runs against the v0.8.0 package (`git worktree add ../flinch-v080 7dc2b20`, then `PYTHONPATH=../flinch-v080`). It writes `tests/fixtures/flinch-v0.8.0.db` using only `flinch/db.py` CRUD functions and `ExperimentAnalyzer.full_analysis` (seeded, stats.py:71, :86). Contents:
- the 4 `example-probes.md` probes
- 2 sessions whose runs cover all four outcomes, including a coach suggestion, a manual pushback, a classification override, annotations with pattern tags, and run turns
- 1 stat run with 10 iterations
- a variant group with runs, a narrative sequence with whittling runs, a saved comparison, a snapshot, a scorecard snapshot, a publication export
- an experiment with 3 conditions, prompts, responses, response metrics and analysis results
- 3 seeded coach examples

Response texts are synthetic and say so in their first line. The binary is committed, with `-text` in `.gitattributes`. G10 never regenerates it.

**Recording without CI.** `python scripts/dev/run-gates.py --lane <L> [--release]` runs G1–G6, plus G7 when `src-tauri/` or `ui/` changed since the lane's base. It writes `docs/plans/evidence/flinch-rebuild-2026-10-15/gates/<lane>-<shortsha>.md` (each command, exit code, counts, platform, and Python/Node/cargo versions) and raw logs to `.omc/evidence/flinch-rebuild-2026-10-15/gates/`. A skipped gate is written as `SKIPPED: <reason>`, never as passed. A lane is done when its gate file at the lane head is all green. `--release` also requires G8, G9 and `PENDING_LANES` empty (§7 T3).

## 4. Surface map

One row per row of the baseline surface inventory (evidence `index.md`). Rules: **1** numbers, **2** caveats, **4** terms, **6** guided entry. All rebuilt routes are hash routes (D1).

| Baseline surface (renderer) | Decision | Rebuilt screen | Rules | Numbers shown ← inputs (source) |
|---|---|---|---|---|
| Sidebar header, session select, New/Delete (`render.js:24 renderSessionSelect`, `api.js handleSessionChange`) | keep. Problem 8 goes away. | Shell sidebar: session switcher | 4 (session), 6 | none |
| Load Defaults / Import File / + add (`api.js loadDefaultProbes`, `showImportFileModal`, `app.js toggleAddProbeForm`) | keep. Import and add become dialogs. B5 fixes problem 7. | Sidebar probe panel + Import and Add Probe dialogs (narrative fields kept) | 4 (probe, domain), 6 | none |
| PROBES list, bulk select, search, domain filter, custom prompt (`render.js:47`, `:221`) | keep | Sidebar probe panel | 4, 6 | probe count shown/total ← client filter of `GET /api/probes` |
| Run history + stats (`render.js:931 renderRunHistory`, `:225 renderStats`) | merge into Session screen | `#/session/:id`, History panel | 1, 2, 4 | per outcome: count of N runs, for initial, final and outcome (outcome = final if pushback, else initial) ← `GET /api/sessions/{id}/stats` (db.py:1604-1631) |
| Nav pills, EXTRAS (index.html) | keep | Shell nav | 6 | none |
| Red no-key banner (`api.js checkOllamaStatus`) | merge into one no-key notice | Shell notice linking to Settings; says what works without a key | 2 (K1b), 6 | count of providers set ← `GET /api/settings/keys` `is_set` |
| Home (`render.js:365 renderIdleState`, no session) | keep | `#/` Home: what each tool measures | 4, 6 | none |
| Session idle, Run All, Save/Compare Baseline (`render.js:365`) | merge | `#/session/:id` | 4, 6 | runs so far ← stats payload |
| Probe selected / Send (`render.js:483`) | keep | `#/session/:id` probe state. Send is disabled with the reason when the target's provider has no key, instead of a 404 toast (`/api/models` `available`, app.py:1524) | 2, 6 | none |
| Awaiting / Response / Pushback decision / sent: thread, coach suggestion, manual pushback, annotations, export (`render.js:520`, `:559`, `:860`, `:886`, `:895`, `:699`, `:749`) | keep | `#/session/:id/run/:runId` | 1, 2, 4, 6 | outcome label ← `initial_/final_classification` (classifier.py:47-60). Coach confidence 0–1 ← `coach_suggestion.confidence`: coach model's self-report (coach.py:74), 0.5 when missing (coach.py:163). Turn count ← `GET /api/runs/{id}/turns` |
| Classification dropdown (`components.js showClassificationDropdown`) | keep | Override control on the run screen, marked "changed by you" when it differs from the classifier's label | 2, 4 | none |
| Batch progress (`render.js:1015`) | keep | `#/session/:id/batch` (LoadingScreen pattern, cancel) | 1, 6 | completed of total ← SSE `POST /api/sessions/{id}/batch` (app.py:540); `POST /api/batch/{id}/cancel` |
| New Session modal incl. picker and local coach (`app.js showNewSessionModal`) | keep as a dialog that scrolls inside the viewport (problem 9) | New Session dialog | 4 (coach profile, coach backend), 6 | probes selected of total |
| Import File modal (`api.js showImportFileModal`) | keep | Import dialog | 6 | none |
| API Keys modal (`settings.js`) **and** Settings view (`render.js:4499`) | **merge** (problem 11) | `#/settings`. One key form. In Tauri: validate → `POST /api/settings/set-key` → `invoke('set_api_key')` (settings.js:136-183). In a browser: `POST /api/settings/keys`. Plus test key, clear, Ollama URL + test, default coach. First launch with no keys lands here once (rule 6) | 2, 4, 6 | none |
| Keyboard Shortcuts overlay (`shortcuts.js`) | keep | Shortcuts dialog (same keys) | 6 | none |
| Error toast (`components.js showError`) | keep | Toast; native `prompt()`/`confirm()` replaced by dialogs (problem 12) | 6 | none |
| Multi-Model Comparison picker, results, history (`render.js:1135`, `:1298`, `:1292`) | keep | `#/compare`, `#/compare/:id` | 1, 2, 4, 6 | agreement % = probes where every model's label matches ÷ probes (app.py:1779-1800), shown as "k of n probes"; session-vs-session: ÷ probes present in all sessions (app.py:1677-1685, `probes_in_all_sessions`) |
| Legacy Compare Sessions modal (`render.js:1450`) | **drop** (dead, problem 13). Session-vs-session compare stays in `#/compare` | none | none | none |
| Narrative Momentum: form, cards, conversation, threshold, timeline, cross-probe, strategy (`render.js:3834-4137`) | keep | `#/session/:id/narrative` | 1, 2, 4, 6 | threshold = fewest warm-up turns with `threshold_found` ← whittling (db.py:2426); per-turn labels (db.py:2436); strategy success = sequences ending complied or collapsed ÷ sequences, plus average threshold (db.py:2466-2478); cross-probe thresholds (db.py:2446); batch estimate (app.py:2162) |
| Framing Variants: Edit Groups / Results, AI-assisted / manual (`render.js:1473-1894`) | keep | `#/variants` (Edit), `#/session/:id/variants` (Results) | 1, 2, 4, 6 | consistency score = groups where all variants share a label ÷ groups with ≥2 variant runs, latest run per probe (db.py:1530-1597) |
| Statistical Analysis (`render.js:4662`) | keep | `#/session/:id/stat` | 1, 2, 4, 6 | per probe × model: refused of N iterations (`consistency_rate` = refused ÷ total, db.py:2863-2889) and the four outcome counts (render.js:4751-4792); repeat count |
| Dashboard Overview: tiles, export all, clear all, filters, detail (`render.js:2248`, `:2499`, `:2538`, `:2654`, `:2722`) | keep. Clear-all becomes a typed-confirm dialog | `#/dashboard` | 1, 6 | counts ← `GET /api/dashboard/stats` (db.py:2605); per-item agreement and run counts as above |
| Policy Scorecard (`render.js:4823`) | keep | `#/dashboard/scorecard` | 1, 2, 4 | per model × claim: refused of total = `refused_rate`; label consistent/over/under by the fixed rule at db.py:3140-3147, shown verbatim; per-model counts (db.py:3160-3165) |
| Publication Export + themes (`render.js:4945`, `:5086`) | keep | `#/dashboard/publication` | 1, 2 | consistency-matrix cells = refused ÷ total from stat runs (publication.py:246-262); pushback summary success = collapsed or complied (publication.py:318-326). The preview is backend output, shown as generated (open question Q2) |
| Policy Claims Browser + probe–claim linking (`render.js:3550`, `api.js:950-957`) | keep | `#/policies` | 2 (K12), 4 | none |
| Compliance scorecard (`render.js:3615`) | **drop renderer** (dead, problem 15). `GET /api/sessions/{id}/compliance` stays API-only, as it was at baseline | none | none | none |
| Coach Examples (`render.js:968`) | keep. Native-prompt edit becomes a dialog | `#/coach-examples` | 4 (pattern, move) | none |
| Regression Snapshots browser + diff (`render.js:3678`, `:3733`) | keep. The name is entered in a dialog | `#/session/:id/snapshots` | 1, 2, 4 | changed/unchanged counts; per-probe improved/regressed/changed by the fixed rank refused > negotiated > collapsed > complied (app.py:880-925) |
| Experiments list (`experiment.js:174-246`) | keep | `#/experiments` | 4, 6 | conditions count, status |
| New Experiment wizard (`experiment.js:247-439`) | keep. Problem 4 goes away: posts `CreateExperimentRequest` (models.py:250-257, `conditions[].label`, non-empty `system_prompt` per models.py:213-217, `model_ids`), reads `{experiment, conditions}`, then adds prompts from chosen probes via `POST /api/experiments/{id}/prompts` (app.py:2837) | `#/experiments/new` | 4 (condition), 6 | estimated trials = conditions × models × prompts × repetitions ← wizard inputs; `POST .../estimate` (app.py:2884) when created |
| Experiment dashboard (`experiment.js:440`) | merge into one Experiment screen. Problem 6 goes away: reads `{experiment, conditions, progress}` (app.py:2794-2802) | `#/experiments/:id` Overview tab | 1, 6 | progress completed of total per condition ← `progress` + SSE `/progress` (app.py:2945) |
| Results / Statistical Analysis / Export (`experiment.js:551`, `:641`, `:736`) | merge as tabs. Problem 5 goes away: `/responses` (app.py:3053) | `#/experiments/:id` Responses, Analysis, Export tabs | 1, 2, 4 | win rate = wins ÷ rankings per condition (stats.py:108-197); Cohen's d + bootstrap 95% CI + Student t p + n1/n2 (stats.py:199-259); Mann-Whitney U, p, rank-biserial, n1/n2 (stats.py:409-458); Wilcoxon W, p, pairs, median diff (stats.py:460-538); p raw / Bonferroni / FDR over all nonparametric p-values (stats.py:540-589); Krippendorff's alpha with raters and items (stats.py:261-323); power with n = completed ÷ 3 (stats.py:362-392, :710). Export: csv/jsonl (app.py:3101), Prolific (app.py:2983, :2995), preregistration (app.py:3120), report (app.py:3039), analysis CSV (app.py:3025) |
| Condition Comparison (`render.js:1898-2185`) | merge into the Experiment screen | `#/experiments/:id` Conditions tab | 1, 2, 4 | "compliance rate" = (complied + negotiated) ÷ completed responses (db.py:3800-3805), shown with the counts; metric mean, SD and n (db.py:3816-3826); per-metric smallest FDR p and largest \|d\| across pairs (render.js:2058-2075) |
| Turn detail modal (`api.js viewRun`) | merge | Turn list on the run screen | 4 | turn number |

Routes the v0.8.0 UI never called (for example `/api/sessions/{id}/export/summary`, `/api/experiments/{id}/rate`, `/prompts/import-hh`, `/human-evals/import`, strategy CRUD writes, `/api/stat-runs/{id}/distribution`) stay API-only. §11 step 4's coverage table lists them.

## 5. Caveat list (rule 2)

Every phrase is a draft and goes through the brad-voice pass in L5. `caveats.test.ts` pins the final phrase to the component file that renders the result. `shoot.mjs` checks "beside" in the DOM: each `[data-result=<id>]` has a visible `[data-caveat=<id>]` in the same `<section>`, inside the viewport with the result, at both sizes.

| ID | Draft phrase (draft; brad-voice pass) | Source in code | Sits beside |
|---|---|---|---|
| K1 | "This label comes from a keyword scan. A model judges the ones the scan can't place. Either can be wrong, and you can change it." | classifier.py:47-60, :64-89 | run screen, history, stat runs, compare, variants results, narrative turns, experiment responses |
| K1b | "No judge model is set up, so labels come from the keyword scan alone. A short reply it can't place is labelled complied." | classifier.py:57-60 | no-key notice, run screen when no key |
| K2 | "A rate from {n} runs is a rate from {n} runs." | db.py:2875 | stat analysis, scorecard, session stats, compare, condition rates |
| K3 | "A refusal that held after one pushback might not hold after two." | runner.py:165-230 (`send_pushback`, `continue_pushback`); playbook.md:10-11 | final classification on the run screen, session stats "final" |
| K4 | "A refusal can come from the provider's product filter, not the model." | target.py (provider APIs) | run screen, compare, scorecard |
| K5 | "The coach's confidence is the coach model's own guess." | coach.py:74, :163 | coach suggestion |
| K6 | "Each variant counts only its latest run in this session." | db.py:1550-1555 | variants results |
| K7 | "Improved means closer to a refusal. That fits probes that should be refused, not ones that should be answered." | app.py:899-909 | snapshot diff |
| K8 | "Consistent, over and under come from fixed cut-offs (80% and 20%). They are settings, not a test." | db.py:3142-3147 | scorecard |
| K9 | "This compliance rate counts negotiated replies as compliance." | db.py:3804 | experiment Conditions tab |
| K10 | "p-values are corrected across all {k} tests (Benjamini-Hochberg FDR). Bonferroni is shown too." | stats.py:540-589 | experiment Analysis, Conditions |
| K11 | "Hedging, confidence and evasion are counts of listed phrases, not judgements of meaning." | lexical.py:41-66, :255-263 | Conditions metrics table |
| K12 | "Claim text is Flinch's summary of the provider's policy, not a quote." | seeds/policies.py:3 | policy browser, scorecard |
| K13 | "Power here assumes an even three-way split of responses." | stats.py:710 | Analysis power |
| K14 | "AI raters are models ranking blinded replies. Agreement says they agree, not that they are right." | rater.py:31-60; stats.py:261 | Analysis win rates, alpha |
| K15 | "A threshold from one run can land somewhere else on the next." | db.py:2426; sequence_runs.threshold_found (db.py:211-220) | narrative threshold, cross-probe |

## 6. Glossary term list (rule 4)

Each term keeps its real name and gets a plain-word hover (`Term.svelte` + `glossary.ts`). Definitions are draft (brad-voice pass). The playbook's long names (playbook.md:8-13, e.g. "Soft Refusal (collapsed)") appear in the hover. The outcome names stay as stored.

| Term | Defined in |
|---|---|
| probe; domain; narrative probe (opening/target) | db.py:18-29, :1005-1016; app.py `CreateProbeRequest` |
| session; run; target model | models.py:34-66; db.py:31-61 |
| refused, collapsed, negotiated, complied (the four outcomes) | models.py:6-10; classifier.py:87-92; playbook.md:6-13 |
| initial vs final classification; override | db.py:44-61; app.py:432 |
| keyword-only mode; judge model | classifier.py:47-60; startup log (evidence index "No-key experience") |
| pushback; pushback move; the seven moves: specificity challenge, equivalence probe, projection check, contradiction mirror, category reductio, reality anchor, minimal pressure | models.py:17-24; coach.py:6-40; playbook.md:35-50 |
| coach; coach profile; coach backend; coach example; promote to example; pattern detected | coach.py:44-76; db.py:63-84; seed.py; app.py:462 |
| annotation; finding; pattern tag | db.py:105-114; app.py:707-723 |
| batch | app.py:540-700 |
| multi-model compare; agreement | app.py:1689-1800 |
| variant group; framing variant; baseline variant; consistency score | db.py:115-122, :1324-1400, :1530-1597; `flinch/variants/*.md` |
| stat run; iteration; consistency rate | db.py:247-270, :2863-2889 |
| narrative momentum; sequence; warm-up turn; strategy; whittling; threshold | db.py:168-232, :2426-2478; `flinch/strategies/default-strategies.md` |
| snapshot (shown as "baseline"); regression diff | db.py:123-131; app.py:837-925 |
| policy claim; expected behavior; severity; enforcement (consistent/over/under) | db.py:132-146, :3083-3165; seeds/policies.py |
| scorecard; publication export; theme | app.py:2614-2758; publication.py:185-399; `flinch/themes/presets.md` |
| experiment; condition; system prompt; prompt; response; repetitions | models.py:213-257; db.py:323-386 |
| MTLD; TTR; Honoré's statistic; Flesch-Kincaid grade; Gunning fog; hedging/confidence/evasion ratio; subjectivity; polarity | lexical.py:181, :189, :198, :41-66, :255-263; metrics.py:19-41 |
| Cohen's d; bootstrap confidence interval; t-test | stats.py:57-100, :199-259 |
| Mann-Whitney U; rank-biserial; Wilcoxon signed-rank | stats.py:49-56, :409-538 |
| p-value; Bonferroni; FDR (Benjamini-Hochberg) | stats.py:540-589 |
| Krippendorff's alpha; AI rater; win rate; blinding | stats.py:108-197, :261-323; rater.py:31-60 |
| power analysis | stats.py:362-392 |
| Prolific; preregistration | prolific.py; app.py:2983-3013, :3120 |
| Ollama | target.py; app.py:2372-2410 |

## 7. Implementation steps

Lane order: **L0 → (L1 ∥ L2 ∥ L3 ∥ L4) → L5 → L6 → L7.** L1–L4 run in parallel worktrees once L0 is merged into `flinch-rebuild`. Each lane owns its own files: `flinch-ui/src/routes/<area>/`, `src/lib/glossary/<lane>.ts`, `src/lib/tips/<lane>.ts`, `src/lib/readouts/<lane>.ts`, and its pins in `src/lib/copy/pins/<lane>.ts`. L0 owns the index files that aggregate them, so lanes never edit shared files. Each lane brief lives at `.omc/plans/flinch-lane-<L>.md`; decisions go to `progress.txt`. A lane is done when its gate file is green (§3).

**Backend changes (complete list; nothing else under `flinch/*.py` or `src-tauri/` changes outside L6/L7)**

| ID | Change | Why |
|---|---|---|
| B1 | `tests/test_experiment_pipeline.py`: `await db_module.get_async_db()` → `async with ...` (line 39). Wrap in `def test_experiment_pipeline(): asyncio.run(run_pipeline_test())` | problem 1; G1 |
| B2 | `flinch/app.py`: add `import logging` | problem 2 (F821 at app.py:667, :676, a latent NameError in batch-conditions); G2 |
| B3 | `flinch/__init__.py`: `__version__ = "0.8.0"`; `tests/test_version.py` asserts equality across pyproject.toml, `flinch/__init__.py`, tauri.conf.json, src-tauri/Cargo.toml and flinch-ui/package.json | problem 3; rule 1 (the version is a number on screen); G1 |
| B4 | `flinch/app.py`: `app.mount("/_app", StaticFiles(directory=str(STATIC_DIR / "_app")), name="app_assets")` beside line 131 | decision 1.1 + option A1; problem 10 (local bundle replaces the CDN); G6 |
| B5 | `flinch/db.py:1021-1031`: skip the text before the first `## ` heading in `import_probes_from_markdown`. Covered by `tests/test_load_defaults.py` | problem 7 (Load Defaults imports the H1 block as a probe); rule 7 (a header-as-probe fails "what am I looking at") |
| B6 (conditional) | `src-tauri/capabilities/`: only if T15's Windows check shows `invoke('set_api_key')` is refused from the sidecar origin. Add the narrowest remote capability for the three key commands (`lib.rs:97-111`) | kept feature broken at baseline (keys persisting to Credential Manager); G7 |

Problems 4, 5, 6, 8, 9, 11, 12, 13, 14 and 15 are UI-side and go away with the rebuild. No backend change is made for them.

### L0: gates and scaffold

**T0: Gate set and evidence harness.** Rules: §4 gates, 1.3.
- Files: B1, B2, B3; `tests/test_existing_db.py`, `tests/test_version.py`, `tests/test_wheel_contents.py` (runs `pip wheel . --no-deps` into a temp dir and checks that `flinch/static/index.html` and `flinch/static/_app/` are present and that no `flinch/probes/*.md` other than `example-probes.md` is); `tests/fixtures/make_v080_fixture.py`; `tests/fixtures/flinch-v0.8.0.db`; `scripts/dev/run-gates.py`; `scripts/dev/gates.json` (`{"ruff_total": 539}`); `.gitattributes` (`flinch/static/** -text`, `tests/fixtures/*.db binary`); evidence `index.md` section "Rebuild gates".
- Acceptance: `python -m pytest -q` collects ≥ 4 tests (test_static_serving and test_load_defaults arrive in T1 and T4) with 0 failed. `ruff check flinch --select F821,E9` reports 0. `ruff ... --statistics` total ≤ 539. `verify-phase1.py` passes 3/3 and `/health` reports `0.8.0`. `run-gates.py --lane L0` writes a gate file listing G1–G3 green and G4–G6 as `SKIPPED: flinch-ui not yet created`. The fixture DB contains ≥ 1 row in every table the UI reads (checked by `test_existing_db.py`). Its probe names are exactly the 4 `example-probes.md` names.
- Depends on: nothing.

**T1: SvelteKit project that builds into `flinch/static/`.** Rules: 1.1, A1, D1, problem 10.
- Files: `flinch-ui/` (`package.json` with `check`, `test`, `build`, `dev`; `package-lock.json`; `svelte.config.js` using adapter-static `{pages: '../flinch/static', assets: '../flinch/static', fallback: 'index.html'}`, `router.type: 'hash'`, `csp: {mode: 'hash', directives: {'script-src': ['self']}}`; `vite.config.ts` with `server: {host: '127.0.0.1', port: 5180, strictPort: true, proxy}`, never 5173 (handoff §5, Brad's Etsy vite); `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`; `src/app.html` with `<html class="dark">`; `src/app.css`; `src/routes/+layout.ts` with `ssr = false`, `prerender = false`; `static/favicon.png` from `src-tauri/icons/32x32.png`). Delete the 9 vanilla files in `flinch/static/`. B4. `tests/test_static_serving.py`. `flinch-ui/.gitignore` (`node_modules`, `.svelte-kit`).
- Acceptance: G4, G5 and G6 green. `python -m flinch.app` then `GET /` serves the new shell with 0 console errors and 0 non-local requests. Version: grepping `flinch/static` for `cdn.tailwindcss.com` finds nothing.
- Depends on: T0.

**T2: Design-language primitives, written fresh** (matched to `pry-design-reference.md`, nothing imported). Rules: 1, 2, 4, 6.
- Files under `flinch-ui/src/lib/`:
  - `tailwind.config.js` tokens: zinc surfaces, indigo accent, and `outcome.{refused,collapsed,negotiated,complied}`, carrying today's four hues from `index.html` `--color-*`.
  - components:
    - `Term.svelte`: dotted underline, hover/focus definition, `aria-describedby`, never takes focus.
    - `Readout.svelte`: `role=status aria-live=polite`, sr-only "In plain words:".
    - `Rate.svelte`: required props `count`, `of`, `label`, optional `formula`. It renders "count of N" beside the %. Calling it without `of` is a type error.
    - `Stat.svelte`: required `value` plus `inputs` (an n or test name).
    - `Caveat.svelte`: props `id` and `text`; emits `data-caveat`.
    - `FirstTimeTip.svelte`.
    - `LoadingScreen.svelte`: names the step it is on and the elapsed time, for batch, stat runs, experiments and sequence runs.
    - `Dialog.svelte`: replaces `prompt()`/`confirm()`; scrolls inside the viewport (problems 9, 12).
    - `Toast.svelte`, `OutcomeBadge.svelte`.
  - `popup/place.ts`: one placement rule (anchored preferred side → opposite → cross, inset for large targets, fallback; arrows capped at 160 px).
  - `tips/tips-registry.ts` + `tips/coordinate.ts` (localStorage `flinch:tip_seen:{id}`, every access in try/catch).
  - `glossary/index.ts`, `readouts/index.ts`, `copy/pins/index.ts`, `tips/index.ts`: aggregators of per-lane files.
  - `api/client.ts`: typed fetch for every route in §4; `ApiError` with the server's `detail` text.
  - `api/sse.ts`: parser for the batch, stat, experiment and sequence streams.
- Acceptance: vitest unit tests for `place.ts` (stays in viewport at 1024×700 and 1280×800, never covers its target, arrow ≤ 160), `Rate` (renders "3 of 12" and 25%; with `of=0` shows "no runs yet", never NaN), `coordinate.ts` (works when localStorage throws), and `sse.ts` (parses the `event:`/`data:` frames from app.py:680). G4/G5 green.
- Depends on: T1.

**T3: Copy tests, audit and screenshot drivers.** Rules: 6, 7, 8.
- Files:
  - `flinch-ui/src/lib/copy/visible-strings.ts`: extracts user-visible text from `.svelte`, `.ts`, `ui/index.html` and `ui/splash.js`.
  - `visible-strings.test.ts`.
  - `caveats.test.ts`: every K-id in §5 is pinned to ≥ 1 file, and the pinned phrase appears there.
  - `overstatement-closure.test.ts`: none of "proves", "always", "never", "guaranteed", "definitively" in visible strings without a pinned exception.
  - `banned-verbs.test.ts`: "the model knows/wants/thinks/believes/decides" fails; allowed only inside a caveat that refutes it.
  - `bare-number.test.ts`: no `{…}%` or `.toFixed(` interpolation in `.svelte` outside `Rate`/`Stat`.
  - `copy-files.ts`: `PENDING_LANES = ['L1','L2','L3','L4']`.
  - `scripts/dev/shoot.mjs`: Playwright (devDependency pinned in `flinch-ui/package.json`; uses the local Chromium via `executablePath` when set). It starts `python -m flinch.app --port <free> --db-path <tmp copy of fixture>` with all provider env vars removed, applies G11 and G12, walks `scripts/dev/shots.json` at both sizes, and writes PNGs plus `manifest.json` to `.omc/evidence/flinch-rebuild-2026-10-15/shots/round-N/`. States that need a live model (awaiting, SSE progress) are served by Playwright route mocks built from fixture rows, and the manifest marks them `mocked`.
  - `scripts/dev/popup-audit.mjs`: same server setup. Opens every tip, Term and dialog and reads bounding boxes from the DOM (no in-app hook). FAIL if a popup leaves the viewport, covers its target, covers a `[data-surface]` it is not anchored to, or has an arrow over 160 px. SKIP if a registry target is missing. Optional `--a11y` (axe-core devDependency).
- Acceptance: G5 green with the suite present. `shoot.mjs` exits non-zero when a test adds a non-local request or a second probe file (self-test with `--selftest`). `popup-audit.mjs` on the L0 shell prints `FAIL 0 / SKIP 0` at both sizes.
- Depends on: T2.

### L1: core probe loop (parallel after L0)

**T4: Shell, sidebar, probes, New Session.** Rules: 4, 6.
- Files: `src/routes/+layout.svelte` (sidebar, nav, no-key notice, toasts, shortcuts), `src/lib/components/sidebar/*`, `NewSessionDialog.svelte`, `ImportDialog.svelte`, `AddProbeDialog.svelte`, B5 + `tests/test_load_defaults.py`.
- Acceptance: on an empty DB, Load Defaults yields exactly 4 probes with no "# Flinch Example Probes" probe. Session switch shows the active session's name (problem 8 gone). The New Session dialog at 1024×700 shows its title and name field without scrolling the page (problem 9). Bulk delete, search, domain filter, custom prompt and narrative fields all reach their routes (`/api/probes*`). First-time tips exist for the probe panel, New Session and the no-key notice.
- Depends on: L0.

**T5: Session, run and pushback screens.** Rules: 1, 2, 4, 6.
- Files: `src/routes/session/[id]/+page.svelte`, `run/[runId]/+page.svelte`, `batch/+page.svelte`, `src/lib/readouts/l1.ts`, `glossary/l1.ts`, `tips/l1.ts`, `copy/pins/l1.ts`.
- Acceptance: on the fixture, every state in the "Not capturable" list of evidence `index.md` renders (thread, coach suggestion with move and confidence, coach/manual pushback, skip, continue, override, annotations with tags, promote to example, the export formats json/csv/md/html/agent/findings/report, batch with cancel, run history, turn list). Each outcome count is a `Rate` with its N. K1, K1b, K3, K4 and K5 sit beside their results. Every move name and outcome name is a `Term`. With no key, Send is disabled and names the missing provider. Each route in §4's L1 rows is called by at least one test or shot.
- Depends on: T4.

### L2: research tools

**T6: Multi-model compare and session compare.** Rules: 1, 2, 4.
- Files: `src/routes/compare/**`, `readouts/l2.ts`, `glossary/l2.ts`, `pins/l2.ts`.
- Acceptance: agreement shows "k of n probes" with n as defined at app.py:1677-1685 and :1779-1800. Disagreeing probes are listed with each model's label. Export, history, review and delete reach `/api/comparisons*` and `/api/export/compare`. K1, K2 and K4 are present.
- Depends on: L0.

**T7: Narrative momentum, framing variants, stat analysis, snapshots.** Rules: 1, 2, 4, 6.
- Files: `src/routes/session/[id]/{narrative,variants,stat,snapshots}/**`, `src/routes/variants/**`.
- Acceptance: the sequence create/run-auto/run-turn/drop-probe/whittle/batch-estimate/start/delete/export flows reach their routes. Threshold, timeline, cross-probe and strategy readouts show the inputs named in §4. The consistency score shows "k of n groups". Stat rows show "refused r of N" plus all four counts. Snapshot save uses a dialog and the diff shows changed/unchanged counts. K2, K6, K7 and K15 are pinned.
- Depends on: L0.

### L3: experiments

**T8: Experiment list, wizard, and the tabbed experiment screen.** Rules: 1, 2, 4, 6.
- Files: `src/routes/experiments/**`, `readouts/l3.ts`, `glossary/l3.ts`, `pins/l3.ts`.
- Acceptance:
  - The wizard creates an experiment on an empty DB (201/200, no 422; problem 4). A condition with an empty system prompt is blocked in the form with the reason (models.py:215).
  - The Overview tab shows name, models, created and conditions from the real payload (problem 6). Start, pause, resume and resume-conditions reach their routes, and progress streams through `LoadingScreen`.
  - Responses use `/responses` (problem 5).
  - The Conditions tab shows counts beside each compliance rate.
  - The Analysis tab shows d with CI and n1/n2, U with p and n1/n2, p raw/Bonferroni/FDR with k, alpha with raters/items, and win rates as wins of rankings. "Not computed" says which button computes it. An `{"error": ...}` payload shows the error text plus "needs the experiment extras" (draft; brad-voice pass).
  - Export downloads all five outputs listed in §4.
  - K9, K10, K11, K13 and K14 are pinned.
- Depends on: L0.

### L4: dashboard, scorecard, publication, policies, coach examples, settings

**T9: Dashboard, Policy Scorecard, Publication Export.** Rules: 1, 2, 4.
- Files: `src/routes/dashboard/**`, `readouts/l4.ts`, `pins/l4.ts`.
- Acceptance: tiles match `GET /api/dashboard/stats`. Clear All needs typed confirmation. Each scorecard cell shows "refused r of N" and the enforcement label with the rule from db.py:3142-3147. The theme preview loads via `/api/themes/{name}`. Generate and download reach `/api/publication/*`. K2, K8 and K12 are pinned.
- Depends on: L0.

**T10: Policy browser, coach examples, Settings, splash.** Rules: 2, 4, 6.
- Files: `src/routes/{policies,coach-examples,settings}/**`; `ui/index.html`, `ui/splash.js` and `ui/styles.css` restyled to the tokens. The splash shows the bootstrap step it is on (from `bootstrap:progress`) and the elapsed time. Its strings go into visible-strings.
- Acceptance:
  - One key form (problem 11). The browser path writes via `/api/settings/keys`, the Tauri path via validate → set-key → `invoke('set_api_key')`.
  - The first launch with no keys opens Settings once, then never again (tip-seen state).
  - Probe–claim link and unlink reach `/api/probes/{id}/claims*`. Coach example edit and delete use dialogs.
  - On a Windows debug build with a scratch runtime directory (`FLINCH_SIDECAR_DIR`), saving a key persists across a restart. If it does not, apply B6 and re-test. The result goes in the gate file.
  - The splash renders in Playwright with a stubbed `window.__TAURI__` that emits each bootstrap stage.
- Depends on: L0.

### L5: copy pass, rubric rounds, popup audit

**T11: brad-voice copy pass, in main context.** Rules: 8, 9; handoff §5.
- Sequence: L1–L4 merged and green → run `/anthropic-skills:brad-voice` in the main session over every visible string (screens, tips, glossary definitions, the 16 caveats, empty states, errors, splash) → critic agent review → cold-read agent (fresh context, sees only screenshots) reports every misread → fixes go back through brad-voice → final phrases replace the drafts in the `pins/*.ts` files → `PENDING_LANES = []`.
- Acceptance: G5 green with final pins. The brad-voice transcript summary and the critic and cold-read findings are in `evidence/.../voice/`. The lint is not counted as the pass.
- Depends on: L1–L4.

**T12: Rubric rounds and final popup audit.** Rules: 6, 7.
- Acceptance: `rubric/round-N.md` reaches 0 below the bar at both sizes (§8). G8 prints `FAIL 0 / SKIP 0` with 0 serious/critical axe findings. Any copy changed during the rounds goes back through T11's sequence before the next round. Then: architect verification against this plan, a deslop pass on `flinch-ui/src`, and a full `run-gates.py --release`.
- Depends on: T11.

### L6: updater (separable; 1.2)

**T13: Signed updater.** Rule 10.
- Brad generates the key himself (`cargo tauri signer generate -w ~/.tauri/flinch-updater.key`) and backs it up. Claude never runs that command, never reads the private key, never commits it.
- Files: `src-tauri/Cargo.toml` (`tauri-plugin-updater = "2"`, `tauri-plugin-process = "2"`); `src-tauri/src/lib.rs` (register the plugins; add command `stop_sidecar_for_update`); `src-tauri/capabilities/default.json` (`updater:default`, `process:allow-restart` for `main`); `src-tauri/tauri.conf.json` (`bundle.createUpdaterArtifacts: true`; `plugins.updater` replaced with the v2 shape `{pubkey, endpoints: [existing latest.json URL], windows: {installMode: "passive"}}`, dropping the v1 `active`/`dialog`/`_comment` keys); `ui/splash.js` + `ui/index.html` (update card per E1: check with a timeout and never block startup; Install → `stop_sidecar_for_update` → download and install → relaunch); `scripts/release.ps1` (mirrors Pry's: key path default `$HOME\.tauri\flinch-updater.key`, runs `bundle-resources.py` and `cargo tauri build --ci`, restores the Cargo.toml bytes, clears the env, requires `<installer>.sig`, writes `latest.json`, prints the SHA256 and the `gh release create` command without running it, `-SkipBuild`); `docs/releasing.md` (version in five places per `test_version.py`; never mark the release as a pre-release).
- Acceptance: G7 green. A dry run with a throwaway key on Brad's machine produces `.sig` and a `latest.json` that validates against Tauri's schema. Then the throwaway key is deleted. A splash shot with a stubbed update shows the card. Reverting the L6 commits leaves G1–G8 green. The updater card copy has gone through brad-voice.
- Depends on: L5.

### L7: release prep (no release without Brad's word)

**T14: Release build and docs.** Rules: 9, 10; handoff §5.
- The version number is Brad's call (AskUserQuestion at this step). Bump it in the five places.
- `CLAUDE.md`: replace "Vanilla JS ES modules (frontend, no build step)"; add `flinch-ui/` and the dev commands.
- README "Running"/development section and release notes through brad-voice in main context.
- Run `scripts/build-installer.ps1`, or `release.ps1` if L6 shipped. Installer size stays in the 50–80 MB band (`build-installer.ps1`).
- Smoke test on the debug build with a scratch runtime directory. Never launch the release exe over Brad's install (handoff rule 10, §5).
- Upgrade test on a clean Windows VM: install `v0.8.0-desktop`, add data, install the new build. The new UI loads, which proves the sidecar reinstall triggered (bundle hash covers pyproject.toml, `bootstrap/mod.rs:51-84`), and `%APPDATA%\Flinch\flinch.db` opens with its data.
- The PR description goes through brad-voice.
- Merge to master and release wait for Brad's explicit word.
- Acceptance: `run-gates.py --release` green at the release commit; upgrade test recorded; no key or credential anywhere in the diff (`git diff master | grep -iE "sk-|PRIVATE KEY|api_key\s*="` finds nothing).
- Depends on: L5 (and L6 if kept).

## 8. Rubric (rule 7)

The first-timer: has never opened Flinch, knows what an AI chatbot is, has no statistics background. Every rubric screen state is scored at 1280×800 and 1024×700.

| # | Criterion | 2 | 1 | 0 |
|---|---|---|---|---|
| R1 | What am I looking at | Tool, data in view (session, model, probe or experiment) and the screen's job are clear without hovering | One of these is missing or needs a hover | Can't tell what the screen is |
| R2 | Why it matters | One visible line says what this result tells you about rule consistency | It is only in a tip or hover | Absent |
| R3 | What next / how back | A primary next action is visible, a way back exists, and disabled actions say why | Next or back is missing, or a disabled action is unexplained | Dead end |
| R4 | Result with its limits | Every result has its pinned caveat beside it, in view with the result | Caveat present but out of view or vague | Missing |
| R5 | Every number with its source | Every number shows its count, n, formula or test beside it | Some numbers do | Bare numbers |

- **Below the bar** = any criterion 0, or a total below 8. R4 and R5 may be N/A only on screens with no result or number; the critic states why.
- **Shots**: `scripts/dev/shots.json` lists every rebuilt screen and state: the 50 baseline states plus the baseline's "not capturable" list, which the fixture DB and route mocks now reach. It covers empty DB, fixture DB, and no key.
- **Driver**: `shoot.mjs` (§7 T3) runs Playwright against the FastAPI-served build, with example probes only and G11/G12 enforced.
- **Scorer**: a critic agent with a fresh context per round. It sees screenshots plus the manifest only, never the source. It writes `rubric/round-N.md` (screen × size × R1–R5, total, a one-line reason for every score under 2).
- **Rounds**: fix, re-shoot everything, re-score everything (so regressions show), until 0 below the bar.

## 9. Evidence folder

- **Tracked**, `docs/plans/evidence/flinch-rebuild-2026-10-15/` (already holds the baseline):
  - `index.md` (adds a "Rebuild" section that links everything below)
  - `gates/<lane>-<sha>.md`
  - `rubric/round-N.md`
  - `popup-audit/<sha>.md` (summary)
  - `route-coverage.md` (§11 step 4)
  - `voice/` (brad-voice, critic and cold-read summaries)
  - `screenshots-final/1280x800|1024x700/` (final round only, after the G12 guard passed)
  - `upgrade-test.md` (L7)
- **Ignored**, `.omc/evidence/flinch-rebuild-2026-10-15/`: raw gate logs, every intermediate round's screenshots and manifests, Playwright traces, server logs, temp DB copies, wheel listings. Anything that could hold a path, key or probe text stays here.
- Never in either: an API key, the signing key, Brad's own `flinch.db`, or any probe other than `example-probes.md`.

## 10. Risks and mitigations

| Risk | Mitigation | Detection |
|---|---|---|
| Built UI missing from the wheel (Hatchling honours `.gitignore`) | A1 commits the build | `tests/test_wheel_contents.py` (G1) |
| Committed build stale against the source | Build before commit | G6 `git diff --exit-code -- flinch/static` |
| A sensitive probe reaches a screenshot or fixture | Drivers run from a worktree (gitignored probes are absent); fixture built from example probes only | G12 refuses to run; `test_existing_db.py` asserts probe names |
| Live-model states can't be captured without keys | Fixture rows plus route mocks; no key is ever used | manifest `mocked` flags reviewed by the critic |
| Key persistence via IPC from the `127.0.0.1` origin may fail in packaged mode (capability has no `remote`, `capabilities/default.json`) | Windows check in T10; B6 if refused | T10 gate-file entry |
| Updater path can't be exercised end to end before the next release (v0.8.0 has no updater) | This release installs manually; release.ps1 dry run with a throwaway key; L6 is revertible | T13 dry-run record; the next release's update test |
| Existing installs keep the old UI if pyproject.toml doesn't change (`bundle_hash` covers only pyproject.toml + `flinch/*.py`, `bootstrap/mod.rs:51-84`) | Every release bumps the version (test_version + releasing.md) | L7 upgrade test shows the new UI |
| Parallel lanes collide on shared registries | Per-lane files plus aggregators owned by L0 | merge conflicts in `src/lib/*/index.ts` should be zero; reviewed at each lane merge |
| Copy slop from lint-only passes (handoff rule 9) | T11 in main context with critic and cold-read | release gate: `PENDING_LANES` empty; `voice/` present |
| Scope creep | Each lane brief lists the rule or problem behind every task; critic rejects untraceable diffs | `git diff master --stat -- flinch/ src-tauri/ ':!flinch/static'` shows only the B-list and L6/L7 files |
| CRLF churn on Windows (`core.autocrlf=true`, handoff §8) | `.gitattributes` `-text` for `flinch/static/**` and fixtures | G6 diff clean on Windows |
| Dev server collides with Brad's Etsy vite on 5173 | Port 5180, strictPort | Vite exits rather than shift ports |
| SvelteKit's inline bootstrap script blocked by a CSP | `kit.csp` hash mode | G6 meta-CSP check; zero console errors in shots |
| Scorecard labels read as contradictory once inputs sit beside them (db.py:3142-3146) | Shown verbatim with the rule and K8 until Brad answers Q1 | critic flags it in rubric R5 reasons |

## 11. Verification steps

1. `python scripts/dev/run-gates.py --lane release --release` on the `flinch-rebuild` head: G1–G6 and G8–G10 green on Linux or Windows, G7 green on Windows. The gate file is committed.
2. Existing DB (1.3): G10 passes. Optionally, Brad runs the app on a copy of his own `flinch.db` locally. Only a pass/fail line is recorded; nothing from that DB enters the repo.
3. No-key experience: with an empty DB and with the fixture, all provider env vars unset:
   - startup log shows keyword-only mode
   - first screen is Settings once, with K1b
   - Send is disabled with the reason
   - every non-model feature works: import, sessions, all views, dashboard, scorecard, publication, policies, coach examples, settings
   - `verify-phase1.py` passes 3/3
4. Route coverage: `scripts/dev/route-coverage.py` lists every route in `api-routes.md` with the `flinch-ui` file that calls it or "API-only at v0.8.0". It extracts the routes the 7dc2b20 UI called from a worktree of `flinch/static/*.js`. Pass = every route the v0.8.0 UI called (except the nonexistent `/results`) is called by `flinch-ui`. Output: `route-coverage.md`.
5. Rubric: final round 0 below the bar at both sizes. G8 `FAIL 0 / SKIP 0`.
6. Architect verifies against this plan's §4–§7. Critic signs off.
7. Windows: debug-build smoke with a scratch runtime; installer build; upgrade test from `v0.8.0-desktop` (L7).
8. Brad's explicit word before merge to master and before any release.

## 12. Open questions for Brad

Both would extend backend work past §7's B-list, so they are his. Each is asked through AskUserQuestion before T9 (L4) starts; neither blocks L0-L3. The plan's default, if he says leave it, is shown.

- Q1. The policy scorecard labels a should-refuse claim **"over"** when fewer than 20% of runs refused, and **"under"** at 20–80% (db.py:3142-3146). For should-allow claims anything below 80% compliance is **"under"** (db.py:3145). Read plainly, the labels look reversed. Options: leave the logic and show the rule and inputs beside each label (default); or fix the mapping in `db.py` (backend change, plus a test).
- Q2. Publication Export tables print rates without their n (consistency-matrix cells as `0.70`, publication.py:246-262). Options: show the generated document as-is with K2 beside the preview (default); or add n to the generated tables in `publication.py` (backend change to export output).

## 13. ADR

- **Decision.** Rebuild Flinch's UI as a SvelteKit 5 + Tailwind static app in `flinch-ui/`. The build is committed to `flinch/static/` and served by FastAPI behind the existing Tauri splash, with hash routing, one added `/_app` mount, and no change to schema, routes or response shapes. Old UI replaced on the branch lane by lane. Every number reads its inputs from existing payloads. Guided entry, caveats, terms and copy tests are written fresh in Pry's design language. The signed updater is a separable last lane with the update card on the splash.
- **Drivers.** 1.3 compatibility; the offline, CSP-bound FastAPI distribution path (problem 10); verifiability with no key at two window sizes.
- **Alternatives considered.** A2 (gitignored build plus Hatch artifacts) and A3 (Tauri frontendDist, invalidated); B2 (strangler with `/legacy`); C2 (new read-only aggregate endpoints); D2 (path router with a catch-all); E2 (in-app update card with a remote IPC capability). Why each lost is in §2.
- **Why chosen.** Least backend surface: five listed changes plus one conditional. The `pip install -e .` and wheel paths keep working untouched. Every displayed number is backend-computed or a ratio of payload counts. The updater can be dropped by reverting one lane.
- **Consequences.**
  - Node 22 joins the dev toolchain (`flinch-ui/`); a Python-only user still gets the UI from the committed build.
  - Build output appears in diffs and G6 guards it.
  - Classifier confidence stays invisible (not persisted; 1.3).
  - The scorecard and publication semantics are shown as they are until Q1/Q2 are answered.
  - The first in-app update can be tested only at the release after this one.
- **Follow-ups (of this plan).** Answer Q1/Q2. Record popup geometry at release as the reference for the next release's geometry diff. Run the next release's in-app update test.
- **Not follow-ups of this plan.** Lessons, the lesson runner and sidebar, a shared UI package, a combined shell, and a free local model bootstrap. They belong to Pry's roadmap (handoff §3) and need Brad's scoping there, not here.
