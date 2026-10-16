# Repeat study

- Route(s): `#/studies/repeat/:id` (`:id` = `stat_runs.id`, one probe sent N times); `#/studies/repeat/:id/run/:n` opens iteration n in the detail drawer.
- Section: Studies
- Purpose (one sentence, what the researcher does here): see how often the same probe gets the same label when sent N times to the same model with no conversation history, and read any single iteration.
- Arrives from: Studies list row (type repeat); New study › Repeat on start (running state, EventSource handed over); Probe workbench "⋯" › "Repeat this probe N times" (arrives via the New study form pre-filled). Leaves to: sibling stat runs in the same session (R3 "Other stat runs in this session"); `#/probe/:s` via the session link; `#/studies` via the breadcrumb; `#/studies/new/repeat?session=:s&probe=:p` via "Run again".
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, Readout, Rate, Stat, Bar, OutcomeBadge, Table, List/Row, Drawer, ProgressCard, InsetBox, Button, Chip (`tag`, `count`), Term, Caveat, EmptyState, Toast, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §21 "STATISTICAL ANALYSIS": Progress card ("Progress: {completed}/{total} iterations", bar, "{failed} failed", render.js:4700-4713), Results Simple/Detailed (Probe, Model, "Refusal Rate {refused}/{total} ({pct}%)", stacked bar, render.js:4716-4797) which never rendered (defect: `startStatRun` never pushes results, api.js:1652-1657); the unshown SSE `iteration.latency_ms` and `classification`, `complete.summary`, and the never-called `GET /api/stat-runs/{id}` and `/distribution`.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies … ? ⚙ │ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Studies › Repeat › the-stabbing × 10          [Run again] [Export ▾] [⋯]          │
│     stat run 42 · session crime-set-1 · claude-sonnet-4-6 · done · Oct 15 14:02      │
│ R2  ▣ 8 of 10 iterations refused; 1 collapsed; 1 complied. 0 failed. Each iteration  │
│       was a fresh conversation with no pushback.                                     │
│ R3  ┌ Outcomes  10 iterations ─────────────────────────────────────────────────────┐ │
│     │        0%            50%           100%                                       │ │
│     │  refused    ████████████████░░░░   80% (8 of 10)                              │ │
│     │  collapsed  ██░░░░░░░░░░░░░░░░░░   10% (1 of 10)                              │ │
│     │  negotiated ░░░░░░░░░░░░░░░░░░░░    0% (0 of 10)                              │ │
│     │  complied   ██░░░░░░░░░░░░░░░░░░   10% (1 of 10)                              │ │
│     │  ⓘ A rate from 10 runs is a rate from 10 runs. · ⓘ The label is a keyword     │ │
│     │    scan plus a judge model's guess. You can change it.                        │ │
│     │ ┌ CONSISTENCY RATE ⓘ ─────┐ ┌ MEDIAN LATENCY ─────────┐ ┌ FAILED ─────────┐  │ │
│     │ │ 0.80                    │ │ 2.1 s                   │ │ 0 of 10         │  │ │
│     │ │ refused 8 ÷ 10 iterations│ │ from 10 latencies,      │ │ no iteration    │  │ │
│     │ │                         │ │ 1.4 s to 3.9 s          │ │ raised an error │  │ │
│     │ └─────────────────────────┘ └─────────────────────────┘ └─────────────────┘  │ │
│     └────────────────────────────────────────────────────────────────────────────────┘ │
│ R4  ┌ Iterations  10 ──────────────────────────────────────────────────────────────┐ │
│     │ #  │ Label      │ Latency │ Reply (first line)                       │        │ │
│     │ 1  │ REFUSED    │ 1.9 s   │ I'm not able to write a scene that…      │  open  │ │
│     │ 2  │ REFUSED    │ 2.3 s   │ I can't help with depicting…             │  open  │ │
│     │ 3  │ COMPLIED   │ 3.9 s   │ The alley was wet and…                   │  open  │ │
│     │ …  │            │         │                                          │        │ │
│     └────────────────────────────────────────────────────────────────────────────────┘ │
│ R5  ┌ Other stat runs in this session  3 ──────────────────────────────────────────┐ │
│     │ the-robbery × 10     claude-sonnet-4-6   7 of 10 refused (70%)   Oct 15   ▸   │ │
│     │ the-autopsy × 10     claude-sonnet-4-6   2 of 10 refused (20%)   Oct 15   ▸   │ │
│     │ the-stabbing × 5     claude-sonnet-4-6   4 of 5 refused (80%)    Oct 12   ▸   │ │
│     └────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
R6 Drawer (iteration detail, 440 px): "Iteration 3 of 10", label badge with its source,
   latency, the probe text, the full reply, prev / next.
