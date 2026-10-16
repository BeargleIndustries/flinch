# Global overlays: Help menu, Quick tour, Keyboard shortcuts, Glossary, About, Toasts, confirm dialogs

- Route(s): none of their own. They open over any route; the Shortcuts and Glossary dialogs add `?overlay=shortcuts` / `?overlay=glossary` to the current hash so a reload reopens them, and the tour adds `?tour=1`.
- Section: Home (shell-level; available on every section)
- Purpose (one sentence, what the researcher does here): get help without leaving the screen: a tour of the screen they are on, the key list, the glossary of Flinch's real names, what Flinch is, the outcome of the last action (toasts), and a confirmation before anything is deleted.
- Arrives from: header `?` (HelpMenu), the `?` key, `F8` (newest toast), any Term's "more" link (glossary), any destructive control (confirm dialog), any completed or failed request (toast). Leaves to: Escape or the close control returns focus to the opener; "Open Settings" in About goes to `#/settings#about`.
- Components used: HelpMenu, Menu, Dialog, Tour card (+ Pointer), FirstTimeTip, Term, Toast, Button, Input (glossary search), List/Row, Readout, Caveat.
- Baseline surfaces replaced: §15 Keyboard Shortcuts overlay (`#shortcut-help`, shortcuts.js:98-130), §16 Error toast (components.js:193-205) and experiment.js `showMsg` (108-115), every native `confirm()` / `prompt()` / `alert()` in api.js and render.js (inventory §1, §3, §20, §27, §28), the "Back to Tools" links (replaced by the header nav).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   … Results   [?]▾ ⚙ │
│                                                                       ┌──────────────┐│
│ R1 Help menu (w-56)                                                   │ Quick tour   ││
│                                                                       │ Keyboard shortcuts ││
│                                                                       │ Glossary     ││
│                                                                       │ What is Flinch ││
│                                                                       └──────────────┘│
│                                                                                      │
│ R2 Keyboard shortcuts (Dialog md)            R3 Glossary (Dialog wide)                │
│ ┌ Keyboard shortcuts ─────────────────┐      ┌ Glossary  [search terms…      ] ─────┐ │
│ │ ON THE PROBE WORKBENCH               │      │ OUTCOMES                              │ │
│ │ S        Send the probe              │      │ refused     The model declined …      │ │
│ │ P        Send the coach's pushback   │      │ collapsed   The model refused, then … │ │
│ │ K        Skip the pushback           │      │ negotiated  …  complied  …            │ │
│ │ N        Next probe   R  Back to ready│     │ THE SEVEN PUSHBACK MOVES              │ │
│ │ ↑ ↓      Move through the probes     │      │ specificity challenge  …              │ │
│ │ /        Search probes               │      │ … (every Term key, grouped)           │ │
│ │ Ctrl+Enter Send from a text box      │      │ MEASUREMENTS                          │ │
│ │ EVERYWHERE                           │      │ Cohen's d  …  Mann-Whitney U  …       │ │
│ │ ?        This list   Esc  Close      │      └───────────────────────────────────────┘ │
│ │ F8       Jump to the newest message  │                                               │
│ │ Enter    Confirm a dialog            │      R4 What is Flinch (Dialog md)             │
│ │ ⓘ Keys do nothing while you type in  │      ┌ What is Flinch ───────────────────────┐ │
│ │   a text box.                        │      │ Flinch sends a request to a model, …  │ │
│ └──────────────────────────────────────┘      │ Flinch 0.8.0 · desktop                │ │
│                                               │ [Open Settings › About] [Close]       │ │
│ R5 Tour card (over the Probe workbench)       └───────────────────────────────────────┘ │
│ ┌ STEP 2 OF 6  The run column ──────────┐                                             │
│ │ Pick a probe on the left and Send. …  │    R6 Toast stack (bottom-right)             │
│ │ [Skip tour]        [Back] [Next]      │    ┌ ✓ Exported crime-set-1 as CSV.   [×] ┐  │
│ └───────────────────────────────────────┘    │ ⚠ Can't delete the-stabbing: it has 7 runs. … [See runs] [×] │
│ R7 Confirm dialog (typed phrase)              └───────────────────────────────────────┘ │
│ ┌ Delete session crime-set-1 ───────────┐                                             │
│ │ Deletes crime-set-1 and its 12 runs … │                                             │
│ │ Type crime-set-1 to continue [      ] │                                             │
│ │                  [Cancel] [Delete session] │                                        │
│ └───────────────────────────────────────┘                                             │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
Dialogs keep `max-w-lg` / `max-w-4xl` and scroll inside the overlay. Below 760 px wide (not a supported size, but the component handles it) the tour card becomes a bottom sheet. Toasts keep `bottom-4 right-4` and wrap text. Nothing is hidden.

