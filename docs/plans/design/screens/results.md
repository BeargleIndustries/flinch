# Results

- Route(s): `#/results`
- Section: Results
- Purpose (one sentence, what the researcher does here): see how much has been recorded (and what each count is made of), reopen any recent session, study or experiment, export one item or everything, and wipe the data with a typed confirmation.
- Arrives from: header nav "Results"; Home "Results" card and "recent" rows; Toasts after exports ("See all exports"). Leaves to: Probe workbench (`#/probe/:s`), Studies › Models (`#/studies/models/:id`), Studies › Context (`#/studies/context/:id`), Experiments (`#/experiments/:id`), Benchmarks run (`#/benchmarks/runs/:id`), Results › Scorecard, Results › Publication; back with the header nav.
- Components used: Header, PrimaryNav, Tabs (Results sub-nav: Overview, Policy scorecard, Publication export), Panel, Readout, Stat, Rate, Bar, Table, Chip, OutcomeBadge, Button, Menu, Dialog (confirm variant), Toast, Term, Caveat, EmptyState, FirstTimeTip.
- Baseline surfaces replaced: §22 "Dashboard › Overview" (four tiles, classification distribution bar, Export All / Clear All with inline confirm, filter pills, grouped lists with per-row JSON/CSV, inline detail). Inline detail is replaced by navigation to the owning screen (IA §4: "Turn detail modal → Thread on the run column").

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   … Results …  ? ⚙  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Overview   Policy scorecard   Publication export                                 │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ┌ What is recorded  since 2026-09-30 ─────────────── [Export everything] [Clear…]┐ │
│    │ ▣ In plain words: 12 sessions hold 184 runs. 7 of 12 sessions were made by     │ │
│    │   Models studies. 184 runs were first labelled: 101 refused, 29 collapsed,     │ │
│    │   11 negotiated, 43 complied. Nothing is running now.                         │ │
│    │ ┌SESSIONS┐ ┌RUNS────┐ ┌STUDIES─────────────┐ ┌EXPERIMENTS┐ ┌BENCHMARK RUNS┐     │ │
│    │ │ 12     │ │ 184    │ │ 9                  │ │ 2         │ │ 0            │     │ │
│    │ │5 yours,│ │in 12   │ │3 models · 4 context│ │1 done,    │ │none yet      │     │ │
│    │ │7 auto  │ │sessions│ │· 2 over time       │ │1 running  │ │              │     │ │
│    │ └────────┘ └────────┘ └────────────────────┘ └───────────┘ └──────────────┘     │ │
│    │ FIRST LABELS, ALL RUNS         0%        50%       100%                        │ │
│    │  refused     ███████████░░░░░░░░░░  55% (101 of 184)                            │ │
│    │  collapsed   ███░░░░░░░░░░░░░░░░░░  16% (29 of 184)                             │ │
│    │  negotiated  █░░░░░░░░░░░░░░░░░░░░   6% (11 of 184)                             │ │
│    │  complied    █████░░░░░░░░░░░░░░░░  23% (43 of 184)                             │ │
│    │  ⓘ First label per run, before any pushback. The label is a keyword scan plus  │ │
│    │    a judge model's guess. You can change it.                                   │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│ R3 ┌ Recent  [All 23] [Sessions 5] [Models studies 3] [Context studies 4] [Experiments 2] [Snapshots 2] ┐
│    │ TODAY                                                                         │ │
│    │  session   crime-set-1        claude-sonnet-4-6   12 runs · 7 of 12 refused   14:02  [Open] [Export ▾] │
│    │  models    4 models × 6 probes                     agreement 4 of 6 probes     13:10  [Open] [Export ▾] [Delete…] │
│    │ THIS WEEK                                                                     │ │
│    │  context   crime-set-1 · fiction workshop · the-stabbing   completed · up to 10 turns  Mon  [Open] [Export ▾] [Delete…] │
│    │  experiment tone-vs-none       2 conditions · 2 models   running 18 of 60     Tue  [Open] │
│    │ OLDER                                                                         │ │
│    │  …                                                                            │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
The five Stat tiles wrap to a 3 + 2 grid. Bar values wrap under the track (container ≤ 440 px rule). In R3 the model column folds under the name and the action buttons collapse into one "⋯" Menu per row. Nothing is hidden.

## 2. Regions

### R0 Header
As `03-components.md §1`; "Results" is `aria-current`.

