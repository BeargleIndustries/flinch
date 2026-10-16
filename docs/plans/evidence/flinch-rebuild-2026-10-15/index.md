# Flinch pre-rebuild baseline — 2026-10-15

Evidence folder: `/home/user/flinch/.omc/evidence/flinch-rebuild-2026-10-15/` (gitignored via `.omc/`). No tracked file was modified.

## Commit and environment

- Repo: `/home/user/flinch`, commit `7dc2b20101d5a20b76e5122122f7c1d50b803b1c` (working tree clean before and after this baseline).
- Package version: `pyproject.toml` says `0.8.0`; `flinch/__init__.py` / `/api/version` / UI header say **`0.5.0`** (version drift).
- Python `3.13.16` in `.venv` (repo requires `>=3.11`). Linux 6.18 container.
- `pip install -e ".[dev]"` OK; `pip install -e ".[experiment]"` OK (textstat, scipy, numpy, matplotlib, krippendorff, nltk, textblob, lexical-diversity all installed cleanly, ~1 min). `playwright==1.64.0` added for screenshots (browser not downloaded; preinstalled `/opt/pw-browsers/chromium` used). `pdf` and `multi-model` extras were not installed.
- Full details: `env.txt` (python version, pip tails, `pip freeze`).
- Sandbox caveat: outbound HTTPS to `cdn.tailwindcss.com` is blocked by the proxy. The UI loads Tailwind from that CDN for exactly four utilities (`h-full flex overflow-hidden` on `<body>`, `flex flex-col` on `#sidebar`) plus preflight. Without it the sidebar and main column stack vertically. For screenshots the CDN request was intercepted in Playwright and answered with a tiny equivalent shim (preflight subset + those four classes). No app file was changed. Note for the rebuild: the UI has a hard runtime dependency on an external CDN for its root layout.

## Gate results

| Gate | Result | Detail file |
|---|---|---|
| `pytest -q` | **0 tests collected** (exit 5, "no tests ran") | `pytest.txt` |
| `python tests/test_experiment_pipeline.py` (direct) | **FAIL** — `TypeError: object _AsyncDBContext can't be used in 'await' expression` at line 39 (`await db_module.get_async_db()`; it is an async context manager now) | `pytest.txt` |
| `ruff check flinch` | **541 errors** (72 auto-fixable) | `ruff.txt` |
| `scripts/verify-phase1.py` | **ALL CASES PASSED** (3/3: dev mode, packaged `--port --db-path`, stdin key handoff) | `verify-phase1.txt` |

pytest: the only test file `tests/test_experiment_pipeline.py` has no `test_*` functions (one `async def run_pipeline_test()` run under `__main__`), so pytest collects nothing. Run as a script it crashes immediately on the DB helper API change above, so the experiment pipeline integration test is effectively dead.

ruff breakdown (from `--statistics`): E501 line-too-long 444; F401 unused-import 24; I001 unsorted-imports 22; UP017 datetime-timezone-utc 20; F841 unused-variable 8; E402 import-not-at-top 7; UP042 4; E741 2; UP035 2; F541 2; **F821 undefined-name 2** (`logging` used but never imported in `flinch/app.py:667` and `:676`, inside the batch-conditions error path — a latent NameError); E713 1; UP037 1; F811 1; UP041 1.

verify-phase1 ran with all provider env vars stripped: `READY <port>` sentinel seen, `/health` → `{"status":"ok","version":"0.5.0"}`, `/api/settings/keys` → 5 entries with boolean `is_set` and no raw key, `--db-path` honored, stdin `{"keys":{...}}` handoff sets `is_set=true`.

## No-key experience

Started with `FLINCH_DB_PATH=.../baseline.db python -m flinch.app --port 8765` and all of `ANTHROPIC_API_KEY/OPENAI_API_KEY/GOOGLE_API_KEY/XAI_API_KEY/TOGETHER_API_KEY` unset (`app.log`).

