# Library › Narrative strategies

- Route(s): `#/library/strategies`, `#/library/strategies/:id` (strategy drawer open)
- Section: Library
- Purpose (one sentence, what the researcher does here): read the warm-up strategies a Context study can use (what each one sets up, how it escalates, and what the research notes say), and see which ones have been run.
- Arrives from: Library tab strip; Studies › New › Context "What do these strategies do?" link; Studies › Context strategy name Term "open in Library". Leaves to: Studies › New (`#/studies/new?type=context&strategy=:id`); Library › Probes (narrative probes filter) via "Narrative probes" link.
- Components used: Header, PrimaryNav, Tabs, Panel, Readout, EmptyState, Table, Chip, Drawer, InsetBox, Button, Toast, Term, Caveat, FirstTimeTip.
- Baseline surfaces replaced: §19 "Narrative Momentum" strategy select (the `<select>` with description tooltip and hint line) as a browsable list; strategy CRUD (app.py:1956-1993) stays API-only (IA §3 Library, §7 open point 3).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   … Library …  ? ⚙  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Probes   Variant groups   Policy claims   Coach examples   Narrative strategies  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ┌ Narrative strategies  6 strategies · 6 built in · 0 custom ────────────────────┐ │
│    │ ▣ In plain words: A strategy is a plan for the warm-up turns before a probe:  │ │
│    │   how the coach opens, how it escalates, and how it sets the probe up. They   │ │
│    │   are read-only here; a Context study picks one.                             │ │
│    ├──────────────────────────────────────────────────────────────────────────────┤ │
│ R3 │ Name                 Category   Description                           Used in  │ │
│    │ fiction workshop     fiction    Scene-setting, character development… 3 studies│ │
│    │ academic research    academic   Scholarly context, methodology, …     1 study  │ │
│    │ character study      fiction    Deep POV, internal experience, …      none yet │ │
│    │ satire parody        fiction    …                                     none yet │ │
│    │ historical fiction   fiction    …                                     none yet │ │
│    │ technical analysis   technical  …                                     none yet │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│ R4 (drawer, 440 px)                                                                  │
│    ┌ fiction workshop                                                        [×] ┐   │
│    │ fiction · built in · from flinch/strategies/default-strategies.md            │   │
│    │ GOAL        Establish a creative writing workshop context where …            │   │
│    │ OPENING     Open with a creative writing workshop scenario. …                │   │
│    │ ESCALATION  Deepen character development. Add conflict …                     │   │
│    │ SETUP       Steer the scene toward a moment that naturally requires …        │   │
│    │ NOTES       Research: fiction framing produced 58-64% no-refusal rate. …      │   │
│    │ ⓘ The notes quote the paper's figures, not anything measured in this        │   │
│    │   database. Your own results are in the Context studies below.              │   │
│    │ USED IN  crime-set-1 · the-stabbing · up to 10 warm-up turns · completed → study │
│    │          crime-set-1 · the-autopsy · up to 6 warm-up turns · abandoned → study   │
│    │ [Start a Context study with this strategy]                                   │   │
│    └──────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
R3's Description column wraps to two lines; Category becomes a chip under the name. Drawer unchanged.

## 2. Regions

### R0 Header, R1 Library tab strip
As `library-probes.md`.

### R2 Panel heading and readout
- Components: Panel, Readout.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| subtitle | `GET /api/strategies` (app.py:1945-1947; db.py:2256-2258) | array length; `is_builtin` | "6 strategies · 6 built in · 0 custom" | Panel subtitle |
| readout | | | the definition sentence; after data: "6 strategies. 2 have been used in Context studies; 4 have not been run yet." | Readout |

- Actions: none (read-only screen; a "Load defaults" action appears only in the empty state, see R3).