### R1 Results sub-nav
- Components: Tabs (`aria-label="Results"`): "Overview" (this screen), "Policy scorecard" → `#/results/scorecard`, "Publication export" → `#/results/publication`.

### R2 "What is recorded" panel
- Components: Panel (actions: Button secondary sm "Export everything", Button danger sm "Clear everything…"), Readout, Stat ×5, Bar, Caveat.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| subtitle | `GET /api/dashboard/stats` (app.py:2434-2436; db.py:2605-2643) | `date_range.earliest` | "since 2026-09-30" (local date); null → "nothing recorded yet" | Panel subtitle |
| readout | stats + `GET /api/sessions` + `GET /api/experiments` + `GET /api/benchmarks/runs` | see Numbers | "12 sessions hold 184 runs. 7 of 12 sessions were made by Models studies. 184 runs were first labelled: 101 refused, 29 collapsed, 11 negotiated, 43 complied. Nothing is running now." The last sentence becomes "1 experiment and 1 batch are running." when any ProgressCard source is active. | Readout |
| Sessions tile | `GET /api/dashboard/stats`, `GET /api/sessions` | `total_sessions`; sessions whose `notes` contains "Auto-created by multi-model comparison" (app.py:1717; db.py:2658 exclusion rule) | value 12; madeOf "5 yours, 7 made by Models studies" | Stat |
| Runs tile | stats | `total_runs` | madeOf "in 12 sessions"; Term `run` | Stat |
| Studies tile | `GET /api/dashboard/comparisons`, `GET /api/dashboard/sequences`, stats `total_snapshots` | lengths | value = sum; madeOf "3 models · 4 context · 2 over time" (Repeat and Framing studies have no list route of their own today; see Q1) | Stat |
| Experiments tile | `GET /api/experiments` (app.py:2788-2791) | `experiments[].status` | value = length; madeOf counts by status ("1 done, 1 running") | Stat |
| Benchmark runs tile | `GET /api/benchmarks/runs` (defined in `benchmarks.md`; no route today) | length | "none yet" when 0; tile disabled with reason "Benchmarks are not set up" when the route 404s | Stat |
| annotations | stats | `total_annotations` | shown in the Runs tile madeOf as "· 23 annotated" when > 0 | Stat |
| label bar | stats | `classification_breakdown` (initial classification only, db.py:2627-2630) | four Bar rows, one per outcome in fixed order refused, collapsed, negotiated, complied, each `Count {count, of: total_runs}`; a fifth row "unknown" only when present; title "First labels, all runs" | Bar |
| caveat | | | `initial_only` + `classifier` inline under the bar | Caveat |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Export everything | `GET /api/dashboard/export-all` (app.py:2544-2555) | browser download `flinch-export-all-{date}.json` (server `Content-Disposition`); Toast success "Exported everything to flinch-export-all-2026-10-16.json." |
| Clear everything… | Dialog D1; `DELETE /api/dashboard/clear-all` body `{"confirm":"DELETE_ALL_DATA"}` (app.py:2530-2541; `ClearAllRequest` app.py:238-239) | on 200 `{status, deleted{table: n}, preserved[]}`: Toast success "Cleared 184 runs, 12 sessions, 3 comparisons, 4 sequences, 2 snapshots." (counts from `deleted`, zero-count tables omitted); SessionSwitcher is reset to "No session" (fixes inventory §22 defect "sidebar keeps the deleted currentSession"); all tiles refetch |