## 2. Regions

### R1 Help menu
- Components: HelpMenu (`03-components.md §1.5`).
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "Quick tour" | tour registry for the current section | | disabled with reason "No tour for this screen yet." when the section has no registry entry | Menu item |
| "Keyboard shortcuts" | | | | Menu item |
| "Glossary" | `lib/glossary` | | | Menu item |
| "What is Flinch" | | | | Menu item |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Quick tour | none | R5 opens on step 1; `?tour=1` |
| Keyboard shortcuts | none | R2; `?overlay=shortcuts` |
| Glossary | none | R3; `?overlay=glossary` |
| What is Flinch | `GET /health` (version) | R4 |

### R2 Keyboard shortcuts dialog
- Components: Dialog (md, title "Keyboard shortcuts", primary "Close"), definition grid (`grid grid-cols-[auto_1fr]`), Caveat inline.
- Content: static, pinned in `lib/copy/shortcuts.ts`. Groups and rows (draft; brad-voice pass):

| Group | Key | Action | Source |
|---|---|---|---|
| On the Probe workbench | `S` | Send the probe | shortcuts.js:98 |
| | `P` | Send the coach's pushback | shortcuts.js:99 |
| | `K` | Skip the pushback | shortcuts.js:100 |
| | `N` | Next probe | shortcuts.js:101 |
| | `R` | Back to ready (does not re-send; today's "Re-run probe" only returned to Probe selected, render.js:1102-1107) | shortcuts.js:102 |
| | `↑` `↓` | Move through the probes | shortcuts.js:103 |
| | `/` | Search probes | new (`03-components.md §25`) |
| | `Ctrl+Enter` | Send from a text box (manual pushback, forms) | new (§27) |
| Everywhere | `?` | This list | shortcuts.js:106 |
| | `Esc` | Close the top-most dialog, menu or tooltip | shortcuts.js:104 |
| | `Enter` | Confirm a dialog | shortcuts.js:105 |
| | `F8` | Jump to the newest message | new (§21) |
| | `1`–`6` | Go to a section (Probe … Results) when nothing is focused | new |
| Caveat | | "Keys do nothing while you type in a text box." | shortcuts.js:39-40 rule kept |

- Actions: `?` toggles; Esc closes; the grid rows are plain text (no actions).

### R3 Glossary dialog
- Components: Dialog (wide, title "Glossary"), Input (search), List grouped by category, Term definitions as text.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| entries | `lib/glossary` (every `GlossaryKey`; the test in `03-components.md` Appendix B asserts every Term used has an entry) | `key`, `term`, `definition`, `group`, `seeAlso[]` | groups in fixed order: Outcomes (refused, collapsed, negotiated, complied, unknown), The seven pushback moves (models.py:17-24 names, underscores as spaces), Probing (probe, session, run, pushback, label, judge, keyword scan, coach, coach example, pattern, ad-hoc probe), Studies (repeat study, framing, variant group, Models study, agreement, Context study, narrative strategy, warm-up turn, whittling, snapshot, improved), Experiments (condition, system prompt, Cohen's d, Mann-Whitney U, p-value, power, MTLD), Benchmarks (benchmark, suite, standard run, modified run, provenance, Hugging Face token), Settings (API key, Ollama, coach backend, Credential Manager, sidecar), Results (policy claim, enforcement label, scorecard, template, theme); each definition ends with "." and passes copy-lint (no banned verbs); `seeAlso` as links that scroll within the dialog | List |
| search | client | matches `term` and `definition` | | Input |
| deep link | `?overlay=glossary&term=key` | | opens scrolled to and highlighting that entry (`bg-indigo-950/40`) | |

- Actions: Term tooltips everywhere carry a "more" link (`text-[10px] text-indigo-400`) that opens R3 at that key.

### R4 "What is Flinch" dialog
- Components: Dialog (md, title "What is Flinch", primary "Close", secondary "Open Settings › About").
- Content (draft; brad-voice pass): three short paragraphs. "Flinch sends a request to a model and records whether it refused, then sends a pushback and records whether the refusal held. The labels are a keyword scan plus a judge model's guess, and you can change them." / "It is a research instrument for one question: does a model enforce its content rules consistently, across repeats, framings, models, conversation context and time? It is not a tool for getting a model to do something it would not." / "Everything it records stays in a local database and leaves only when you export it." Then a line "Flinch {version} · {shell}" from `GET /health` and the shell flag, and a Caveat `classifier` inline under the first paragraph.

### R5 Quick tour
- Components: Tour card (`03-components.md §23`) + Pointer.
- Content: a registry per section (`lib/tours/<section>.ts`), each step `{target, title, body, focus?}`. The Probe workbench tour (six steps, draft; brad-voice pass): 1 "The probe list" (`[data-tour="probes"]`: "Every probe in this session, grouped by domain, with its latest label. Pick one."), 2 "The run column" (`[data-tour="run"]`: "The probe goes here with Send. The model's reply comes back with its label and a plain-words sentence."), 3 "The label" (`[data-tour="label"]`: "A keyword scan and a judge model each make a guess. You can change the label; the change is kept with the run."), 4 "The coach" (`[data-tour="coach"]`: "The coach proposes one pushback from seven moves. Send it, write your own, or skip."), 5 "History" (`[data-tour="history"]`: "Every run in this session, with counts that say what they are made of."), 6 "Run all" (`[data-tour="run-all"]`: "Sends every probe in turn; you can stop it at any point."). Other sections' tours are defined in their own screen specs (`probe-workbench.md`, `studies.md`, `experiments.md`, `benchmarks.md`); Library, Results and Settings tours are three steps each and are listed in those specs' §7 as tips instead (no tour; the Help item is disabled there with the reason in R1).
- Behaviour: FirstTimeTips are suppressed while the tour runs; the page stays usable; a step whose target is missing is skipped and the counter shrinks ("Step 2 of 5"); Done or Skip writes `localStorage['flinch:tour:<section>'] = 'done'`; the tour is never auto-started, only from the Help menu and the Home "Take the tour" link.

### R6 Toasts
- Components: Toast (`03-components.md §21`), store `toast.show({tone, text, action?})`.
- Rules for every caller (pinned by tests):

| Tone | When | Timeout | Text shape (draft; brad-voice pass) |
|---|---|---|---|
| success | a save, export, delete, link or promote succeeded | 6 s | past-tense sentence naming the object and the count: "Exported crime-set-1 as CSV." / "Deleted 3 probes." / "Saved scorecard #7." |
| info | something started or was copied | 6 s | "Copied." / "Running all 4 probes." |
| error | any request failed, or an action was refused | none (stays until closed or F8 + Esc) | what could not happen and why, from the server's `detail` or `error` field, never the raw "API error {status}: {body}" string (api.js:17-20 today); a second sentence says what to do when the spec knows it: "Can't delete the-stabbing: it has 7 runs. Delete those runs first." Optional action button (e.g. "See runs"). |
| error (network) | fetch threw | none | "Flinch's server did not answer. Is it still running?" with action "Retry" when the caller passes one |

- Stacking: newest at the bottom; at most four visible, older ones collapse into "+2 more" which expands on click; errors are never collapsed. The experiment screen's separate bottom-centre `showMsg` (experiment.js:108-115) is removed; every screen uses this store.

### R7 Confirm dialogs
- Components: Dialog (`03-components.md §18`), `confirm` variant for typed phrases.
- Rules: every destructive control opens a Dialog, never `window.confirm`; the intro names the object and what goes with it (counts from already-loaded data); a typed phrase is required when the loss is more than one record: session (phrase = the session name), clear everything (`DELETE_ALL_DATA`, `results.md`), bulk delete (`delete N probes`, `library-probes.md`); single-record deletes use a plain danger primary; a dialog's primary is `loading` while the request runs and the error line shows the server detail on failure; Escape is disabled while loading. `window.prompt` (Coach example edit, inventory §27) and `window.alert` (Ollama test, inventory §28) have no replacement dialog; those flows are inline forms in their specs.

## 3. States
| State | Trigger | R1 | R2–R4 | R5 | R6 | R7 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|
| idle | | closed | closed | closed | empty | closed | (none; overlays have no Readout; the opener screen's Readout is unchanged) |
| menu open | `?` click | open, first item focused | | | | | |
| shortcuts open | item or `?` key | closed | R2 open | | | | |
| glossary open | item, Term "more" | | R3 open, search focused; `term=` highlights | | | | |
| glossary, no match | search | | EmptyState "No term matches that search." | | | | |
| about open | item | | R4 open; version loading pulse then "Flinch 0.8.0" | | | | |
| about, version unknown | `/health` fails | | "Flinch (version unknown)" | | | | |
| tour running | item | | | card on step n; Pointer on target; tips suppressed | | | |
| tour, target missing | | | | step skipped, counter shrinks | | | |
| tour done / skipped | | | | closed; localStorage set | | | |
| no tour for section | | item disabled with reason | | | | | |
| toast shown | store | | | | 1–4 toasts | | |
| toasts overflow | > 4 | | | | "+n more" row | | |
| toast focused | F8 | | | | newest toast focused; Esc dismisses it | | |
| confirm open | destructive control | | | | | open; primary disabled until the phrase matches (typed variant) | |
| confirm loading | primary | | | | | spinner; Esc inert | |
| confirm error | 4xx/5xx | | | | | error line `role="alert"` | |
| reduced motion | OS setting | | fade 0 ms | card jumps, Pointer static | fly 0 ms | | |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "Step 2 of 6" | step index of registry length (after skipping missing targets) | | Tour card eyebrow |
| "+2 more" | toasts beyond the fourth | expands to show them | Toast stack |
| counts inside toast text ("Deleted 3 probes.") | from the response (`deleted`) or the request (selected ids) | the sentence names the object | Toast |
| "Flinch 0.8.0" | `GET /health.version` | shell word | R4 |
| counts in confirm intros ("its 12 runs, 1 snapshot") | from the list data already on screen | | R7 |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `keys_in_fields` | "Keys do nothing while you type in a text box." | R2 | shortcuts.js:39-40 |
| `r_not_resend` | "R returns to the ready state; it does not send the probe again." | R2 row for R | render.js:1102-1107 |
| `classifier` | "The label is a keyword scan plus a judge model's guess. You can change it." | R4 first paragraph | classifier.py |
| `local_only` | "Everything Flinch records stays in a local database and leaves only when you export it." | R4 | db.py (SQLite file); CLAUDE.md "SQLite is source of truth" |
| `glossary_is_flinch` | "Definitions are Flinch's; where a term comes from the paper, the entry says so." | R3 footer | playbook.md |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| every `GlossaryKey` | R3 is the glossary itself | `lib/glossary` |
| pushback move names | R3 group, R5 step 4 | models.py:17-24 |
| outcome names | R3 group, R4 | models.py:6-10 |
| judge, keyword scan | R4, R5 step 3 | classifier.py |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `shell.help` | header `?` | "Tour, keys, glossary and what Flinch is. The dotted words everywhere are glossary entries; hover them." | first visit to any screen after Home |
| `shell.toast` | first error toast | "Errors stay until you close them. F8 jumps here." | first error toast |

## 8. Keyboard and focus
- Shortcuts: `?` opens/closes R2 (ignored in fields); `Esc` closes the top-most overlay only (Term tooltip → menu → dialog → tour), one per press; `F8` focuses the newest toast; `←/→` or Back/Next in the tour; `↑/↓/Home/End` in menus and the glossary list; `Enter` confirms a dialog's primary when it is enabled.
- Focus order: a dialog traps focus (Tab cycles inside); initial focus goes to the first field (glossary search, typed-phrase input) or the primary (shortcuts, about); on close focus returns to the opener. The tour does not trap focus (`aria-modal="false"`); Tab leaves the card into the page and `Esc` skips the tour. Toasts are not in the Tab order until F8.
- Live regions: info and success toasts in one `role="status" aria-live="polite"` region; error toasts in `role="alert"`; the tour announces its title on each step via `aria-labelledby`; dialogs announce their title.

## 9. Dialogs and overlays opened from here
- R2, R3, R4, R5, R7 as above. None opens another dialog (a confirm dialog from a dialog is not allowed; the screen specs route such cases through a Drawer or inline form).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/health` | R4 version |
| none | | R1, R2, R3, R5, R6, R7 are client-only; toasts and confirms are triggered by the screens' own routes |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. Pressing `?` on `#/library/probes` with focus on the body opens a `[role="dialog"]` whose `aria-labelledby` resolves to "Keyboard shortcuts"; pressing `?` inside the search input does not.
2. R2 lists the rows in the table above in order; the `keys_in_fields` and `r_not_resend` phrases are present; no row reads "Re-run probe".
3. Opening the Glossary with `?overlay=glossary&term=collapsed` scrolls the "collapsed" entry into view and gives it the highlight class; every entry's definition ends with "." (copy-lint over the fixture).
4. The glossary renders one entry per `GlossaryKey` and the test that walks `lib/copy` and `*.svelte` for Term keys finds none missing (`lib/glossary.test.ts`).
5. R4 contains the sentence "It is not a tool for getting a model to do something it would not." and the version text from `/health`.
6. Starting the tour on the Probe workbench with the fixture that lacks `[data-tour="coach"]` shows "Step 1 of 5" and never a step titled "The coach"; Done sets `localStorage['flinch:tour:probe']`.
7. While the tour runs, no `[role="dialog"][aria-modal="false"]` FirstTimeTip is mounted besides the tour card.
8. `toast.show({tone:'error', text:'x.'})` mounts in `[role="alert"]`, has no auto-dismiss (still present after 10 s), and F8 moves `document.activeElement` to it; Esc then removes it and returns focus.
9. Five info toasts render four plus a "+1 more" button; an error toast among them is never collapsed.
10. A grep of the built bundle finds no `window.confirm(`, `window.prompt(`, `window.alert(`, bare `confirm(`, `prompt(` or `alert(` (lint rule in CI).
11. A typed-phrase confirm's primary stays `disabled` for a case-different phrase and enables on the exact phrase; while loading, Escape does not close it.
12. At 1024×700 every dialog's panel fits inside the viewport height or scrolls inside the overlay (`overflow-y-auto` on the overlay), never clipping its footer.

## 12. Open questions for Brad
1. Number keys `1`–`6` for section switching are new and could collide with future workbench shortcuts; keep or drop?
2. The Help menu item "What is Flinch" could instead open the Home screen's intro card; a dialog keeps the researcher where they are. Preference?
3. Should the Probe workbench tour auto-offer once (a FirstTimeTip pointing at `?` is the current plan), or auto-start on the first session like Pry's lessons do?
