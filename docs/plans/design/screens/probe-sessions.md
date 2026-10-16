# Sessions

- Route(s): `#/probe`
- Section: Probe
- Purpose (one sentence, what the researcher does here): picks the session to work in, sees at a glance what each one has produced, starts a new one, and deletes or exports one.
- Arrives from: the Probe nav item, the Home Probe card, "All sessions" in the header SessionSwitcher, the back link in the Probe workbench header, `#/probe` typed directly. Leaves to: `#/probe/:s` (row click or "Open"), the New session dialog (then `#/probe/:s` on create), `#/settings#keys` (key chip or the no-key Readout link), `#/library/probes` (empty-library link). Back: header nav or the browser back button.
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, Readout, Input (search), Chip (provider filter), Table, OutcomeBadge, Rate, Caveat, Term, Button, Menu (row actions), Dialog (delete with typed name), Toast, EmptyState, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §1 Sidebar session `<select>`, "+ New Session" and "✕" (the select becomes the header SessionSwitcher; the list, create and delete live here); the session rows of §22 Dashboard › Overview (their JSON / CSV buttons, which exported the wrong session, baseline summary); the "Compare … — model" auto-created sessions are not listed here (they are Models studies, IA §4).

All visible strings in this spec are drafts (draft; brad-voice pass). Probe names are from `flinch/probes/example-probes.md` only.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch   [ No session ▾ ]   ● 2 keys set     Probe Studies Experiments Benchmarks Library Results   ? ⚙ │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1 SESSIONS  2                                                    [New session]      │
│    ▣ Two sessions. crime-set-1 has 12 runs, 7 of 12 refused by first label; open    │
│      one to send probes or push back.                                                │
│    [search name or model…          ]  [all providers ▾]   Term: a session is one     │
│                                                            target model, one optional │
│                                                            system prompt, one coach   │
│                                                            profile and a probe set.   │
│ R2 ┌────────────────────────────────────────────────────────────────────────────────┐ │
│    │ Name ▴        Target model          Probes   Runs  Refused · collapsed · negotiated · complied   Created     ⋯ │
│    │ crime-set-1   claude-sonnet-4-6     3 of 3   12    7 of 12 (58%) · 3 · 0 · 2  by first label ⓘ  2026-10-16  ⋯ │
│    │ gpt-check     gpt-4.1               2 of 3    0    none yet                                        2026-10-15  ⋯ │
│    └────────────────────────────────────────────────────────────────────────────────┘ │
│    ⓘ Counts here are by the first label, before any pushback. The label is a keyword │
│      scan plus a judge model's guess.                                                 │
│                                                                                      │
│ R3 (footer line) 2 sessions · 12 runs in all · 3 probes in the library               │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
The Table keeps all seven columns; "Target model" truncates with a title after 22 characters; the four outcome counts wrap onto a second line inside their cell ("7 of 12 (58%)" first, then "3 · 0 · 2"); the Created column shows the date only (it already does at 1280). The search input narrows to 220 px. Nothing is hidden.

## 2. Regions

### R0 Header
As `home.md` R0. The SessionSwitcher reads "No session" on this screen unless one was open before; opening a row sets it.

### R1 Heading, readout, filters
- Components: Panel heading (upper), Readout, Button (primary), Input (header variant), Select, Term, Chip count.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Eyebrow "Sessions" and count | `GET /api/dashboard/sessions` (app.py:2438-2440; db.py:2646-2661) | length | "Sessions" plus a count tag "2" | heading + Chip count |
| "New session" | none | n/a | primary md | Button |
| Readout | derived from the list | `[0].name, run_count, refused_count` (list is `created_at` desc) | sentences in §3 | Readout |
| Term line | static | n/a | "A session is one target model, one optional system prompt, one coach profile and a probe set." with `Term` on session, target model, system prompt, coach profile, probe set | text `text-xs text-zinc-500` |
| Search | none | n/a | matches `name` and `target_model`, case-insensitive; `/` focuses it | Input (header variant, Search icon) |
| Provider filter | derived from `target_model` prefix (runner.py:34-66: `claude-` Anthropic, `gpt-`/`o1-`/`o3-`/`o4-`/`chatgpt-` OpenAI, `gemini-` Google, `grok-` xAI, `meta-llama/` or `llama-` Together, `ollama:` Ollama) | n/a | "all providers" plus one option per provider present in the list | Select |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| "New session" | none | opens the New session dialog (`dialog-new-session.md`); on create, `#/probe/:s` |
| Search / provider filter | none | filters R2 in place; count tag shows "visible of total" ("1 of 2") while a filter is active |
| Term hover or focus | none | glossary tooltip |

