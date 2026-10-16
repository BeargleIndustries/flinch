# New session dialog

- Route(s): none of its own; a Dialog over `#/`, `#/probe`, `#/probe/:s` or any screen whose SessionSwitcher menu has "New session". On create it navigates to `#/probe/:id`.
- Section: Probe
- Purpose (one sentence, what the researcher does here): defines a session, which is one target model, one optional system prompt, one coach backend and profile, and a probe set, so that every run made inside it is comparable.
- Arrives from: "New session" on the Sessions list, `n` on that list, the SessionSwitcher menu on every screen, the Home Probe card when there are no sessions, the Quick tour's last step, the Sessions EmptyState. Leaves to: `#/probe/:id` on Create; back to the opener on Cancel, Escape or the overlay click, with focus returned to the opener.
- Components used (names from `../03-components.md`): Dialog (size `md`), Input, Textarea, Select, Checkbox, InsetBox, Readout (tone warn, inside the dialog), Term, Caveat, Chip, Button, List/Row (probe picker), Rate, Toast, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §12 New Session modal (`#new-session-modal`), including its probes picker, local-coach warning and the Enter-to-submit rule; the free-text Coach Profile field becomes a Select from `GET /api/coach-profiles` (app.py:450-452, never called today); the session `notes` field (accepted at app.py:149, no input today) gets a field.

All visible strings in this spec are drafts (draft; brad-voice pass). Probe names are from `flinch/probes/example-probes.md` only.

