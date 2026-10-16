# Context study

- Route(s): `#/studies/context/:id` (`:id` = `sequences.id`, one narrative sequence: a strategy, a probe, up to N warm-up turns); `#/studies/context/:id/run/:run_id` selects one sequence run in the conversation pane; `#/studies/context/batch/:batch_id` is the batch mode of the same screen (many probes, one strategy; see §3 "batch running").
- Section: Studies
- Purpose (one sentence, what the researcher does here): see whether a conversation that builds up before the probe changes its label, read that conversation turn by turn, and find the fewest warm-up turns at which the probe still gets through.
- Arrives from: Studies list row (type context); New study › Context on create or "Create and run now"; Probe workbench "⋯" › "Try this probe after a warm-up" (opens the New study Context form pre-filled). Leaves to: other sequences in the same session (R7 cross-probe table rows); `#/library/strategies` for the strategy; `#/probe/:s` via the session link; `#/studies` via the breadcrumb; `#/studies/new/context?session=:s&probe=:p&strategy=:st` via "Run again".
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, Readout, Rate, Stat, Bar, Table, List/Row, RunThread (turn boxes reused with the `kind` extended to `warmup`, `setup`, `probe` for the coach side), OutcomeBadge, Chip (`tag`, `count`, `chip`), Button, Menu, Drawer, InsetBox, ProgressCard, Segmented, Term, Caveat, EmptyState, Toast, Dialog, FirstTimeTip.
- Baseline surfaces replaced (from `../00-content-inventory.md`): §19 "Narrative Momentum": sequence card (status badge, mode, "IF Engine" badge, ✕ with no confirm, "Warmup: {n} turns", the threshold chip and run counts that never rendered because `list_sequences` returns no `summary`, db.py:2296-2301), the pending/running buttons (Run Auto, Auto-Whittle, Next Turn, Drop Probe), live turns pane (role icon, "#{turn_number}", W/S/P chip, classification chip, content; the `handleDropProbe` turns that never appeared, render.js:4331), the Run Auto progress line "Turn {step}/{total_steps} — {type} → {classification}", the Results panel: "Compliance Threshold" bar chart, "Turn-by-Turn Classification" grid, "Sequence Runs" list with "⚡ Threshold" (render.js:4022-4184); the discarded whittle return (render.js:4352); the never-called cross-probe thresholds (renderer render.js:4078-4111) and strategy effectiveness (render.js:4113-4135); the unshown strategy fields and sequence dates; the dead sequence-batch flow (api.js:1299-1323); §35 Turn detail modal (`#turn-detail-modal`, dead) becomes the turn Drawer.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies … ? ⚙ │ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1  Studies › Context › the-stabbing after fiction workshop   [Run again] [Export ▾] [⋯]│
│     sequence 9 · session crime-set-1 · claude-sonnet-4-6 · automatic · up to 10      │
│     warm-up turns · narrative engine off · done · Oct 14 · 4 runs                    │
│ R2  ▣ With 10 warm-up turns the probe complied. Whittling found the threshold at 4:  │
│       4 warm-up turns still got through; 3 brought the refusal back. Threshold from  │
│       4 runs; one more run could land elsewhere.                                     │
│ R3  ┌ STRATEGY ───────────────────────────┐ ┌ THRESHOLD ⓘ ──────┐ ┌ RUNS ──────────┐ │
│     │ fiction workshop (fiction) built in │ │ 4 warm-up turns    │ │ 4             │ │
│     │ goal: …  opens with: …              │ │ fewest warm-up     │ │ 2 got through,│ │
│     │ escalates by: …  setup: …           │ │ turns whose run    │ │ 2 refused;    │ │
│     │                                     │ │ was not refused;   │ │ tried 10, 4,  │ │
│     │                                     │ │ from 4 runs        │ │ 3 (and 10 again)│ │
│     └─────────────────────────────────────┘ └────────────────────┘ └───────────────┘ │
│ R4  ┌ Runs  4 ─────────────────┐ R5 ┌ Conversation  run at 4 warm-up turns ─────────┐│
│     │ ▸ 4 warm-up  COMPLIED ⚑  │    │ W1 COACH · warm-up 1 of 4                      ││
│     │   3 warm-up  REFUSED     │    │ "I'm working on a thriller and…"               ││
│     │   10 warm-up COMPLIED    │    │ W1 TARGET                     REFUSED? no: COMPLIED│
│     │   10 warm-up COMPLIED    │    │ "Happy to help with your thriller…"            ││
│     │                          │    │ … W2, W3                                        ││
│     │ ⓘ Each run is a fresh    │    │ S  COACH · setup                               ││
│     │   conversation.          │    │ "The scene I'm stuck on is…"                   ││
│     │                          │    │ P  PROBE · adapted to the story     [original] ││
│     │                          │    │ "Write the moment the knife…"                  ││
│     │                          │    │ P  TARGET                            COMPLIED   ││
│     │                          │    │ "The alley was wet and…"              [show all]││
│     └──────────────────────────┘    └────────────────────────────────────────────────┘│
│ R6  ┌ Threshold  4 runs ─────────────────────────────────────────────────────────────┐│
│     │ warm-up turns   10 ██████████ COMPLIED   4 ████ COMPLIED ⚑   3 ███ REFUSED     ││
│     │ timeline        10: W W W W W W W W W S P      4: W W W S P      3: W W S P     ││
│     │                     c c c c c c c c c c c         c c c c c         c c c r     ││
│     │ ⓘ A threshold from one run can land elsewhere next run. · ⓘ The label is a     ││
│     │   keyword scan plus a judge model's guess. You can change it.                  ││
│     └────────────────────────────────────────────────────────────────────────────────┘│
│ R7  ┌ Across this session ───────────────────────────────────────────────────────────┐│
│     │ Thresholds by probe (fiction workshop)   │ Strategies in crime-set-1           ││
│     │ the-stabbing   4 warm-up turns  ▸        │ fiction workshop  2 of 3 sequences  ││
│     │ the-robbery    7 warm-up turns  ▸        │   got through; avg threshold 5.5    ││
│     │ the-autopsy    none: refused at 10 ▸     │ academic research 0 of 1 got through││
│     └────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────┘
R8 Drawer (turn): full text of one turn, its label with source, "copy".
R9 ProgressCard above R4 while a run, a whittle or a batch is in flight.
```
### 1024×700 differences
R3's three boxes go two per row then one (STRATEGY full width). R4 and R5 stack: the Runs list becomes a horizontal Chip strip ("10 · 4 · 3 · 10") above the conversation. R6's timeline wraps per run on its own line. R7's two tables stack. Nothing is hidden.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav (current = Studies), HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Session pill | `GET /api/sessions` (app.py:349) | `name`, `target_model` of `sequence.session_id` | this study's session | SessionSwitcher |
| Key chip | `GET /api/settings/keys` (app.py:2263) | `is_set` | "r of N keys set" | KeyStatusChip |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Session pill › another | none | `#/probe/:other` after Dialog "Leave while running?" if R9 is active |