R7 ProgressCard replaces R3 and R4 while running (see §3).
```
### 1024×700 differences
R1's action buttons wrap under the title line. R3's three Stat boxes go two per row then one. R4's Reply column truncates at 48 characters with the full first line in `title`; the "open" column becomes the row itself (row click). R5 shows the date under the probe name. Nothing is hidden.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav (current = Studies), HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session pill | `GET /api/sessions` (app.py:349) | `name`, `target_model` of `stat_run.session_id` | the pill shows this study's session even if another was open; switching sessions here does not change the study | SessionSwitcher |
| Key chip | `GET /api/settings/keys` (app.py:2263) | `is_set` | "r of N keys set" | KeyStatusChip |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Session pill › another session | none | `#/probe/:other` (leaves this study) after a Dialog "Leave this study?" only while running |

### R1 Title row
- Components: breadcrumb text links, Panel heading, Chip (`tag`), Button (secondary md "Run again", secondary md "Export ▾" Menu, ghost icon "⋯" Menu), Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Breadcrumb "Studies › Repeat › {probe_name} × {repeat_count}" | `GET /api/stat-runs/{id}` (app.py:2596-2603) | `summary.probe_name`, `repeat_count` | "Studies" links to `#/studies`; "Repeat" to `#/studies?type=repeat` | text |
| Meta line | same | `id`, `session_id` → session `name` via `GET /api/sessions`, `target_model`, `status`, `created_at`, `completed_at` | "stat run {id} · session {name} · {target_model} · {status word} · {created_at local}"; status words: pending → "not run yet", running → "running", complete → "done", failed → "failed" (db.py:253 default 'pending'; stat_runner.py:49, 58, 128) ; session name is a link to `#/probe/:s`; "stat run" is a Term | text + Term |
| Domain tag | same | `summary.probe_domain` | `tag` Chip uppercase | Chip |
| Run again | none | none | secondary md; disabled with reason while running ("This stat run is still going.") | Button |
| Export ▾ | none | none | Menu: "JSON (this stat run)", "CSV (iterations)"; both built client-side from the `GET /api/stat-runs/{id}` payload because no export route exists for stat runs (§12) | Button + Menu |
| ⋯ | none | none | Menu: "Open session", "Open probe in workbench", "Copy stat run id" | Button + Menu |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Run again | none | `#/studies/new/repeat?session=:s&probe=:p&n=:repeat_count` (form pre-filled) |
| Export JSON | none (client) | downloads `stat-run-{id}.json` = the full `GET /api/stat-runs/{id}` payload; Toast success "Exported stat run {id}." (draft; brad-voice pass) |
| Export CSV | none (client) | downloads `stat-run-{id}-iterations.csv` with columns `iteration_num, classification, latency_ms, response_text`; Toast as above |
| Open session | none | `#/probe/:s` |
| Open probe in workbench | none | `#/probe/:s?probe=:p` |
| Copy stat run id | clipboard | Toast "Copied." |

### R2 Readout
- Components: Readout.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Result sentence | `GET /api/stat-runs/{id}` | `summary.refused`, `summary.collapsed`, `summary.negotiated`, `summary.complied`, `summary.total` (db.py:2863-2889), `repeat_count`; failed = `repeat_count − summary.total` (failed iterations are not stored, stat_runner.py:112-125) | "{refused} of {total} iterations refused; {collapsed} collapsed; {negotiated} negotiated; {complied} complied. {failed} failed. Each iteration was a fresh conversation with no pushback." Zero outcome clauses are dropped except the first; "{failed} failed." is always present (draft; brad-voice pass) | Readout |

