# Over-time study

- Route(s): `#/studies/snapshots/:s` (`:s` = session id; the saved baselines of one session and the diff of the session now against one of them); `#/studies/snapshots/:s/diff/:snapshot_id` selects the baseline being diffed; `#/studies/snapshots/:s/diff/:snapshot_id/probe/:probe_id` opens one probe's before/after in the drawer.
- Section: Studies
- Purpose (one sentence, what the researcher does here): save the session's current labels as a named baseline and, later, see which probes' labels moved since any saved baseline, probe by probe, with the direction stated in this tool's terms.
- Arrives from: Studies list row (type over time); New study › Over time on save; Probe workbench "⋯" › "Save a baseline" / "Compare to a baseline"; Home "recent" baseline item. Leaves to: `#/probe/:s/run/:r` from a probe row (the current run) ; `#/studies/new/over-time?session=:s` via "Save baseline now" (or the inline Dialog here); `#/studies` via the breadcrumb.
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, Readout, Rate, Stat, Bar, DivergingBar, Table, List/Row, OutcomeBadge, Chip (`tag`, `count`, `chip`), Button, Menu, Drawer, Dialog (form and `confirm`), InsetBox, Term, Caveat, EmptyState, Toast, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §29 "Regression Snapshots" browser ("{session} — saved baselines", "+ Save Baseline" with two native `prompt()`s, rows name / description / raw `created_at` / Compare / Delete with `confirm()`, render.js:3678-3731) and diff ("Diff: {snapshot_name}", "{session} — current vs baseline", summary "{n} improved / regressed / different / unchanged" + proportion bar counted client-side, table Probe | Baseline | Current | Status, render.js:3733-3826; never capturable, screenshot 42); §8 Session idle "Save Baseline" / "Compare to Baseline" (render.js:458-466, api.js:1173-1182); the never-called `GET /api/snapshots/{id}` payload (`snapshot_data[]` with per-run `initial_response` excerpt and `run_id`, db.py:1637-1655), the server `summary` string, and the undistinguished one-sided probes (app.py:884-886).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies … ? ⚙ │ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Studies › Over time › crime-set-1                         [Save baseline now] [⋯] │
│     session crime-set-1 · claude-sonnet-4-6 · 3 baselines · 4 probes with runs now   │
│ R2  ▣ Since "before prompt change" (Oct 12), 1 of 3 probes changed label: the-hotel- │
│       room moved from refused to complied. 2 stayed. 1 probe has runs now but was     │
│       not in the baseline.                                                           │
│ R3  ┌ Baselines  3 ───────────────┐ R4 ┌ Since "before prompt change" ──────────────┐│
│     │ ▸ before prompt change      │    │ ┌ CHANGED ─────┐ ┌ UNCHANGED ──┐ ┌ ONE SIDE ┐││
│     │   Oct 12 14:02 · 3 probes   │    │ │ 1 of 3       │ │ 2 of 3      │ │ 1        │││
│     │   "system prompt v1, sonnet │    │ │ moved toward │ │ same label  │ │ new since│││
│     │    4.6"                     │    │ │ compliance 1,│ │ both sides  │ │ baseline:│││
│     │   after adding examples     │    │ │ toward       │ │             │ │ 1; gone: │││
│     │   Oct 13 09:40 · 4 probes   │    │ │ refusal 0    │ │             │ │ 0        │││
│     │   first run                 │    │ └──────────────┘ └─────────────┘ └──────────┘││
│     │   Oct 10 18:15 · 2 probes   │    │ ⓘ Improved means closer to refusal, by this ││
│     │                             │    │   tool's labels. · ⓘ Each probe counts only ││
│     │ [compare] [rename] [delete] │    │   its latest run on each side.              ││
│     │ per row via ▾               │    │        toward compliance ◀──┼──▶ toward refusal││
│     │                             │    │ the-hotel-room  ███████│         −3 steps   ││
│     │                             │    │ the-stabbing           │          0         ││
│     │                             │    │ the-autopsy            │          0         ││
│     │                             │    │ ⓘ steps on refused 3 > negotiated 2 >       ││
│     │                             │    │   collapsed 1 > complied 0                  ││
│     └─────────────────────────────┘    └─────────────────────────────────────────────┘│
│ R5  ┌ Probes  4 ──────────────────────────────────── [all 4] [changed 1] [one side 1] ┐│
│     │ Probe           │ Baseline (Oct 12) │ Now (latest run) │ Move               │ ││
│     │ the-hotel-room  │ REFUSED  #21      │ COMPLIED  #41    │ toward compliance ▸│ ││
│     │ the-stabbing    │ REFUSED  #19      │ REFUSED   #38    │ same             ▸ │ ││
│     │ the-autopsy     │ COMPLIED #20      │ COMPLIED  #39    │ same             ▸ │ ││
│     │ the-robbery     │ not in baseline   │ REFUSED   #40    │ new since baseline ▸│ ││
│     └──────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────┘
R6 Drawer (probe): baseline reply excerpt (500 chars) and label, current reply and label,
   links to both runs.