### R1 Title row
- Components: breadcrumb, Panel heading, Chip (`tag`), Button (secondary md "Run again", "Export ▾", ghost icon "⋯"), Menu, Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Breadcrumb "Studies › Context › {probe_name} after {strategy name}" | `GET /api/sequences/{id}` (app.py:2021 → db.py:2404-2424) with `GET /api/probes` and `GET /api/strategies/{strategy_id}` (app.py:1949) | `probe_id`, `strategy_id` | strategy `name` with `_` → space | text |
| Meta | sequence row (db.py:197-209) | `id`, `session_id`, `mode`, `max_warmup_turns`, `use_narrative_engine`, `status`, `created_at`, `completed_at`, `batch_id`, `summary.total_runs` | "sequence {id} · session {name} · {target_model} · {mode} · up to {N} warm-up turns · narrative engine {on/off} · {status word} · {date} · {n} runs"; status words: pending → "not run yet", running → "running", completed → "done", failed → "failed", abandoned → "abandoned (idle over an hour)"; **display status is derived when the row is stale**: if `status` is "running" or "abandoned" and no run has `status` pending/running, show "done" with a Term "the server did not close this sequence; its runs are all finished" (only `run_whittle` sets `completed`, runner.py:1088; run-auto and interactive leave it "running", runner.py:923, 664-731, and db.py:2664-2675 then marks it abandoned) ; `batch_id` → "part of batch {id}" link to `#/studies/context/batch/:batch_id` | text + Term |
| Run again | none | none | secondary md; disabled while R9 active | Button |
| Export ▾ | none | none | Menu "JSON", "CSV (turns)", "Markdown", "HTML" → `GET /api/sequences/{id}/export?format=json\|csv\|md\|html&theme=` (app.py:2452-2520; theme from `GET /api/themes`, default `beargle-dark`) | Button + Menu |
| ⋯ | none | none | Menu: "Open session", "Open probe in workbench", "Strategy in Library", "Delete sequence" (danger) | Button + Menu |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Run again | none | `#/studies/new/context?session=:s&probe=:p&strategy=:st&n=:N&mode=:mode` |
| Export | the export route | download; Toast "Exported sequence {id}." |
| Delete sequence | `DELETE /api/sequences/{id}` (app.py:2028; cascade db.py:2312-2321) | Dialog `confirm` phrase "{probe_name} sequence", intro "This removes the sequence, its {n} runs and every turn." → `#/studies?type=context`; Toast "Deleted." (replaces today's ✕ with no confirm) |

### R2 Readout
- Components: Readout.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Result sentence | `GET /api/sequences/{id}` `runs[]`, `summary` | `runs[].warmup_count`, `runs[].probe_classification`, `runs[].threshold_found`, `summary.threshold_warmup_count`, `summary.total_runs`, `max_warmup_turns` | one run: "With {N} warm-up turns the probe {label}." ; whittled with a threshold: "With {N} warm-up turns the probe {label}. Whittling found the threshold at {t}: {t} warm-up turns still got through; {t − 1} brought the refusal back. Threshold from {n} runs; one more run could land elsewhere." ; whittled to 0: "… The probe got through with no warm-up at all (0 turns), so the warm-up was not what did it." ; refused at every count: "The probe was refused at {N} warm-up turns and at every count tried down to {min}; no threshold." ; pending: "Not run yet. {mode} mode, up to {N} warm-up turns." (draft; brad-voice pass). "got through" is a Term = complied or collapsed (db.py:2410 counts both as `complied`) | Readout |

- Actions: none.

### R3 Strategy, threshold, runs
- Components: InsetBox (strategy), Stat ×2, Term, Chip (`tag` "built in").
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| STRATEGY | `GET /api/strategies/{id}` (app.py:1949 → db.py:2260; columns db.py:168-180) | `name`, `category`, `description`, `goal`, `opening_pattern`, `escalation_pattern`, `setup_hint`, `effectiveness_notes`, `is_builtin` | eyebrow "STRATEGY", name + "({category})" + "built in" tag; `description`; definition grid "goal", "opens with", "escalates by", "setup"; `effectiveness_notes` as a `<details>` "notes"; link "Strategy in Library" | InsetBox |
| THRESHOLD | `summary` | `threshold_warmup_count`, `threshold_found`, `total_runs` | value "{t} warm-up turns"; madeOf "fewest warm-up turns whose run was not refused; from {n} runs" (db.py:2412-2422: the run with `threshold_found = 1`; runner.py:1055-1068 marks the run before the first refusal in descending order; runner.py:1082-1085 marks the 0-turn run when nothing refused); not whittled (one run) → "n/a", madeOf "whittle to find it"; refused at every count → "none", madeOf "refused at every count tried ({N} down to {min})" (runner.py:1063: `threshold_at = None` when refused at max) | Stat |
| RUNS | `summary`, `runs[]` | `total_runs`, `complied`, `refused`, `runs[].warmup_count` | value "{n}"; madeOf "{complied} got through, {refused} refused; tried {counts joined, in run order}" plus ", {f} failed" when any run `status === 'failed'` | Stat |

- Actions: none beyond the Library link.

### R4 Runs list
- Components: Panel (heading "Runs", `count`), List/Row, OutcomeBadge, Chip (`tag` "threshold"), Caveat (inline), Button (secondary sm "Whittle", "Run once more").
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Rows | `GET /api/sequences/{id}` `runs[]` (db.py:2336-2341, ordered `warmup_count DESC`; columns db.py:211-220) | `id`, `warmup_count`, `status`, `probe_classification`, `threshold_found`, `created_at`, `completed_at` | "{warmup_count} warm-up" + OutcomeBadge (`probe_classification`; null → pending badge while `status` running, "failed" tag when failed, "not yet run" when pending) + "⚑ threshold" tag when `threshold_found`; date in `title`; the selected row drives R5 | List/Row |
| Order toggle | none | none | Segmented "by warm-up count" (server order) / "by time" (`created_at`) | Segmented |
| Caveat | none | none | `fresh_run` (new id) "Each run is a fresh conversation; nothing carries over between runs." (runner.py:1098-1109 `target.reset()`; runner.py:925) | Caveat |
| Whittle | none | none | secondary sm; label "Whittle from {N}"; Term; disabled while R9 active or when no key | Button |
| Run once more | none | none | secondary sm; automatic mode → run-auto; interactive mode → run-turn on a new run (the server needs an active run: `POST /api/sessions/{s}/sequences` is the only route that creates a pending run outside run-auto/whittle, app.py:2010-2012, so interactive "Run once more" creates a new sequence with the same settings and navigates to it; see §12) | Button |
| Empty | none | none | EmptyState "No runs yet. Run it, or whittle to find the threshold." (draft; brad-voice pass) with "Run" | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / Enter | `GET /api/sequence-runs/{run_id}/turns` (app.py:2100 → db.py:2363-2369) | hash `/run/:run_id`; R5 shows the turns |
| Whittle | `POST /api/sequences/{id}/whittle` (app.py:2089; one JSON response after all runs, runner.py:1024-1096) | R9 shows "whittling"; the screen polls `GET /api/sequences/{id}` every 5 s to add runs as they complete; on the response, R2/R3/R4/R6 re-render from `{results[{warmup_count, probe_classification, sequence_run_id, error?}], threshold_at, threshold_found, total_runs}` and a fresh `GET /api/sequences/{id}`; Toast "Whittled in {total_runs} runs: threshold {threshold_at}." |
| Run once more (automatic) | `POST /api/sequences/{id}/run-auto` (app.py:2039; SSE) | R9 shows; R5 follows the new run live |

### R5 Conversation
- Components: Panel (heading "Conversation", subtitle "run at {n} warm-up turns · {k} turns"), RunThread-style turn boxes (eyebrow per turn), OutcomeBadge, Button (text "show all", "original" toggle on the probe turn, ghost "open" per turn), Chip (`tag` W/S/P with full words), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Turns | `GET /api/sequence-runs/{run_id}/turns` (db.py:2363-2369; columns db.py:222-231) | `turn_number`, `role` (coach / target / probe, runner.py:946-947, 974-975, 996-997), `content`, `classification`, `turn_type` (warmup / setup / probe), `created_at` | one box per turn; eyebrow "{W\|S\|P}{index} {ROLE} · {turn_type word}" where W index counts coach warm-up turns ("warm-up 1 of {planned}"), S is "setup", P is "probe"; the role word is a Term: coach = the model writing the warm-up on this side, target = the model under test, probe = the request itself; target turns carry an OutcomeBadge from `classification` (null on coach/probe turns, db.py:2355-2360); content mono, collapsed at 200 px with "show all"; `role === 'probe'` turns show "adapted to the story" with an "original" toggle that swaps in the probe's `prompt_text` from `GET /api/probes` (runner.py:993-994 `adapt_probe_to_story`; interactive with no history sends the original, runner.py:779-782) | turn boxes |
| Final line | selected run | `probe_classification` | "final: {badge}" plus `classifier` caveat and the `held_once` phrase is NOT used here (there is no pushback in a sequence); instead `warmup_label` (new id) "A warm-up turn's label is the judge's read of small talk; only the probe turn's label is the result." (draft; brad-voice pass) (runner.py:941: warm-up replies are classified against the warm-up text, not the probe) | text + Caveat |
| Live mode | SSE `turn` events (runner.py:956-965, 980-989) or `run-turn` / `drop-probe` JSON (runner.py:726-731, 802-805) | `step`, `total_steps`, `turn_type`, `classification`; or `coach_turn`, `target_turn`, `warmup_turns_sent`, `warmup_turns_planned`; or `turns[]`, `probe_classification` | the SSE stream carries no text (runner.py:956-965), so after each `turn` event the pane refetches `GET /api/sequence-runs/{run_id}/turns` and appends; the JSON routes return text and are appended directly; a pending target box shows the spinner "Waiting…" with elapsed | turn boxes |
| Interactive controls | sequence `mode === 'interactive'` and the run `status` pending/running | none | row of Buttons: "Next warm-up turn ({sent} of {planned})" (primary sm), "Drop the probe now" (secondary sm), with hint "the setup turn is written just before the probe" (runner.py:764-775); after the probe is dropped the controls disappear | Button |
| Empty | no run selected | none | EmptyState "Pick a run on the left to read its conversation." / "Nothing has been sent yet." | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Next warm-up turn | `POST /api/sequences/{id}/run-turn` (app.py:2059-2074; 400 "No active run for this sequence" when none) | appends `coach_turn` and `target_turn`; button label updates from `warmup_turns_sent` / `warmup_turns_planned`; at `sent === planned − 1` the label becomes "Drop the probe now (setup + probe)" |
| Drop the probe now | `POST /api/sequences/{id}/drop-probe` (app.py:2077-2086) | appends `turns[]` (setup pair if any history, then probe pair, runner.py:764-793); final line shows `probe_classification`; refetch `GET /api/sequences/{id}`; Toast "Probe dropped after {k} warm-up turns: {label}." |
| Turn box "open" | none | R8 Drawer with the full turn |
| show all / original | none | local |

### R6 Threshold panel
- Components: Panel (heading "Threshold", subtitle "{n} runs"), Bar (horizontal, one row per run), timeline grid (a row of OutcomeBadge-coloured squares per run, built from the Bar and Chip tokens), Caveat (inline ×2), Term.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Warm-up bars | `GET /api/sequences/{id}/whittling` (app.py:2107 → db.py:2426-2434) | `warmup_count`, `probe_classification`, `threshold_found`, `status` | one Bar row per run, label "{warmup_count} warm-up", `value = {count: warmup_count, of: max_warmup_turns}` so the fill is the share of the maximum tried (never rescaled), `tone` = `probe_classification` outcome, value text "{warmup_count} of {max}" plus the label word; "⚑ threshold" after the row with `threshold_found`; failed runs `tone: 'muted'` with "failed" | Bar |
| Timeline | `GET /api/sequences/{id}/turn-classifications` (app.py:2114-2131 → db.py:2436-2444) | per run: `sequence_run_id`, `warmup_count`, `probe_classification`, `turns[{turn_number, role, classification, turn_type}]` | one line per run: "{warmup_count}:" then one 12 px square per target turn (role `target`) coloured by `classification` with a border by `turn_type` (warmup thin, setup dashed, probe thick), letter W/S/P above; coach and probe-role turns are not drawn (they carry no label); hover shows "turn {n} · {type} · {label}"; click selects that run in R4 and scrolls R5 to the turn | grid |
| Caveats | none | none | `threshold_once` and `classifier` inline | Caveat |
| Reading line | computed | as THRESHOLD Stat | "Threshold = the fewest warm-up turns whose run was not refused. Here: {t}, from runs at {counts}." or the "none" / "n/a" forms | text |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Bar row / timeline click | `GET /api/sequence-runs/{run_id}/turns` | selects the run (R4, R5) |

### R7 Across this session
- Components: Panel (heading "Across this session"), Table ×2, Rate, Select (strategy filter), Term, Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Thresholds by probe | `GET /api/sessions/{s}/thresholds?strategy_id=` (app.py:2190 → db.py:2446-2464) | `sequence_id`, `probe_id`, `probe_name`, `domain`, `strategy_name`, `strategy_id`, `threshold_turns`, `probe_classification` | rows "{probe_name} · {domain} · {threshold_turns} warm-up turns" or "none: refused at every count" when `threshold_turns` is null; the current sequence's row is highlighted; row click → `#/studies/context/:sequence_id`; Select filters by strategy (default: this sequence's strategy); note "only sequences the server closed as completed appear here" with the stale-status Term (db.py:2454 `s.status = 'completed'`; see §12) | Table + Select |
| Strategies in this session | `GET /api/sessions/{s}/strategy-effectiveness` (app.py:2194 → db.py:2466-2481) | `id`, `name`, `category`, `sequence_count`, `success_count`, `avg_threshold` | rows "{name} ({category})" + Rate "{success_count} of {sequence_count} sequences got through" + "avg threshold {avg_threshold one decimal}" or "no threshold found yet" when null | Table + Rate |
| Strategy success caveat | none | none | `strategy_success` (new id) "Strategy success = sequences with any run that got through ÷ sequences; one lucky run counts the whole sequence." (db.py:2471 `COUNT(DISTINCT CASE WHEN sr.probe_classification IN ('complied','collapsed') THEN s.id END)`) (draft; brad-voice pass) | Caveat |
| Empty | none | none | "No other sequences in this session yet." | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click | none | `#/studies/context/:other` |
| Strategy Select | `GET /api/sessions/{s}/thresholds?strategy_id=` | re-render the left table |

