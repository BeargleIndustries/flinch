# Library › Variant groups

- Route(s): `#/library/variants`, `#/library/variants/:gid` (same screen, group drawer open), `#/library/variants/new` (create panel open)
- Section: Library
- Purpose (one sentence, what the researcher does here): keep the sets of one request written in several framings (or several system-prompt conditions) that a Framing study or an Experiment runs, and make new ones by hand or with the coach model's help.
- Arrives from: Library tab strip; Studies › New › Framing ("Manage groups"); Library › Probes variant chip; Home "Library". Leaves to: Studies › New (`#/studies/new?type=framing&group=:gid`) via "Run as a Framing study…"; Experiments › New (`#/experiments/new?group=:gid`) for conditions groups; Library › Probes filtered to the group's probes.
- Components used: Header, PrimaryNav, Tabs, Panel, Readout, EmptyState, Card, List/Row, Chip, Button, Segmented, Input, Textarea, Select, Dialog, Drawer, Toast, Term, Caveat, FirstTimeTip, LoadingScreen/Progress (inline, while generating).
- Baseline surfaces replaced: §20 "Framing Variants" Edit Groups tab (file group cards, legacy DB groups, viewer, CREATE NEW VARIANT GROUP with AI-assisted and manual modes, Save to File / Save Group, delete). The Results tab becomes Studies › Framing (`studies-framing.md`, not this spec).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   … Library …  ? ⚙  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Probes   Variant groups   Policy claims   Coach examples   Narrative strategies  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ┌ Variant groups  3 groups · 2 framings, 1 conditions ──────────── [+ New group] ┐ │
│    │ ▣ In plain words: A variant group is one request written several ways. Framing │ │
│    │   groups make one probe per framing; a conditions group is a set of system    │ │
│    │   prompts run against every probe. 2 groups are file-backed, 1 lives only in  │ │
│    │   the database.                                                               │ │
│    ├──────────────────────────────────────────────────────────────────────────────┤ │
│ R3 │ ┌ violence-framing ──────────────── framings · crime · 5 variants · file ────┐ │ │
│    │ │ The same violent scene asked as fiction, academic analysis, history, …     │ │ │
│    │ │ [direct request] [fiction workshop] [academic analysis] [historical] [satire]│ │ │
│    │ │ 5 probes in the library · run in 2 sessions   [Run as a Framing study…] [⋯]│ │ │
│    │ └────────────────────────────────────────────────────────────────────────────┘ │ │
│    │ ┌ lexical-complexity ────────────── framings · medical · 4 variants · file ──┐ │ │
│    │ │ …                                                                          │ │ │
│    │ ┌ tone-conditions ───────────────── conditions · 3 conditions · file ────────┐ │ │
│    │ │ [none] [formal] [casual]   Runs as an experiment: 3 conditions × 48 probes │ │ │
│    │ │                                             [Run as an experiment…] [⋯]    │ │ │
│    │ ┌ old-group-7 ───────────────────── framings · database only · 2 variants ───┐ │ │
│    │ │ ⓘ Not backed by a file; it cannot be edited here, only run or deleted.     │ │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│ R4 (create panel, replaces R3 when "+ New group" is pressed; `#/library/variants/new`)│
│    ┌ New variant group ──────────────────────────────────── [Cancel] ─────────────┐ │
│    │ How to make it  ( With the coach model | By hand )                            │ │
│    │ Base probe [the-stabbing ▾]   Group id [the-stabbing-framings]                │ │
│    │ Framings  [✓ Fiction Workshop] [✓ Academic Analysis] [✓ Historical Context]   │ │
│    │           [✓ Roleplay Scenario] [✓ Satire/Parody] [+ add a framing…]          │ │
│    │ [Generate 5 variants]  ⓘ Uses your Anthropic key and claude-haiku-4-5.        │ │
│    │ ── after generating ──                                                        │ │
│    │ REVIEW  direct request (the base probe, kept as the baseline)   [textarea]    │ │
│    │         fiction workshop                                        [textarea]    │ │
│    │         …                                                                     │ │
│    │ Title [The stabbing, five ways]  Domain [crime]  Description [……]             │ │
│    │                                                   [Discard]  [Save group]     │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│ R5 (drawer: a group's variants; 440 px)                                              │
│    ┌ violence-framing                                                      [×] ┐    │
│    │ framings · crime · file flinch/variants/violence-framing.md                 │    │
│    │ Base probe: the-stabbing                                                    │    │
│    │ DIRECT REQUEST (baseline)  Write a scene from a thriller…    → probe #12     │    │
│    │ FICTION WORKSHOP           In a fiction workshop, …          → probe #41     │    │
│    │ …                                                                           │    │
│    │ [Run as a Framing study…]  [Open file location]  [Delete group…]            │    │
│    └─────────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
Group cards go from a two-column grid to one column; the label chip strip scrolls horizontally inside the card (roving focus, `03-components.md §17`). R4's framing checkboxes wrap to two rows. The drawer is unchanged.

## 2. Regions

### R0 Header, R1 Library tab strip
As `library-probes.md` R0 and R1.

### R2 Panel heading and readout
- Components: Panel (heading "Variant groups", subtitle "3 groups · 2 framings, 1 conditions"), Readout, Button (primary sm "New group").
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| subtitle | `GET /api/variants/files`, `GET /api/probe-groups` | files `[].group_id`, `variant_type`; DB groups `[].group_id` | "3 groups · 2 framings, 1 conditions"; groups = union of file `group_id`s and DB `group_id`s not in the file list (the old "Legacy groups" rule, render.js:1582-1584, kept) | Panel subtitle |
| readout | same | | first visit: the definition sentence; after: "2 groups are file-backed, 1 lives only in the database." | Readout |

- Actions:

| Control | Calls | Then |
|---|---|---|
| New group | none | R4 replaces R3; route `#/library/variants/new` |

### R3 Group cards
- Components: Card (one per group), Chip (chip per label; tag "file" / "database only"; tag "framings" / "conditions"), Button (secondary sm), Menu ("⋯": "View variants", "Open in Library › Probes", "Delete group…"), EmptyState.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| title | `GET /api/variants/files` | `title` (falls back to `group_id`, db.py:1394) | Card title; `group_id` in mono as eyebrow when it differs from title | Card |
| type · domain · count · storage | | `variant_type`, `domain`, `variant_count` | "framings · crime · 5 variants · file"; conditions: "conditions · 3 conditions · file" (domain omitted when empty) | meta row |
| description | | `description` | one line, truncated at 120 characters | Card body |
| labels | | `labels[]` | one chip per label, in file order | Chip strip |
| probes in library | `GET /api/probe-groups` | `variants[]` for the same `group_id` → `probe_id`s (db.py:1253-1274) | "5 probes in the library"; for a file group with no DB group "not synced: 0 probes" with a "Sync" text button (see Actions) | text |
| run in n sessions | `GET /api/sessions` + `GET /api/sessions/{id}/consistency` is too heavy; instead `GET /api/dashboard/sessions` is not per probe either | shown as "run in n sessions" only when cheap: computed from `GET /api/sessions` `probe_ids` containing any member probe id (same rule as `library-probes.md`); it says whether a session *includes* the probes, not whether it ran them | text with Term `includes` |
| conditions line | | `variant_type == "conditions"`, `labels.length`, `GET /api/probes` length | "Runs as an experiment: 3 conditions × 48 probes" (app.py batch-conditions uses every probe, inventory §20) | text |
| DB-only card | `GET /api/probe-groups` entries without a file | `group_id`, `variants[].variant_label`, `probe_name` | title = `group_id`, tag "database only", Caveat `db_only` inline; labels from `variant_label` | Card |
| empty | both lists empty | | EmptyState "No variant groups yet. Make one from a probe with the coach model's help, or write one by hand." action "New group" | EmptyState |

- Actions:

| Control | Calls | Then |
|---|---|---|
| card title / "View variants" | `GET /api/variants/files/{gid}` (app.py:762-768) | drawer R5; route `#/library/variants/:gid`; DB-only group uses `GET /api/probe-groups/{gid}` (app.py:742-747) instead |
| Run as a Framing study… | none | route `#/studies/new?type=framing&group=:gid` (the study form picks the session; `studies-framing.md`) |
| Run as an experiment… | none | route `#/experiments/new?group=:gid` with the conditions prefilled (`experiments.md`); the card says it will create an experiment before anything runs (IA §4) |
| Sync | `POST /api/variants/files` with the parsed file (`GET /api/variants/files/{gid}` → `SaveVariantFileRequest` fields, app.py:770-780) | re-syncs probes into the DB (db.py:1452-1506); Toast "Synced 5 probes for violence-framing." |
| Open in Library › Probes | none | `#/library/probes?group=:gid` (filter by variant chip) |
| Delete group… | Dialog D1; file group `DELETE /api/variants/files/{gid}` (app.py:782-787); DB-only `DELETE /api/probe-groups/{gid}` (app.py:749-755) | card removed; Toast "Deleted violence-framing." |

### R4 Create panel
- Components: Segmented ("With the coach model" / "By hand"), Select (base probe), Input (group id, title, domain), Textarea (description, each variant), Checkbox chips (framings), Button (primary "Generate 5 variants" with loading "Generating…"; primary "Save group"; secondary "Discard"; text "Cancel"), InsetBox (review rows), Caveat, Progress (indeterminate while generating).
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| base probe | `GET /api/probes` | `id`, `name`, `domain` | "{name} [{domain}]", grouped by domain; required in coach mode; optional in manual mode (sets `base_probe`) | Select |
| group id | derived | | default `{base probe name}-framings`, slug rule `[a-z0-9-]`, must not match an existing `group_id` (inline error "A group with this id exists.") | Input |
| framings | `GenerateVariantsRequest.strategies` default list (app.py:204-208) | | five checked chips "Fiction Workshop", "Academic Analysis", "Historical Context", "Roleplay Scenario", "Satire/Parody" plus "add a framing…" Input | Checkbox chips |
| key hint | `GET /api/settings/keys` | `provider == "anthropic"`, `is_set` | "Uses your Anthropic key and claude-haiku-4-5." (app.py:795-803); when not set the Generate button is disabled with reason "Needs an Anthropic key. Set one in Settings." linking `#/settings#keys` | Caveat inline, Button disabled-with-reason |
| review rows | `POST /api/variants/generate` | `variants[{label, prompt_text}]` (app.py:826-836) | row 0 is "direct request" = the base probe's `prompt_text`, marked "(the base probe, kept as the baseline)"; each generated row is an editable Textarea with its label as an editable Input; a row can be removed ("Remove {label}"), minimum one generated row to save | InsetBox + Textarea |
| manual rows | | | two rows by default with labels "direct request" (prefilled from base probe when chosen) and "variant 2"; "+ Add variant" | same |
| title, domain, description | | | title default = group id with hyphens as spaces (render.js:3263-3327 rule kept), max 200; domain default = base probe's domain; description max 2000 (app.py:195-202) | Input, Textarea |
| type | | `variant_type` | Segmented "Framings" / "Conditions" shown only in manual mode; in conditions mode the rows are labelled "condition" and the prompt field is "System prompt" (an empty one is "no system prompt", which the parser stores as `is_baseline`, db.py:1386) | Segmented |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Generate | `POST /api/variants/generate {probe_id, strategies}` (app.py:789-836) | review rows filled; focus moves to the first generated row; 400 (no key) → inline error; 500 "Failed to parse AI response" → inline error with "Try again" |
| Save group | `POST /api/variants/files {group_id, title, description, base_probe, domain, variant_type, variants[{label, prompt_text}]}` (app.py:770-780) | server writes `flinch/variants/{gid}.md`, syncs probes and reloads probes (app.py:777-779); the response is `get_variant_group` (framings) or `{group_id, variant_type: "conditions", variants[]}`; Toast "Saved violence-framing with 5 variants. 5 probes added to the library." (probe count from the response `variants.length`; conditions groups say "No probes added: conditions are system prompts."); route `#/library/variants/:gid` with the drawer open |
| Discard | Dialog D2 when any row is filled | review cleared |
| Cancel | Dialog D2 when dirty | back to `#/library/variants` |

### R5 Group drawer
- Components: Drawer, InsetBox per variant, Chip, Button, Caveat.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| meta | `GET /api/variants/files/{gid}` | `variant_type`, `domain`, `source_file` (db.py:1392-1402) | "framings · crime · file flinch/variants/violence-framing.md" (path shown relative to the package dir) | text |
| base probe | | `base_probe` | "Base probe: the-stabbing" or "Base probe: not recorded" | text |
| variant rows | | `variants[].label`, `prompt_text`, `is_baseline` | eyebrow = label upper-case, "(baseline)" when `is_baseline`; full `prompt_text`; "→ probe #{id}" from `GET /api/probe-groups/{gid}` matched by position (db.py:1452-1497 inserts in file order) linking `#/library/probes/:id`; "no probe (conditions group)" for conditions | InsetBox |
| DB-only | `GET /api/probe-groups/{gid}` | `variants[].variant_label`, `probe_name`, `probe_id` | rows show label and probe name only, plus Caveat `db_only` | InsetBox |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Run as a Framing study… / Run as an experiment… | none | as R3 |
| Open file location | Tauri `opener` (desktop only; `?shell=desktop`); in a browser the button is disabled with reason "Available in the desktop app." | |
| Delete group… | as R3 | drawer closes |

## 3. States
| State | Trigger | R2 | R3 | R4 | R5 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|
| loading | route enter | pulse subtitle | three pulse cards | hidden | closed | (wrapper only) |
| empty | both lists empty | "0 groups" | EmptyState | hidden | closed | "A variant group is one request written several ways. There are none yet." |
| with data | | counts | cards | hidden | closed | "A variant group is one request written several ways. … 2 groups are file-backed, 1 lives only in the database." |
| file group not synced | file group with no DB group | | card shows "not synced: 0 probes" + Sync | | | unchanged |
| create, coach mode, no key | New group; anthropic `is_set` false | | hidden | Generate disabled with reason | | "Generating needs an Anthropic key; writing by hand does not." |
| create, generating | Generate pressed | | | button loading "Generating…", rows skeleton, Progress indeterminate, elapsed "0:07" | | "Asking claude-haiku-4-5 for 5 framings of the-stabbing. This usually takes under a minute." |
| create, generated | 200 | | | review rows | | "5 framings came back. Edit any of them, then save." |
| create, generate failed | 400/500 | | | inline error, Try again | | "The coach model's answer could not be read. Try again or write the variants by hand." |
| create, manual | segment "By hand" | | | manual rows | | "Write each framing yourself. The first row is the direct request." |
| create, dirty, cancel | | | | D2 | | |
| saved | 200 from save | counts refresh | new card first | hidden | open on the new group | "Saved violence-framing. Run it as a Framing study to see whether the label holds across framings." |
| drawer open | card activated | | card `border-indigo-500/40` | | open | unchanged |
| delete | D1 confirmed | counts refresh | card removed | | closed | unchanged |
| error (list) | 4xx/5xx | | last good list stays | | | error Toast |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "3 groups · 2 framings, 1 conditions" | union of file and DB group ids; counts by `variant_type` (DB-only groups count as framings, db.py:1253 has no type) | the two type words | Panel subtitle |
| "5 variants" | `variant_count` | the label chips are the five | Card meta |
| "5 probes in the library" | `GET /api/probe-groups[gid].variants.length` | "→ probe #id" per row in the drawer | Card, R5 |
| "3 conditions × 48 probes" | `labels.length` × `GET /api/probes` length | the sentence names both | Card |
| "Generate 5 variants" | checked framings count | the chips | Button label |
| "5 probes added to the library" | save response `variants.length` | | Toast |
| elapsed "0:07" | now − generate start | | R4 |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `db_only` | "Not backed by a file; it cannot be edited here, only run or deleted." | DB-only card and drawer | db.py:1253-1274 (probe_variants only), inventory §20 "Legacy groups" |
| `includes_not_ran` | "Counts sessions whose probe set includes these probes, not sessions that ran them." | "run in n sessions" | sessions `probe_ids`, db.py:682-699 |
| `variant_gen_model` | "Variants are written by claude-haiku-4-5 from your base probe and the framing names. Read them before saving; they are not checked." | R4 coach mode | app.py:800-823 |
| `conditions_all_probes` | "A conditions group runs every probe in the library under each system prompt." | conditions cards | inventory §20 (batch-conditions uses all probes) |
| `same_request` | "Whether two framings really ask for the same thing is your call; Flinch does not check it." | R4 review | app.py:810-816 prompt text asks the model for "essentially the same content" |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| variant group | heading, readout | glossary |
| framing | type chip, R4 | glossary (playbook.md framing) |
| condition | conditions cards, R4 | glossary; experiments |
| baseline (direct request) | R4 row 0, R5 | glossary; db.py:1386 `is_baseline` |
| system prompt | conditions rows | glossary |
| Framing study | buttons | glossary → `studies-framing.md` |
| experiment | conditions button | glossary |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `lib.variants.new` | `[data-tip="variants-new"]` | "A group starts from one probe. The coach model writes the other framings; you edit them before they are saved." | first visit, ≥ 1 probe in the library |
| `lib.variants.run` | first "Run as a Framing study…" | "Groups run inside a session. A Framing study shows whether the label stays the same across framings." | first visit with ≥ 1 group |
| `lib.variants.conditions` | first conditions card | "Conditions groups are system prompts, not probes. They run as an experiment, which Flinch creates for you." | first time a conditions group is listed |

## 8. Keyboard and focus
- Shortcuts: `n` opens New group (when focus is not in a field); `↑/↓` move between cards (roving focus on the card grid); `Enter` opens the drawer; `Esc` closes the drawer, then the create panel (with D2 when dirty); in R4, `Ctrl+Enter` on the last review row presses Save group.
- Focus order: header → tabs → New group → cards (each card: title button, chips strip, Run, ⋯) → drawer when open. In R4: segmented → base probe → group id → framings chips → add a framing → Generate → review rows (label, text, remove) → title → domain → description → Discard → Save group.
- Live regions: Readout; generating state announces "Generating 5 variants" once and "5 framings came back" on completion (`role="status"`); Toasts.

## 9. Dialogs and overlays opened from here
- **D1 Delete group** (Dialog md, danger "Delete violence-framing"): intro "Deletes the file and the group. The 5 probes it made stay in the library (delete them from Library › Probes if you want them gone). Runs that used them are kept." File-group delete also removes the DB group (db.py:1507).
- **D2 Discard changes** (Dialog md, danger "Discard"): intro "The generated variants have not been saved."
- Drawer R5; Toasts; tips.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/variants/files` | R2/R3 load |
| GET | `/api/probe-groups` | R2/R3 load (probe ids per group, DB-only groups) |
| GET | `/api/sessions` | R3 "run in n sessions" |
| GET | `/api/probes` | R3 conditions line; R4 base probe select |
| GET | `/api/settings/keys` | R4 key hint |
| GET | `/api/variants/files/{group_id}` | R5 open; Sync |
| GET | `/api/probe-groups/{group_id}` | R5 probe ids; DB-only drawer |
| POST | `/api/variants/generate` | R4 Generate |
| POST | `/api/variants/files` | R4 Save group; Sync |
| DELETE | `/api/variants/files/{group_id}` | D1 (file group) |
| DELETE | `/api/probe-groups/{group_id}` | D1 (DB-only group) |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With the two shipped files (`flinch/variants/lexical-complexity.md`, `violence-framing.md`) and no DB groups, R3 renders two cards, each with a "not synced: 0 probes" line and a Sync button; after Sync the line reads "{n} probes in the library" with n = `variant_count`.
2. A card's chip strip has one `[role="button"]`-free chip per `labels[]` entry, in file order, and scrolls with arrow keys at 1024 px without page overflow.
3. With no Anthropic key, R4's Generate button has `aria-disabled="true"` and an adjacent element reading "Needs an Anthropic key. Set one in Settings." that links to `#/settings#keys`; the "By hand" segment still allows Save.
4. Mocking `POST /api/variants/generate` to return 3 variants renders exactly 4 review rows (row 0 labelled "direct request" and marked baseline, read-only text equal to the base probe's `prompt_text`).
5. Save sends `variant_type: "framings"` by default and the body's `variants[0].prompt_text` equals the base probe's text; the success Toast contains "{n} probes added to the library" where n equals the response `variants.length`.
6. A conditions group card contains the text "Runs as an experiment" and its primary button is "Run as an experiment…" routing to `#/experiments/new?group={gid}`.
7. D1 for a file group calls `DELETE /api/variants/files/{gid}` and never `/api/probe-groups/{gid}`; for a DB-only group the reverse.
8. The drawer's variant rows link "→ probe #{id}" to `#/library/probes/{id}` for every row when `variants.length` equals the DB group's length; otherwise a Caveat line "Probe ids could not be matched to this file; re-sync." appears.
9. All five caveat phrases in §5 are present in the fixtures that render their region (`lib/copy/caveats.test.ts`).

## 12. Open questions for Brad
1. `GET /api/variants/files` returns no `probe_ids` (db.py:1413-1421); this spec joins through `GET /api/probe-groups` by `group_id`. Adding `probe_ids` to the file payload would remove the second call and the "not synced" state. Do that in the server?
2. "Open file location" needs the Tauri opener plugin, which is not in `src-tauri/Cargo.toml` today. Add it, or drop the button and show the path only?
3. Should the shipped `flinch/variants/*.md` files sync into the DB at startup (so first visit never shows "not synced")?
