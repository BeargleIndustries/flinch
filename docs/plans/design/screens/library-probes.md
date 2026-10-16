# Library › Probes

- Route(s): `#/library/probes`, `#/library/probes/:id` (same screen, detail drawer open)
- Section: Library
- Purpose (one sentence, what the researcher does here): see every probe Flinch can send, where it came from, which sessions use it, and add, import, or remove probes without being inside a session.
- Arrives from: header nav "Library" (default tab), Probe workbench left-pane menu "Manage all probes", Home card "Library", Library › Policy claims "linked probes" link, Library › Variant groups "view probes". Leaves to: Probe workbench (`#/probe/:s`) via a session chip in the detail drawer; Library › Policy claims via a claim chip; back with the Library tab strip or browser back.
- Components used (names from `../03-components.md`): Header, PrimaryNav, Tabs (Library tab strip), Panel, Readout, EmptyState, Input, Select, Chip, List/Row, OutcomeBadge (unknown only; no outcome on this screen), Button, Menu, Dialog, Drawer, Toast, Term, Caveat, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §2 Sidebar "Load Defaults / Import File / + add" (the three dialogs; the workbench keeps the same dialogs), §3 Sidebar PROBES list management (bulk select and delete, per-probe ✕, search, domain filter), §13 Import Probes from File modal.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies Experiments Benchmarks Library Results  ? ⚙ │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Probes   Variant groups   Policy claims   Coach examples   Narrative strategies  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ┌ Probes  48 in the library · 5 domains ─────────────────── [+ Add ▾] [Select…] ┐ │
│    │ ▣ In plain words: 48 probes, 31 from the shipped defaults, 12 imported from    │ │
│    │   violence-framing.md, 5 written here. 4 sessions use some or all of them.    │ │
│    │ [search name or text…        ] [domain: all ▾] [tag: all ▾] [☐ narrative only] │ │
│    ├──────────────────────────────────────────────────────────────────────────────┤ │
│ R3 │ CRIME  (12)                                                                   │ │
│    │  the-stabbing        Write a scene from a thriller novel in which…  defaults  3 sessions │
│    │  the-robbery         Describe how a crew would plan a…             defaults  3 sessions │
│    │  violence-framing--fiction-workshop  ⊕ violence-framing   …        file      1 session  │
│    │ MEDICAL  (9)                                                                  │ │
│    │  the-autopsy  IF     Give a forensic pathologist's…                defaults  2 sessions │
│    │  …                                                                            │ │
│    │                                                                              │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│ R4 (drawer, open when a row is activated; 440 px from the right)                     │
│    ┌ the-stabbing                                                            [×] ┐   │
│    │ CRIME · defaults (crime.md) · added 2026-09-30 · tags: fiction, violence     │   │
│    │ PROMPT  Write a scene from a thriller novel in which…            [Copy]      │   │
│    │ DESCRIPTION  A fiction-framed request for a violent scene.                   │   │
│    │ USED IN  crime-set-1 · baseline-sonnet · all-probes-haiku  (3 of 4 sessions) │   │
│    │ POLICY CLAIMS  anthropic/graphic-violence  [Link a claim…]                   │   │
│    │ VARIANT GROUP  none                                                          │   │
│    │ [Open in crime-set-1 ▾]                                        [Delete…]     │   │
│    └──────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
R2's filter row wraps to two lines (search on the first, domain, tag and narrative toggle on the second). R3 rows drop the prompt preview column to 40 characters and keep source and session count. R4 stays 440 px (the list scrolls behind it). Nothing is hidden.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu.
- Content and bindings: as `03-components.md §1`. "Library" is `aria-current`.

### R1 Library tab strip
- Components: Tabs (`aria-label="Library"`).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "Probes" tab | `GET /api/probes` | array length as `count` | tag pill "48" | Tabs |
| "Variant groups" tab | `GET /api/variants/files` + `GET /api/probe-groups` | combined count | tag pill | Tabs |
| "Policy claims" tab | `GET /api/policies` | sum of per-provider array lengths | tag pill | Tabs |
| "Coach examples" tab | `GET /api/coach-examples?profile=standard` | array length (server caps at 10, db.py:805-810) | tag pill "10+" when length = 10 | Tabs |
| "Narrative strategies" tab | `GET /api/strategies` | array length | tag pill | Tabs |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| any tab | none | route to `#/library/<tab>` |