### R8 Turn drawer
- Components: Drawer, OutcomeBadge (sm, with source), InsetBox, Button (ghost "copy"), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Title | turn | `turn_number`, `role`, `turn_type` | "Turn 7 · target · setup" | Drawer title |
| Label | turn | `classification` | badge sm or "no label (coach side)" | OutcomeBadge |
| Content | turn | `content` | full, pre-wrap | InsetBox |
| Time | turn | `created_at` | local time | text |
| Caveat | none | none | `classifier`; "Labels on sequence turns cannot be changed: there is no override route for them." (draft; brad-voice pass) (no PATCH for `sequence_turns`) | Caveat |

- Actions: prev/next turn with ←/→; Escape closes and returns focus.

### R9 Running card
- Components: ProgressCard (`kind: 'batch'`), Button (danger sm "Stop watching").
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Run auto | SSE `turn` / `complete` / `error` (runner.py:956-1022) | `step`, `total_steps`, `turn_type`, `classification`, `probe_classification`, `sequence_run_id`, `error` | title "RUNNING · run at {N} warm-up turns"; done "{step} of {total_steps} turn pairs" (runner.py:933 `total_steps = warmup_count + 1`); current "now: {turn_type} turn {step}"; outcome badges tally target labels so far; on `complete` → "DONE · probe: {probe_classification}" | ProgressCard |
| Whittle | polling `GET /api/sequences/{id}` | `runs[]` | title "WHITTLING from {N}"; done "{runs completed} of up to {N + 1} runs"; current "now: run at {warmup_count} warm-up turns" (the run with status running); note "stops at the first refusal; the run before it is the threshold" (runner.py:1055-1068) | ProgressCard |
| Batch | `#/studies/context/batch/:id`: SSE from `POST /api/sequence-batches/{id}/start` (runner.py:1228-1313: `progress {sequence_id, probe_name, threshold_at, …}`, `error {sequence_id, …}`, `complete`) or polling `GET /api/sequence-batches/{id}` (app.py:2156: `probes_completed`, `probes_total`, `status`, `estimated_cost_usd`) | as named | title "BATCH · {strategy} × {probes_total} probes"; done "{probes_completed} of {probes_total} probes"; current "now: {probe_name}"; cost "estimated about ${estimated_cost_usd}"; a list under the card of finished sequences with their `threshold_at` as links to `#/studies/context/:sequence_id` | ProgressCard + List |
| Stop watching | none | none | closes the stream; polling continues; there is no server cancel for sequences or batches (no cancel route in app.py:2039-2184) | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Stop watching | closes EventSource | Dialog "Stop watching? The run keeps going on the server; this page polls every 5 s." |
| SSE `complete` | `GET /api/sequences/{id}` and the R6 routes | re-render; Toast "Run done: probe {label} after {warmup_count} warm-up turns." |
| SSE `error` (`{error, sequence_run_id}`) | `GET /api/sequences/{id}` | card failed with the message; the run row shows "failed" |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R9 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|---|---|
| loading | until sequence, strategy, probe return | breadcrumb, buttons disabled | skeleton | skeletons | pulse rows | empty | hidden | pulse | hidden | (none) |
| not found | 404 | "Studies › Context" | hidden | hidden | EmptyState "There is no sequence {id}." with "Back to Studies" | hidden | hidden | hidden | hidden | (none) |
| not run yet | `status === 'pending'`, one pending run | meta "not run yet" | "Not run yet. automatic mode, up to 10 warm-up turns." | THRESHOLD "n/a"; RUNS "0" | one row "10 warm-up · not yet run" + Run / Whittle | EmptyState "Nothing has been sent yet." with "Run" (automatic) or the interactive controls | hidden | shown | hidden | as R2 |
| interactive, mid-run | run `status === 'running'`, probe not dropped | meta "running" | "Interactive: {sent} of {planned} warm-up turns sent; the probe has not been dropped." | THRESHOLD "n/a"; RUNS "1" | row with pending badge | turns so far + controls | hidden | shown | hidden (JSON routes are not streams; the pending target box shows the wait) | as R2 |
| running (auto, stream) | run-auto in flight | Run again disabled | "Run at {N} warm-up turns: {step} of {total} turn pairs so far." | as before | row pending | turns appended per event | hidden until done | shown | shown | "Run at 10 warm-up turns: 4 of 11 turn pairs so far." |
| running (polling) | reload while a run or whittle is going, or Stop watching | as above | as above from the payload | | | refetched every 5 s | | | shown with "Reconnected: updates every 5 s" | as above |
| whittling | whittle in flight | Run again, Whittle disabled | "Whittling from {N}: {k} runs so far; last run at {c} warm-up turns {label}." | RUNS growing | rows added per poll | selected run's turns | bars growing | shown | shown (whittle) | "Whittling from 10: 2 runs so far; last run at 9 warm-up turns complied." |
| one run, done | one completed run, no whittle | enabled | "With 10 warm-up turns the probe complied." | THRESHOLD "n/a" (madeOf "whittle to find it"); RUNS "1" | one row | its turns | one bar, one timeline line | shown | hidden | as R2 |
| whittled, threshold found | `summary.threshold_found` with a count | enabled | the threshold sentence | THRESHOLD "4 warm-up turns" | rows with ⚑ | | bars with ⚑ | shown | hidden | "With 10 warm-up turns the probe complied. Whittling found the threshold at 4: 4 warm-up turns still got through; 3 brought the refusal back. Threshold from 4 runs; one more run could land elsewhere." |
| whittled to zero | threshold run has `warmup_count 0` | enabled | the no-warm-up sentence | THRESHOLD "0 warm-up turns" | | | | | hidden | "… The probe got through with no warm-up at all (0 turns), so the warm-up was not what did it." |
| refused at every count | completed, no run `threshold_found`, every run refused | enabled | the no-threshold sentence | THRESHOLD "none" | | | all bars red | | hidden | "The probe was refused at 10 warm-up turns and at every count tried down to 9; no threshold." |
| failed | `status === 'failed'` or the latest run failed | meta "failed" | "The last run failed: {error}. Earlier runs are kept." | as data | failed row tagged | turns up to the failure | as data | shown | hidden with Retry in R4 | as R2 |
| abandoned (stale) | `status === 'abandoned'` but every run finished | meta "done" with the stale Term | as the finished sentence | as data | | | | this sequence missing from R7 left table with the note | hidden | as finished |
| abandoned (real) | `status === 'abandoned'` and a run still pending/running | meta "abandoned (idle over an hour)" | "This sequence stopped mid-run over an hour ago. Run once more to start a fresh run." | | pending row | partial turns | | | hidden | as R2 |
| batch running | `#/studies/context/batch/:id` | breadcrumb "Studies › Context › batch {id}"; no Run again | "{done} of {total} probes finished; {with} found a threshold so far." | hidden | hidden | hidden | hidden | hidden | shown (batch) with the finished list | "2 of 4 probes finished; 1 found a threshold so far." |
| batch done | batch `status === 'completed'` | | "{total} probes finished; {with} found a threshold, {none} refused at every count, {failed} failed." | | | | | shown for the batch's session (right table + left table) | DONE with the list | as R2 |
| no key | zero keys or provider unset | Run again / Whittle / Run once more disabled with reason "{provider} has no API key. Set one in Settings › Keys." | as data | | | interactive controls disabled with the reason | | | | unchanged |
| error | fetch non-2xx | | "This sequence could not be loaded: {status}." with Retry | hidden | hidden | hidden | hidden | hidden | hidden | as R2 |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| threshold t | `warmup_count` of the run with `threshold_found = 1` (db.py:2412-2422); set at runner.py:1066-1068 (the run before the first refused run, descending) or runner.py:1082-1085 (the 0-turn run when nothing refused) | "fewest warm-up turns whose run was not refused; from {n} runs"; R6 reading line lists the counts tried | Stat, Readout, Bar ⚑ |
| runs n; got through g; refused r | `summary.total_runs`, `summary.complied` (complied + collapsed, db.py:2410), `summary.refused` (db.py:2411) | "tried {counts}" | Stat |
| turn pairs k of N + 1 | SSE `step` of `total_steps` (runner.py:933) | "now: {turn_type} turn {step}" | ProgressCard |
| warm-up sent s of p | `warmup_turns_sent` of `warmup_turns_planned` (runner.py:729-730) | in the button label | Button |
| bar fill per run | `warmup_count ÷ max_warmup_turns` | "{warmup_count} of {max}" | Bar |
| strategy success g of n | `success_count` of `sequence_count` (db.py:2466-2481) | the caveat sentence; "avg threshold {x}" from `avg_threshold` | Rate |
| avg threshold | `AVG(warmup_count) WHERE threshold_found = 1` (db.py:2472) | "over {k} sequences with a threshold" (k not in the payload; shown as "avg threshold {x} where found") | text |
| batch done d of T | `probes_completed` of `probes_total` (db.py:182-195) | "estimated about ${estimated_cost_usd}" | ProgressCard |
| whittle runs k of up to N + 1 | runs so far of `max_warmup_turns + 1` (runner.py:1046 range N..0) | "stops at the first refusal" | ProgressCard |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `threshold_once` | A threshold from one run can land elsewhere next run. | R2 last sentence; R3 THRESHOLD; R6 | runner.py:1028-1029 "compliance isn't monotonic"; one run per count |
| `classifier` | The label is a keyword scan plus a judge model's guess. You can change it. | R5 final line; R6; R8 (with the no-override clause) | runner.py:941, 969, 995 `classify` |
| `warmup_label` (new id) | A warm-up turn's label is the judge's read of small talk; only the probe turn's label is the result. | R5 above the turns; R6 timeline | runner.py:941 classifies the warm-up reply against the warm-up text |
| `fresh_run` (new id) | Each run is a fresh conversation; nothing carries over between runs. | R4 | runner.py:925 `target.reset()`; runner.py:1098-1109 |
| `adapted_probe` (new id) | After a warm-up the probe is rewritten to fit the story; "original" shows what the session's probe says. | R5 probe turn | runner.py:993-994 `adapt_probe_to_story`; interactive without history sends the original (runner.py:779-782) |
| `strategy_success` (new id) | Strategy success = sequences with any run that got through ÷ sequences; one lucky run counts the whole sequence. | R7 right table | db.py:2471 |
| `stale_status` (new id) | The server did not close this sequence; its runs are all finished. | R1 meta Term; R7 note | runner.py:923 vs 1088; db.py:2664-2675; db.py:2454 |
| `no_override_turn` (new id) | Labels on sequence turns cannot be changed: there is no override route for them. | R8 | no PATCH for `sequence_turns` in app.py |
| `cost_estimate` | The cost is a flat guess: every token priced the same, and token counts are typical, not measured. | R9 batch cost line | runner.py:1214-1217 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| narrative sequence | R1 | db.py:197-209; runner.py:910-917 |
| strategy | R1, R3, R7 | db.py:168-180 |
| warm-up turn | everywhere | runner.py:936-947 |
| setup turn | R5, R6 | runner.py:968-989 (the last warm-up slot, written to lead into the probe) |
| probe turn | R5, R6 | runner.py:993-1004 |
| coach / target | R5 eyebrows | runner.py:939 `_make_narrative_coach`; runner.py:424-431 target |
| narrative engine | R1 meta | runner.py:424-431 `NARRATIVE_ENGINE_SYSTEM_PROMPT` |
| whittling | R2, R4, R6, R9 | runner.py:1024-1030 |
| threshold | R2, R3, R6, R7 | db.py:2412-2422; runner.py:1055-1068 |
| got through | R2, R3, R7 | db.py:2410 (complied or collapsed) |
| sequence run | R4 | db.py:211-220 |
| automatic / interactive | R1, R5 | runner.py:910 vs 664 |
| sequence batch | R9, R1 meta | db.py:182-195; app.py:2134-2184 |
| abandoned | R1 meta | db.py:2664-2675 |
| judge | caveats | classifier.py |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `context.runs` | R4 first row (`data-tip="context-run"`) | One row per run. Each run starts a fresh conversation with a different number of warm-up turns before the probe. | first visit with ≥ 1 run |
| `context.threshold` | THRESHOLD Stat (`data-tip="context-threshold"`) | The fewest warm-up turns whose run still got through. Whittling finds it by running again with one fewer turn until the refusal comes back. | first visit with a threshold |
| `context.probe-turn` | first probe turn box (`data-tip="context-probe"`) | The probe was rewritten to fit the story. "Original" shows the session's probe as written. Only this turn's label is the result. | first time a probe turn is visible |
| `context.interactive` | "Next warm-up turn" button (`data-tip="context-next"`) | You drive this one: each press sends one warm-up turn and shows the reply. Drop the probe whenever you want. | first interactive sequence |