- Actions: none.

### R3 Outcomes panel
- Components: Panel (heading "Outcomes", subtitle "{total} iterations"), Bar, Caveat (inline ×2), Stat ×3, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Four Bar rows | `GET /api/stat-runs/{id}` `summary` (or `GET /api/stat-runs/{id}/distribution`, app.py:2607 → db.py:2892-2899, which also carries an `unknown` key for null classifications) | `refused`, `collapsed`, `negotiated`, `complied` each of `total` | rows in outcome order with `tone` = the outcome; `rest` row "unlabelled" shown only when `distribution.unknown > 0` (an iteration stored with a null label); fill = count ÷ total, never rescaled | Bar |
| Caveats | none | none | `rate_n` and `classifier` inline under the bars | Caveat |
| CONSISTENCY RATE | `summary.consistency_rate` (db.py:2880: `round(refused / total, 4)`) | number or null | Stat value two decimals; madeOf "refused {refused} ÷ {total} iterations"; Term "consistency rate" explains it is the refused share, not agreement of any kind; null (total 0) → "n/a", madeOf "no iterations finished" | Stat |
| MEDIAN LATENCY | `iterations[].latency_ms` (db.py:2853-2860; set at stat_runner.py:89) | ints | median in "2.1 s" form; madeOf "from {n} latencies, {min} to {max}"; "n/a" when no iterations | Stat |
| FAILED | `repeat_count − summary.total` | int | value "{failed} of {repeat_count}"; madeOf "no iteration raised an error" or "{failed} raised an error; their replies were not stored" (stat_runner.py:112-125 stores nothing on failure) | Stat |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Bar row click (`onSelect`) | none | filters R4 to that label; the row is `selected`; click again clears |

### R4 Iterations table
- Components: Panel (heading "Iterations", `count` Chip), Table (columns: `#` number, Label `badge`, Latency `number`, Reply `text`, open), OutcomeBadge, Button (text sm "open").
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Rows | `GET /api/stat-runs/{id}` `iterations[]` (db.py:2853-2860; columns db.py:258-267) | `iteration_num`, `classification`, `latency_ms`, `response_text`, `created_at` | sorted by `iteration_num`; Label is an OutcomeBadge with `source = { keyword: classification, judge: classification, override: null }` (a stat iteration stores one label, db.py:2840-2850, so keyword and judge cannot be told apart; the badge tooltip says "stored as one label"); `null` classification → "unclassified"; latency "1.9 s"; Reply = first line of `response_text`, 80 chars, mono | Table + OutcomeBadge |
| Missing iteration numbers | `repeat_count` vs rows | gaps | a dim row "iteration {n} failed; nothing stored" for each n in 1..repeat_count absent from `iterations[]` (stat_runner.py:112-125) | Table row (disabled) |
| Empty | none | none | EmptyState "No iterations stored yet." while pending; "Every iteration failed, so there is nothing to read." when `total === 0` and status is complete (draft; brad-voice pass) | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / "open" / Enter | none | `#/studies/repeat/:id/run/:n`, opens R6 with that iteration |
| Column sort | none | `#` and Latency sort; Label sorts by outcome rank refused > negotiated > collapsed > complied (app.py:901 rank) |

### R5 Other stat runs in this session
- Components: Panel (heading, `count` Chip), List/Row, Rate, text.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Rows | `GET /api/sessions/{s}/stat-runs` (app.py:2590 → db.py:2901-2903) minus this one | `stat_run_id`, `probe_name`, `model`, `refused`, `total`, plus `repeat_count` and `created_at` from a lazy `GET /api/stat-runs/{id}` per row (the summary omits them; studies-list.md §12.3) | "{probe_name} × {repeat_count}", model, Rate "r of N refused (pct)", date | List/Row + Rate |
| Empty | none | none | EmptyState "No other stat runs in this session." with action "Run another" → `#/studies/new/repeat?session=:s` | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click | none | `#/studies/repeat/:other` |

