# New study

- Route(s): `#/studies/new` (the picker); `#/studies/new/repeat`, `#/studies/new/framing`, `#/studies/new/models`, `#/studies/new/context`, `#/studies/new/over-time` (one form each, the second step on the same screen). `?session=:s` pre-fills the session.
- Section: Studies
- Purpose (one sentence, what the researcher does here): pick the consistency question to ask, fill in the one form that question needs, see what it will cost in calls, and start it.
- Arrives from: Studies list "New study"; Home card "Is the refusal consistent?" › "Start a study"; Probe workbench "⋯" › "Start a study with this session" (arrives with `?session=:s`); the session-idle tiles of today (inventory §8) are retired in favour of this. Leaves to: the new study's screen on start (`#/studies/repeat/:id`, `#/studies/framing/:s`, `#/studies/models/:id`, `#/studies/context/:id`, `#/studies/snapshots/:s`); `#/experiments/new` for a conditions-type variant group; back to the picker with "Back" or Escape in a form; back to `#/studies` with the "Studies" link.
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, Card, Readout, Select, Input, Textarea, Slider, Checkbox, Segmented, Chip (`chip`, `tag`), List/Row (select mode, reusing ProbeList rows without the session footer), Button, InsetBox, Stat, Term, Caveat, EmptyState, Toast, Dialog, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §21 Statistical Analysis CONFIGURATION (repeat count, Run Selected / Run All, render.js:4685-4697); §17 Multi-Model Comparison picker (models, custom model id, probes, custom prompt, render.js:1135-1246); §18 legacy Compare Sessions modal (`#compare-modal`, unreachable, `submitCompare` undefined; its intent lands in the Models form's "Compare sessions" mode); §19 Narrative Momentum create form (strategy, probe, mode, warm-up slider, IF Engine, Create / Create + Auto-Whittle, render.js:3874-3923) and the dead sequence-batch flow (api.js:1299-1323); §20 Framing Variants "Run" / "Run All Variant Groups" buttons and their `confirm()`s (render.js:1537-1549, 3138-3218); §8 Session idle "Save Baseline" with its two native `prompt()`s (render.js:458-462, api.js:1173-1182); §29 "+ Save Baseline".

## 1. Wireframe, 1280×800
```
#/studies/new (picker)
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies … ? ⚙ │ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Studies › New study                                                              │
│     Pick the question. The form for it is the next step.                             │
│ R2  ▣ Session crime-set-1 on claude-sonnet-4-6 has 4 probes and 12 runs. Repeat,     │
│       framing, context and over time use it; models picks its own models.            │
│ R3  ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐      │
│     │ REPEAT               │ │ FRAMING              │ │ MODELS               │      │
│     │ Does the same probe  │ │ Does the label hold  │ │ Do other models give │      │
│     │ get the same label   │ │ when the request is  │ │ the same label to    │      │
│     │ ten times running?   │ │ framed another way?  │ │ the same probe?      │      │
│     │ needs: session, key  │ │ needs: session,      │ │ needs: 2 to 5 models │      │
│     │ makes: probes × N    │ │ variant group        │ │ with keys            │      │
│     └──────────────────────┘ └──────────────────────┘ └──────────────────────┘      │
│     ┌──────────────────────┐ ┌──────────────────────┐                               │
│     │ CONTEXT              │ │ OVER TIME            │                               │
│     │ Does a conversation  │ │ Has this session's   │                               │
│     │ before the probe     │ │ set of labels moved  │                               │
│     │ change the label?    │ │ since a saved        │                               │
│     │ needs: session,      │ │ baseline?            │                               │
│     │ strategy, probe      │ │ needs: session with  │                               │
│     │                      │ │ runs                 │                               │
│     └──────────────────────┘ └──────────────────────┘                               │
│ R4  ⓘ Every study labels replies with a keyword scan plus a judge model's guess.     │
└──────────────────────────────────────────────────────────────────────────────────────┘

#/studies/new/repeat (form step; the other four forms sit in the same R5 slot)
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R1  Studies › New study › Repeat                                    [ ← Back ]       │
│ R5  ┌ Repeat study  send each probe N times, fresh conversation each time ──────────┐│
│     │ SESSION   [crime-set-1 · claude-sonnet-4-6 ▾]                                 ││
│     │ PROBES    [search…] [domain ▾]                                 [Select all]    ││
│     │           ☑ the-stabbing   CRIME     REFUSED (3 runs)                          ││
│     │           ☑ the-robbery    CRIME     not yet run                               ││
│     │           ☐ the-autopsy    MEDICAL   COMPLIED (2 runs)                         ││
│     │           ☐ the-hotel-room ROMANCE   not yet run                               ││
│     │ REPEAT COUNT  [10]  1 to 100                                                   ││
│     │ ┌ THIS WILL MAKE ──────────────────────────────────────────────┐               ││
│     │ │ 20 iterations                                                │               ││
│     │ │ 2 probes × 10 repeats; each iteration is one call to         │               ││
│     │ │ claude-sonnet-4-6 and one to the judge                       │               ││
│     │ └──────────────────────────────────────────────────────────────┘               ││
│     │ ⓘ No coach, no pushback: a repeat study measures the first reply only.        ││
│     │                                              [Cancel]  [ Start repeat study ]  ││
│     └───────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
R3 cards go from three per row to two per row (five cards, three rows); each card keeps its full sentence. R5 forms keep one column; the probe list caps at 240 px tall and scrolls inside the panel; the Models form's model groups wrap to two columns instead of three. Nothing is hidden.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav (current = Studies), HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session pill | `GET /api/sessions` (app.py:349) | `name`, `target_model` | as IA §2 | SessionSwitcher |
| Key chip | `GET /api/settings/keys` (app.py:2263) | `providers[].is_set` | "r of N keys set" | KeyStatusChip |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Session pill item | none | sets the SESSION Select in whichever form is open and rewrites `?session=` |

### R1 Breadcrumb row
- Components: text links, Button (ghost sm "← Back" on a form step).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "Studies › New study" | none | none | "Studies" is a link to `#/studies`; on a form step a third crumb names the type | text |
| Subtitle "Pick the question. The form for it is the next step." (draft; brad-voice pass) | none | none | picker only | Panel subtitle |
| "← Back" | none | none | form steps only | Button ghost sm |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Studies | none | `#/studies` |
| ← Back / Escape | none | `#/studies/new` (keeps `?session=`); an unsent form's values stay in memory for this page load |

### R2 Readout
- Components: Readout.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session sentence | `GET /api/sessions/{id}` (app.py:363-369) and `GET /api/sessions/{id}/stats` (app.py:457 → db.py:1604-1634) | `name`, `target_model`, `probe_ids` (null = all probes, db.py:682-689), `runs.length`, `total_runs` | "Session {name} on {model} has {p} probes and {r} runs. Repeat, framing, context and over time use it; models picks its own models." (draft; brad-voice pass); p = `probe_ids.length` when set, else the count from `GET /api/probes` | Readout |
| No-session sentence | none | none | "No session is open. Repeat, framing, context and over time need one; models does not." (draft; brad-voice pass) | Readout |

- Actions: none.

### R3 Type picker
- Components: Card ×5 (title, body, eyebrow "needs" and "makes" lines in `meta`), Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Repeat card | none | none | title "Repeat"; body "Does the same probe get the same label ten times running?"; meta "needs: a session and its provider's key · makes: probes × N iterations" (draft; brad-voice pass) | Card |
| Framing card | `GET /api/variants/files` (app.py:759) and `GET /api/probe-groups` (app.py:739) counts | `length` | body "Does the label hold when the request is framed another way?"; meta "needs: a session and a variant group ({n} available)" | Card |
| Models card | `GET /api/models` (app.py:1525-1623) | `[].available` | body "Do other models give the same label to the same probe?"; meta "needs: 2 to 5 models with keys ({k} providers ready)"; disabled with reason "Only {k} provider has a key; a models study needs two." when fewer than two providers are `available` | Card |
| Context card | `GET /api/strategies` (app.py:1946) | `length` | body "Does a conversation before the probe change the label?"; meta "needs: a session, a strategy ({n} loaded) and a probe"; disabled with reason "No strategies loaded yet. Load defaults in Library › Probes first." when `length === 0` (strategies arrive with load-defaults, app.py:299-301) | Card |
| Over time card | R2's `total_runs` | number | body "Has this session's set of labels moved since a saved baseline?"; meta "needs: a session with runs ({r} so far)"; disabled with reason "This session has no runs yet, so there is nothing to save as a baseline." when `total_runs === 0` (server returns 400 "No runs in session to snapshot", app.py:844) | Card |
| Session-less note on Repeat, Framing, Context, Over time | none | none | when no session is open: the card stays enabled and its meta ends "pick a session on the next step" | Card meta |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Card click / Enter | none | `#/studies/new/{type}` with `?session=` carried |

### R4 Picker caveat
- Components: Caveat (`note`).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| `classifier` | none | none | pinned phrase, worded once for the picker: "Every study labels replies with a keyword scan plus a judge model's guess. You can change a label on any run." (draft; brad-voice pass); the pinned `classifier` phrase itself is shown on each form | Caveat |

- Actions: none.

### R5 Form step (one of five)
- Components: Panel (heading = type name, subtitle = one plain clause), Select, Input, Textarea, Slider, Checkbox, Segmented, Chip, List/Row, InsetBox, Stat, Button, Caveat, Term.

Shared fields on the four session-bound forms:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| SESSION | `GET /api/sessions` (app.py:349) | `id`, `name`, `target_model` | "{name} · {target_model}"; pre-filled from `?session=` or the header pill; sessions auto-created by a models study (notes starting "Auto-created by multi-model comparison", app.py:1716) listed last under "compare sessions"; required | Select |
| Provider key check | `GET /api/settings/keys` (app.py:2263) | `is_set` for the provider inferred from `target_model` prefix (stat_runner.py:16-33: `claude-`, `gpt-`/`o1-`/`o3-`/`o4-`/`chatgpt-`, `gemini-`, `grok-`, else OpenAI-compatible) | when not set, the Start button is disabled with reason "{provider} has no API key. Set one in Settings › Keys." (draft; brad-voice pass) | Button disabled reason |

#### R5a Repeat form (`#/studies/new/repeat`)

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| PROBES | `GET /api/probes` (app.py:257) filtered to the session's `probe_ids` when set; latest label per probe from `GET /api/sessions/{id}` `runs[]` (`final_classification || initial_classification`, latest `id` per `probe_id`) | `id`, `name`, `domain`, `prompt_text` | List in select mode grouped by domain, each row "{name} {DOMAIN} {badge} ({runs} runs)"; search and domain filter as ProbeList; "Select all" / "Clear"; default checked = the probe selected in the workbench when arriving from it, else none | List/Row + OutcomeBadge |
| REPEAT COUNT | none | none | number Input 1 to 100 (models.py:131-133 `ge=1, le=100`), default 10; hint "1 to 100" | Input (number) |
| THIS WILL MAKE | computed | probes × N | Stat value "{probes × N} iterations", madeOf "{p} probes × {N} repeats; each iteration is one call to {target_model} and one to the judge" (stat_runner.py:84-90: one `target.send`, one `classify`) | Stat |
| Note | none | none | Caveat note "No coach, no pushback: a repeat study measures the first reply only." (draft; brad-voice pass) from stat_runner.py:44 "No coach suggestions — probe + classify only" | Caveat |
| Start | none | none | primary md "Start repeat study"; disabled with reason "Pick at least one probe." until ≥ 1 checked; loading label "Starting…" | Button |

Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Start repeat study | `POST /api/sessions/{id}/stat-run` `{probe_ids, repeat_count}` (app.py:2561-2587; SSE) | on the first `start` event (`stat_run_id`, stat_runner.py:63-71) navigate to `#/studies/repeat/:stat_run_id` in its running state, handing the open EventSource to that screen (see study-repeat.md §3 "running"); on an `error` event before `start`: stay, show the `error` string (app.py:2580 sends `{error}`) in the form's error line |
| Cancel | none | `#/studies/new` |

#### R5b Framing form (`#/studies/new/framing`)

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| VARIANT GROUPS | `GET /api/variants/files` (app.py:759 → db.py:1405-1422) `[{group_id, title, description, domain, variant_type, variant_count, labels[]}]` merged with `GET /api/probe-groups` (app.py:739 → db.py:1253-1273) `[{group_id, variants[{probe_id, variant_label, probe_name, probe_domain}]}]` by `group_id` | all | one row per group: title (or `group_id`), `tag` Chip "framings" or "conditions", "{variant_count} variants" (file) or "{variants.length} variants" (DB only), labels as `tag` Chips, domain; a checkbox per framings-type group; conditions-type groups have no checkbox (see below) | List/Row (select mode) + Chip |
| Framing group rows: ready state | `GET /api/probe-groups` | `variants[].probe_id` present | "ready to run" | text |
| Framing group rows: not synced | file group with no DB group | none | "not in the database yet; Flinch will sync it when you start" (draft; brad-voice pass). Sync is only done by `POST /api/variants/files` (app.py:771-779 → db.py:1452-1505), so Start re-posts the file's own parsed content from `GET /api/variants/files/{gid}` (app.py:763) and then reads `GET /api/probe-groups/{gid}` (app.py:743) for the probe ids | text + hidden calls |
| Conditions-type group rows | file list `variant_type === 'conditions'` (db.py:1337-1339) | `labels[]` | no checkbox; the row says "This group changes the system prompt, not the request. Running it is an experiment." (draft; brad-voice pass) with a secondary sm button "Start as experiment" | text + Button |
| THIS WILL MAKE | computed | union of selected groups' `probe_id`s | Stat value "{n} runs", madeOf "{n} variant probes across {g} groups, one run each in {session}; a variant already run in this session is run again and its latest run is what counts" (db.py:1550-1557 latest run) | Stat |
| Start | none | none | primary md "Run variant groups"; disabled with reason "Pick at least one framings group." | Button |

Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Run variant groups | for each unsynced selected file group: `GET /api/variants/files/{gid}` then `POST /api/variants/files` with the same `{group_id, title, description, base_probe, domain, variant_type, variants[{label, prompt_text}]}` (app.py:771-779; idempotent, db.py:1468-1485 updates existing probes by name); then `GET /api/probe-groups/{gid}` for ids; then `POST /api/sessions/{id}/batch` `{probe_ids, delay_ms: 2000}` (app.py:541; BatchRequest app.py:167-169; SSE events `progress`/`error`/`complete`, runner.py:241-285) | navigate to `#/studies/framing/:session_id` in its running state with the EventSource handed over |
| Start as experiment | none | `#/experiments/new?variant_group={gid}&session={s}`; the experiment wizard pre-fills conditions from `GET /api/variants/files/{gid}` `variants[]` (`label`, `prompt_text` as the condition's system prompt) and the session's probes; nothing runs from this screen. Today's path (`POST /api/sessions/{id}/batch-conditions`, app.py:573-700, which auto-creates an experiment at :588-631) is not called here |
| Cancel | none | `#/studies/new` |

#### R5c Models form (`#/studies/new/models`)

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| MODE | none | none | Segmented "Models side by side" / "Sessions side by side" | Segmented |
| MODELS (mode 1) | `GET /api/models` (app.py:1525-1623) | `[].provider`, `[].models[{id, name, deprecated?}]`, `[].available`, `[].hint`, `[].local` | one group per provider, Chips per model (selected = chosen); an unavailable provider's chips are disabled with the `hint` as the reason ("Set OPENAI_API_KEY", "pip install openai", "Ollama not detected…"); `deprecated` models get a `tag` "legacy"; counter "{k} of 5 picked, 2 needed" | Chip strip + text |
| Custom model id | none | none | Input "or type a model id…" + "Add" (Enter adds); added as a chip; the provider is inferred by prefix as above, with no key check possible for an unknown prefix (hint "runs through the OpenAI-compatible client", stat_runner.py:32-34) | Input + Chip |
| PROBES (mode 1) | `GET /api/probes` (app.py:257) | `id`, `name`, `domain` | List select mode grouped by domain, "Select all"; ≥ 1 required | List/Row |
| Ad-hoc probe (mode 1) | none | none | Textarea "Or write a one-off probe" (max 5000); on Start it becomes a probe via `POST /api/probes` first (today's behaviour, render.js:3379-3390) and is checked | Textarea |
| SYSTEM PROMPT (mode 1) | none | none | Textarea, optional, 3 rows; hint "applied to every model; empty means none" (request field `system_prompt`, app.py:215-218, with no UI today) | Textarea |
| SESSIONS (mode 2) | `GET /api/sessions` (app.py:349) | `id`, `name`, `target_model` | List select mode "{name} · {target_model}"; ≥ 2 required (app.py:1635) | List/Row |
| THIS WILL MAKE (mode 1) | computed | models × probes | Stat value "{m × p} runs", madeOf "{m} models × {p} probes; Flinch makes one hidden session per model so each run is kept" (app.py:1709-1720) | Stat |
| THIS WILL MAKE (mode 2) | computed | none | Stat value "no new runs", madeOf "compares the runs these {n} sessions already have; nothing is sent" | Stat |
| Start | none | none | mode 1: primary md "Run {m} models × {p} probes"; disabled with reason "Pick at least 2 models." / "Pick at least 1 probe." / "At most 5 models." (app.py:1693-1698); mode 2: "Compare sessions", disabled with reason "Pick at least 2 sessions." | Button |

Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Run models | (`POST /api/probes` for an ad-hoc probe) then `POST /api/compare/run` `{probe_ids, models, system_prompt}` (app.py:1690-1802; a single JSON response, not SSE) | the form shows the Button loading "Running {m} × {p}…" with elapsed time (there is no progress event; the request returns once every cell is done); on 200 navigate to `#/studies/models/:comparison_id`; on 4xx show the detail string in the error line; on network failure Toast error "The comparison did not come back. Any runs that finished are in the hidden compare sessions." (draft; brad-voice pass) |
| Compare sessions | none | `#/studies/models/sessions/:ids` (ids comma-joined); the study screen calls `GET /api/compare` |
| Cancel | none | `#/studies/new` |

#### R5d Context form (`#/studies/new/context`)

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| STRATEGY | `GET /api/strategies` (app.py:1946 → db.py:2256-2258; columns db.py:168-180) | `id`, `name`, `category`, `description`, `goal`, `opening_pattern`, `escalation_pattern`, `setup_hint`, `is_builtin` | Select "{name with _ → space} ({category})"; below it an InsetBox showing the chosen strategy's `description`, then "goal", "opens with", "escalates by", "setup" rows from `goal`, `opening_pattern`, `escalation_pattern`, `setup_hint` (today unshown); `is_builtin` as a `tag` "built in" | Select + InsetBox |
| PROBE | `GET /api/probes` filtered to the session's `probe_ids` | `id`, `name`, `domain` | Select "{name} [{domain}]"; Segmented "one probe" / "every probe in the session" (the latter uses the sequence batch, below) | Select + Segmented |
| MODE | none | none | Segmented "automatic" (coach and target run every turn, runner.py:910-1016) / "interactive" (you press Next turn and Drop probe, runner.py:664-805); hint beside each | Segmented |
| WARM-UP TURNS | none | none | Slider 1 to 20, default 10 (CreateSequenceRequest `max_warmup_turns`, app.py:220-225); value shown "10 warm-up turns"; hint "the last of them is the setup turn, then the probe" (runner.py:935, 968-971) | Slider |
| Narrative engine | none | none | Checkbox "Use the narrative engine system prompt on the target" (`use_narrative_engine`, runner.py:424-431) with hint "the target gets a storytelling system prompt for this sequence only" | Checkbox |
| Whittle | none | none | Checkbox "After the first run, whittle: run again with one fewer warm-up turn until the refusal comes back" (runner.py:1024-1030) | Checkbox |
| THIS WILL MAKE (one probe) | computed | none | Stat value "{N + 1} turn pairs" (runner.py:933 `total_steps = warmup_count + 1`), madeOf "{N − 1} warm-up pairs, 1 setup pair, 1 probe pair; each pair is a coach call, a target call and a judge call"; with Whittle: "up to {N + 1} runs of up to {N + 1} pairs" | Stat |
| THIS WILL MAKE (every probe) | `POST /api/sessions/{id}/sequence-batch` then `POST /api/sequence-batches/{id}/estimate` (app.py:2134-2170; runner.py:1175-1226) | `estimated_runs`, `estimated_total_turns`, `estimated_tokens`, `estimated_cost_usd`, `probe_count`, `mode`, `max_turns` | Stat value "about ${estimated_cost_usd}", madeOf "{estimated_runs} runs, about {estimated_total_turns} turns, about {estimated_tokens} tokens at a flat $5 per million (runner.py:1216); whittle averages (N + 1) ÷ 2 runs per probe"; the batch is created in `pending` state when the user asks for the estimate (the estimate route needs a batch row, app.py:2163-2170) and deleted with the sequences it made if the user cancels (`DELETE /api/sequences/{id}` per sequence; no batch delete route, see §12) | Stat |
| Start | none | none | one probe: primary md "Create sequence" plus secondary "Create and run now"; every probe: primary "Start {n} sequences" | Button |

Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Create sequence | `POST /api/sessions/{id}/sequences` `{probe_id, strategy_id, mode, max_warmup_turns, use_narrative_engine}` (app.py:1999-2014; returns the sequence row plus `current_run_id`) | `#/studies/context/:id` in its "not run yet" state |
| Create and run now | the POST above, then automatic: `POST /api/sequences/{id}/run-auto` (app.py:2039; SSE) handed to the study screen; interactive: `POST /api/sequences/{id}/run-turn` once (app.py:2059); with Whittle checked and automatic mode: `POST /api/sequences/{id}/whittle` instead of run-auto (app.py:2089; a single JSON response; the study screen polls `GET /api/sequences/{id}` every 5 s while it runs) | `#/studies/context/:id` running |
| Start n sequences | `POST /api/sessions/{id}/sequence-batch` `{strategy_id, probe_ids, mode: 'whittle' | 'fixed_n', fixed_n, max_warmup_turns}` (app.py:2134-2153; CreateSequenceBatchRequest app.py:227-232) if not already created for the estimate, then `POST /api/sequence-batches/{id}/start` (app.py:2172-2184; SSE `progress`/`error`/`complete`, runner.py:1228-1313) | `#/studies/context/batch/:batch_id`, the Context study screen in batch mode (study-context.md §3 "batch running") |
| Cancel | `DELETE /api/sequences/{id}` for any sequence created only for an estimate | `#/studies/new` |

#### R5e Over-time form (`#/studies/new/over-time`)

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Existing baselines | `GET /api/sessions/{id}/snapshots` (app.py:849) | `name`, `created_at` | "This session has {n} baselines; the latest is \"{name}\" from {date}." or "No baselines yet." (draft; brad-voice pass) | text |
| NAME | none | none | Input, required, max 200; default "baseline {YYYY-MM-DD HH:mm}" | Input |
| DESCRIPTION | none | none | Textarea, optional, 2 rows, hint "what was true when you saved it: the system prompt, the model version, what you changed" | Textarea |
| THIS WILL SAVE | `GET /api/sessions/{id}` `runs[]` | latest run per `probe_id` | Stat value "{p} probes", madeOf "the latest label of each of {p} probes from {r} runs; replies are kept to 500 characters" (db.py:1637-1655) | Stat |
| Save | none | none | primary md "Save baseline"; disabled with reason "This session has no runs yet." when `runs.length === 0` | Button |

Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Save baseline | `POST /api/sessions/{id}/snapshots` `{name, description}` (app.py:838-847; CreateSnapshotRequest app.py:211-213) | `#/studies/snapshots/:session_id` with the new baseline selected; Toast success "Saved baseline \"{name}\" with {p} probes." (draft; brad-voice pass); on 400 "No runs in session to snapshot" show the reason inline |
| Open existing | none | `#/studies/snapshots/:session_id` |
| Cancel | none | `#/studies/new` |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|
| picker, loading | `#/studies/new` until sessions, models, variants, strategies return | shown | skeleton | five cards with meta "…" | shown | hidden | (none) |
| picker, no session | no `?session=` and no header session | shown | no-session sentence | all five cards enabled; Models and the session-bound ones say "pick a session on the next step" | shown | hidden | "No session is open. Repeat, framing, context and over time need one; models does not." |
| picker, with session | session resolved | shown | session sentence | cards with live counts; Over time disabled when `total_runs === 0`; Context disabled when no strategies; Models disabled when < 2 providers available | shown | hidden | "Session crime-set-1 on claude-sonnet-4-6 has 4 probes and 12 runs. Repeat, framing, context and over time use it; models picks its own models." |
| picker, no key | zero keys set | shown | session sentence plus "No API key is set, so nothing can run yet." | cards enabled except Models (needs two providers); each form's Start is disabled with the key reason | shown | hidden | as above plus the key clause |
| form, idle | `#/studies/new/{type}` | breadcrumb with type, Back | session sentence | hidden | hidden | form with THIS WILL MAKE at "0 …" and Start disabled with its reason | unchanged |
| form, ready | required fields valid | | | | | Start enabled; Stat shows the plan | unchanged |
| form, estimating (context, every probe) | user clicks "Estimate" | | | | | Stat loading skeleton; Start disabled "Estimating…" | unchanged |
| form, starting | Start clicked, request in flight | | | | | Start loading ("Starting…" / "Running 3 × 4…" with elapsed "0:42" for models); fields disabled | unchanged |
| form, error | POST non-2xx or SSE `error` before `start` | | | | | error line `role="alert"` with the server `detail` or `error` string; fields re-enabled | unchanged |
| form, no probes in session | session's probe list is empty | | | | | PROBES shows EmptyState "This session has no probes. Add some in Probe, then come back." with "Go to Probe" | unchanged |
| framing, no groups | both group lists empty | | | | | EmptyState "No variant groups yet. Make one in Library › Variant groups." with that link | unchanged |
| framing, conditions only | every group is conditions-type | | | | | the list shows them with "Start as experiment" buttons; Start disabled with reason "Every group here is a conditions group; those run as experiments." | unchanged |
| models, few providers | < 2 providers `available` | | | | | model chips of unavailable providers disabled with their `hint`; Start disabled "Only {k} provider has a key; a models study needs two." | unchanged |
| context, no strategies | `GET /api/strategies` returns `[]` | | | | | STRATEGY shows EmptyState "No strategies loaded. Load defaults in Library › Probes; the six built-in strategies come with them." | unchanged |
| over time, no runs | `runs.length === 0` | | | | | Save disabled with reason; Stat "0 probes" madeOf "no runs yet" | unchanged |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Session probes and runs (R2) | `probe_ids.length` (or all probes), `runs.length` | both in the sentence | Readout |
| Repeat iterations | `checked.length × repeat_count` | "{p} probes × {N} repeats" | Stat |
| Framing runs | `|∪ selected groups' probe_ids|` | "{n} variant probes across {g} groups" | Stat |
| Models runs | `models.length × probes.length` | "{m} models × {p} probes" | Stat |
| Context turn pairs | `max_warmup_turns + 1` (runner.py:933) | "{N − 1} warm-up pairs, 1 setup pair, 1 probe pair" | Stat |
| Context batch cost | `estimated_cost_usd` = tokens × 5 ÷ 1 000 000 (runner.py:1216-1217); tokens from the per-turn constants at runner.py:1196-1199 | "{estimated_runs} runs, about {estimated_total_turns} turns, about {estimated_tokens} tokens at a flat $5 per million" with "about" because `estimated: true` | Stat |
| Over time probes | distinct `probe_id` in `runs[]` | "the latest label of each of {p} probes from {r} runs" | Stat |
| Picker meta counts | lengths of the four lists; `available` providers | the noun beside each | Card meta |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `classifier` | The label is a keyword scan plus a judge model's guess. You can change it. | every form, under THIS WILL MAKE | classifier.py; stat_runner.py:91 `classify(...)` |
| `first_reply_only` (new id) | No coach, no pushback: a repeat study measures the first reply only. | Repeat form | stat_runner.py:44 |
| `latest_only` | Each variant and each probe counts only its latest run. | Framing form THIS WILL MAKE; Over time form THIS WILL SAVE | db.py:1550-1557; db.py:1637-1655 with app.py:871 |
| `compare_sessions` | A models study makes one hidden session per model; its runs live there. | Models form THIS WILL MAKE | app.py:1709-1720; db.py:2656 |
| `threshold_once` | A threshold from one run can land elsewhere next run. | Context form beside the Whittle checkbox | runner.py:1024-1030 |
| `cost_estimate` (new id) | The cost is a flat guess: every token priced the same, and token counts are typical, not measured. | Context form batch Stat | runner.py:1214-1217 |
| `experiment_not_here` (new id) | A conditions group changes the system prompt, not the request; it runs as an experiment. | Framing form conditions rows | db.py:1463-1467; app.py:588-631 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| study | R1, R3 | IA §1 |
| stat run / iteration | Repeat card, R5a | stat_runner.py:37-47; db.py:247-267 |
| variant group / framing variant / baseline variant | Framing card, R5b | db.py:1324-1402; `is_baseline` db.py:1373 |
| conditions group | R5b | db.py:1337-1339, 1463-1467 |
| experiment | R5b | IA §3 Experiments; app.py:2771 |
| judge | R4, every form | classifier.py |
| session | R2, R5 | db.py:31-41; IA §1 |
| strategy | R5d | db.py:168-180 |
| warm-up turn / setup turn / probe turn | R5d | runner.py:930-1004 |
| narrative sequence | Context card | db.py:197-209 |
| narrative engine | R5d checkbox | runner.py:424-431 `NARRATIVE_ENGINE_SYSTEM_PROMPT` |
| whittling / threshold | R5d | runner.py:1024-1030 |
| snapshot / baseline | Over time card, R5e | db.py:123-130 |
| system prompt | R5c | db.py:38 `sessions.system_prompt`; app.py:217 |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `new.pick` | Repeat card (`data-tip="new-repeat"`) | Five questions, one form each. Repeat is the plainest: the same probe, N times, fresh conversation each time. | first visit to the picker |
| `new.will-make` | THIS WILL MAKE box on any form (`data-tip="new-will-make"`) | Before you start, this says how many calls you are about to make and what each one is. | first time a form reaches "ready" |
| `new.conditions` | first "Start as experiment" button (`data-tip="new-conditions"`) | This group changes the system prompt, so it is an experiment, not a framing study. It opens the experiment wizard pre-filled. | first time a conditions row is visible |
| `new.whittle` | Whittle checkbox (`data-tip="new-whittle"`) | Whittling runs the sequence again with one fewer warm-up turn each time, until the refusal comes back. The count where it comes back is the threshold. | first visit to the Context form |

## 8. Keyboard and focus
- Shortcuts: `Escape` in a form returns to the picker (after a Dialog "Discard this form?" when any field changed); `Ctrl+Enter` in a form submits when Start is enabled; `1` to `5` on the picker focus the nth card; `/` focuses the probe search where present.
- Focus order: header → breadcrumb links → (picker) cards in reading order → footer caveat; (form) Back → fields top to bottom in the order drawn → THIS WILL MAKE (not focusable) → Cancel → Start. Chip strips use roving focus with arrow keys. The error line receives focus when it appears.
- Live regions: R2 Readout polite; the THIS WILL MAKE Stat has `aria-live="polite"` and announces only when the user pauses 1 s after a change; Start loading sets `aria-busy`; the error line is `role="alert"`.

## 9. Dialogs and overlays opened from here
- Dialog "Discard this form?" (primary "Discard", cancel "Keep editing") on Back/Escape with unsaved changes.
- Dialog "Pick up a running comparison?" is not needed: `POST /api/compare/run` blocks until done, so leaving the form mid-run only loses the view; the Toast on return says where the runs went.
- FirstTimeTip ×4 (§7). Toasts for start failures. No native `confirm()` or `prompt()` anywhere on this screen (replaces the three `confirm()`s of inventory §20 and the two `prompt()`s of §8/§29).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | /api/sessions | R0, R5 SESSION Select, R5c sessions mode |
| GET | /api/sessions/{id} | R2 (runs), R5a latest labels, R5e THIS WILL SAVE |
| GET | /api/sessions/{id}/stats | R2 `total_runs`, R3 Over time card |
| GET | /api/settings/keys | R0, R5 provider key check |
| GET | /api/probes | R2 probe count, R5a, R5c, R5d |
| POST | /api/probes | R5c ad-hoc probe on Start |
| GET | /api/models | R3 Models card, R5c |
| GET | /api/variants/files | R3 Framing card, R5b |
| GET | /api/variants/files/{gid} | R5b sync-before-run; "Start as experiment" pre-fill |
| POST | /api/variants/files | R5b sync-before-run (idempotent re-post) |
| GET | /api/probe-groups | R3 Framing card, R5b |
| GET | /api/probe-groups/{gid} | R5b probe ids after sync |
| POST | /api/sessions/{id}/batch | R5b Run variant groups (SSE) |
| POST | /api/sessions/{id}/stat-run | R5a Start (SSE) |
| POST | /api/compare/run | R5c Run models |
| GET | /api/strategies | R3 Context card, R5d |
| POST | /api/sessions/{id}/sequences | R5d Create sequence |
| POST | /api/sequences/{id}/run-auto | R5d Create and run now (automatic; SSE) |
| POST | /api/sequences/{id}/run-turn | R5d Create and run now (interactive) |
| POST | /api/sequences/{id}/whittle | R5d Create and run now with Whittle |
| DELETE | /api/sequences/{id} | R5d Cancel after an estimate |
| POST | /api/sessions/{id}/sequence-batch | R5d every-probe mode |
| POST | /api/sequence-batches/{id}/estimate | R5d Estimate |
| POST | /api/sequence-batches/{id}/start | R5d Start n sequences (SSE) |
| GET | /api/sessions/{id}/snapshots | R5e existing baselines |
| POST | /api/sessions/{id}/snapshots | R5e Save baseline |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. `#/studies/new` renders five `a[data-study-type]` or `button[data-study-type]` cards in the order repeat, framing, models, context, over-time; each card's body text ends with "?".
2. With `GET /api/strategies` stubbed to `[]`, the Context card has `aria-disabled="true"`, no `href`, and its reason text contains "No strategies loaded".
3. With `GET /api/models` stubbed so only `anthropic` is `available`, the Models card is disabled with reason containing "needs two"; with two providers available it is enabled.
4. With `?session=3` where session 3's `GET /api/sessions/3/stats` returns `total_runs: 0`, the Over time card is disabled with reason containing "no runs yet".
5. On `#/studies/new/repeat` with two probes checked and repeat count 10, the Stat reads "20 iterations" and its madeOf contains "2 probes × 10 repeats"; the Start button is enabled; with zero checked, Start is `aria-disabled` and the reason text is "Pick at least one probe."
6. Setting repeat count to 101 shows the field error "1 to 100" and keeps Start disabled; the request body on Start has `repeat_count` within 1 to 100.
7. Clicking Start on the Repeat form issues `POST /api/sessions/3/stat-run` with body `{"probe_ids":[…],"repeat_count":10}` and, on the first SSE `start` event with `stat_run_id: 42`, sets the hash to `#/studies/repeat/42`.
8. On `#/studies/new/framing`, a group whose file list entry has `variant_type: "conditions"` renders no checkbox, the text "runs as an experiment" (case-insensitive), and a button "Start as experiment" whose click sets the hash to `#/experiments/new?variant_group={gid}&session={s}` and issues no `POST /api/sessions/{id}/batch-conditions`.
9. On the Framing form, selecting a file group absent from `GET /api/probe-groups` and clicking Start issues, in order, `GET /api/variants/files/{gid}`, `POST /api/variants/files`, `GET /api/probe-groups/{gid}`, then `POST /api/sessions/{id}/batch` whose `probe_ids` equal the group's `variants[].probe_id`.
10. On `#/studies/new/models`, picking a sixth model chip is refused and the reason "At most 5 models." appears; with one model picked the Start reason is "Pick at least 2 models."
11. The Models form's request body includes `system_prompt` equal to the textarea value (empty string when blank).
12. On the Models form in "Sessions side by side" mode with sessions 2 and 5 picked, "Compare sessions" sets the hash to `#/studies/models/sessions/2,5` and issues no POST.
13. On `#/studies/new/context` the slider's default value is 10, its min 1 and max 20; the Stat reads "11 turn pairs" with madeOf containing "9 warm-up pairs, 1 setup pair, 1 probe pair".
14. Choosing "every probe in the session" and clicking Estimate issues `POST /api/sessions/{id}/sequence-batch` then `POST /api/sequence-batches/{id}/estimate`, and the Stat shows "about $" followed by the returned `estimated_cost_usd` and madeOf containing "at a flat $5 per million".
15. On `#/studies/new/over-time` with a session that has runs, Save issues `POST /api/sessions/{id}/snapshots` with `{name, description}` and navigates to `#/studies/snapshots/{id}`; no `window.prompt` is called (spy asserts zero calls).
16. Every form contains the exact string "The label is a keyword scan plus a judge model's guess. You can change it."
17. Pressing Escape on a form with a changed field opens a dialog titled "Discard this form?"; confirming returns to `#/studies/new`.
18. At 1024×700 the picker shows cards two per row, each card's full body visible, and no horizontal scroll on `main`.

## 12. Open questions for Brad
1. **Framing file groups need a sync step.** Only `POST /api/variants/files` writes a file group into `probe_variants` (app.py:777). The form re-posts the file to itself to sync. A `POST /api/variants/files/{gid}/sync` route would be cleaner; want it in this release?
2. **Sequence batches cannot be deleted.** Getting an estimate creates a `sequence_batches` row and its sequences (app.py:2134-2153); there is no delete route for the batch, only for sequences. The spec deletes the sequences on Cancel and leaves the empty batch row. Add `DELETE /api/sequence-batches/{id}`?
3. **Models study blocks until done.** `POST /api/compare/run` returns one JSON after every cell (app.py:1690-1802). The form shows elapsed time with no per-cell progress. Accept, or turn the route into SSE like the batch routes?
4. **Session-vs-session compare is not saved** (app.py:1628-1686). "Compare sessions" opens a live view that will not appear in the Studies list. Keep as a live view only?
5. The Context "Create and run now" with Whittle uses `POST /api/sequences/{id}/whittle`, which is one blocking request (app.py:2089-2095, runner.py:1024-1096); the study screen polls `GET /api/sequences/{id}` while it runs. Accept polling, or add an SSE whittle route?
6. The cost estimate prices every token at $5 per million regardless of model (runner.py:1216). Show it at all for non-Anthropic targets, or show tokens only?
