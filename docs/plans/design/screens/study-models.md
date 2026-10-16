# Models study

- Route(s): `#/studies/models/:id` (`:id` = `comparisons.id`, a saved multi-model comparison); `#/studies/models/:id/cell/:probe_id/:model` opens one cell in the drawer; `#/studies/models/sessions/:ids` (`:ids` = comma-joined session ids, 2 or more) is the session-vs-session mode of the same screen, computed live and not saved.
- Section: Studies
- Purpose (one sentence, what the researcher does here): see, probe by probe, whether several models (or several sessions) gave the same label to the same request, and read any cell's reply.
- Arrives from: Studies list row (type models); New study › Models on completion; New study › Models "Compare sessions"; Probe workbench session "⋯" › "Compare with another session…" (opens the New study Models form in sessions mode). Leaves to: `#/probe/:session_id/run/:run_id` from any cell (the run behind the label; each model's runs live in its own hidden session, app.py:1709-1720); `#/studies/new/models` via "Run again"; `#/studies` via the breadcrumb.
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, Readout, Rate, Stat, Bar, Table, OutcomeBadge, Chip (`chip`, `tag`, `count`), Button, Menu, Drawer, InsetBox, RunThread, Term, Caveat, EmptyState, Toast, Dialog (`confirm`), FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §17 "Multi-Model Comparison" › Results (render.js:1298-1429): "Comparison Results", model list "a vs b", Export JSON/CSV, "New Comparison", stats bar (agreement % coloured, "{aligned} of {n} probes aligned", per model "{C}C {R}R {X}X"), per-probe cards with "disagreement" chip and prompt excerpt (reading a non-existent `row.probe_prompt`; the server field is `prompt_text`, app.py:1729), the model grid with classification chip and response or red error; the unshown per-model negotiated counts (render.js:1309), per-cell `run_id` / `session_id` (app.py:1749-1755), comparison `probe_ids`, `session_ids`, `notes`, and the `system_prompt` request field; §18 legacy "Compare Sessions" modal (dropped) and the unreachable `GET /api/compare` payload (`sessions`, `probes[].sessions{run_id, initial/final_classification, initial_response excerpt}`, `agreement_rate`, `probes_in_all_sessions`), which the sessions mode renders.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ No session ▾ ]  ● 2 keys set                       Probe Studies … ? ⚙   │ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Studies › Models › Compare 10/14 16:20                 [Run again] [Export ▾] [⋯] │
│     comparison 7 · 3 models · 3 probes · Oct 14 16:20 · system prompt: none          │
│ R2  ▣ 2 of 3 probes got the same label from all 3 models. the-hotel-room split:      │
│       claude-sonnet-4-6 refused, gpt-4.1 complied, gemini-2.5-flash negotiated.      │
│ R3  ┌ AGREEMENT ⓘ ───────┐ ┌ claude-sonnet-4-6 ──┐ ┌ gpt-4.1 ────────────┐ ┌ gemini-2.5-flash ─┐
│     │ 2 of 3 probes      │ │ refused 3 · collapsed│ │ refused 2 · complied│ │ refused 2 ·       │
│     │ (67%)              │ │ 0 · negotiated 0 ·   │ │ 1 · 0 errors         │ │ negotiated 1 ·    │
│     │ probes where every │ │ complied 0 · 0 errors│ │ of 3 probes          │ │ 0 errors of 3     │
│     │ model's label was  │ │ of 3 probes          │ │                     │ │                   │
│     │ the same           │ │                      │ │                     │ │                   │
│     └────────────────────┘ └──────────────────────┘ └─────────────────────┘ └───────────────────┘
│     ⓘ A rate from 3 runs is a rate from 3 runs. · ⓘ The label is a keyword scan plus  │
│       a judge model's guess. You can change it.                                      │
│ R4  [all 3] [disagree 1] [agree 2]   [search probes…]                                │
│     ┌ Probe             │ Domain │ claude-sonnet-4-6 │ gpt-4.1    │ gemini-2.5-flash │ ┐
│     │ the-hotel-room ⚑  │ ROMANCE│ REFUSED           │ COMPLIED   │ NEGOTIATED       │ │
│     │ the-stabbing      │ CRIME  │ REFUSED           │ REFUSED    │ REFUSED          │ │
│     │ the-autopsy       │ MEDICAL│ REFUSED           │ REFUSED    │ REFUSED          │ │
│     └───────────────────┴────────┴───────────────────┴────────────┴──────────────────┘ │
│     ⓘ Each cell is one run, no pushback. Click a cell to read the reply.             │
│ R5  ┌ Made of ──────────────────────────────────────────────────────────────────────┐ │
│     │ hidden sessions   Compare 10/14 16:20 — claude ▸ · … — gpt ▸ · … — gemini ▸   │ │
│     │ probes            3 (ids 1, 2, 3)        system prompt   none                  │ │
│     │ notes             (none)                 saved           2026-10-14 16:20       │ │
│     └───────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
R6 Drawer (cell): "the-hotel-room × gpt-4.1", label badge, probe text, reply, "Open run",
   or the error text in full.