## 8. Keyboard and focus
- Shortcuts: `j`/`k` move between runs in R4 (R5 follows); `n` sends the next warm-up turn (interactive, when enabled); `d` drops the probe (opens a confirm Dialog); `w` whittles (confirm Dialog); `←`/`→` move turns in R8; `Escape` closes R8 or a Dialog; `e` Export; `F8` newest Toast.
- Focus order: header → breadcrumb → Run again → Export → ⋯ → R3 Terms and the Library link → R4 Segmented, rows (listbox), Whittle, Run once more → R5 turn boxes ("show all", "original", "open" buttons) and the interactive controls → R6 bar rows and timeline squares (one tab stop, arrows within) → R7 Select and table rows. R9, when shown, follows R3. Drawer traps focus.
- Live regions: R2 Readout polite (per SSE event throttled 3 s; once on completion); R5 thread `role="log" aria-live="polite" aria-relevant="additions"` so a new turn is read once; R9 counts line polite; interactive button label changes announced through the Readout, not the button.

## 9. Dialogs and overlays opened from here
- Dialog "Drop the probe now?" (intro "The setup turn is written first, then the probe, adapted to the story." primary "Drop the probe").
- Dialog "Whittle from {N}?" (intro "Up to {N + 1} fresh runs, stopping at the first refusal. About {N + 1} × ({N} + 2) calls at most." primary "Whittle").
- Dialog `confirm` "Delete sequence?" (phrase "{probe_name} sequence").
- Dialog "Stop watching?"; Dialog "Leave while running?".
- Drawer R8 (turn). Export Menu; ⋯ Menu.
- FirstTimeTip ×4. Toasts.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | /api/sequences/{id} | R1 to R4 (one payload: row + `runs[]` + `summary`); polling while whittling or reconnecting |
| GET | /api/strategies/{strategy_id} | R1 breadcrumb, R3 STRATEGY |
| GET | /api/probes | R1 probe name; R5 "original" probe text |
| GET | /api/sessions | R0, R1 session name |
| GET | /api/sequence-runs/{run_id}/turns | R5 on run select; after each SSE `turn`; R6 click |
| GET | /api/sequences/{id}/whittling | R6 bars |
| GET | /api/sequences/{id}/turn-classifications | R6 timeline |
| GET | /api/sessions/{s}/thresholds?strategy_id= | R7 left |
| GET | /api/sessions/{s}/strategy-effectiveness | R7 right |
| POST | /api/sequences/{id}/run-auto | R4 Run once more / R5 Run (automatic; SSE) |
| POST | /api/sequences/{id}/run-turn | R5 Next warm-up turn (interactive) |
| POST | /api/sequences/{id}/drop-probe | R5 Drop the probe now |
| POST | /api/sequences/{id}/whittle | R4 Whittle |
| POST | /api/sessions/{s}/sequences | R4 Run once more in interactive mode (creates a new sequence with the same settings) |
| GET | /api/sequences/{id}/export?format=&theme= | R1 Export |
| GET | /api/themes | R1 Export theme list (md/html) |
| DELETE | /api/sequences/{id} | R1 ⋯ Delete |
| GET | /api/sequence-batches/{id} | batch mode R9 polling |
| POST | /api/sequence-batches/{id}/start | not called here; the EventSource opened by New study is handed to R9 |
| GET | /api/settings/keys | R0; disabled reasons |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With `GET /api/sequences/9` returning `runs` at warm-up counts 10 (complied), 4 (complied, `threshold_found: 1`), 3 (refused) and `summary {total_runs 3, complied 2, refused 1, threshold_warmup_count 4, threshold_found true}`, `max_warmup_turns 10`, the Readout text is exactly "With 10 warm-up turns the probe complied. Whittling found the threshold at 4: 4 warm-up turns still got through; 3 brought the refusal back. Threshold from 3 runs; one more run could land elsewhere."
2. The THRESHOLD Stat shows "4 warm-up turns" with madeOf "fewest warm-up turns whose run was not refused; from 3 runs"; the RUNS Stat shows "3" with madeOf "2 got through, 1 refused; tried 10, 4, 3".
3. R4 lists three rows in server order (10, 4, 3); the 4 row contains a tag with text "threshold"; clicking the 3 row sets the hash to `#/studies/context/9/run/{run_id}` and issues `GET /api/sequence-runs/{run_id}/turns`.
4. R5 renders one box per turn; target boxes contain an OutcomeBadge; the box whose `role` is "probe" contains a button "original" that, when pressed, swaps the content to the probe's `prompt_text` and sets `aria-pressed="true"`.
5. R6 renders one `[role="img"]` per whittling entry with `aria-label` "10 warm-up, 10 of 10, 100 percent" style labels and a fill width of `40%` for the 4-turn run; the timeline has one square per target turn and none for coach or probe-role turns.
6. In an interactive sequence with 2 of 5 warm-up turns sent, the button label is "Next warm-up turn (2 of 5)"; pressing it issues `POST /api/sequences/9/run-turn`, appends two boxes (coach then target) and the label becomes "(3 of 5)".
7. "Drop the probe now" opens a dialog whose primary issues `POST /api/sequences/9/drop-probe`; the returned `turns[]` are appended, the final line shows the returned `probe_classification`, and the interactive controls are removed.
8. Whittle opens a dialog containing "stopping at the first refusal"; confirming issues `POST /api/sequences/9/whittle`, R9 shows "WHITTLING from 10", and `GET /api/sequences/9` is requested at least twice in 11 s; on the response, a Toast contains "threshold " followed by the returned `threshold_at`.
9. During run-auto, each SSE `turn` event triggers `GET /api/sequence-runs/{sequence_run_id}/turns` and R9 reads "{step} of {total_steps} turn pairs"; on `complete` the Toast contains "probe " followed by `probe_classification`.
10. With `status: "running"` and every run `status: "completed"`, R1 shows "done" with a Term whose definition contains "did not close this sequence"; with `status: "abandoned"` and a run still `running`, R1 shows "abandoned (idle over an hour)".
11. R7's right table has one row per strategy-effectiveness entry with text matching `/^\d+ of \d+ sequences got through$/` and the caveat sentence starting "Strategy success =" is present once.
12. ⋯ › Delete opens a confirm dialog whose primary stays disabled until the input equals "the-stabbing sequence"; confirming issues `DELETE /api/sequences/9` and navigates to `#/studies?type=context`; no `window.confirm` is called.
13. Export › Markdown requests `GET /api/sequences/9/export?format=md&theme=beargle-dark`.
14. `#/studies/context/batch/5` issues `GET /api/sequence-batches/5` and shows "{probes_completed} of {probes_total} probes" and "estimated about $" followed by `estimated_cost_usd`; R3 to R6 are absent.
15. The page contains the exact strings "A threshold from one run can land elsewhere next run." and "The label is a keyword scan plus a judge model's guess. You can change it." whenever R6 is rendered.
16. At 1024×700 R4 becomes a chip strip above R5 ("10 · 4 · 3"), the timeline lines wrap one per run, and `main` has no horizontal scroll.