- Startup log: `No LLM provider configured. Classification will use keyword-only mode. Set any API key (...) or run Ollama.` then `READY 8765`. Server starts normally.
- `GET /health` → `{"status":"ok","version":"0.5.0"}`.
- `GET /api/settings/keys` → list of 5 providers (`anthropic`, `openai`, `google`, `xai`, `meta`/Together) each `{"env_var","provider","label","required":false,"is_set":false,"masked":""}`.
- `GET /api/models` still returns the full Anthropic/OpenAI/Google/xAI/Together model catalogue (with `available`/`hint` flags), so the New Session modal and Compare picker list models even though none can be called.
- UI on load: `settings.js` `checkAndShowIfNoKeys()` sees all `is_set=false` and auto-opens the **"API Keys" modal** (5 rows, "Not configured" + "Add Key") over the idle home (screenshot 01). A red sidebar banner `No Anthropic key set. Classification will use keyword-only mode or another available provider.` is injected by `api.js checkOllamaStatus()` from `/api/ollama/status.anthropic_key_warning` and stays for the whole session.
- Everything that does not call a model works without keys: probe import, session creation, all views/tabs/dialogs, dashboard, scorecard generate (returns an empty scorecard), publication export generate, policy browser, coach examples, settings.
- Model calls fail cleanly: `POST /api/sessions/1/run` → **404** `{"detail":"Anthropic API key required to test Claude models. Set ANTHROPIC_API_KEY or choose a different target model."}` shown as a red toast; phase returns to `probe_selected` (screenshot 12). Saving a snapshot on an empty session → 400 `No runs in session to snapshot`.
- Settings view (render.js) and the API Keys modal (settings.js) are two different key-entry surfaces for the same data (`/api/settings/keys` vs `/api/settings/set-key`).

Baseline DB after the tour (`baseline.db`): 4 probes from `example-probes.md`, 1 session `baseline-screens` (target `claude-opus-4-20250514`, 0 runs), 1 experiment `baseline-screens experiment` (created via API, see below), 3 seeded coach examples. No API key was ever typed.

## Screenshots

`screenshots/1280x800/` and `screenshots/1024x700/` contain the same 50 captures (full-page, Chromium headless, `#main` expanded so scrolled content is included; modal overlays are `position:fixed` so they capture at viewport height). `manifest.json` in each folder repeats the notes; `console-errors.txt` lists browser console errors; `shoot-log.txt` is the driver log. Layout and content are identical at both sizes except the main column is narrower; nothing reflows or breaks at 1024.

