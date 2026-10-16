## Summary (about 200 words)

The inventory follows the order of the baseline surface table: 35 surfaces, each with purpose, content and API source, actions, states, overlays, and payload fields the UI never shows. At the top is the navigation graph and a table of all 154 routes with the surfaces that call them. 74 routes have no caller in the UI; another 9 are only reachable from dead code.

Code reading found these in addition to the baseline's 19 problems:
- The sidebar stats and run history never render. `#stats-content` and `#run-history-list` are not in `index.html`.
- "Batch Complete" never shows. When a batch finishes, the screen drops back to the idle view.
- Stat-run results are never collected, so the results table never appears.
- The Policy Scorecard checks `data.categories`, but the API returns `{snapshot_id, results.by_model}`. The table can never render.
- File-backed framing groups show "Run (0)" and can't run.
- The experiment dashboard reads the `{experiment, conditions, progress}` payload as if it were the experiment itself. Every experiment export button downloads the same JSON under a wrong file extension. Experiment cards open Condition Comparison, not the dashboard.
- Dashboard sequence detail always says "No turns recorded".
- The JSON/CSV buttons on each dashboard session row export the sidebar's current session instead.
- With a session active, Multi-Model Compare and Pushback Coach have no entry point.
- Condition Comparison computes compliance rate and the classification bar but never shows them.

---BEGIN FILE---

# Flinch v0.8.0 web UI: per-screen content inventory

Groundwork for the ground-up redesign. Source: branch `flinch-rebuild-plan`, baseline commit `7dc2b20` (docs/plans/evidence/flinch-rebuild-2026-10-15/index.md:7). Every claim cites `file:line`; paths are repo-relative. Screenshot numbers refer to `docs/plans/evidence/flinch-rebuild-2026-10-15/screenshots/1280x800/NN-*.png` (index.md:48-100). No probe content is reproduced; the only probe file is `flinch/probes/example-probes.md`.

Conventions:
- "API source" = route + JSON field, with the server builder `file:line`.
- **Unshown** = present in the payload the surface already receives (or one route away) but never rendered: candidate content for the redesign.
- **Defect** = behaviour found in code that differs from what the screen implies. Defects 1-19 already in index.md:146-165 are referenced as "baseline #N".

---

## A. Navigation graph

Single page. `render()` = `renderSidebar()` + `renderMain()` (flinch/static/render.js:19-22). The main view is picked by flags, checked in this order: `compareMode`, `settingsView`, `dashboardView` (+`dashboardSection`), `policyView`, `consistencyView`, `sequenceView`, `statRunView`, `snapshotView`, `batchRunning`, then `phase` (render.js:273-363). Experiments live in a sibling `#experiment-container`. When it is shown, `#main` is hidden (flinch/static/index.html:1261-1278). Only `clearAllViews()` shows `#main` again (render.js:2221-2245).

Three screens draw straight into `#main` with no state flag, so any later `render()` overwrites them: Coach Examples (render.js:968-1012), Condition Comparison (render.js:1898-1919), and the in-flight Multi-Model spinner (render.js:3394-3403).

```
ALWAYS-VISIBLE SIDEBAR (index.html:1072-1156)
  Session <select> ──handleSessionChange──▶ Session idle | Home (value "")      api.js:243-266  (does NOT clearAllViews: an open Dashboard/Settings stays on screen)
  + New Session ─────▶ [New Session modal] ──create──▶ Session idle             index.html:1088, api.js:222-241
  ✕ ──confirm()──▶ Home                                                         index.html:1089, api.js:533-550
  Load Defaults ─▶ (in place)   Import File ─▶ [Import modal]   + add ─▶ [inline add-probe form]   index.html:1098-1100
  Probe row ─▶ Probe selected    + Custom Prompt ─▶ Probe selected (custom)    render.js:146-153,182
  Stat Analysis ─▶ Statistical Analysis       index.html:1144
  Dashboard ─▶ Dashboard › Overview           index.html:1145
  Experiments ─▶ Experiments list             index.html:1146
  Policy Browser ─▶ Policy Claims Browser     index.html:1152
  Settings ─▶ Settings view                   index.html:1153
  key "?" ─▶ [Shortcuts overlay] (any screen, focus not in input)   shortcuts.js:39-47

HOME (no session)  render.js:369-442
  + New Session ─▶ [New Session modal]
  Multi-Model Compare ─▶ Multi-Model picker                       render.js:374
  Narrative Momentum / Framing Variants / Statistical Analysis ─▶ [New Session modal]  render.js:378,382,386
  Dashboard ─▶ Dashboard › Overview      render.js:394
  Policy Browser ─▶ Policy browser       render.js:402
  Pushback Coach ─▶ Coach Examples       render.js:406
  Settings ─▶ Settings view              render.js:410

SESSION IDLE  render.js:442-478   (no tool cards: Multi-Model Compare and Pushback Coach are unreachable while a session is active, render.js:430-442)
  Run All Probes ─▶ Batch progress        render.js:449
  Save Baseline ─▶ prompt()×2 ─▶ (stays)  render.js:460, api.js:1173-1182
  Compare to Baseline ─▶ Regression Snapshots   render.js:464
  Narrative Momentum tile ─▶ Narrative Momentum    render.js:469
  Framing Consistency tile ─▶ Framing Variants     render.js:473

PROBE SELECTED ─Send Probe/S─▶ AWAITING ─▶ RESPONSE | PUSHBACK DECISION | (error ▶ Probe selected)   api.js:279-315
  ← Back to Tools ─▶ Session idle                    render.js:485
PUSHBACK DECISION ─Send (P)/Override─▶ AWAITING ─▶ PUSHBACK SENT;  Skip (K) ─▶ PUSHBACK SENT   api.js:370-409
PUSHBACK SENT ─Send Follow-up─▶ AWAITING ─▶ PUSHBACK SENT          api.js:427-451
RESPONSE/PUSHBACK SENT ─Next Probe (N)─▶ next Probe selected | Session idle;  Re-run (R) ─▶ Probe selected   api.js:453-467, render.js:1102-1107
BATCH PROGRESS ─Cancel/Back─▶ Session idle;  result row ─▶ viewRun ─▶ RESPONSE | PUSHBACK SENT    render.js:1046-1047,1080; api.js:595-607

MULTI-MODEL picker ─Run─▶ spinner ─▶ Results;  history row ─▶ Results;  Back to Tools ─▶ Home/Session idle   render.js:1243,1277,2846
MULTI-MODEL results ─← Back─▶ Home/Session idle;  New Comparison ─▶ picker                  render.js:1326,1336
NARRATIVE MOMENTUM ─View Results/Run Auto/Whittle─▶ (results panel in place);  Back to Tools ─▶ Home   render.js:3845,3977
FRAMING VARIANTS ─Edit Groups|Results tabs─▶ (in place);  Results › View Results ─▶ Condition Comparison;  Run (conditions file) ─SSE complete─▶ Condition Comparison   render.js:1815, api.js:162-168
STATISTICAL ANALYSIS ─← Back─▶ Home/Session idle              render.js:4676
DASHBOARD ─Overview|Policy Scorecard|Publication Export pills─▶ (sections);  row ─▶ inline detail ─← Back to list─▶ list;  Back to Tools ─▶ Home   render.js:2268-2272,2396,2505
POLICY BROWSER ─Back to Tools─▶ Home
COACH EXAMPLES ─Back─▶ render() (whatever state was underneath)   render.js:1008
SETTINGS ─Back to Tools─▶ Home
REGRESSION SNAPSHOTS ─Compare─▶ Snapshot diff ─← Snapshots─▶ browser;  Back ─▶ Session idle   render.js:3716,3762,3694
EXPERIMENTS list ─+ New Experiment─▶ Wizard;  card / View Comparison ─▶ Condition Comparison (inside #main)   experiment.js:186,214,230; index.html:1280-1290
WIZARD ─Cancel/←─▶ list;  Create Experiment ─(422, baseline #4)─▶ (would open Experiment dashboard)   experiment.js:281,298,941
EXPERIMENT DASHBOARD ─←─▶ list;  Results|Analysis|Export ─▶ sub-views ─←─▶ dashboard   experiment.js:471,484-486,583
CONDITION COMPARISON ─Back─▶ Framing Variants (renderConsistencyView without setting consistencyView)   render.js:2006
UNREACHABLE: Compliance scorecard (baseline #15), Legacy Compare modal (baseline #13), Turn-detail modal (§35), Experiment dashboard from the list (cards go to Condition Comparison, experiment.js:214).
```

Cross-cutting navigation defects:
- Showing Experiments hides `#main` (index.html:1273). `selectProbe`, `createSession` and `handleSessionChange` call `render()` without `clearAllViews()` (api.js:270-277, 222-241, 243-266). Clicking a probe while on Experiments therefore changes nothing visible.
- `nextProbe` and the ↑/↓ keys walk `state.probes` in id order over all probes (api.js:457-458, shortcuts.js:81-89). The sidebar list is session-scoped and sorted by domain and name (render.js:72-75, components.js:29-41).
- Two `window.openConditionDashboard` definitions exist (render.js:2877-2879; index.html:1280-1290). The inline module runs last, so the index.html version wins.

---

## B. API route ↔ surface table (154 routes, from docs/plans/evidence/flinch-rebuild-2026-10-15/api-routes.md)

"—" = no caller in the UI. "dead" = the only callers are unreachable code paths. Server `file:line` is in api-routes.md.