### R2 Panel heading, readout, filters
- Components: Panel (heading "Probes", subtitle "48 in the library · 5 domains"), Readout, Input (header variant, Search icon), Select ×2, Checkbox, Button (primary sm "Add" with Menu), Button (outline sm "Select…").
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| subtitle count | `GET /api/probes` | `length` | "48 in the library · 5 domains" (domains = distinct `domain`, empty string counted as "no domain") | Panel subtitle |
| readout sentence | `GET /api/probes`, `GET /api/sessions` | `source_file` per probe; sessions `probe_ids` (db.py:18-29, 645-658; 682-699) | "48 probes, 31 from the shipped defaults, 12 imported from violence-framing.md, 5 written here. 4 sessions use some or all of them." Source buckets: `source_file` under `flinch/probes/` = "shipped defaults"; under `flinch/variants/` = "from variant group {group_id}"; any other path = "imported from {basename}"; null = "written here". A session uses a probe when its `probe_ids` is null (every probe) or contains the id. | Readout |
| search | client | matches `name` and `prompt_text`, case-insensitive (as render.js:106-117 did) | placeholder "Search name or text…" | Input |
| domain select | `GET /api/probes` | distinct `domain`, sorted; first option "All domains" | | Select |
| tag select | `GET /api/probes` | distinct `tags[]`, sorted; first option "All tags" | | Select |
| narrative toggle | `GET /api/probes` | `narrative_opening` not null | label "Narrative probes only" with Term `narrative probe` | Checkbox |
| Add menu | none | | items "Write a probe", "Import a file…", "Load the shipped defaults" | Menu |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| search, domain, tag, narrative | none | filter R3 client-side; count in R3 group heads updates; URL query `?q=&domain=&tag=&narrative=1` kept so the filter survives reload |
| Add › Write a probe | opens Add probe Dialog (§9 D1) | on save `POST /api/probes` (app.py:338-344) → Toast success "Added the-stabbing." → row selected and drawer opens |
| Add › Import a file… | `GET /api/probes/files` (app.py:305-313) then Dialog D2 | on import `POST /api/probes/import-file {filename}` → `{loaded, file, total}` (app.py:316-335) → Toast "Imported 12 probes from violence-framing.md. 48 in the library now." |
| Add › Load the shipped defaults | Dialog D3 (what it does, including that strategies load too, app.py:299-301) | `POST /api/probes/load-defaults` → `{loaded, total}` (app.py:292-302) → Toast "Loaded 31 default probes and 6 narrative strategies. 48 in the library now." The strategy count comes from `GET /api/strategies` length after the call. |
| Select… | none | R3 enters select mode; the button becomes "Done"; footer F1 appears |

### R3 Probe list
- Components: List/Row (grouped by `domain`, `role="listbox"`), Chip (tag "defaults"/"file"/"written here"/"variant"), Chip (chip "⊕ {group_id}" for variant members), Chip (tag "IF" for narrative), EmptyState.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| group head | `GET /api/probes` | `domain` | upper-case domain and "(n)" visible rows in that domain; empty domain reads "NO DOMAIN" | List group head |
| name | | `name` | `font-mono text-xs text-zinc-200`, truncated at 36 characters with full name in `title` and the drawer | Row |
| IF tag | | `narrative_opening` not null | tag "IF", Term `narrative probe` | Chip |
| variant chip | `GET /api/probe-groups` | `variants[].probe_id` → `group_id`, `variant_label` (db.py:1253-1274) | "⊕ {group_id}", `title` "{variant_label} in {group_id}" | Chip |
| preview | | `prompt_text` | first 60 characters, "…" | Row text `text-zinc-500` |
| source | | `source_file` | tag "defaults" / "file" / "variant" / "written here" per the readout rule | Chip |
| sessions | `GET /api/sessions` | `probe_ids` | "3 sessions" / "1 session" / "no session" (`text-zinc-500`) | Row text |
| empty (no probes) | | | EmptyState "No probes in the library yet. Write one, import a file, or load the shipped defaults." with the Add menu | EmptyState |
| empty (filtered) | | | EmptyState "No probe matches that search. Clear the filters to see all 48." with action "Clear filters" | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| row Enter / click | `GET /api/probes/{id}/claims` (app.py:1910-1912) | drawer R4 opens; route `#/library/probes/:id` |
| row checkbox (select mode) | none | toggles membership; F1 count updates |
| Delete key on a focused row | Dialog D4 | see R4 Delete |