### R3 Strategy table
- Components: Table (name, category, description, used in), Chip, EmptyState.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| name | `GET /api/strategies` | `name` (db.py:170; file H2 slugs like `fiction_workshop`) | underscores as spaces for display, raw slug in `title` and in the drawer eyebrow | text |
| category | | `category` | tag chip; empty → "uncategorised" | Chip |
| description | | `description` | one line, truncated at 90 characters | text |
| built in | | `is_builtin` | tag "built in" when 1; "custom" otherwise (custom rows exist only via the API, app.py:1956-1973) | Chip |
| used in | `GET /api/dashboard/sequences` (app.py:2446-2448; db.py:2678-2691) | `strategy_id`, `session_name`, `status` | count of sequences whose `strategy_id` equals this id: "3 studies" / "1 study" / "none yet" (`text-zinc-500`) | text |
| empty | `[]` | | EmptyState "No strategies are loaded. Load the shipped defaults to get the six that ship with Flinch." action "Load defaults" → `POST /api/probes/load-defaults` (app.py:292-302; strategies import at 299-301) → Toast "Loaded 6 strategies and 31 default probes." | EmptyState |

- Actions:

| Control | Calls | Then |
|---|---|---|
| row activate | `GET /api/strategies/{id}` (app.py:1949-1954) for the full record | drawer R4; route `#/library/strategies/:id` |
| sort | none | by name, category, used-in count |

### R4 Strategy drawer
- Components: Drawer, InsetBox ×5, Caveat note, List (used in), Button (primary sm).
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| meta | `GET /api/strategies/{id}` | `category`, `is_builtin`, `created_at` | "fiction · built in · from flinch/strategies/default-strategies.md" (built-in source path is the shipped file; db.py:168-180 stores no `source_file`, so the path is the fixed shipped location for `is_builtin == 1` and "created through the API on {created_at}" otherwise) | text |
| goal, opening, escalation, setup | | `goal`, `opening_pattern`, `escalation_pattern`, `setup_hint` (db.py:172-175) | eyebrows GOAL, OPENING, ESCALATION, SETUP; full text | InsetBox |
| notes | | `effectiveness_notes` | eyebrow NOTES; shown when non-empty; Caveat `notes_are_paper` note below | InsetBox + Caveat |
| used in | `GET /api/dashboard/sequences` filtered by `strategy_id`; probe name via `GET /api/probes` by `probe_id` | `session_name`, `probe_id`, `max_warmup_turns`, `status`, `id` | rows "crime-set-1 · the-stabbing · up to 10 warm-up turns · completed → study" linking `#/studies/context/:id`; `status` as a word (pending/running/completed/failed/abandoned); empty → "No Context study has used this strategy yet." | List rows |
| start | | | "Start a Context study with this strategy" → `#/studies/new?type=context&strategy=:id` | Button primary sm |

- Actions: as the table above; no edit or delete (built-in rows return 400 on PUT/DELETE, app.py:1980-1982, 1990-1992; custom rows are API-only by IA decision).