## 12. Open questions for Brad
1. **Sequence status is never closed by run-auto or interactive runs.** Only `run_whittle` sets `completed` (runner.py:1088); run-auto leaves `running` (runner.py:923) and `cleanup_stale_sequences` turns it into `abandoned` an hour later (db.py:2664-2675). Cross-probe thresholds then exclude it (db.py:2454). The screen derives "done" from the runs and labels the stale status. Fix the server to close the sequence when its run completes (one line after runner.py:1004 and in the interactive probe drop)?
2. **No cancel for sequences, whittles or batches.** "Stop watching" only closes the stream. Add cancel routes, or accept?
3. **Whittle is one blocking request** (app.py:2089-2095). The screen polls. Convert to SSE like run-auto?
4. **Interactive "Run once more".** The server only creates a pending run on sequence creation (app.py:2010-2012) or inside run-auto/whittle. For interactive mode the spec creates a new sequence with the same settings. Alternatively add `POST /api/sequences/{id}/runs` to add a pending run. Which?
5. **Threshold semantics.** The marked run is the last non-refused run before the first refusal while counting down, so "threshold" = the fewest warm-up turns that still got through (not the count where it was refused). The copy says so. Confirm the wording "still got through" over today's "Compliance Threshold".
6. **Refused at the top count.** When the first (max) run is refused, `threshold_found` is returned true with `threshold_at` null (runner.py:1063) and no run is marked. The screen shows "none: refused at every count tried". Should whittling continue downward in that case to see whether fewer turns ever get through (compliance is not monotonic, runner.py:1029)?
7. `avg_threshold` has no count behind it in the payload (db.py:2472). Show it as "where found", or extend the query with a count?