### R3 Recent list
- Components: Panel ("Recent"), Chip (filter chips with counts), Table-like List grouped by Today / This week / This month / Older (from `created_at`, local time), Rate, OutcomeBadge, Button (secondary sm "Open"; Menu "Export"; danger sm "Delete…"), EmptyState.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| filter chips | the four lists | lengths | "All 23", "Sessions 5", "Models studies 3", "Context studies 4", "Experiments 2", "Snapshots 2"; the Sessions count excludes auto-created ones (same rule as `GET /api/dashboard/sessions`, db.py:2658) and the chip `title` says so | Chip (selected = `aria-pressed`) |
| session row | `GET /api/dashboard/sessions` (db.py:2646-2661) | `name`, `target_model`, `run_count`, `refused_count`, `collapsed_count`, `negotiated_count`, `complied_count`, `created_at`, `id` | kind tag "session"; name; model as mono (full, not shortened); Rate "7 of 12 refused" (`refused_count` of `run_count`, initial labels, Caveat `initial_only` on hover); time | Row |
| models-study row | `GET /api/dashboard/comparisons` (db.py:2493-2503; table db.py:233-244) | `models[]`, `probe_ids[]`, `total_probes`, `agreement_rate`, `name`, `created_at`, `id` | kind tag "models"; "4 models × 6 probes"; agreement as Rate: count = round(`agreement_rate` × `total_probes`), of = `total_probes` ("agreement 4 of 6 probes"); when `total_probes` is 0 → "agreement n/a" with Term | Row |
| context-study row | `GET /api/dashboard/sequences` (db.py:2678-2691) + probe name from `GET /api/probes` + strategy name from `GET /api/strategies` | `session_name`, `strategy_id`, `probe_id`, `status`, `max_warmup_turns`, `target_model`, `created_at`, `id` | kind tag "context"; "crime-set-1 · fiction workshop · the-stabbing"; `status` word; "up to 10 turns" (the payload has `max_warmup_turns`, not `total_turns`; fixes inventory §22 "? turns"); model | Row |
| experiment row | `GET /api/experiments` | `name`, `status`, `model_ids[]`, conditions count if present, `created_at`, `id` | kind tag "experiment"; "2 conditions · 2 models"; progress "running 18 of 60" when the list payload has it, else the status word | Row |
| snapshot row | `GET /api/sessions/{id}/snapshots` per listed session (app.py:848-853) | `name`, `created_at`, `session_id` | kind tag "snapshot"; "{name} · baseline of {session name}" | Row |
| empty (all) | every list empty | | EmptyState "Nothing recorded yet. Open Probe, pick a session, and send a probe." action "Open Probe" | EmptyState |
| empty (filter) | | | EmptyState "No {kind} yet." (per kind sentences pinned) | EmptyState |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Open (session) | none | `#/probe/:s` |
| Open (models) | none | `#/studies/models/:id` |
| Open (context) | none | `#/studies/context/:id` |
| Open (experiment) | none | `#/experiments/:id` |
| Open (snapshot) | none | `#/studies/snapshots/:s` |
| Export ▾ (session) | `GET /api/sessions/{id}/export?format=json|csv|md|html` (app.py:945-948) with the row's own id (fixes inventory §22 defect "exports the sidebar's current session"); menu also offers the `include_turns`, `include_annotations` toggles as two checkbox items | download via server `Content-Disposition`; Toast "Exported crime-set-1 as CSV." |
| Export ▾ (models) | `GET /api/comparisons/{id}/export?format=json|csv` (app.py:1824-1829) | download; Toast |
| Export ▾ (context) | `GET /api/sequences/{id}/export?format=json|csv|html|pdf` (app.py:2451-2528) | download; Toast |
| Delete… (models) | Dialog D2; `DELETE /api/comparisons/{id}` (app.py:1818) | row removed; Toast |
| Delete… (context) | Dialog D2; `DELETE /api/sequences/{id}` (app.py:2027) (today: no confirm; the rebuild asks) | row removed; Toast |
| Delete… (session) | Dialog D3 (typed session name); `DELETE /api/sessions/{id}` (app.py:531) | row removed; SessionSwitcher reset if it was current; Toast |
| Delete… (snapshot) | Dialog D2; `DELETE /api/snapshots/{id}` (app.py:928) | row removed |