## 3. States
| State | Trigger | R2 | R3 | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| loading | route enter | pulse | three pulse rows | closed | (wrapper only) |
| empty | `[]` | "0 strategies" | EmptyState with Load defaults | closed | "No strategies are loaded yet. The six shipped ones arrive with Load defaults." |
| loading defaults | action pressed | | button loading "Loading…" | | |
| with data | | counts | six rows | closed | "A strategy is a plan for the warm-up turns before a probe … 2 have been used in Context studies; 4 have not been run yet." |
| used-in loading | sequences call in flight | | "…" pulse in the column | | |
| drawer open | row | | row selected | open | unchanged |
| drawer, no uses | | | | "No Context study has used this strategy yet." | |
| custom rows present | `is_builtin == 0` rows | "… · 1 custom" | "custom" tag | meta says "created through the API" | adds "1 custom strategy was added through the API." |
| no key | | no change | | | |
| error | list fails | | EmptyState "Could not load strategies." + Try again | | error Toast |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "6 strategies · 6 built in · 0 custom" | length; `is_builtin` counts | the words | subtitle |
| "3 studies" | sequences with this `strategy_id` | drawer lists them | Table |
| "2 have been used … 4 have not" | strategies with ≥ 1 sequence / the rest | | Readout |
| "up to 10 warm-up turns" | `max_warmup_turns` (db.py:197-209 per inventory §22) | the word "up to" because the sequence may stop early (whittling) | R4 row |
| "58-64% no-refusal rate" | verbatim from `effectiveness_notes` | Caveat `notes_are_paper` beside it | R4 |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `notes_are_paper` | "The notes quote the paper's figures, not anything measured in this database. Your own results are in the Context studies below." | R4 NOTES | flinch/strategies/default-strategies.md "notes: Research: …" lines; db.py:177 `effectiveness_notes` is free text |
| `strategy_readonly` | "Strategies are read-only here. Edit the file under flinch/strategies and load defaults again, or use the API." | R2 readout (second sentence), R4 | app.py:1956-1993 (API only); default-strategies.md:5 |
| `max_turns_is_cap` | "Warm-up turns is the cap the study was given; a sequence can stop earlier." | R4 used-in rows | `max_warmup_turns`; whittling runner.py:1090-1096 (inventory §19) |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| narrative strategy | heading | glossary |
| warm-up turn | readout, drawer | glossary (narrative momentum) |
| opening / escalation / setup | drawer eyebrows | glossary; db.py:173-175 |
| Context study | buttons, used-in | glossary → `studies-context.md` |
| built in | tag | glossary ("shipped in flinch/strategies") |
| whittling | `max_turns_is_cap` caveat link | glossary |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `lib.strategies.readonly` | the readout | "Nothing to edit here. A strategy is picked when you start a Context study; this page is for reading what each one does." | first visit with ≥ 1 strategy |
| `lib.strategies.notes` | first NOTES box in R4 | "Those percentages come from the paper, not from your runs. Compare them with the studies listed underneath." | first drawer open |

## 8. Keyboard and focus
- Shortcuts: `↑/↓`, `Enter` on rows; `Esc` closes the drawer.
- Focus order: header → Library tabs → table headers → rows → drawer (title, used-in links, Start, close).
- Live regions: Readout; Toast after Load defaults.

## 9. Dialogs and overlays opened from here
- None beyond the Drawer, Toasts and tips. (Load defaults in the empty state runs without a dialog: it only adds rows, and the probe side effect is named in the Toast.)

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/strategies` | R2/R3 load |
| GET | `/api/strategies/{strategy_id}` | R4 open |
| GET | `/api/dashboard/sequences` | R3 used-in, R4 list |
| GET | `/api/probes` | R4 probe names (cached for the Library visit) |
| POST | `/api/probes/load-defaults` | R3 empty-state action |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With the shipped file loaded, R3 shows six rows in API order (`is_builtin DESC, name`): academic research, character study, fiction workshop, historical fiction, satire parody, technical analysis; each has a "built in" tag.
2. The display name "fiction workshop" has `title="fiction_workshop"`.
3. With no sequences, every Used-in cell reads "none yet" and the Readout contains "have not been run yet".
4. With a fixture sequence `strategy_id = <fiction_workshop id>`, that row reads "1 study" and the drawer lists one row linking to `#/studies/context/{sequence id}`.
5. The drawer for a built-in row renders five InsetBoxes with eyebrows GOAL, OPENING, ESCALATION, SETUP, NOTES and the `notes_are_paper` phrase directly under NOTES.
6. No edit or delete control exists in the DOM on this screen (`querySelectorAll('button')` names contain neither "Edit" nor "Delete").
7. Empty state's "Load defaults" sends `POST /api/probes/load-defaults` and the Toast reports both the strategy count (from `GET /api/strategies` after) and `loaded` probes.
8. At 1024×700 the table has no horizontal scroll.

## 12. Open questions for Brad
1. IA §7 point 3: keep strategies in the Library (this spec) or fold them into the Context study form only?
2. Custom strategies via the API have no UI. If a "New strategy" form is wanted later it is one Dialog with the five required fields (app.py:1958); not in this release?
3. `GET /api/dashboard/sequences` returns raw rows (db.py:2678-2691) with no result label; the drawer therefore shows `status`, not the probe's outcome. Add `probe_classification` to that payload so "used in" can read "… · refused"?