```
### 1024×700 differences
R3's per-model Stats go two per row (agreement first). R4 keeps one column per model; with 4 or 5 models the table scrolls horizontally inside its panel (the Probe column is sticky, `position: sticky; left: 0`), and the panel says "scroll for {n} more models" under it; the page itself does not scroll horizontally. R5 stacks to one column. Nothing is hidden.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher (shows "No session" unless one is open elsewhere; this study is session-less, IA §7.2), KeyStatusChip, PrimaryNav (current = Studies), HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session pill | `GET /api/sessions` (app.py:349) | current app session or null | unchanged by this screen | SessionSwitcher |
| Key chip | `GET /api/settings/keys` (app.py:2263) | `is_set` | "r of N keys set" | KeyStatusChip |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Session pill item | none | `#/probe/:s` (leaves this study; nothing is running here, the comparison is saved) |

### R1 Title row
- Components: breadcrumb, Panel heading, Chip (`chip` per model), Button (secondary md "Run again", secondary md "Export ▾", ghost icon "⋯"), Menu, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Breadcrumb "Studies › Models › {name}" | `GET /api/comparisons/{id}` (app.py:1811 → db.py:2506-2515) | `name` (server-built "Compare {mm/dd HH:MM} — {short} vs {short}", app.py:1783); the em dash in the stored name is shown as stored but never generated by the UI | links to `#/studies`, `#/studies?type=models` | text |
| Meta | same | `id`, `models[]`, `total_probes`, `created_at`; `system_prompt` is not stored on the comparison (db.py:233-244); it is read from the first hidden session `GET /api/sessions/{session_ids[model]}` `system_prompt` (app.py:1719 stores it there) | "comparison {id} · {m} models · {p} probes · {date time} · system prompt: {first 60 chars or none}" with "show" opening the full prompt in an InsetBox | text |
| Model chips | `models[]` | strings | full ids, mono; never shortened | Chip |
| Sessions mode meta | `GET /api/compare?session_ids=` (app.py:1628-1686) | `sessions[{id, name, target_model}]`, `total_probes`, `probes_in_all_sessions` | "live comparison · {n} sessions · {p} probes, {q} in every session · not saved" with "not saved" as a Term explaining no record exists | text |
| Run again | none | none | `#/studies/new/models?models=…&probes=…` pre-filled (hidden in sessions mode) | Button |
| Export ▾ | none | none | Menu "JSON", "CSV"; models mode → `GET /api/comparisons/{id}/export?format=` (app.py:1825); sessions mode → `GET /api/export/compare?session_ids=&format=` (app.py:1433) | Button + Menu |
| ⋯ | none | none | Menu: "Copy comparison id", "Delete comparison" (danger; models mode only) | Button + Menu |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Run again | none | `#/studies/new/models?models={ids}&probes={probe_ids}` |
| Export JSON / CSV | the route above | download; Toast success "Exported {name}." |
| Delete comparison | `DELETE /api/comparisons/{id}` (app.py:1819; db.py:2518-2519 lacks a commit, see §12) | Dialog `confirm` with phrase = `name`, intro "This removes the saved comparison. The {m} hidden sessions and their runs stay." → `#/studies?type=models`; Toast "Deleted {name}." |

### R2 Readout
- Components: Readout.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Models sentence | `GET /api/comparisons/{id}` | `results[]` (`probe_name`, `disagreement`, `models{model: {classification, error}}`), `agreement_rate`, `total_probes` | "{k} of {n} probes got the same label from all {m} models." then, for up to two disagreeing probes, "{probe} split: {model} {label}, {model} {label}, …" and "… and {d − 2} more." beyond that; a cell with `error` reads "{model} errored"; when every probe agrees: "All {n} probes got the same label from all {m} models." (draft; brad-voice pass); k = probes with `disagreement === false` (app.py:1773-1779) | Readout |
| Sessions sentence | `GET /api/compare` | `probes[].disagreement`, `probes_in_all_sessions`, `total_probes` | "{k} of {q} probes run in every session got the same label across {s} sessions; {p − q} probes were run in only some sessions and are not counted." (app.py:1675-1676) | Readout |