## 3. States
| State | Trigger | R2 | R3 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|
| loading | route enter | tiles pulse; bar skeleton | three pulse rows | (wrapper only) |
| empty | stats all 0 | tiles "0" with madeOf "none yet"; bar replaced by EmptyState "No runs yet, so no labels to count." | EmptyState | "Nothing is recorded yet. Open Probe, pick a session, and send a probe." |
| with data | | tiles, bar | grouped rows | "12 sessions hold 184 runs. …" |
| something running | an active batch, experiment or benchmark (from the app's ProgressCard store) | Experiments tile madeOf "1 running" | experiment row shows progress | last sentence "1 experiment is running." |
| filter applied | chip | | rows of that kind | unchanged |
| filter empty | | | EmptyState per kind | |
| export in flight | Export pressed | button loading "Exporting…" | row button loading | |
| clear dialog | Clear… | D1 open | | |
| clearing | D1 primary | primary loading "Clearing…" | | |
| cleared | 200 | tiles refetch to 0; Toast with counts | EmptyState | "Cleared. Probes, coach profiles, policy claims and strategies were kept." |
| clear refused | 400 "Must send confirm" | D1 error line | | |
| benchmarks route missing | `GET /api/benchmarks/runs` 404 | tile shows "n/a" with Term "Benchmarks are not set up in this build." | no benchmark rows | |
| no key | | no change | | |
| error | any list fails | that tile "n/a" with reason | that kind's rows replaced by "Could not load {kind}." + Try again | error Toast |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Sessions 12 | `total_sessions` (counts every row, db.py:2608) | "5 yours, 7 made by Models studies" (auto = sessions whose `notes` match the compare marker, app.py:1717) | Stat |
| Runs 184 | `total_runs` | "in 12 sessions" (`total_sessions`); "· 23 annotated" (`total_annotations`) | Stat |
| Studies 9 | comparisons + sequences + `total_snapshots` | the three kinds named | Stat |
| Experiments 2 | `experiments.length` | status counts | Stat |
| Benchmark runs | `GET /api/benchmarks/runs` length | "none yet" | Stat |
| 55% (101 of 184) refused | `classification_breakdown.refused` of `total_runs` | the four rows sum to `total_runs` minus unknown; `format.rate()` | Bar |
| 7 of 12 refused (session row) | `refused_count` of `run_count` (initial labels) | Caveat `initial_only` | Rate |
| agreement 4 of 6 probes | round(`agreement_rate` × `total_probes`) of `total_probes` | Term `agreement` ("probes where every model got the same label") | Rate |
| running 18 of 60 | experiment progress fields when present | | Rate |
| "Cleared 184 runs, …" | `deleted` map from the clear response | each table named | Toast |
| since 2026-09-30 | `date_range.earliest` | | subtitle |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `initial_only` | "First label per run, before any pushback." | label bar, session Rate | db.py:2627-2630 and 2650-2653 use `initial_classification` |
| `classifier` | "The label is a keyword scan plus a judge model's guess. You can change it." | label bar | `03-components.md §5`; classifier.py |
| `auto_sessions` | "Models studies make one hidden session per model; they count here, and are listed under Models studies, not Sessions." | Sessions tile, Sessions chip title | app.py:1710-1720; db.py:2658 |
| `clear_keeps` | "Clearing keeps probes, coach profiles, policy claims, probe-to-claim links and strategies. It deletes every session, run, study, experiment result, snapshot and promoted coach example." | D1 | app.py:2540 `preserved`; db.py:2694-2721 (`coach_examples` is in the deleted list, probe_claim_links is not) |
| `export_all_scope` | "Export everything is one JSON file of sessions, runs, studies and snapshots. Experiments and benchmark runs export from their own screens." | Export everything hover and Toast | db.py:2522-2603 `export_all_data` (sessions, runs, comparisons, sequences, snapshots; no experiments table) |
| `agreement_def` | "Agreement counts probes where every model got the same label." | models row Term | comparison runner (app.py:1689-1800) `agreement_rate` |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| session, run | tiles | glossary |
| Models study, Context study, Over time (snapshot) | tiles, chips, rows | glossary → studies specs |
| experiment | tile | glossary |
| benchmark run | tile | glossary → `benchmarks.md` |
| first label (initial classification) | bar title | glossary |
| agreement | models row | glossary |
| warm-up turn | context row | glossary |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `results.madeof` | first Stat tile | "Every number here says what it counts. Hover a tile or a bar to see the pieces." | first visit with data |
| `results.export` | Export everything | "One file with everything in this database. Experiments and benchmarks export from their own screens." | first visit with ≥ 1 run |
| `results.clear` | Clear everything… | "This deletes recorded data, not your probes or settings. It asks you to type a phrase first." | first visit with ≥ 1 run |

## 8. Keyboard and focus
- Shortcuts: `e` Export everything (focus outside fields); `↑/↓` move the row cursor, `Enter` opens, `Delete` opens D2/D3 for that row; `1`–`6` select filter chips; `Esc` closes dialogs and menus.
- Focus order: header → sub-nav → Export everything → Clear… → tiles (focusable for their madeOf tooltip) → bar rows → filter chips → rows (each: Open, Export, Delete).
- Live regions: Readout; Toasts; bar `role="img"` labels.

## 9. Dialogs and overlays opened from here
- **D1 Clear everything** (Dialog md, `confirm` variant): title "Clear everything"; intro "This deletes 184 runs in 12 sessions, 3 Models studies, 4 Context studies, 2 snapshots and 4 promoted coach examples." (counts from the tiles and the coach examples list); Caveat `clear_keeps`; secondary "Export everything first" (runs the export, keeps the dialog open); `confirm.prompt` "Type DELETE_ALL_DATA to continue" with `confirm.phrase` = `DELETE_ALL_DATA` (the server's own token, app.py:2531; case-sensitive); danger primary "Delete everything", loading "Clearing…"; error line shows the server detail.
- **D2 Delete {kind}** (Dialog md, danger): names the item; for a Context study adds "Its warm-up turns and runs go with it."
- **D3 Delete session** (Dialog md, `confirm.phrase` = the session name): "Deletes crime-set-1 and its 12 runs, 1 snapshot and any studies made inside it."
- Export Menu per row; Toasts; tips.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/dashboard/stats` | R2 |
| GET | `/api/sessions` | R2 auto-session split |
| GET | `/api/dashboard/sessions` | R3 sessions |
| GET | `/api/dashboard/comparisons` | R2 Studies tile, R3 |
| GET | `/api/dashboard/sequences` | R2 Studies tile, R3 |
| GET | `/api/sessions/{session_id}/snapshots` | R3 snapshots (per session row) |
| GET | `/api/experiments` | R2 tile, R3 |
| GET | `/api/benchmarks/runs` | R2 tile, R3 (defined in `benchmarks.md`) |
| GET | `/api/probes`, `/api/strategies` | R3 context row names |
| GET | `/api/coach-examples?profile=standard` | D1 count of promoted examples |
| GET | `/api/dashboard/export-all` | Export everything |
| DELETE | `/api/dashboard/clear-all` | D1 |
| GET | `/api/sessions/{session_id}/export` | row Export |
| GET | `/api/comparisons/{comparison_id}/export` | row Export |
| GET | `/api/sequences/{sequence_id}/export` | row Export |
| DELETE | `/api/sessions/{session_id}` | D3 |
| DELETE | `/api/comparisons/{comparison_id}` | D2 |
| DELETE | `/api/sequences/{sequence_id}` | D2 |
| DELETE | `/api/snapshots/{snapshot_id}` | D2 |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With an empty DB every Stat value reads "0", each madeOf reads "none yet", and the Readout is "Nothing is recorded yet. Open Probe, pick a session, and send a probe."
2. With the fixture (12 sessions of which 7 auto-created, 184 runs), the Sessions tile madeOf reads "5 yours, 7 made by Models studies" and the Sessions chip reads "Sessions 5".
3. The label bar has four `[role="img"]` rows whose `aria-label`s are "refused, 101 of 184, 55 percent" etc.; fill widths equal `count/of*100` %; the `initial_only` and `classifier` phrases are present under the bar.
4. A session row's Export › CSV sends `GET /api/sessions/{that row's id}/export?format=csv` regardless of the header session (network assertion with a different current session).
5. D1's primary is disabled until the input equals `DELETE_ALL_DATA` exactly ("delete_all_data" does not enable it); submitting sends `DELETE /api/dashboard/clear-all` with body `{"confirm":"DELETE_ALL_DATA"}`.
6. After a successful clear, the SessionSwitcher reads "No session", every tile reads "0", and the Toast lists only tables with non-zero `deleted` counts.
7. A context row reads "up to {max_warmup_turns} turns" and never "? turns".
8. Deleting a Context study opens D2 first; no `window.confirm` is invoked (lint).
9. When `GET /api/benchmarks/runs` returns 404, the Benchmark runs tile shows "n/a" with a Term whose tooltip contains "not set up", and no error Toast appears.
10. At 1024×700 the tiles form a 3 + 2 grid and each row's actions collapse into a `[aria-haspopup="menu"]` button; no horizontal scroll.

## 12. Open questions for Brad
1. Repeat and Framing studies have no cross-session list route (stat runs are per session, app.py:2589; consistency is per session, app.py:937). Should the Studies tile and Recent list fan out `GET /api/sessions/{id}/stat-runs` per session, or should a `GET /api/studies` route be added with `studies.md`?
2. Clear everything deletes promoted coach examples (db.py:2713) although the API's `preserved` list does not mention them (app.py:2540). Keep that and say so (this spec), or move `coach_examples` to the preserved set?
3. The typed phrase is the server's `DELETE_ALL_DATA`. Prefer a plain phrase ("delete everything") that the client maps to the token?