### R6 Iteration drawer
- Components: Drawer, InsetBox, OutcomeBadge (sm, with `source`), definition grid, Button (ghost "← prev", "next →"), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title | iteration | `iteration_num`, `repeat_count` | "Iteration 3 of 10" | Drawer title |
| Label + latency + time | iteration | `classification`, `latency_ms`, `created_at` | badge sm; "3.9 s"; local time | OutcomeBadge + grid |
| Probe | `GET /api/probes` by `stat_run.probe_id` (app.py:257) | `prompt_text` | InsetBox block, full text, "show all" at 200 px | InsetBox |
| Reply | iteration | `response_text` | mono, `whitespace-pre-wrap`, full | InsetBox |
| Caveat | none | none | `classifier` note; plus "You cannot change a stat iteration's label here: stat runs have no override route." (draft; brad-voice pass) (no PATCH exists for `stat_run_iterations`) | Caveat |
| prev / next | none | none | ghost sm; wrap disabled at the ends | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| prev / next / ← / → | none | hash to the neighbouring `/run/:n`; focus stays in the drawer |
| Escape / × | none | closes; hash back to `#/studies/repeat/:id`; focus returns to the row |

### R7 Running card (replaces R3 and R4 while `status === 'running'`)
- Components: ProgressCard (`kind: 'batch'`), OutcomeBadge, Rate, Button (danger sm "Stop watching"), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title | SSE `start` (stat_runner.py:63-71) or the study payload | `probe_name`, `target_model`, `repeat_count` | "RUNNING · the-stabbing × 10 on claude-sonnet-4-6" | ProgressCard eyebrow |
| done | SSE `iteration` / `iteration_error` (stat_runner.py:98-125) | `completed + failed` of `total` | Rate count-first "4 of 10 done" | ProgressCard `done` |
| outcomes | SSE `iteration.classification` tallied client-side | per outcome | four badges with counts | ProgressCard `outcomes` |
| current | SSE | `iteration + 1` | "now: iteration 5 of 10" | ProgressCard `current` |
| failed | SSE `iteration_error` | `failed` of `total` | amber "1 failed: {error first 120 chars}" | ProgressCard `failed` |
| batch context | SSE `batch_probe_index`, `batch_probe_total` (stat_runner.py:171-173) | ints | "probe 1 of 2 in this batch; the next probe opens as its own stat run when this one finishes" (draft; brad-voice pass) | text |
| elapsed | client | `startedAt` | "0:42" | ProgressCard |
| Stop watching | none | none | danger sm; there is no server cancel for a stat run (`POST /api/batch/{id}/cancel` is for probe batches, app.py:700, and the client-only cancel of today api.js:106-109 does not stop the server loop) | Button |
| Watching without the stream | page reloaded mid-run | none | the card shows what `GET /api/stat-runs/{id}` has, re-polled every 5 s, with "Reconnected: counts update every 5 s; the live stream was lost on reload." (draft; brad-voice pass) | text |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Stop watching | closes the EventSource | Dialog "Stop watching? The run keeps going on the server; this page will poll every 5 s instead." → polling mode |
| SSE `complete` (stat_runner.py:135-143) | `GET /api/stat-runs/{id}` | R7 → R3 + R4 with the full payload; Toast success "Done: {refused} of {total} refused." (draft; brad-voice pass); the Readout updates |
| SSE `start` for the next probe (batch) | none | Toast info "Next probe started: {probe_name} × {N}. Open it." with action → `#/studies/repeat/:next_id`; this screen stays on its own stat run |
| SSE `error` (app.py:2580 `{error}`) | none | R7 status `failed` with the reason; Toast error |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | R7 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|---|
| loading | until `GET /api/stat-runs/{id}` returns | breadcrumb "Studies › Repeat › …", buttons disabled | skeleton | Stat skeletons, Bar hidden | three pulse rows | pulse rows | closed | hidden | (none) |
| not found | 404 | "Studies › Repeat" | hidden | hidden | EmptyState "There is no stat run {id}. It may have been cleared." with "Back to Studies" | hidden | closed | hidden | (none) |
| not run yet | `status === 'pending'` and no stream | meta "not run yet" | "This stat run was created but never started; nothing was stored." | hidden | EmptyState "No iterations stored yet." | shown | closed | hidden | as R2 |
| running (stream) | arrived from New study with the EventSource, or `status === 'running'` with a live stream | "Run again" disabled with reason | "{done} of {N} iterations so far: {r} refused, …" updated per event | hidden | hidden | shown | closed | shown | "4 of 10 iterations so far: 3 refused, 1 complied. 0 failed." |
| running (polling) | `status === 'running'` and no stream | as above | as above from the payload | hidden | hidden | shown | closed | shown with the reconnect note | as above |
| done | `status === 'complete'` | all enabled | result sentence | Bar + Stats | rows | shown | closed | hidden | "8 of 10 iterations refused; 1 collapsed; 1 complied. 0 failed. Each iteration was a fresh conversation with no pushback." |
| done, all failed | complete with `total === 0` | enabled | "Every one of 10 iterations failed; nothing was stored. The last error was shown while it ran." | Bar hidden; Stats "n/a" with madeOf "no iterations finished"; FAILED "10 of 10" | EmptyState (all failed) | shown | closed | hidden | as R2 |
| done, some failed | `summary.total < repeat_count` | enabled | "… 2 failed." | Bar of `total`; FAILED "2 of 10" | rows plus dim failed rows | shown | closed | hidden | "6 of 8 iterations refused; 2 complied. 2 failed. …" |
| failed | `status === 'failed'` (stat_runner.py:58: probe not found) | meta "failed" | "This stat run failed before it started: {reason}." | hidden | EmptyState | shown | closed | hidden | as R2 |
| filtered | a Bar row selected | | | row selected | only rows with that label; heading "Iterations  3 of 10 shown" | | | | unchanged |
| iteration open | `/run/:n` | | | | row selected | | open | | unchanged |
| no key | zero keys | "Run again" disabled with reason "{provider} has no API key." | as data | as data | as data | as data | | | unchanged |
| error | fetch non-2xx other than 404 | | "This stat run could not be loaded: {status}." with Retry | hidden | hidden | hidden | | | as R2 |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| refused r of N (R2, R3 bar, R5) | `summary.refused` of `summary.total` (db.py:2869-2888) | the other three outcome counts and "{failed} failed" in the same sentence | Readout, Bar, Rate |
| each outcome bar | `count ÷ total × 100` on a 0 to 100 track | "{pct}% ({count} of {total})" per row | Bar |
| consistency rate 0.80 | `round(refused / total, 4)` (db.py:2880) | "refused 8 ÷ 10 iterations" | Stat |
| median latency | median of `iterations[].latency_ms` | "from {n} latencies, {min} to {max}" | Stat |
| failed k of N | `repeat_count − iterations.length` | "{k} raised an error; their replies were not stored" | Stat |
| done k of N (R7) | `completed + failed` of `total` from SSE | the outcome badges with counts and "now: iteration i of N" | ProgressCard |
| iterations shown m of N (R4 filtered) | rows matching the selected label | the selected label row stays highlighted in R3 | Panel subtitle |
| latency per row | `latency_ms ÷ 1000` | "s" unit | Table number cell |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `rate_n` | A rate from N runs is a rate from N runs. | R3 under the bars; every Rate | db.py:2869-2880 |
| `classifier` | The label is a keyword scan plus a judge model's guess. You can change it. | R3; R6 note (with the no-override clause below) | stat_runner.py:91 `classify`; classifier.py |
| `no_override_stat` (new id) | You cannot change a stat iteration's label here: stat runs have no override route. | R6 | no `PATCH` for `stat_run_iterations` in app.py (only `PATCH /api/runs/{id}/classification`, app.py:432) |
| `first_reply_only` | No coach, no pushback: a repeat study measures the first reply only. | R2 last sentence; R3 subtitle tooltip | stat_runner.py:44, 84-91 |
| `fresh_context` (new id) | Each iteration is a fresh conversation: nothing carries over between them. | R2; R7 | stat_runner.py:82-84 "Fresh target per iteration" |
| `failed_not_counted` (new id) | Failed iterations are not in the rate; they raised an error and stored nothing. | R3 FAILED Stat; R4 dim rows | stat_runner.py:112-125 |
| `one_label_stored` (new id) | A stat iteration keeps one label; the keyword and judge halves are not stored apart. | R4 badge tooltip; R6 | db.py:2840-2850 (`classification` only; `raw_response` unused by the runner) |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| stat run | R1 meta, breadcrumb | stat_runner.py:37-47 |
| iteration | R2, R3, R4, R6, R7 | stat_runner.py:98-110; db.py:258-267 |
| consistency rate | R3 Stat | db.py:2880 (refused ÷ total) |
| refused / collapsed / negotiated / complied | R3 bars, R4 badges | models.py outcome enum; classifier.py |
| judge | caveats | classifier.py LLM judge |
| latency | R3, R4 | stat_runner.py:87-89 |
| session | R1 meta | db.py:31-41 |
| fresh conversation | R2 | stat_runner.py:82-84 |
| batch | R7 | stat_runner.py:146-181 |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `repeat.bars` | R3 Bar (`data-tip="repeat-bars"`) | Each bar is a share of the same N iterations on a 0 to 100 track. Click one to see only those iterations. | first visit to a done repeat study |
| `repeat.consistency` | CONSISTENCY RATE Stat (`data-tip="repeat-consistency"`) | This is just the refused share again, as a fraction. It says nothing about why the other iterations differed. | after `repeat.bars` |
| `repeat.running` | R7 card (`data-tip="repeat-running"`) | Counts fill in as each iteration finishes. Leaving the page does not stop the run; the server keeps going. | first time a running study is shown |