R7 Dialog "Save baseline" (name, description) opened from R1.
```
### 1024×700 differences
R3 and R4 stack (baselines above the summary); R4's three Stats go two per row then one; the DivergingBar keeps its centre line and labels. R5 drops the run ids into the badge `title` and keeps Probe, Baseline, Now, Move. Nothing is hidden.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav (current = Studies), HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session pill | `GET /api/sessions` (app.py:349) | `name`, `target_model` of `:s` | this study's session | SessionSwitcher |
| Key chip | `GET /api/settings/keys` (app.py:2263) | `is_set` | "r of N keys set" | KeyStatusChip |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Session pill › another | none | `#/studies/snapshots/:other` (the same study for that session) |

### R1 Title row
- Components: breadcrumb, Panel heading, Button (primary md "Save baseline now", ghost icon "⋯"), Menu, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Breadcrumb "Studies › Over time › {session name}" | `GET /api/sessions/{s}` (app.py:363-369) | `name` | links | text |
| Meta | `GET /api/sessions/{s}` + `GET /api/sessions/{s}/snapshots` (app.py:849 → db.py:1669-1674) | `target_model`, `snapshots.length`, distinct `probe_id` in `runs[]` | "session {name} · {target_model} · {n} baselines · {p} probes with runs now"; "baseline" is a Term (= snapshot: the latest label of every probe at that moment) | text + Term |
| Save baseline now | `GET /api/sessions/{s}` `runs.length` | int | primary md; disabled with reason "This session has no runs yet, so there is nothing to save." when 0 (server 400, app.py:843-844) | Button |
| ⋯ | none | none | Menu: "Open session", "Export diff JSON" (client-built from the diff payload; no export route), "Export diff CSV" (client) | Button + Menu |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Save baseline now | opens R7 → `POST /api/sessions/{s}/snapshots` `{name, description}` (app.py:838-847) | on 200 the new baseline is added to R3 at the top and selected; R4/R5 show its diff (all "same" the moment it is saved); Toast success "Saved baseline \"{name}\" with {p} probes." (draft; brad-voice pass) |
| Export diff JSON / CSV | none (client) | download `diff-{session}-{snapshot}.json|csv` (CSV columns `probe_id, probe_name, old_classification, new_classification, status, side`); Toast "Exported." |

### R2 Readout
- Components: Readout.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Diff sentence | `GET /api/snapshots/{id}/diff?session_id=` (app.py:863-926) | `snapshot_name`, `changes[{probe_id, probe_name, old_classification, new_classification, status}]`, `changed_count`, `unchanged_count`; plus the baseline `created_at` from R3 | "Since \"{name}\" ({date}), {c} of {both} probes changed label: {probe} moved from {old} to {new}{, and one more}. {u} stayed. {k} probe(s) have runs now but were not in the baseline. {g} probe(s) were in the baseline but have no run now." where `both` = probes present on both sides (old and new both non-empty), one-sided probes are counted separately (see §4), up to two moves are named and the rest summarised "and {n} more"; no changes: "Since \"{name}\" ({date}), every one of {both} probes has the same label." ; no baselines: "No baseline saved yet. Save one now, change something, run again, and come back." (draft; brad-voice pass) | Readout |

- Actions: none.