| # | File | What it shows |
|---|---|---|
| 01 | `01-startup-api-keys-modal.png` | First load with no keys: settings.js "API Keys" modal auto-opened over the idle home; red no-key banner in sidebar. |
| 02 | `02-home-idle-no-session.png` | Idle home, no session: crosshair hero, "+ New Session", Research Tools cards (Multi-Model Compare, Narrative Momentum, Framing Variants, Statistical Analysis), Results & Export (Dashboard), Extras (Policy Browser, Pushback Coach, Settings). Sidebar says "Select a session to view probes". |
| 03 | `03-sidebar-probes-loaded.png` | After clicking sidebar "Load Defaults": still no session, so the probe list stays hidden (probes exist in DB). |
| 04 | `04-import-file-modal.png` | "Import Probes from File" modal listing `example-probes.md` with an Import button. |
| 05 | `05-add-probe-form.png` | Sidebar "+ add" inline form: Name, Domain, Prompt text, Tags, "IF Narrative Probe" checkbox, Save/Cancel. |
| 06 | `06-add-probe-form-narrative.png` | Same form with the narrative toggle on: Narrative Opening and Narrative Target textareas appear (purple block). |
| 07 | `07-new-session-modal.png` | "New Session" modal: Session name, Target model select (populated from `/api/models`), Coach backend (Claude/Local), Coach profile, System prompt, Probes picker summary. Modal is taller than an 800px viewport and gets clipped at the top. |
| 08 | `08-new-session-probe-picker.png` | New Session modal with the probe picker expanded: search, All/None, per-domain checkboxes (domain rows render right-aligned with the label after the checkbox). |
| 09 | `09-new-session-local-coach.png` | Coach backend switched to "Local Model (Ollama)": local model select (empty, Ollama offline) and an amber "Local coach is experimental" warning. |
| 10 | `10-session-idle.png` | Session `baseline-screens` active: "Select a probe to begin", "Run All Probes", Narrative Momentum / Framing Consistency tiles. Sidebar now shows PROBES 4/4, search, domain filter, "+ Custom Prompt", domains CRIME / MEDICAL / ROMANCE / UNCATEGORIZED. Note the session `<select>` still reads "— no session —". |
| 11 | `11-probe-selected.png` | Probe selected (first probe is the imported file header "# Flinch Example Probes"): "Back to Tools", PROBE card with prompt text, "Send Probe" button. |
| 12 | `12-probe-sent-no-key.png` | After "Send Probe" with no key: red toast "Failed to send probe: API error 404: Anthropic API key required…". |
| 13 | `13-keyboard-shortcuts-overlay.png` | "?" overlay "Keyboard Shortcuts": S/P/K/N/R/arrows/Esc/Enter/?. |
| 14 | `14-multi-model-compare-picker.png` | "Multi-Model Comparison": MODELS (pick 2–5) grouped by provider with checkboxes, custom model ID field, PROBES (pick 1+) by domain + custom prompt, disabled "Run Comparison (0 models × 0 probes)", COMPARISON HISTORY empty. |
| 15 | `15-narrative-momentum.png` | "Narrative Momentum — Session: baseline-screens": explainer, Create Narrative Sequence form (Strategy select "academic research", Probe select, Mode Automatic/Manual, Warmup Turns slider = 10, IF Engine checkbox, "Create Sequence" / "Create + Auto-Whittle"), Sequences list "No sequences yet". |
| 16 | `16-framing-variants-edit.png` | "Framing Variants" Edit Groups tab: explainer, "Run All Variant Groups (0 probes)", shipped variant files ("lexical complexity" with Baseline/Honest/Deceit conditions, "Violence Framing" with Direct Request/Fiction Workshop/Academic Analysis), CREATE NEW VARIANT GROUP (AI-Assisted: base probe, group ID, framing strategy chips, custom strategy, "Generate Variants"). |
| 17 | `17-framing-variants-manual-create.png` | Same view with the Manual create mode: editable variant rows (label + prompt) and save. |
| 18 | `18-framing-variants-results.png` | Results tab: "No results yet — run variant probes in a session first". |
| 19 | `19-stat-analysis.png` | "STATISTICAL ANALYSIS baseline-screens": explainer, CONFIGURATION repeat count (10), "Run Selected Probes" / "Run All Probes". |
| 20 | `20-dashboard-overview.png` | Dashboard > Overview: Overview / Policy Scorecard / Publication Export pills; stat tiles 1 session / 0 runs / 0 comparisons / 0 sequences; "Export All Data", "Clear All Data"; All / Sessions (1) / Comparisons (0) / Sequences (0) filter; session row with JSON/CSV export buttons; empty comparisons and sequences. |
| 21 | `21-dashboard-sessions-tab.png` | Overview with the "Sessions" filter. |
| 22 | `22-dashboard-comparisons-tab.png` | Overview with the "Comparisons" filter (empty state text). |
| 23 | `23-dashboard-sequences-tab.png` | Overview with the "Sequences" filter (empty). |
| 24 | `24-dashboard-clear-all-confirm.png` | Inline "Clear All" confirmation replacing the button. |
| 25 | `25-dashboard-session-detail.png` | Inline session detail: "← Back to list", session card (model, created, 0 runs), "No runs in this session". |
| 26 | `26-dashboard-policy-scorecard.png` | Policy Scorecard section: explainer, CONFIGURATION (scorecard name, Models checkboxes from sessions, Data sources Sessions/Stat Runs), "Generate Scorecard". |
| 27 | `27-dashboard-policy-scorecard-generated.png` | After Generate on an empty session: same form, `POST /api/scorecard/generate` returned 200 with nothing to show. |
| 28 | `28-dashboard-publication-export.png` | Publication Export: TEMPLATE (Comparison Table), FORMAT (Markdown), FILTERS (models, domains), THEME select (Beargle Dark) with live themed preview table, "Generate Preview". |
| 29 | `29-dashboard-publication-theme-switched.png` | Same with theme switched to "Clean Light" — preview re-skinned via `/api/themes/clean-light`. |
| 30 | `30-dashboard-publication-generated.png` | After "Generate Preview" (`POST /api/publication/export` 200) on an empty session. |
| 31 | `31-experiments-list.png` | "Experiments" tab (separate `#experiment-container`): header, "+ New Experiment", empty state "No experiments yet". |
| 32 | `32-experiment-wizard-step1.png` | New Experiment wizard, step 1 Basic Info: name, description, repetitions; stepper Basic Info → Conditions → Models & Probes → Review. |
| 33 | `33-experiment-wizard-step2.png` | Step 2 Conditions with one row: Condition Name, Type select (Honest/Deceptive/Neutral/High-effort honest/Custom), optional System Prompt, "+ Add Condition". |
| 34 | `34-experiment-wizard-step3.png` | Step 3 Models & Probes: Target Models rows (+ Add Model), Probe Set IDs textarea. |
| 35 | `35-experiment-wizard-step4.png` | Step 4 Review: SUMMARY (name, condition badges, models, repetitions), estimated total trials, "Create Experiment". |
| 36 | `36-experiment-create-422-error.png` | Pressing "Create Experiment": red message "Failed to create experiment: … conditions.0.label Field required … system_prompt String should have at least 1 character" (422). |
| 36b | `36-policy-browser.png` | "Policy Claims Browser": All / Anthropic / OpenAI / Google / xAI tabs, claim rows (severity dot, provider, slug, claim text, category tag, allowed/disallowed icon). |
| 37 | `37-compliance-scorecard.png` | Attempted compliance view: `showComplianceView()` fetches `/api/sessions/1/compliance` (200) and calls `render()`, but `renderMain` has no branch for it, so the screen stays on the session idle view. `renderComplianceScorecard` is unreachable in the baseline. |
| 38 | `38-pushback-coach-examples.png` | "Coach Examples (3)": seeded examples with pattern/move labels, REFUSAL text, PUSHBACK THAT WORKED text, Edit Pushback / Delete, Back. |
| 39 | `39-settings-view.png` | "Settings — API keys and configuration": one card per provider (Anthropic, OpenAI, Google, xAI, Together AI) with "Not set" + key input + Save; "Ollama (Local Models) offline" base URL + Test; "Default Coach Backend" select. |
| 40 | `40-settings-api-keys-modal.png` | The settings.js "API Keys" modal re-opened manually (same as 01, after the tour). |
| 41 | `41-snapshot-browser.png` | "Regression Snapshots — baseline-screens — saved baselines": "+ Save Baseline", Back, "No snapshots yet"; red toast "Failed to save snapshot: API error 400: No runs in session to snapshot" from the native `prompt()` dialog flow. |
| 42 | `42-snapshot-diff.png` | Same browser (no snapshot could be created, so no diff view exists in baseline). |
| 43 | `43-compare-modal-legacy.png` | Legacy `#compare-modal` from index.html ("Compare Sessions — Select 2 or more sessions", empty list, Compare/Cancel), forced visible; not reachable from any current button. |
| 44 | `44-home-after-tour.png` | `goHome()` — back to the session idle screen. |
| 45 | `45-experiments-list-with-card.png` | Experiments list with one card (experiment created via API): name, status badge, conditions, open / condition-dashboard buttons. |
| 46 | `46-experiment-dashboard.png` | Experiment dashboard: back arrow, (blank) title, Results / Export buttons, PROGRESS "Not started" with per-condition bars labelled "has system prompt" 0/?, CONFIGURATION Conditions 2 / Models 0 / Repetitions 1 / Created —. |
| 47 | `47-experiment-results.png` | Results view: same dashboard with red message "Failed to load results: Not Found" (`GET /api/experiments/1/results` 404). |
| 48 | `48-experiment-analysis.png` | "Statistical Analysis —": COMPLIANCE RATE BY CONDITION "No data", OVERALL AGREEMENT "Not computed". |
| 49 | `49-experiment-export.png` | "Export —": RESEARCH DATA (Download CSV / JSONL), PROLIFIC INTEGRATION (Download Prolific CSV), PREREGISTRATION (Generate), PUBLICATION REPORT (Generate Report). |
| 50 | `50-condition-comparison-dashboard.png` | "Condition Comparison — Experiment #1 — 2 condition(s)": Compute Metrics / Export CSV / Back; one card per condition (label, 0 responses, system prompt); RESPONSE BROWSER probe select. |

