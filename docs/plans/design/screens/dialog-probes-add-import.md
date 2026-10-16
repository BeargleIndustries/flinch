# Add probe / Import probes dialog

- Route(s): none of its own; a Dialog over `#/probe/:s` (from the probe list "⋯" menu and its empty states) and over `#/library/probes` (from "Add", "Import", "Load defaults"). It has two tabs, "Add a probe" and "Import a file"; the opener picks the tab.
- Section: Probe (also used by Library)
- Purpose (one sentence, what the researcher does here): brings probes into the library, either by writing one (with optional narrative fields) or by importing one of the shipped probe files, and sees exactly how many arrived.
- Arrives from: Probe workbench R1 "⋯" menu ("Add a probe…", "Import a file…"), the workbench empty states, Library › Probes toolbar. "Load the example probes" in those menus calls the server directly and shows its result as a toast; the Import tab also offers it so the count is visible in context. Leaves to: back to the opener on Close, Escape or the overlay click; the workbench list re-fetches and selects the new probe; Library › Probes re-fetches.
- Components used (names from `../03-components.md`): Dialog (size `md`), Tabs, Input, Textarea, Checkbox, Chip (removable tags), InsetBox, Readout (warn), Caveat, Term, Button, List/Row (file list), Rate, EmptyState, Toast, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §2 sidebar "Load Defaults", "Import File", "+ add" and the inline add-probe form (name, domain, prompt, tags, narrative checkbox with opening and target); §13 Import Probes from File modal (`#import-file-modal`), including its missing success feedback and its missing Escape handling; the `description` field the form could not set (accepted at app.py:140).

All visible strings in this spec are drafts (draft; brad-voice pass). Probe names are from `flinch/probes/example-probes.md` only; no prompt text is quoted.

## 1. Wireframe, 1280×800
Tab "Add a probe", over the workbench (dimmed). Panel `max-w-lg`, about 600 px tall with the narrative block closed.
```
┌──────────────────────────────── overlay bg-black/60 ───────────────────────────────┐
│          ┌──────────────────────────────────────────────────────────────┐          │
│          │ R1 Probes                                              [×]    │          │
│          │    A probe is a prompt with a name, a domain and tags. It     │          │
│          │    goes into the library, which every session reads from.     │          │
│          │ R2 [Add a probe]  [Import a file]                              │          │
│          │ R3 NAME                      DOMAIN                            │          │
│          │    [the-interrogation      ] [crime            ▾]              │          │
│          │    PROMPT TEXT                                                 │          │
│          │    [                                                 ]         │          │
│          │    [                                                 ]         │          │
│          │    [                                                 ]         │          │
│          │    DESCRIPTION (optional)                                      │          │
│          │    [                                                 ]         │          │
│          │    TAGS                                                        │          │
│          │    [violence ×][thriller ×] [add a tag…      ]                 │          │
│          │    ☐ Narrative probe: give it an opening and a target for      │          │
│          │      Context studies                                           │          │
│          │ R5                                        [Cancel] [Add probe]  │          │
│          └──────────────────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────────────────────┘
```
Tab "Import a file":
```
│          │ R2 [Add a probe]  [Import a file]                              │
│          │ R4 Files are read from the probes folder of this Flinch        │
│          │    install: /…/flinch/probes. Each ## heading in a Markdown     │
│          │    file is one probe; names already in the library are skipped.│
│          │    example-probes.md      3 probes, 3 already in     [Import]   │
│          │    ─────────────────────────────────────────────────────────    │
│          │    [Load the example probes]  loads every file above and the    │
│          │    narrative strategies                                         │
│          │    ▣ Loaded 3 probes from example-probes.md; 3 in the library   │
│          │      now. (after an import)                                     │
│          │ R5                                               [Close]        │
```
### 1024×700 differences
The panel keeps its width (512 px). The Add tab's Name and Domain fields stack on two lines. With the narrative block open the panel is taller than the viewport and the Dialog overlay scrolls (components §18); the footer follows the content. The Import tab fits without scrolling. Nothing is hidden; Escape works on both tabs.