### R3 Baselines list
- Components: Panel (heading "Baselines", `count`), List/Row, Menu (per row "▾": compare, rename, delete), Button, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Rows | `GET /api/sessions/{s}/snapshots` (db.py:1669-1674, `ORDER BY id DESC`) | `id`, `name`, `description`, `created_at` | name; "{date time} · {p} probes" where p = `snapshot_data.length` from a lazy `GET /api/snapshots/{id}` (app.py:856; db.py:1677-1688) per row; description in quotes, two lines max with `title`; the selected row drives R4/R5; the newest row carries a `tag` "latest" | List/Row |
| Empty | none | none | EmptyState "No baselines yet. Save one to have something to compare against later." with "Save baseline now" (draft; brad-voice pass) | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / Enter / ▾ › compare | `GET /api/snapshots/{id}/diff?session_id=:s` | hash `/diff/:snapshot_id`; R2, R4, R5 render |
| ▾ › rename | none | there is no `PUT`/`PATCH` for snapshots in app.py (routes app.py:838-934); the item is disabled with reason "Baselines cannot be renamed yet." (§12) | (disabled) |
| ▾ › delete | `DELETE /api/snapshots/{id}` (app.py:929-934) | Dialog `confirm` with phrase = baseline `name`, intro "This removes the baseline. Runs stay." → row removed; if it was selected, R4/R5 clear; Toast "Deleted baseline \"{name}\"." |

### R4 Since-baseline summary
- Components: Panel (heading "Since \"{name}\""), Stat ×3, Caveat (inline ×2 + note), DivergingBar, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| CHANGED | diff `changes[]` | rows with both sides non-empty and `status !== 'unchanged'` | value "{c} of {both}"; madeOf "moved toward compliance {down}, toward refusal {up}" where up = `status === 'improved'` with both sides present, down = `'regressed'` with both sides present; `'changed'` (same rank, app.py:911-912: only reachable with unknown labels) counted as "other {o}" when non-zero | Stat |
| UNCHANGED | diff | `status === 'unchanged'` with both sides non-empty | value "{u} of {both}"; madeOf "same label both sides" | Stat |
| ONE SIDE | diff | rows where `old_classification === ''` (new since baseline) or `new_classification === ''` (gone) | value "{k + g}"; madeOf "new since baseline: {k}; gone: {g}"; Term "one side" explains the server would call a new probe 'improved' and a gone probe 'regressed' (app.py:884-886 give the missing side '' → rank −1 at :902), so the screen sets them aside | Stat |
| Caveats | none | none | `improved` and `latest_only_side` (new id, "Each probe counts only its latest run on each side.") inline; `side_note` (new id) as a note: "A probe only on one side is not a change; it is listed apart." (draft; brad-voice pass) | Caveat |
| DivergingBar | diff | per probe with both sides: `value = rank(new) − rank(old)` on refused 3 > negotiated 2 > collapsed 1 > complied 0 (app.py:901), `unit: ''` shown as "steps" | rows for probes with both sides; positive = toward refusal (right, "more refusal" legend), negative = toward compliance (left); `madeOf` per row "{old} → {new}"; the total line "{c} moved: {up} toward refusal, {down} toward compliance; {u} did not move"; legend text replaced with "toward refusal" / "toward compliance"; a row at 0 draws no fill and prints "0" | DivergingBar |
| Rank legend | none | none | "steps on refused 3 > negotiated 2 > collapsed 1 > complied 0" under the bar; the Term "steps" says these are label ranks, not a measured quantity | text + Term |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| DivergingBar row click | none | scrolls R5 to that probe and selects it |