Not capturable without an API key or run data (listed so the rebuild knows they exist): awaiting/response/pushback-decision/pushback-sent states and the conversation thread (`render.js renderAwaitingState`, `renderResponseState`, `renderCoachSuggestion`, `renderPushbackCard`, `renderManualPushback`, `renderAnnotationPanel`, `renderExportDropdown`), classification dropdown (`components.js showClassificationDropdown`), batch progress view (`renderBatchView`), run history list (`renderRunHistory`, sidebar `#run-history-list`), turn-detail modal (`#turn-detail-modal`), multi-model results grid (`renderMultiModelResults`) and session-vs-session compare table (`renderCompareView`), variant results table (`renderVariantResultsTab`), sequence cards/conversation/threshold chart/turn timeline/cross-probe/strategy effectiveness (`renderSequenceCard`, `renderSequenceConversation`, `renderThresholdChart`, `renderTurnTimeline`, `renderCrossProbeComparison`, `renderStrategyEffectiveness`, `renderSequenceResults`), snapshot diff (`renderSnapshotDiff`), scorecard/publication results, condition dashboard with responses, native `prompt()`/`confirm()` dialogs (edit pushback, delete confirmations, snapshot name).

## UI surface inventory

Single-page app: `flinch/static/index.html` (sidebar markup + three static modals + all CSS + inline module that wires Experiments) and ES modules `app.js` (init, New Session modal, add-probe form), `state.js` (global `state` + phase machine), `render.js` (5.1k lines, every main-column view), `api.js` (fetch wrappers + many `window.*` actions incl. Import File modal, snapshot dialogs, dashboard loaders), `components.js` (escHtml, badges, classification dropdown, toast `showError`, theme selector/preview), `settings.js` (API Keys modal), `shortcuts.js` (keyboard shortcuts + help overlay), `experiment.js` (Experiments tab, self-contained). Views are selected by boolean flags on `state` (`settingsView`, `dashboardView`+`dashboardSection`+`dashboardTab`, `policyView`, `consistencyView`+`variantTab`, `sequenceView`, `statRunView`, `snapshotView`, `compareMode`, `batchRunning`) checked in order inside `render.js renderMain()`, then by `state.phase`. Experiments live outside `render()` in a sibling `#experiment-container` toggled by `window.showExperimentsTab()` (index.html inline script).

