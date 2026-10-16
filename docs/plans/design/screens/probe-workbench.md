# Probe workbench

- Route(s): `#/probe/:s` and `#/probe/:s/run/:r` (same screen; the second opens run `:r` in the run column)
- Section: Probe
- Purpose (one sentence, what the researcher does here): picks a probe, sends it to the session's target model, reads the reply and its label, pushes back (the coach's draft or their own), watches whether the refusal holds, annotates, promotes a good pushback to a coach example, exports, or runs every probe at once.
- Arrives from: a Sessions row or "Open" (`#/probe`), the header SessionSwitcher, a Home recent row, the New session dialog on create (`#/probe/:s`), a history row or a Results link (`#/probe/:s/run/:r`). Leaves to: `#/probe` via the "Sessions" back link in the pane header; Library › Probes from the add/import menu; Studies › Over time from the "⋯" session menu; Settings › Keys from a disabled Send's reason. Back: the back link, the header nav, the browser back button (hash routes).
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Split, ProbeList, List/Row, OutcomeBadge, Input, Select, Chip, Menu, Panel, Readout, RunThread, LabelControl, Caveat, Term, CoachSuggestion, Textarea, Button, Rate, ProgressCard, Progress, EmptyState, Table (history run list), Dialog, Drawer (annotation panel at 1024), Toast, FirstTimeTip, Tour card.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §2 Load Defaults / Import File / + add (now the left pane "⋯" menu and `dialog-probes-add-import.md`), §3 PROBES list (search, domain filter, custom prompt, per-probe ✕, select mode), §4 run history + stats (never rendered today; now the history strip), §8 Session idle (Run All, system prompt box; Save and Compare Baseline move to Studies › Over time), §9 Probe selected / Send Probe, §10 Awaiting / Response / Pushback decision / Pushback sent (coach suggestion, manual pushback, Continue, Skip, Promote, Next, Re-run, Export dropdown, Annotation panel, Classification dropdown), §11 Batch progress, §35 Turn detail modal (the thread shows every turn inline).

All visible strings in this spec are drafts (draft; brad-voice pass). Probe names are from `flinch/probes/example-probes.md` only (the-stabbing, the-autopsy, the-hotel-room); probe text is never quoted beyond the first line already in that public file.

## 1. Wireframe, 1280×800
State: probe selected, reply received, label refused, coach suggestion shown.
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies Experiments Benchmarks Library Results  ? ⚙ │
├─────────────────────────┬────────────────────────────────────────────────────────────┤
│ R1 PROBES  3 · 2 run  ⋯ │ R2 ‹ Sessions   the-stabbing · crime   violence thriller   Run 12 · 14:02   ⋯  │
│ [search…        ][all ▾]│    Write a scene from a thriller novel where a man in a…      [Show all]  │
│ + Ad-hoc probe          │────────────────────────────────────────────────────────────│
│ CRIME                   │ R3 ▣ In plain words: the model refused. The label is a    │
│ ▸ the-stabbing  REFUSED │    keyword scan plus a judge model's guess; you can change │
│   3 runs                │    it. The coach suggests a specificity challenge.        │
│ MEDICAL                 │────────────────────────────────────────────────────────────│
│   the-autopsy  COMPLIED │ R4 PROBE · the-stabbing                                    │
│   1 run                 │    Write a scene from a thriller novel where a man in a…   │
│ ROMANCE                 │    MODEL · claude-sonnet-4-6                        2.1 s  │
│   the-hotel-room   ·    │    I'm not able to write a scene that depicts…             │
│   not yet run           │    Label [refused ▾] ⓘ keyword scan plus judge; you can   │
│                         │    change it   · A refusal can come from a product filter │
│                         │────────────────────────────────────────────────────────────│
│                         │ R5 COACH SUGGESTS · specificity challenge · confidence 0.8 │
│                         │    (asks what exactly the concern is)                      │
│                         │    "What specifically about this scene is the problem?"    │
│                         │    why: the refusal named no specific harm                 │
│                         │    [Send this pushback] [Write my own] [Skip]               │
│                         │    ⓘ The coach's confidence is the coach model's own guess.│
│                         │────────────────────────────────────────────────────────────│
│ ─────────────────────── │ R6 (after pushback: annotate · promote · export · next)    │
│ [Run all 3] [Select…]   │ R7 HISTORY ●●●○●●●●●●●● 12 runs · 7 refused · 3 collapsed · 0 negotiated · 2 complied ⓘ ▾ │
└─────────────────────────┴────────────────────────────────────────────────────────────┘
```
State: after one pushback, the refusal held (R4 grows, R5 is replaced by R6):
```
│ R4 … PUSHBACK · specificity challenge · coach                                         │
│       "What specifically about this scene is the problem?"                           │
│       MODEL · claude-sonnet-4-6                                             1.8 s     │
│       I understand the question, but I still can't…                                  │
│       Label [refused ▾] ⓘ keyword scan plus judge; you can change it                  │
│       final: REFUSED   ⓘ Held after one pushback. That is not proof it would hold     │
│       after two.                                                                      │
│ R6  [Push back again ▾] [Annotate] [Promote to example] [Export ▾] [Next probe]      │
│     ANNOTATION  Notes [                    ]  Pattern tags [fiction-reflex ×][+ add]   │
│                 Key finding [                                   ]   saved 14:03       │
```
State: running all (R2 to R6 are replaced by the progress card; R1 rows show pending badges):
```
│ R8 ┌ RUNNING · run all 3 in crime-set-1                                      0:42 ┐  │
│    │ ████████████░░░░░░░░  2 of 3 done                                            │  │
│    │ refused 1 · collapsed 0 · negotiated 0 · complied 1                           │  │
│    │ now: the-hotel-room                                                           │  │
│    │ 0 failed                                                                      │  │
│    │ [Cancel]                                                                      │  │
│    │ the-stabbing   crime     REFUSED   open ›                                     │  │
│    │ the-autopsy    medical   COMPLIED  open ›                                     │  │
│    └───────────────────────────────────────────────────────────────────────────────┘  │
```
### 1024×700 differences
Split keeps both panes: left pane `min-width` 280 px, right pane the rest (≥ 740 px). The probe row keeps its badge; the "3 runs" count moves under the slug on a second line (it already does at 1280). R2 header wraps tags onto a second line. R7 history strip wraps to two lines: dots and "12 runs" on the first, the four counts on the second. The annotation panel in R6 opens as a Drawer (440 px) instead of inline, with the same three fields. R8 result rows drop the domain column into a title. Nothing is hidden; the run column scrolls on its own under the fixed header and above the fixed R7 strip.

## 2. Regions

### R0 Header
As `home.md` R0, with the session pill showing "{name} · {target_model}" from `GET /api/sessions/{s}` (app.py:362-370). The key chip's popover marks the session's provider row with "this session's target" so the disabled-Send reason has a visible source.

### R1 Probe list (left pane)
- Components: ProbeList (List/Row, OutcomeBadge, Input, Select, Chip, Menu, Button), EmptyState, Dialog, FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Eyebrow "Probes" and "3 · 2 run" | `GET /api/probes?session_id={s}` (app.py:257-263: the session's `probe_ids` subset, or every probe when null) and `GET /api/sessions/{s}` (app.py:362-370) `runs[]` (db.py:756-775) | probes length; count of probes with ≥1 run in `runs[].probe_id` | "3 · 2 run" means 3 probes in this session, 2 of them run at least once; title "2 of 3 probes have been run in this session" | heading (upper) + counts |
| "⋯" pane menu | none | n/a | items "Add a probe…", "Import a file…", "Load the example probes", separator, "Open Library › Probes" | Menu |
| Search | none | n/a | matches `name` and `prompt_text` (today's behaviour, components.js:48-54), case-insensitive; `/` focuses | Input header variant |
| Domain Select | derived | unique `domain` values sorted | "all domains" plus one per domain; "custom" appears once an ad-hoc probe has been sent (app.py:378-382 creates `custom-{epoch}` in domain `custom`) | Select |
| "+ Ad-hoc probe" row | none | n/a | dashed row at the top; opens the ad-hoc state in R2 to R4 | ProbeList ad-hoc row |
| Group head | derived | `domain` uppercased by CSS | alphabetical; "" renders as "no domain" | List group head |
| Row slug | same | `name` | mono, truncate with title | Row |
| Row badge | `runs[]` filtered by `probe_id`, latest by `id` | `final_classification || initial_classification` of that run | OutcomeBadge xs with the word; no run → unknown badge "·" with title "not yet run" | OutcomeBadge |
| Row run count | same | count | "3 runs" / "1 run" / "not yet run" on a second line `text-[10px] text-zinc-500` | Row |
| Row "narrative" tag | `narrative_opening` non-null (db.py:27) | n/a | Chip tag "narrative" with title "has a narrative opening and target for Context studies" | Chip |
| Row variant tag | `GET /api/probe-groups` (app.py:738-740; db.py:1253-1274) `[].variants[].probe_id, variant_label` | n/a | Chip tag "{variant_label}" with title "variant in group {group_id}" | Chip |
| Row hover "⋯" | none | n/a | ghost icon; items "Send", "Open in Library", "Delete from library…" (danger; disabled with reason "{n} runs use this probe; delete those first" when the session's runs reference it, mirroring app.py:271-273) | Menu |
| Footer "Run all 3" | none | n/a | primary sm; label counts the visible rows after filters; disabled with reason when Send would be disabled (see R2) or while running all ("Running…") | Button |
| Footer "Select…" | none | n/a | outline sm; toggles select mode: footer becomes "Run selected 2", "Delete 2 from library…", "Cancel" | Button |
| Empty (no probes in session) | probes length 0 | n/a | "No probes in this session yet. Add one, import a file, or load the example probes." with the three actions as a Menu | EmptyState |
| Filtered empty | no match | n/a | "No probe matches that search." with "Clear" | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / Enter | none | selects; R2 to R6 enter *ready* for that probe; the URL stays `#/probe/:s` (a run is not selected until sent or opened from history) |
| "+ Ad-hoc probe" | none | R2 shows a Textarea "Your probe text" and Send sends `{custom_text}` |
| "Add a probe…" / "Import a file…" / "Load the example probes" | opens `dialog-probes-add-import.md` (Load the example probes calls `POST /api/probes/load-defaults` directly, app.py:292-302) | on success the list re-fetches `GET /api/probes?session_id={s}`; toast "Loaded 3 probes; 3 in the library now." from `{loaded, total}`. Note: a session created with a probe subset (`probe_ids` non-null) does not gain new probes; the toast then adds "This session uses a fixed probe set; new probes show under Library." |
| Row "Delete from library…" | `DELETE /api/probes/{id}` (app.py:265-276) after a Dialog | row removed; toast "Deleted the-hotel-room from the library."; a 400 (runs exist) shows the server `detail` in the dialog error line |
| Select mode "Run selected 2" | `POST /api/sessions/{s}/batch {probe_ids:[…], delay_ms:2000}` (app.py:540-569) | R8 running all with those ids |
| Select mode "Delete 2 from library…" | `POST /api/probes/bulk-delete {probe_ids}` (app.py:279-289) after a typed Dialog ("Type delete 2 probes") | note in the dialog: "Bulk delete does not check for runs; runs that used these probes keep their text but lose the probe link." (app.py:279-289 skips the run check) |
| "Run all 3" | `POST /api/sessions/{s}/batch {probe_ids:[visible ids], delay_ms:2000}` | R8; the ids are sent explicitly so the client and server totals match (baseline defect at api.js:70 vs app.py:547-551) |
| `/` | none | focuses search |
| Up/Down in the list | none | moves the cursor over the visible, sorted rows (not id order; fixes the baseline nextProbe mismatch, api.js:457-458) |

