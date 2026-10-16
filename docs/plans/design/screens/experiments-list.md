# Experiments

- Route(s): `#/experiments`
- Section: Experiments
- Purpose (one sentence, what the researcher does here): see every experiment (a system-prompt change tested across conditions × probes × models), what state each is in, how far it has run, and open one or start a new one.
- Arrives from: header nav "Experiments"; Home "Experiments" card and Home "recent"; Results list rows of kind experiment; the "←" / brand link from `#/experiments/:id` and `#/experiments/new`; a completed Framing-variants conditions run (`#/library/variants` → "Run as experiment", see `experiment-new.md` §0). Leaves to: `#/experiments/:id` (row click, Enter), `#/experiments/new` ("New experiment"), `#/settings#keys` (key chip), header nav for everything else.
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu (§1), Panel (§2.3), EmptyState (§2.6), Readout (§3), Term (§4), Caveat (§5), Rate (§6), OutcomeBadge is **not** used here (no labels on this screen), Table (§12), Chip (§17), Button (§15), Input (§16), Menu (§20), Drawer (§19), Dialog confirm variant (§18), Toast (§21), ProgressCard (§28), FirstTimeTip (§22).
- Baseline surfaces replaced (from `../00-content-inventory.md`): §30 "Experiments": list / empty / cards (experiment.js:174-243). Also absorbs the "Condition Experiment #{id} · View Results" card on Framing Variants › Results (§20, render.js:1807-1824), since every experiment, including the auto-created "Condition run: {session} @ {ts}" ones (app.py:596-601), is a row here.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies Experiments … ? ⚙│ R1 Header (44 px)
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ┌ RUNNING NOW ───────────────────────────────────────────────────────────────────────────┐│
│    │ ┌ RUNNING · experiment "tone-vs-none"                                          0:42 ┐  ││
│    │ │ ████████████░░░░░░░░░░░░░░░░░░░  11 of 18 done                                      │  ││
│    │ │ now: claude-sonnet-4-6 · 1 failed (retry queued)                                    │  ││
│    │ │ ⓘ Closing or reloading Flinch stops a run. You can resume it from where it stopped. │  ││
│    │ │ [Pause] [Open]                                                                      │  ││
│    │ └─────────────────────────────────────────────────────────────────────────────────────┘  ││
│    └──────────────────────────────────────────────────────────────────────────────────────────┘│
│ R3 ┌ Experiments  3 experiments ─────────────────────────────────── [+ New experiment] ────┐│
│    │ ▣ In plain words: 3 experiments. 1 is running (11 of 18 cells done), 1 is finished,   ││
│    │   1 is a draft that has not started.                                                    ││
│    │ R4 [search by name…            ]  [all 3] [draft 1] [running 1] [paused 0] [done 1]   ││
│    │      [failed 0]                                                                          ││
│    │ R5 ┌──────────────────────┬─────────┬──────────┬────────────────────┬──────────┬──────┬─┐││
│    │    │ Name              ▾  │ Status  │ Conds    │ Models             │ Done     │ Created│⋯│││
│    │    ├──────────────────────┼─────────┼──────────┼────────────────────┼──────────┼──────┼─┤││
│    │    │ tone-vs-none         │ running │ 3        │ claude-sonnet-4-6, │ 11 of 18 │ 16 Oct│⋯│││
│    │    │ Does a clinical reg… │         │          │ gpt-4o-mini        │ (61%)    │ 14:02 │ │││
│    │    │ brevity-check        │ done    │ 2        │ claude-sonnet-4-6  │ 6 of 6   │ 15 Oct│⋯│││
│    │    │                      │         │          │                    │ (100%)   │ 09:30 │ │││
│    │    │ Condition run: 4 @ … │ draft   │ 2        │ claude-sonnet-4-6  │ none yet │ 14 Oct│⋯│││
│    │    │ Auto-created from a… │         │          │                    │          │ 18:11 │ │││
│    │    └──────────────────────┴─────────┴──────────┴────────────────────┴──────────┴──────┴─┘││
│    │ R6 ⓘ "Done" counts cells: one probe under one condition on one model. A cell that      ││
│    │      failed after 5 tries counts as done and is listed as failed on the experiment.    ││
│    └──────────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
Regions: R1 Header · R2 Running now (only when the app-level run store has an experiment run) · R3 Experiments panel · R4 Filter row · R5 Table · R6 Panel footnote (Caveat note).