## 1. Wireframe, 1280×800
Over `#/probe` (dimmed). The panel is `max-w-lg` (512 px), centred, about 640 px tall with the picker closed.
```
┌──────────────────────────────── overlay bg-black/60 ───────────────────────────────┐
│          ┌──────────────────────────────────────────────────────────────┐          │
│          │ R1 New session                                                │          │
│          │    A session is one target model, one optional system prompt,  │          │
│          │    one coach profile and a probe set. Runs stay together.      │          │
│          │ R2 NAME                                                        │          │
│          │    [crime-set-1                                   ]            │          │
│          │    TARGET MODEL                                                │          │
│          │    [Claude Sonnet 4.6 (claude-sonnet-4-6)              ▾]     │          │
│          │    Anthropic key set. Replies are labelled by a keyword scan    │          │
│          │    plus a judge model.                                         │          │
│          │    SYSTEM PROMPT (optional)                                    │          │
│          │    [                                                 ]         │          │
│          │    [                                                 ]         │          │
│          │ R3 COACH                                                       │          │
│          │    Backend [Claude (Anthropic) ▾]   Profile [standard ▾]       │          │
│          │    standard: default profile based on 'Rules Are Rules'        │          │
│          │    research methodology · 7 moves                              │          │
│          │ R4 PROBES                                                      │          │
│          │    (●) All probes in the library, 3 now and any added later    │          │
│          │    ( ) Choose a fixed set   [Choose…]                          │          │
│          │ R5 NOTES (optional)                                            │          │
│          │    [                                                 ]         │          │
│          │ R6                                     [Cancel] [Create session]│          │
│          └──────────────────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────────────────────────┘
```
R4 with "Choose a fixed set" open (the picker expands inside the panel; the panel grows and the overlay scrolls):
```
│          │ R4 PROBES   2 of 3 selected                                    │
│          │    [search…              ]   [All] [None]                      │
│          │    ☑ CRIME (1 of 1)                                            │
│          │      ☑ the-stabbing                                            │
│          │    ☑ MEDICAL (1 of 1)                                          │
│          │      ☑ the-autopsy                                             │
│          │    ☐ ROMANCE (0 of 1)                                          │
│          │      ☐ the-hotel-room                                          │
│          │    A fixed set does not grow when probes are added later.      │
```
### 1024×700 differences
The panel is the same width (512 px) and taller than the viewport once the picker is open; the Dialog overlay scrolls (`overflow-y-auto`, components §18), the footer stays at the bottom of the panel, not pinned, so Tab reaches it after the last field. With the picker closed the panel (about 640 px) still exceeds 700 minus the overlay padding (`py-8`), so the overlay scrolls by about 20 px; nothing is hidden (fixes baseline #9). The two coach Selects stack on two lines.

## 2. Regions

### R1 Title and intro
- Components: Dialog title, intro, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title "New session" | static | n/a | `text-base font-semibold` | Dialog title |
| Intro | static | n/a | "A session is one target model, one optional system prompt, one coach profile and a probe set. Runs stay together." with `Term` on session, target model, system prompt, coach profile, probe set | Dialog intro |

- Actions: none.

### R2 Name, target model, system prompt
- Components: Input, Select (optgroups), Textarea, Readout (warn), Caveat, Term, FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Name | none | n/a | required; max 200 (app.py:145); placeholder "e.g. crime-set-1"; error "Give the session a name." | Input |
| Target model | `GET /api/models` (app.py:1524-1624) | `[].provider, models[].id, models[].name, models[].deprecated, available, hint, local` | one `<optgroup>` per provider labelled "Anthropic", "OpenAI", "Google", "xAI", "Together AI (Llama)", "Ollama (local)"; option text "{name} ({id})"; a `deprecated` model gets " · legacy" and a hint when chosen; an unavailable group's options are disabled and the group label adds " · {hint}" (app.py:1546-1547 "Set OPENAI_API_KEY" / "pip install openai"); Ollama options come from `models[]` (app.py:1613-1623) and the placeholder "No models found" is disabled; default = the first available Anthropic model, else the first available of any group, else none | Select |
| Model hint line | `GET /api/settings/keys` (app.py:2263-2277) and the chosen option's provider | `[].provider, is_set` | "{Provider} key set. Replies are labelled by a keyword scan plus a judge model." when set; warn when not: "No {Provider} key is set. You can create this session, but Send stays disabled until the key is set in Settings › Keys." (link) (runner.py:34-40 for Anthropic; the other targets fail at the provider call); for `ollama:` targets the line reads "Ollama detected at {base_url}" or warns "Ollama is not running at {base_url}." from `GET /api/ollama/status` (app.py:2372-2385) | text / Readout warn |
| Custom model id | none | n/a | text button "Type a model id instead" swaps the Select for an Input with the hint "Flinch picks the provider from the prefix: claude-, gpt-, gemini-, grok-, meta-llama/, ollama:" (runner.py:34-66); unknown prefixes show the error "Flinch does not know which provider serves that id." | Button text + Input |
| System prompt | none | n/a | optional; max 10000 (app.py:149); `rows=3`, auto-grow; hint "Sent to the target model before every probe in this session." | Textarea |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Target model change | none | hint line re-evaluates; a deprecated choice adds "This model is marked legacy by Flinch; it may be withdrawn by the provider." |
| "Type a model id instead" | none | swaps control; "Pick from the list" swaps back |

### R3 Coach
- Components: Select ×2, Select (local model), Readout (warn), InsetBox, Term, FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Backend | `GET /api/settings/coach-default` (app.py:2416-2419) | `backend`, `model` | options "Claude (Anthropic)" = `anthropic`, "OpenAI" = `openai`, "Google" = `google`, "xAI" = `xai`, "Together AI" = `together`, "Local (Ollama)" = `local` (the values the runner reads, runner.py:95-112; llm.py:187-203); prefilled from `backend` | Select |
| Backend hint | `GET /api/settings/keys` | `is_set` of the matching provider (`together` maps to the keys entry `meta`, app.py:2206 and 3320-3327) | "Key set: the coach drafts pushbacks with {provider}'s default model." or warn "No key for {provider}: the coach will not draft pushbacks in this session. You can still write your own." (runner.py:112 raises; runner.py:153-154 swallows it) | text / Readout warn |
| Local model | `GET /api/ollama/status` | `available`, `models[]`, `base_url` | shown only for `local`; Select of model names; prefilled from `coach-default.model`; when `available` is false the Select is disabled with the reason "Ollama is not running at {base_url}." and the warn Readout "A local coach needs Ollama running. Start it, or pick another backend." | Select |
| Local note | static | n/a | "Local models draft slower and less reliably than hosted ones; the moves are the same." (replaces today's amber "experimental" block) | InsetBox row |
| Profile | `GET /api/coach-profiles` (app.py:450-452; db.py:964-975) | `[].name, description, moves[]` | option per profile; default `standard`; under it "{description} · {moves.length} moves" (seed.py:127-130) with `Term` on "moves"; when the list is empty (seed not run) a single disabled option "standard" with the hint "The default profile is created on first run." | Select + text |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Backend change | none | hint and local block re-evaluate |
| Profile change | none | description line updates |

### R4 Probes
- Components: Segmented (All / Choose), Rate, Input (search), Button (All, None), Checkbox, List/Row with groups, Caveat, FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Mode | none | n/a | radio pair: "All probes in the library, {n} now and any added later" (sends no `probe_ids`, app.py:359 stores null, db.py:686-692) and "Choose a fixed set" | Segmented (role radiogroup) |
| Count | `GET /api/probes` (app.py:257-263) | length | "{n} now"; in Choose mode "2 of 3 selected" | Rate (what "selected", caveat none) |
| Search | none | n/a | matches `name` and `prompt_text` | Input |
| All / None | none | n/a | outline sm; act on the visible rows | Button |
| Domain groups | derived | `domain` | checkbox per group with "(1 of 1)" and a per-probe checkbox showing `name`; indeterminate when partly checked | Checkbox + List group |
| Fixed-set note | static | n/a | "A fixed set does not grow when probes are added later." | Caveat note |
| Empty library | length 0 | n/a | "No probes in the library yet. You can create the session now and add probes afterwards." with a text button "Open Library › Probes" (navigates and closes the dialog, keeping the typed fields in memory for this page session) | EmptyState (inside the dialog) |
| None selected error | Choose mode and 0 checked | n/a | "Pick at least one probe, or switch to all probes." (an empty list would be read as "all", app.py:359) | field error |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Mode change | none | Choose expands the picker; All collapses it and clears the error |
| Checkbox | none | count updates; group checkbox follows |

### R5 Notes
- Components: Textarea.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Notes | none | n/a | optional; max 2000 (app.py:148); `rows=2`; hint "For you: what this session is for. Shown on the Sessions list row menu." | Textarea |

- Actions: none.

### R6 Footer
- Components: Button ×2.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Cancel | none | n/a | secondary md | Button |
| Create session | none | n/a | primary md; loading "Creating…"; disabled with reason only while creating (validation runs on press, not on load, so a first-timer sees the form, not a disabled button) | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Create session / Enter (outside a textarea) | validate, then `POST /api/sessions {name, target_model, coach_profile, notes, system_prompt, coach_backend, coach_model (local only), probe_ids (Choose mode only)}` (app.py:144-152, 352-360) → the session (db.py `get_session`) | dialog closes; `#/probe/:id`; toast success "Created crime-set-1 targeting claude-sonnet-4-6." with the warn suffix "Send is disabled until the Anthropic key is set." when the hint warned; the SessionSwitcher shows the new session |
| Cancel / Escape / overlay | none | closes; fields reset; focus returns to the opener |

## 3. States
| State | Trigger | R2 | R3 | R4 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|
| Opening | until `models`, `coach-profiles`, `coach-default`, `settings/keys`, `probes` resolve (`ollama/status` only when needed) | Select shows "Loading models…" disabled | Selects disabled | count "…" | Create enabled (validation waits for data: pressing it shows "Still loading the model list.") | (no Readout in the default state) |
| Default | data loaded, ≥1 key | model preselected; hint "Anthropic key set…" | backend from default; "Key set…"; profile standard | All mode, "3 now" | | (none) |
| Models failed | `GET /api/models` non-2xx or unreachable | the Input "Model id" replaces the Select with the prefix hint | | | | warn "Could not load the model list ({status}). Type a model id; Flinch picks the provider from its prefix." |
| Target provider has no key | chosen option's provider `is_set` false | warn line under the Select with the Settings link | | | Create still enabled | "No OpenAI key is set. You can create this session, but Send stays disabled until the key is set in Settings › Keys." |
| Unavailable group chosen by id | typed id whose provider is unavailable | same warn | | | | (same) |
| Deprecated model | option with `deprecated: true` | note "This model is marked legacy by Flinch; it may be withdrawn by the provider." | | | | (none) |
| Unknown prefix | typed id matches no prefix | field error "Flinch does not know which provider serves that id." | | | Create blocked on press | (none) |
| Coach backend has no key | backend provider `is_set` false | | warn line | | | "No key for Google: the coach will not draft pushbacks in this session. You can still write your own." |
| Local coach, Ollama running | backend `local`, `available` true | | model Select with `models[]`; note | | | (none) |
| Local coach, Ollama offline | `available` false | | model Select disabled with reason; warn | | Create blocked on press with the field error "Pick another backend or start Ollama." | "A local coach needs Ollama running at {base_url}. Start it, or pick another backend." |
| No profiles | `GET /api/coach-profiles` empty | | disabled "standard" with the hint | | | (none) |
| Choose mode | radio | | | picker open, "0 of 3 selected", All / None | | (none) |
| Choose, none selected, Create pressed | validation | | | error "Pick at least one probe, or switch to all probes." | | (none) |
| Choose, filtered empty | search | | | "No probe matches that search." | | (none) |
| Empty library | 0 probes | | | EmptyState inside R4; All mode forced | | (none) |
| Name empty, Create pressed | validation | error under Name, focus moves there | | | | (none) |
| Name too long | > 200 | error "Keep the name under 200 characters." | | | | (none) |
| System prompt too long | > 10000 | error "Keep the system prompt under 10 000 characters." (thin space, tokens §6) | | | | (none) |
| Creating | Create pressed, valid | fields disabled | | | primary loading "Creating…"; Escape ignored | (none) |
| Create error | 422 / 500 | | | | error line `role="alert"` "Could not create the session: {detail}."; fields re-enabled | (none) |
| Created | 200 | | | | closes; navigates | (toast, see R6) |
| No keys at all | every `is_set` false, Ollama off | warn under the model | warn under the backend | | | "No provider key is set. You can set the session up now; Send and the coach wait for a key in Settings › Keys." (one Readout at the top, replacing the two separate warns) |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "3 now" (All mode) | `GET /api/probes`.length | "in the library" in the same sentence | Rate text |
| "2 of 3 selected" | checked ÷ library length | the checkboxes themselves | Rate |
| "(1 of 1)" per domain | checked in the group ÷ group size | the group's rows | text |
| "7 moves" | `coach-profiles[].moves.length` (db.py:964-975) | the profile name and description beside it | text |
| "200 characters" / "10 000 characters" / "2 000 characters" | `Field(max_length=…)` (app.py:145, 148, 149) | the error names the field | field error |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `classifier` | "The label is a keyword scan plus a judge model's guess. You can change it." | the model hint line, shortened to "Replies are labelled by a keyword scan plus a judge model." with the full phrase on the Info hover | classifier.py:48-61 |
| `keyword_only` (proposed) | "With no judge model available, the label is the keyword scan alone." | the no-keys Readout | classifier.py:57-59; llm.py:143-184 |
| `fixed_set` (proposed new id) | "A fixed set does not grow when probes are added later." | the picker | app.py:257-263; db.py:686-692 (the subset is read from `probe_ids` at every list call; no route updates it) |
| `no_coach_key` (proposed new id) | "No key for {provider}: the coach will not draft pushbacks in this session. You can still write your own." | the backend hint | runner.py:112, 153-154 |
| `rate_n`, `held_once`, `product_filter`, `coach_conf` | not in this dialog | | |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| session | title, intro | "one target model, one optional system prompt, one coach profile and a probe set, plus every run made with them" (db.py:31-42) |
| target model | intro, R2 label | "the model the probes are sent to; chosen once per session" (db.py:34; runner.py:32-70) |
| system prompt | intro, R2 label | "text the target model receives before every probe" (db.py:38; runner.py:32-40) |
| coach | R3 eyebrow | "a model that reads a refusal and drafts a pushback with a move; it suggests, you decide" (coach.py:49-78) |
| coach backend | R3 | "which provider's model writes the coach's suggestions; separate from the target" (runner.py:86-112) |
| coach profile | intro, R3 | "the moves and examples the coach draws on" (db.py:76-83) |
| move | R3 profile line | "the kind of question a pushback asks; seven kinds" (coach.py:5-47) |
| probe set | intro, R4 | "the probes this session can send: all of them, or a fixed subset" (db.py:686-692) |
| probe | R4 rows | "a prompt sent to the target model, with a name, a domain and tags" (db.py:18-29) |
| domain | R4 groups | "the probe's category" (db.py:21) |
| judge model | R2 hint | "the model that labels a reply when the keyword scan is unsure" (classifier.py:110-125) |
| Ollama | R2, R3 | "a local model server at `OLLAMA_BASE_URL`" (app.py:2372-2385) |
| legacy | R2 deprecated note | "a model Flinch marks as likely to be withdrawn" (app.py:1538) |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `ns.model` | `[data-tip="ns.model"]` (Target model Select) | title "One model per session"; blurb "Pick the model you are testing. Counts and exports are per session, so one model per session keeps them clean."; why "Comparing models is a Models study, which runs the same probes against several at once." | first open |
| `ns.coach` | `[data-tip="ns.coach"]` (Coach backend Select) | title "The coach is a second model"; blurb "It reads each refusal and drafts a pushback. It can be a different provider from the target, or a local model." | first open, after `ns.model` dismissed |
| `ns.probes` | `[data-tip="ns.probes"]` (Choose radio) | title "All, or a fixed set"; blurb "All means the session sees every probe, including ones you add later. A fixed set stays as it is." | first open, after `ns.coach` dismissed |

Placement audit: the three tips anchor to the right of their control at 1280 (the panel is centred, leaving 384 px each side) and below the control at 1024; none falls back.

## 8. Keyboard and focus
- Shortcuts: Enter submits when focus is in an Input or Select (not a Textarea); Ctrl+Enter submits from a Textarea; Escape cancels (ignored while creating); Tab cycles inside the panel (focus trap).
- Focus order: Name → Target model (or the model id Input) → "Type a model id instead" → System prompt → Coach backend → Local model (when shown) → Profile → All / Choose radios → (picker: search → All → None → group checkboxes and probe checkboxes in order) → Notes → Cancel → Create session. Initial focus: Name. On a validation failure focus moves to the first field with an error. On close focus returns to the opener.
- Live regions: the field errors are linked by `aria-describedby` and `aria-invalid`; the warn Readouts inside the dialog are `role="status"` (polite); the create error line is `role="alert"`; the picker count "2 of 3 selected" is in a polite region.

## 9. Dialogs and overlays opened from here
- None stack on top of it. "Open Library › Probes" (empty library) closes this dialog first. Term tooltips and FirstTimeTips show over the panel (z-[60] and z-[70] above the overlay z-50). Toasts appear after close.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/models` | R2 Target model on open |
| GET | `/api/settings/keys` | R2 and R3 hints on open |
| GET | `/api/ollama/status` | R2 when an `ollama:` target is chosen; R3 when backend is `local` |
| GET | `/api/settings/coach-default` | R3 Backend and Local model prefill on open |
| GET | `/api/coach-profiles` | R3 Profile on open |
| GET | `/api/probes` | R4 count and picker on open |
| POST | `/api/sessions` | R6 Create session |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. Opening the dialog renders `[role="dialog"][aria-modal="true"]` with `aria-labelledby` pointing at the text "New session" and `aria-describedby` at the intro; the element behind it is `inert`; initial focus is on the Name input.
2. The Target model `<select>` has one `<optgroup>` per entry of `GET /api/models` in payload order, labelled "Anthropic", "OpenAI", "Google", "xAI", "Together AI (Llama)", "Ollama (local)"; every option under a group with `available:false` is `disabled` and the group label ends with " · " plus the payload `hint`.
3. The option for a model with `deprecated:true` has text ending " · legacy"; choosing it shows a note containing "marked legacy".
4. With `anthropic` `is_set:false` and a `claude-` model chosen, a `role="status"` element under the Select contains "Send stays disabled until the key is set in Settings › Keys" with an `<a href="#/settings#keys">`; Create is still enabled.
5. Choosing backend "Local (Ollama)" with `GET /api/ollama/status` `available:false` disables the Local model select with a visible reason containing the payload `base_url`; pressing Create shows the error "Pick another backend or start Ollama." and sends no request.
6. The Profile select's options equal the `name` values of `GET /api/coach-profiles`; the line under it contains the chosen profile's `description` and "<moves.length> moves".
7. Pressing Create with an empty Name sends no request, shows "Give the session a name." linked by `aria-describedby`, and moves focus to Name.
8. In "Choose a fixed set" mode with nothing checked, Create shows "Pick at least one probe, or switch to all probes." and sends no request; checking two probes updates the count to "2 of 3 selected"; the domain checkbox for a partly checked group has `indeterminate === true`.
9. Create in All mode posts `/api/sessions` with no `probe_ids` key (or `null`); in Choose mode with two checked it posts `probe_ids` as an array of those two ids; `coach_model` is present only when the backend is `local`.
10. A 200 response closes the dialog, sets `location.hash` to `#/probe/<id>`, and shows a success toast beginning "Created <name> targeting <target_model>."; a 500 keeps the dialog open with a `role="alert"` line containing the response `detail`.
11. Pressing Escape while the primary is `aria-busy="true"` does nothing; pressing it otherwise closes the dialog and returns focus to the control that opened it.
12. Pressing Enter with focus in the System prompt textarea inserts a newline; Ctrl+Enter submits; Enter in the Name input submits.
13. At 1024×700 with the picker open, `document.querySelector('[role="dialog"]').scrollHeight` exceeds the overlay's client height, the overlay is scrollable, and the Create button is reachable by Tab and visible after scrolling.
14. With all five keys unset and Ollama unavailable, exactly one `role="status"` Readout appears at the top of the form beginning "No provider key is set." and no second warn line is rendered under the model or backend selects.
15. Every visible string passes copy-lint; the thin-space number "10 000" is U+2009 separated.

## 12. Open questions for Brad
1. `GET /api/coach-profiles` is never called today and the profile was free text; the seed creates only `standard` (seed.py:127-130). Is a Select with one option acceptable for this release, or should the field stay hidden until a second profile exists?
2. The coach backend value `together` (runner and `get_backend_for_provider`, llm.py:199) and the keys entry `meta` (app.py:2206) name the same key. The dialog maps them; should the API settle on one name?
3. `coach_model` is only used for `local` today (runner.py:97-103 pass it to every backend, but the dialog never set it for hosted ones). Offer a model field for hosted coach backends too, or keep it local-only as today?
4. Three proposed caveat ids: `fixed_set`, `no_coach_key`, and `keyword_only` (shared with Home). Confirm or merge.