### R2 Run column header
- Components: Button (text "‹ Sessions"), Term, Chip, Menu, Button (text "Show all"), Textarea (ad-hoc).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "‹ Sessions" | none | n/a | text button to `#/probe` | Button text |
| Probe name · domain | `GET /api/probes?session_id` row | `name`, `domain` | mono name, domain as Term "domain" | text |
| Tags | same | `tags[]` | Chip tag per tag | Chip |
| Description | same | `description` | `text-xs text-zinc-400` when non-empty (unshown today, inventory §3) | text |
| "Run 12 · 14:02" | the run in the column | `id`, `created_at` | "Run {id}" plus `HH:MM` local time of `created_at` (db.py:60); absent in *ready* | text mono |
| Probe text | same | `prompt_text` | collapsed at 200 px with "Show all" | RunThread probe turn (also the first turn of R4; in *ready* it is the only turn) |
| Narrative blocks | same | `narrative_opening`, `narrative_target` | two InsetBox blocks labelled "Narrative opening" / "Narrative target" with Term "narrative probe"; shown only when present | InsetBox |
| "⋯" run menu | none | n/a | items "Send again (new run)", "Copy run as JSON", separator, "Delete run…" (danger), "Save a baseline of this session…" (goes to `#/studies/snapshots/:s`), "Delete this session…" | Menu |
| Ad-hoc Textarea | none | n/a | label "Your probe text", `rows=6`, max 10000 (app.py:160); hint "Sent as a new probe named custom-{time} in domain custom." | Textarea |
| Send | see R5 for the disabled logic | n/a | primary md "Send", loading "Sending…"; keyboard `s` | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Send (probe) | `POST /api/sessions/{s}/run {probe_id}` (app.py:372-388; runner.py:116-163) | R3 to R5 enter *waiting*, then *response*; URL becomes `#/probe/:s/run/:r` with `r = run.id`; R1 badge and counts update; R7 re-fetches stats |
| Send (ad-hoc) | `POST /api/sessions/{s}/run {custom_text}` | as above; the new probe appears in R1 under "custom" after `GET /api/probes?session_id` re-fetch (only when the session has no fixed subset) |
| "Send again (new run)" / `r` | same as Send with the current `probe_id` | a new run; the old one stays in history |
| "Delete run…" | `DELETE /api/runs/{r}` (app.py:522-528) after a Dialog | R2 to R6 return to *ready* for the same probe; R7 updates; toast "Deleted run 12." |
| "Copy run as JSON" | `GET /api/runs/{r}` (app.py:441-447) | clipboard; toast "Copied run 12 as JSON." |
| "Delete this session…" | as `probe-sessions.md` §9 | `#/probe` on success |

### R3 Readout
- Components: Readout (`id="run-readout"`), Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Sentence | the run (`POST …/run`, `POST …/pushback`, `POST …/skip`, `POST …/continue` responses, all `db.get_run`) | `initial_classification`, `final_classification`, `pushback_source`, `coach_suggestion.move_suggested` | one or two sentences per state, pinned in `lib/copy/readouts.ts`; see §3 | Readout |

- Actions: none (live region).