## 8. Keyboard and focus
- Shortcuts: `←`/`→` move between iterations when the drawer is open; `j`/`k` move the row cursor in R4; `Enter` opens; `Escape` closes the drawer or clears the bar filter; `e` opens the Export menu; `F8` focuses the newest Toast.
- Focus order: header → breadcrumb links → Run again → Export → ⋯ → R3 bar rows (buttons) → Stat boxes are not focusable (their Terms are) → R4 sortable headers → rows → R5 rows. The drawer traps focus; on close focus returns to the opening row. When R7 is shown, Stop watching follows the ⋯ button.
- Live regions: R2 Readout polite (one announcement per SSE event at most every 3 s while running, once on completion); R7 counts line polite as ProgressCard; R4 `aria-busy` while loading; error line `role="alert"`.

## 9. Dialogs and overlays opened from here
- Drawer R6 (iteration detail).
- Export Menu, ⋯ Menu.
- Dialog "Stop watching?" (primary "Stop watching", cancel "Keep watching").
- Dialog "Leave this study?" when switching session in the header while running (primary "Leave", cancel "Stay").
- FirstTimeTip ×3. Toasts (done, next probe started, export, errors).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | /api/stat-runs/{id} | R1, R2, R3, R4, R6 (one payload); R7 polling every 5 s; R5 lazy per sibling |
| GET | /api/stat-runs/{id}/distribution | R3 "unlabelled" rest row (optional; the summary already has the four counts) |
| GET | /api/sessions | R0 pill, R1 session name |
| GET | /api/sessions/{s}/stat-runs | R5 |
| GET | /api/probes | R6 probe text |
| GET | /api/settings/keys | R0; R1 Run again disabled reason |
| POST | /api/sessions/{s}/stat-run | not called here; the EventSource opened by New study is handed to R7 |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With `GET /api/stat-runs/42` returning `summary {refused 8, collapsed 1, negotiated 0, complied 1, total 10}`, `repeat_count 10`, `status "complete"`, the Readout text is exactly "8 of 10 iterations refused; 1 collapsed; 1 complied. 0 failed. Each iteration was a fresh conversation with no pushback."
2. R3 renders four `[role="img"]` rows whose `aria-label`s are "refused, 8 of 10, 80 percent", "collapsed, 1 of 10, 10 percent", "negotiated, 0 of 10, 0 percent", "complied, 1 of 10, 10 percent"; the refused fill's inline width is `80%`.
3. The CONSISTENCY RATE Stat shows "0.80" and the madeOf text "refused 8 ÷ 10 iterations"; the FAILED Stat shows "0 of 10".
4. With `repeat_count 10` and only 8 `iterations[]` (numbers 1-5, 7-9), R4 has 10 rows: 8 data rows and 2 rows with text "iteration 6 failed; nothing stored" and "iteration 10 failed; nothing stored"; the FAILED Stat reads "2 of 10" and the Readout ends "2 failed. Each iteration …".
5. Clicking the "complied" bar row adds `aria-pressed="true"` (selected) and leaves one row in R4; the panel subtitle reads "1 of 10 shown"; Escape clears it.
6. Clicking iteration row 3 sets the hash to `#/studies/repeat/42/run/3` and opens a `role="dialog"` titled "Iteration 3 of 10" containing the full `response_text`; `→` moves to "Iteration 4 of 10"; Escape closes it and focus returns to row 3.
7. The drawer contains the string "You cannot change a stat iteration's label here" and no `<select>`.
8. Export › CSV triggers a download whose first line is `iteration_num,classification,latency_ms,response_text` and which has one line per stored iteration.
9. Arriving from New study with an open EventSource: on an `iteration` event `{iteration 4, total 10, classification "refused", completed 4, failed 0}` the ProgressCard shows "4 of 10 done" and the refused badge count "4"; on `complete` the card is replaced by R3 and R4 and a success Toast containing "8 of 10 refused" appears.
10. On `iteration_error` with `error "rate limited"`, the card's failed line contains "1 failed: rate limited" and the FAILED Stat after completion reads "1 of 10".
11. Reloading the page during a run shows R7 with the text "Reconnected: counts update every 5 s" and issues `GET /api/stat-runs/42` at least twice within 11 s.
12. "Run again" sets the hash to `#/studies/new/repeat?session={s}&probe={p}&n=10`; with zero keys set it is `aria-disabled` with a reason ending "Settings › Keys.".
13. R5 lists every other entry of `GET /api/sessions/{s}/stat-runs` as a row with a Rate matching `/^\d+ of \d+ refused \(\d+%\)$/` and excludes stat run 42 itself.
14. With a 404, the page shows "There is no stat run 42." and a "Back to Studies" button.
15. At 1024×700 the three Stat boxes wrap (two then one), no horizontal scroll on `main`, and every Reply cell has a `title` holding the full first line.
16. Every page state that renders a Rate also renders the exact string "A rate from N runs is a rate from N runs." (fixture test).

## 12. Open questions for Brad
1. **No export route for stat runs.** The Export menu builds JSON and CSV in the browser from the detail payload. Fine, or add `GET /api/stat-runs/{id}/export?format=` next to the comparison and sequence exports (app.py:1825, 2452)?
2. **No server cancel for a stat run.** The loop at stat_runner.py:81-125 has no cancel flag; "Stop watching" only closes the stream. Add a cancel (like `POST /api/batch/{id}/cancel`, app.py:700) or leave it?
3. **One stat run per probe.** The screen keys on `stat_runs.id` (one probe). A batch of probes shows up as sibling rows in R5 and as "next probe started" Toasts. If a batch should be one study page with a per-probe table, the backend needs a batch id (studies-list.md §12.1).
4. **No label override on iterations.** There is no `PATCH` for `stat_run_iterations`. Keep stat labels read-only (the caveat says so), or add the route so a human can correct one?
5. Should the `unknown` bucket from `/distribution` (db.py:2898) show as a bar row, or only as a footnote? The spec shows it as a "rest" row only when non-zero.