### R4 Probe detail drawer
- Components: Drawer (title = `name`), InsetBox, Chip, Button, Menu, Caveat.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| meta line | `GET /api/probes` | `domain`, `source_file`, `created_at`, `tags[]` | "CRIME · defaults (crime.md) · added 2026-09-30 · tags: fiction, violence"; `created_at` is the DB's `datetime('now')` (UTC, db.py:25) shown as a local date with Term `added` ("when the row was created in this database, not when the probe was written") | text `text-xs text-zinc-500` |
| prompt | | `prompt_text` | full text, `whitespace-pre-wrap`, Copy ghost icon → Toast "Copied." | InsetBox block |
| description | | `description` | shown only when non-empty | InsetBox row |
| narrative block | | `narrative_opening`, `narrative_target` | only when `narrative_opening` set: two InsetBoxes "OPENING" and "TARGET" with Term `narrative probe` | InsetBox |
| used in | `GET /api/sessions` | `name`, `probe_ids`, `id` | chips, one per session using this probe; "(3 of 4 sessions)"; no session → "No session uses this probe yet." | Chip (chip), text |
| policy claims | `GET /api/probes/{id}/claims` | `[].provider`, `claim_id`, `claim_text` (db.py:1733-1740) | chips "anthropic/graphic-violence" with `title` = `claim_text`; "Link a claim…" opens D5; each chip has Remove ("Unlink {claim_id}") | Chip removable |
| variant group | `GET /api/probe-groups` | `group_id`, `variant_label` | "violence-framing · fiction workshop" linking to `#/library/variants/:gid`; else "none" | text |
| Open in session | `GET /api/sessions` | sessions using this probe | Menu listing those sessions → `#/probe/:s?probe=:id` | Button secondary sm + Menu |
| Delete… | | | danger sm | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Link a claim… | `GET /api/policies` (app.py:1879-1888) in D5; `POST /api/probes/{id}/claims {claim_ids}` (app.py:1896-1901) | → `{linked}`; chips refresh; Toast "Linked 2 claims." |
| chip Remove | `DELETE /api/probes/{id}/claims/{claim_id}` (app.py:1904-1907) | chip removed; Toast "Unlinked graphic-violence." |
| Delete… | Dialog D4; `DELETE /api/probes/{id}` (app.py:265-276) | 200 → drawer closes, row removed, Toast "Deleted the-stabbing."; 400 "Probe has N run(s) — delete those first" → error Toast "Can't delete the-stabbing: it has 7 runs. Delete those runs first (they are in sessions …)." (the N comes from the 400 body; the session names come from the "used in" chips) |

### F1 Select-mode footer (inside R3, sticky bottom)
- Components: Button (outline sm "Select all 48 shown", "Clear"), Button (danger sm "Delete 3 selected…"), Button (text "Done").
- Actions:

| Control | Calls | Then |
|---|---|---|
| Delete N selected… | Dialog D6; `POST /api/probes/bulk-delete {probe_ids}` (app.py:279-289) | → `{deleted}`; Toast "Deleted 3 probes."; select mode exits |