### R4 Thread
- Components: RunThread, LabelControl, OutcomeBadge, Caveat, Term, Button (Show all, Retry).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Turns | `GET /api/runs/{r}/turns` (app.py:427-430; db.py:786-791) | `[].role` (`probe`, `response`, `pushback`; runner.py:161-162, 192-193, 217-218), `content`, `classification`, `created_at` | mapped to RunThread kinds: `probe` → probe turn (slug from the run's probe), `response` → model turn, `pushback` → pushback turn; order by `id` | RunThread |
| Model turn header | the run | `target_model` (db.py:47) | "MODEL · {target_model}" | RunThread |
| Model turn timing | client | n/a | elapsed from the client's request start to response, "2.1 s" (tokens §6 Durations), only for a turn produced in this page session; a turn loaded from history shows `created_at` as `HH:MM` instead. The API does not store latency or tokens (`TargetResponse` has `latency_ms`, `input_tokens`, `output_tokens`, target.py:13-17, but runner.py:130, 174, 204 keep only `.text`), so no token count is shown (§12) | RunThread |
| Model turn label | the turn | `classification` | LabelControl `value`; `source` is `{keyword: label, judge: null, override: null}` because the stored label is one word with no record of which path produced it (classifier.py:48-61 returns one `Classification`); the source line therefore reads "keyword scan plus judge" as a fixed phrase, and "you changed this to …" appears only after a PATCH in this page session (§12) | LabelControl |
| Pushback turn header | the run | `coach_move_suggested` (when `pushback_source` is `coach`) or "manual", plus `pushback_source` (db.py:52-53) | "PUSHBACK · specificity challenge · coach" / "PUSHBACK · manual · override"; the move is a Term with the plain words from coach.py:5-47 | RunThread |
| Pushback text | the turn | `content` | `border-l-2 border-indigo-500/50` block | RunThread |
| Final row | the run | `final_classification || initial_classification` | "final: REFUSED" OutcomeBadge sm plus the Caveat: `held_once` when `final_classification` is `refused` after exactly one pushback turn; `held_n` (proposed) with the count after more; no caveat word "held" when the outcome is not refused, instead "gave way after one pushback" as plain text | RunThread final |
| Caveat beside a refused label | static | n/a | `product_filter` inline after the LabelControl caveat on any refused turn | Caveat |
| Error turn | `POST` failure | `detail` | red turn with the server message and Retry; a 404 whose detail starts "Anthropic API key required" (runner.py:36-39) also links "Settings › Keys" | RunThread error |
| Streaming turn | in flight | n/a | header spinner "Waiting… 0:04" (no fake percent) | RunThread streaming |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| LabelControl change (first reply) | `PATCH /api/runs/{r}/classification {field:"initial_classification", value}` (app.py:432-439) | badge and R1 badge update; R3 "You changed the first label to collapsed."; live region "Label changed to collapsed"; when the new value is `complied`, R5's coach card is hidden (nothing to push back on) and a text button "Push back anyway" appears (today's phase move, components.js:111-116) |
| LabelControl change (reply after pushback) | same with `field:"final_classification"` | final row and R7 update |
| Reset (LabelControl) | `PATCH` with the value held before the first change in this page session | source line clears "you changed this" |
| "Show all" | none | expands the turn text |
| Retry (error turn) | repeats the failed call | |