### R2 Session table
- Components: Table (columns `text`, `text`, `rate`, `number`, `rate`, `text`, menu), OutcomeBadge, Rate, Caveat, Menu, Button (text "Open"), FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Name | `GET /api/dashboard/sessions` | `name` | mono; sortable; the whole row is clickable | Table cell |
| Target model | same | `target_model` | mono; provider word on hover from the prefix map above; "local" tag Chip when the prefix is `ollama:` | Table cell |
| Probes | same plus `GET /api/probes` (app.py:257-263) | `probe_ids` (null = every probe, db.py:686-692) and the library length | "3 of 3" when `probe_ids` is null (Rate count-first, what "probes"), "2 of 3" for a subset; the title reads "2 of the 3 probes in the library are in this session" | Rate (sm, caveat none) |
| Runs | same | `run_count` (db.py:2650) | right-aligned mono; "0" renders as "0" (it is a true count, not unknown) | Table cell number |
| Outcomes | same | `refused_count, collapsed_count, negotiated_count, complied_count` (db.py:2651-2654) | "7 of 12 refused (58%)" as a Rate, then "· 3 collapsed · 0 negotiated · 2 complied" with OutcomeBadge xs before each word; "none yet" when `run_count` is 0; the caveat `first_label` inline after the cell content | Rate + OutcomeBadge ×4 + Caveat |
| Created | same | `created_at` | `YYYY-MM-DD` from the SQLite `datetime('now')` text (db.py:35); full timestamp as title | Table cell |
| System prompt marker | same | `system_prompt` | a Chip tag "system prompt" when non-empty; title shows the first 120 characters | Chip |
| Coach | same | `coach_backend, coach_profile` | shown in the row menu header as "coach: {coach_backend} · {coach_profile}" (not a column) | Menu header |
| Row menu "⋯" | none | n/a | items: "Open", "Export JSON", "Export CSV", "Export findings", "Export report (Markdown)", "Export HTML", separator, "Delete session…" (danger) | Menu |
| Empty (no sessions) | list empty | n/a | "No sessions yet. A session is one target model, one optional system prompt, one coach profile and a probe set." with action "New session" | EmptyState |
| Filtered empty | filters hide every row | n/a | "No session matches that search." with action "Clear filters" | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / Enter / "Open" | none | `#/probe/:s`; the SessionSwitcher now shows this session |
| Column header | none | sorts; `aria-sort` toggles; default sort Created desc |
| "Export JSON" | `GET /api/sessions/{id}/export?format=json` (app.py:945-948) | download via `Content-Disposition`; toast success "Exported crime-set-1 as JSON." |
| "Export CSV" | `…?format=csv` (app.py:1292-) | as above |
| "Export findings" | `…?format=findings` (app.py:959-) | as above; disabled with reason "No findings yet: add a key finding on a run first." when `total_annotations` for the session is 0 (the row menu fetches `GET /api/sessions/{id}/findings`, app.py:719-721, when opened) |
| "Export report (Markdown)" | `…?format=report` (app.py:1236-1239) | as above |
| "Export HTML" | `…?format=html&theme=beargle-dark` (app.py:1242-1289) | as above; PDF is not offered here (it needs the themes module's `html_to_pdf`, app.py:1279; the Results › Publication screen owns PDF) |
| "Delete session…" | `DELETE /api/sessions/{id}` (app.py:531-537) after the typed-name Dialog | row removed; toast success "Deleted crime-set-1 and its 12 runs."; if it was the open session the SessionSwitcher returns to "No session" |

### R3 Footer line
- Components: text, Rate.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "{n} sessions · {runs} runs in all · {probes} probes in the library" | `GET /api/dashboard/sessions` (sum of `run_count`), `GET /api/probes` length | counts | one sentence; "in all" sums the visible rows only while a filter is active ("in these 1") | text `text-xs text-zinc-500` |

- Actions: none.

## 3. States
| State | Trigger | R1 | R2 | R3 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| Loading | until `dashboard/sessions`, `probes`, `settings/keys` resolve | count tag "…" | three skeleton rows | hidden | (wrapper only) |
| Empty | list length 0 | count "0" | EmptyState with "New session" | "0 sessions · 0 runs in all · 3 probes in the library" | "No sessions yet. Start one: it takes a name and a target model." |
| Empty, no keys | list length 0 and 0 `is_set` | same; "New session" still enabled | same | same | "No sessions yet, and no provider key is set. You can create a session now; Send stays disabled until a key is set in Settings." (the word "Settings" is a link to `#/settings#keys`) |
| Empty library | 0 probes and 0 sessions | same | EmptyState text adds "There are no probes in the library yet either; add or import some under Library." with a second action "Library" | | "No sessions and no probes yet. Load the example probes under Library, then start a session." |
| List | rows present | count "2" | rows | footer | "Two sessions. crime-set-1 has 12 runs, 7 of 12 refused by first label; open one to send probes or push back." (the first row is the newest) |
| List, one session with no runs | `run_count` 0 on the newest | | that row's outcome cell "none yet" | | "One session, no runs yet. Open gpt-check to send its first probe." |
| Filtered | search or provider set | count "1 of 2" | filtered rows | "in these 1" | (unchanged; the Readout describes the whole list) |
| Filtered empty | no match | count "0 of 2" | EmptyState "No session matches that search." | | (unchanged) |
| Sorting | header click | | `aria-sort` on the header | | (unchanged) |
| Row menu open | "⋯" | | menu with the coach header line | | (unchanged) |
| Export in flight | menu item | | that row's menu item shows the spinner "Exporting…" | | (unchanged) |
| Export error | non-2xx | | | | toast error "Export failed: {status} {detail}." (persists until dismissed) |
| Delete confirm | "Delete session…" | | Dialog (§9) | | (unchanged) |
| Deleting | primary pressed | | Dialog primary loading "Deleting…" | | (unchanged) |
| Deleted | 200 | count decremented | row gone | footer updated | re-derived from the new list |
| Delete error | 404 / 500 | | Dialog error line `role="alert"` "Could not delete: {detail}." | | (unchanged) |
| API unreachable | fetch fails | | EmptyState "Could not reach the Flinch server." with "Try again" | hidden | "Flinch could not reach its own server at {origin}." (warn) |
| Key chip no keys, list present | 0 `is_set` | warn Readout appended | rows | | "…Sends are disabled in every session until a key is set in Settings." |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Count tag "2" / "1 of 2" | rows ÷ visible rows | the rows themselves; "of total" shown while filtering | Chip count |
| "3 of 3" probes | `probe_ids` length (or library length when null) of library length (db.py:686-692; app.py:257-263) | title names both sides | Rate |
| "12" runs | `run_count` (db.py:2650) | the outcome counts in the next cell sum to it (unlabelled runs, `initial_classification` null, are the remainder and are shown as "· 0 unlabelled" only when non-zero) | Table number |
| "7 of 12 refused (58%)" | `refused_count` of `run_count` (db.py:2651) | "by first label" caveat inline; the other three counts in the same cell | Rate |
| "3 · 0 · 2" | `collapsed_count`, `negotiated_count`, `complied_count` (db.py:2652-2654) | each preceded by its OutcomeBadge word | OutcomeBadge + number |
| Footer "12 runs in all" | sum of `run_count` over rows | "2 sessions" in the same sentence | text |
| Footer "3 probes in the library" | `GET /api/probes` length | the sentence names "library" | text |
| Readout "7 of 12 refused" | as above | "by first label" in the sentence | Readout |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `first_label` (proposed new id) | "Counts here are by the first label, before any pushback." | every outcome cell (inline Info) and once under the table | db.py:2651-2654 count `initial_classification` only |
| `classifier` | "The label is a keyword scan plus a judge model's guess. You can change it." | the line under the table, joined to `first_label`; the Rate's "What this is made of" details | classifier.py:48-61 |
| `rate_n` | "A rate from N runs is a rate from N runs." | the Rate Info hover in each outcome cell | tokens §6 |
| `product_filter` | "A refusal can come from a product filter, not the model." | the Rate's details block | runner.py:124-131 (no filter detection) |
| `held_once`, `coach_conf` | not on this screen | | |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| session | eyebrow, Term line, EmptyState | "one target model, one optional system prompt, one coach profile and a probe set, plus every run made with them" (db.py:31-42; IA §1) |
| target model | column header, Term line | "the model the probes are sent to; chosen per session" (db.py:34; runner.py:32-70) |
| system prompt | Term line, row Chip | "text the target model receives before the probe; optional" (db.py:38) |
| coach profile | Term line, row menu header | "the set of pushback moves and examples the coach draws on; 'standard' by default" (db.py:76-83; seed.py:127-130) |
| coach backend | row menu header | "which provider's model writes the coach's suggestions" (runner.py:86-112) |
| probe set | Term line, Probes column | "the probes this session can send: all of them, or the subset chosen when it was created" (db.py:686-692) |
| run | Runs column | "one probe sent once: the reply, its label, any pushback and the reply to that" (db.py:44-61) |
| first label | outcome cell | "the label on the first reply, before any pushback" (db.py:2651) |
| refused, collapsed, negotiated, complied | outcome cell badges | classifier.py:94-97 (plain words as in `home.md` §6) |
| findings | export menu | "the key finding text saved on a run's annotation" (db.py:889-908) |
| provider | filter | "the company or server behind a model: Anthropic, OpenAI, Google, xAI, Together, or a local Ollama" (runner.py:34-66; app.py:2201-2207) |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `sessions.new` | `[data-tip="sessions.new"]` ("New session" button) | title "A session is the unit of work"; blurb "One target model, one optional system prompt, one coach profile and a probe set. Every run you make inside it is kept together."; why "Studies and exports are built per session, so keeping one model per session keeps the counts honest." | list empty, not seen |
| `sessions.counts` | `[data-tip="sessions.counts"]` (first row's outcome cell) | title "First label only"; blurb "These counts use the first reply's label. Open the session to see what held after pushback." | first time a row has `run_count > 0` |
| `sessions.menu` | `[data-tip="sessions.menu"]` (first row's "⋯") | title "Export or delete from here"; blurb "Each session exports on its own as JSON, CSV, findings, a Markdown report or HTML. Delete asks you to type the name." | first time a row exists and `sessions.counts` was seen |

## 8. Keyboard and focus
- Shortcuts: `/` focuses search; `n` opens New session (not in an input); `?` Help; `F8` newest toast; `Escape` closes tip → menu → dialog. In the table: Up/Down move the row cursor, Enter opens, `Delete` opens the delete dialog for the focused row, Shift+F10 or the Menu key opens the row menu.
- Focus order: header (as Home) → "New session" → search → provider Select → table headers (sortable buttons) → rows (roving tabindex, one tab stop) → the focused row's "⋯". After the dialog closes, focus returns to the control that opened it; after a delete, focus moves to the next row or to "New session" when none remain.
- Live regions: the Readout (polite) on load and after create or delete; the count tag is inside the same `role="status"` region so "1 of 2" is announced on filter; toasts by tone; the dialog error line `role="alert"`.

## 9. Dialogs and overlays opened from here
- New session dialog (`dialog-new-session.md`), from "New session", `n`, the EmptyState action and the SessionSwitcher menu.
- Delete session Dialog (`confirm` variant): title "Delete crime-set-1?", intro "This deletes the session and its 12 runs, their turns and annotations. Probes stay in the library. There is no undo.", prompt "Type crime-set-1 to continue", primary danger "Delete session", loading "Deleting…". `DELETE /api/sessions/{id}` (app.py:531-537; db.py `delete_session`).
- Row menu (Menu), Term tooltips, FirstTimeTips, Help menu, Shortcuts dialog, Toasts.
- No native `confirm()` (today's api.js:535 is replaced).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/dashboard/sessions` | R1 count and Readout, R2 rows, R3 footer; re-fetched after create and delete |
| GET | `/api/probes` | R2 Probes column denominator, R3 footer, empty-library state |
| GET | `/api/settings/keys` | R0 chip, no-key Readout |
| GET | `/api/sessions` | R0 SessionSwitcher menu |
| GET | `/api/sessions/{id}/findings` | R2 row menu open (to enable or disable "Export findings") |
| GET | `/api/sessions/{id}/export?format=json|csv|findings|report|html` | R2 row menu exports |
| DELETE | `/api/sessions/{id}` | R2 delete dialog |
| POST | `/api/sessions` | New session dialog (specified there) |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. `#/probe` with two sessions renders a `<table>` with a `<caption class="sr-only">` and exactly two `<tbody>` rows; the first row's name equals the session with the latest `created_at`.
2. Each row's outcome cell text matches `^\d+ of \d+ refused \(\S+%\)` or equals "none yet" when `run_count` is 0; no cell contains a percentage without "of".
3. The outcome cell contains four `OutcomeBadge` elements whose text, in order, is "refused", "collapsed", "negotiated", "complied" (uppercase by CSS only; the DOM text is lowercase).
4. Under the table a `role="note"` element contains both "Counts here are by the first label, before any pushback." and "The label is a keyword scan plus a judge model's guess."
5. Typing "gpt" into the search leaves one row visible and the count tag reads "1 of 2"; clearing it restores "2".
6. Choosing "Anthropic" in the provider Select hides rows whose `target_model` does not start with `claude-`.
7. Pressing `n` with focus on the body opens a `role="dialog"` titled "New session"; pressing `n` with focus in the search input types the letter instead.
8. Clicking a row navigates to `#/probe/<id>` and the header SessionSwitcher text becomes "<name> · <target_model>".
9. Opening a row's "⋯" shows a menu whose first line reads "coach: <coach_backend> · <coach_profile>" and whose last item is "Delete session…" with `text-red-300`.
10. "Delete session…" opens a dialog whose primary button is disabled until the input value equals the session name exactly (case-sensitive); confirming sends `DELETE /api/sessions/<id>`, the row disappears, a toast "Deleted <name> and its <n> runs." appears, and focus is on the next row or on "New session".
11. "Export CSV" in the row menu issues `GET /api/sessions/<id>/export?format=csv` and the saved filename equals the `Content-Disposition` filename.
12. With `GET /api/sessions/<id>/findings` returning `[]`, the menu item "Export findings" has `aria-disabled="true"` and a visible reason "No findings yet: add a key finding on a run first."
13. With `GET /api/settings/keys` all `is_set` false, the Readout contains "Send stays disabled until a key is set in Settings" and "Settings" is an `<a href="#/settings#keys">`.
14. With no sessions and no probes, the EmptyState shows two action buttons, "New session" and "Library", and the second navigates to `#/library/probes`.
15. At 1024×700, no horizontal scrollbar; the outcome cell wraps to two lines; the "Target model" cell shows a `title` attribute when its text is truncated.
16. Auto-created comparison sessions (`notes` containing "Auto-created by multi-model comparison") do not appear in the table, matching `GET /api/dashboard/sessions`.

## 12. Open questions for Brad
1. "Last activity" is not in `GET /api/dashboard/sessions` (db.py:2646-2661 returns `created_at` only). The column is Created for now; a `last_run_at` (max `runs.created_at`) in that query would let the list sort by recent use. Add it in this release?
2. The outcome counts in the summary query are by `initial_classification` (db.py:2651-2654). The workbench history strip uses `outcome_classifications` from `GET /api/sessions/{id}/stats` (final if present, else initial, db.py:1620). Two screens, two tallies, each labelled. Prefer one tally everywhere (needs a query change), or keep both with the `first_label` caveat?
3. The auto-created "Compare … — model" sessions are excluded here and surface under Studies › Models (IA §4). They are still real sessions with runs; should the SessionSwitcher menu list them too, or hide them the same way?