| Surface (label as shown in UI) | Entry point | Renderer (file:function) |
|---|---|---|
| Sidebar: header "flinch vX", Session select, "+ New Session", "✕" delete | always | index.html markup; `render.js renderSessionSelect`; `api.js handleSessionChange`, `deleteCurrentSession` |
| Sidebar: "Load Defaults", "Import File", "+ add" | always | `api.js loadDefaultProbes`, `window.showImportFileModal` (modal built in api.js), `app.js toggleAddProbeForm`/`submitAddProbe` (form markup in index.html) |
| Sidebar: PROBES list (count, "Select" bulk mode, search, domain filter, "+ Custom Prompt", domain groups, per-probe ✕) | session active | `render.js renderProbeList`/`renderProbeListOnly`; `components.js groupProbesByDomain`, `filterProbes`; `window.toggleProbeSelectMode`, `deleteSelectedProbes` |
| Sidebar: run history + stats | session with runs | `render.js renderRunHistory`, `renderStats` |
| Sidebar nav pills: "Stat Analysis", "Dashboard", "Experiments"; EXTRAS "Policy Browser", "Settings" | always | index.html onclick → state flags / `showExperimentsTab` / `showPolicyBrowser` |
| Red no-key banner (top of sidebar) | no Anthropic key | `api.js checkOllamaStatus` (from `/api/ollama/status`) |
| Home (idle, no session): hero + tool cards | default | `render.js renderIdleState` |
| Session idle: "Select a probe to begin", "Run All Probes", Save Baseline / Compare to Baseline (when runs exist), feature tiles | session selected | `render.js renderIdleState` |
| Probe selected / Send Probe | click probe | `render.js renderProbeSelectedState`; `api.js selectProbe`, `sendProbe` |
| Awaiting / Response / Pushback decision / Pushback sent (thread, coach suggestion, manual pushback, annotations, export dropdown) | after a run | `render.js renderAwaitingState`, `renderResponseState`, `renderCoachSuggestion`, `renderPushbackCard`, `renderManualPushback`, `renderAnnotationPanel`, `renderExportDropdown` |
| Batch progress | "Run All Probes" | `render.js renderBatchView`; `api.js startBatch` |
| New Session modal (`#new-session-modal`) incl. probe picker + Local coach section | "+ New Session" | index.html markup; `app.js showNewSessionModal`, `renderModalProbeList`, `submitNewSession`, `handleCoachBackendChange` |
| Import Probes from File modal (`#import-file-modal`) | "Import File" | `api.js window.showImportFileModal`, `doImportFile` |
| API Keys modal (`#settings-modal`) | auto on load with no keys | `settings.js showSettingsModal`, `_renderProvider`, `_showKeyInput`, `_saveKeyTauri` |
| Keyboard Shortcuts overlay (`#shortcut-help`) | "?" | `shortcuts.js toggleShortcutHelp` |
| Error toast | any failure | `components.js showError` |
| "Multi-Model Comparison" picker / results / comparison history | home card or `showCompareModal` | `render.js renderCompareSessionPicker`, `renderMultiModelResults`, `renderCompareView`; `window.runMultiModelCompare`, `reviewComparison` |
| Legacy "Compare Sessions" modal (`#compare-modal`) | none (dead markup) | index.html; `render.js _showCompareModal_legacy` |
| "Narrative Momentum" (create sequence form, sequence cards, conversation, whittling/threshold/timeline/cross-probe/strategy charts) | home card / session tile | `render.js renderSequenceView`, `renderSequencePanel`, `renderSequenceCard`, `renderSequenceConversation`, `renderSequenceResults`, `renderThresholdChart`, `renderTurnTimeline`, `renderCrossProbeComparison`, `renderStrategyEffectiveness`; handlers `handleCreateSequence`, `handleRunSequenceAuto`, `handleRunWhittle`… |
| "Framing Variants": tabs "Edit Groups" / "Results"; AI-Assisted / Manual create | home card / session tile | `render.js renderConsistencyView`, `renderVariantEditTab`, `renderVariantCreateSection`, `renderGeneratedPreview`, `renderVariantResultsTab`; `api.js showConsistencyView`, `loadVariantFiles`, `saveVariantFile` |
| "STATISTICAL ANALYSIS" (stat runs) | sidebar "Stat Analysis" / home card | `render.js renderStatRunView`; `window.handleStartStatRun` |
| "Dashboard" > Overview (tiles, Export All / Clear All + confirm, All/Sessions/Comparisons/Sequences, inline detail) | sidebar "Dashboard" / home card | `render.js renderDashboard`, `renderDashboardDetail`, `renderSessionDetail`, `renderComparisonDetail`, `renderSequenceDetail`; `api.js loadDashboardData`, `loadSessionDetail`… |
| "Dashboard" > Policy Scorecard | pill | `render.js renderScorecardView`; `window.handleGenerateScorecard` |
| "Dashboard" > Publication Export (templates, formats, filters, theme selector + live preview) | pill | `render.js renderPublicationExportView`, `applyThemeToPreview`; `components.js themeSelector`, `themePreviewPanel`; `window.handleGeneratePublication`, `handleThemeChange`, `handleDownloadPublication` |
| "Policy Claims Browser" (provider tabs, claim rows) | sidebar/home "Policy Browser" | `render.js renderPolicyBrowser`; `api.js showPolicyBrowser`, `loadPolicies` |
| Compliance scorecard (policy vs session) — dead code | none (no button; `showComplianceView` loads data but `renderMain` never dispatches to it) | `render.js renderComplianceScorecard`; `api.js showComplianceView`, `loadCompliance` |
| "Coach Examples (n)" (Pushback Coach) | home "Pushback Coach" card | `render.js showCoachExamples`; `api.js editCoachExample` (native prompt), `deleteCoachExample` |
| "Settings" view (per-provider key cards, Ollama, Default Coach Backend) | sidebar/home "Settings" | `render.js renderSettingsView`; `handleSaveKey`, `handleClearKey`, `handleTestKey`; `api.js saveCoachDefault` |
| "Regression Snapshots" browser + diff | "Save Baseline" / "Compare to Baseline" (session with runs) | `render.js renderSnapshotBrowser`, `renderSnapshotDiff`; `api.js showSaveSnapshotDialog` (native `prompt()`), `showSnapshotBrowser`, `loadSnapshotDiff` |
| "Experiments" list / empty state / cards | sidebar "Experiments" | `experiment.js initExperimentUI`, `renderExperimentList`, `renderEmptyState`, `renderExpCards` |
| "New Experiment" wizard (Basic Info → Conditions → Models & Probes → Review) | "+ New Experiment" | `experiment.js renderCreateWizard`, `renderWizardStep1..4`; `ui.wizardNext`, `addCondition`, `addModel`, `submitCreate` |
| Experiment dashboard (progress, configuration, Start/Pause/Resume, Results/Export) | open card | `experiment.js renderExpDashboard`, `startProgressSSE`, `updateProgressUI` |
| Experiment Results / "Statistical Analysis" / "Export" views | dashboard buttons | `experiment.js renderResultsView`, `renderAnalysisView`, `renderExportView` |
| "Condition Comparison" dashboard (per-condition cards, Compute Metrics, Export CSV, response browser) | card button / `openConditionDashboard` | `render.js renderConditionComparisonDashboard`, `_renderConditionDashboardHTML`, `_populateConditionProbePicker`; `window._conditionComputeMetrics`, `_conditionRunAnalysis`, `_loadConditionResponses`, `_resumeExperiment` |
| Turn detail modal (`#turn-detail-modal`) | run detail | index.html markup; `api.js viewRun` |

