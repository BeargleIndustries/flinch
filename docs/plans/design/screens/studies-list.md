# Studies

- Route(s): `#/studies` (filters in the query string: `#/studies?type=repeat&session=3&model=claude-sonnet-4-6&status=done&q=stab`)
- Section: Studies
- Purpose (one sentence, what the researcher does here): see every study ever run, across sessions, with its headline result and its inputs, and open or start one.
- Arrives from: header nav "Studies"; Home question card "Is the refusal consistent?"; the "Studies" footer link on every study screen; Probe workbench "⋯" menu › "Studies for this session" (arrives with `?session=:s`). Leaves to: a study screen (row click), `#/studies/new` ("New study"), the session's Probe workbench (session link in a row), Experiments (a conditions-type framing run), back with the browser Back button or the header nav.
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, Readout, Table, Chip (`chip`, `tag`, `count`), Select, Input, Button, Menu, Drawer, Rate, OutcomeBadge, Term, Caveat, EmptyState, Toast, Dialog (`confirm` variant), FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §17 "Multi-Model Comparison" › COMPARISON HISTORY (render.js:1262-1289); §19 "Narrative Momentum" › Sequences (n) list cards (render.js:3933-3985); §21 "STATISTICAL ANALYSIS" (the never-called `GET /api/sessions/{id}/stat-runs` history, api.js:1688); §22 Dashboard › Overview comparison and sequence rows (the "past results" half of the dashboard); §29 "Regression Snapshots" browser list; §8 Session idle "Compare to Baseline" entry. The Framing Variants Results tab (§20) gets a row here per session so it is reachable without re-entering the tool.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies … ? ⚙ │ R0 Header (44 px)
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Studies  every stat run, framing result, model comparison, narrative sequence    │
│     and baseline, across sessions                                   [ New study ]    │
│ R2  ▣ 14 studies across 4 sessions: 6 repeat, 2 framing, 3 models, 2 context,        │
│       1 over time. 1 running now.                                                    │
│ R3  [all 14] [repeat 6] [framing 2] [models 3] [context 2] [over time 1]             │
│     Session [all sessions ▾]  Model [all models ▾]  Status [any ▾]  [search…      ]  │
│ R4  ┌──────────┬──────────────┬──────────────────┬────────┬─────────────────────────┬──────────┬───┐
│     │ Type     │ Session      │ Model            │ Status │ Headline                │ Date     │   │
│     ├──────────┼──────────────┼──────────────────┼────────┼─────────────────────────┼──────────┼───┤
│     │ repeat   │ crime-set-1  │ claude-sonnet-4-6│ running│ 12 of 30 iterations done│ today    │ ⋯ │
│     │ repeat   │ crime-set-1  │ claude-sonnet-4-6│ done   │ 8 of 10 refused (80%)   │ Oct 15   │ ⋯ │
│     │          │              │                  │        │ the-stabbing × 10       │          │   │
│     │ framing  │ crime-set-1  │ claude-sonnet-4-6│ done   │ 1 of 2 groups agree     │ Oct 15   │ ⋯ │
│     │ models   │ (3 sessions) │ 3 models         │ done   │ 2 of 3 probes agree     │ Oct 14   │ ⋯ │
│     │          │              │ claude-sonnet-4-6 vs gpt-4.1 vs gemini-2.5-flash     │          │   │
│     │ context  │ crime-set-1  │ claude-sonnet-4-6│ done   │ threshold 4 warm-up     │ Oct 14   │ ⋯ │
│     │          │              │                  │        │ turns, the-stabbing     │          │   │
│     │ over time│ crime-set-1  │ claude-sonnet-4-6│ 2 base-│ 1 of 3 probes changed   │ Oct 12   │ ⋯ │
│     │          │              │                  │ lines  │ since "before prompt"   │          │   │
│     └──────────┴──────────────┴──────────────────┴────────┴─────────────────────────┴──────────┴───┘
│ R5  ⓘ A headline is the study's own number with its count. The label behind every    │
│     count is a keyword scan plus a judge model's guess.                              │
└──────────────────────────────────────────────────────────────────────────────────────┘
R6 Drawer (opens from a row's "Peek", right side, 440 px): headline, what it is made of,
   the session and model, "Open study", export and delete where the study type allows.
```
### 1024×700 differences
R3 wraps to two lines (type chips on line one, the three Selects and the search on line two). R4 drops the Date column into the Headline cell as a second line ("Oct 15 · the-stabbing × 10") and the Model column truncates model ids at 22 characters with the full id in `title`; nothing is hidden. The Drawer keeps 440 px and overlays the table.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav (current = Studies), HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session pill | `GET /api/sessions` (app.py:349; db.py:697) | `[].name`, `[].target_model` | name truncates at 18 chars below 1280 | SessionSwitcher |
| Key chip | `GET /api/settings/keys` (app.py:2263) | `providers[].is_set` | "r of N keys set" | KeyStatusChip |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Session pill item | none | sets `?session=` filter on this screen (the Studies list does not require a session; picking one filters it) |
| Nav "Studies" | none | stays |

### R1 Title row
- Components: Panel heading (page-level `h1` in the Panel heading style), Button (primary md), Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Heading "Studies" | none | none | sentence case | Panel heading |
| Subtitle "every stat run, framing result, model comparison, narrative sequence and baseline, across sessions" (draft; brad-voice pass) | none | none | each real name is a Term: stat run, framing variant, narrative sequence, baseline | Panel subtitle + Term |
| "New study" | none | none | primary md | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| New study | none | `#/studies/new` (keeps `?session=` if set, so the picker pre-fills the session) |

### R2 Readout
- Components: Readout.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Count sentence | assembled from R4's rows (see "How the list is built" below) | row count per type; `status === 'running'` count; distinct `session_id` count | "{n} studies across {s} sessions: {a} repeat, {b} framing, {c} models, {d} context, {e} over time. {r} running now." Zero-count types are omitted from the list; "{r} running now." is omitted when r = 0 (draft; brad-voice pass) | Readout |

- Actions: none.

### R3 Filters
- Components: Chip (`chip`, selectable, strip), Select ×3, Input (header variant with Search icon).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Type chips "all N", "repeat n", "framing n", "models n", "context n", "over time n" | R4 rows | count per `type` | count as a `count` pill after the word; selected chip `aria-pressed` | Chip |
| Session Select | `GET /api/sessions` (app.py:349) | `[].id`, `[].name` | "all sessions" first; sessions auto-created by a models study (`notes` starts with "Auto-created by multi-model comparison", app.py:1716) are listed under a "compare sessions" optgroup, not hidden | Select |
| Model Select | distinct `model` over R4 rows | string | "all models" first; sorted | Select |
| Status Select | R4 rows | `status` | options: any, running, done, failed, not run yet | Select |
| Search | none | none | matches session name, model, probe name, group id, strategy name, comparison name, baseline name; placeholder "search studies…" (draft; brad-voice pass) | Input |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| any filter | none | rewrites the query string (`type`, `session`, `model`, `status`, `q`) and filters R4 client-side; R2 recounts for the filtered set and says "{n} of {total} studies match" (draft; brad-voice pass) when a filter is active |
| "/" key | none | focuses Search |

### R4 Study table
- Components: Table (columns: Type `badge`-like text, Session `text`, Model `text`, Status `text`, Headline `rate`/`text`, Date `text`, menu), Rate, OutcomeBadge (inside the Peek drawer only), Menu, Chip (`tag` for the type word), Button (ghost icon "⋯").

How the list is built. There is no studies route in app.py; the list is assembled client-side from five sources and cached for the screen's lifetime:

| Study type | List source | Per-row detail source (lazy, when the row scrolls into view) |
|---|---|---|
| repeat | for each session: `GET /api/sessions/{id}/stat-runs` (app.py:2590 → db.py:2901-2903) returns `[{stat_run_id, probe_id, probe_name, probe_domain, model, total, refused, collapsed, negotiated, complied, consistency_rate}]` | `GET /api/stat-runs/{id}` (app.py:2596-2603) for `status`, `repeat_count`, `created_at`, `completed_at` (columns on `stat_runs`, db.py:247-256), which the list summary drops (db.py:2863-2889) |
| framing | for each session: `GET /api/sessions/{id}/consistency` (app.py:938 → db.py:1530-1600) `{groups[], consistency_score, consistent_count, total_groups}`; a session gets a framing row when at least one group has `has_data` | none |
| models | `GET /api/comparisons` (app.py:1806 → db.py:2493-2503) `[{id, name, models[], probe_ids[], session_ids{}, agreement_rate, total_probes, created_at, notes}]` | none |
| context | `GET /api/dashboard/sequences` (app.py:2447 → db.py:2678-2691) `[{id, session_id, probe_id, strategy_id, mode, max_warmup_turns, use_narrative_engine, status, created_at, completed_at, session_name, target_model}]`; probe and strategy names from `GET /api/probes` (app.py:257) and `GET /api/strategies` (app.py:1946) by id | `GET /api/sequences/{id}` (app.py:2021 → db.py:2404-2424) for `summary.threshold_warmup_count`, `summary.threshold_found`, `summary.total_runs`, `summary.complied`, `summary.refused` |
| over time | for each session: `GET /api/sessions/{id}/snapshots` (app.py:849 → db.py:1669-1674) `[{id, session_id, name, description, created_at}]`; one row per session with ≥ 1 snapshot | `GET /api/snapshots/{id}/diff?session_id=` (app.py:863-926) for the latest snapshot: `changed_count`, `unchanged_count`, `changes[]` |

Request budget: 1 (`/api/sessions`) + 3 per session + 2 global calls, issued in parallel after `/api/sessions` returns; rows render as each source arrives (the table shows the arrived rows and a loading row per pending source). Sessions auto-created by a models study are skipped for the per-session calls (their runs are already inside the comparison record).

- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Type | derived | `type` | one of "repeat", "framing", "models", "context", "over time" as a `tag` Chip; each word is a Term on first appearance in the column | Chip + Term |
| Session | `GET /api/sessions` | `name` by `session_id`; models rows: "({n} sessions)" with n = `Object.keys(session_ids).length` (app.py:1709-1720 creates one per model) | link to `#/probe/:s` for one session; for models rows the link opens the Peek drawer, which lists the n sessions | text link |
| Model | per source | repeat `model`; framing: session `target_model`; models: "{n} models" with the ids joined " vs " on a second line; context `target_model`; over time: session `target_model` | ids verbatim, mono; never shortened to the first hyphen segment (today's `split('-')[0]`, app.py:1783, loses "claude-sonnet-4-6" to "claude") | text |
| Status | per source | repeat `status` (pending/running/complete/failed → "not run yet"/"running"/"done"/"failed"); framing: "{run} of {groups} groups run" where run = groups with `has_data`; models: always "done" (a comparison is saved only when the run returns, app.py:1788-1797); context `status` (pending/running/completed/failed/abandoned → "not run yet"/"running"/"done"/"failed"/"abandoned (idle over an hour)", the last from db.py:2664-2675); over time: "{n} baselines" | plain words beside the real status in `title` | text |
| Headline | per source | see §4 | always a count with its N; a loading headline shows the Rate skeleton; a headline that cannot be computed shows "n/a" with a Term saying why | Rate / text |
| Headline second line | per source | repeat: "{probe_name} × {repeat_count}"; framing: "{consistent_count} of {total_groups} groups"; models: comparison `name`; context: "{probe_name} · {strategy_name}"; over time: "since \"{latest snapshot name}\"" | `text-xs text-zinc-500` | text |
| Date | per source | repeat `created_at` (via lazy detail); framing: latest `run_id`'s run has no date in the consistency payload, so the session's `created_at` is used and labelled "session" in `title`; models `created_at`; context `created_at`; over time: latest snapshot `created_at` | "today", "yesterday", else "Oct 15" within the year, else "2025-10-15"; full ISO in `title` | text |
| "⋯" | none | none | ghost icon sm, opens the row Menu | Button + Menu |
| Empty table | none | none | EmptyState "No studies yet. Start one from a session." (draft; brad-voice pass) with action "New study" | EmptyState |
| Filtered empty | none | none | EmptyState "No study matches these filters. Clear them to see all {n}." (draft; brad-voice pass) with action "Clear filters" | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / Enter | none | repeat → `#/studies/repeat/:stat_run_id`; framing → `#/studies/framing/:session_id`; models → `#/studies/models/:comparison_id`; context → `#/studies/context/:sequence_id`; over time → `#/studies/snapshots/:session_id` |
| Column header click | none | sorts (Type, Session, Model, Status, Date); Headline sorts by the rate's `count/of` within a type and is disabled across mixed types (header `aria-sort="none"` with a Term "headlines of different types do not sort against each other") |
| Menu › Open | none | as row click |
| Menu › Peek | detail call for the row if not yet loaded | opens R6 Drawer |
| Menu › Open session | none | `#/probe/:session_id` (hidden for models rows; the Drawer lists their sessions) |
| Menu › Export JSON / Export CSV | models: `GET /api/comparisons/{id}/export?format=json|csv` (app.py:1825); context: `GET /api/sequences/{id}/export?format=json|csv` (app.py:2452) | browser download; Toast success "Exported {name}." (draft; brad-voice pass). Hidden for repeat, framing and over time rows: no export route exists for those (see §12) |
| Menu › Delete | models: `DELETE /api/comparisons/{id}` (app.py:1819); context: `DELETE /api/sequences/{id}` (app.py:2028); over time: `DELETE /api/snapshots/{id}` per baseline from inside the Drawer (app.py:929) | Dialog `confirm` with phrase = the study's name (comparison `name`, or "{probe_name} sequence", or the baseline name); on success the row is removed and Toast "Deleted {name}." (draft; brad-voice pass). Hidden for repeat rows (no `DELETE /api/stat-runs/{id}` route) and framing rows (nothing to delete: the result is computed from runs) |

### R5 Footer caveat
- Components: Caveat (`note`).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| `classifier` caveat | none | none | pinned phrase (components §5) | Caveat |
| List-level note "A headline is the study's own number with its count; open the study for every input behind it." (draft; brad-voice pass) | none | none | `note` variant | Caveat |

- Actions: none.

### R6 Peek drawer
- Components: Drawer, InsetBox (`block`), Rate, Stat, OutcomeBadge, Button (primary sm "Open study", secondary sm export, danger sm delete), definition grid.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title | row | type + name | "Repeat study · the-stabbing × 10" | Drawer title |
| Headline | row | as §4 | Rate md with the `rate_n` caveat inline | Rate |
| Made of | row detail | repeat: `refused, collapsed, negotiated, complied, total` as four OutcomeBadge + counts; framing: `consistent_count`, `total_groups`, and the list of group ids with CONSISTENT / INCONSISTENT / "not run yet"; models: `models[]`, `total_probes`, the n sessions with links; context: `summary.total_runs`, `summary.refused`, `summary.complied` (the server counts complied + collapsed as "complied", db.py:2411), `threshold_warmup_count`; over time: `changed_count`, `unchanged_count`, latest snapshot `name`, `description` | definition grid | InsetBox |
| Session, model, date | row | as R4 | grid | definition grid |
| Open study | none | none | primary sm | Button |
| Export / Delete | as R4 Menu | | secondary / danger sm | Button |

- Actions: as R4 Menu; Escape closes and returns focus to the row's "⋯".

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|
| loading | first paint until `/api/sessions` and the two global calls return | shown | skeleton line | chips with "…" counts, Selects disabled | three `animate-pulse` rows | shown | closed | (none; live region empty) |
| partial | some per-session calls still pending | shown | counts for arrived rows plus "still loading {k} sessions" | counts update | arrived rows plus one loading row per pending source | shown | closed | "9 studies so far across 3 sessions; still loading 1 session." |
| empty | every source returns empty | shown | hidden (null text) | hidden | EmptyState with "New study" | hidden | closed | (none) |
| no sessions | `/api/sessions` returns `[]` | shown | hidden | hidden | EmptyState "No sessions yet, so no studies. Make a session in Probe, run a few probes, then come back." with action "Go to Probe" | hidden | closed | (none) |
| no key | KeyStatusChip reports zero keys | shown, "New study" enabled (the picker explains what each type needs) | as data state | as data state | as data state | plus a note "No API key is set, so a new study cannot run. Past studies still open." with a link to Settings › Keys | closed | as data state |
| with data | at least one row | shown | count sentence | counts | rows | shown | closed | "14 studies across 4 sessions: 6 repeat, 2 framing, 3 models, 2 context, 1 over time. 1 running now." |
| filtered | any filter active | shown | "{n} of {total} studies match." | active chip/Selects | filtered rows or filtered-empty | shown | closed | "5 of 14 studies match." |
| running row | any row with `status === 'running'` | shown | "… 1 running now." | | the row's headline is a Progress-style text "{done} of {total} iterations done" (repeat, from the detail `summary.total` against `repeat_count`) or "{sent} warm-up turns sent" (context; needs the sequence detail `runs[0]` turns, so it shows "running" alone until the Peek loads); the row re-polls its detail every 5 s while running | shown | closed | as with data |
| error (one source) | a list call fails (non-2xx or network) | shown | counts for what arrived plus "could not load {source}" | | a red error row for that source with "Retry" (secondary sm) | shown | closed | "Loaded 3 of 4 sessions; the stat runs for crime-set-2 did not load." |
| error (all) | `/api/sessions` fails | shown | hidden | hidden | EmptyState "Flinch could not reach its own server. Check that it is running, then retry." with "Retry" | hidden | closed | (none) |
| peek open | Menu › Peek | dimmed behind backdrop | | | | | open | unchanged |
| delete pending | Dialog confirmed, DELETE in flight | | | | row `opacity-50` | | primary loading "Deleting…" | unchanged |
| delete failed | DELETE non-2xx | | | | row restored | | error line in Dialog | unchanged; Toast error "Could not delete {name}: {status}." |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Studies count (R2) | rows after assembly | per-type counts and session count in the same sentence | Readout |
| Repeat headline "8 of 10 refused (80%)" | `refused` of `total` from `GET /api/sessions/{id}/stat-runs[]` (db.py:2878-2888); `total` = stored iterations, which excludes failed iterations (stat_runner.py:112-125 stores nothing on failure) | "× {repeat_count}" on the second line; when `total < repeat_count` the headline appends ", {repeat_count − total} failed" | Rate |
| Repeat running headline "12 of 30 iterations done" | sum of `summary.total` over the batch's stat runs of `probes × repeat_count` (stat_runner.py:146-163 `batch_start.probe_count × repeat_count`) | the N is the planned total | text |
| Framing headline "1 of 2 groups agree" | `consistent_count` of `total_groups` (db.py:1575-1600); `total_groups` counts only groups with ≥ 2 classified variants (`has_data`, db.py:1577) | second line "{consistent} of {groups} groups"; Peek lists which | Rate (what = "groups agree") |
| Models headline "2 of 3 probes agree" | k = `round(agreement_rate × total_probes / 100)` of `total_probes` (`agreement_rate` = probes without disagreement ÷ probes × 100, app.py:1779, 1800); exact because the rate was made from these two integers | second line is the comparison name; Peek shows the models | Rate (what = "probes agree") |
| Context headline "threshold 4 warm-up turns" | `summary.threshold_warmup_count` = `warmup_count` of the run with `threshold_found = 1` (db.py:2412-2422; set by runner.py:1062-1068, 1084-1085) | "of {max_warmup_turns} tried"; when `threshold_found` is false and `status === 'completed'`: "no threshold: refused at every count tried" or, for a single automatic run, the probe label of `runs[0].probe_classification` as "probe: refused after 10 warm-up turns" | text + OutcomeBadge |
| Over time headline "1 of 3 probes changed" | `changed_count` of `changed_count + unchanged_count` from the latest snapshot's diff (app.py:893-926) | second line names the baseline | Rate (what = "probes changed") |
| Type chip counts | rows per type | the word beside the count | Chip `count` |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `classifier` | The label is a keyword scan plus a judge model's guess. You can change it. | R5 footer; R6 Peek under the outcome counts | classifier.py hybrid (CLAUDE.md "Classification: hybrid keyword scan + LLM judge"); `initial_classification` / `final_classification` columns db.py:50-56 |
| `rate_n` | A rate from N runs is a rate from N runs. | every Rate in R4 and R6 (hover Info at sm, inline at md) | `total` in db.py:2869-2880 |
| `latest_only` (new id) | Each variant and each probe counts only its latest run. | framing and over time headlines (Term tooltip on "agree" / "changed") | db.py:1550-1557 `ORDER BY r.id DESC LIMIT 1`; app.py:871-873 dict comprehension keeps the last run per `probe_id` |
| `improved` | Improved means closer to refusal, by this tool's labels. | R6 Peek for over time rows, beside `changed_count` | app.py:899-909 rank table |
| `threshold_once` (new id) | A threshold from one run can land elsewhere next run. | context headline Term tooltip; R6 Peek | runner.py:1024-1030 "compliance isn't monotonic" |
| `compare_sessions` (new id) | A models study makes one hidden session per model; its runs live there. | R6 Peek for models rows | app.py:1709-1720; db.py:2656 hides them from the dashboard list |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| study | R1 heading, R2 | IA §1: one consistency question, recorded; `01-information-architecture.md` §3 Studies |
| stat run | R1 subtitle, repeat rows | stat_runner.py:37-47 docstring: a probe sent N times, fresh target each time, classified, no coach |
| iteration | repeat running headline | stat_runner.py:98-110 `iteration` event; db.py:258-267 |
| framing variant / variant group | framing rows | db.py:1324-1402 variant file: one request in several framings; db.py:115-121 `probe_variants` |
| baseline variant | R6 Peek for framing rows | db.py:1373 `is_baseline`: the variant with no framing text |
| consistency score | R6 Peek for framing rows | db.py:1596-1600 |
| narrative sequence | context rows | db.py:197-209; runner.py:910-917: warm-up turns, a setup turn, then the probe |
| warm-up turn | context headline | runner.py:936-937 `generate_warmup_turn` |
| strategy | context second line | db.py:168-180 `strategy_templates` |
| whittling / threshold | context headline | runner.py:1024-1030 |
| snapshot / baseline | over time rows | db.py:123-130; app.py:838-847 |
| regression diff | over time headline tooltip | app.py:863-926 |
| judge | R5 caveat | classifier.py LLM judge |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `studies.what` | R1 heading (`data-tip="studies-heading"`) | Every study you have run, in one list. A study is one consistency question: repeat, framing, models, context, over time. | first visit to `#/studies` with at least one row |
| `studies.new` | "New study" button (`data-tip="studies-new"`) | Start here. Pick the question first; the form for it is the next step. | first visit with zero rows |
| `studies.headline` | first Headline cell (`data-tip="studies-headline"`) | The headline is a count with its N, never a bare percent. Open the study to see everything behind it. | after `studies.what` is dismissed, same visit |

## 8. Keyboard and focus
- Shortcuts: `/` focuses Search; `n` opens New study (when focus is not in an input); `Escape` clears Search when it is focused, closes the Drawer when open; `F8` focuses the newest Toast.
- Focus order: header (brand, session pill, key chip, nav, ?, ⚙) → "New study" → type chips (roving) → Session Select → Model Select → Status Select → Search → table sortable headers (left to right) → rows (each row focusable; Enter opens, the "⋯" button inside the row is the next Tab stop) → footer caveat links. Drawer traps focus while open and returns it to the opening "⋯".
- Live regions: R2 Readout (`role="status"`, polite) announces the count sentence once per assembly and once per filter change; Toasts per their tone; the table `aria-busy="true"` while any source is pending.

## 9. Dialogs and overlays opened from here
- Drawer R6 (Peek).
- Dialog `confirm` for Delete (phrase = the study's name; danger primary "Delete"; intro "This removes the saved comparison. The hidden sessions and their runs stay." for models rows; "This removes the sequence, its runs and its turns." for context rows (db.py:2312-2321 cascade); "This removes the baseline. Runs stay." for a baseline).
- Row Menu (Open, Peek, Open session, Export JSON, Export CSV, Delete).
- FirstTimeTip ×3 (§7). Toasts.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | /api/sessions | assembly (R2, R3 Session Select, R4) |
| GET | /api/settings/keys | R0 KeyStatusChip (shared header) |
| GET | /api/probes | R4 context rows: probe names by `probe_id` |
| GET | /api/strategies | R4 context rows: strategy names by `strategy_id` |
| GET | /api/sessions/{id}/stat-runs | R4 repeat rows, per session |
| GET | /api/stat-runs/{id} | R4 repeat rows: lazy status/date; running rows re-poll |
| GET | /api/sessions/{id}/consistency | R4 framing rows, per session |
| GET | /api/comparisons | R4 models rows |
| GET | /api/dashboard/sequences | R4 context rows |
| GET | /api/sequences/{id} | R4 context rows: lazy headline; R6 Peek |
| GET | /api/sessions/{id}/snapshots | R4 over time rows, per session |
| GET | /api/snapshots/{id}/diff?session_id= | R4 over time rows: lazy headline (latest baseline) |
| GET | /api/comparisons/{id}/export?format= | R4 Menu / R6 Export (models) |
| GET | /api/sequences/{id}/export?format= | R4 Menu / R6 Export (context) |
| DELETE | /api/comparisons/{id} | R4 Menu / R6 Delete (models) |
| DELETE | /api/sequences/{id} | R4 Menu / R6 Delete (context) |
| DELETE | /api/snapshots/{id} | R6 Delete (one baseline of an over time row) |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With a database holding 2 stat runs, 1 session with a consistent variant group, 1 comparison, 1 completed sequence and 1 snapshot, `#/studies` renders a `<table>` with exactly 6 `<tbody> tr[data-study-type]` rows and the Readout text "6 studies across 2 sessions: 2 repeat, 1 framing, 1 models, 1 context, 1 over time." (no "running now" clause).
2. Every Headline cell matches `/^\d+ of \d+ /` or begins with "threshold " or "no threshold" or equals "n/a"; no Headline cell contains a `%` without a preceding "of" count (regex from components Appendix B).
3. Clicking the "repeat" chip sets `location.hash` to contain `type=repeat`, leaves only `tr[data-study-type="repeat"]` rows, and the Readout reads "2 of 6 studies match."
4. Pressing `/` moves `document.activeElement` to the search input; typing "stab" filters to rows whose text includes "the-stabbing".
5. A models row's Model cell contains the full ids joined by " vs " (for example "claude-sonnet-4-6 vs gpt-4.1"), never a bare "claude vs gpt".
6. Clicking a repeat row navigates to `#/studies/repeat/{stat_run_id}`; clicking a framing row to `#/studies/framing/{session_id}`; a models row to `#/studies/models/{comparison_id}`; a context row to `#/studies/context/{sequence_id}`; an over time row to `#/studies/snapshots/{session_id}`.
7. The "⋯" menu on a repeat row has no "Delete" and no "Export" item; on a models row it has both; on a framing row it has neither.
8. Choosing Delete on a models row opens a `role="dialog"` whose primary button is disabled until the input equals the comparison's `name` exactly; after confirming, a `DELETE /api/comparisons/{id}` request is made and the row is gone.
9. With `GET /api/sessions/{id}/stat-runs` stubbed to return 500 for one session, the table shows one `tr[data-error]` row with a "Retry" button and the Readout includes "did not load".
10. With zero sessions, the page shows the EmptyState text ending in "then come back." and a "Go to Probe" button whose click sets the hash to `#/probe`.
11. The footer contains the exact string "The label is a keyword scan plus a judge model's guess. You can change it."
12. At 1024×700 no horizontal scrollbar appears on `main`, and every row's Date text is present inside the Headline cell's second line.
13. Opening Peek on a context row shows a definition grid containing "threshold" and the value of `summary.threshold_warmup_count` followed by " of {max_warmup_turns} tried".
14. The three FirstTimeTips place without `fallback` at 1280×800 and 1024×700 (popup audit test).

## 12. Open questions for Brad
1. **A repeat study has no batch record.** A stat run is one probe × N (db.py:247-256); the batch of probes × N exists only as SSE events (stat_runner.py:146-181). This list shows one row per stat run (probe × N). If a batch should be one study, the backend needs a `batch_id` on `stat_runs` and a list route that returns it. Which?
2. **No aggregate route.** The list makes 1 + 3 × sessions + 2 requests. Fine up to a few dozen sessions. A `GET /api/studies` route that returns the five lists with status and dates in one payload would remove the lazy loads in R4. Add it in this release or accept the fan-out?
3. **Stat-run list payload lacks status and dates.** `get_session_stat_summary` (db.py:2901-2903) drops `status`, `repeat_count`, `created_at`, `completed_at` that `list_stat_runs` (db.py:2828-2836) already selects. Extending the summary is a four-line change; without it every repeat row needs a second request.
4. **Session-vs-session comparisons are never saved.** `GET /api/compare` (app.py:1628-1686) computes and returns; nothing is written. So they cannot appear in this list. Keep them as a live view only (study-models.md §12), or add a save?
5. **`DELETE /api/comparisons/{id}` does not commit** (db.py:2518-2519 has no `conn.commit()`), so the row returns after restart. Backend fix assumed.
6. Framing rows are dated by the session because the consistency payload carries no run dates. Acceptable, or add `created_at` to each variant's latest run in `compute_consistency`?