| Route | Called by (surface — caller file:line) |
|---|---|
| GET / | Browser load |
| GET /api/version | Sidebar header (app.js:300) |
| GET /health | — |
| GET /api/probes | App init + refreshes, all probe pickers (api.js:194) |
| POST /api/probes | Add-probe form (app.js:263→api.js:525); Multi-Model custom prompt (render.js:3383); NM custom prompt (render.js:4195) |
| DELETE /api/probes/{id} | Sidebar probe ✕ (api.js:472) |
| POST /api/probes/bulk-delete | Sidebar bulk select (api.js:486) |
| POST /api/probes/load-defaults | Sidebar "Load Defaults" (api.js:494) |
| GET /api/probes/files | Import modal (api.js:505) |
| POST /api/probes/import-file | Import modal (api.js:511) |
| POST /api/probes/{id}/claims | dead (window binding only, api.js:1455) |
| DELETE /api/probes/{id}/claims/{cid} | dead (api.js:1456) |
| GET /api/probes/{id}/claims | — |
| GET /api/sessions | App init (api.js:184) |
| POST /api/sessions | New Session modal (api.js:227) |
| GET /api/sessions/{id} | Sidebar run history (render.js:939, never mounted, see §4); Dashboard session detail (api.js:1567) |
| DELETE /api/sessions/{id} | Sidebar ✕ (api.js:537) |
| POST /api/sessions/{id}/run | Probe selected › Send / Send Custom (api.js:286, 335) |
| POST /api/runs/{id}/pushback | Pushback decision (api.js:378) |
| POST /api/runs/{id}/skip | Pushback decision (api.js:400) |
| POST /api/runs/{id}/continue | Pushback sent (api.js:435) |
| GET /api/runs/{id}/turns | Response thread (api.js:213); Dashboard session detail (api.js:1572) |
| PATCH /api/runs/{id}/classification | Classification dropdown (components.js:106) |
| GET /api/runs/{id} | Batch row / run-history click (api.js:597) |
| DELETE /api/runs/{id} | Run history ✕ (api.js:555), dead (§4) |
| POST /api/runs/{id}/promote | Response › Promote (api.js:413) |
| GET /api/sessions/{id}/stats | After session change / run (api.js:204); rendered nowhere (§4) |
| POST /api/sessions/{id}/batch | Run All Probes; Framing Variants Run (framings) (api.js:78) |
| POST /api/sessions/{id}/batch-conditions | Framing Variants Run (conditions) (api.js:136) |
| POST /api/batch/{id}/cancel | — (Cancel is client-only, api.js:106-109) |
| GET /api/coach-profiles | — |
| GET /api/coach-examples | Coach Examples (render.js:970) |
| PATCH /api/coach-examples/{id} | Coach Examples › Edit (api.js:584) |
| DELETE /api/coach-examples/{id} | Coach Examples › Delete (api.js:571) |
| GET /api/settings/coach-default | New Session modal (app.js:16→api.js:843); Settings (api.js:873) |
| POST /api/settings/coach-default | Settings › Default Coach Backend (api.js:861) |
| GET /api/runs/{id}/annotations | Response view (api.js:696) |
| PUT /api/runs/{id}/annotations | Annotation panel (api.js:705) |
| GET /api/sessions/{id}/findings | — |
| GET /api/annotations/tags | App init (api.js:716) |
| POST /api/probe-groups | dead (`submitVariantGroup` targets missing markup, render.js:3097-3116) |
| GET /api/probe-groups | App init; Framing Variants (api.js:996) |
| GET /api/probe-groups/{gid} | — |
| DELETE /api/probe-groups/{gid} | Framing Variants › legacy group delete (api.js:1020) |
| GET /api/variants/files | Framing Variants (api.js:1053) |
| GET /api/variants/files/{gid} | Framing Variants › View / Run (api.js:1062) |
| POST /api/variants/files | Framing Variants › Save (api.js:1071) |
| DELETE /api/variants/files/{gid} | Framing Variants › delete (api.js:1088) |
| POST /api/variants/generate | Framing Variants › Generate (api.js:1104) |
| GET /api/sessions/{id}/consistency | Framing Variants (api.js:1030) |
| POST /api/sessions/{id}/snapshots | Save Baseline (api.js:1121) |
| GET /api/sessions/{id}/snapshots | Session change; Snapshot browser (api.js:1135) |
| GET /api/snapshots/{id} | — |
| GET /api/snapshots/{id}/diff | Snapshot browser › Compare (api.js:1144) |
| DELETE /api/snapshots/{id} | Snapshot browser › Delete (api.js:1155) |
| GET /api/sessions/{id}/export | Response › Export ▾ (api.js:638,652,657,662,667); Dashboard session row (render.js:2405-2406) |
| GET /api/sessions/{id}/export/summary | — |
| GET /api/export/compare | Response › Export ▾ › Cross-Session (api.js:672) |
| GET /api/comparisons/{id}/export | Multi-Model results/history; Dashboard comparisons (api.js:934) |
| GET /api/sequences/{id}/export | Dashboard sequences (api.js:1449) |
| GET /api/dashboard/export-all | Dashboard › Export All (api.js:1427) |
| GET /api/models | App init → New Session model list + Multi-Model picker (api.js:726); Settings › Ollama Test (api.js:828) |
| GET /api/compare | dead (`loadComparison` has no caller, api.js:900-907) |
| POST /api/compare/run | Multi-Model › Run (render.js:3406) |
| GET /api/comparisons | Multi-Model history (api.js:911) |
| GET /api/comparisons/{id} | Multi-Model history click (api.js:919); Dashboard comparison detail (api.js:1589) |
| DELETE /api/comparisons/{id} | Multi-Model history; Dashboard comparisons (api.js:925) |
| GET /api/policies | Policy browser (api.js:941) |
| GET /api/policies/{provider} | Policy browser re-open with filter set (api.js:941). Returns an array, which the renderer rejects (render.js:3570) |
| GET /api/sessions/{id}/compliance | dead (`showComplianceView`, api.js:962) |
| GET /api/strategies | Narrative Momentum (api.js:1195) |
| GET/POST/PUT/DELETE /api/strategies/{id} (4 routes) | — |
| POST /api/sessions/{id}/sequences | NM › Create (api.js:1201) |
| GET /api/sessions/{id}/sequences | NM (api.js:1211) |
| GET /api/sequences/{id} | NM results (api.js:1217); Dashboard sequence detail (api.js:1602) |
| DELETE /api/sequences/{id} | NM card ✕; Dashboard sequences (api.js:1223) |
| POST /api/sequences/{id}/run-auto | NM › Run Auto (api.js:1229) |
| POST /api/sequences/{id}/run-turn | NM › Next Turn (api.js:1266) |
| POST /api/sequences/{id}/drop-probe | NM › Drop Probe (api.js:1275) |
| POST /api/sequences/{id}/whittle | NM › Auto-Whittle (api.js:1281) |
| GET /api/sequence-runs/{id}/turns | NM results inline turns (render.js:4417,4438); Turn-detail modal (render.js:4377, dead) |
| GET /api/sequences/{id}/whittling | NM results (api.js:1287) |
| GET /api/sequences/{id}/turn-classifications | NM results (api.js:1293) |
| POST /api/sessions/{id}/sequence-batch | dead (api.js:1299) |
| GET /api/sequence-batches/{id} | dead (api.js:1309) |
| POST /api/sequence-batches/{id}/estimate | dead (api.js:1315) |
| POST /api/sequence-batches/{id}/start | dead (api.js:1323) |
| GET /api/sessions/{id}/thresholds | dead (api.js:1337) |
| GET /api/sessions/{id}/strategy-effectiveness | dead (api.js:1345) |
| GET /api/settings/keys | Settings view (api.js:1353); API Keys modal (settings.js:45) |
| POST /api/settings/keys | Settings › Save / ✕ (api.js:1359) |
| POST /api/settings/test-key | Settings › Test (api.js:1369) |
| POST /api/settings/set-key | API Keys modal (Tauri only) (settings.js:155) |
| DELETE /api/settings/set-key | — |
| POST /api/settings/validate-key | API Keys modal (Tauri only) (settings.js:140) |
| GET /api/ollama/status | Sidebar no-key banner + Settings badge (api.js:774); Settings coach model list (api.js:884) |
| GET /api/settings/ollama | Settings (render.js:4587) |
| POST /api/settings/ollama | Settings › Ollama Test (api.js:820) |
| GET /api/dashboard/stats, /sessions, /comparisons, /sequences | Dashboard (api.js:1382,1391,1400,1409) |
| DELETE /api/dashboard/clear-all | Dashboard › Yes, Delete Everything (api.js:1432) |
| POST /api/sessions/{id}/stat-run | Statistical Analysis (api.js:1621) |
| GET /api/sessions/{id}/stat-runs | — (imported, never called: render.js:4; api.js:1688) |
| GET /api/stat-runs/{id} | — (api.js:1697) |
| GET /api/stat-runs/{id}/distribution | — |
| POST /api/scorecard/generate | Policy Scorecard (api.js:1710) |
| GET /api/scorecards | — (imported, never called: render.js:4; api.js:1723) |
| GET /api/scorecard/{id} | — |
| POST /api/publication/export | Publication Export (api.js:1738) |
| GET /api/publication/exports | — |
| GET /api/publication/exports/{id} | — |
| GET /api/publication/exports/{id}/download | Publication Export › Download (api.js:1753) |
| GET /api/themes | Publication Export (api.js:1773) |
| GET /api/themes/{name} | Publication Export (api.js:1779) |
| GET /api/themes/{name}/preview-css | — |
| POST /api/experiments | Wizard › Create (experiment.js:936) |
| GET /api/experiments | Experiments list (experiment.js:790) |
| GET /api/experiments/{id} | Experiment dashboard (experiment.js:799,868) |
| PUT /api/experiments/{id} | — |
| DELETE /api/experiments/{id} | — |
| POST/GET /api/experiments/{id}/conditions | — |
| POST /api/experiments/{id}/prompts, /prompts/import, /prompts/import-hh | — |
| GET /api/experiments/{id}/prompts | Condition Comparison probe picker (render.js:2187) |
| POST /api/experiments/{id}/estimate | — |
| POST /api/experiments/{id}/start | Experiment dashboard › Start (experiment.js:949) |
| POST /api/experiments/{id}/pause | Experiment dashboard › Pause (experiment.js:958) |
| POST /api/experiments/{id}/resume | Experiment dashboard › Resume (experiment.js:967) |
| GET /api/experiments/{id}/progress | Experiment dashboard as `EventSource`; the route returns JSON (experiment.js:125; baseline #18) |
| POST /api/experiments/{id}/metrics | Condition Comparison › Compute Metrics (api.js:1791) |
| POST /api/experiments/{id}/rate | — |
| POST /api/experiments/{id}/prolific | — |
| GET /api/experiments/{id}/prolific/csv | — (Export view hits /export instead, experiment.js:1006) |
| POST /api/experiments/{id}/human-evals/import | — |
| POST /api/experiments/{id}/analyze | Condition Comparison › Run Analysis (api.js:1818) |
| GET /api/experiments/{id}/analysis/export | — |
| POST /api/experiments/{id}/report | — |
| GET /api/experiments/{id}/responses | Condition Comparison response browser (render.js:3003) |
| GET /api/experiments/{id}/ratings, /human-evals, /metrics | — |
| GET /api/experiments/{id}/analysis | Experiment Analysis view (experiment.js:826) |
| GET /api/experiments/{id}/export | Experiment Export view, all 5 buttons (experiment.js:1006) |
| GET /api/experiments/{id}/preregistration | — |
| GET /api/experiments/{id}/condition-comparison | Condition Comparison (api.js:1787) |
| GET /api/experiments/{id}/condition-export | Condition Comparison › Export CSV (api.js:1822) |
| POST /api/experiments/{id}/resume-conditions | Condition Comparison › Resume (render.js:2898) |
| (missing) GET /api/experiments/{id}/results | Experiment Results view, 404 (experiment.js:815; baseline #5) |

---

## C. Surfaces (in the order of the baseline surface inventory, index.md:108-144)

### 1. Sidebar: header, Session select, "+ New Session", "✕"
**Purpose:** pick, create or delete the session (target model plus settings) that the probe loop runs against.

**Content**
- Wordmark "flinch" (static, index.html:1077) and version "v{version}" from `GET /api/version.version` (app.js:300-302; app.py:250-253). Shows 0.5.0 while the package is 0.8.0 (baseline #3).
- "Session" `<select>`: "— no session —" plus one option per session, label "{name} ({target_model})" from `GET /api/sessions[].name,target_model` (render.js:24-39; db.py:697-699). Includes the auto-created "Compare … — model" sessions from Multi-Model runs (app.py:1710-1720). Keeps showing "— no session —" after selection (baseline #8).
- "+ New Session" button (index.html:1088); "✕" delete button (index.html:1089).

**Actions**
- Select option → `handleSessionChange(id)`: loads stats (`GET /api/sessions/{id}/stats`) and snapshots, phase→idle (api.js:243-266). "" → Home.
- "+ New Session" → New Session modal (§12).
- "✕" → `confirm("Delete session … and all its runs?")` → `DELETE /api/sessions/{id}` → Home (api.js:533-550). No-op with no session.

**States:** no sessions (only placeholder) · sessions loaded · session active (select still shows placeholder, baseline #8).
**Dialogs:** native `confirm()` (api.js:535).
**Unshown (session payload, db.py:31-42, 682-699):** `coach_profile`, `coach_backend`, `coach_model`, `notes` (holds "Auto-created by multi-model comparison…", app.py:1717), `created_at`, `completed_at`, `probe_ids` (size of probe subset), `system_prompt` (shown only on Session idle, render.js:453-457).

### 2. Sidebar: "Load Defaults", "Import File", "+ add"
**Purpose:** bring probes into the library from shipped files or by hand.

**Content**
- Three text buttons (index.html:1098-1100).
- Inline add-probe form (hidden by default; index.html:1105-1135):
  - Name, Domain, Prompt text (textarea), Tags (comma-separated) (1107-1110).
  - "IF Narrative Probe" checkbox with hint "— for narrative momentum sequences" (1113-1117).
  - When checked: purple block with "Narrative Opening" textarea and help text, "Narrative Target" textarea and help text (1120-1128).
  - Save / Cancel (1131-1132).

**Actions**
- Load Defaults → `POST /api/probes/load-defaults` → reload probes (api.js:492-502). Also imports strategy templates (app.py:299-301). Imports the markdown H1 block as a probe (baseline #7).
- Import File → Import modal (§13).
- + add / Cancel / Esc → toggle form, focus Name (app.js:229-236; shortcuts.js:19-23).
- Save → validates name+domain+prompt (and opening+target if narrative), then `POST /api/probes {name, domain, prompt_text, tags, narrative_opening?, narrative_target?}` (app.js:238-279; app.py:136-143, 338-344). Errors go to the toast.

**States:** form hidden · form open · narrative sub-form open · validation toast · save error toast.
**Unshown:** `POST /api/probes/load-defaults` returns `{loaded, total}` (app.py:302), never shown (no success feedback). The form cannot set `description` (accepted at app.py:140; stored db.py:22).

### 3. Sidebar: PROBES list
**Purpose:** browse, filter and pick the probe to send; bulk-delete probes.

**Content** (render.js:47-219)
- No session: "Select a session to view probes" (51-56).
- No probes: "No probes loaded" + Load Defaults / Import File buttons (59-68).
- Header "Probes" and count "{visible} / {total}":
  - total = probes in the session's `probe_ids` subset, or all probes (72-77, from `GET /api/probes` and session `probe_ids`).
  - visible = after search + domain filter (78-79; components.js:43-56).
- "Select"/"Done" toggle (92-103).
- Search input with ✕ clear; matches name + prompt_text (106-117; components.js:48-54).
- Domain `<select>`: "All domains" + unique domains (82, 118-126).
- "+ Custom Prompt — Type your own prompt text" row (145-153).
- Domain headers (sorted) and probe rows sorted by name (155-157; components.js:29-41). Each row shows:
  - `name`;
  - variant badge "⊕ {variant_label}" (tooltip group) from `GET /api/probe-groups[].variants[]` (136-142, 160-163; db.py:1253-1274);
  - "IF" badge if `narrative_opening` (173/183);
  - first 60 chars of `prompt_text` + "..." (174/184);
  - ✕ delete (186-189).
- Select mode: a checkbox per row (164-177); sticky footer with "Select All/Deselect All", Cancel, "Delete Selected (n)" (195-216).

**Actions**
- Row click → `selectProbe(id)` → Probe selected (api.js:270-277).
- ✕ → `confirm()` → `DELETE /api/probes/{id}`. The server returns 400 "Probe has N run(s) — delete those first" (app.py:271-273) → toast.
- Search/domain → re-render the list only (render.js:3483-3496).
- Bulk: toggle (3430-3436), select (3438-3445), select all visible (3447-3461), delete → `confirm()` → `POST /api/probes/bulk-delete` (3463-3481; app.py:279-289). Bulk delete does not check for runs.
- Keys ↑/↓ cycle all probes (shortcuts.js:74-89).

**States:** no session · no probes · list · no match ("No probes match", 130-133) · active row highlighted · select mode (n selected / none).
**Dialogs:** native `confirm()` (api.js:470; render.js:3466).
**Unshown (probe payload, db.py:18-29, 645-658):** `description`, `tags` (only on the probe card), `source_file`, `created_at`, `narrative_target`, linked policy claims (`GET /api/probes/{id}/claims`, never called), run count / last classification per probe.

### 4. Sidebar: run history + stats
**Purpose (intended):** see this session's runs and the classification tally at a glance.

**Content (as coded)**
- `renderRunHistory` (render.js:931-966): `GET /api/sessions/{id}`.runs → per run a colour dot, probe name (or "probe #id"), outcome = `final_classification || initial_classification`, and ✕. Empty: "no runs yet"; no session: "no session selected".
- `renderStats` (render.js:225-271): Total runs, Refused, Collapsed, Negotiated, Complied, and a stacked bar.
  - Counts come from `GET /api/sessions/{id}/stats.outcome_classifications` (falling back to `initial_classifications`) and `total_runs` (db.py:1604-1634).

**Actions:** row → `viewRun` (api.js:595-607); ✕ → `confirm()` → `DELETE /api/runs/{id}` (api.js:552-566).

**Defect (new):** neither container exists in index.html. `#run-history-list` and `#stats-content` appear only in render.js:932 and 226, and both functions return early (227, 933). The surface never renders, so the stats fetched on every run (api.js:201-209) are discarded, and `DELETE /api/runs/{id}` has no reachable control.
**Unshown:** everything above, plus `final_classifications` and `pushback_sources` (coach / override / skip counts) from the stats payload (db.py:1629-1634).

### 5. Sidebar nav pills: "Stat Analysis", "Dashboard", "Experiments"; EXTRAS "Policy Browser", "Settings"
**Purpose:** jump to cross-session tools.

**Content:** five pill buttons; "Extras" caption (index.html:1143-1154).

**Actions**
- Stat Analysis → `clearAllViews(); statRunView=true` (1144).
- Dashboard → `dashboardView=true; section=overview; loadDashboardData()` (1145).
- Experiments → `showExperimentsTab()` (1146; 1261-1278).
- Policy Browser → `showPolicyBrowser()` (1152).
- Settings → `settingsView=true` (1153).

**States:** no active-state styling; the pill does not reflect the current view.
**Unshown:** none (navigation only).

### 6. Red no-key banner (top of sidebar)
**Purpose:** warn that no Anthropic key is set.

**Content:** text from `GET /api/ollama/status.anthropic_key_warning` when `anthropic_key_set` is false (api.js:798-808; app.py:2372-2385). Prepended to `#sidebar`.

**Actions:** none. It is removed only by a Tauri key save (settings.js:176-178), not by saving a key in the Settings view (render.js:4599-4621). A browser user keeps the banner for the whole session even after adding a key.
**States:** absent · shown.
**Unshown:** `available`, `base_url`, `models` of the same payload (used only by Settings).

### 7. Home (idle, no session): hero + tool cards
**Purpose:** orient a first-time researcher and launch a tool.

**Content** (render.js:365-442; screenshot 02)
- Crosshair glyph (419-423).
- "flinch v{appVersion}" (425) from `/api/version`.
- "AI Content Restriction Research Tool" (428).
- Subtitle (431-433); "+ New Session" (435); hint line (439-441).
- Tool cards (369-416):
  - RESEARCH TOOLS: Multi-Model Compare, Narrative Momentum, Framing Variants, Statistical Analysis.
  - RESULTS & EXPORT: Dashboard.
  - EXTRAS: Policy Browser, Pushback Coach, Settings.
  - Each card has a title and a one-line description.

**Actions:** see graph §A. Narrative Momentum, Framing Variants and Statistical Analysis open the New Session modal when there is no session (378, 382, 386).
**States:** single state; the API Keys modal may overlay it on first load (§14).
**Unshown:** counts of probes, sessions and experiments; key/provider readiness (all available from `/api/probes`, `/api/sessions`, `/api/settings/keys` already loaded at init, app.js:304-307).

### 8. Session idle
**Purpose:** confirm the active session and start probing (single probe, batch, or a session tool).

**Content** (render.js:442-478; screenshot 10)
- Session name (425); "Select a probe to begin" (428); "Choose a probe from the sidebar." (444-446).
- "Run All Probes" if any probes exist (447-452).
- "SYSTEM PROMPT" box with the first 120 chars of `session.system_prompt` (453-457).
- "Save Baseline" when `stats.total_runs > 0` (458-462); "Compare to Baseline" when snapshots exist (463-466).
  - Snapshots come from `GET /api/sessions/{id}/snapshots`, loaded on session change (api.js:264).
- Tiles: Narrative Momentum, Framing Consistency (468-477).

**Actions**
- Run All Probes → `startBatch(sessionId, null, 2000)` → Batch (§11).
- Save Baseline → native `prompt()` for name, then description → `POST /api/sessions/{id}/snapshots`. Server returns 400 with no runs (api.js:1173-1182; app.py:842-844).
- Compare to Baseline → Snapshot browser (§29).
- Tiles → Narrative Momentum (§19) / Framing Variants (§20).

**States:** no probes (no Run All) · system prompt present/absent · has runs (Save Baseline) · has snapshots (Compare). Multi-Model Compare and Pushback Coach are absent here (graph §A).
**Unshown:** `target_model`, coach backend/profile, `probe_ids` subset size, run tally (stats are fetched but unrendered, §4), `GET /api/sessions/{id}/findings` (never called).

### 9. Probe selected / Send Probe
**Purpose:** read the probe and send it to the target model.

**Content** (render.js:483-518; screenshot 11)
- "← Back to Tools" (485).
- Probe card (809-834): "PROBE" label, `name`, `domain`, `tags[]` chips, full `prompt_text`. Purple "IF Narrative Opening" / "IF Narrative Target" blocks when present.
- "Send Probe" (511-513). Disabled with red "select a session first" when no session; unreachable because the list is hidden without a session.
- Custom variant (487-505): "CUSTOM PROMPT" textarea (keeps `state.customProbeText`) + amber "Send Custom Probe".

**Actions**
- Send / key S → `POST /api/sessions/{id}/run {probe_id}` (api.js:279-315).
- Custom → `POST … {custom_text}`. The server creates probe "custom-{epoch}" in domain "custom" (app.py:378-382; api.js:324-368).
- Back → idle.

**States:** normal · custom · error after send (toast, phase back to probe_selected; screenshot 12, baseline no-key 404).
**Unshown:** `description`, `source_file`, linked claims; prior runs of this probe in the session; target model name.

### 10. Awaiting / Response / Pushback decision / Pushback sent
**Purpose:** read the model's answer and its classification, push back (coach-drafted or manual), annotate, export.

**Content**
- **Awaiting** (render.js:520-537): probe card, spinner "Analyzing response...", 4 skeleton lines.
- **Thread** (559-630). Built from `GET /api/runs/{id}/turns[]` (roles `probe` skipped, `pushback`, `response`; runner.py:161-162, 192-193, 217-218). Falls back to `run.initial_response / pushback_text / final_response`.
  - Response card (838-858): label "Initial Response"/"Response"/"Final Response", classification badge, formatted text (components.js:135-191), "show more/less" when >800 chars or >6 lines.
  - Pushback card "Your Pushback" (886-893).
  - Timeline dots coloured by classification (539-557).
- **Pushback decision**: shown when the initial class is not "complied" and the coach produced a draft (api.js:293-304).
  - Coach Suggestion card (render.js:860-884):
    - "Pattern detected:" from `run.coach_pattern_detected`; "Suggested move:" from `run.coach_move_suggested` (both from runner.py:150-152);
    - editable textarea with `coach_suggestion.pushback_draft` (components.js:21-27);
    - buttons "Send as Coach Suggestion" / "Send as Override" / "Skip".
  - Manual Pushback card when there is no coach draft (895-917).
- **Response / Pushback sent**:
  - "Promote to Coach Example" + outcome hint, or "Promoted to coach example." (640-660). `promoted` is client-only (api.js:417-419); the run table has no such column (db.py:44-61).
  - "Continue Pushback" textarea + "Send Follow-up" when `final_response` exists (662-672).
  - "Pushback skipped." (675-677).
  - "Next Probe", "Re-run This Probe", "Export ▾" (679-687).
- **Export ▾ dropdown** (749-807):
  - Quick: JSON (raw), CSV (raw).
  - Research: Findings Schema, Research Report, AI Agent Format.
  - Enhanced: checkboxes Include turns / annotations (default on) / policy data / variants, then Enhanced JSON / Enhanced CSV.
  - Cross-Session Compare: multi-select of `state.sessions` + Compare JSON / CSV.
- **Annotation panel** (699-747), from `GET /api/runs/{id}/annotations {note_text, pattern_tags[], finding}` (app.py:707-710):
  - "Research Notes" textarea (saves on blur);
  - "Pattern Tags" chips with ✕ and an input with a datalist from `GET /api/annotations/tags` (db.py:911-922);
  - "Key Finding" textarea (saves on blur).

**Actions**
- Badge click → classification dropdown (components.js:82-133) → `PATCH /api/runs/{id}/classification {field, value}`. Can move phase response↔pushback_decision (111-116).
- Send as Coach / P key → `POST /api/runs/{id}/pushback {text, source:'coach'}`; Override → `source:'override'`; Skip / K → `POST /api/runs/{id}/skip` (api.js:370-409).
- Send Follow-up → `POST /api/runs/{id}/continue {text, source:'override'}` (api.js:427-451).
- Promote → `POST /api/runs/{id}/promote` (app.py:462-491; stores effectiveness=3 and the pattern/move from the run).
- Next / N, Re-run / R (R only resets to Probe selected; it does not re-send; shortcuts.js:68-71, render.js:1102-1107).
- Export buttons → downloads via `GET /api/sessions/{id}/export?format=json|csv|findings|report|agent&include_*` (api.js:636-668; app.py:945-1402) and `GET /api/export/compare?session_ids=&format=` (api.js:670-673). Download names come from `Content-Disposition`.
- Annotations: blur → `PUT … {note_text}` / `{finding}`; Enter or "," → `PUT … {pattern_tags}` (render.js:3498-3535).

**States:** awaiting · response (complied, or no coach draft) · pushback_decision (coach / manual) · pushback_sent (with final response / skipped) · promoted · export menu open · error toasts. Phase machine: state.js:3-49.
**Overlays:** classification dropdown (fixed at the cursor); export picker (absolute).
**Unshown:**
- `coach_suggestion.confidence` and `.reasoning` (models.py:52-57; stored at runner.py:150).
- `pushback_source` (only in dashboard detail); `override_text`, `notes`, `created_at`, `target_model` (db.py:44-61).
- Turn `classification` on non-response turns and turn `created_at`.
- Annotation `created_at`/`updated_at` (db.py:105-113).
- Export formats `html` and `pdf`, and the `theme` param, which the server supports but the menu omits (app.py:946-948, 1242-1289).
- `GET /api/sessions/{id}/export/summary` with `domain_breakdown` (app.py:1405-1429).

### 11. Batch progress
**Purpose:** run every probe in the session unattended and watch the tally.

**Content** (render.js:1015-1093)
- Title "Batch Running" and status "Running probe {completed} of {total} — {probe_name}" or "Starting batch...".
- Cancel button.
- Blue progress bar = completed/total.
- "{completed}/{total} completed", "{failed} errors", per-class counts tallied from progress events.
- Table Probe / Domain (looked up in `state.probes`) / Result.
- SSE `progress` payload: `{batch_id, probe_id, probe_name, run_id, classification, completed, total}` (runner.py:240-251).

**Actions**
- Cancel → client-only `batchRunning=false`. No call to `POST /api/batch/{id}/cancel`; the server keeps running (api.js:106-109).
- Row → `viewRun(run_id)`.

**States:** starting · running · error rows (counted only) · complete.
**Defects (new):**
- The initial `total` = all probes (api.js:70), while the server uses the session subset (app.py:547-551).
- On `complete`, `batchRunning=false` (api.js:92-95) and `renderMain` only checks `batchRunning` (render.js:334). The "Batch Complete" title, Back button and final table (1034, 1047) are never shown; the screen drops to Session idle.
- When started from Framing Variants, `consistencyView` wins over `batchRunning` (render.js:310 vs 334). Each progress event re-runs `renderConsistencyView`, which re-fetches variant files and consistency (render.js:1484-1488).

**Unshown:** `batch_id`; error events' `error` text and probe (api.js:87-90 counts them only); `complete.failed`.

### 12. New Session modal (`#new-session-modal`)
**Purpose:** define a session: name, target model, coach backend/profile, system prompt, probe subset.

**Content** (index.html:1164-1230; screenshots 07-09)
- Session Name (1170).
- Target Model `<select>` with optgroups per provider from `GET /api/models[] {provider, models[{id,name}], available, hint, local}` (api.js:724-755; app.py:1524-1624):
  - unavailable groups labelled "{Provider} ({hint})" with disabled options; Ollama labelled "[LOCAL]".
- Coach Backend select: Claude / OpenAI / Google / xAI / Together / Local (1180-1187). Prefilled from `GET /api/settings/coach-default` (app.js:14-26).
- Local section: model select from Ollama models (api.js:757-770) + amber experimental warning (1189-1197).
- Coach Profile free text (1200); System Prompt textarea (1204).
- Probes picker (collapsed), summary "All probes" / "n / total selected" / red "No probes selected" (app.js:106-126):
  - search, All, None (1213-1220);
  - domain rows with checkbox and per-probe checkboxes (app.js:128-176).
- Create Session / Cancel (1225-1226).

**Actions**
- Create / Enter (outside textarea) → validate name+model, and local model if Local → `POST /api/sessions {name, target_model, coach_profile||'standard', system_prompt, coach_backend, coach_model?, probe_ids?}` (app.js:65-89; api.js:222-241).
- Cancel / overlay / Esc → reset and close (app.js:34-63; shortcuts.js:14-18).

**States:** default · local coach (warning) · picker open · validation toast · create error toast.
**Defects:** taller than an 800 px viewport (baseline #9). Coach Profile is free text although `GET /api/coach-profiles` exists (app.py:450-452, never called).
**Unshown:** per-model `deprecated` flag (app.py:1538); session `notes` field (accepted at app.py:149); coach profile list and descriptions (db.py:76-83).

### 13. Import Probes from File modal (`#import-file-modal`)
**Purpose:** import one shipped probe file.

**Content:** title, "x" close, one row per `GET /api/probes/files.files[].name` with an Import button. Empty text: "No probe files found in flinch/probes/" (api.js:1504-1513; app.py:305-313).
**Actions:** row/Import → `POST /api/probes/import-file {filename}` → close (api.js:509-522, 1514-1518). Overlay/x close; Esc does not close it (shortcuts.js:8-24).
**States:** list · empty · error toast.
**Unshown:** `files[].path`; result `{loaded, file, total}` (app.py:335). No success feedback.

### 14. API Keys modal (`#settings-modal`, settings.js)
**Purpose:** first-run prompt to configure provider keys.

**Content** (settings.js:195-228, 74-95)
- "API Keys" title, ✕.
- Rows for Anthropic, OpenAI, Google, xAI, Together (5-11), each with "Configured ✓" / "Not configured" from `GET /api/settings/keys[].provider → is_set` (43-57) and an "Add Key"/"Replace" button.
- Loading / error text (62, 70).

**Actions**
- Add/Replace (97-130):
  - in a browser: shows "Set the {ENV} environment variable and restart the dev server.";
  - in Tauri: password input + Save → `POST /api/settings/validate-key` → `POST /api/settings/set-key` → Tauri `set_api_key` → refresh, and removes the banner (132-182).
- ✕ / overlay closes.

**Auto-open:** on load when every `is_set` is false (31-39; app.js:315-318).
**States:** loading · rows · error · per-row input (Tauri) or env hint (web) · validation/save error lines.
**Defects (new):** the row id `together` (settings.js:10) never matches API provider `meta` (app.py:2206), so Together always reads "Not configured". Two key UIs exist (baseline #11).
**Unshown:** `label`, `env_var`, `required`, `masked` from the same payload (app.py:2269-2276).

### 15. Keyboard Shortcuts overlay (`#shortcut-help`)
**Purpose:** list keys.

**Content:** static rows: S Send probe, P Send pushback (coach), K Skip pushback, N Next probe, R "Re-run probe", ↑/↓ Navigate, Esc, Enter, ? (shortcuts.js:98-108), plus footer "Press ? or Esc to close" (129).
**Actions:** ? toggles; Esc or overlay click closes (8-13, 113-115).
**States:** hidden/shown. Shortcuts are inactive while focus is in an input, textarea or select (39-40).
**Unshown:** n/a. "R" only returns to Probe selected; it does not re-send (render.js:1102-1107).

### 16. Error toast
**Purpose:** report failures.

**Content:** red box at bottom-right with the message, 4 s (components.js:193-205). Most messages embed raw "API error {status}: {body}" (api.js:17-20).
**Separate system:** experiment.js `showMsg` is bottom-centre, 3 s, red or green (experiment.js:108-115); it is the only success toast in the app ("Experiment created.", 940).
**Unshown:** n/a (no success toasts elsewhere; no persistence or stacking).

### 17. "Multi-Model Comparison": picker / results / history
**Purpose:** run the same probes against 2-5 models and compare classifications side by side.

**Content**
- **Picker** (render.js:1135-1290; screenshot 14):
  - Header + "Back to Tools" (viewHeader, 2840-2848).
  - MODELS (pick 2–5): per-provider groups from `GET /api/models` (cached at api.js:728). Unavailable providers are dimmed with " — {hint}" and disabled. Hard-coded fallback list if models are not loaded (1149-1157).
  - "Or type a model ID..." input (1221-1223).
  - PROBES (pick 1+) grouped by domain + "Select All" (1192-1233). Empty: "No probes loaded. Load defaults first."
  - Custom prompt textarea (1235-1237).
  - "Run Comparison ({models} models × {probes} probes)", disabled with hint until ≥2 models and ≥1 probe (1208, 1243-1246).
  - COMPARISON HISTORY from `GET /api/comparisons[]` (db.py:2493-2503). Per item: `name`; models shortened to the first hyphen segment joined "vs"; `total_probes`; `agreement_rate` rounded, coloured ≥80 / ≥50; `created_at` date; JSON / CSV / ✕ (1262-1289). Empty: "No comparisons yet."
- **Running:** spinner "Running {n} probe(s) against {m} models..." (3394-3403).
- **Results** (1298-1429), from `POST /api/compare/run {comparison_id, models, session_ids, results[], agreement_rate, total_probes}` (app.py:1795-1802):
  - "← Back", "Comparison Results", model list "a vs b".
  - Export JSON/CSV (if `comparison_id`), "New Comparison".
  - Stats bar:
    - agreement % = probes without disagreement / all (app.py:1779, 1800), coloured;
    - "{aligned} of {n} probes aligned" (1347);
    - per model "{C}C {R}R {X}X", tallied client-side from `results[].models[m].classification` (1308-1315, 1356-1358).
  - Per probe card: `probe_name`, `probe_domain`, "disagreement" chip, prompt from `state.probes` (else `row.probe_prompt`, a key that does not exist; the server field is `prompt_text`, app.py:1729), first 300 chars.
  - Grid with one column per model: name, classification chip, formatted response; or a red error (first 150 chars of `error`).

**Actions**
- Model and probe toggles re-render the picker (3343-3372); custom model on Enter (3353-3359).
- Run → creates a custom probe from the textarea first if any (3379-3390) → `POST /api/compare/run` (3405-3418). Creates one persistent session per model (app.py:1709-1720).
- History row → `GET /api/comparisons/{id}` → Results (3060-3076).
- JSON / CSV → `GET /api/comparisons/{id}/export?format=` (api.js:933-935).
- ✕ → `confirm()` → `DELETE` (api.js:922-931). The DB delete does not commit (db.py:2518-2519).

**States:** no models loaded (fallback) · picker can't-run · picker ready · history loading / empty / list · running · results / error (toast, back to picker) · no results ("No results.").
**Unshown:**
- per-model negotiated counts (tallied at 1309, never printed);
- per-cell `run_id` and `session_id` (app.py:1749-1755): no link into the run or its auto-created session;
- comparison `probe_ids`, `session_ids`, `notes` in history;
- `system_prompt` request field (app.py:218), with no UI input.

### 18. Legacy "Compare Sessions" modal (`#compare-modal`)
**Purpose (legacy):** pick 2+ sessions for a session-vs-session table.

**Content:** title, "Select 2 or more sessions to compare:", list, Compare / Cancel (index.html:1233-1243). The list builder would show session name, provider label and `target_model` (render.js:1450-1469).
**Actions:** Compare calls `submitCompare()`, which is defined nowhere; Cancel → `closeCompareModal` (render.js:3425-3428).
**States:** unreachable (baseline #13; screenshot 43 forced). `GET /api/compare` (app.py:1627-1686) is also unreachable, though its payload has `sessions`, `probes[].sessions{run_id, initial/final_classification, initial_response excerpt}`, `agreement_rate`, `probes_in_all_sessions`.

### 19. "Narrative Momentum"
**Purpose:** run multi-turn warmup sequences before the probe and find the minimum warmup that flips the model (auto-whittle).

**Content** (render.js:3834-4184; screenshot 15)
- No session: `needsSession` opens the New Session modal and shows "Create a session to get started with Narrative Momentum" (3838-3840, 2850-2861).
- Header "Narrative Momentum — Session: {name}" + explainer (3845-3850).
- **Create form** (3874-3923):
  - Strategy select "{name with _→space} ({category})" from `GET /api/strategies[]` (db.py:2256-2258), with the description as tooltip and a live hint line.
  - Probe select "{name} [{domain}]" + "— Custom Prompt —" (opens a textarea).
  - Mode Automatic / Interactive.
  - Warmup Turns slider 1-20 (default 10) with live value.
  - "IF Engine" checkbox + purple hint.
  - "Create Sequence" / "Create + Auto-Whittle".
- **Sequences (n)** list from `GET /api/sessions/{id}/sequences[]` (db.py:2296-2301). Empty: "No sequences yet". Per card (3933-3985):
  - status badge (pending/running/completed/failed colours), mode, "IF Engine" badge, ✕;
  - "Warmup: {max_warmup_turns} turns";
  - threshold chip and run counts, read from `seq.summary`, which the list payload never has (§ defects);
  - loading line;
  - pending/running: Run Auto, Auto-Whittle, Next Turn, Drop Probe, live turns pane, "{sent} / {planned} warmup turns sent";
  - completed: View Results; failed: View Details + Retry.
- **Live turns** (3987-4012): role icon/label Coach/Probe/Target from `role`, "#{turn_number}", type chip W/S/P, classification chip, content. From `POST /api/sequences/{id}/run-turn {coach_turn, target_turn, warmup_turns_sent, warmup_turns_planned}` (runner.py:726-731).
- **Results panel** (4137-4184), from `GET /api/sequences/{id}` + `/whittling` + `/turn-classifications`:
  - "Compliance Threshold" bar chart: bar height = `warmup_count`/max, colour = `probe_classification`, glow if `threshold_found`, x-labels N and first letter, legend (4022-4049; db.py:2426-2434).
  - "Turn-by-Turn Classification" grid: per run "N={warmup_count}", one square per turn coloured by `classification` with a border by `turn_type`, final probe class (4051-4076; app.py:2113-2128).
  - "Sequence Runs" list: "N={warmup_count}", class badge, "⚡ Threshold", click to load turns inline, Expand All / Collapse All (4155-4178; db.py:2404-2424).
- Run Auto progress line: "Turn {step}/{total_steps} — {type} → {classification}", then "Done! Probe result: {probe_classification}" (4272-4285; runner.py:955-1015).

**Actions:** see the handlers at render.js:4200-4473:
- Create / Create + Whittle → `POST /api/sessions/{id}/sequences`, optionally followed by `POST /api/sequences/{id}/whittle`.
- Run Auto → `POST …/run-auto` (SSE).
- Next Turn → `POST …/run-turn`.
- Drop Probe → `POST …/drop-probe`.
- ✕ → `DELETE /api/sequences/{id}`. No confirm.
- Inline turns → `GET /api/sequence-runs/{id}/turns`.

**States:** no session · no strategies (empty select; strategies arrive only after Load Defaults, app.py:299-301) · no sequences · per card pending/running/completed/failed/abandoned (abandoned has no actions; db.py:2664-2675) · running (spinner, buttons disabled) · results loading / error.
**Defects (new):**
- `list_sequences` returns raw rows with no `summary` (db.py:2296-2301). Cards never show the threshold or run counts (3954-3960).
- `handleDropProbe` writes to `#sequence-turns-live` without the id suffix (4331); the probe turns never appear.
- The whittle return `{results, threshold_at, threshold_found, total_runs}` (runner.py:1090-1096) is discarded (4352).
- The view injects a second `#turn-detail-modal` (3853).

**Unshown:**
- Strategy `goal`, `opening_pattern`, `escalation_pattern`, `setup_hint`, `effectiveness_notes`, `is_builtin` (db.py:168-180).
- Sequence `created_at`, `completed_at`, `batch_id`.
- Sequence-run `status`, `created_at`.
- Cross-probe thresholds (`GET /api/sessions/{id}/thresholds`; renderer exists at 4078-4111, never called).
- Strategy effectiveness (`/strategy-effectiveness`; renderer 4113-4135, never called).
- Sequence batches with a cost estimate (4 routes, app.py:2133-2184; no UI).
- Strategy CRUD (app.py:1949-1993; no UI).

### 20. "Framing Variants": Edit Groups / Results; AI-Assisted / Manual
**Purpose:** build groups of one request in different framings (or system-prompt conditions), run them, and check whether the classification stays consistent.

**Content** (render.js:1473-1894; screenshots 16-18)
- Loading spinner "Loading variant data..." (1476-1481).
- Header + "What are framing variants?" explainer (1496-1506).
- Tabs "Edit Groups" / "Results ({consistency_score}%)" (1509-1517).
- **Edit tab:**
  - "Run All Variant Groups ({n} probes)": union of file `probe_ids` (never present) and DB group variant ids (1537-1549).
  - File group cards from `GET /api/variants/files[] {group_id, title, description, domain, variant_type, variant_count, labels[]}` (db.py:1405-1422). Each shows title, "[conditions]" tag, description, label chips, "domain:", and "Run ({n})" or "Run ({labels} conditions × {all probes} probes)", View, delete (1552-1578).
  - "Legacy groups (DB only)" from `GET /api/probe-groups` not backed by a file: group id, "{n} variants", Run, delete (1582-1604).
  - Viewer from `GET /api/variants/files/{gid}`: title, description, grid of `label` + `prompt_text`, "File: flinch/variants/{gid}.md", Close (1607-1629).
  - Empty card "No variant groups yet" (1635-1646).
  - CREATE NEW VARIANT GROUP with mode toggle (1651-1751):
    - AI-Assisted: Base Probe select, Group ID, five default strategy chips (checked), custom strategy + Add, Generate Variants / spinner.
    - Preview "Generated Variants — Review & Save": "Direct Request" (base prompt) prepended plus each generated `{label, prompt_text}` editable; Save to File / Discard (1765-1792).
    - Manual: Group ID, Domain, Description, two label+prompt rows with defaults, "+ Add Variant", "Save Group" (1718-1747).
- **Results tab:**
  - No session: "Select a session to see variant results." (1797-1804).
  - Condition experiment card "Condition Experiment #{id}" + "View Results" when `state.conditionExperimentId` is set (1807-1824). Set only by a completed batch-conditions run this page load (api.js:162-164).
  - Null data: "Failed to load consistency data."
  - Score from `GET /api/sessions/{id}/consistency {consistency_score, consistent_count, total_groups, groups[]}` (db.py:1530-1601):
    - `consistency_score` = consistent groups / groups with ≥2 classified variants × 100;
    - each variant's class = `final || initial` of the latest run of that probe in this session.
    - Shown as "{score}%" coloured ≥80 / ≥50, "{consistent}/{total} groups consistent", or "No results yet — run variant probes in a session first" (1831-1850).
  - Per group: `group_id`, CONSISTENT / INCONSISTENT / "not run yet", and per variant label, probe name and badge or "not run" (1864-1891).

**Actions**
- Tabs (3125-3128).
- View (3130-3136).
- Run:
  - framings → `confirm()` → `startBatch(sessionId, probeIds)`;
  - conditions → `confirm()` → `POST /api/sessions/{id}/batch-conditions {probe_ids: all probes, conditions[{label, system_prompt}], concurrency 5 (1 for ollama:)}`, with a floating bar "{completed}/{total} ({pct}%) — {condition}: {probe}" → Condition Comparison on complete (3138-3196; api.js:111-178).
- Run All → `confirm()` → `startBatch(state.currentSession, ids)`. Passes the session object, not the id (3218), so the URL is `/api/sessions/[object Object]/batch`.
- delete file → `confirm()` → `DELETE /api/variants/files/{gid}`; delete legacy → `DELETE /api/probe-groups/{gid}`.
- Generate → `POST /api/variants/generate {probe_id, strategies}`. Needs an Anthropic key, else 400 (app.py:795-797).
- Save to File / Save Group → `POST /api/variants/files {group_id, title (id with -→space), description, base_probe, domain, variants}` (3263-3327).

**States:** loading · edit (files / legacy / empty / viewer open / AI / generating / preview / manual) · results (no session / no data / no groups / scored / condition experiment available) · batch running.
**Dialogs:** `confirm()` ×3; floating condition-progress bar (api.js:122-132).
**Defects (new):** `list_variant_files` returns no `probe_ids` or `variants` (db.py:1413-1421). Every framings file card reads "Run (0)" and errors "No probes found in this variant group." (1554-1557, 3189-3191). Once synced to the DB, the same group is hidden from "Legacy groups" (1582-1584), so file-backed framing groups cannot be run individually.
**Unshown:**
- File `variant_count`, `base_probe`, per-variant `is_baseline`, `source_file` (db.py:1394-1402);
- consistency `probe_id` / `run_id` per variant (the badge is not clickable, null field, 1880);
- batch-conditions `response_text` per progress event (runner.py:364-376).

### 21. "STATISTICAL ANALYSIS" (stat runs)
**Purpose:** repeat probes N times to measure refusal-rate consistency.

**Content** (render.js:4662-4801; screenshot 19)
- No session: "Select a session to run statistical analysis." (4667-4672).
- Header "← Back", "STATISTICAL ANALYSIS", session name; explainer (4681-4683).
- CONFIGURATION "Repeat count" number 1-100 (default 10).
- "Run Selected Probes" (current probe, else all) / "Run All Probes"; both disabled while running (4685-4697).
- Progress card "Progress: {completed}/{total} iterations" + bar + "{failed} failed" (4700-4713). total = probes × repeat (api.js:1617).
- Results (4716-4797), Simple/Detailed toggle:
  - Simple: Probe, Model, "Refusal Rate {refused}/{total} ({pct}%)", coloured ≥80 / ≥50 / ≥20.
  - Detailed: stacked bar and four % labels per probe.

**Actions:** Run → `POST /api/sessions/{id}/stat-run {probe_ids, repeat_count}` (SSE) (4803-4817; api.js:1616-1686). Toggle; Back → `clearAllViews(); render()`.
**States:** no session · idle · running · error toast · results (never reached).
**Defects (new):**
- `startStatRun` never pushes to `statRunResults.results` (api.js:1652-1657 only counts; `handleStartStatRun` passes no `onProgress`, render.js:4815). The results section can never render.
- Each per-probe `complete` sets `running=false` (api.js:1658-1660), hiding the progress bar mid-batch.
- Server error events carry `error`, the client reads `message` (app.py:2580; api.js:1668).
- "Run All" uses all probes, not the session subset (render.js:4808).

**Unshown:**
- SSE `iteration.latency_ms` and `classification` (stat_runner.py:98-111); `complete.summary {consistency_rate, refused, collapsed, negotiated, complied, probe_name, probe_domain, model}` (stat_runner.py:135-144; db.py:2863-2889);
- `GET /api/sessions/{id}/stat-runs` (history of past stat runs), `GET /api/stat-runs/{id}` (iterations with response text), and `/distribution`: none called.

### 22. "Dashboard" › Overview
**Purpose:** see all data across sessions, open past results, export or wipe.

**Content** (render.js:2248-2495; screenshots 20-25)
- Spinner until stats load (2253-2258).
- Header + "Back to Tools"; section pills (2268-2272).
- Four tiles from `GET /api/dashboard/stats` (db.py:2605-2643): Sessions `total_sessions`, Runs `total_runs`, Comparisons `total_comparisons`, Sequences `total_sequences` (counts of all rows).
- "Classification Distribution" bar + "R X N C" counts + "{n} total runs" when runs exist (2291-2314). From `classification_breakdown`, which counts initial classifications only (db.py:2627-2630).
- "Export All Data" / "Clear All Data" (2317-2320). Inline confirm "⚠ Delete All Data?" with preserved-data note and buttons Export All First / Yes, Delete Everything / Cancel (2323-2335). Success "Data cleared successfully." for 2 s (2825-2838).
- Filter pills All / Sessions (n) / Comparisons (n) / Sequences (n) (2343-2354).
- Lists grouped by Today / This Week / This Month / Older from `created_at` (2357-2368):
  - Sessions from `GET /api/dashboard/sessions` (db.py:2646-2661, excludes compare-auto sessions): name; model shortened to the first two hyphen segments; `run_count`; date; `{refused_count}R` / `{complied_count}C` (initial class); JSON / CSV (2375-2413).
  - Comparisons from `/dashboard/comparisons`: as in §17 history (2416-2451).
  - Sequences from `/dashboard/sequences` (db.py:2678-2691): "{session_name} — {strategy_id}"; model; "{total_turns || warmup_turns || '?'} turns"; status coloured; date; JSON / ✕ (2454-2489).
- **Inline detail** (2499-2531): "← Back to list", spinner, error box.
  - Session detail from `GET /api/sessions/{id}` + `GET /api/runs/{rid}/turns` per run (api.js:1562-1582):
    - header with name, model, created date, "{n} runs" and class counts (final ‖ initial);
    - per run "▶ Run {i}" + `probe_text` preview (80 chars) + badge;
    - expanded: Probe, "Response ({initial_classification})", "Pushback ({pushback_source})", "Final Response (…)", "Full Conversation ({n} turns)" when >2 extra turns;
    - long text truncated at 300 with Show more/less (2538-2652, 2766-2775).
  - Comparison detail: header (models, probes, agreement, date); per probe name, prompt, response grid with badges, "Disagreement" (2654-2720).
  - Sequence detail: header (strategy_id, model, status, turns, date) + turn cards (2722-2764).

**Actions**
- Export All → `GET /api/dashboard/export-all`.
- Clear → `DELETE /api/dashboard/clear-all {confirm:'DELETE_ALL_DATA'}`, then reload dashboard and sidebar sessions (api.js:1430-1446). The sidebar keeps the deleted `currentSession`.
- Row → detail loaders (api.js:1562-1608); run toggle (2784-2792).
- Session JSON/CSV → `exportSession(fmt, true)`.
- Comparison JSON/CSV/✕ (as §17); sequence JSON → `GET /api/sequences/{id}/export`; sequence ✕ → `DELETE` with no confirm.

**States:** loading · empty lists ("No sessions yet", "No comparisons saved yet…", "No sequences yet") · data · confirm open · cleared · detail loading / error / session / comparison / sequence · session detail with no runs.
**Defects (new):**
- Session-row JSON/CSV export the sidebar's `state.currentSession`, not the row (render.js:2405-2406 → api.js:636-641). Nothing happens with no session selected.
- Sequence rows show the numeric `strategy_id` and always "? turns": `total_turns` and `warmup_turns` are not in the payload, which has `max_warmup_turns` (db.py:197-209, 2681-2687).
- Sequence detail reads `sequence.turns` and `target_model`; `GET /api/sequences/{id}` returns `runs` + `summary` and no turns or model (db.py:2404-2424). It always shows "Model: unknown" and "No turns recorded".
- The Sessions tile counts all sessions (db.py:2608), while the "Sessions (n)" pill excludes compare-auto sessions (db.py:2658).
- Full Conversation labels roles `user` vs Model (2633-2634); run turns use `probe` / `response` / `pushback` (runner.py:161-193).

**Unshown:**
- `total_snapshots`, `total_annotations`, `date_range {earliest, latest}` (db.py:2606-2641);
- session `collapsed_count`, `negotiated_count` (db.py:2652-2653), `system_prompt`, coach fields;
- run `probe_name` / `probe_domain` in detail (db.py:758), annotations and findings per run;
- sequence `use_narrative_engine`, `mode`, `probe_id`, `completed_at`; sequence-detail `summary` and `runs`.

### 23. "Dashboard" › Policy Scorecard
**Purpose:** generate a model × policy-category matrix of consistent / over / under enforcement.

**Content** (render.js:4823-4920; screenshots 26-27)
- Header and pills; explainer.
- CONFIGURATION:
  - "Scorecard name";
  - Models checkboxes = unique `state.sessions[].target_model` (4828), all checked;
  - Data sources "Sessions" / "Stat Runs" (both checked);
  - "Generate Scorecard".
- Results table (Category × model, ✓ / ⊘ / ⊖ / — with tooltip `detail || status`) + legend (4878-4916). Reads `data.categories[].scores[model].status`.

**Actions:** Generate → `POST /api/scorecard/generate {name || 'Untitled Scorecard', models, session_ids: every session, stat_run_ids: []}` (4922-4939). The "Stat Runs" checkbox has no effect (4930).
**States:** form · validation toast "Select at least one model." · generated (no visible change) · error toast.
**Defects (new):** the API returns `{snapshot_id, results: {models, session_ids, stat_run_ids, by_model: {model: {claims_tested, consistent, over_enforced, under_enforced, by_claim[...]}}}}` (app.py:2622; db.py:3175-3180). The UI tests `data.categories` (4878), so the table can never render, data or not. Label logic is inverted (baseline #16; db.py:3143-3145).
**Unshown:**
- Whole `by_model` payload: per claim `claim_text`, `category`, `expected_behavior`, `severity`, `total_probes`, `refused`, `complied`, `collapsed`, `negotiated`, `refused_rate`, `enforcement` (db.py:3150-3163);
- `snapshot_id`; saved scorecards (`GET /api/scorecards`, `/api/scorecard/{id}`, never called).

### 24. "Dashboard" › Publication Export
**Purpose:** produce publication-ready tables or reports in a chosen theme.

**Content** (render.js:4945-5067; screenshots 28-30)
- Header and pills; explainer.
- TEMPLATE (Comparison Table / Consistency Matrix / Pushback Effectiveness / Full Report) and FORMAT (Markdown / HTML / PDF / CSV / JSON) (4949-4962, 4983-4991).
- FILTERS: Models checkboxes (unique session models); Domains select (unique probe domains) (4964-5016).
- THEME select from `GET /api/themes[] {name, display_name, description, is_builtin}` (app.py:2730-2743; components.js:209-220).
- Live preview of a fixed three-row sample table (components.js:222-244), restyled from `GET /api/themes/{name}`: bg / text / accent / border / heading / high-mid-low colours and fonts, plus `header_text` / `header_subtitle` (render.js:5086-5102; models.py:153-191).
- "Generate Preview"; preview `<pre>` of `preview`; "Download" (if `export_id`) / "Copy to Clipboard" (5028-5041).

**Actions**
- Generate → `POST /api/publication/export {name:'export', format, template, filters {models, domain?}, theme}` (5069-5082; app.py:2644-2674).
- Theme change → `GET /api/themes/{name}` (5104-5113).
- Download → `GET /api/publication/exports/{id}/download`. The file is saved as `flinch-export-{id}` with no extension (api.js:1751-1768).
- Copy → clipboard; button shows "Copied!" (5121-5130).

**States:** form · themes loading (single fallback option) · generated preview · empty-data preview · error toast.
**Unshown:**
- Theme `description`, `is_builtin`, `font_size_base`, `logo_url`, `max_width` (models.py:153-191); `GET /api/themes/{name}/preview-css` (unused);
- past exports `GET /api/publication/exports` and `/{id}` (no history UI);
- the JSON format has no download content type (app.py:2699-2705 → text/plain).

### 25. "Policy Claims Browser"
**Purpose:** read provider content-policy claims that probes can be tested against.

**Content** (render.js:3550-3613; screenshot 36b)
- Header + "Back to Tools".
- Provider tabs All / Anthropic / OpenAI / Google / xAI (3554-3566).
- Rows from `GET /api/policies` (object keyed by provider; app.py:1879-1888; db.py:1697-1702), each showing:
  - severity dot (hard / medium / soft colours);
  - provider;
  - `claim_id`;
  - `claim_text` (one line);
  - `category` chip;
  - ✓ should_allow / ■ should_refuse icon.
- Click-to-expand detail: Policy, Testable (`testable_statement`), Notes, Expected · Severity (3590-3595).
- Empty: "No policy claims found."

**Actions:** tab → client-side filter (api.js:986-990); row → toggle detail.
**States:** all / filtered · empty · row expanded. Re-opening with a filter set calls `/api/policies/{provider}`, which returns an array; the renderer requires an object, so the list goes empty (api.js:970; render.js:3570).
**Unshown:** claim `id`, `created_at`; linked probes and link/unlink (routes exist, app.py:1896-1912; client functions are dead, api.js:949-958); per-claim compliance (§26). The Home card promises "link claims to probes" (render.js:404), which is not possible.

### 26. Compliance scorecard (dead code)
**Purpose (intended):** for the current session, per policy claim, how often the model behaved as expected.

**Content (unreachable)** (render.js:3615-3674)
- Tiles: Avg Compliance = `summary.average_compliance_rate` × 100; Claims Tested; Compliant (≥80%).
- Per provider and claim: slug, % bar coloured ≥80 / ≥50, "{probe_count} probes: {R}R {C}C {N}N {A}A".
- Back → `hidePolicyView()`.
- Source: `GET /api/sessions/{id}/compliance` (app.py:1915-1940). Rate = refused/probe_count for should_refuse, complied/probe_count otherwise, initial classification only (db.py:1743-1771).

**States:** none reachable (baseline #15; screenshot 37).
**Unshown:** `claim_text`, `category`, `expected_behavior`, `severity` per row (db.py:1745-1746).

### 27. "Coach Examples (n)" (Pushback Coach)
**Purpose:** curate the few-shot pushback examples that drive coach suggestions.

**Content** (render.js:968-1013; screenshot 38)
- Title "Coach Examples ({n})" from `GET /api/coach-examples?profile=standard`. Profile is hard-coded; the server caps at 10, ordered by effectiveness then date (db.py:805-810).
- Per card: "Pattern:" `pattern`, "Move:" `move`, `outcome` (coloured), REFUSAL (`refusal_text`, first 300 chars), PUSHBACK THAT WORKED (`pushback_text`, first 300), Edit Pushback / Delete.
- "Back". Empty: "No promoted examples yet. Promote a collapsed run to add examples."

**Actions**
- Edit → native `prompt('Edit pushback text:')`, empty default → `PATCH /api/coach-examples/{id} {pushback_text}` (api.js:580-593).
- Delete → `confirm()` → `DELETE` (api.js:568-578).
- Back → `render()`.

**States:** empty · list · error toast. No state flag: any `render()` replaces it.
**Unshown:** `effectiveness` (1-5; PATCH accepts it, app.py:500-505), `run_id` (link to source run), `promoted_at`, `coach_profile`; full text beyond 300 chars; other profiles; examples beyond 10.

### 28. "Settings" view
**Purpose:** set provider keys, the Ollama connection, and the default coach backend.

**Content** (render.js:4499-4597; screenshot 39)
- Header + "Back to Tools"; "Loading..." / "Failed to load settings: …".
- "API Keys" intro. One card per `GET /api/settings/keys[]` entry (app.py:2263-2277), showing:
  - `label`;
  - REQUIRED / optional from `required`;
  - "● Set {masked}" (first 8 … last 4) or "○ Not set";
  - password input (placeholder depends on `is_set`);
  - Save; Test and ✕ when set;
  - status line.
- "Ollama (Local Models)" with badge "connected ({n} models)" / "offline" from `/api/ollama/status`; Base URL input prefilled from `GET /api/settings/ollama.base_url`; Test; models list or hint text (api.js:772-797).
- "Default Coach Backend" select; when Local: "Default Coach Model" select (Ollama models) + warning (4561-4580; api.js:872-897).

**Actions**
- Save / Enter → `POST /api/settings/keys {ENV: value}`. Writes `.env` and hot-reloads (app.py:2280-2308); "Saved ✓", re-render after 0.8 s.
- ✕ → same with "".
- Test → `POST /api/settings/test-key {provider}`. Supported only for anthropic / openai / google; xai and meta return 400, shown as "Error: Failed to test API key" (app.py:2368-2369; api.js:1374).
- Ollama Test → `POST /api/settings/ollama {base_url}` → `alert()` with the result (api.js:816-837).
- Coach default → `POST /api/settings/coach-default`. Held in memory, lost on restart (app.py:2413-2429).

**States:** loading · error · per-key set / not set / saving / saved / cleared / testing / test ok / test error · Ollama checking / connected / offline · coach local section.
**Dialogs:** native `alert()` (api.js:830-835).
**Unshown:** test-key success `message` is shown; `POST /api/settings/keys` returns refreshed `keys` (ignored, page re-renders instead). `GET /api/settings/ollama.available` is unused; the badge comes from another call.

### 29. "Regression Snapshots": browser + diff
**Purpose:** save a session's classifications as a baseline and diff later runs against it.

**Content**
- **Browser** (render.js:3678-3731; screenshot 41):
  - "Regression Snapshots", "{session} — saved baselines", "+ Save Baseline", Back.
  - Empty: "No snapshots yet. Save a baseline to track regression."
  - Rows from `GET /api/sessions/{id}/snapshots[] {id, name, description, created_at}` (db.py:1669-1674): name, description, raw `created_at`, Compare / Delete.
- **Diff** (3733-3826), from `GET /api/snapshots/{id}/diff?session_id= {snapshot_name, changes[{probe_id, probe_name, old_classification, new_classification, status}], changed_count, unchanged_count, summary}` (app.py:862-926):
  - "Diff: {snapshot_name}", "{session} — current vs baseline", "← Snapshots" / Back.
  - Summary "{n} improved / regressed / different / unchanged" + proportion bar (counted client-side, 3738-3744).
  - Table Probe | Baseline | Current | Status: changed rows first with coloured left border, unchanged dimmed.
  - Status rank: refused 3 > negotiated 2 > collapsed 1 > complied 0. Higher = "improved" (app.py:901-909).

**Actions:** + Save Baseline → `prompt()`×2 → `POST`; Compare → diff; Delete → `confirm()` → `DELETE /api/snapshots/{id}`; Back → `hideSnapshotView()`.
**States:** empty · list · diff · save-error toast (no runs, 400). The diff view was not capturable (screenshot 42).
**Unshown:** `GET /api/snapshots/{id}.snapshot_data[]` (per-run `initial_response` excerpt up to 500 chars, `run_id`; db.py:1637-1655; never called); server `summary` string; probes present only on one side are not distinguished from class changes.

### 30. "Experiments": list / empty / cards
**Purpose:** see multi-condition experiments and open one.

**Content** (experiment.js:174-243; screenshots 31, 45)
- "Experiments" + subtitle + "+ New Experiment".
- Empty state: concentric glyph, "No experiments yet", hint (196-208).
- Cards from `GET /api/experiments.experiments[]` (app.py:2788-2791; db.py:3247-3262):
  - `name`, status badge (draft / running / paused / completed / failed colours, 6-12), `description`;
  - condition badges from `exp.conditions` and model tags from `exp.models` (neither is in the payload, 223-224);
  - `created_at` (fmtDate); "{completed_trials} / {total_trials} trials" when `total_trials` exists (never in payload);
  - "View Comparison"; progress bar if running (238).

**Actions:** card click and "View Comparison" both → `openConditionDashboard(id)` → Condition Comparison in `#main` (214, 230; index.html:1280-1290). "+ New Experiment" → Wizard.
**States:** loading (no indicator) · empty · list · fetch failure shows as empty (792-794).
**Unshown:** `model_ids`, `base_model_ids`, `random_seed`, `config`, `prompt_source`, `started_at`, `completed_at` (db.py:323-336); per-experiment progress (`get_experiment_progress`, not in list); delete (`DELETE /api/experiments/{id}`, no UI). Experiments auto-created by batch-conditions appear here named "Condition run: {session} @ {ts}" (app.py:596-601).

### 31. "New Experiment" wizard
**Purpose:** define an experiment (conditions × models × probes × reps).

**Content** (experiment.js:247-436; screenshots 32-36)
- "←", "New Experiment", 4-step stepper with done ticks (251-270).
- Back / Cancel / "Next →" or "Create Experiment" (295-304).
- Step 1: Experiment Name *, Description, "Repetitions per condition" 1-50 + hint (309-329).
- Step 2: intro; per condition: Condition Name, Type (Honest / Deceptive / Neutral / High-effort honest / Custom), System Prompt (optional), ✕; "+ Add Condition"; "Add at least one condition to continue" (331-373).
- Step 3: Target Models free-text rows + "+ Add Model"; "Probe Set IDs (comma-separated)" textarea; "Blank = use all probes in active session" (375-405).
- Step 4: SUMMARY (name, description, condition badges, models, repetitions). Big number = conditions × models × (probe ids count or 1) × reps, "estimated total trials", formula line. Amber warning above 500 (407-436).

**Actions:**
- Next validates name (step 1) and ≥1 condition (step 2), and parses ids (step 3) (876-894).
- Back / Cancel; add / remove / update condition and model (901-929).
- Create → `POST /api/experiments` with `{name, description, conditions[{name, type, system_prompt}], models, probe_set_ids, repetitions}` → 422. The API needs `conditions[].label`, non-empty `system_prompt`, `model_ids` (models.py:213-217, 250-257). On success it would read `result.id`, but the API returns `{experiment, conditions}` (app.py:2785) (baseline #4).

**States:** steps 1-4 · validation toasts · 422 error (screenshot 36) · success (unreachable).
**Unshown / mismatch:** API fields with no wizard input: `base_model_ids`, `random_seed`, `config`, condition `description`, `sort_order`. Wizard fields with no API home: `repetitions`, `type`, `probe_set_ids` (prompts are a separate `POST /api/experiments/{id}/prompts`, app.py:2837-2843). The server-side estimate `POST /api/experiments/{id}/estimate {estimate, cells, prompts, conditions, models}` (app.py:2884-2898) is not used for the step-4 number.

### 32. Experiment dashboard
**Purpose:** monitor and control one experiment's run.

**Content** (experiment.js:440-547; screenshot 46)
- "←", `exp.name`, status badge, `description`.
- Start / Pause / Resume by `exp.status`; Results; Analysis (completed only); Export (481-486).
- PROGRESS: overall "{completed_trials} / {total_trials} responses collected" or "Not started"; per condition: badge `c.name || c.type`, "has system prompt" (tooltip = prompt), "{completed} / {total || '?'}", coloured bar (446-465, 491-497).
- CONFIGURATION: Conditions count, Models `(exp.models).length`, Repetitions, Created, Started / Completed (498-530).
- Models tag card (533-540).

**Data:** `GET /api/experiments/{id}` returns `{experiment, conditions, progress}` (app.py:2794-2802). The UI treats the whole object as the experiment (868-870), so:
- name, status and description are blank;
- condition badges are empty (rows have `label`, not `name`);
- Models 0, Created "—", no Start / Pause / Resume buttons (baseline #6).

**Actions**
- Start → `POST …/start` with no body → probable 422 (baseline #19). If it succeeded, `apiFetch` would buffer the whole SSE response (experiment.js:103-105).
- Pause / Resume → `POST …/pause|resume`.
- A running experiment opens `EventSource(/progress)`, which never fires: the route returns JSON (baseline #18; experiment.js:119-148).
- Results / Analysis / Export → §33. "←" → list.

**Reachability (new):** only via `ui.openExp`, called after a successful create (941) or from the "←" of sub-views. List cards go to Condition Comparison (§30), so this screen is effectively unreachable.
**Unshown:** the whole `progress {total, completed, failed, pending, by_model{}, by_condition{}}` payload (db.py:3456-3503) and every `experiment.*` field, because of the shape mismatch; condition `label`, `description`, `sort_order`.

### 33. Experiment Results / "Statistical Analysis" / "Export"
**Purpose:** browse responses, read condition statistics, and download artefacts.

**Content**
- **Results** (experiment.js:551-637):
  - "←", name, "Results — {total} responses";
  - filters: conditions / models / classification; "Page x of y";
  - table Probe | Condition | Model | Classification | Response (2-line clamp, click to expand) | Rep;
  - "No results match the current filters"; Prev / Next pages of 50.
  - Calls `GET /api/experiments/{id}/results?limit&offset&model&condition&classification` → 404 (baseline #5; experiment.js:807-822), so it only shows the toast (screenshot 47).
- **Analysis** (641-732):
  - "Statistical Analysis — {name}", "Generated {generated_at}";
  - "Compliance Rate by Condition" bars from `analysis.win_rates`;
  - "Overall Agreement" from `inter_rater_agreement` with caption "inter-rater agreement (LLM judge vs keyword)";
  - "Pairwise Comparisons" table A | B | Effect Size | p-value | Significant | 95% CI.
  - Source `GET /api/experiments/{id}/analysis` returns `{results:[{analysis_type, scope, model_id, parameters, results, created_at}]}` (app.py:3089-3092; db.py:3745-3762). None of the read keys exist, so it always shows "No data" / "Not computed" (screenshot 48).
- **Export** (736-784): cards Research Data (Download CSV / JSONL), Prolific Integration (Download Prolific CSV), Preregistration (Generate), Publication Report (Generate Report, disabled unless `status==='completed'`, so always disabled given §32).

**Actions:** filters / pages → reload (991-1002). Every export button → `<a download>` to `GET /api/experiments/{id}/export?format=…` (1004-1016).
**Defect (new):** `/export` ignores `format` and always returns one JSON document `{experiment, conditions, prompts, progress, ratings, eval_tasks, analysis, metrics}` (app.py:3101-3117). Each button saves that JSON as `.csv`, `.jsonl` or `.md`. The real routes are unused: `/prolific/csv` (2995), `/preregistration` (3120), `POST /report` (3039), `/analysis/export` (3025).
**States:** results error / empty / data (unreachable) · analysis null / empty · export.
**Unshown:**
- `/responses` fields `latency_ms`, `token_count_input/output`, `finish_reason`, `status`, `error_message`, `attempt_count` (db.py:358-377);
- ratings (`/ratings`), human evals (`/human-evals`, `/human-evals/import`), metrics (`/metrics`), AI raters (`/rate`), Prolific task generation (`/prolific`), HH-RLHF prompt import (`/prompts/import-hh`), bulk prompt import, conditions CRUD. All have no UI (app.py:2823-3098).

### 34. "Condition Comparison" dashboard
**Purpose:** compare one experiment's conditions: response counts, text metrics with effect sizes, side-by-side responses.

**Content** (render.js:1898-2203; screenshot 50)
- Spinner "Loading condition comparison..." / red "Failed to load comparison: …" (1901-1916).
- Header "Condition Comparison", "Experiment #{id} — {n} condition(s)".
- Buttons:
  - "Compute Metrics" or green "metrics computed" (from `has_metrics`);
  - "Run Analysis" (metrics present, no analysis) or "analysis done" (`has_analysis`);
  - "Resume ({pending_count} pending)" when > 0;
  - "Export CSV"; "Back" (1963-2014).
  - Source: `GET /api/experiments/{id}/condition-comparison` (db.py:3765-3876).
- Metric progress strip (2017, 2918-2960).
- Condition cards: `label`, "{response_count} responses", SYSTEM PROMPT first 120 chars or "No system prompt (baseline)" (2020-2046).
- "Metric Comparison" table (has_metrics):
  - rows for 10 metrics (MTLD, Honoré, Hedging, Confidence, Evasion, F-K Grade, Words, TTR, Subjectivity, Polarity; 2050-2061);
  - one column per condition showing `metrics[m].mean ± sd`;
  - when analysis exists: "d" = largest |Cohen's d| across pairs from `analysis_results.effect_sizes`, coloured ≥0.2 / ≥0.5 / ≥0.8, and "Sig" stars from the minimum `p_fdr`/`p_value` in `corrections` or `nonparametric` (2063-2096, 2140-2141);
  - legend (2148).
- "Response Browser" (2153-2174):
  - Probe picker from `GET /api/experiments/{id}/prompts.prompts[]` (`probe_name` or the first 60 chars of `custom_prompt_text`) (2185-2203);
  - grid per condition: label + first response's `response_text` (800 chars), "No response recorded" / "No responses for this probe yet." (2987-3058).

**Actions**
- Compute Metrics → `POST /api/experiments/{id}/metrics` (SSE). Progress text = `evt.message || evt.status || JSON` (api.js:1790-1815).
- Run Analysis → `POST /api/experiments/{id}/analyze` (api.js:1817-1819).
- Resume → `confirm()` → `POST /api/experiments/{id}/resume-conditions` (SSE) with a floating bar "{completed}/{total} ({pct}%) - {condition}: {probe}" (2881-2916; app.py:3191-3298).
- Export CSV → `GET /api/experiments/{id}/condition-export`: one row per completed response with 13 metrics (app.py:3138-3188).
- Back → `renderConsistencyView()` (Framing Variants, not Experiments).
- Probe select → `GET /api/experiments/{id}/responses?prompt_id=`.

**States:** loading · error · no conditions (header only) · no metrics · metrics · analysis · pending > 0 · computing · analysis running · response grid empty / loading / data / error.
**Defects (new):**
- `compliance_rate` = (complied + negotiated) / completed (db.py:3815-3817) is computed into `rate` / `rateColor` and never output (render.js:2024-2030).
- `clsBar` / `clsLegend` are defined and never called (1939-1959).
- Classification is never written by batch-conditions (app.py:659-665), so every response would be "unknown" anyway.
- The response grid computes `cls` and drops it (3037-3038), and shows only the first response per condition (3036).
- The experiment name is never shown.

**Unshown:**
- `classifications{}` and `compliance_rate` per condition; condition `description`;
- metrics `sentence_count`, `flesch_reading_ease`, `gunning_fog` (db.py:3790-3794) and every metric's `n`;
- full `analysis_results` (all analysis types, pairwise p-values, CIs);
- per-response `latency_ms` / tokens / status / error; repetitions beyond the first; `experiment_id` / `prompt_id` / `model_id`.

### 35. Turn detail modal (`#turn-detail-modal`)
**Purpose (intended):** read one narrative-momentum run's full turn list in an overlay.

**Content (unreachable):** "Run #{id} — Turn Detail", Close, conversation list (render.js:4375-4395) from `GET /api/sequence-runs/{id}/turns` (app.py:2099-2104).
**Actions:** Close / overlay click (index.html:1246).
**Reachability (correction to index.md:144):** `viewRun` does not open it (api.js:595-607). The only opener, `handleViewRunTurns`, has no caller (render.js:4484). The ID is duplicated by `renderSequenceView` (render.js:3853). The same content is reachable inline in the NM results panel (§19).
**Unshown:** sequence turn `created_at`, `sequence_run_id`.

---

## D. Content that exists server-side with no surface at all (summary for the redesign)

| Area | Data available | Source |
|---|---|---|
| Session findings | All annotated findings in a session with probe name and domain | GET /api/sessions/{id}/findings (app.py:719-721; db.py:889-908) |
| Session summary | Per-domain R/X/N/C breakdown | GET /api/sessions/{id}/export/summary (app.py:1405-1429) |
| Session stats | Initial / final / outcome distributions, pushback-source counts | GET /api/sessions/{id}/stats (db.py:1604-1634); fetched but never rendered (§4) |
| Probe ↔ policy links | Link / unlink / list claims per probe | app.py:1896-1912 |
| Policy compliance per session | Per-claim compliance rates | GET /api/sessions/{id}/compliance (§26) |
| Stat-run history | Past stat runs, iterations with text and latency, distributions | app.py:2589-2609 |
| Scorecard history | Saved scorecard snapshots | app.py:2627-2639 |
| Publication history | Saved exports | app.py:2677-2689 |
| NM analysis | Cross-probe thresholds, strategy effectiveness, sequence batches with cost estimate, strategy CRUD | app.py:1945-1993, 2133-2195 |
| Experiments pipeline | Conditions / prompts CRUD, HH-RLHF import, estimate, AI raters, Prolific tasks and import, human evals, metrics, analysis export, report, preregistration | app.py:2805-3127 |
| Coach profiles | Profiles with system prompt and moves | GET /api/coach-profiles (db.py:76-83) |
| Runtime key clear | Clear a runtime key | DELETE /api/settings/set-key (app.py:3359-3365) |