### 1024×700 differences
R2 and R3 keep full width. In R5 the Models column truncates to one model plus "+1" (title shows all); the Description line under the name clamps to one line at 48 characters; the Created column drops the time (title keeps it). The status chips in R4 wrap to two rows. Nothing is hidden.

## 2. Regions

### R1 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav (current = Experiments), HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session pill | `GET /api/sessions` | current session `name`, `target_model` | truncate name at 18 chars below 1280 | SessionSwitcher |
| Key chip | `GET /api/settings/keys` | `[].provider`, `[].is_set` (app.py:2263-2275) | "r of N keys set" | KeyStatusChip |
| Nav | none | none | "Experiments" has `aria-current="page"` | PrimaryNav |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Brand | none | `#/` |
| Key chip | none | `#/settings#keys` |
| Nav items | none | the section route |

### R2 Running now
- Components: Panel (`heading` "Running now", eyebrow style), ProgressCard (§28) per active run, Caveat (`run_stops_on_close`, inline).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Card title | app store `runs[expId].name` (from `GET /api/experiments/{id}` `experiment.name`, app.py:2797) | `experiment.name` | as stored | ProgressCard `title` |
| Bar + "11 of 18 done" | last stream event in the store, from `POST /api/experiments/{id}/start` or `/resume` (app.py:2901-2942; runner.py:485-533) | `completed`, `total` from the last `{type:"progress"}` event (runner.py:509) | `Rate` count-first; percent beside | ProgressCard `done` |
| "now: {model}" | same stream | `model` of the last progress event (runner.py:509) | model id in mono | ProgressCard `current` |
| "1 failed (retry queued)" | same stream | `failed` (runner.py:509-513) | hidden when 0; wording "retry queued" is wrong once the runner has given up (5 tries, runner.py:437), so it reads "{failed} failed" only | ProgressCard `failed` |
| Elapsed "0:42" | store `startedAt` | none | `mm:ss` mono | ProgressCard |
| Caveat | `lib/copy/caveats.ts` | `run_stops_on_close` | inline | Caveat |
| For a Framing-variants conditions run (store kind `batch-conditions`) | `POST /api/sessions/{id}/batch-conditions` stream (app.py:572-700) | `completed`, `total`, `condition`, `probe_name` of the last `event: progress` (runner.py:364-376) | "now: {probe_name} × {condition}" | ProgressCard |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Pause | `POST /api/experiments/{id}/pause` (app.py:2920-2925) | card eyebrow "PAUSED"; the stream keeps delivering up to 10 more cells per provider (runner.py:497-505), the card says "Pausing… up to 10 more cells per provider finish first" (draft; brad-voice pass) until the stream ends; toast "Paused." For a `batch-conditions` run there is no pause route: the button is disabled with reason "A variant-group run cannot be paused; cancel stops it" (draft; brad-voice pass) |
| Cancel | aborts the fetch in the store (client side only; the server generator stops when the client disconnects, app.py:2908-2917) | Dialog (plain confirm, no typed phrase) "Stop this run? Finished cells are kept; the rest stay pending and can be resumed." (draft; brad-voice pass) → store entry removed; toast "Stopped. {completed} of {total} cells are kept." |
| Open | none | `#/experiments/:id` Overview |

### R3 Experiments panel
- Components: Panel (`heading` "Experiments", `subtitle` "{n} experiments"), Readout, Button primary md "New experiment" in the Panel `actions` slot.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Subtitle "3 experiments" | `GET /api/experiments` (app.py:2788-2791; db.py:3247-3261) | `experiments.length` | "1 experiment" / "n experiments" | Panel subtitle |
| Readout | same + per-row `GET /api/experiments/{id}` | counts by `experiments[].status` (models.py:205-210), plus `progress.completed`/`progress.total` of running rows (db.py:3496-3503) | sentence shape in §3 | Readout |
| New experiment | none | none | primary md | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| New experiment | none | `#/experiments/new` |

### R4 Filter row
- Components: Input (header variant, Search icon), Chip `kind: 'chip'` × 6 with counts.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Search | none (client filter) | matches `name` and `description` case-insensitively | placeholder "search by name…" | Input |
| Status chips | `GET /api/experiments` | count of rows per `status`; "all" = total; "done" = `completed` (the chip shows the plain word, the Term tooltip gives the real name `completed`) | "{word} {count}"; a 0-count chip is rendered but disabled with reason "none" | Chip |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Type in search | none | filters R5 live; count in the chips does not change (they count the whole list); R5 empty filtered state when nothing matches |
| Click a chip | none | selects that status (single select; "all" clears); persisted in `localStorage['flinch:experiments:filter']` |