## Problems observed during the baseline (for the rebuild backlog)

1. Test suite is empty under pytest and the only test crashes when run directly (`get_async_db()` is a context manager, test awaits it).
2. `flinch/app.py` uses `logging` without importing it (ruff F821 ×2, app.py:667/676) — a latent `NameError` in the batch-conditions error path.
3. Version drift: `pyproject.toml` 0.8.0 vs `flinch/__init__.py` 0.5.0 (shown in UI and `/api/version`).
4. Experiments wizard cannot create an experiment: `experiment.js submitCreate` posts `{conditions:[{name,type,system_prompt}], models, probe_set_ids, repetitions}` but `CreateExperimentRequest` wants `conditions[].label` (+ non-empty `system_prompt`) and `model_ids` → 422. Even on success it reads `result.id` while the API returns `{experiment, conditions}`.
5. Experiment results view fetches `/api/experiments/{id}/results` (404); server route is `/responses`.
6. Experiment dashboard renders blank name, "Models 0", "Created —", and condition bars labelled "has system prompt" (field-name mismatch between `experiment.js` and the experiment/condition payloads).
7. `Load Defaults` imports the Markdown file's H1 title block ("# Flinch Example Probes" + its description) as a probe under "Uncategorized".
8. Session `<select>` keeps showing "— no session —" after a session is active via `handleSessionChange` (options are `["", "1"]`, `state.currentSession.id === 1`, but `sel.value` stays `""`).
9. New Session modal is taller than an 800px viewport (no internal scroll), so its top (title/name field) is clipped; probe picker domain rows render oddly (checkbox then right-aligned label).
10. Root layout depends on `https://cdn.tailwindcss.com` at runtime for four utility classes; offline/blocked CDN collapses the two-column layout.
11. Two parallel key-entry UIs (settings.js modal vs render.js Settings view) backed by different endpoints.
12. Several flows use native `prompt()`/`confirm()` dialogs (snapshot name, edit pushback, deletes).
13. Dead markup: legacy `#compare-modal` in index.html is not reachable from any button.
14. Missing `/favicon.ico` (404 on every load).
15. Compliance scorecard view (`renderComplianceScorecard`, `/api/sessions/{id}/compliance`) is dead code: no button opens it and `renderMain` has no branch that renders it.
16. Policy scorecard enforcement labels look reversed. For `should_refuse` claims, `compute_scorecard` labels a refused rate below 20% "over" and 20-80% "under" (`flinch/db.py:3143`). For `should_allow` claims, any compliance below 80% is "under" (`flinch/db.py:3145`). Found in code during rebuild planning (2026-10-15, iteration 2), not in the tour: the tour's scorecard had no data.
18. The experiment dashboard opens `new EventSource('/api/experiments/{id}/progress')` (`flinch/static/experiment.js:125`), but that route returns plain JSON (`flinch/app.py:2944-2947`), so no `progress` event ever arrives and the progress bars never update. Found in code during rebuild planning (2026-10-16, iteration 3). (Number 17 is reserved for the conditional desktop key-persistence check in the plan's T10.)
19. Starting an experiment likely fails with 422: `POST /api/experiments/{id}/start` declares `req: StartExperimentRequest` with no default (`flinch/app.py:2901`), so FastAPI requires a JSON body, and v0.8.0's `startExp` posts none (`flinch/static/experiment.js:949`). Confirmed from code, unverified at runtime: the baseline tour never reached Start (problem 4). Found during rebuild planning (2026-10-16, iteration 4).

## Files in this folder

- `env.txt` — Python/pip/freeze record
- `pytest.txt`, `ruff.txt`, `verify-phase1.txt` — gate outputs
- `app.log` — server log for the no-key run (startup + every request made during the tour)
- `baseline.db` — SQLite DB produced by the tour (probes, session, experiment)
- `screenshots/1280x800/`, `screenshots/1024x700/` — 50 PNGs each + `manifest.json` + `console-errors.txt`; `screenshots/shoot-log.txt`
- `api-routes.md` — every route in `flinch/app.py`
- `index.md` — this file