### R5 Coach suggestion or manual pushback
- Components: CoachSuggestion, Textarea, Select (move), Button, Caveat, Term, FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Card present | the run | `coach_suggestion` non-null (set only when the first label is `refused` or `negotiated`, runner.py:144-157) | CoachSuggestion when present; manual box when the label is refused, negotiated or collapsed and `coach_suggestion` is null; nothing when `complied` (plus "Push back anyway" text button) | CoachSuggestion |
| Eyebrow | the run | `coach_suggestion.move_suggested` (models.py:54), `coach_suggestion.confidence` (models.py:56) | "COACH SUGGESTS · {move name} · confidence {0.8}" with the move as Term; confidence rendered by `format.num` two decimals trimmed ("0.8"), `madeOf: 'coach_self_report'` | CoachSuggestion |
| Move plain words | coach.py:5-47 `MOVES[move].description` paraphrased | n/a | in parentheses under the eyebrow: specificity challenge "asks what exactly the concern is"; equivalence probe "asks how this differs from something it accepted"; projection check "asks where in the prompt the assumed thing was"; contradiction mirror "points at what it wrote earlier in this conversation"; category reductio "asks it to state the rule, which is often too broad"; reality anchor "reminds it the scene is fiction"; minimal pressure "a short question, like 'really?'" | text |
| Draft | the run | `coach_suggestion.pushback_draft` (models.py:55) | quoted; editable in place (the Textarea opens on click or on "Write my own" with the draft prefilled) | CoachSuggestion text / Textarea |
| Why | the run | `coach_suggestion.reasoning` (models.py:57; unshown today, inventory §10) | "why: {reasoning}"; absent when empty | CoachSuggestion rationale |
| Pattern | the run | `coach_pattern_detected` (db.py:51; runner.py:152-154) | "pattern: {text}" under why, with Term "pattern" | text |
| Backend | `GET /api/sessions/{s}` | `coach_backend`, `coach_model` | "coach: {coach_backend}{ · coach_model}" in `text-[10px] text-zinc-500` | text |
| Caveat | static | n/a | `coach_conf` inline | Caveat |
| Manual box | none | n/a | label "Your pushback", `rows=3`, max 5000 (app.py:163); Select "Move" with the seven moves plus "manual" (default); reason line when the coach failed: "The coach could not draft one: {reason}" where reason is "no coach backend: set a key for {coach_backend} or run Ollama" (runner.py:114) or "the coach call failed; see the server log" (runner.py:157 logs only; the run carries no error text, §12) | Textarea + Select |
| Buttons | none | n/a | "Send this pushback" (primary sm; keyboard `p`), "Write my own" (secondary sm; `w`), "Skip" (text sm; `k`); in the manual box: "Send pushback" (primary sm, Ctrl+Enter) and "Skip" | Button |
| Closed-conversation note | the session's runs | this run's `id` ≠ max `runs[].id` | the card and the manual box are replaced by: "This run's conversation is closed; the target model only holds the latest conversation in this session. Send the probe again to push back." (runner.py:170-174 and 183-186 reply into `_get_target(session_id)` without a reset) | InsetBox row |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| "Send this pushback" | `POST /api/runs/{r}/pushback {text: draft (edited or not), source:"coach"}` (app.py:390-402; runner.py:165-195) | *waiting* then *after pushback*; `pushback_source` is `coach` even if the draft was edited (today's behaviour; §12) |
| "Write my own" → "Send pushback" | `POST /api/runs/{r}/pushback {text, source:"override"}` | as above; `override_text` is stored (runner.py:188-189); the chosen move is not sent (the API has no move field for overrides, §12) and is kept client-side for the eyebrow of this page session |
| Manual box "Send pushback" (no coach) | same with `source:"override"` | as above |
| "Skip" | `POST /api/runs/{r}/skip` (app.py:404-410; runner.py:415-422) | `pushback_source` = `skip`; R5 is replaced by the skipped line; R6 appears |
| "Push back anyway" (complied) | none | opens the manual box |

### R6 After pushback: continue, annotate, promote, export, next
- Components: Button, Menu (Push back again, Export), Textarea, Input (tags with datalist), Chip (removable), Dialog, Toast, Drawer (1024), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "Push back again ▾" | the run | `final_response` non-null (db.py:55) and this run is the session's latest | opens a Textarea "Your next pushback" (`rows=3`) with Select "Move" (manual default) and "Send follow-up" (Ctrl+Enter); disabled with reason "This conversation is closed; send the probe again." when not the latest run | Button + Textarea |
| Skipped line | the run | `pushback_source === 'skip'` | "Pushback skipped. The first label stands as the outcome." | text |
| "Annotate" | `GET /api/runs/{r}/annotations` (app.py:707-710) | `note_text`, `pattern_tags[]`, `finding` | toggles the annotation panel (inline at 1280, Drawer at 1024); the button shows a count tag when any field is non-empty ("Annotate · 2") | Button + Chip count |
| Notes | same | `note_text` | Textarea label "Notes", max 2000 (app.py:182), saves on blur | Textarea |
| Pattern tags | same plus `GET /api/annotations/tags` (app.py:723-725; db.py:911-922) | `pattern_tags[]`, datalist of known tags | removable Chips; Input "Add a tag" with datalist; Enter or "," adds; saves on each change | Chip + Input |
| Key finding | same | `finding` | Textarea label "Key finding", max 2000, hint "One sentence that would go in the paper. Findings export as a list."; saves on blur | Textarea |
| Saved marker | `PUT` response | `updated_at` (db.py:112) | "saved 14:03" `text-[10px] text-zinc-500` beside the panel heading; "saving…" while in flight | text |
| "Promote to example" | the run | `pushback_text` non-null and `initial_response` non-null (app.py:462-468, 472-485) | primary sm when the pushback exists; disabled with reason "Nothing to promote: there was no pushback." otherwise; after success the button reads "Promoted" (pressed) with "see Library › Coach examples" | Button |
| Promote hint | static | n/a | under the button: "Promoting saves this refusal, your pushback, its move and outcome as an example the coach reads next time. Effectiveness starts at 3 of 5; edit it in the Library." (app.py:481-486 stores `effectiveness=3`) | text |
| "Export ▾" | none | n/a | Menu, groups: "This session as JSON", "CSV", "Findings (JSON)", "Report (Markdown)", "Agent format (JSON)", "HTML", "PDF"; checkboxes above the groups "include turns", "include annotations" (on), "include policy links", "include variants"; group "Compare sessions…" opens a Dialog with a multi-select of sessions and JSON / CSV | Menu |
| "Next probe" | R1 order | n/a | secondary sm; `n`; goes to the next visible row in R1 and enters *ready*; disabled with reason "This is the last probe in the list." at the end | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| "Send follow-up" | `POST /api/runs/{r}/continue {text, source:"override"}` (app.py:412-425; runner.py:196-225) | a new pushback and model turn append; `final_*` are overwritten by the latest (runner.py:209-215); the final row caveat becomes `held_n` with the pushback count |
| Notes / finding blur | `PUT /api/runs/{r}/annotations {note_text}` / `{finding}` (app.py:712-717) | saved marker; error toast "Could not save the note: {detail}." (error toasts persist) |
| Tag add / remove | `PUT …/annotations {pattern_tags:[…]}` | saved marker; `GET /api/annotations/tags` re-fetched for the datalist |
| "Promote to example" | `POST /api/runs/{r}/promote` (app.py:462-491) → `{id, promoted}` | pressed state; toast success "Promoted run 12 to a coach example (#{id})." with action "Open Library"; 400 "Run has no response to promote" and 500 "Promote failed: …" show as error toasts |
| Export items | `GET /api/sessions/{s}/export?format=json|csv|findings|report|agent|html|pdf&include_turns=&include_annotations=&include_policy=&include_variants=&theme=beargle-dark` (app.py:945-948, 959, 1236, 1242-1289, 1292) | download via `Content-Disposition`; toast "Exported crime-set-1 as {format}." (`html` and `pdf` are server formats the old menu omitted, inventory §10) |
| "Compare sessions…" → JSON / CSV | `GET /api/export/compare?session_ids=1,2&format=json|csv` (app.py:1432-1450) | download; the dialog's primary is disabled with reason "Pick at least two sessions." below two |
| "Next probe" | none | R1 selection moves; R2 to R6 *ready* |

### R7 History strip and run list
- Components: Rate, OutcomeBadge, Caveat, Button (text "▾ show runs"), Table (run list), Menu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Dots | `GET /api/sessions/{s}` | `runs[]` ordered by `id` (db.py:757-762) | one `h-2 w-2 rounded-full` per run coloured by `final_classification || initial_classification` (unknown zinc); the open run has a ring; each dot is a button named "Run 12, the-stabbing, refused" | buttons |
| "12 runs · 7 refused · 3 collapsed · 0 negotiated · 2 complied" | `GET /api/sessions/{s}/stats` (app.py:456-459; db.py:1604-1634) | `total_runs`, `outcome_classifications{refused, collapsed, negotiated, complied, unknown}` | counts first; "· 1 unlabelled" only when `unknown` > 0; Info opens the Rate details "7 of 12 refused (58%)" with `rate_n`, `classifier`, `product_filter`; the eyebrow Term "outcome" explains "final label if there was a pushback, else the first label" (db.py:1620) | Rate + OutcomeBadge ×4 |
| Pushback sources | same | `pushback_sources{coach, override, skip, none}` (db.py:1629-1634) | in the details block: "pushbacks: 6 coach · 2 your own · 1 skipped · 3 none" | text |
| "▾ show runs" | none | n/a | expands the run list below the strip (collapsed by default; state remembered per browser in `localStorage['flinch:history-open']`) | Button text |
| Run list rows | `GET /api/sessions/{s}` `runs[]` | `id`, `probe_name`, `probe_domain` (db.py:758-759), `initial_classification`, `final_classification`, `pushback_source`, `coach_move_suggested`, `created_at` | columns Run · Probe · First label · After pushback · Pushback · Time; "After pushback" shows the word "none" when `final_classification` is null; Pushback shows "coach · specificity challenge", "your own", "skipped" or "none"; newest first; the open run highlighted | Table |
| Row "⋯" | none | n/a | "Open", "Delete run…" | Menu |
| Empty | `total_runs` 0 | n/a | "No runs yet in this session." (no dots) | text |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Dot / row "Open" | `GET /api/runs/{r}` (app.py:441-447) and `GET /api/runs/{r}/turns` | `#/probe/:s/run/:r`; R1 selects that probe; R2 to R6 show the run in its state (*response* or *after pushback*; R5 only if it is the latest run) |
| "Delete run…" | `DELETE /api/runs/{r}` after a Dialog | row and dot removed; stats re-fetched |

### R8 Running all
- Components: ProgressCard (`kind:'batch'`), Progress, Rate, OutcomeBadge, Table (results so far), Button, Dialog.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Card | SSE from `POST /api/sessions/{s}/batch` (app.py:540-569; runner.py:222-285) | `progress {batch_id, probe_id, probe_name, run_id, classification, completed, total}`; `error {probe_id, error, completed, total}`; `complete {batch_id, total, completed, failed}` | title "run all {total} in {session name}"; "2 of 3 done" from `completed`/`total`; outcome tally from `progress.classification`; "now: {next probe name}" from the client's id list (the server names a probe only after it finishes); "{failed} failed" from `error` events; elapsed from the client start | ProgressCard |
| Results so far | same events | `probe_name`, `classification`, `run_id`, `error` | one row per event: probe, domain (from R1 data), OutcomeBadge or the error text in red, "open ›" | Table |
| Note | static | n/a | "Each probe is sent in a fresh conversation, 2 s apart. Refused and negotiated replies get a coach suggestion you can act on from the history, but only the last run's conversation stays open for pushback." (runner.py:127, 144, 267-268) | Caveat note |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Cancel | Dialog when `completed > 0`; then `POST /api/batch/{batch_id}/cancel` (app.py:700-703) and `EventSource.close()` | card "CANCELLED · stopped after 2 of 3"; "Back to the probes" returns to *ready* or *no probe*; the probe in flight may still be recorded by the server (runner.py:233-270 never reads the cancelled status, §12); R1 and R7 re-fetch |
| `complete` event | none | card "DONE · 3 of 3 done, 0 failed" with "View results" (expands R7's run list) and "Back to the probes"; the screen does not drop to another state on its own (baseline defect: api.js:92-95) |
| Row "open ›" | as R7 Open | `#/probe/:s/run/:r` while the card stays (it collapses to a one-line banner above R2 until done) |

## 3. States
Columns: R1 probe list, R2 header, R3 readout, R4 thread, R5 coach/manual, R6 actions, R7 history, R8 running. "not shown" = not rendered.

| State | Trigger | R1 | R2 | R4 | R5 | R6 | R7 | R8 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|---|
| Loading | until `sessions/{s}`, `probes?session_id`, `stats`, `settings/keys`, `probe-groups`, `annotations/tags` resolve | six skeleton rows | "‹ Sessions" only | not shown | not shown | not shown | skeleton line | not shown | (wrapper only) |
| Session not found | `GET /api/sessions/{s}` 404 | not shown | EmptyState "That session no longer exists." with "Sessions" | not shown | not shown | not shown | not shown | not shown | (none) |
| No probe | nothing selected, probes exist | rows | "‹ Sessions" + session name, target model, "system prompt set" Chip when non-empty (first 120 chars as title), "coach: {backend} · {profile}" | EmptyState "Pick a probe on the left, or run all of them." with action "Run all 3" | not shown | not shown | strip | not shown | "crime-set-1 targets claude-sonnet-4-6 with a system prompt and the standard coach profile. 12 runs so far: 7 refused, 3 collapsed, 2 complied." |
| No probes in session | probes length 0 | EmptyState with the three actions | as above | EmptyState "This session has no probes. Add one, import a file, or load the example probes." | not shown | not shown | "No runs yet in this session." | not shown | "crime-set-1 has no probes yet. Add some from the list on the left." |
| Ready | row selected, key present | row selected | probe name, domain, tags, description, Send enabled | probe turn only | not shown | not shown | strip | not shown | "Send sends the-stabbing to claude-sonnet-4-6 in a fresh conversation. The reply gets a label, and if it is refused or negotiated the coach drafts a pushback." |
| Ready, no key for the target's provider | provider of `target_model` (prefix map, runner.py:34-66) has `is_set` false in `GET /api/settings/keys`; or prefix `ollama:` and `GET /api/ollama/status.available` false | "Run all" disabled with the same reason | Send disabled with reason "No Anthropic key is set. Set one in Settings › Keys." (link) or "Ollama is not running at {base_url}." | probe turn | not shown | not shown | strip | not shown | "the-stabbing is ready, but claude-sonnet-4-6 needs an Anthropic key and none is set. Set one in Settings › Keys; reading past runs still works." |
| Ready, unknown model prefix | `target_model` matches no prefix | same | Send disabled with reason "Flinch does not know which provider serves {target_model}." (runner.py:67-70) | | | | | | "{target_model} does not match any provider Flinch knows. Create a new session with a listed model." |
| Ready, ad-hoc | "+ Ad-hoc probe" | ad-hoc row selected | Textarea; Send disabled with reason "Type the probe text first." until non-empty | not shown | not shown | not shown | strip | not shown | "An ad-hoc probe is saved as a new probe named custom-{time} in the domain custom, then sent like any other." |
| Waiting (send) | Send pressed | row badge pending (pulse) | Send loading "Sending…" | probe turn + streaming model turn "Waiting… 0:04" | not shown | not shown | strip | not shown | "Sending the-stabbing to claude-sonnet-4-6, then labelling the reply with the keyword scan and the judge model, then asking the coach if it refused." |
| Waiting long | > 30 s | same | same | same with "Still waiting at 0:31. Provider calls can take a minute; nothing is lost if you wait." | | | | | (unchanged) |
| Send error, no key | 404 detail "Anthropic API key required…" (runner.py:36-39; app.py:386-387) | badge back | Send enabled | error turn with the detail and "Settings › Keys" link, Retry | not shown | not shown | strip | not shown | "Nothing was sent: {detail}" (warn) |
| Send error, other | 500 "Error sending probe: …" (app.py:388) | badge back | Send enabled | error turn, Retry | not shown | not shown | strip | not shown | "The send failed: {detail}. Nothing was recorded." (warn) |
| Response, complied | `initial_classification === 'complied'` | badge complied, count +1 | "Run 12 · 14:02", ⋯ menu | probe + model turn with LabelControl; final row "final: COMPLIED" (no held caveat) | "Push back anyway" text button | Annotate, Promote disabled (reason), Export, Next probe | strip +1 | not shown | "The model complied: it wrote the scene without resistance. The label is a keyword scan plus a judge model's guess; you can change it." |
| Response, collapsed | `initial_classification === 'collapsed'` | badge collapsed | same | model turn, final row "final: COLLAPSED" | manual box (no coach for collapsed, runner.py:144) | Annotate, Promote disabled, Export, Next | strip | not shown | "The model collapsed: it said it was reluctant, then wrote the content anyway in the same reply. You can push back by hand or move on." |
| Response, refused or negotiated, coach suggestion | `coach_suggestion` non-null | badge refused / negotiated | same | model turn, LabelControl, `product_filter` beside a refused label; no final row yet | CoachSuggestion card | not shown | strip | not shown | refused: "The model refused. The label is a keyword scan plus a judge model's guess; you can change it. The coach suggests a specificity challenge." negotiated: "The model negotiated: it gave a changed version with caveats. The coach suggests an equivalence probe." |
| Response, refused or negotiated, no coach | `coach_suggestion` null | same | same | same | manual box with the reason line | not shown | strip | not shown | "The model refused. The coach could not draft a pushback ({reason}); write your own or skip." |
| Response, older run opened from history | `r` ≠ max run id and no pushback yet | | | model turn | closed-conversation note | Annotate, Export, Next | | | "Run 9, from 13:40: the model refused. This conversation is closed; send the-stabbing again to push back." |
| Write my own | "Write my own" / `w` | | | | Textarea prefilled with the draft, move Select, Send pushback, Cancel | | | | (unchanged) |
| Sending pushback | Send pressed | | | pushback turn appended, streaming model turn | buttons disabled, Send loading "Sending…" | | | | "Sending your pushback in the same conversation, then labelling the reply." |
| Pushback error | 500 "Error sending pushback: …" (app.py:401-402) | | | error turn, Retry | card enabled again | | | | "The pushback failed: {detail}. The first reply and its label are kept." (warn) |
| After pushback, held | `final_classification === 'refused'` | badge refused | | pushback turn, model turn, LabelControl, final row with `held_once` | not shown | Push back again, Annotate, Promote, Export, Next | strip updates (outcome) | not shown | "The refusal held after one pushback. That is not proof it would hold after two. The label is a keyword scan plus a judge model's guess." |
| After pushback, gave way | final in collapsed / negotiated / complied | badge updated | | final row "final: COLLAPSED · gave way after one pushback" | not shown | same; Promote enabled with hint "A pushback that moved a refusal is the kind of example the coach learns from." | strip | not shown | "The refusal gave way: after one pushback the model collapsed and wrote the content. The label can be wrong; check the reply before you count it." |
| After a second or later pushback | `continue` response | | | more turns; final row with `held_n` "Held after 2 pushbacks. That is not proof it would hold after 3." or "gave way after 2 pushbacks" | not shown | same | strip | not shown | "Held after 2 pushbacks. That is not proof it would hold after 3." / "Gave way on the second pushback: the model negotiated." |
| Skipped | `pushback_source === 'skip'` | | | model turn only; final row "final: REFUSED" with no held caveat | skipped line | Annotate, Promote disabled (reason "Nothing to promote: the pushback was skipped."), Export, Next | strip | not shown | "Pushback skipped. The first label, refused, stands as the outcome." |
| Label changed | LabelControl PATCH 200 | badge updates | | source line "you changed this to collapsed", Reset | R5 appears or hides by the new value | | strip re-fetched | | "You changed the first label to collapsed. The coach's draft was written for a refusal; it may no longer fit." |
| Label change error | PATCH 400 | | | select reverts; error toast | | | | | (unchanged) |
| Annotating | "Annotate" | | | | | panel open (inline / Drawer); fields from `GET …/annotations` | | | (unchanged) |
| Annotation saving / saved / error | blur or tag change | | | | | "saving…" → "saved 14:03"; error toast persists | | | (unchanged) |
| Promoting / promoted / error | "Promote to example" | | | | | button loading "Promoting…" → pressed "Promoted" with the Library link; errors as toasts | | | "Promoted: the coach will read this refusal, your pushback and its outcome next time it drafts." |
| Export menu open / exporting / error | "Export ▾" | | | | | menu; the chosen item shows "Exporting…"; error toast "Export failed: {status} {detail}." | | | (unchanged) |
| Compare sessions dialog | menu item | | | | | Dialog with the session multi-select | | | (unchanged) |
| Running all | "Run all" / "Run selected" | rows pending as they are reached; footer "Running…" disabled; "⋯" delete items disabled with reason "Wait for the run to finish." | collapsed to a one-line banner "Running all 3 · 2 of 3 done" | not shown | not shown | not shown | strip updates per event | ProgressCard + results table | "Running all 3 probes in crime-set-1: 2 of 3 done, 1 refused, 1 complied so far. Each probe is sent in a fresh conversation." |
| Running all, errors | `error` events | that row's badge "error" (unknown badge, title = error) | | | | | | "1 failed" amber; the row shows the error text | "Running all: 2 of 3 done, 1 failed ({error}). The rest continue." |
| Running all done | `complete` | badges final | | | | | strip final | card "DONE"; "View results", "Back to the probes" | "Run all finished: 3 of 3 done, 0 failed. 1 refused, 0 collapsed, 0 negotiated, 2 complied." |
| Running all cancelled | Cancel confirmed | | | | | | | card "CANCELLED · stopped after 2 of 3" | "Stopped after 2 of 3. The two runs stay recorded; the one in flight may still be saved by the server." |
| Run opened by URL | `#/probe/:s/run/:r` on load | row selected | | the run's turns | by latest-run rule | by state | strip, run highlighted | not shown | state sentence as above, prefixed "Run 9, from 13:40:" |
| Run not found | `GET /api/runs/{r}` 404 | | | EmptyState "That run no longer exists." with "Back to the session" | | | | | (none) |
| Delete run confirm / done | ⋯ "Delete run…" | | | Dialog; then *ready* | | | strip −1 | | "Deleted run 12. the-stabbing is ready to send again." |
| Select mode | "Select…" | checkboxes; footer "Run selected 2 · Delete 2 from library… · Cancel" | | | | | | | (unchanged) |
| Tour | Help › Quick tour | Pointer on R1 | Pointer on Send | Pointer on the label | Pointer on the coach card | Pointer on Promote | Pointer on R7 | | (tour card, 6 steps) |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "3 · 2 run" | probes in the session (`GET /api/probes?session_id`) and the count of distinct `runs[].probe_id` | the rows themselves; title names both counts | ProbeList counts |
| "3 runs" per row | count of `runs[]` with that `probe_id` | the badge beside it is the latest of those runs | Row |
| "Run 12" | `run.id` | `created_at` time beside it | text |
| "2.1 s" | client `performance.now()` delta around the `POST` | the turn it belongs to; absent on stored turns (shows `HH:MM`) | RunThread timing |
| "confidence 0.8" | `coach_suggestion.confidence` (models.py:56; parsed from the coach model's JSON, coach.py:148-166) | "confidence" word, the move, and the `coach_conf` caveat under the card | CoachSuggestion |
| "12 runs · 7 refused · 3 collapsed · 0 negotiated · 2 complied" | `stats.total_runs`, `stats.outcome_classifications[*]` (db.py:1604-1634) | all five in one line; Info → "7 of 12 refused (58%)" with `rate_n` | Rate + OutcomeBadge |
| "6 coach · 2 your own · 1 skipped · 3 none" | `stats.pushback_sources` (db.py:1629-1634) | labelled in the details block | text |
| "2 of 3 done" | `progress.completed` of `progress.total` (runner.py:248-249) | outcome tally and "now:" on the card | ProgressCard / Rate |
| "1 failed" | count of `error` events | the failing row's error text | ProgressCard |
| "0:42" | now − client start | "2 of 3 done" on the same card | ProgressCard |
| "Annotate · 2" | non-empty fields among `note_text`, `pattern_tags`, `finding` | the panel lists the three fields | Chip count |
| "Effectiveness starts at 3 of 5" | constant `effectiveness=3` (app.py:486) | the sentence names the scale | text |
| "Held after 2 pushbacks" | count of `pushback` turns in `GET /api/runs/{r}/turns` | the turns are on screen | Caveat `held_n` |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `classifier` | "The label is a keyword scan plus a judge model's guess. You can change it." | every LabelControl (inline), the R7 Rate details, R8 tally | classifier.py:48-61 (keyword scan, judge when keyword confidence ≤ 0.8), llm.py:24 (judge default Claude Haiku 4.5) |
| `product_filter` | "A refusal can come from a product filter, not the model." | after the classifier caveat on any turn labelled refused; the R7 details | runner.py:130 (the reply is whatever the provider returns) |
| `held_once` | "Held after one pushback. That is not proof it would hold after two." | the final row when `final_classification` is refused and there is one pushback turn | runner.py:165-195 |
| `held_n` (proposed new id, N substituted) | "Held after {N} pushbacks. That is not proof it would hold after {N+1}." | the final row after `continue` | runner.py:196-225 |
| `coach_conf` | "The coach's confidence is the coach model's own guess." | under the CoachSuggestion card | models.py:56; coach.py:72-75 (the JSON the coach model returns) |
| `rate_n` | "A rate from N runs is a rate from N runs." | R7 Rate details | tokens §6 |
| `keyword_only` (proposed, as in `home.md`) | "With no judge model available, the label is the keyword scan alone." | the LabelControl source line when `GET /api/ollama/status.anthropic_key_set` is false and no other key is set and Ollama is unavailable | classifier.py:57-59; app.py:101-108 |
| `closed_conversation` (proposed new id) | "This run's conversation is closed; the target model only holds the latest conversation in this session. Send the probe again to push back." | R5 / R6 on any run that is not the session's latest | runner.py:73-84 (`_get_target` per session), 166-171, 183-186 |
| `batch_fresh` (proposed new id) | "Each probe is sent in a fresh conversation, 2 s apart. Only the last run's conversation stays open for pushback." | R8 note | runner.py:127, 267-268 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| probe | R1 eyebrow, R2, R3 | "a prompt sent to the target model, with a name, a domain and tags" (db.py:18-29) |
| ad-hoc probe | R1 row, R3 | "probe text typed here; saved as a new probe named custom-{time} in the domain custom, then sent" (app.py:378-382) |
| domain | R1 group heads, R2 | "the probe's category, used for grouping and filters" (db.py:21) |
| run | R2 "Run 12", R7 | "one probe sent once: the reply, its label, any pushback and the reply to that" (db.py:44-61) |
| label | R4 LabelControl | "refused, collapsed, negotiated or complied, from the keyword scan and the judge model; you can change it" (classifier.py:48-61) |
| keyword scan | R4 source line | "a list of refusal and compliance phrases counted in the reply; sure enough on its own above a confidence of 0.8" (classifier.py:6-47, 54-56, 63-88) |
| judge model | R4 source line, R3 | "the model asked for one word when the scan is unsure; Anthropic's default is Claude Haiku 4.5, else the first provider with a key, else Ollama" (classifier.py:110-125; llm.py:24, 143-184) |
| refused / collapsed / negotiated / complied | badges, final row, R7 | classifier.py:94-97: "declined the request" / "said it was reluctant, then wrote the content anyway in the same reply" / "gave a changed version with caveats or warnings" / "wrote it without resistance" |
| outcome | R7 eyebrow | "the final label if there was a pushback, else the first label" (db.py:1620) |
| pushback | R5, R6 | "a follow-up question in the same conversation that tests whether the refusal holds" (coach.py:49-52) |
| pushback move | R5 eyebrow, move Select | "the kind of question the pushback asks; seven kinds" (models.py:17-24; coach.py:5-47) |
| specificity challenge | move | "asks what exactly the concern is" (coach.py:6-10) |
| equivalence probe | move | "asks how this differs from something it accepted" (coach.py:11-15) |
| projection check | move | "asks where in the prompt the assumed thing was" (coach.py:16-20) |
| contradiction mirror | move | "points at what it wrote earlier in this conversation" (coach.py:21-25) |
| category reductio | move | "asks it to state the rule, which is often too broad" (coach.py:26-30) |
| reality anchor | move | "reminds it the scene is fiction" (coach.py:31-35) |
| minimal pressure | move | "a short question, like 'really?'" (coach.py:36-40) |
| coach | R5 | "a model that reads the refusal and drafts a pushback with a move; it suggests, you decide" (coach.py:49-78; CLAUDE.md) |
| coach profile | R2 no-probe header, promote hint | "the moves and examples the coach draws on; 'standard' by default" (db.py:76-83; seed.py:127-130) |
| coach backend | R5 backend line | "which provider's model writes the coach's suggestions" (runner.py:86-114) |
| pattern | R5 | "the coach's one-line reading of why the model refused" (models.py:53; runner.py:152-154) |
| coach example | R6 Promote | "a saved refusal, pushback, move and outcome the coach reads before drafting" (db.py:63-74; runner.py:150) |
| annotation | R6 | "your notes, pattern tags and key finding on a run" (db.py:105-113) |
| pattern tag | R6 | "a short label you give a run so findings can be grouped; shared across sessions" (db.py:911-922) |
| key finding | R6 | "one sentence per run that exports as a finding" (db.py:889-908; app.py:959-) |
| system prompt | R2 no-probe header | "text the target model receives before the probe" (db.py:38; runner.py:32-40) |
| target model | R2, R4 | "the model the probe is sent to" (db.py:34) |
| fresh conversation | R3 ready, R8 note | "the target forgets earlier probes before each send; pushbacks continue the same conversation" (runner.py:127, 171) |
| narrative probe | R2 narrative blocks | "a probe with a narrative opening and target, for Context studies" (db.py:27-28; inventory §2) |
| variant | R1 row tag | "one framing of a base probe inside a variant group" (db.py:1253-1274) |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `wb.pick` | `[data-tip="wb.pick"]` (first probe row) | title "Pick a probe"; blurb "Each row is a probe. The badge is its latest label in this session."; why "Probes are grouped by domain so a refusal pattern in one domain is easy to see." | first visit with ≥1 probe and no selection |
| `wb.send` | `[data-tip="wb.send"]` (Send) | title "Send goes to the target model"; blurb "The probe is sent in a fresh conversation. The reply comes back with a label and, if it refused, a coach suggestion."; why "A fresh conversation means earlier probes cannot leak into this one." | first *ready* state with Send enabled |
| `wb.nokey` | `[data-tip="wb.send"]` | title "Send needs a key"; blurb "This session's model is served by {provider}; set that key in Settings and come back. Reading past runs works without one." | first *ready, no key* state |
| `wb.label` | `[data-tip="wb.label"]` (first LabelControl) | title "The label can be wrong"; blurb "It comes from a keyword scan plus a judge model. If the reply reads differently to you, change it here; your change is what gets counted." | first model turn rendered |
| `wb.coach` | `[data-tip="wb.coach"]` (CoachSuggestion card) | title "The coach suggests, you decide"; blurb "Send the draft as is, edit it, write your own, or skip. Nothing is sent until you press Send."; why "Flinch measures consistency, not how to get past a refusal; the pushbacks are plain questions." | first coach card |
| `wb.held` | `[data-tip="wb.held"]` (final row caveat) | title "One pushback is one data point"; blurb "A refusal that held once might not hold twice. Push back again if the question matters, and count what you see." | first *after pushback* state |
| `wb.promote` | `[data-tip="wb.promote"]` (Promote) | title "Make the coach better"; blurb "Promoting saves this refusal, your pushback and the outcome as an example. The coach reads up to five of them before drafting." (runner.py:150) | first time Promote is enabled |
| `wb.runall` | `[data-tip="wb.runall"]` (Run all) | title "Run every probe"; blurb "Sends each probe in turn, 2 s apart, and tallies the labels. You can keep working elsewhere; Cancel stops after the current probe." | first *ready* state, after `wb.send` was seen |
| `wb.history` | `[data-tip="wb.history"]` (R7 strip) | title "Every run stays"; blurb "The dots are this session's runs in order. Click one to reopen it; the counts are outcomes, final label first." | first time `total_runs` ≥ 2 |

Placement audit: every tip anchors at 1280×800 and 1024×700 (components §22 test); `wb.coach` places above the card at 1024 because the card sits low.

## 8. Keyboard and focus
- Shortcuts (not in an input, textarea or select): `/` search probes; Up/Down move the probe cursor when the list has focus; `s` Send (ready); `p` Send the coach's pushback (coach card shown); `w` Write my own; `k` Skip; `n` Next probe; `r` Send again (new run); `a` toggle Annotate; `e` open Export menu; `?` Help; `F8` newest toast; `Escape` closes tip → menu → dialog → "write my own". In a Textarea: Ctrl+Enter sends. The Shortcuts dialog lists exactly these.
- Focus order: header → R1 (⋯ menu → search → domain → ad-hoc row → list as one tab stop → Run all → Select…) → Split divider (`role="separator"`) → R2 ("‹ Sessions" → Show all → ⋯ → Send) → R4 LabelControls in turn order → R5 (Send this pushback → Write my own → Skip, or the manual Textarea → Move → Send pushback → Skip) → R6 (Push back again → Annotate → Promote → Export → Next probe → annotation fields when open) → R7 (Info → show runs → dots as one roving stop → run list rows). After Send, focus moves to the Readout's parent region (`tabindex=-1`) so the result is read, then Tab reaches the LabelControl. After a dialog, focus returns to its opener. After "Next probe", focus goes to Send.
- Live regions: R3 Readout (`role="status"`, polite, atomic) is the one announcement per state change; R4 thread `role="log"` with `aria-relevant="additions"` reads a new turn once; LabelControl change announces "Label changed to collapsed"; R8 counts line polite, throttled 3 s; R1 counts live after a batch; toasts by tone; dialog error lines `role="alert"`. The streaming turn's elapsed timer is `aria-hidden` (announced only through the Readout at 30 s).

## 9. Dialogs and overlays opened from here
- Add probe / Import probes dialog (`dialog-probes-add-import.md`), from the R1 "⋯" menu and the empty states.
- Delete run Dialog: title "Delete run 12?", intro "This removes the reply, its label, the pushback and the annotation. The probe stays. There is no undo.", primary danger "Delete run". `DELETE /api/runs/{r}`.
- Delete probe from library Dialog: title "Delete the-hotel-room from the library?", intro "Removes it for every session. The server refuses while runs use it.", primary danger "Delete probe". `DELETE /api/probes/{id}`.
- Bulk delete Dialog (`confirm` variant): title "Delete 2 probes from the library?", intro "Bulk delete does not check for runs; runs that used these probes keep their text but lose the probe link.", prompt "Type delete 2 probes to continue", primary danger "Delete 2 probes". `POST /api/probes/bulk-delete`.
- Cancel run all Dialog (when `completed > 0`): title "Stop running all?", intro "2 of 3 are done and stay recorded. The probe in flight may still be saved.", primary danger "Stop".
- Compare sessions Dialog: title "Compare sessions", intro "Pick two or more sessions; the export lists each probe with its label in every session.", a checkbox list from `GET /api/sessions` (name · target_model), primary "Export JSON", secondary "Export CSV". `GET /api/export/compare`.
- Delete session Dialog (as `probe-sessions.md` §9) from the R2 "⋯" menu.
- Annotation Drawer at 1024 (title "Annotate run 12").
- Menus: R1 pane "⋯", row "⋯", R2 run "⋯", Export, Push back again. Term tooltips, FirstTimeTips, Quick tour (6 steps), Shortcuts dialog, Toasts.
- No native `alert`, `confirm` or `prompt` (today's api.js:470, 535, 1173-1182 and render.js:3466 are replaced).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/sessions/{s}` | load; R0 pill, R1 badges and counts, R2 no-probe header, R7 dots and run list; re-fetched after every run, pushback, skip, continue, delete and batch event |
| GET | `/api/sessions` | R0 SessionSwitcher menu, Compare sessions dialog |
| GET | `/api/probes?session_id={s}` | R1 rows; re-fetched after add, import, load defaults, delete, ad-hoc send |
| GET | `/api/probe-groups` | R1 variant tags |
| GET | `/api/sessions/{s}/stats` | R7 counts; re-fetched after every run change |
| GET | `/api/settings/keys` | R0 chip; Send and Run all disabled logic |
| GET | `/api/ollama/status` | Send disabled logic for `ollama:` targets; `keyword_only` caveat |
| POST | `/api/sessions/{s}/run` | R2 Send (probe or ad-hoc), "Send again", `r` |
| GET | `/api/runs/{r}` | open from history or URL; "Copy run as JSON" |
| GET | `/api/runs/{r}/turns` | R4 after every run change and on open |
| PATCH | `/api/runs/{r}/classification` | R4 LabelControl change and Reset |
| POST | `/api/runs/{r}/pushback` | R5 Send this pushback / Send pushback |
| POST | `/api/runs/{r}/skip` | R5 Skip |
| POST | `/api/runs/{r}/continue` | R6 Send follow-up |
| GET | `/api/runs/{r}/annotations` | R6 Annotate open and on run open (for the count tag) |
| PUT | `/api/runs/{r}/annotations` | R6 notes, tags, finding |
| GET | `/api/annotations/tags` | R6 tag datalist; re-fetched after a tag save |
| POST | `/api/runs/{r}/promote` | R6 Promote |
| GET | `/api/sessions/{s}/export?format=&include_*=&theme=` | R6 Export menu |
| GET | `/api/export/compare?session_ids=&format=` | Compare sessions dialog |
| DELETE | `/api/runs/{r}` | R2 ⋯ Delete run, R7 row menu |
| DELETE | `/api/probes/{id}` | R1 row ⋯ Delete from library |
| POST | `/api/probes/bulk-delete` | R1 select mode |
| POST | `/api/probes/load-defaults` | R1 ⋯ Load the example probes |
| POST | `/api/sessions/{s}/batch` | R1 Run all / Run selected (SSE) |
| POST | `/api/batch/{batch_id}/cancel` | R8 Cancel |
| DELETE | `/api/sessions/{s}` | R2 ⋯ Delete this session |
| POST | `/api/probes` | Add probe dialog (specified there) |
| GET | `/api/probes/files`, POST `/api/probes/import-file` | Import dialog (specified there) |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. `#/probe/1` with three probes renders `[role="region"][aria-label="Probes"]` containing a `[role="listbox"]` with three `[role="option"]` rows grouped under `[role="group"]` heads "crime", "medical", "romance" in that order; the heading row text is "Probes" followed by "3 · 2 run" when two probes have runs.
2. Each row's accessible name has the form "<slug>, <domain>, <label>, <n> runs" (or "not yet run"); the badge text is one of refused, collapsed, negotiated, complied, or "·" with `title="not yet run"`.
3. With no row selected, the run column shows an EmptyState whose text is "Pick a probe on the left, or run all of them." and a button "Run all 3".
4. Selecting the-stabbing shows a probe turn with its text (collapsed to 200 px with a "Show all" button when taller) and a primary button "Send"; pressing `s` with focus on the body sends `POST /api/sessions/1/run` with body `{"probe_id":<id>}`.
5. With `GET /api/settings/keys` reporting `anthropic` `is_set:false` and the session's `target_model` starting with `claude-`, the Send button has `aria-disabled="true"`, is focusable, and is followed by a text node "No Anthropic key is set. Set one in Settings › Keys." containing an `<a href="#/settings#keys">`; "Run all 3" is disabled with the same reason.
6. During a send the model turn header contains "Waiting…" and an elapsed timer matching `^\d+:\d\d$`; no percentage appears anywhere in the run column.
7. After a refused reply with `coach_suggestion`, the URL is `#/probe/1/run/<id>`, the Readout text begins "The model refused.", the LabelControl's select value is "refused", its source line contains "keyword scan plus judge", the inline caveat "The label is a keyword scan plus a judge model's guess. You can change it." is present, and a caveat "A refusal can come from a product filter, not the model." is present.
8. The coach card eyebrow reads "Coach suggests · <move name> · confidence <n>" where the move name is one of the seven (spaces, not underscores) and is a `[role="term"]`; beneath the buttons the text "The coach's confidence is the coach model's own guess." is present; the three buttons are "Send this pushback", "Write my own", "Skip".
9. "Send this pushback" posts `{"text":<draft>,"source":"coach"}`; "Write my own" then "Send pushback" posts `{"text":<typed>,"source":"override"}`; "Skip" posts to `/skip` with no body and the card is replaced by "Pushback skipped. The first label, refused, stands as the outcome."
10. After a pushback whose reply is labelled refused, the final row contains "final:" with a refused badge and the text "Held after one pushback. That is not proof it would hold after two."; after a second `continue` reply labelled refused the text reads "Held after 2 pushbacks. That is not proof it would hold after 3."
11. After a pushback whose reply is labelled collapsed, the final row reads "gave way after one pushback" and "Promote to example" is enabled; clicking it posts `/promote`, the button becomes `aria-pressed="true"` with the label "Promoted", and a success toast contains "Promoted run <id> to a coach example".
12. With no pushback (complied, or skipped), "Promote to example" has `aria-disabled="true"` and a visible reason beginning "Nothing to promote".
13. Changing the LabelControl select to "collapsed" sends `PATCH /api/runs/<id>/classification` with `{"field":"initial_classification","value":"collapsed"}`, the polite live region announces "Label changed to collapsed", the source line shows "you changed this to collapsed" with a "Reset" button, and the R1 badge for that probe reads "collapsed".
14. "Annotate" opens a panel with fields labelled "Notes", "Add a tag" (with a `<datalist>` whose options equal `GET /api/annotations/tags`) and "Key finding"; blurring Notes with new text sends `PUT /api/runs/<id>/annotations` with `{"note_text":…}` and a "saved HH:MM" marker appears; typing a tag and pressing "," sends `{"pattern_tags":[…]}` and renders a removable chip named "Remove <tag>".
15. The Export menu lists items in this order: "This session as JSON", "CSV", "Findings (JSON)", "Report (Markdown)", "Agent format (JSON)", "HTML", "PDF", then "Compare sessions…"; four checkboxes precede them with "include annotations" checked; choosing "HTML" requests `/api/sessions/1/export?format=html&include_turns=false&include_annotations=true&include_policy=false&include_variants=false&theme=beargle-dark`.
16. Opening an older run from the history list (not the max run id) shows, in place of the coach card, the text "This run's conversation is closed" and "Push back again" is disabled with a visible reason.
17. "Run all 3" posts `/api/sessions/1/batch` with `{"probe_ids":[<three ids>],"delay_ms":2000}`; a ProgressCard appears with "0 of 3 done", each `progress` SSE event increments the count, adds a results row with the probe name and badge, and updates the R1 badge; on `complete` the card eyebrow reads "Done" and the screen does not change state on its own.
18. Pressing Cancel after one `progress` event opens a dialog; confirming sends `POST /api/batch/<batch_id>/cancel`, the EventSource `readyState` becomes 2 (CLOSED), and the card eyebrow reads "Cancelled".
19. R7 strip text matches `^\d+ runs · \d+ refused · \d+ collapsed · \d+ negotiated · \d+ complied` and its Info popover contains "<r> of <N> refused (<pct>)" plus "A rate from N runs is a rate from N runs."; the dots count equals `runs.length` from `GET /api/sessions/1`.
20. "show runs" reveals a table whose rows are newest first with columns "Run", "Probe", "First label", "After pushback", "Pushback", "Time"; a row with `final_classification` null shows the word "none" in the fourth column, never a bare dash.
21. Loading `#/probe/1/run/9` directly selects the-stabbing in R1, renders run 9's turns, and highlights its dot; `GET /api/runs/9` returning 404 shows "That run no longer exists." with a "Back to the session" button.
22. No `window.confirm`, `window.prompt` or `window.alert` is called during any flow above (spy test).
23. At 1024×700 the left pane is exactly 280 px wide, the run column has no horizontal scroll, the R7 strip occupies two lines, and "Annotate" opens a `[role="dialog"]` Drawer titled "Annotate run <id>".
24. Every visible string in the run column passes copy-lint: sentence case, no U+2014 or U+2013, no bare percentage, empty states end in "." (components Appendix B).

## 12. Open questions for Brad
1. **Timing and tokens are not stored.** `TargetResponse` carries `latency_ms`, `input_tokens` and `output_tokens` (target.py:13-17) but `send_probe`, `send_pushback` and `continue_pushback` keep only `.text` (runner.py:130, 174, 204) and `run_turns` has no columns for them (db.py:85-92). The spec shows client-measured elapsed for live turns and `HH:MM` for stored ones, and no token count. Adding three columns to `run_turns` and storing them is a small server change; in this release?
2. **One label, no source split.** The API stores one `classification` per reply; it does not record whether the keyword scan or the judge produced it, nor the keyword confidence (classifier.py:48-61). `LabelSource` therefore cannot be filled per turn; the source line is the fixed phrase "keyword scan plus judge" and "you changed this" survives only within the page session (no override flag in `runs`, db.py:44-61). Add `classification_source` and `classification_override` columns, or accept the fixed phrase?
3. **Pushback is only possible on the session's latest run.** The target object is one per session and pushbacks reply into whatever conversation it holds (runner.py:73-84, 166-171, 183-186). After a run all, only the last probe's conversation is open. The spec says so on every older run. Should the runner instead rebuild the conversation from `run_turns` before a pushback, so any run can be pushed back on?
4. **An edited coach draft is still `source: "coach"`** (today's behaviour; app.py:390-402 takes the text as sent). Record it as `override` when the text differs from `pushback_draft`, or keep "coach" and note the edit client-side only?
5. **No move for manual pushbacks.** `SendPushbackRequest` has `text` and `source` only (app.py:162-164); the move Select in the manual box cannot be saved. Add an optional `move` field, or drop the Select?
6. **Coach failure reason is not in the run.** The coach exception is logged (runner.py:157) and the run just lacks `coach_suggestion`. The manual box can only say "the coach could not draft one". Store `coach_error` on the run?
7. **Cancel does not stop the server loop** (runner.py:233-270 never checks the cancelled status); the client closes the SSE. Accept, or add the check?
8. **Session probe sets are fixed at creation.** There is no `PUT /api/sessions/{id}`, so "add this probe to the session" is impossible for a session with a subset; the spec routes new probes to the Library and says so. Add a route, or leave subsets fixed?
9. Four proposed caveat ids beyond the seven in `03-components.md` §5: `held_n`, `keyword_only`, `closed_conversation`, `batch_fresh` (plus `first_label` from the Sessions list). Confirm or merge.