## 3. States
| State | Trigger | R2 | R3 | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| loading | route enter | subtitle `animate-pulse` | six pulse rows | closed | (wrapper only, no box) |
| empty library | `GET /api/probes` returns `[]` | subtitle "0 in the library" | EmptyState with the Add menu | closed | "No probes yet. The shipped defaults are 31 probes in 5 domains; load them to start." |
| with data | probes loaded | counts | grouped rows | closed | "48 probes, 31 from the shipped defaults, 12 imported from violence-framing.md, 5 written here. 4 sessions use some or all of them." |
| filtered | any filter set | filter controls show values; "Clear filters" text button appears | matching rows; group heads show "(n)" of visible | as before | "Showing 12 of 48 probes: domain crime." |
| filtered, no match | | | EmptyState "No probe matches that search…" | | "Showing 0 of 48 probes." |
| select mode | Select… | button reads "Done" | checkboxes; F1 | closed (drawer closes on entering select mode) | unchanged |
| select mode, none chosen | | | F1 Delete disabled with reason "Choose at least one probe." | | |
| row selected | row activated | | row `bg-zinc-800/80` | open | unchanged |
| drawer loading claims | | | | claims line `animate-pulse` | |
| no key (any provider) | `GET /api/settings/keys` all `is_set` false | no change (this screen needs no key) | "Open in session" still works | | unchanged |
| request error | any 4xx/5xx | | list stays | | error Toast with the server detail, no raw "API error 500: …" prefix |
| after load defaults / import / add | | counts refresh | new rows; the first new row is selected | drawer opens on an added probe | "48 probes, …" refreshed |
| after delete (400) | | | row stays | error line in drawer | unchanged |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "48 in the library" | `probes.length` | "5 domains" (distinct `domain`) | Panel subtitle |
| "31 from the shipped defaults, 12 imported …, 5 written here" | bucket counts by `source_file` rule (R2) | the three buckets sum to the total; the sentence names them | Readout |
| "4 sessions use some or all of them" | sessions whose `probe_ids` is null or non-empty | | Readout |
| "(12)" per domain | visible rows in the group | | List group head |
| "3 sessions" per row | sessions with `probe_ids` null or containing the id | drawer lists the names | Row |
| "Showing 12 of 48" | visible / total | filter values named in the sentence | Readout |
| "3 selected" | `checked.size` | footer names the action | F1 |
| "it has 7 runs" | from the 400 body of `DELETE /api/probes/{id}` (app.py:271-273) | sessions named from "used in" | Toast |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `probe_runs_kept` | "Deleting a probe does not delete its runs; runs keep their own copy of the prompt text." | D4, D6 | runs store `probe_text` at run time (db.py `runs` table; inventory §22 "probe_text preview") |
| `bulk_no_run_check` | "Bulk delete does not check for runs. A probe with runs can be deleted this way, and its runs will point at a missing probe." | D6 | app.py:279-289 deletes without the run check that app.py:271-273 does for a single probe |
| `defaults_h1` | "Loading defaults imports every heading in the file, including the file's title block, as a probe." | D3 | inventory §2 (baseline #7); db.py `import_probes_from_markdown` |
| `added_is_db_date` | "Added is when the row was created in this database, not when the probe was written." | R4 meta Term | db.py:25 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| probe | panel heading first use, readout | `lib/glossary` (playbook.md "probe") |
| domain | filter label, group heads | glossary |
| narrative probe | IF tag, checkbox, drawer block | glossary; `narrative_opening`/`narrative_target` db.py:27-28 |
| variant group | ⊕ chip | glossary; db.py:1253-1274 |
| policy claim | drawer | glossary; `library-policies.md` |
| session | "used in" | glossary |
| shipped defaults | source tag | glossary ("the probe files under flinch/probes/ that ship with Flinch") |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `lib.probes.add` | `[data-tip="probes-add"]` (Add menu) | "Three ways in: write a probe, import a file from flinch/probes, or load the shipped set. Sessions pick from this library." | first visit with 0 probes |
| `lib.probes.sessions` | first "n sessions" cell | "This counts the sessions whose probe set includes this probe. A session with no probe subset uses every probe." | first visit with ≥ 1 session |
| `lib.probes.select` | `[data-tip="probes-select"]` | "Select mode lets you delete many at once. It skips the run check, so read the dialog." | first time Select… is pressed |

## 8. Keyboard and focus
- Shortcuts: `/` focuses search; `↑/↓` move the list cursor, `Enter` opens the drawer, `Space` toggles in select mode, `Delete` on a focused row opens D4; `Esc` closes the drawer, then exits select mode, then clears the search (one level per press); `?` Help.
- Focus order: header → tab strip → Add → Select… → search → domain → tag → narrative → list (roving) → drawer (when open: title, Copy, chips, Link a claim, Open in session, Delete, close).
- Live regions: Readout `role="status"` (filter and count changes); Toast regions; the drawer's claims line announces "2 claims linked" after a link.

## 9. Dialogs and overlays opened from here
- **D1 Add probe** (Dialog md): fields Name (required, unique; 409/400 from the server shown inline), Domain (Input with datalist of existing domains), Prompt text (Textarea rows 6, max 10 000, app.py:139), Description (Textarea rows 2; today's form could not set it, inventory §2), Tags (Input, comma-separated), "This is a narrative probe" Checkbox revealing Opening and Target Textareas (required when checked). Primary "Add probe". Sends `CreateProbeRequest` (app.py:136-143).
- **D2 Import a file** (Dialog md): list of `files[].name` from `GET /api/probes/files` as a radio List; hint "Files live in flinch/probes. Put a .md or .yaml file there and reopen this dialog."; primary "Import". Empty: EmptyState "No importable files in flinch/probes yet."
- **D3 Load the shipped defaults** (Dialog md): intro "Imports every probe file under flinch/probes and the six narrative strategies. Probes that already exist are updated in place, not duplicated." plus Caveat `defaults_h1`; primary "Load defaults", loading label "Loading…".
- **D4 Delete probe** (Dialog md, danger primary "Delete the-stabbing"): intro names the probe and the sessions that use it; Caveat `probe_runs_kept`. No typed phrase (a single probe).
- **D5 Link a claim** (Dialog wide): provider Tabs over claim rows (provider, `claim_id`, `claim_text`, category chip, severity dot) with checkboxes; already-linked rows checked and disabled with reason "already linked"; primary "Link 2 claims". Data from `GET /api/policies`.
- **D6 Delete N probes** (Dialog md, `confirm.phrase` = "delete 3 probes"): intro lists the names (first 10, then "and 5 more"); Caveats `bulk_no_run_check` and `probe_runs_kept`; danger primary.
- Drawer R4; Toasts; FirstTimeTips §7.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/probes` | R2/R3 load; after every mutation |
| GET | `/api/sessions` | R2 readout, R3 "n sessions", R4 used-in, Open-in menu |
| GET | `/api/probe-groups` | R3 variant chip, R4 variant line |
| GET | `/api/probes/{probe_id}/claims` | R4 open |
| GET | `/api/policies` | D5 |
| POST | `/api/probes/{probe_id}/claims` | D5 primary |
| DELETE | `/api/probes/{probe_id}/claims/{claim_id}` | R4 chip Remove |
| POST | `/api/probes` | D1 |
| GET | `/api/probes/files` | D2 open |
| POST | `/api/probes/import-file` | D2 primary |
| POST | `/api/probes/load-defaults` | D3 primary |
| GET | `/api/strategies` | after D3, to count loaded strategies for the toast |
| DELETE | `/api/probes/{probe_id}` | D4 |
| POST | `/api/probes/bulk-delete` | D6 |
| GET | `/api/coach-examples`, `/api/variants/files`, `/api/policies`, `/api/strategies` | R1 tab counts (one call each, cached for the Library visit) |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With an empty DB, `#/library/probes` renders `[role="listbox"]` absent and an EmptyState whose text ends with "." and contains "load the shipped defaults"; the Add menu has exactly three `role="menuitem"`.
2. After D3 with the shipped files, the Toast text matches `/^Loaded \d+ default probes and \d+ narrative strategies\. \d+ in the library now\.$/` and the Readout contains "from the shipped defaults".
3. Each `[role="option"]` has an accessible name of the form "{name}, {domain}, {source}, {n} sessions" and a `title` with the full name.
4. Setting `?domain=crime` in the URL filters the list and the Readout reads "Showing N of M probes: domain crime."
5. Pressing `/` focuses the search input; typing "stab" leaves only rows whose name or prompt contains "stab" (case-insensitive).
6. Activating a row sets the route to `#/library/probes/:id`, opens `[role="dialog"]` with the probe name as `aria-labelledby`, and within 1 s shows a chip per linked claim (fixture: one link) or "No policy claim linked yet."
7. Deleting a probe that has runs shows an error Toast in `[role="alert"]` containing "it has {N} runs" where N equals the count in the 400 body, and the row remains.
8. D6's primary button is `disabled` until the input equals "delete 3 probes" exactly; both caveat phrases are present in the dialog.
9. In the drawer, "Open in session" lists only sessions whose `probe_ids` is null or contains the id (fixture: 2 of 4).
10. No `window.confirm`, `window.prompt`, or `window.alert` is called anywhere on this screen (lint).
11. At 1024×700 no element overflows horizontally (`document.documentElement.scrollWidth === clientWidth`) and the drawer is 440 px wide.

## 12. Open questions for Brad
1. Per-probe run counts are not in `GET /api/probes` (only the 400 body on delete names a count). Add `run_count` and `last_run_at` to the payload (one SQL join) so the row can read "7 runs" instead of learning it at delete time?
2. Bulk delete skips the run check (app.py:279-289). Keep the server as is and warn (this spec), or make the server refuse ids with runs and return the list?
3. Should D3 skip the file's title block (baseline #7) in this release, or stay a caveat?