- Actions: none.

### R3 Agreement and per-model counts
- Components: Stat (agreement), Stat per model (up to 5), Caveat (inline ×2), Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| AGREEMENT | comparison | k = `round(agreement_rate × total_probes ÷ 100)` (exact: app.py:1800 built it from these integers), `total_probes` | value "{k} of {n} probes ({pct}%)"; madeOf "probes where every model's label was the same; a cell that errored does not count as a disagreement" (app.py:1773-1777 skips null classifications); no colour by threshold | Stat |
| Per-model Stat ×m | `results[].models[model]` tallied client-side | `classification` ∈ refused/collapsed/negotiated/complied, `error` | eyebrow = model id (mono); value as four counts "refused 3 · collapsed 0 · negotiated 0 · complied 0" (all four, in outcome order, today's "C R X" letters replaced by the words); madeOf "{e} errors of {n} probes" | Stat |
| Sessions mode | `GET /api/compare` | per session `probes[].sessions[sid].final_classification || initial_classification` | one Stat per session, eyebrow "{name} · {target_model}"; madeOf "{n} of {p} probes run in this session" | Stat |
| Caveats | none | none | `rate_n` (N = `total_probes`) and `classifier` inline | Caveat |

- Actions: none.

### R4 Grid
- Components: Chip strip (filter), Input (search), Table (Probe `text` sticky, Domain `text`, one `badge` column per model), OutcomeBadge, Caveat (inline).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Filter chips | computed | `disagreement` | "all {n}", "disagree {d}", "agree {n − d}" with `count` pills | Chip |
| Search | none | none | filters by `probe_name` and `probe_domain` | Input |
| Rows | `results[]` (app.py:1724-1731, 1766-1777) | `probe_id`, `probe_name`, `probe_domain`, `prompt_text`, `disagreement`, `models{}` | sorted disagreeing first then by name; a disagreeing row shows a "⚑" with Term "the models split on this probe"; Probe cell `title` = first 120 chars of `prompt_text` | Table |
| Cells | `models[model]` | `classification`, `error`, `run_id`, `session_id` | OutcomeBadge with `source = {keyword: classification, judge: classification, override: null}` (a compare cell stores one label via `initial_classification`, app.py:1739-1742); `error` → a red `tag` "error" with the first 40 chars and the full text in `title`; `classification === null && error === null` → "unknown" badge "unclassified" | OutcomeBadge / Chip |
| Sessions mode columns | `GET /api/compare` `sessions[]` | `name` | one column per session; a probe absent from a session shows "not run" and the row is dimmed with Term "not in every session, so not counted" | Table |
| Cell caveat | none | none | `one_run_cell` (new id) "Each cell is one run, no pushback. Click a cell to read the reply." (draft; brad-voice pass) | Caveat |
| Empty | none | none | EmptyState "This comparison has no probes." (a saved comparison always has ≥ 1, app.py:1698; shown only on a damaged record) | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Cell click / Enter | none | `#/studies/models/:id/cell/:probe_id/:model` → R6 |
| Chip / search | none | filters rows client-side; the caption reads "{shown} of {n} probes" |
| Column header click | none | sorts by that model's outcome rank (refused 3 > negotiated 2 > collapsed 1 > complied 0, app.py:901) or by name/domain |

### R5 Made of
- Components: InsetBox (`block`), definition grid, text links, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| hidden sessions | comparison | `session_ids{model: sid}` (app.py:1709-1720) and `GET /api/sessions` for names | "{session name} ▸" per model as links to `#/probe/:sid`; Term "hidden session" = made by this comparison, filtered out of the Sessions list (db.py:2656) but openable | grid + links |
| probes | comparison | `probe_ids[]` | "{n} (ids …)" | grid |
| system prompt | first hidden session | `system_prompt` | full text or "none" | grid |
| notes | comparison | `notes` | text or "(none)" (today never written by the UI, app.py:1788-1797 passes none) | grid |
| saved | comparison | `created_at` | local date time | grid |
| Sessions mode | `GET /api/compare` | `sessions[]`, `total_probes`, `probes_in_all_sessions` | "sessions {names}", "probes {p}, in every session {q}", "saved: no; export to keep it" | grid |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| session link | none | `#/probe/:sid` |

### R6 Cell drawer
- Components: Drawer, OutcomeBadge (sm), InsetBox ×2, Button (primary sm "Open run", ghost "← prev model", "next model →"), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title | cell | `probe_name`, model | "the-hotel-room × gpt-4.1" | Drawer title |
| Label | cell | `classification` | badge sm with source tooltip; error cells show the red tag and the full `error` text in a `role="alert"` InsetBox | OutcomeBadge |
| Probe | row | `prompt_text` | InsetBox, "show all" at 200 px | InsetBox |
| Reply | cell | `response` (app.py:1748) | mono, pre-wrap, full | InsetBox |
| Sessions mode reply | `GET /api/compare` | `initial_response` (first 200 chars, app.py:1661) | the excerpt plus "Open run for the full reply" | InsetBox |
| Open run | none | none | `#/probe/:session_id/run/:run_id` (app.py:1749-1750); hidden when `run_id` is null (error cell) | Button |
| Caveat | none | none | `classifier`; "The label can be changed on the run, not here." (draft; brad-voice pass) | Caveat |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| prev/next model, ←/→ | none | hash to the neighbouring model's cell in the same row |
| ↑/↓ | none | same model, neighbouring probe |
| Escape / × | none | close; focus returns to the cell |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|
| loading | until the comparison (or `GET /api/compare`) returns | breadcrumb, buttons disabled | skeleton | skeletons | three pulse rows | pulse | closed | (none) |
| not found | 404 | "Studies › Models" | hidden | hidden | EmptyState "There is no comparison {id}. It may have been deleted." with "Back to Studies" | hidden | closed | (none) |
| all agree | `agreement_rate === 100` | enabled | "All 3 probes got the same label from all 3 models." | AGREEMENT "3 of 3 (100%)" | no ⚑ rows; "disagree 0" chip disabled with reason "none" | shown | closed | as R2 |
| some disagree | `0 < d < n` | enabled | split sentence | values | ⚑ rows first | shown | closed | "2 of 3 probes got the same label from all 3 models. the-hotel-room split: claude-sonnet-4-6 refused, gpt-4.1 complied, gemini-2.5-flash negotiated." |
| none agree | `agreement_rate === 0` | enabled | "0 of 3 probes got the same label from all 3 models. …" | AGREEMENT "0 of 3 (0%)" | all ⚑ | shown | closed | as R2 |
| with errors | any cell `error !== null` | enabled | "… {model} errored on {probe}." appended | per-model Stat "{e} errors of {n}" | red error tags | shown | closed | "2 of 3 probes got the same label from all 3 models. gpt-4.1 errored on the-autopsy." |
| all errored for a model | every cell of one model has `error` | enabled | "{model} errored on every probe; its column is empty." | that Stat madeOf "3 errors of 3 probes" | column of error tags | shown | closed | as R2 |
| filtered | chip or search | | | | subset; caption "{shown} of {n} probes" | | | unchanged |
| cell open | `/cell/…` | | | | cell selected | | open | unchanged |
| sessions mode | `/sessions/:ids` | live meta; Run again hidden; Export → compare export; Delete hidden | sessions sentence | one Stat per session | session columns; dimmed rows for probes not in every session | sessions grid with "saved: no" | excerpt + Open run | "2 of 3 probes run in every session got the same label across 2 sessions; 1 probe was run in only some sessions and is not counted." |
| sessions mode, bad ids | `GET /api/compare` 400 ("Need at least 2 session IDs") | | "Pick at least two sessions to compare." with "Pick sessions" → `#/studies/new/models` | hidden | hidden | hidden | closed | as R2 |
| sessions mode, no shared probes | `probes_in_all_sessions === 0` | | "These sessions share no probe, so nothing can be compared. {p} probes were run in one session only." | Stats with "0 of {p}" | all rows dimmed | shown | closed | as R2 |
| delete pending | Dialog confirmed | buttons disabled | | | | | | unchanged; on success → `#/studies?type=models` |
| error | fetch non-2xx other than 404 | | "This comparison could not be loaded: {status}." with Retry | hidden | hidden | hidden | closed | as R2 |
| no key | zero keys | Run again disabled with reason "No API key is set." | as data | as data | as data | as data | | unchanged |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| k of n probes agree (R2, R3) | k = `round(agreement_rate × total_probes ÷ 100)`; `agreement_rate` = probes with `disagreement === false` ÷ probes × 100 (app.py:1779, 1800); `disagreement` = more than one distinct non-null label among the models (app.py:1773-1777) | "probes where every model's label was the same; a cell that errored does not count as a disagreement" | Stat, Readout |
| per-model outcome counts | count of `results[].models[m].classification === outcome` for each of the four outcomes | "{e} errors of {n} probes" | Stat |
| errors e of n | count of `error !== null` per model | in the per-model madeOf | Stat |
| disagree d / agree n − d | count of `disagreement` | chip counts beside the words | Chip |
| sessions mode k of q | `agreement_count ÷ total_with_all` where `total_with_all` = probes present in every session (app.py:1675-1676) | "{p − q} probes were run in only some sessions and are not counted" | Readout, Stat |
| per-session run count | probes with an entry for that session | "{n} of {p} probes run in this session" | Stat |
| shown s of n | filtered rows | caption | Table caption |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `rate_n` | A rate from N runs is a rate from N runs. | R3 inline (N = `total_probes`) | app.py:1800 |
| `classifier` | The label is a keyword scan plus a judge model's guess. You can change it. | R3 inline; R6 | app.py:1737 `classify`; classifier.py |
| `one_run_cell` (new id) | Each cell is one run, no pushback. Click a cell to read the reply. | R4 under the grid | app.py:1735-1742 one `send`, one `classify`, no coach |
| `error_not_disagree` (new id) | A cell that errored does not count as a disagreement; it is just missing. | AGREEMENT Stat madeOf; with-errors state | app.py:1773-1777 skips null |
| `compare_sessions` | A models study makes one hidden session per model; its runs live there. | R5 | app.py:1709-1720; db.py:2656 |
| `same_prompt` (new id) | Every model got the same system prompt in this comparison, or none. | R1 meta | app.py:1719 `system_prompt=req.system_prompt` for every session |
| `not_saved` (new id) | This session comparison is computed now and not saved; export it to keep it. | sessions mode R1 and R5 | app.py:1628-1686 writes nothing |
| `latest_only` | Each variant and each probe counts only its latest run. | sessions mode R4 (a session's later run of the same probe overwrites the earlier in the payload: app.py:1649-1660 dict keyed by `str(sid)` assigns in run order) | app.py:1655-1660 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| comparison | R1 | db.py:233-244 `comparisons` |
| hidden session | R5 | app.py:1709-1720; db.py:2656 |
| agreement | R3 | app.py:1773-1779 |
| disagreement / split | R2, R4 ⚑ | app.py:1777 |
| run | R6 Open run | db.py:44-57 |
| judge | caveats | classifier.py |
| system prompt | R1, R5 | app.py:215-218; db.py:38 |
| session comparison | sessions mode | app.py:1628-1686 |
| refused / collapsed / negotiated / complied | R3, R4 | classifier.py; models.py |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `models.grid` | first grid cell (`data-tip="models-cell"`) | One probe, one model, one run. Click a cell to read the reply and open the run behind the label. | first visit |
| `models.flag` | first ⚑ (`data-tip="models-flag"`) | The models split on this probe. That is the finding; the agreement number above is just the count of rows without a flag. | first visit with a disagreement |
| `models.hidden` | R5 first session link (`data-tip="models-hidden"`) | Each model's runs went into a session made for this comparison. They are hidden from the Sessions list but open like any other. | after `models.grid` |

## 8. Keyboard and focus
- Shortcuts: arrow keys move between cells when the grid has focus (roving, grid pattern) and inside the drawer; `Enter` opens a cell; `Escape` closes the drawer; `e` opens Export; `/` focuses search; `F8` newest Toast.
- Focus order: header → breadcrumb → Run again → Export → ⋯ → R3 Terms → filter chips (roving) → search → table headers → grid cells (one tab stop, arrows within) → R5 links. Drawer traps focus and returns it to the cell.
- Live regions: R2 Readout polite once per load; the table caption (`sr-only`) announces "{shown} of {n} probes" on filter; the drawer title announces on cell change.

## 9. Dialogs and overlays opened from here
- Drawer R6 (cell).
- Dialog `confirm` "Delete comparison?" (phrase = `name`; danger "Delete").
- Export Menu; ⋯ Menu; system prompt InsetBox toggle ("show" / "hide").
- FirstTimeTip ×3. Toasts.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | /api/comparisons/{id} | R1 to R6 (one payload) |
| GET | /api/sessions | R0; R5 hidden session names |
| GET | /api/sessions/{sid} | R1 meta `system_prompt` of the first hidden session |
| GET | /api/comparisons/{id}/export?format=json\|csv | R1 Export |
| DELETE | /api/comparisons/{id} | R1 ⋯ Delete |
| GET | /api/compare?session_ids= | sessions mode R1 to R6 |
| GET | /api/export/compare?session_ids=&format= | sessions mode Export |
| GET | /api/settings/keys | R0; Run again reason |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With `GET /api/comparisons/7` returning 3 models and 3 `results[]` where one has `disagreement: true` (`claude-sonnet-4-6: refused`, `gpt-4.1: complied`, `gemini-2.5-flash: negotiated`) and `agreement_rate: 66.67`, the Readout text is exactly "2 of 3 probes got the same label from all 3 models. the-hotel-room split: claude-sonnet-4-6 refused, gpt-4.1 complied, gemini-2.5-flash negotiated."
2. The AGREEMENT Stat shows "2 of 3 probes (67%)"; no element's class changes with the rate.
3. R3 renders one Stat per model whose eyebrow is the full model id and whose value contains the four words refused, collapsed, negotiated and complied, each followed by a count; the gpt-4.1 Stat reads "refused 2 · collapsed 0 · negotiated 0 · complied 1" and madeOf "0 errors of 3 probes".
4. R4 has a `<table>` with columns Probe, Domain and one per model in `models[]` order; the disagreeing row is first and contains "⚑".
5. Clicking the gpt-4.1 cell of the-hotel-room sets the hash to `#/studies/models/7/cell/{probe_id}/gpt-4.1` and opens a `role="dialog"` titled "the-hotel-room × gpt-4.1" containing the full `response` text and a button "Open run" whose `href` is `#/probe/{session_id}/run/{run_id}` from that cell.
6. A cell with `error: "rate limited", classification: null` renders a red tag containing "error", no "Open run" in its drawer, and the Readout contains "gpt-4.1 errored on the-autopsy."; the AGREEMENT count does not change because of it.
7. The "disagree" chip shows count 1; clicking it leaves one row and sets the caption to "1 of 3 probes".
8. Export › CSV requests `GET /api/comparisons/7/export?format=csv`.
9. ⋯ › Delete opens a dialog whose primary stays disabled until the input equals the comparison `name` exactly; confirming issues `DELETE /api/comparisons/7` and navigates to `#/studies?type=models`.
10. R5 lists one link per entry of `session_ids` with `href` `#/probe/{sid}` and the text "system prompt" followed by "none" when the first hidden session's `system_prompt` is empty.
11. `#/studies/models/sessions/2,5` issues `GET /api/compare?session_ids=2,5`, shows one column per returned session, the text "not saved" in R1, no "Run again" and no Delete item; Export requests `GET /api/export/compare?session_ids=2,5&format=json`.
12. In sessions mode a probe missing from one session shows "not run" in that column and its row has `aria-disabled="true"` with a Term whose definition contains "not counted".
13. With 5 models at 1024×700 the table scrolls inside its panel (`overflow-x: auto`), the Probe column stays visible while scrolling (sticky), the text "scroll for 2 more models" appears under it, and `main` has no horizontal scrollbar.
14. The page contains the exact strings "A rate from N runs is a rate from N runs.", "The label is a keyword scan plus a judge model's guess. You can change it." and "Each cell is one run, no pushback. Click a cell to read the reply."
15. Model ids are never shortened: no element text equals "claude" or "gpt" alone where a model id is expected (regex over R1, R3, R4 headers).

## 12. Open questions for Brad
1. **Session-less, as drafted (IA §7.2).** The comparison keeps its own hidden sessions. Confirm, or should a models study be a child of an open session (and then use its system prompt)?
2. **Session-vs-session is live only.** `GET /api/compare` saves nothing. Keep it as a live view reached from New study, or add a save so it shows in the Studies list?
3. **`DELETE /api/comparisons/{id}` never commits** (db.py:2518-2519). The row comes back after restart. Backend fix assumed before this screen ships.
4. **System prompt is not on the comparison record.** It is read from the first hidden session (app.py:1719). Add `system_prompt` to `comparisons` (db.py:233-244) so the Studies list can show it without a second call?
5. The stored comparison `name` contains an em dash from the server (app.py:1783). The copy rules forbid the UI generating one; showing a stored one is allowed in this spec. Rename on the server to "Compare {date}: {ids}"?
6. Should the per-model Stat also show the model's median latency? Not stored for compare runs (app.py:1735-1742 keeps no timing), so it would need a backend change; the spec omits it.