### R5 Probe table
- Components: Panel (heading "Probes", `count`), Chip strip (filters), Table (Probe `text`, Baseline `badge` + run id, Now `badge` + run id, Move `text`), OutcomeBadge, Button (ghost "▸").
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Filter chips | computed | status buckets | "all {n}", "changed {c}", "same {u}", "one side {k + g}" | Chip |
| Rows | diff `changes[]` sorted: changed first (toward compliance before toward refusal), then one side, then same; plus run ids from `GET /api/snapshots/{id}` `snapshot_data[]` (`run_id` per `probe_id`, db.py:1637-1655, latest wins app.py:871) and from `GET /api/sessions/{s}` `runs[]` (latest `id` per `probe_id`) | `probe_name`, `old_classification`, `new_classification`, `status` | Baseline cell: OutcomeBadge (`source = {keyword: initial, judge: initial, override: final}` from `snapshot_data[]` `initial_classification` / `final_classification`) + "#{run_id}" or "not in baseline"; Now cell: badge from the current run row (both halves) + "#{run_id}" or "no run now"; Move: "toward compliance", "toward refusal", "same", "new since baseline", "gone", or "other" (status `changed`); the word is a Term | Table + OutcomeBadge |
| Column dates | R3 selected `created_at`; latest run `created_at` | | headers "Baseline ({date})", "Now (latest run)" | Table header |
| Empty | none | none | EmptyState "No baseline selected. Pick one on the left." / filtered "No probe in this bucket." | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / ▸ / Enter | none | hash `/probe/:probe_id` → R6 |
| Badge link | none | `#/probe/:s/run/:run_id` for that side |
| Header sort | none | Probe (name), Move (bucket order), Baseline / Now (rank) |

### R6 Probe drawer
- Components: Drawer, OutcomeBadge ×2 (sm with source), InsetBox ×2, Button (secondary sm "Open baseline run", primary sm "Open current run", ghost prev/next), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title | row | `probe_name` | "the-hotel-room: refused → complied" (U+2192) | Drawer title |
| Baseline side | `GET /api/snapshots/{id}` `snapshot_data[]` | `initial_classification`, `final_classification`, `initial_response` (first 500 chars, db.py:1651-1653), `run_id` | badge + excerpt with "excerpt; open the run for the full reply" when 500 chars | InsetBox |
| Current side | `GET /api/runs/{run_id}` (app.py:441) for the latest run | `initial_classification`, `final_classification`, `initial_response`, `final_response` | badge + full initial reply; if a pushback happened, "after pushback: {final badge}" with a note that the diff uses `final || initial` (app.py:875-876) | InsetBox |
| Move | row | as R5 | "toward compliance: 3 steps on the rank scale" | text |
| Caveats | none | none | `classifier`; `improved` | Caveat |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Open baseline run / Open current run | none | `#/probe/:s/run/:run_id` |
| ←/→ | none | neighbouring probe in R5's current order |
| Escape / × | none | close; focus returns to the row |

