# Experiment

- Route(s): `#/experiments/:id` (Overview), `#/experiments/:id/conditions`, `#/experiments/:id/responses`, `#/experiments/:id/analysis`, `#/experiments/:id/export`
- Section: Experiments
- Purpose (one sentence, what the researcher does here): run one experiment and read what it found: how far it has run and what it will cost, how each condition's responses differ (rates, lexical metrics, the responses themselves), the statistics for every condition pair with their corrections, and the files to take away.
- Arrives from: `#/experiments` row; `#/experiments/new` after Create; Home "recent" and "anything running"; Results list rows; the Running-now card anywhere. Leaves to: `#/experiments` ("← Experiments"); `#/settings#keys` from a no-key reason; `#/library/probes` from a probe name (Responses drawer); header nav.
- Components used (names from `../03-components.md`): Header set (§1), Tabs (§2.2), Split (§2.1, Responses), Panel (§2.3), InsetBox (§2.4), EmptyState (§2.6), Readout (§3), Term (§4), Caveat (§5), Rate (§6), Stat (§7), OutcomeBadge (§8), LabelControl (§9, display-only here, see §12 Q1), Bar (§10), DivergingBar (§11), Table (§12), List/Row (§13), Button (§15), Input/Select/Segmented/Checkbox (§16), Chip (§17), Dialog (§18), Drawer (§19), Menu (§20), Toast (§21), FirstTimeTip (§22), LoadingScreen/Progress (§24), RunThread (§26, one-turn thread in the Responses drawer), ProgressCard (§28).
- Baseline surfaces replaced (from `../00-content-inventory.md`): §32 Experiment dashboard (experiment.js:440-547); §33 Results / "Statistical Analysis" / Export (experiment.js:551-784); §34 Condition Comparison dashboard (render.js:1898-2203, 2881-3058; api.js:1787-1822); the "Condition Experiment #{id}" card on Framing Variants › Results (render.js:1807-1824). Fixes carried: the dashboard read `{experiment, conditions, progress}` as if it were the experiment (experiment.js:868-870; app.py:2794-2802); results called `/results` (404) instead of `/responses` (experiment.js:807-822; app.py:3053-3074); every export button fetched `/export` and saved one JSON under `.csv`/`.jsonl`/`.md` (experiment.js:1004-1016; app.py:3101-3117); `/progress` was opened as an `EventSource` though it returns JSON (experiment.js:119-148; app.py:2945-2948); Start was sent without the required body (experiment.js:949; models.py:388-392); the comparison computed `compliance_rate` and the classification bar and never showed them (render.js:2024-2030, 1939-1959); the metric table showed a UI-computed "largest d" and "smallest p" across pairs (render.js:2063-2096), replaced by the per-pair listing on Analysis.

Shared frame for every tab:
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies Experiments … ? ⚙│ R1
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ← Experiments   tone-vs-none   [running]   Does a clinical register change refusals…   ⋯  │
│ R3 Overview   Conditions 3   Responses 11   Analysis   Export                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4… tab body (scrolls)                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
R1 Header · R2 Title row · R3 Tabs · R4 onwards: per tab. All tabs share one load: `GET /api/experiments/{id}` → `{experiment, conditions[], progress}` (app.py:2794-2802). Tab counts: Conditions = `conditions.length`; Responses = `progress.completed` (db.py:3478-3479).

### R2 Title row
| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| ← Experiments | none | — | ghost sm | Button |
| Name | `GET /api/experiments/{id}` | `experiment.name` | `text-sm font-semibold text-zinc-100`; truncate at 48 chars with title | text |
| Status chip | same | `experiment.status` (models.py:205-210) | tag; "completed" shown as "done" with Term; "running" with no store entry shows "running (interrupted)" (see `experiments-list.md` §5) | Chip + Term |
| Description | same | `experiment.description` | `text-xs text-zinc-400`, one line, title full | text |
| ⋯ Menu | none | — | Rename or describe (`PUT /api/experiments/{id}`, app.py:2805-2812), Delete (confirm Dialog, `DELETE`, app.py:2815-2820), Copy experiment id | Menu |

### R3 Tabs
Tabs (§2.2) with ids `overview`, `conditions`, `responses`, `analysis`, `export`; the active tab is the route suffix; `count` on Conditions and Responses. Keyboard per the component (Left/Right, Home/End); `Alt+1`…`Alt+5` select a tab from anywhere on the screen.

---

## Tab: Overview

### 1. Wireframe, 1280×800
```
Experiment created, prompts added, not started (status draft)
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ R1 header · R2 ← Experiments  tone-vs-none  [draft]  Does a clinical register change…    ⋯    │
│ R3 Overview ▁▁  Conditions 2   Responses 0   Analysis   Export                                │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4 ┌ Before you start ──────────────────────────────────────────────────────────────────────┐ │
│    │ ▣ In plain words: 4 probes × 2 conditions × 2 models = 16 cells. The server puts the  │ │
│    │   cost at about $0.17 if every cell is 500 tokens in and 1 000 out, averaged over     │ │
│    │   four providers' list prices. Both keys you need are set.                            │ │
│    │ ┌ CELLS ───────────┐ ┌ EST. COST ─────────────────┐ ┌ KEYS ──────────────────────────┐ │ │
│    │ │ 16               │ │ about $0.17                │ │ 2 of 2 needed                  │ │ │
│    │ │ 4 prompts × 2    │ │ 16 cells × (500 in + 1 000 │ │ anthropic set · openai set     │ │ │
│    │ │ conditions × 2   │ │ out tokens) at the mean of │ │                                │ │ │
│    │ │ models           │ │ 4 providers' list prices   │ │                                │ │ │
│    │ └──────────────────┘ └────────────────────────────┘ └────────────────────────────────┘ │ │
│    │ ⓘ The estimate ignores which models you picked: it averages Anthropic, OpenAI, Google │ │
│    │   and Together list prices from the code, not live prices. Treat it as an order of   │ │
│    │   magnitude.                                                                          │ │
│    │ CONCURRENCY per provider  anthropic [5] openai [5] google [3] together [3] ollama [3] │ │
│    │ [▶ Start experiment]   [Add prompts ▾]                                                │ │
│    │ ⓘ Closing or reloading Flinch stops a run. Finished cells are kept; you can resume.  │ │
│    └────────────────────────────────────────────────────────────────────────────────────────┘ │
│ R5 ┌ Setup ─────────────────────────────────────────────────────────────────────────────────┐ │
│    │ CONDITIONS   1 baseline "You are a helpful assistant."                                 │ │
│    │              2 clinical-register "You are a clinical writing assistant. Keep a neutr…" │ │
│    │ MODELS       claude-sonnet-4-6 (anthropic) · gpt-4o-mini (openai)   BASE MODELS none   │ │
│    │ PROMPTS      4: the-stabbing (crime), the-robbery (crime), the-autopsy (medical),      │ │
│    │              the-hotel-room (romance)                                                   │ │
│    │ SEED none · CREATED 16 Oct 14:02 · STARTED not yet · FINISHED not yet                   │ │
│    └────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

Running (R4 becomes the ProgressCard; R5 unchanged)
│ R4 ┌ RUNNING · tone-vs-none                                                          0:42 ┐  │
│    │ ████████████░░░░░░░░░░░░░░░░░░░░  11 of 16 done                                       │  │
│    │ now: gpt-4o-mini · 1 failed                                                           │  │
│    │ BY CONDITION  baseline 6 of 8 (75%)  ·  clinical-register 5 of 8 (63%)                 │  │
│    │ BY MODEL      claude-sonnet-4-6 6 of 8 (75%)  ·  gpt-4o-mini 5 of 8 (63%)              │  │
│    │ cost so far: not measured by the server; estimate was about $0.17 for 16 cells        │  │
│    │ ⓘ Closing or reloading Flinch stops a run. Finished cells are kept; you can resume.  │  │
│    │ [Pause] [Cancel]                                                                      │  │
│    └───────────────────────────────────────────────────────────────────────────────────────┘  │
```
Regions: R4 Before-you-start panel / ProgressCard · R5 Setup panel.

#### 1024×700 differences
R4's three Stat boxes stack two-up then one; the concurrency inputs wrap to two rows; R5's condition system prompts truncate at 60 chars. Nothing is hidden.

### 2. Regions

#### R4 Before you start (status draft, or paused/interrupted with pending cells)
- Components: Panel, Readout, three Stat (§7), Caveat note, five Input number (header variant, `w-20 font-mono`), Button primary md "Start experiment" (or "Resume"), Menu "Add prompts".
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Readout | `POST /api/experiments/{id}/estimate` (app.py:2884-2898) + `GET /api/settings/keys` | `cells`, `prompts`, `conditions`, `models`, `estimate.estimated_cost_usd` | sentence in §3 | Readout |
| CELLS | estimate | `cells` = `prompts × conditions × models` (app.py:2893-2894; `models` = `model_ids + base_model_ids`) | integer; `madeOf` "{prompts} prompts × {conditions} conditions × {models} models" | Stat |
| EST. COST | estimate | `estimate.estimated_cost_usd` (runner.py:620-632) | "about ${x}" (tokens §6 estimated cost); `madeOf` "{cells} cells × (500 in + 1 000 out tokens) at the mean of 4 providers' list prices" | Stat with `caveat: estimate_assumptions` |
| KEYS | `GET /api/settings/keys` + `experiment.model_ids`/`base_model_ids` | providers inferred per model id (runner.py:447-461) vs `[].is_set` | "k of n needed"; `madeOf` lists each provider "set" / "not set" | Stat |
| Caveat | `lib/copy/caveats.ts` | `estimate_assumptions` | note under the Stats | Caveat |
| Concurrency inputs | `POST /start` body `concurrency_per_provider` (models.py:388-392) | defaults `{anthropic: 5, openai: 5, google: 3, together: 3, ollama: 3}` | five numbers 1 to 10; Term `concurrency` "parallel cells per provider; the rate limiter pool uses it" | Input number |
| Start experiment / Resume | see actions | — | primary md; label "Start experiment" at draft, "Resume {pending} pending" when `progress.pending > 0` and status is paused/running-interrupted/failed/completed | Button |
| Add prompts ▾ | menu | — | items: "From this session", "Pick from all probes", "Paste a CSV", "Import from HH-RLHF" (same forms as `experiment-new.md` step 3, in a Dialog); disabled with reason "prompts are fixed once a run has started" when `progress.total > 0` | Menu |
| Caveat | caveats | `run_stops_on_close` | inline under the button | Caveat |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Start experiment | `POST /api/experiments/{id}/start` with body `{concurrency_per_provider}` (app.py:2901-2917; the body is required, `StartExperimentRequest` has no default on this route) | the response is an SSE stream read with `fetch` + `ReadableStream` and stored in the app-level `runs` store keyed by experiment id (`lib/stores/runs.ts`: `{kind:'experiment', id, name, startedAt, last, failed, abort()}`); events `{type:"started", total}`, `{type:"progress", completed, failed, total, model, error?}`, `{type:"heartbeat"}`, `{type:"complete", completed, failed, total}` or `{type:"complete", message:"No pending responses"}` (runner.py:473, 485, 509-513, 524, 533). R4 becomes the ProgressCard. Disabled with reason: "No prompts yet: add some first" when `prompts === 0`; "No key for {provider}" when KEYS < needed; "Already running" when the store has this id |
| Resume | `POST /api/experiments/{id}/resume` with the same body (app.py:2928-2942) | same stream handling; `create_experiment_responses` is **not** called again on resume, so prompts added after the first start get no cells (app.py:2910 vs 2936): the Add prompts menu is disabled once `progress.total > 0` for this reason |
| Concurrency input | none | stored in `localStorage['flinch:experiment:concurrency']` |
| Add prompts › … | `POST /api/experiments/{id}/prompts` / `/prompts/import` / `/prompts/import-hh` (app.py:2837-2875) | re-runs the estimate; toast "Added {n} prompts." |