### R5 Table
- Components: Table (§12) with `caption` "Experiments, newest first", `rowKey` = `id`, `onRowClick`, `sort` default `created_at desc`; Rate (§6) in the Done column; Menu (§20) in the ⋯ column; Chip tag for status.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Name | `GET /api/experiments` | `experiments[].name` | `text-zinc-200`, truncate at the column width with title | Table text |
| Description (second line under Name) | same | `experiments[].description` | `text-xs text-zinc-500`, one line clamp; blank line omitted when empty | Table text |
| Status | same | `experiments[].status` | tag pill; word is the status with "completed" shown as "done" beside a Term `experiment_status`; `failed` in `text-red-300` | Chip tag + Term |
| Conds | per row `GET /api/experiments/{id}` | `conditions.length` (app.py:2800; db.py:3299-3306) | integer; skeleton `animate-pulse` until loaded | Table number |
| Models | `GET /api/experiments` | `model_ids[]` + `base_model_ids[]` (db.py:3254-3258) | comma list in mono; base models get a tag "base" after the id | Table text |
| Done | per row `GET /api/experiments/{id}` | `progress.completed`, `progress.total` (db.py:3467-3503) | `Rate` count-first "11 of 18 (61%)"; `total === 0` → "none yet" (Rate `of === 0`); `failed > 0` adds "· {failed} failed" in `text-amber-400` | Rate |
| Created | `GET /api/experiments` | `created_at` (SQLite `datetime('now')`, UTC, db.py:333) | local time "16 Oct 14:02"; title shows the ISO string and "UTC → local" | Table text |
| ⋯ | none | none | ghost icon button, Menu | Menu |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / Enter | none | `#/experiments/:id` (Overview tab; the Conditions tab when the row's status is `completed`, so a finished run opens on its results) |
| Sort header | none | client sort on name, status, created, done fraction |
| ⋯ › Open | none | `#/experiments/:id` |
| ⋯ › Quick look | per row data already loaded | Drawer (§19) titled with the name: description, model list, conditions as a List with label and the first 120 chars of `system_prompt` (db.py:3302), progress by condition from `progress.by_condition` keyed by condition id (db.py:3490-3494) as Rate per row, dates created/started/completed, "Open" primary sm |
| ⋯ › Rename or describe | `PUT /api/experiments/{id}` `{name?, description?}` (app.py:2805-2812; `UpdateExperimentRequest` app.py:44-48) | Dialog with two fields; on save the row updates; toast "Saved." |
| ⋯ › Delete | `DELETE /api/experiments/{id}` (app.py:2815-2820; cascade to conditions, prompts, responses, db.py:360-362) | Dialog confirm variant, phrase = the experiment name, prompt "Type the experiment name to delete it and every response it collected" (draft; brad-voice pass); disabled with reason "Stop the run first" while the store has a run for this id; on success the row is removed, toast "Deleted {name}." |

### R6 Panel footnote
- Components: Caveat (`cell_definition`, note variant).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Note | `lib/copy/caveats.ts` | `cell_definition` | note variant under the table | Caveat |

- Actions: none.

## 3. States
| State | Trigger | R2 | R3 | R4 | R5 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|
| loading | route entered, `GET /api/experiments` in flight | hidden unless the store has a run | subtitle "loading…" | chips with no counts, disabled | three `animate-pulse` rows | (Readout wrapper mounted, text null) |
| empty | 200 with `experiments: []` | hidden | subtitle "0 experiments" | hidden | EmptyState "No experiments yet. An experiment tests whether a system prompt changes what the model does, across conditions, probes and models." with action "New experiment" | "Nothing here yet. Start with New experiment." |
| no key | `GET /api/settings/keys` has no `is_set` | as data | New experiment stays enabled (an experiment can be drafted without keys; Start is where the key is needed, see `experiment.md` Overview) | as data | as data | sentence as "with data" plus "No API key is set, so nothing can run until you add one in Settings." |
| with data | 200 with rows | as store | counts | counts | rows; Conds and Done fill in as each `GET /api/experiments/{id}` returns | "3 experiments. 1 is running (11 of 18 cells done), 1 is finished, 1 is a draft that has not started." |
| with data, row detail failed | a per-row `GET /api/experiments/{id}` fails | — | — | — | that row's Conds and Done show "n/a" with Term `row_detail_failed` ("Flinch could not load this experiment's progress"); a Retry text button in the row | unchanged |
| filtered empty | search or chip yields no rows | — | — | as chosen | EmptyState "No experiment matches that search." with action "Clear" | unchanged |
| running (store has a run) | `runs` store non-empty | one ProgressCard per run | as data | as data | that row's Done updates every 2 s from `GET /api/experiments/{id}/progress` (app.py:2945-2948) while the store has a run or the row's status is `running` | "… 1 is running (11 of 18 cells done) …" |
| interrupted | a row has `status: "running"` but the store has no run for it (Flinch was closed or reloaded mid-run, app.py:2908-2917) | hidden | as data | counts the row under "running" | the Status cell reads "running (interrupted)" with Term `interrupted_run`; Done still counts; opening the row offers Resume | "… 1 was interrupted by a reload: open it to resume …" |
| error | `GET /api/experiments` non-2xx or network | — | subtitle "could not load" | hidden | EmptyState "Flinch could not load the experiment list. {status or message}." with action "Retry" | (null) and an error Toast "Could not load experiments. {message}" |
| delete in flight | Dialog primary clicked | — | — | — | row `opacity-50`; Dialog primary shows the spinner | unchanged |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "3 experiments" | `experiments.length` | the rows themselves | Panel subtitle |
| chip counts | rows per `status` | the chip word | Chip |
| Conds | `conditions.length` from `GET /api/experiments/{id}` | the Quick look drawer lists them | Table number |
| Done "11 of 18 (61%)" | `progress.completed` of `progress.total` (db.py:3477-3483); percent by `format.pct` (tokens §6) | the count is the number; the footnote R6 says what a cell is | Rate |
| "· 1 failed" | `progress.failed` | beside Done | Rate suffix |
| Elapsed "0:42" | `Date.now() − startedAt` | the running card | ProgressCard |
| Readout counts | counts above | the sentence names each | Readout |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `cell_definition` | "A cell is one probe under one condition on one model. A cell that failed after five tries counts as done and is listed as failed." | R6 under the table | `create_experiment_responses` builds one row per condition × prompt × model (db.py:3396-3411); `MAX_RETRIES = 5` and the failed path (runner.py:437, 510-513); progress counts `failed` separately from `completed` (db.py:3478-3483) |
| `run_stops_on_close` | "Closing or reloading Flinch stops a run. Finished cells are kept; open the experiment to resume the rest." | R2 card | the run is an HTTP stream that ends when the client disconnects (app.py:2908-2917, 2935-2942); resume re-reads pending cells (db.py:3506-3533) |
| `interrupted_run` (Term, not Caveat) | "Status says running but no run is open in Flinch. The server does not reset the status when a stream is cut; Resume continues from the pending cells." | Status cell | status is set to `running` at start (runner.py:468) and only changed by the runner's own completion (runner.py:530-531) or pause (app.py:2923) |
| `rate_n` (existing) | "A rate from N runs is a rate from N runs." | Rate hover | `03-components.md` §5 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| experiment | panel heading (first use) | one system-prompt change tested as conditions × probes × models; `experiments` table (db.py:323-336) |
| condition | Conds column header | a label plus a system prompt (models.py:213-217) |
| cell | R6 footnote, Done column | one response row (db.py:358-377) |
| experiment status (draft, running, paused, completed, failed) | Status column, chips | `ExperimentStatus` (models.py:205-210) |
| base model | Models column tag | `base_model_ids` run through `BaseModelTarget` (runner.py:596-597) |
| interrupted run | Status cell | §5 |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `experiments.new` | `[data-tip="experiments-new"]` (New experiment button) | "An experiment asks one question: does a system prompt change what the model does? You set the conditions, pick probes and models, and Flinch runs every cell." why: "Each condition is one system prompt; the baseline is usually a plain one." | first visit to `#/experiments` with the list loaded (any state) |
| `experiments.done-column` | `[data-tip="experiments-done"]` (Done header) | "Done counts cells, not probes. The percent is beside its count." | first time a row has `progress.total > 0` |
| `experiments.running-card` | `[data-tip="experiments-running"]` (first ProgressCard) | "This run keeps going while you move around Flinch. Closing or reloading Flinch stops it." | first time R2 is shown |

## 8. Keyboard and focus
- Shortcuts: `/` focuses search; `n` opens New experiment (when focus is not in an input); `Enter` on a focused row opens it; `Delete` on a focused row opens the delete Dialog; `Escape` clears the search when it has focus; `F8` to the newest toast (global).
- Focus order: header (brand, session pill, key chip, nav, ?, ⚙) → R2 cards (Pause, Cancel, Open per card) → New experiment → search → status chips (roving) → table sortable headers → rows (roving, `Tab` leaves the table) → ⋯ buttons are reached with `Right` from a focused row.
- Live regions: Readout (`role="status"`); each ProgressCard counts line (`aria-live="polite"`, throttled 3 s); Toast regions; the table announces "Showing {k} of {n} experiments" on filter change via an `sr-only` polite region.

## 9. Dialogs and overlays opened from here
- Rename or describe Dialog (md): Input "Name" (required, 1 to 200 chars, models.py:251), Textarea "Description"; primary "Save".
- Delete Dialog (confirm variant): phrase = experiment name; intro "This deletes the experiment, its conditions, prompts and every collected response. Exports you already downloaded are unaffected." (draft; brad-voice pass).
- Stop run Dialog (plain): see R2 Cancel.
- Quick look Drawer (440 px).
- Row ⋯ Menu: Open, Quick look, Rename or describe, Delete (danger).
- FirstTimeTips in §7; HelpMenu and Shortcuts dialog (global).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/experiments` | R3 on enter, after delete, after rename, on Retry |
| GET | `/api/experiments/{id}` | R5 per row (conditions count, progress), Quick look |
| GET | `/api/experiments/{id}/progress` | R5 Done cell poll every 2 s for rows in the store or with status running |
| PUT | `/api/experiments/{id}` | ⋯ › Rename or describe |
| DELETE | `/api/experiments/{id}` | ⋯ › Delete |
| POST | `/api/experiments/{id}/pause` | R2 Pause |
| GET | `/api/sessions` | R1 SessionSwitcher |
| GET | `/api/settings/keys` | R1 KeyStatusChip, no-key state |
| (stream held, not started here) | `POST /api/experiments/{id}/start`, `/resume`, `POST /api/sessions/{id}/batch-conditions` | R2 reads the app-level store that holds these streams; they are opened from `experiment.md` Overview and `experiment-new.md` §0 |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With an empty database, `#/experiments` renders one `EmptyState` whose text ends with "." and contains a button named "New experiment"; no `<table>` is present.
2. With three experiments seeded (statuses running, completed, draft), the table has three `<tr>` in `<tbody>`, ordered by `created_at` descending; the first cell of each row contains the experiment name.
3. The Done cell for the completed experiment reads exactly `6 of 6 (100%)` and the draft's reads `none yet`; no Done cell contains a percent without a "k of n" in the same cell.
4. The Status cell for status `completed` shows the word "done" and its `role="term"` tooltip contains "completed".
5. Clicking the chip "draft 1" leaves exactly one row; the `sr-only` status region contains "Showing 1 of 3 experiments"; reloading the page restores the chip (localStorage).
6. Pressing `/` moves focus to the search input; typing "tone" leaves one row; pressing `Escape` clears it.
7. Focusing a row and pressing `Enter` changes `location.hash` to `#/experiments/{id}`.
8. Choosing ⋯ › Delete opens a dialog with `role="dialog"`; its primary button is `disabled` until the input equals the experiment name exactly (case-sensitive); after confirm, one `DELETE /api/experiments/{id}` request is made and the row is gone.
9. With a run present in the store (start one from the Overview, navigate here), R2 shows a `ProgressCard` whose `role="progressbar"` `aria-valuenow` increases over time and whose text contains "Closing or reloading Flinch stops a run"; the Done cell of the matching row updates within 3 s of a progress event.
10. With a row at status `running` and no store entry, its Status cell contains "interrupted" and the Term tooltip text matches the `interrupted_run` phrase.
11. Lint: every visible string on this screen passes `copy-lint` (sentence case, no em dash, bare-percent regex).
12. At 1024×700, no horizontal scrollbar on `body`; all six status chips are visible; the Models cell of the two-model row shows one id and "+1".

## 12. Open questions for Brad
1. The list route returns no condition count or progress (db.py:3247-3261), so the table makes one `GET /api/experiments/{id}` per row. For a long list this is N+1. Fine for a local tool, or do you want a backend `?include=progress` on the list route added to the plan?
2. Should rows at status `completed` open on the Conditions tab (results first) as specified, or always on Overview?