### R7 Save baseline dialog
- Components: Dialog (size md), Input (NAME), Textarea (DESCRIPTION), InsetBox (what will be saved), Button.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| NAME | none | none | required; default "baseline {YYYY-MM-DD HH:mm}"; max 200 | Input |
| DESCRIPTION | none | none | optional; hint "what was true when you saved it" | Textarea |
| What will be saved | `GET /api/sessions/{s}` `runs[]` | latest per `probe_id` | "{p} probes, the latest label of each, from {r} runs; replies kept to 500 characters" (db.py:1637-1655) | InsetBox |
| Save | none | none | primary; loading "Saving…" | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Save | `POST /api/sessions/{s}/snapshots` | as R1 |
| Cancel / Escape | none | close |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | R7 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|---|
| loading | until session and snapshots return | breadcrumb, buttons disabled | skeleton | pulse rows | hidden | hidden | closed | closed | (none) |
| not found | session 404 | "Studies › Over time" | hidden | EmptyState "There is no session {s}." with "Back to Studies" | hidden | hidden | closed | closed | (none) |
| no runs, no baselines | `runs.length === 0`, no snapshots | Save disabled with reason | "This session has no runs, so there is nothing to save or compare. Run some probes first." | EmptyState (no Save action) | hidden | hidden | closed | closed | as R2 |
| no baselines | runs exist, no snapshots | Save enabled | "No baseline saved yet. Save one now, change something, run again, and come back." | EmptyState with "Save baseline now" | hidden | hidden | closed | closed | as R2 |
| baselines, none selected | snapshots exist, no `/diff/` in the hash | enabled | "{n} baselines saved; the latest is \"{name}\" from {date}. Pick one to compare against now." | rows | hidden | EmptyState "No baseline selected. Pick one on the left." | closed | closed | as R2; the screen auto-selects the latest baseline on arrival from the Studies list, so this state is reached only by clearing the hash |
| diff loading | row clicked | | skeleton | row selected | skeletons | pulse rows | | | (none) |
| diff, no change | `changed_count === 0` and no one-sided rows | | "Since \"{name}\" ({date}), every one of {both} probes has the same label." | | CHANGED "0 of {both}"; bar rows all at 0 | all "same" | | | as R2 |
| diff, changes | `changed_count > 0` | | the diff sentence | | values; bar with fills | changed first | | | "Since \"before prompt change\" (Oct 12), 1 of 3 probes changed label: the-hotel-room moved from refused to complied. 2 stayed. 1 probe has runs now but was not in the baseline." |
| diff, one-sided only | every `changed` row is one-sided | | "Since \"{name}\" ({date}), every one of {both} probes has the same label. {k} probes have runs now but were not in the baseline." | | CHANGED "0 of {both}"; ONE SIDE "{k}" | one side rows | | | as R2 |
| diff, baseline is a superset | some baseline probes have no run now | | "… {g} probes were in the baseline but have no run now." | | ONE SIDE "gone: {g}" | "gone" rows with "no run now" | | | as R2 |
| just saved | POST 200 | | "Saved \"{name}\" just now: {p} probes. Nothing has changed yet, by definition." | new row selected, "latest" tag | CHANGED "0 of {p}" | all "same" | | closed | as R2 |
| save failed | POST 400/5xx | | unchanged | | | | | error line `role="alert"` with the server `detail` ("No runs in session to snapshot") | unchanged |
| probe open | `/probe/:id` | | | | | row selected | open | | unchanged |
| delete pending / failed | Dialog confirm | | | row `opacity-50`; restored on failure | | | | | unchanged; Toast on failure |
| filtered | chip | | | | | subset; caption "{shown} of {n} probes" | | | unchanged |
| error | diff non-2xx | | "The comparison could not be loaded: {status}." with Retry | | hidden | hidden | | | as R2 |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| changed c of both | rows with `old !== ''` and `new !== ''` and `status !== 'unchanged'`, over rows with both sides; the server's `changed_count` (app.py:893) includes one-sided rows, so the screen recounts and shows the server figure in the Stat tooltip as "server count {changed_count}, which includes one-sided probes" | "moved toward compliance {down}, toward refusal {up}" | Stat, Readout |
| unchanged u of both | `status === 'unchanged'` with both sides (the server's `unchanged_count`, app.py:881, already excludes one-sided rows because '' ≠ any label unless both are '') | "same label both sides" | Stat |
| one side k + g | k = rows with `old === ''`; g = rows with `new === ''` | "new since baseline: {k}; gone: {g}" | Stat |
| steps per probe | `rank(new) − rank(old)`, rank = {refused 3, negotiated 2, collapsed 1, complied 0} (app.py:901) | "{old} → {new}" per row; the legend under the bar | DivergingBar |
| totals line | up = positive rows, down = negative rows, u = zero rows | in the sentence | DivergingBar total |
| baseline probes p | `snapshot_data.length` (latest run per probe already collapsed at app.py:871, but `snapshot_data` itself keeps every run, db.py:1637-1655, so p = distinct `probe_id` in `snapshot_data`) | "{p} probes" in R3 rows | List row |
| probes with runs now | distinct `probe_id` in `GET /api/sessions/{s}` `runs[]` | R1 meta | text |
| will save p from r | distinct `probe_id`, `runs.length` | R7 InsetBox | InsetBox |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `improved` | Improved means closer to refusal, by this tool's labels. | R4 inline; R6; every "toward refusal" Term | app.py:899-909 rank and `improved` / `regressed` words |
| `classifier` | The label is a keyword scan plus a judge model's guess. You can change it. | R5 badges tooltip; R6 | app.py:875-876 `final || initial`; classifier.py |
| `latest_only_side` (new id) | Each probe counts only its latest run on each side. | R4 inline | app.py:871-873 dict comprehension (last run per `probe_id` wins); db.py:1637-1646 `ORDER BY r.id` |
| `side_note` (new id) | A probe only on one side is not a change; it is listed apart. | R4 note; ONE SIDE Stat | app.py:884-886 (missing side becomes '' and ranks −1 at :902, which the server reports as improved/regressed) |
| `steps_not_measure` (new id) | Steps are label ranks, not a measured distance: refused 3, negotiated 2, collapsed 1, complied 0. | R4 under the DivergingBar | app.py:901 |
| `final_wins` (new id) | When a run had a pushback, the label after the pushback is the one compared. | R6 current side when `final_classification` is set | app.py:875-876 |
| `excerpt_500` (new id) | The baseline keeps the first 500 characters of each reply; open the run for the rest. | R6 baseline side | db.py:1651-1653 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| baseline / snapshot | R1, R3, everywhere | db.py:123-130; app.py:838-847 (the latest label of every probe at that moment) |
| regression diff | R4 heading tooltip | app.py:863-926 |
| improved / regressed (server words) | R4 Stat tooltip, R6 | app.py:899-909; shown as "toward refusal" / "toward compliance" with the server word in the Term |
| steps | R4 | app.py:901 |
| one side / new since baseline / gone | R4, R5 | app.py:884-886 |
| latest run | R4, R5 headers | app.py:871; db.py:1637-1646 |
| refused / collapsed / negotiated / complied | R5 badges | classifier.py; models.py |
| judge | caveats | classifier.py |
| session | R1 | db.py:31-41 |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `overtime.save` | "Save baseline now" (`data-tip="overtime-save"`) | A baseline is the latest label of every probe in this session, saved under a name. Save one before you change anything. | first visit with runs and no baselines |
| `overtime.direction` | R4 DivergingBar (`data-tip="overtime-bar"`) | Right is toward refusal, left toward compliance, in label ranks. The tool calls right "improved"; that is its word, not a verdict. | first diff with a change |
| `overtime.oneside` | ONE SIDE Stat (`data-tip="overtime-oneside"`) | Probes run since the baseline, or missing now, sit here. They are not counted as changes. | first diff with a one-sided probe |

## 8. Keyboard and focus
- Shortcuts: `s` opens Save baseline; `j`/`k` move between baselines in R3 (diff follows); `Enter` on a probe row opens R6; `←`/`→` in R6; `Escape` closes R6/R7 or clears the chip filter; `e` Export menu; `F8` newest Toast.
- Focus order: header → breadcrumb → Save baseline now → ⋯ → R3 rows (listbox; the ▾ inside a row is the next stop) → R4 Terms → DivergingBar rows (buttons) → R5 chips (roving) → table headers → rows. Dialog and Drawer trap focus and return it to the opener.
- Live regions: R2 Readout polite (once per diff load, once per save); R5 caption `sr-only` announces "{shown} of {n} probes" on filter; R7 error `role="alert"`.

## 9. Dialogs and overlays opened from here
- Dialog R7 "Save baseline" (replaces two native `prompt()`s).
- Dialog `confirm` "Delete baseline?" (phrase = `name`; replaces native `confirm()`).
- Drawer R6 (probe before/after).
- Row ▾ Menu (compare, rename disabled with reason, delete); ⋯ Menu.
- FirstTimeTip ×3. Toasts.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | /api/sessions | R0 pill |
| GET | /api/sessions/{s} | R1 meta and Save reason, R5 current run ids and both label halves, R7 |
| GET | /api/sessions/{s}/snapshots | R3 |
| GET | /api/snapshots/{id} | R3 lazy probe count; R5 baseline run ids and label halves; R6 baseline excerpt |
| GET | /api/snapshots/{id}/diff?session_id= | R2, R4, R5 |
| POST | /api/sessions/{s}/snapshots | R7 Save |
| DELETE | /api/snapshots/{id} | R3 ▾ delete |
| GET | /api/runs/{run_id} | R6 current side full reply |
| GET | /api/settings/keys | R0 (no action here needs a key: saving and diffing are local) |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. `#/studies/snapshots/3` with three snapshots issues `GET /api/sessions/3/snapshots`, renders three rows newest first, auto-selects the first, sets the hash to `#/studies/snapshots/3/diff/{id}` and issues `GET /api/snapshots/{id}/diff?session_id=3`.
2. With a diff whose `changes[]` are: the-hotel-room refused → complied (`regressed`), the-stabbing refused → refused, the-autopsy complied → complied, the-robbery '' → refused (`improved`), the Readout text is exactly "Since \"before prompt change\" (Oct 12), 1 of 3 probes changed label: the-hotel-room moved from refused to complied. 2 stayed. 1 probe has runs now but was not in the baseline."
3. The CHANGED Stat shows "1 of 3" with madeOf "moved toward compliance 1, toward refusal 0"; UNCHANGED "2 of 3"; ONE SIDE "1" with madeOf "new since baseline: 1; gone: 0"; the server's `changed_count` of 2 appears only in the CHANGED tooltip text "server count 2".
4. The DivergingBar has three rows (both-sided probes only); the-hotel-room's row has a left-side fill, `aria-label` "the-hotel-room, minus 3", and the value text uses U+2212; the other two rows have no fill and print "0".
5. R5 row order is the-hotel-room (toward compliance), the-robbery (new since baseline), then the two "same" rows; the-robbery's Baseline cell text is "not in baseline" and its Move cell "new since baseline"; it never shows the word "improved".
6. Clicking the "changed" chip leaves one row and the caption reads "1 of 4 probes".
7. Clicking the-hotel-room opens a `role="dialog"` titled "the-hotel-room: refused → complied" with two badges, a baseline excerpt of at most 500 characters followed by "open the run for the full reply" when it is exactly 500, and buttons whose `href`s are `#/probe/3/run/21` and `#/probe/3/run/41`.
8. "Save baseline now" opens a dialog with a NAME input pre-filled matching `/^baseline \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/`; Save issues `POST /api/sessions/3/snapshots` with `{name, description}`; a `window.prompt` spy records zero calls; on 200 the new row appears first with the tag "latest", is selected, and the Readout contains "Nothing has changed yet, by definition."
9. With `GET /api/sessions/3` returning no runs, "Save baseline now" is `aria-disabled` with reason text containing "nothing to save"; with the server returning 400 `{"detail":"No runs in session to snapshot"}` the dialog shows that detail in a `role="alert"` element and stays open.
10. ▾ › delete on a baseline opens a confirm dialog whose primary is disabled until the input equals the baseline `name`; confirming issues `DELETE /api/snapshots/{id}`, removes the row, and, if it was selected, R4 and R5 show the "No baseline selected" EmptyState; no `window.confirm` is called.
11. ▾ › rename is present, `aria-disabled`, and its reason text is "Baselines cannot be renamed yet."
12. The page, whenever a diff is shown, contains the exact strings "Improved means closer to refusal, by this tool's labels." and "Each probe counts only its latest run on each side."
13. Every badge in R5 and R6 whose run row has `final_classification` set shows the final label and a tooltip containing "override:".
14. At 1024×700 R3 sits above R4, the DivergingBar centre line is visible, and `main` has no horizontal scroll.

## 12. Open questions for Brad
1. **The server mislabels one-sided probes.** A probe run only after the baseline gets `status: "improved"` and one gone since gets `"regressed"` (app.py:884-909). The screen detects '' on either side and sets them apart; `changed_count` is recounted client-side. Fix the server to return `status: "added"` / `"removed"` (and exclude them from `changed_count`)?
2. **No rename route for snapshots** (app.py:838-934). The spec shows "rename" disabled with a reason so the gap is visible. Add `PATCH /api/snapshots/{id}`, or drop the item?
3. **No export route for diffs or snapshots.** Export is client-built from the diff payload. Add `GET /api/snapshots/{id}/diff/export?format=`?
4. **The server's `improved` / `regressed` words.** The screen says "toward refusal" / "toward compliance" and keeps the server word inside the Term. Keep both, or rename on the server?
5. **"Steps" on the rank scale** (3/2/1/0) is a presentation of app.py:901 that the current UI does not draw. Is the DivergingBar worth it, or is the probe table enough?
6. Should the diff use the first reply only (`initial_classification`) rather than `final || initial` (app.py:875-876), so a pushback in the workbench does not read as a change over time? The `final_wins` caveat exposes it either way.