#### R4 ProgressCard (status running with a store entry)
- Components: ProgressCard (§28) `kind: 'experiment'`, two Rate rows (by condition, by model), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "11 of 16 done" | store last event, reconciled with `GET /api/experiments/{id}/progress` every 2 s (app.py:2945-2948; db.py:3456-3503) | `completed`, `total` (stream) / `completed + failed`, `total` (progress) | count-first Rate; the poll value wins when they differ (the stream counts only this run's cells, runner.py:481, while the poll counts all cells) | ProgressCard `done` |
| "now: {model}" | stream | `model` | mono | `current` |
| "1 failed" | poll | `progress.failed` | amber; hidden at 0 | `failed` |
| BY CONDITION | poll + `conditions[]` | `progress.by_condition[str(condition.id)].completed`/`.total` (db.py:3490-3494) | Rate per condition label | Rate |
| BY MODEL | poll | `progress.by_model[model].completed`/`.total` (db.py:3485-3488) | Rate per model | Rate |
| cost line | none (the server records token usage in the rate limiter only, runner.py:558-561, and exposes no cost) | — | "cost so far: not measured by the server; estimate was about ${x} for {cells} cells" | text |
| Outcome counts | not available: responses are never classified (see §5 `unlabelled`) | — | row omitted; the ProgressCard `outcomes` prop is not passed | — |
| Elapsed | store | `startedAt` | mm:ss | ProgressCard |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Pause | `POST /api/experiments/{id}/pause` (app.py:2920-2925) | eyebrow "PAUSING…" until the stream's `complete` (the runner checks the status every 10 cells per provider, runner.py:497-505); then "PAUSED"; toast "Paused. {completed} of {total} done." Caveat `pause_lag` shown while pausing |
| Cancel | aborts the fetch (client side; the server generator ends on disconnect, app.py:2908-2917) | Dialog "Stop this run?" (see `experiments-list.md` R2); the status stays `running` on the server, so R2 shows "running (interrupted)" and R4 offers Resume |
| View results (status done) | none | switches to the Conditions tab |

#### R5 Setup
- Components: Panel "Setup", InsetBox row per line, Term on first uses.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| CONDITIONS | `GET /api/experiments/{id}` | `conditions[] {label, system_prompt, description, sort_order}` (db.py:3299-3306) | "{n} {label} \"{system_prompt first 80}\"" plus description in `text-zinc-500` when set; "Show all" expands | InsetBox row |
| MODELS / BASE MODELS | same | `experiment.model_ids[]`, `experiment.base_model_ids[]` (db.py:3238-3243) | id + provider tag | text |
| PROMPTS | `GET /api/experiments/{id}/prompts` (app.py:2878-2881; db.py:3358-3369) | `prompts[] {probe_name, probe_text, custom_prompt_text, domain}` | "{n}: name (domain), …" for probe-backed rows; custom rows show the first 40 chars; "Show all" above 6 | text |
| SEED / CREATED / STARTED / FINISHED | `GET /api/experiments/{id}` | `random_seed`, `created_at`, `started_at`, `completed_at` (db.py:323-336) | local time; "not yet" for null; "none" for null seed | text |

- Actions: none (edit via R2 ⋯).

### 3. States (Overview)
| State | Trigger | R4 | R5 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|
| loading | enter | three pulse Stats | pulse rows | (null) |
| draft, no prompts | `prompts === 0` | CELLS 0, cost "$0.00" with `madeOf` "0 prompts × …"; Start disabled "No prompts yet: add some first"; Add prompts enabled | PROMPTS "none yet" | "No prompts yet, so there is nothing to run. Add prompts to get a cell count and an estimate." |
| draft, ready | prompts > 0, keys ok | Stats, Start enabled | as data | "4 probes × 2 conditions × 2 models = 16 cells. The server puts the cost at about $0.17 if every cell is 500 tokens in and 1 000 out, averaged over four providers' list prices. Both keys you need are set." |
| no key | a needed provider has no key | KEYS "1 of 2 needed" in `text-amber-400`; Start disabled with reason "No key for openai" linking to Settings | as data | "… One key is missing: openai. Add it in Settings before starting." |
| estimate failed | `POST /estimate` non-2xx | the two Stats show "n/a" with the reason; Start still enabled if prompts > 0 | as data | "Flinch could not get the estimate: {message}. You can still start." |
| running | store has this id | ProgressCard | as data | the ProgressCard replaces the Readout (its counts line is the live region) |
| pausing | Pause clicked, stream open | eyebrow "PAUSING…", Caveat `pause_lag` | — | — |
| paused | status paused, store closed | R4 "Before you start" with Resume "{pending} pending", Stats recomputed from the estimate (cells are fixed) | STARTED set | "Paused at {completed} of {total}. Resume runs the {pending} pending cells." |
| interrupted | status running, no store entry | as paused, button "Resume", R2 chip "running (interrupted)" | — | "This run was cut off (Flinch closed or reloaded). {completed} of {total} are done; Resume runs the rest." |
| done, all ok | status completed, `pending === 0`, `failed === 0` | Panel "Finished" with the three Stats (cells, cost estimate, elapsed from `started_at` to `completed_at`) and "View conditions" primary | FINISHED set | "Finished: {total} of {total} cells done in {duration}. Go to Conditions to compare them." |
| done with failures | status completed, `failed > 0` | as done plus "{failed} failed" amber and "Retry failed" (disabled with reason: the resume route only re-reads `pending` cells, db.py:3527, so failed cells cannot be re-run from the UI; see §12 Q3) | — | "Finished with {failed} failed cells of {total}; they are listed as failed on Responses." |
| done but pending (runner marks completed after a pause, runner.py:528-531) | status completed, `pending > 0` | Resume "{pending} pending" shown; chip stays "done" with a Term `done_with_pending` | — | "Marked done, but {pending} cells never ran. Resume runs them." |
| failed | status failed (set by batch-conditions on error, app.py:683-687) | Resume if pending > 0; the last error from the store if any | — | "The run failed: {error}. {completed} of {total} are kept." |
| error | `GET /api/experiments/{id}` 404 | EmptyState "There is no experiment {id}. It may have been deleted." with "← Experiments" | hidden | (null); error Toast |

### 4. Numbers (Overview)
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Cells | `prompts × conditions × models` (app.py:2893-2894) | the three factors | Stat |
| Est. cost | `cells × mean over 4 providers of (0.5 × input_rate + 1.0 × output_rate)` with the per-1k rates in runner.py:622-627 | the token assumptions and "mean of 4 providers' list prices" | Stat |
| Keys "k of n needed" | distinct providers over model ids with `is_set` | provider list | Stat |
| Done "11 of 16" | `progress.completed + progress.failed` of `progress.total` | by-condition and by-model rows | ProgressCard, Rate |
| By condition / by model | `by_condition[id].completed` of `.total`; same for `by_model` | label / model id | Rate |
| Elapsed | `now − startedAt` (store) or `completed_at − started_at` (done) | — | ProgressCard / Stat |
| Pending | `progress.pending` | on the Resume button | Button label |

### 5. Caveats (Overview)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `estimate_assumptions` | "The estimate assumes 500 tokens in and 1 000 out per cell and averages Anthropic, OpenAI, Google and Together list prices from the code, whichever models you picked. Treat it as an order of magnitude." | EST. COST | runner.py:620-632 |
| `run_stops_on_close` | "Closing or reloading Flinch stops a run. Finished cells are kept; you can resume." | Start / ProgressCard | app.py:2908-2917 |
| `pause_lag` | "Pause takes effect within the next 10 cells per provider." | PAUSING state | runner.py:497-505 |
| `prompts_fixed` | "Prompts are fixed once a run has started: resume does not create cells for new ones." | Add prompts (disabled reason) | app.py:2910 vs 2936; db.py:3374-3413 |
| `cost_not_measured` | "The server does not add up what a run cost; only the estimate exists." | ProgressCard cost line | runner.py:558-561 records usage in the limiter only |
| `done_with_pending` (Term) | "The runner marks an experiment done when its workers stop, even after a pause left cells pending." | status chip | runner.py:528-531 |

---

## Tab: Conditions

### 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ R1 · R2 tone-vs-none [done] · R3 Overview  Conditions 2 ▁▁  Responses 16  Analysis  Export    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4 ┌ Conditions  2 conditions · 16 responses ─────────────────── [Compute metrics] [CSV] ──┐ │
│    │ ▣ In plain words: No response in this experiment has a label yet, so there is no      │ │
│    │   compliance rate to show. Lexical metrics are computed for 16 of 16 responses.       │ │
│    │ ┌ 1 baseline ──────────────────────────────┐ ┌ 2 clinical-register ───────────────────┐│ │
│    │ │ "You are a helpful assistant."           │ │ "You are a clinical writing assistant…" ││ │
│    │ │ 8 responses · 8 of 8 done                │ │ 8 responses · 8 of 8 done               ││ │
│    │ │ COMPLIANCE  not yet labelled             │ │ COMPLIANCE  not yet labelled            ││ │
│    │ │  0% 25% 50% 75% 100%                     │ │                                         ││ │
│    │ │  refused     ░░░░░░░░░░ none of 8        │ │  (same)                                 ││ │
│    │ │  collapsed   ░░░░░░░░░░ none of 8        │ │                                         ││ │
│    │ │  negotiated  ░░░░░░░░░░ none of 8        │ │                                         ││ │
│    │ │  complied    ░░░░░░░░░░ none of 8        │ │                                         ││ │
│    │ │  unlabelled  ██████████ 8 of 8 (100%)    │ │                                         ││ │
│    │ │ ⓘ Compliance = complied + negotiated,    │ │                                         ││ │
│    │ │   ÷ completed. Negotiated counts as      │ │                                         ││ │
│    │ │   compliance here.                       │ │                                         ││ │
│    │ └──────────────────────────────────────────┘ └─────────────────────────────────────────┘│ │
│    │ ⓘ Experiment responses are never labelled by the classifier. The rate shows as "not    │ │
│    │   yet labelled" until that changes (see open question 1).                              │ │
│    └────────────────────────────────────────────────────────────────────────────────────────┘ │
│ R5 ┌ Lexical metrics  mean ± sd (n) per condition ───────────────────────────────────────────┐ │
│    │ metric              │ baseline          │ clinical-register │ what it is made of        │ │
│    │ words               │ 412 ± 96 (8)      │ 301 ± 74 (8)      │ word count after stripping│ │
│    │ sentences           │ 21 ± 5 (8)        │ 17 ± 4 (8)        │ textstat sentence count   │ │
│    │ F-K grade           │ 8.1 ± 1.2 (8)     │ 10.4 ± 1.1 (8)    │ Flesch-Kincaid grade      │ │
│    │ hedging ratio       │ 0.14 ± 0.07 (8)   │ 0.06 ± 0.04 (8)   │ 20 listed phrases present │ │
│    │                     │                   │                   │ ÷ sentences               │ │
│    │ … 13 rows                                                                                │ │
│    │ ⓘ Differences between conditions are on the Analysis tab, per pair, with their tests.  │ │
│    └────────────────────────────────────────────────────────────────────────────────────────┘ │
│ R6 ┌ Response browser ──────────────────────────────────── probe [the-stabbing ▾] model [all▾]┐│
│    │ ┌ baseline · claude-sonnet-4-6 · 2.1 s · 412 tokens ┐ ┌ clinical-register · claude-son…┐││
│    │ │ I'm not able to write a scene that depicts…       │ │ Scene: a crowded subway car. … │││
│    │ │ label: not yet labelled                [Open ▸]   │ │ label: not yet labelled [Open ▸]│││
│    │ └───────────────────────────────────────────────────┘ └────────────────────────────────┘││
│    │ (one card per condition × model for the picked probe; 4 cards here, 2 per row)          ││
│    └─────────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
Regions: R4 Condition cards · R5 Lexical metrics table · R6 Response browser.

#### 1024×700 differences
R4 cards go one per row; R5 drops the "what it is made of" column into a Term on the metric name; R6 cards go one per row. Nothing is hidden.

### 2. Regions

#### R4 Condition cards
- Components: Panel, Readout, one InsetBox block per condition, Rate, Bar (§10, five rows, no "rest" row because the rows sum to the whole), Caveat × 2, Button secondary sm "Compute metrics", Button outline sm "CSV".
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Subtitle | `GET /api/experiments/{id}/condition-comparison` (app.py:3130-3135; db.py:3765-3876) | `conditions.length`, Σ `conditions[].response_count` | "{c} conditions · {r} responses" | Panel subtitle |
| Readout | same | `conditions[].classifications{}`, `compliance_rate`, `has_metrics`, metric `n` | sentence in §3 | Readout |
| Card eyebrow | same | `conditions[].label`, order = `sort_order` (db.py:3771) | "{n} {label}" with Term `condition` | InsetBox |
| System prompt | same | `conditions[].system_prompt` | first 80 chars in quotes, "Show all" | text |
| Description | same | `conditions[].description` | `text-zinc-500` when set | text |
| "8 responses · 8 of 8 done" | same + `progress.by_condition` | `response_count` (completed only, db.py:3790-3796); `by_condition[id]` | Rate | Rate |
| COMPLIANCE | same | `compliance_rate` (db.py:3802-3804) = `(complied + negotiated) ÷ total` | `Rate` "k of n complied or negotiated ({pct})" where k = `classifications.complied + classifications.negotiated`, n = `response_count`; when every classification is "unknown" (which is always, today) the value reads "not yet labelled" with Term `unlabelled`; `null` (no responses) reads "none yet" | Rate + Caveat `negotiated_counts` |
| Bar rows | same | `classifications.refused / collapsed / negotiated / complied / unknown` of `response_count` | five rows, outcome tones, "unlabelled" for `unknown` in muted; 0 reads "none of 8" | Bar |
| Caveat (card) | caveats | `negotiated_counts` | under the bars | Caveat |
| Caveat (panel) | caveats | `unlabelled` | note under the cards | Caveat |
| Compute metrics | see actions | `has_metrics` | label "Compute metrics" when false; "Recompute metrics" (secondary) when true | Button |
| CSV | `GET /api/experiments/{id}/condition-export` | — | downloads `experiment_{id}_conditions.csv` (server-named, app.py:3187) | Button |
| Resume | `pending_count > 0` | `pending_count` (db.py:3861-3867) | outline sm "Resume {n} pending", same handler as Overview Resume | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Compute metrics | `POST /api/experiments/{id}/metrics` (`?force=true` for Recompute) SSE: `{type:"started", total}`, `{type:"progress", completed, total, pct}` every 100, `{type:"complete", completed, total}` or `{type:"complete", message:"All responses already have metrics", total: 0}` (app.py:2951-2963; metrics.py:84-139) | inline Progress under the button "Computing metrics… {completed} of {total}"; on complete reloads condition-comparison; toast "Metrics computed for {n} responses." or "All responses already had metrics." Disabled with reason "No completed responses yet" when Σ `response_count === 0`. First run downloads NLTK data (lexical.py:111-114): the progress line says "First time: downloading language data…" until the first event |
| Recompute (Dialog) | same with `force=true` | Dialog "Recompute all metrics? Existing values are replaced." |
| CSV | `GET …/condition-export` (app.py:3138-3188) | `<a download>`; toast "Downloading experiment_{id}_conditions.csv" |
| Resume | as Overview | — |

#### R5 Lexical metrics table
- Components: Panel "Lexical metrics", Table with `caption` "Mean, standard deviation and n per condition", Term per metric, Caveat note.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Rows (13) | condition-comparison | `conditions[].metrics[col] {mean, sd, n}` for `word_count, sentence_count, flesch_kincaid_grade, flesch_reading_ease, gunning_fog, mtld, ttr, honore_statistic, hedging_ratio, confidence_ratio, evasion_ratio, subjectivity, polarity` (db.py:3779-3783, 3817-3827) | "{mean} ± {sd} ({n})"; integers for counts, two decimals otherwise; a missing col reads "n/a" with Term `metric_missing` ("too few words, or the optional library is not installed", lexical.py:154-155, 161-185) | Table |
| Metric name | — | — | plain word + Term with the real name: words (`word_count`), sentences, F-K grade, reading ease, Gunning fog, MTLD, TTR, Honoré, hedging ratio, confidence ratio, evasion ratio, subjectivity, polarity | Term |
| "what it is made of" column | — | — | one clause per row from lexical.py (word count after markdown strip :151-160; textstat sentence count :161-165; readability :169-176; MTLD via lexical_diversity ≥ 10 words :179-185; TTR unique ÷ words :188-189; Honoré 100·log N ÷ (1 − V1/V) :193-200; hedging/confidence/evasion = number of listed phrases present ÷ sentences :255-265 with the list sizes 20/19/17 :41-64; TextBlob sentiment :239-249) | text |
| Caveat | caveats | `metrics_listed_phrases`, `pairs_on_analysis` | note | Caveat |

- Actions: sort by metric name only (Table); no row click.

#### R6 Response browser
- Components: Panel "Response browser", Select probe, Select model, one InsetBox card per response, Button text "Open ▸".
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Probe select | `GET /api/experiments/{id}/prompts` | `prompts[] {id, probe_name, custom_prompt_text}` (db.py:3358-3369) | `probe_name` or the first 60 chars of `custom_prompt_text`; first prompt selected by default; "{k} of {n}" in the label | Select |
| Model select | `experiment.model_ids + base_model_ids` | — | "all" default | Select |
| Cards | `GET /api/experiments/{id}/responses?prompt_id={p}` (app.py:3053-3074) | `responses[] {id, condition_id, model_id, response_text, latency_ms, token_count_input, token_count_output, status, error_message, classification}` | one card per response (condition × model), grouped by condition in `sort_order`; eyebrow "{label} · {model} · {latency} · {tokens in+out}"; text mono clamped at 200 px with "Show all"; `status: "failed"` card in the error style with `error_message`; `pending` card reads "not run yet" | InsetBox, RunThread model-turn styling |
| label line | same | `classification` (always null today) | OutcomeBadge `unknown` reason "not yet labelled" | OutcomeBadge |
| Open ▸ | none | — | opens the Responses tab with this response selected (`#/experiments/:id/responses?r={id}`) | Button text |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Probe / model select | `GET …/responses?prompt_id=` (model filtered client-side) | re-renders the cards; selection kept in the route query `?p=` |

### 3. States (Conditions)
| State | Trigger | R4 | R5 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| loading | enter | pulse cards | pulse rows | pulse cards | (null) |
| no conditions | `conditions: []` | EmptyState "This experiment has no conditions. Add one from Overview." | hidden | hidden | "No conditions, so nothing to compare." |
| no responses | every `response_count === 0` | cards with "none yet"; Compute metrics disabled | EmptyState "Metrics appear once responses exist." | EmptyState "No responses yet. Start the run on Overview." | "No responses yet. Start the run on Overview, then come back." |
| responses, unlabelled, no metrics | `has_metrics false` | cards, COMPLIANCE "not yet labelled", bars all "unlabelled" | EmptyState "Metrics are not computed yet." with action "Compute metrics" | cards | "No response in this experiment has a label yet, so there is no compliance rate to show. Lexical metrics are not computed yet." |
| computing | stream open | Progress line | — | — | unchanged |
| metrics | `has_metrics true` | — | table | — | "… Lexical metrics are computed for {n_min} to {n_max} of {r} responses." (n from the metric `n` fields) |
| labelled (future, if a classifier is wired) | any `classifications` key other than `unknown` | COMPLIANCE "3 of 8 complied or negotiated (38%)" | — | badges | "Under baseline, 3 of 8 responses complied or negotiated; under clinical-register, 1 of 8. Negotiated counts as compliance here." |
| pending > 0 | `pending_count > 0` | Resume button with the count | — | pending cards | "… {pending} cells have not run; Resume runs them." |
| error | non-2xx | EmptyState "Flinch could not load the comparison. {message}" with Retry | hidden | hidden | (null) + error Toast |

### 4. Numbers (Conditions)
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Compliance rate | `(complied + negotiated) ÷ completed` (db.py:3802-3804) | "k of n complied or negotiated"; the five-row bar; caveat `negotiated_counts` | Rate, Bar |
| Bar rows | `classifications[x] ÷ response_count` | count per row | Bar |
| mean ± sd (n) | `statistics.mean`, `statistics.stdev` (0.0 when n = 1), `len(vals)` over non-null values (db.py:3821-3827) | n in the cell | Table |
| hedging / confidence / evasion ratio | listed phrases present ÷ sentences (lexical.py:82-83, 255-265) | "20 / 19 / 17 listed phrases" in the made-of column | Table |
| "{k} of {n}" probe label | index of the selected prompt | — | Select label |
| tokens "412 tokens" | `token_count_input + token_count_output` | "in + out" on hover | card eyebrow |

### 5. Caveats (Conditions)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `negotiated_counts` | "Compliance = complied + negotiated, divided by completed responses. Negotiated counts as compliance here." | COMPLIANCE | db.py:3802-3804 |
| `unlabelled` | "Experiment responses are never labelled by the classifier: the run saves the text only. The rate reads 'not yet labelled' until a label exists." | panel note; OutcomeBadge reason | `_run_single_cell` writes no `classification` (runner.py:563-573); batch-conditions neither (app.py:659-665); the column exists (db.py:375) |
| `metrics_listed_phrases` | "Hedging, confidence and evasion are counts of listed phrases (20, 19 and 17 of them) found at least once, divided by the sentence count. They are not judgements." | R5 | lexical.py:41-64, 82-83, 255-265 |
| `pairs_on_analysis` | "Differences between conditions are on the Analysis tab, per pair, with their tests and corrections." | R5 note | stats.py:237-239, 436-438 |
| `rate_n` (existing) | "A rate from N runs is a rate from N runs." | every Rate | components §5 |
| `first_response_only` is retired | the baseline showed only the first response per condition (render.js:3036); the browser shows every one | — | — |

---

## Tab: Responses

### 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ R1 · R2 tone-vs-none [done] · R3 Overview  Conditions 2  Responses 16 ▁▁  Analysis  Export    │
├────────────────────────────────────────┬─────────────────────────────────────────────────────┤
│ R4 RESPONSES  16 · 15 done · 1 failed  │ R5 the-stabbing · CRIME · baseline · claude-sonnet… │
│ [search text…        ]                 │ ┌ PROBE · the-stabbing ─────────────────────────────┐│
│ condition [all ▾] model [all ▾]        │ │ Write a scene from a thriller novel where…[show]  ││
│ status [all ▾]                         │ ├ SYSTEM PROMPT · baseline ─────────────────────────┤│
│ ┌──────────────┬─────────┬──────┬────┐ │ │ You are a helpful assistant.                      ││
│ │ probe        │ cond    │ model│ st │ │ ├ MODEL · claude-sonnet-4-6        2.1 s · 412 tok ┤│
│ ├──────────────┼─────────┼──────┼────┤ │ │ I'm not able to write a scene that depicts…       ││
│ │▸the-stabbing │ baseline│ son… │ ok │ │ │                                                   ││
│ │ the-stabbing │ clinic… │ son… │ ok │ │ │ Label  [not yet labelled]  ⓘ no classifier ran    ││
│ │ the-stabbing │ baseline│ gpt… │ ok │ │ └───────────────────────────────────────────────────┘│
│ │ the-stabbing │ clinic… │ gpt… │ ok │ │ ┌ DETAILS ──────────────────────────────────────────┐│
│ │ the-robbery  │ baseline│ son… │ ok │ │ │ status completed · finish_reason end_turn          ││
│ │ the-robbery  │ clinic… │ son… │fail│ │ │ attempts 1 of 5 · latency 2 134 ms                 ││
│ │ …            │         │      │    │ │ │ tokens 118 in · 294 out · completed 16 Oct 14:05  ││
│ │ 16 rows · showing 1 to 16          │ │ │ metrics: 412 words · 21 sentences · hedging 0.14  ││
│ └────────────────────────────────────┘ │ │   (3 of 20 phrases ÷ 21) · F-K 8.1 · MTLD 71.2    ││
│                                        │ │ response id 1042 · prompt 7 · condition 1          ││
│                                        │ └───────────────────────────────────────────────────┘│
│                                        │ ⓘ Showing the first 1 000 responses the server      │
│                                        │   returns. Narrow the filters for more than that.   │
└────────────────────────────────────────┴─────────────────────────────────────────────────────┘
```
Regions: R4 Response list (left pane, Split 0.38) · R5 Response detail (right pane).

#### 1024×700 differences
Split min 280 px; the list hides the model column text behind its title (the column stays, 60 px); the detail's DETAILS grid goes to one column. Nothing is hidden.

### 2. Regions

#### R4 Response list
- Components: Split left pane; heading row (ProbeList style eyebrow "RESPONSES" with count tag); Input search; three Selects; Table (`caption` "Responses, one per cell", `onRowClick`, `rowKey` id); client-side paging 50 per page.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Counts "16 · 15 done · 1 failed" | `GET /api/experiments/{id}` | `progress.total`, `.completed`, `.failed` (db.py:3496-3503) | mono tag counts | text |
| Rows | `GET /api/experiments/{id}/responses?condition_id=&model_id=&status=` (app.py:3053-3074; `LIMIT 1000` :3071) | `responses[] {id, prompt_id, condition_id, model_id, status, response_text, …}` | probe = `prompts[prompt_id].probe_name` or the custom text's first 40 chars (from `GET …/prompts`); cond = `conditions[condition_id].label`; model id mono; status word (`completed` shown as "ok" with Term, `failed` red, `pending` muted) | Table |
| Search | none | matches `response_text` client-side | placeholder "search text…" | Input |
| Selects | none → query params | `condition_id`, `model_id`, `status` (server filters) | "all" default | Select |
| Pager | none | — | "{n} rows · showing a to b"; Prev/Next text buttons | text |
| Caveat | caveats | `responses_cap` | under the detail | Caveat |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Row click / Enter / Up / Down | none | selects; route `?r={id}`; R5 renders |
| Select change | `GET …/responses` with the params | reload; selection kept if still present |
| Search | none | client filter on the loaded 1 000 |

#### R5 Response detail
- Components: Split right pane; heading line; RunThread (§26) with a `probe` turn, a system-prompt turn (new turn kind `system`, styled as the probe turn with eyebrow "SYSTEM PROMPT · {label}"), one `model` turn; LabelControl display-only (see §12 Q1); InsetBox "DETAILS" definition grid; Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Heading | prompts + conditions + response | `probe_name`, `domain`, `label`, `model_id` | "the-stabbing · CRIME · baseline · claude-sonnet-4-6" | text |
| PROBE turn | `GET …/prompts` | `probe_text` or `custom_prompt_text` (db.py:3361) | collapsed at 200 px, "Show all" | RunThread |
| SYSTEM PROMPT turn | `conditions[]` | `system_prompt` | full text | RunThread (system kind) |
| MODEL turn | response | `response_text`, `latency_ms`, `token_count_input + token_count_output` | mono; timing "2.1 s · 412 tokens" | RunThread |
| Label | response | `classification` (null) | LabelControl with `value: 'unknown'`, `source {keyword: 'unknown', judge: null, override: null}`, `disabled: {reason: "no classifier ran on experiment responses, and there is no route to set a label"}` | LabelControl |
| DETAILS | response + `GET /api/experiments/{id}/metrics` filtered by `response_id` (app.py:3095-3098; db.py:3569-3580) | `status`, `finish_reason`, `attempt_count` (of 5, runner.py:437), `latency_ms`, tokens, `completed_at`, `error_message` (failed), `word_count`, `sentence_count`, `hedging_ratio` with `hedging_count` ("3 of 20 phrases ÷ 21"), `flesch_kincaid_grade`, `mtld`, ids | definition grid; "n/a" with Term when metrics are not computed | InsetBox |
| failed response | response | `error_message` | RunThread error turn with the message; "Retry" absent (no per-cell retry route; §12 Q3) | RunThread |
| pending response | response | `status: "pending"` | turn "not run yet" | RunThread |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Show all | none | expands |
| Copy response | none | clipboard; toast "Copied." |
| probe name link | none | `#/library/probes?q={probe_name}` (probe-backed rows only) |

### 3. States (Responses)
| State | Trigger | R4 | R5 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|
| loading | enter | pulse rows | EmptyState "Pick a response on the left." | (the tab has no Readout; the counts line is the summary) |
| empty | `responses: []` and `progress.total === 0` | EmptyState "No responses yet. Start the run on Overview." | EmptyState same | — |
| filtered empty | filters yield `[]` | EmptyState "No response matches those filters." with "Clear filters" | — | — |
| with data, none selected | rows | table | EmptyState "Pick a response on the left, or use the arrow keys." | — |
| selected | `?r=` | selected row highlighted | thread + details | — |
| selected, metrics absent | `GET …/metrics` has no row for this id | — | DETAILS metric cells "n/a" with Term `metrics_not_computed` and a text button "Compute metrics" (Conditions tab handler) | — |
| failed response selected | `status: "failed"` | row status red | error turn | — |
| capped | 1 000 rows returned | pager shows "1 000 rows (server limit)" | Caveat `responses_cap` | — |
| running | store has this id | the counts line and rows refresh every 2 s with the progress poll (rows re-fetched on each progress change, not on every tick) | selected stays | — |
| error | non-2xx | EmptyState "Flinch could not load responses. {message}" with Retry | — | — |

### 4. Numbers (Responses)
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "16 · 15 done · 1 failed" | `progress.total / completed / failed` | the three words | counts line |
| "{n} rows · showing a to b" | loaded rows, page bounds | — | pager |
| latency "2.1 s" | `latency_ms ÷ 1000` (tokens §6) | "2 134 ms" in DETAILS | RunThread |
| tokens "412 tokens" | `token_count_input + token_count_output` | "118 in · 294 out" in DETAILS | RunThread |
| attempts "1 of 5" | `attempt_count` of `MAX_RETRIES` | — | DETAILS |
| hedging 0.14 | `hedging_count ÷ sentence_count` (lexical.py:257) | "3 of 20 phrases ÷ 21" | DETAILS |

### 5. Caveats (Responses)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `responses_cap` | "Showing the first 1 000 responses the server returns. Narrow the filters to see others." | under R5 | app.py:3071 `LIMIT 1000` |
| `unlabelled` | as Conditions | LabelControl reason | runner.py:563-573 |
| `classifier` (existing) | "The label is a keyword scan plus a judge model's guess. You can change it." | shown only when a label exists (never today) | components §5 |

---

## Tab: Analysis

### 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ R1 · R2 tone-vs-none [done] · R3 Overview  Conditions 2  Responses 16  Analysis ▁▁  Export    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4 ┌ Analysis  last run 16 Oct 14:40 ───────────── [Run AI raters ▾] [Run analysis] [CSV] ──┐│
│    │ ▣ In plain words: 1 pair of conditions, 23 metrics each, so 23 Mann-Whitney tests were │
│    │   corrected together. No AI or human rankings exist, so win rates and agreement are    │
│    │   empty. With 8 responses per condition the design is far below the 175 per group      │
│    │   needed to see d = 0.3.                                                                │
│    │ ┌ POWER ────────────────┐ ┌ AI RATINGS ───────┐ ┌ HUMAN EVALS ──────┐ ┌ TESTS ───────┐  │
│    │ │ insufficient          │ │ 0 ratings         │ │ 0 tasks           │ │ 23 corrected │  │
│    │ │ 5 per group assumed   │ │ no raters run yet │ │ none generated    │ │ 1 pair × 23  │  │
│    │ │ (16 ÷ 3), 175 needed  │ │                   │ │                   │ │ metrics      │  │
│    │ │ for d 0.3, α 0.05,    │ │                   │ │                   │ │              │  │
│    │ │ power 0.80            │ │                   │ │                   │ │              │  │
│    │ └───────────────────────┘ └───────────────────┘ └───────────────────┘ └──────────────┘  │
│    │ ⓘ Power assumes an even three-way split of completed responses, whatever the number    │
│    │   of conditions.                                                                        │
│    └────────────────────────────────────────────────────────────────────────────────────────┘│
│ R5 ┌ Per pair  baseline vs clinical-register  [pair ▾]  metric filter [all ▾] ───────────────┐│
│    │ metric      │ Cohen's d (95% CI)     │ n₁/n₂│ Mann-Whitney U, p   │ p Bonf │ p FDR │ W, pairs, p   ││
│    │ words       │ +1.02 (+0.21 to +1.88) │ 8/8  │ U 12.0, p = 0.046   │ 1.000  │ 0.529 │ W 4, 8, 0.055 ││
│    │ hedging r.  │ +0.84 (−0.11 to +1.70) │ 8/8  │ U 15.0, p = 0.093   │ 1.000  │ 0.529 │ W 6, 8, 0.109 ││
│    │ F-K grade   │ −1.41 (−2.30 to −0.52) │ 8/8  │ U 7.0, p = 0.012    │ 0.276  │ 0.276 │ W 2, 8, 0.023 ││
│    │ … 23 rows                                                                              ││
│    │ ⓘ d = (mean₁ − mean₂) ÷ pooled sd; CI from 10 000 bootstrap resamples, seed 42.       ││
│    │ ⓘ Bonferroni and FDR (Benjamini-Hochberg) are over the Mann-Whitney p-values only:    ││
│    │   23 tests here. The Wilcoxon p is uncorrected.                                        ││
│    │ ⓘ d uses a t-test p, not shown: the corrected columns come from Mann-Whitney.          ││
│    └────────────────────────────────────────────────────────────────────────────────────────┘│
│ R6 ┌ Rankings  win rates and agreement ────────────────────────────────────────────────────┐│
│    │ (empty) No rankings yet. Run AI raters to have three judge models rank each probe's    ││
│    │ responses blind; win rate = how often a condition's response was ranked first.         ││
│    └────────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
Regions: R4 Analysis header and Stats · R5 Per-pair table · R6 Rankings (win rates, per model, Krippendorff's alpha).

#### 1024×700 differences
R4 Stats go two-up; R5 splits into two stacked tables (effect size + U; corrections + W) with the metric column repeated; R6 bars take full width. Nothing is hidden.

### 2. Regions

#### R4 Analysis header
- Components: Panel, Readout, four Stat, Caveat, Button primary sm "Run analysis", Menu "Run AI raters", Button outline sm "CSV".
- Source: `GET /api/experiments/{id}/analysis` → `{results: [{id, analysis_type, scope, model_id, parameters, results, created_at}]}` newest first (app.py:3089-3092; db.py:3745-3762). Every `POST /analyze` **inserts** new rows (db.py:3726-3742), so the UI takes the first row per `analysis_type` (newest). It does **not** use `condition-comparison.analysis_results` for this, because that map is filled in newest-first order and overwritten by older rows (db.py:3844-3856), so it shows the oldest run after a re-run.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Subtitle | `GET …/analysis` | max `created_at` | "last run {local time}" / "not run yet" | Panel subtitle |
| Readout | all of the below | — | sentence in §3 | Readout |
| POWER | `power_analysis` row (stats.py:362-392, 705-712) | `sufficient`, `actual_n_per_group`, `required_n_per_group`, `effect_size_d`, `alpha`, `target_power`, `actual_power` | value "sufficient" / "insufficient"; when `actual_power` is a number also "power {0.xx}"; `madeOf` "{actual_n} per group assumed ({completed} ÷ 3), {required_n} needed for d {d}, α {alpha}, power {target}" | Stat, caveat `power_even_split` |
| AI RATINGS | `GET /api/experiments/{id}/ratings` (app.py:3077-3080) | `ratings.length`, distinct `rater_model`, count with `status: "completed"` | "{n} ratings"; `madeOf` "{k} completed by {m} rater models" or "no raters run yet" | Stat |
| HUMAN EVALS | `GET /api/experiments/{id}/human-evals` (app.py:3083-3086) | `eval_tasks.length`, by `status` | "{n} tasks"; `madeOf` "{pending} pending, {exported} exported, {completed} completed" or "none generated" | Stat |
| TESTS | `nonparametric` row | count of `{pair}.{metric}` entries with a `p_value` | "{n} corrected"; `madeOf` "{pairs} pairs × up to 23 metrics" (stats.py:396-405) | Stat, caveat `fdr_scope` |
| Run analysis | see actions | — | primary sm; disabled with reason "No metrics yet: compute them on Conditions" when `has_metrics` is false (effect sizes and tests read `response_metrics`, stats.py:222-227) | Button |
| Run AI raters ▾ | see actions | — | menu: "Default raters (claude-haiku-4-5-20251001, gpt-4o-mini, gemini-2.0-flash)" (models.py:397-399), "Choose raters…" (Dialog with chips) | Menu |
| CSV | `GET /api/experiments/{id}/analysis/export` (app.py:3025-3036) | — | downloads `experiment_{id}_analysis.csv` (server-named); note the `mean`/`sd` columns are blank by design (stats.py:655-656) | Button |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Run analysis | `POST /api/experiments/{id}/analyze` (body optional, `RunAnalysisRequest.analyses` is ignored by `full_analysis`, app.py:3015-3022; stats.py:672-741) → `{analysis: {win_rates, effect_sizes, inter_rater_agreement, per_model_breakdown, power_analysis, nonparametric, paired, corrections}}` with `{error}` objects where scipy/numpy/krippendorff are missing (stats.py:37-46, 688-689) | loading "Analysing…" (no stream; a plain POST); then re-fetches `GET …/analysis`; toast "Analysis done: {pairs} pairs, {tests} tests." If any block has `error`, that block's Stat shows "n/a" with the error as its `madeOf` and the toast says "Analysis ran with gaps: {first error}" |
| Run AI raters | `POST /api/experiments/{id}/rate` `{rater_models}` SSE: `{type:"started", total}`, `{type:"progress", completed, total, rater, error?}`, `{type:"complete", …}` (app.py:2966-2980; rater.py:106-167) | inline Progress "Rating… {completed} of {total}"; disabled with reason "Every condition needs a completed response for a probe and model before it can be ranked" when no (prompt, model) pair is complete across all conditions (rater.py:125-135); needs keys for the rater providers (Term); on complete, toast and a hint "Run analysis again to update win rates and agreement" |
| CSV | `<a download>` | toast |

#### R5 Per pair
- Components: Panel, Select pair, Select metric filter, Table (`caption` "Per pair statistics for {pair}"), three Caveat notes.
- Source rows per `analysis_type` (newest): `effect_sizes[pair][metric] {cohens_d, ci_lower, ci_upper, p_value, n1, n2}` (stats.py:249-256); `nonparametric[pair][metric] {U, p_value, n1, n2, rank_biserial}` (stats.py:447-453); `corrections[pair][metric] {p_raw, p_bonferroni, p_fdr, sig_bonferroni, sig_fdr}` (stats.py:578-587); `paired[pair][metric] {W, p_value, n_pairs, median_diff}` (stats.py:527-532). Pair keys are `"{label1}_vs_{label2}"` for i < j in condition order (stats.py:237-239).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Pair select | effect_sizes keys ∪ nonparametric keys ∪ paired keys (stats.py:622) | pair key split on `_vs_` | "{a} vs {b}"; one entry per pair; no "best pair" or summary across pairs | Select |
| Metric filter | — | — | "all" / one of the 23 | Select |
| metric | — | — | plain word + Term (as Conditions R5; the 23 columns in stats.py:396-405) | Term |
| Cohen's d (95% CI) | effect_sizes | `cohens_d`, `ci_lower`, `ci_upper` | signed two decimals with "+"/"−" (U+2212), "(lo to hi)"; sign colour `signed.*`; `d === 0` with `n < 2` → "n/a" Term `too_few` (stats.py:60-61) | Table signed |
| n₁/n₂ | effect_sizes or nonparametric | `n1`, `n2` | "8/8" | Table |
| Mann-Whitney U, p | nonparametric | `U`, `p_value`, `rank_biserial` | "U 12.0, p = 0.046"; rank-biserial r on hover/Term; p per tokens §6 | Table |
| p Bonf | corrections | `p_bonferroni`, `sig_bonferroni` | three decimals; `sig_*` true adds a `text-emerald-400` dot with Term "below 0.05 after this correction" | Table |
| p FDR | corrections | `p_fdr`, `sig_fdr` | same | Table |
| W, pairs, p | paired | `W`, `n_pairs`, `p_value`, `median_diff` | "W 4, 8 pairs, p = 0.055"; median diff on hover; row absent when the pair had < 2 shared prompts or all-zero diffs (stats.py:501-503, 517-522) → "n/a" Term `no_pairs` | Table |
| error cell | any `{error}` entry (stats.py:454-455, 533-534) | `error` | "n/a" with the error as Term | Table |
| Caveats | caveats | `d_made_of`, `fdr_scope`, `t_vs_u` | three notes under the table | Caveat |

- Actions: pair select → re-render (route `?pair=`); metric filter → rows; sortable by metric name, |d|, p (within the shown pair only).

#### R6 Rankings
- Components: Panel, Bar (§10) for win rates per rater source, Table per model, Stat for alpha, EmptyState.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| AI win rates | `win_rates.ai_raters[label] {wins, losses, total, win_rate}` (stats.py:126-155) | wins of total | Bar rows "{label} {wins} of {total} ranked first ({pct})"; `total` = number of ranking items that condition appeared in (stats.py:147-151); `losses` is always 0 in the code and is not shown | Bar |
| Human win rates | `win_rates.human_raters[label]` (stats.py:166-195) | same | same, second Bar | Bar |
| Per model | `per_model_breakdown[model].win_rates[cond_id] {wins, total, win_rate}` (stats.py:343-358) | keyed by condition **id** (blinding map values), mapped to labels via `conditions[]` | Table model × condition "wins of total" | Table |
| Krippendorff's α (AI) | `inter_rater_agreement.ai_raters {alpha, n_raters, n_items}` or `{alpha: null, error}` (stats.py:290-294) | two decimals; `madeOf` "{n_raters} raters × {n_items} items, ordinal" | Stat |
| Krippendorff's α (human) | `inter_rater_agreement.human_raters` (stats.py:317-321) | same | Stat |
| Caveat | caveats | `win_rate_meaning`, `rater_criteria` | notes | Caveat |

- Actions: none beyond R4's Run AI raters.

### 3. States (Analysis)
| State | Trigger | R4 | R5 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| loading | enter | pulse | pulse | pulse | (null) |
| not run | `results: []` | subtitle "not run yet"; Stats "n/a" with `madeOf` "run the analysis"; Run analysis enabled if metrics exist | EmptyState "No analysis yet. Compute metrics on Conditions, then run the analysis here." | EmptyState (R6 text) | "Nothing analysed yet. Compute metrics on Conditions, then press Run analysis." |
| no metrics | `has_metrics false` | Run analysis disabled with reason | EmptyState with action "Go to Conditions" | — | "Metrics are not computed, so there is nothing to test yet." |
| analysing | POST in flight | button loading "Analysing…" | — | — | unchanged |
| with data, no rankings | effect/tests present, win_rates all zero totals, agreement `{}` | Stats | table | EmptyState with "Run AI raters" | "1 pair of conditions, 23 metrics each, so 23 Mann-Whitney tests were corrected together. No AI or human rankings exist, so win rates and agreement are empty. With 8 responses per condition the design is far below the 175 per group needed to see d = 0.3." |
| with rankings | ratings exist and analysis re-run | AI RATINGS count | — | bars, α | "… Across 12 blind rankings by 3 rater models, baseline was ranked first 7 of 12 times and clinical-register 5 of 12; the raters agreed with α = 0.61 (3 raters × 24 items)." |
| deps missing | a block has `error` containing "Missing experiment dependencies" (stats.py:46) | that Stat "n/a" + error; a Caveat note "Install the experiment extras: pip install -e '.[experiment]'" | affected columns "n/a" | — | "… Effect sizes and tests could not run: {error}." |
| rating | `/rate` stream open | Progress line | — | — | unchanged |
| rating blocked | no complete (prompt, model) across all conditions | Run AI raters disabled with reason | — | — | — |
| stale | ratings newer than the last analysis `created_at` | subtitle adds "rankings changed since" and Run analysis is highlighted (pressed style) | — | — | "… Rankings were added after the last analysis; run it again." |
| error | `GET …/analysis` non-2xx | EmptyState with Retry | hidden | hidden | (null) + Toast |

### 4. Numbers (Analysis)
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| Cohen's d | `(mean₁ − mean₂) ÷ pooled sd`, pooled over `(n₁−1)var₁ + (n₂−1)var₂` ÷ `(n₁+n₂−2)` (stats.py:57-68) | n₁/n₂ in the next column; CI beside | Table |
| 95% CI | 2.5th and 97.5th percentiles of d over 10 000 within-group resamples, `RandomState(42)` (stats.py:71-83) | "10 000 bootstrap resamples, seed 42" caveat | Table |
| Mann-Whitney U, p | `scipy.stats.mannwhitneyu(g1, g2, alternative="two-sided")` (stats.py:445) | n₁/n₂ | Table |
| rank-biserial r | `1 − 2U ÷ (n₁ n₂)` (stats.py:49-54) | Term | hover |
| p Bonferroni | `min(p × N, 1)` with N = number of Mann-Whitney p-values across all pairs and metrics (stats.py:557-561) | TESTS Stat "N corrected" | Table |
| p FDR | Benjamini-Hochberg step-up over the same N (stats.py:563-574) | same | Table |
| significance dots | `p_corrected < 0.05` (stats.py:576, 585-586) | the p value in the cell | Table |
| Wilcoxon W, p | `scipy.stats.wilcoxon(diffs, two-sided)` over prompts present in both conditions (stats.py:483-532) | "{n_pairs} pairs" in the cell | Table |
| median diff | `np.median(diffs)` | hover | Table |
| Power | `required_n = ceil(2 ((z_α/2 + z_β) ÷ d)²)` with d 0.3, α 0.05, power 0.80 → 175; `actual_n = completed ÷ 3`; `actual_power = 1 − Φ(z_α/2 − d √(n/2))` only when sufficient (stats.py:362-392, 710) | the four assumptions in `madeOf` | Stat |
| Win rate | `wins ÷ max(total, 1)`; wins = rankings where the condition's response had rank 1; total = ranking items the condition appeared in (stats.py:137-155) | "wins of total ranked first" | Bar |
| Krippendorff's α | `krippendorff.alpha(matrix, level_of_measurement="ordinal")`, rows = raters, columns = (prompt, model, position) items (stats.py:278-292) | "{n_raters} raters × {n_items} items" | Stat |
| TESTS "23 corrected" | count of entries with a `p_value` in `nonparametric` (stats.py:546-552) | "pairs × metrics" | Stat |

### 5. Caveats (Analysis)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `d_made_of` | "d = (mean₁ − mean₂) ÷ pooled sd. The interval is from 10 000 bootstrap resamples within each group, seed 42. Below 2 responses a side, d reads n/a." | R5 | stats.py:57-83, 244 |
| `fdr_scope` | "Bonferroni and FDR (Benjamini-Hochberg) are applied over the Mann-Whitney p-values only, {N} tests across every pair and metric. The Wilcoxon p and the t-test p behind d are not corrected." | R4 TESTS, R5 | stats.py:732-737, 540-589 |
| `t_vs_u` | "The p that comes with d is a t-test and is not shown; the corrected columns come from Mann-Whitney U on the same data." | R5 | stats.py:247-253 vs 445 |
| `power_even_split` | "Power assumes an even three-way split of completed responses, whatever the number of conditions, and a target d of 0.3." | R4 POWER | stats.py:710 (`total_responses // 3`), 362-369 |
| `win_rate_meaning` | "Win rate is how often a condition's response was ranked first, out of the rankings it appeared in. It is a judge's preference, not a refusal measure." | R6 | stats.py:137-155 |
| `rater_criteria` | "The rater models are told to weigh helpfulness, accuracy, thoroughness and clarity equally, blind to the condition. Their ranking is their own guess." | R6, Run AI raters menu | rater.py:17-28, 40-57 |
| `per_pair_only` | "Every pair is listed on its own. Flinch does not pick a biggest effect or a smallest p across pairs for you." | R5 pair select | replaces render.js:2063-2096 |
| `rate_n` (existing) | — | every Rate | — |

---

## Tab: Export

### 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ R1 · R2 tone-vs-none [done] · R3 Overview  Conditions 2  Responses 16  Analysis  Export ▁▁    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4 ┌ Downloads  each button saves one file ─────────────────────────────────────────────────┐│
│    │ ▣ In plain words: Six files cover everything this experiment holds. The CSVs open in   ││
│    │   a spreadsheet; the JSON is the whole record; the two Markdown files are drafts to    ││
│    │   edit, not finished documents.                                                         ││
│    │ ┌ RESPONSES WITH METRICS ─────────────────┐ ┌ ANALYSIS ──────────────────────────────┐ ││
│    │ │ one row per completed response: probe, │ │ one row per metric per pair: d, CI,    │ ││
│    │ │ condition, system prompt, text, 13     │ │ U, W, raw and corrected p. mean/sd      │ ││
│    │ │ metrics. 15 rows.                       │ │ columns are blank by design. 23 rows.  │ ││
│    │ │ [Download experiment_7_conditions.csv]  │ │ [Download experiment_7_analysis.csv]   │ ││
│    │ └─────────────────────────────────────────┘ └────────────────────────────────────────┘ ││
│    │ ┌ FULL RECORD ────────────────────────────┐ ┌ PREREGISTRATION ───────────────────────┐ ││
│    │ │ experiment, conditions, prompts,        │ │ OSF-style Markdown with your name,     │ ││
│    │ │ progress, ratings, eval tasks, every    │ │ description, conditions, prompt count  │ ││
│    │ │ analysis run, per-response metrics.     │ │ and models. The hypotheses and sampling│ ││
│    │ │ No response text.                       │ │ plan are fixed text from the code.     │ ││
│    │ │ [Download experiment_7.json]            │ │ [Download experiment_7_prereg.md]      │ ││
│    │ └─────────────────────────────────────────┘ └────────────────────────────────────────┘ ││
│    │ ┌ REPORT ─────────────────────────────────┐ ┌ PROLIFIC TASKS ────────────────────────┐ ││
│    │ │ Markdown: win-rate, effect-size and     │ │ 0 tasks generated. Generate blinded    │ ││
│    │ │ agreement tables from the last analysis,│ │ triplets for human raters, then        │ ││
│    │ │ chart links. ☐ also render charts (PNG) │ │ download the CSV once.                 │ ││
│    │ │ [Generate experiment_7_report.md]       │ │ prompts [300] raters per task [3]       │ ││
│    │ └─────────────────────────────────────────┘ │ [Generate tasks] [Download prolific_…] │ ││
│    │                                             │ [Import results CSV…]                  │ ││
│    │                                             └────────────────────────────────────────┘ ││
│    │ ⓘ The report and preregistration are plain Markdown drafts; the format setting the     ││
│    │   API accepts is ignored by the code, so there is no HTML or LaTeX.                      ││
│    └─────────────────────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```
Regions: R4 Downloads panel with six InsetBox cards.

#### 1024×700 differences
Cards go one per row. Nothing is hidden.

### 2. Regions

#### R4 Downloads
- Components: Panel, Readout, six InsetBox blocks, Button secondary md per download, Checkbox, two Input number, Dialog (Prolific import), Caveat.
- Content and bindings (every element):

| Element | Source route | JSON field / response | File name and extension | Component |
|---|---|---|---|---|
| Responses with metrics | `GET /api/experiments/{id}/condition-export` (app.py:3138-3188) | `text/csv`, columns `probe_name, probe_text, domain, condition_label, system_prompt, classification, response_text, word_count, sentence_count, flesch_kincaid_grade, flesch_reading_ease, gunning_fog, mtld, ttr, honore_statistic, hedging_ratio, confidence_ratio, evasion_ratio, subjectivity, polarity`; completed rows only | `experiment_{id}_conditions.csv` (server `Content-Disposition`, app.py:3187); the card says "{completed} rows" from `progress.completed` | Button |
| Analysis | `GET /api/experiments/{id}/analysis/export` (app.py:3025-3036; stats.py:591-670) | `text/csv`, one row per metric per pair, `mean_*`/`sd_*` blank (stats.py:655-656) | `experiment_{id}_analysis.csv` (server-named, app.py:3035); "{rows} rows" = TESTS count from Analysis; disabled with reason "Run the analysis first" when no analysis rows exist | Button |
| Full record | `GET /api/experiments/{id}/export` (app.py:3101-3117) | JSON `{experiment, conditions, prompts, progress, ratings, eval_tasks, analysis, metrics}`; no `Content-Disposition`, no response text | `experiment_{id}.json`, built client-side as a Blob | Button |
| Preregistration | `GET /api/experiments/{id}/preregistration` (app.py:3120-3127; reporting.py:275-315) | JSON `{preregistration: "<markdown>"}` | `experiment_{id}_prereg.md` from the string, client-side Blob | Button |
| Report | `POST /api/experiments/{id}/report` `{format: "markdown", include_charts, include_tables: true, include_preregistration: false}` (app.py:3039-3050; models.py:443-448) | JSON `{report: "<markdown>", tables: {…}, charts: [paths]}`; `format` is accepted but `generate_full_report` always writes Markdown (reporting.py:242-273); charts are PNG files written under `data/reports/{id}` on the server (reporting.py:35, 267) | `experiment_{id}_report.md`; the chart paths are listed under the button as text ("3 charts written to data/reports/{id}") since the UI cannot download server files | Button, Checkbox "also render charts (PNG)" |
| Prolific tasks: Generate | `POST /api/experiments/{id}/prolific` `{prompt_count, model_ids: [], raters_per_task, batch_id: ""}` (app.py:2983-2992; prolific.py:53-135) | `{batch_id, task_count, prompt_count, raters_per_task, conditions}` | card line "{task_count} tasks in batch {batch_id} for {prompt_count} prompts × {raters_per_task} raters" | Button |
| Prolific tasks: Download | `GET /api/experiments/{id}/prolific/csv` (app.py:2995-3002; prolific.py:137-185) | `text/csv` `tracking_id, prompt_text, response_a, response_b, response_c, question_text` for tasks with `status = 'pending'`; the call then marks them `exported` (prolific.py:179-182) | `prolific_experiment_{id}.csv` (server-named); the button is disabled with reason "No pending tasks: generate some, or they were already downloaded" when `eval_tasks` has no `pending` row | Button, Caveat `prolific_once` |
| Prolific tasks: Import results | `POST /api/experiments/{id}/human-evals/import` `{csv_text}` (app.py:3005-3012; prolific.py:187) | result dict | Dialog with a Textarea (paste) or file picker (read as text); toast with the result's counts | Dialog |
| Caveat | caveats | `report_markdown_only` | note | Caveat |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Any Download | the GET above | `<a download="{name}">` for server-named files; Blob + `URL.createObjectURL` for JSON/Markdown; button loading "Preparing…" until the response arrives; toast "Downloading {name}." / error toast with status |
| Generate report | POST above | loading "Generating…"; then the Blob download; the card shows "generated {time}" | 
| Generate tasks | POST above | loading; re-fetches `GET …/human-evals`; toast "{task_count} tasks generated." Disabled with reason "Every condition needs a completed response for a probe and model first" when no (prompt, model) is complete across all conditions (prolific.py:82-90, 109-110); 3 responses are expected per task (`response_a/b/c`, prolific.py:152, 170-172): with more than three conditions the extra ones are dropped from the CSV; the card says so (Term `prolific_three`) |
| Import results | POST above | Dialog; toast "Imported: {counts}"; hint "Run analysis again for human win rates and agreement" |

### 3. States (Export)
| State | Trigger | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|
| loading | enter | pulse cards | (null) |
| draft, nothing run | `progress.completed === 0`, no analysis | Responses CSV enabled (empty file, the card says "0 rows"); Analysis CSV disabled; Full record enabled; Preregistration enabled; Report enabled (tables empty) with Term "tables are empty until an analysis exists"; Prolific Generate disabled | "You can take the plan now: the preregistration and the full record. Responses and analysis fill in after a run." |
| responses, no analysis | completed > 0, no analysis | Analysis CSV disabled with reason | "Six files cover everything this experiment holds. Analysis is not run yet, so its CSV is empty and the report's tables are blank." |
| with analysis | analysis rows exist | all enabled | "Six files cover everything this experiment holds. The CSVs open in a spreadsheet; the JSON is the whole record; the two Markdown files are drafts to edit, not finished documents." |
| tasks generated | `eval_tasks` has rows | Prolific card counts; Download enabled while any `pending` | "… {task_count} Prolific tasks are waiting to download." |
| tasks exported | no `pending` tasks | Download disabled with the once-only reason | "… The Prolific CSV was downloaded; generate a new batch for another copy." |
| preparing | a download in flight | that button loading | unchanged |
| download failed | non-2xx | error Toast "Could not download {name}: {status}." | unchanged |
| error | the shared load failed | EmptyState with Retry | (null) |

### 4. Numbers (Export)
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "15 rows" (responses CSV) | `progress.completed` (the export filters `status = 'completed'`, app.py:3170) | the card text names it | card |
| "23 rows" (analysis CSV) | TESTS count (Analysis R4) | — | card |
| "{task_count} tasks" | from the generate response or `eval_tasks.length` | "{prompt_count} prompts × {raters_per_task} raters" | card |
| "{n} charts written" | `charts.length` | server path | card |

### 5. Caveats (Export)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `report_markdown_only` | "The report and preregistration are plain Markdown drafts. The API accepts a format setting but the code ignores it, so there is no HTML or LaTeX." | panel note | reporting.py:242-273 (format unused), models.py:445 |
| `prereg_fixed_text` | "The hypotheses, analysis plan and sampling plan in the preregistration are fixed text from the code, written for a different study. Edit them before you file it." | Preregistration card | reporting.py:287-313 |
| `prolific_once` | "Downloading marks the tasks as exported; the next download is empty unless you generate another batch." | Prolific Download | prolific.py:145, 179-182 |
| `prolific_three` (Term) | "The Prolific CSV has columns for three responses; with more than three conditions the rest are not included." | Prolific card | prolific.py:152, 170-172 |
| `full_record_no_text` | "The full record holds every table except the response text. Response text is in the responses CSV." | Full record card | app.py:3104-3117 |
| `analysis_csv_blank_means` | "The analysis CSV's mean and sd columns are blank by design." | Analysis card | stats.py:655-656 |

---

## 6. Terms (rule 4), whole screen
| Term | Where it appears | Definition source |
|---|---|---|
| experiment, condition, cell, base model, provider, probe | Overview R5, Conditions | `experiments-list.md` §6; `experiment-new.md` §6 |
| concurrency | Overview R4 | `StartExperimentRequest.concurrency_per_provider` (models.py:388-392); RateLimiterPool |
| estimate | Overview | runner.py:620-632 |
| interrupted run, done with pending | R2 chip | runner.py:528-531; app.py:2908-2917 |
| compliance rate | Conditions | db.py:3802-3804 |
| refused, collapsed, negotiated, complied, unlabelled | Conditions bars, Responses label | `Outcome` type; `classification` column (db.py:375) |
| MTLD, TTR, Honoré's statistic, Flesch-Kincaid grade, Flesch reading ease, Gunning fog, hedging ratio, confidence ratio, evasion ratio, subjectivity, polarity, words per sentence, OOV rate, modal/adjective/adverb/subordination rate, word frequency rank | Conditions R5, Analysis R5 | lexical.py:159-269 |
| Cohen's d, pooled sd, bootstrap CI | Analysis | stats.py:57-83 |
| Mann-Whitney U, rank-biserial r | Analysis | stats.py:49-54, 409-458 |
| Wilcoxon signed-rank W, pairs, median difference | Analysis | stats.py:460-538 |
| Bonferroni, FDR (Benjamini-Hochberg), significant | Analysis | stats.py:540-589 |
| power, required n, target d | Analysis | stats.py:362-392 |
| win rate, ranking, blind, rater model | Analysis R6 | stats.py:108-197; rater.py:17-57 |
| Krippendorff's alpha (ordinal) | Analysis R6 | stats.py:261-323 |
| Prolific task, batch, tracking id, eval task | Export | prolific.py:53-135 |
| preregistration (OSF) | Export | reporting.py:275-315 |
| finish reason, attempts, latency | Responses | runner.py:563-573 |

## 7. First-time tips (rule 6), whole screen
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `experiment.estimate` | `[data-tip="estimate-cost"]` | "This is the server's guess before anything runs: cells × a fixed token budget × average list prices. Start is next to it; nothing has been sent yet." | first Overview in state draft/ready |
| `experiment.start-keeps-running` | `[data-tip="start-button"]` | "Once started, the run keeps going while you move around Flinch. Closing or reloading Flinch stops it; you can resume." | first time Start is enabled |
| `experiment.compliance` | `[data-tip="compliance-rate"]` (first card's COMPLIANCE) | "The rate is complied plus negotiated over completed. Negotiated counts as compliance. Today experiment responses carry no label, so it reads 'not yet labelled'." | first Conditions view with responses |
| `experiment.metrics` | `[data-tip="compute-metrics"]` | "Metrics are counts and formulas over the text: words, readability, how many listed hedging phrases appear. The first run downloads language data once." | first Conditions view with responses and no metrics |
| `experiment.per-pair` | `[data-tip="pair-select"]` | "Every pair of conditions gets its own table. Flinch never picks the biggest effect for you; read the corrected p columns." | first Analysis view with data |
| `experiment.corrections` | `[data-tip="p-fdr-header"]` | "Bonferroni and FDR correct for running many tests at once. They cover the Mann-Whitney p-values only." | first Analysis view with data |
| `experiment.export-names` | `[data-tip="export-responses"]` | "Each button saves one file with its own name and extension. The two Markdown files are drafts to edit." | first Export view |

## 8. Keyboard and focus, whole screen
- Shortcuts: `Alt+1`…`Alt+5` tabs; `Left`/`Right`/`Home`/`End` on the tablist; Overview: `s` = Start/Resume when enabled, `p` = Pause when running; Conditions: `m` = Compute metrics; Responses: `/` focuses search, `Up`/`Down` move the selection, `Enter` opens the selected row's detail focus, `c` copies the response; Analysis: `a` = Run analysis when enabled; Export: none beyond Tab; `Escape` closes any Dialog/Drawer; `F8` toasts.
- Focus order: header → ← Experiments → ⋯ menu → tablist → tab body top to bottom (Overview: Readout is not focusable; Stats skipped; concurrency inputs; Start; Add prompts; Setup "Show all" buttons. Conditions: Compute metrics, CSV, Resume; per card "Show all"; table headers; probe/model selects; cards' Open ▸. Responses: search, three selects, table rows (roving), Split divider, detail "Show all", Copy. Analysis: Run AI raters, Run analysis, CSV, pair select, metric filter, table headers. Export: six buttons in reading order, checkbox, inputs, Generate, Download, Import). On tab change focus moves to the tab body's first focusable control or the Readout container (`tabindex=-1`).
- Live regions: the Readout of each tab; ProgressCard counts (throttled 3 s); inline Progress lines for metrics/raters (`role="progressbar"` + polite text every 3 s); Toasts; the Responses counts line; "Label changed" is never announced here (labels are read-only, §12 Q1).

## 9. Dialogs and overlays opened from here
- Rename or describe Dialog; Delete Dialog (confirm, typed name); Stop run Dialog; Recompute metrics Dialog; Choose raters Dialog (chips of the three defaults plus a free-text model id, needs the provider's key); Add prompts Dialogs (session / all probes / CSV / HH-RLHF, the HH one with the LoadingScreen); Prolific import Dialog; Quick look is not here (R5 Setup covers it).
- FirstTimeTips §7; HelpMenu, Shortcuts (global).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/experiments/{id}` | shared load on enter and after every mutation; tab counts |
| GET | `/api/experiments/{id}/progress` | Overview/Responses/Conditions poll every 2 s while the store has this id or status is running |
| POST | `/api/experiments/{id}/estimate` | Overview R4 on enter (draft/paused/interrupted) and after Add prompts |
| POST | `/api/experiments/{id}/start` | Overview Start (body `{concurrency_per_provider}`), stream held in the run store |
| POST | `/api/experiments/{id}/resume` | Overview/Conditions Resume (same body), stream held in the store |
| POST | `/api/experiments/{id}/pause` | ProgressCard Pause |
| PUT | `/api/experiments/{id}` | R2 ⋯ Rename or describe |
| DELETE | `/api/experiments/{id}` | R2 ⋯ Delete → `#/experiments` |
| GET | `/api/experiments/{id}/prompts` | Overview R5, Conditions R6 select, Responses names |
| POST | `/api/experiments/{id}/prompts` | Overview Add prompts (session / all) |
| POST | `/api/experiments/{id}/prompts/import` | Overview Add prompts (CSV) |
| POST | `/api/experiments/{id}/prompts/import-hh` | Overview Add prompts (HH-RLHF), SSE |
| GET | `/api/probes`, `/api/probes?session_id=` | Add prompts pickers |
| GET | `/api/experiments/{id}/condition-comparison` | Conditions R4, R5; Analysis `has_metrics` |
| POST | `/api/experiments/{id}/metrics` (`?force=true`) | Conditions Compute/Recompute, SSE |
| GET | `/api/experiments/{id}/condition-export` | Conditions CSV; Export responses CSV |
| GET | `/api/experiments/{id}/responses` (`?prompt_id=`, `?condition_id=`, `?model_id=`, `?status=`) | Conditions R6; Responses R4 |
| GET | `/api/experiments/{id}/metrics` | Responses R5 DETAILS |
| GET | `/api/experiments/{id}/analysis` | Analysis (newest row per type); Export enablement |
| POST | `/api/experiments/{id}/analyze` | Analysis Run analysis |
| GET | `/api/experiments/{id}/analysis/export` | Analysis CSV; Export analysis CSV |
| POST | `/api/experiments/{id}/rate` | Analysis Run AI raters, SSE |
| GET | `/api/experiments/{id}/ratings` | Analysis AI RATINGS Stat, staleness |
| GET | `/api/experiments/{id}/human-evals` | Analysis HUMAN EVALS Stat; Export Prolific card |
| GET | `/api/experiments/{id}/export` | Export full record |
| GET | `/api/experiments/{id}/preregistration` | Export preregistration |
| POST | `/api/experiments/{id}/report` | Export report |
| POST | `/api/experiments/{id}/prolific` | Export Generate tasks |
| GET | `/api/experiments/{id}/prolific/csv` | Export Prolific download |
| POST | `/api/experiments/{id}/human-evals/import` | Export Import results |
| GET | `/api/experiments/{id}/conditions` | not called (the shared load already returns `conditions`); route stays API-only |
| POST | `/api/experiments/{id}/conditions` | Overview Setup "Add condition" (draft only, before any cells exist: `create_experiment_responses` runs at start, db.py:3374-3413) |
| POST | `/api/experiments/{id}/resume-conditions` | not called: it re-runs pending cells on the first pending row's model only and bypasses the rate limiter (app.py:3191-3298); `/resume` covers the same cells for every model. Route stays API-only |
| GET | `/api/settings/keys` | Overview KEYS Stat, rater/Start reasons |
| GET | `/api/sessions` | header |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. Opening `#/experiments/7` (draft, 4 prompts, 2 conditions, 2 models) issues `GET /api/experiments/7` then `POST /api/experiments/7/estimate`; the CELLS Stat reads "16" and its made-of line reads "4 prompts × 2 conditions × 2 models"; the EST. COST Stat text starts with "about $" and its made-of line contains "500 in + 1 000 out".
2. The tablist has five `role="tab"` elements in the order Overview, Conditions, Responses, Analysis, Export; the Conditions tab contains a pill "2" and Responses "0"; `Alt+3` selects Responses and `location.hash` ends with `/responses`.
3. With the OpenAI key unset, the KEYS Stat reads "1 of 2 needed" and the Start button is `aria-disabled` with `aria-describedby` text "No key for openai"; the text contains a link to `#/settings#keys`.
4. Clicking Start sends one `POST /api/experiments/7/start` whose JSON body is `{"concurrency_per_provider":{"anthropic":5,"openai":5,"google":3,"together":3,"ollama":3}}`; R4 becomes a `ProgressCard` with text "0 of 16 done" within 1 s; navigating to `#/experiments` and back keeps the card and its elapsed counter running (the fetch is not aborted); a `GET /api/experiments/7/progress` request occurs at least every 2.5 s while running.
5. Reloading the page mid-run then opening the experiment shows the R2 chip text "running (interrupted)" and an R4 button whose label matches `/^Resume \d+ pending$/`; clicking it sends `POST /api/experiments/7/resume` with the same body shape as Start.
6. On Conditions with 16 completed, unlabelled responses, each card's COMPLIANCE value is the text "not yet labelled" with a `role="term"`; the Bar has five rows and the row labelled "unlabelled" has `aria-label` "unlabelled, 8 of 8, 100 percent"; no element in the tab contains a percentage without "of" in the same element.
7. Clicking Compute metrics sends `POST /api/experiments/7/metrics` (no `force`), shows an inline `role="progressbar"` and, on the `complete` event, reloads `condition-comparison` so the metrics table has 13 `<tr>` in `<tbody>`, each numeric cell matching `/^-?\d+(\.\d{2})? ± \d+(\.\d{2})? \(\d+\)$|^n\/a$/`.
8. The Response browser's probe `<select>` has one option per prompt (4) and selecting "the-autopsy" sends `GET /api/experiments/7/responses?prompt_id={its id}`; four cards render, grouped baseline before clinical-register.
9. On Responses, the list has 16 rows; `Down` three times then `Enter` sets `?r=` to the fourth row's id; the detail shows three `<article>` turns (probe, system prompt, model) and the DETAILS grid contains "attempts 1 of 5"; the LabelControl is disabled and its reason text contains "no classifier".
10. On Analysis after `POST /api/experiments/7/analyze`, `GET /api/experiments/7/analysis` is called and the per-pair table for "baseline vs clinical-register" has one row per metric present in the newest `nonparametric` row; the d cell matches `/^[+−]\d\.\d{2} \([+−]\d\.\d{2} to [+−]\d\.\d{2}\)$|^n\/a$/` (U+2212 minus); the p columns match `/^(p = 0\.\d{3}|p < 0\.001|n\/a)$/`; the TESTS Stat equals the number of rows with a p across all pairs; no element on the tab contains the words "smallest" or "largest".
11. Running `/analyze` twice then opening Analysis uses the newest `created_at` row per `analysis_type` (assert the subtitle "last run" equals the newest timestamp and the table reflects the second run's values when the fixture differs).
12. POWER Stat with 16 completed responses reads "insufficient" and its made-of line contains "5 per group assumed (16 ÷ 3), 175 needed for d 0.3, α 0.05, power 0.80".
13. Analysis R6 with no ratings shows an `EmptyState` whose action is named "Run AI raters"; choosing the default raters sends `POST /api/experiments/7/rate` with `rater_models` equal to the three default ids.
14. On Export, the six buttons trigger, in order, `GET …/condition-export`, `GET …/analysis/export`, `GET …/export`, `GET …/preregistration`, `POST …/report`, `GET …/prolific/csv`; the resulting `<a download>` attributes are exactly `experiment_7_conditions.csv`, `experiment_7_analysis.csv`, `experiment_7.json`, `experiment_7_prereg.md`, `experiment_7_report.md`, `prolific_experiment_7.csv`; the JSON Blob parses and has the keys `experiment, conditions, prompts, progress, ratings, eval_tasks, analysis, metrics`; the two `.md` Blobs start with "# ".
15. With no analysis rows, the Analysis CSV button is `aria-disabled` with reason "Run the analysis first"; with no pending eval tasks the Prolific download is `aria-disabled` and its reason contains "generate".
16. Every Caveat id listed in §5 of each tab renders its exact phrase on the fixture for that tab (`lib/copy/caveats.test.ts`); `copy-lint` passes on every visible string; at 1024×700 no tab has a horizontal scrollbar on `body` and the Responses Split left pane is ≥ 280 px.

## 12. Open questions for Brad
1. **Labels on experiment responses.** Nothing classifies them (runner.py:563-573; app.py:659-665) and there is no route to set `classification` on a response, so the compliance rate is always "not yet labelled" and the LabelControl is read-only. This spec shows the truth. Do you want the plan to add classification to `ExperimentRunner` (the classifier exists, classifier.py:48) and a `PATCH` route for overrides, so the Conditions tab can show real rates? Without it the tab answers the experiment's question only through lexical metrics and judge rankings.
2. **Analysis dependencies.** Effect sizes, tests and alpha need numpy, scipy and krippendorff (`pip install -e '.[experiment]'`, stats.py:37-46). Should the Tauri bundle include them, or does the Analysis tab carry the "install the extras" state in the desktop build?
3. **Failed cells.** Resume re-reads `pending` only (db.py:3527); failed cells (after 5 tries) cannot be re-run from any route. Add a "reset failed to pending" route to the plan, or leave failed as final?
4. **Six exports, not five.** The baseline had five buttons, one of which (JSONL) never had a route; the server has six outputs (responses CSV, analysis CSV, full JSON, preregistration, report, Prolific CSV). The spec lists all six. Drop any?
5. **Cost.** The server records token usage in the rate limiter but never sums cost (runner.py:558-561). "cost so far" cannot be shown. Add it to the plan, or keep the estimate only?
6. The `report` route writes PNG charts to the server's `data/reports/{id}` (reporting.py:35) that the UI cannot fetch. Add a static route, or leave the chart paths as text?