## 2. Regions

### R1 Title and intro
- Components: Dialog title, intro, Term, Button ghost icon (close).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title "Probes" | static | n/a | | Dialog title |
| Intro | static | n/a | "A probe is a prompt with a name, a domain and tags. It goes into the library, which every session reads from." with `Term` on probe, domain, library; when opened from a session with a fixed probe set, a second sentence: "This session uses a fixed set, so a new probe shows under Library, not here." (db.py:686-692) | Dialog intro |
| Close | none | n/a | ghost icon "×" in the title row (both tabs) | Button |

- Actions: Close → closes, focus returns to the opener.

### R2 Tabs
- Components: Tabs (`id: 'add' | 'import'`, count on Import = number of files).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "Add a probe" | none | n/a | default when opened from "Add a probe…" or "+ Ad-hoc" is not involved | Tab |
| "Import a file" | `GET /api/probes/files` (app.py:305-313) | `files.length` | count pill; default when opened from "Import a file…" or an empty state | Tab |

- Actions: tab change keeps typed fields in memory until the dialog closes.

### R3 Add a probe
- Components: Input, Select or Input with datalist (domain), Textarea, Chip (removable), Checkbox, InsetBox, Caveat, Term, Button, FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Name | `GET /api/probes` (app.py:257-263) for the uniqueness check | `[].name` | required; max 200 (app.py:137); hint "Short and unique, like the-autopsy."; checked against existing names on blur and on submit (the column is `UNIQUE`, db.py:20, and the server does not catch the collision, app.py:338-344) | Input |
| Domain | same | unique `[].domain` | Input with a `<datalist>` of existing domains; optional (stored "" when empty, app.py:138); hint "Groups the probe in lists; crime, medical and romance exist now." | Input + datalist |
| Prompt text | none | n/a | required; max 10000 (app.py:139); `rows=5`, auto-grow to 12; hint "Sent to the target model as written." | Textarea |
| Description | none | n/a | optional; max none on the server (app.py:140); one line; hint "Shown under the probe name in the run column." | Input |
| Tags | none | n/a | removable Chips; Input "add a tag…" where Enter or "," adds; stored as `tags[]` (app.py:141; db.py:23) | Chip + Input |
| Narrative checkbox | none | n/a | "Narrative probe: give it an opening and a target for Context studies" with `Term` on narrative probe and Context studies | Checkbox |
| Narrative opening | none | n/a | shown when checked; required then; `rows=3`; hint "The innocuous scene the conversation starts in." (db.py:27; today's hint, index.html:1120-1128) | Textarea |
| Narrative target | none | n/a | shown when checked; required then; `rows=3`; hint "Where the conversation is meant to arrive; the probe text itself is sent last." (db.py:28) | Textarea |
| Narrative note | static | n/a | "Narrative probes are built up over warm-up turns in a Context study; in the Probe workbench they are sent as plain probes." | InsetBox row |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| "Add probe" / Enter (in an Input) / Ctrl+Enter (Textarea) | validate name, prompt (and opening, target when narrative), then `POST /api/probes {name, domain, prompt_text, description, tags, narrative_opening?, narrative_target?}` (app.py:136-143, 338-344) → the probe (db.py `get_probe`) | dialog closes; toast success "Added the-interrogation to the library."; the opener re-fetches `GET /api/probes?session_id` (workbench) or `GET /api/probes` (Library); the workbench selects the new probe and enters *ready* when the session has no fixed set, otherwise the toast adds "This session uses a fixed set; find it under Library." |
| "Add another" (secondary, appears after a success when opened from Library) | same | keeps the dialog open with cleared fields; domain and tags kept |
| Cancel / Escape / overlay | none | closes; fields discarded |

### R4 Import a file
- Components: InsetBox, List/Row, Button, Rate, Readout, Caveat, EmptyState, Toast.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Folder line | `GET /api/probes/files` | `files[].path` (the directory part; unshown today, inventory §13) | "Files are read from the probes folder of this Flinch install: {dir}." with a Copy ghost icon; when no files, the line still shows the folder from the server's `PROBES_DIR` (app.py:294, 305-313) as "the probes folder" with the Term explaining where it is | InsetBox row |
| Format line | static (db.py:1005-1016 docstring) | n/a | "Each ## heading in a Markdown file is one probe, with - domain:, - tags: and - description: lines, then the prompt. YAML files are read too. Names already in the library are skipped." (db.py:1035-1037) | text |
| File rows | `GET /api/probes/files` | `files[].name` | name mono; a count line "{k} probes, {j} already in" computed by the client from a `GET /api/probes` name match is not possible without reading the file, so the row shows "Import" and the count arrives in the result line (§12 asks for a dry-run count); "Import" secondary sm, loading "Importing…" | Row + Button |
| Result line | `POST /api/probes/import-file` response (app.py:316-335) | `loaded`, `file`, `total` | Readout "Loaded 3 probes from example-probes.md; 3 in the library now." / "Loaded 0 probes from example-probes.md: every name in it is already in the library; 3 in the library now." | Readout |
| "Load the example probes" | none | n/a | primary sm; hint "loads every file above and the narrative strategies" (app.py:292-302 imports `flinch/probes/*` and `flinch/strategies/*`) | Button |
| Defaults result | `POST /api/probes/load-defaults` response | `loaded`, `total` | Readout "Loaded 3 probes from the shipped files; 3 in the library now. Narrative strategies were loaded too." | Readout |
| Artefact warning | `GET /api/probes` after an import | any `[].name` starting with "#" | warn Readout "The file's title block was imported as a probe named '# Flinch Example Probes' (a known import quirk). Delete it?" with a danger text button "Delete it" (baseline #7: db.py:1021-1031 splits on `## ` and takes the first block's first line as a name) | Readout warn + Button |
| Empty | `files.length === 0` | n/a | "No probe files in the probes folder. Add a .md or .yaml file there, or write a probe on the other tab." with action "Add a probe" | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| "Import" (row) | `POST /api/probes/import-file {filename}` (app.py:316-335) | result line; the opener re-fetches; the row's button reads "Imported" (pressed) for this open; toast success with the same sentence |
| "Load the example probes" | `POST /api/probes/load-defaults` (app.py:292-302) | defaults result line; re-fetch; toast |
| "Delete it" (artefact) | `DELETE /api/probes/{id}` (app.py:265-276) | warning clears; toast "Deleted the title-block probe."; a 400 (runs exist) shows the server `detail` inline |
| Close / Escape / overlay | none | closes (Escape works here, unlike today's modal, inventory §13) |

### R5 Footer
- Components: Button.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Add tab: Cancel, "Add probe" | none | n/a | secondary md, primary md (loading "Adding…") | Button |
| Import tab: Close | none | n/a | secondary md (no primary: the row buttons are the actions) | Button |

- Actions: as R3 and R4.

## 3. States
| State | Trigger | R2 | R3 | R4 | R5 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|
| Opening | until `GET /api/probes` and `GET /api/probes/files` resolve | Import count "…" | fields enabled (names list arrives for the check) | three skeleton rows | | (none) |
| Add, default | tab add | | empty fields; Domain datalist filled | | Cancel, Add probe | (none) |
| Add, from a fixed-set session | opener session `probe_ids` non-null | | | | | intro sentence "This session uses a fixed set, so a new probe shows under Library, not here." |
| Add, narrative open | checkbox | | opening and target Textareas and the note appear | | | (none) |
| Add, name empty on submit | validation | | error "Give the probe a name." under Name; focus there | | | (none) |
| Add, name taken | blur or submit matches an existing `name` | | error "A probe named the-autopsy already exists. Pick another name." | | Add probe blocked | (none) |
| Add, prompt empty on submit | validation | | error "Write the prompt text." | | | (none) |
| Add, narrative fields empty on submit | checkbox on, either empty | | error "A narrative probe needs both an opening and a target." on the empty one | | | (none) |
| Add, too long | > 200 / > 10000 | | error naming the limit with a thin-space number | | | (none) |
| Adding | submit valid | tabs disabled | fields disabled | | primary loading "Adding…"; Escape ignored | (none) |
| Add error | 500 (for example the UNIQUE collision the client did not see because the list was stale) | | | | error line `role="alert"` "Could not add the probe: {detail}."; fields re-enabled; the names list re-fetched | (none) |
| Added | 200 | | | | closes (or clears on "Add another") | (toast) |
| Import, list | files present | count "1" | | rows | Close | (none) |
| Import, empty | no files | count "0" | | EmptyState | Close | (none) |
| Import, files failed | `GET /api/probes/files` non-2xx | count "…" | | EmptyState "Could not read the probes folder ({status})." with "Try again" | | (none) |
| Importing | row Import | | | that row loading "Importing…", other rows disabled | | (none) |
| Imported | 200 | | | result Readout; row "Imported" pressed | | "Loaded 3 probes from example-probes.md; 3 in the library now." |
| Imported nothing new | `loaded` 0 | | | result Readout | | "Loaded 0 probes from example-probes.md: every name in it is already in the library; 3 in the library now." |
| Import error | 400 / 404 (app.py:322-332) | | | error line under the row with `detail` ("Only .md and .yaml files supported", "File not found: …") | | (none) |
| Defaults loading | "Load the example probes" | | | button loading "Loading…" | | (none) |
| Defaults done | 200 | | | defaults Readout | | "Loaded 3 probes from the shipped files; 3 in the library now. Narrative strategies were loaded too." |
| Artefact present | a probe name starts with "#" after any import | | | warn Readout with "Delete it" | | "The file's title block was imported as a probe named '# Flinch Example Probes' (a known import quirk). Delete it?" |
| Artefact deleting / deleted / blocked | "Delete it" | | | spinner; cleared; or the server `detail` (app.py:273, "Probe has N run(s)" followed by a dash and "delete those first") rendered in UI copy with a colon instead of the dash: "Probe has 2 runs: delete those first." | | (none) |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Import tab count "1" | `files.length` (app.py:305-313) | the rows under the tab | Tabs count pill |
| "Loaded 3 probes from example-probes.md; 3 in the library now." | `loaded`, `file`, `total` (app.py:335) | all three in one sentence | Readout |
| "Loaded 3 probes from the shipped files; 3 in the library now." | `loaded`, `total` (app.py:302) | both in one sentence | Readout |
| "crime, medical and romance exist now" | distinct `[].domain` from `GET /api/probes` | the datalist shows the same values | hint |
| "200 characters" / "10 000 characters" | `Field(max_length=…)` (app.py:137, 139) | the error names the field | field error |
| "Probe has 2 runs" | server `detail` (app.py:271-273) | the probe name in the same line | inline error |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `fixed_set` (proposed, shared with `dialog-new-session.md`) | "A fixed set does not grow when probes are added later." | the intro's second sentence when the opener session has `probe_ids` | db.py:686-692; app.py:257-263 |
| `import_skips` (proposed new id) | "Names already in the library are skipped." | the format line and the zero-loaded result | db.py:1035-1037 |
| `narrative_plain` (proposed new id) | "In the Probe workbench a narrative probe is sent as a plain probe; the opening and target are used by Context studies." | the narrative note | runner.py:116-130 (send_probe sends `prompt_text` only); the narrative fields are read by the sequence runner |
| `classifier`, `rate_n`, `held_once`, `product_filter`, `coach_conf` | not in this dialog | | |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| probe | title, intro, fields | "a prompt sent to the target model, with a name, a domain and tags" (db.py:18-29) |
| library | intro, result lines | "every probe Flinch knows, across sessions; sessions read from it" (db.py:645-658) |
| domain | field label, hint | "the probe's category, used for grouping and filters" (db.py:21) |
| tag | field label | "a free word on a probe, shown as a chip; separate from pattern tags on runs" (db.py:23) |
| narrative probe | checkbox | "a probe with a narrative opening and target, built up over warm-up turns in a Context study" (db.py:27-28) |
| narrative opening / narrative target | field labels | "the innocuous starting scene" / "where the conversation is meant to arrive" (db.py:27-28; today's hints) |
| Context study | checkbox, note | "a study that warms the model up over several turns before the probe" (IA §3, `#/studies/context/:id`) |
| probes folder | R4 folder line | "the `flinch/probes` directory of this install; the server reads .md and .yaml files from it" (app.py:305-313) |
| shipped files | defaults result | "the probe files that come with Flinch; today that is example-probes.md" (`flinch/probes/`) |
| narrative strategies | defaults hint | "warm-up strategy files loaded alongside the probes, used by Context studies" (app.py:299-301) |
| fixed set | intro | "a session's probe subset chosen when it was created" (db.py:686-692) |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `pa.name` | `[data-tip="pa.name"]` (Name input) | title "Names are the key"; blurb "A probe's name is unique across the library and shows in every list and export. Short, lowercase, hyphens: the-autopsy." | Add tab first open |
| `pa.narrative` | `[data-tip="pa.narrative"]` (Narrative checkbox) | title "Only for Context studies"; blurb "Tick this when the probe should be reached through a story. The Probe workbench still sends it as written." | Add tab, after `pa.name` dismissed |
| `pa.import` | `[data-tip="pa.import"]` (first Import button) | title "Import reads the folder"; blurb "Flinch reads probe files from its own probes folder, not from a file you pick. Drop a .md file there and it appears here." | Import tab first open with ≥1 file |
| `pa.defaults` | `[data-tip="pa.defaults"]` ("Load the example probes") | title "Three probes to start with"; blurb "The shipped file has three example probes across crime, medical and romance. Load them to try the loop before writing your own." | Import tab, 0 probes in the library |

Placement audit: all four anchor beside their targets at 1280 and 1024 (the panel is centred with room on both sides).

## 8. Keyboard and focus
- Shortcuts: Tabs strip Left/Right switches tabs (roving tabindex); Enter in an Input submits the Add tab; Ctrl+Enter submits from a Textarea; Enter or "," in the tag input adds a tag, Backspace on an empty tag input removes the last chip; Escape closes on both tabs (ignored while adding or importing).
- Focus order (Add): Close × → tab strip → Name → Domain → Prompt text → Description → tag chips' remove buttons → tag input → Narrative checkbox → (opening → target) → Cancel → Add probe. Initial focus: Name. (Import): Close × → tab strip → Copy folder → each row's Import → Load the example probes → Delete it (when present) → Close. Initial focus: the first Import button, or the EmptyState action. On a validation failure focus moves to the first field with an error. On close, focus returns to the opener (the "⋯" menu trigger or the toolbar button).
- Live regions: field errors via `aria-describedby` and `aria-invalid`; result and warn Readouts `role="status"` (polite); the add error line `role="alert"`; the tag list announces "Added tag violence" / "Removed tag violence" in a polite region.

## 9. Dialogs and overlays opened from here
- None stack. "Delete it" (artefact) acts inline without a second dialog because the probe is a known artefact with no runs in the normal case; if the server returns 400 the detail is shown inline. Term tooltips and FirstTimeTips show over the panel. Toasts appear after close or beside the panel while it stays open ("Add another").

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/probes` | R3 name uniqueness and domain datalist on open; R4 artefact check after every import; re-fetched after an add error |
| POST | `/api/probes` | R3 Add probe |
| GET | `/api/probes/files` | R2 count, R4 rows on open and on "Try again" |
| POST | `/api/probes/import-file` | R4 row Import |
| POST | `/api/probes/load-defaults` | R4 Load the example probes |
| DELETE | `/api/probes/{id}` | R4 artefact "Delete it" |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. Opening from the workbench "Add a probe…" renders `[role="dialog"]` titled "Probes" with a `[role="tablist"]` of two tabs; "Add a probe" has `aria-selected="true"` and focus is on the Name input. Opening from "Import a file…" selects the Import tab and focuses the first "Import" button.
2. The Import tab's count pill equals `files.length` from `GET /api/probes/files`; the folder line contains the directory part of `files[0].path`.
3. Submitting the Add tab with an empty Name sends no request and shows "Give the probe a name." linked by `aria-describedby`; with Name set to an existing probe name the error reads "A probe named <name> already exists. Pick another name." and no request is sent.
4. Ticking "Narrative probe" reveals two textareas labelled "Narrative opening" and "Narrative target" and the note beginning "Narrative probes are built up"; submitting with either empty shows "A narrative probe needs both an opening and a target." on the empty one.
5. A valid submit posts `/api/probes` with `{name, domain, prompt_text, description, tags}` and, only when the checkbox is ticked, `narrative_opening` and `narrative_target`; `tags` equals the chip texts in order.
6. On 200 the dialog closes, a success toast reads "Added <name> to the library.", and in the workbench the new probe is the selected row with the run column in the ready state (when the session has no fixed set); when the session has `probe_ids`, the toast ends with "find it under Library." and the list is unchanged.
7. Typing "violence," in the tag input creates a chip named "Remove violence" and clears the input; Backspace in the empty input removes the last chip.
8. On the Import tab, clicking "Import" on example-probes.md posts `/api/probes/import-file` with `{"filename":"example-probes.md"}`; the result Readout text equals "Loaded <loaded> probes from example-probes.md; <total> in the library now." and the button becomes `aria-pressed="true"` with the label "Imported".
9. Importing the same file again yields a Readout containing "every name in it is already in the library".
10. "Load the example probes" posts `/api/probes/load-defaults` and the Readout reads "Loaded <loaded> probes from the shipped files; <total> in the library now. Narrative strategies were loaded too."
11. If `GET /api/probes` after an import contains a probe whose `name` starts with "#", a `role="status"` warn element appears with a "Delete it" button; clicking it sends `DELETE /api/probes/<id>` and the warning disappears on 200.
12. Pressing Escape on the Import tab closes the dialog and returns focus to the "⋯" menu trigger that opened it; pressing Escape while a row shows "Importing…" does nothing.
13. With `GET /api/probes/files` returning `{"files":[]}`, the Import tab shows an EmptyState ending in "." with an "Add a probe" button that switches to the Add tab.
14. At 1024×700 with the narrative block open, the overlay scrolls and "Add probe" is reachable by Tab; no horizontal scrollbar appears.
15. No visible string contains U+2014; the server's "delete those first" detail (app.py:273) is rendered as "Probe has <n> runs: delete those first."

## 12. Open questions for Brad
1. **Importing reads the server's folder only.** There is no upload route; `POST /api/probes/import-file` takes a filename inside `PROBES_DIR` (app.py:316-332). In the desktop build that folder sits inside the installed wheel, so "drop a file there" is awkward. Add `POST /api/probes/import-upload` (multipart) in this release, or document the folder?
2. **The title-block artefact** (baseline #7): `import_probes_from_markdown` splits on `## ` and imports the leading `# …` block as a probe (db.py:1021-1031). The dialog offers "Delete it" after the fact. A one-line server fix (skip a first block that starts with `#`) removes the warning entirely; do it here or leave it UI-side?
3. **Name collisions reach SQLite.** `create_probe` does not catch the `UNIQUE` error (db.py:629-640; app.py:338-344), so the client checks names first and a stale list can still produce a 500. Return 409 with a message from the server?
4. **No dry-run count.** The file rows cannot say "3 probes, 0 new" before importing because only the server reads the file. A `GET /api/probes/files/{name}/preview` would let the row show that count; worth it, or is the post-import sentence enough?
5. Three proposed caveat ids: `import_skips`, `narrative_plain`, and `fixed_set` (shared with the New session dialog). Confirm or merge.
