# New experiment

- Route(s): `#/experiments/new`; `#/experiments/new?variants=<group_id>&session=<session_id>` (prefilled from a conditions-type variant group, §0)
- Section: Experiments
- Purpose (one sentence, what the researcher does here): define an experiment (conditions, then models and probes), review the choices, and create it, so the Overview can show the backend's estimate before anything runs.
- Arrives from: `#/experiments` "New experiment"; Home "Experiments" card; Library › Variant groups "Run as experiment" on a conditions-type group (the baseline's Framing Variants conditions run). Leaves to: `#/experiments/:id` Overview after Create (always, even when a prompt import failed: see §3); back to `#/experiments` on Cancel or "←".
- Components used (names from `../03-components.md`): Header set (§1), Panel (§2.3), InsetBox (§2.4), Readout (§3), Term (§4), Caveat (§5), Input, Textarea, Select, Checkbox, Segmented (§16), Chip (§17), List/Row (§13), Button (§15), Dialog (§18), Toast (§21), FirstTimeTip (§22), LoadingScreen/Progress (§24) for the HH-RLHF import, ProbeList rows reused without the session footer (§25).
- Baseline surfaces replaced (from `../00-content-inventory.md`): §31 "New Experiment" wizard (experiment.js:247-436, 876-941); §20 Framing Variants conditions-type "Run ({labels} conditions × {all probes} probes)" and its `confirm()` plus floating progress bar (render.js:3138-3196; api.js:111-178). Fixes carried: the 422 on create (wizard sent `conditions[].name`/`type`/`models`/`probe_set_ids`/`repetitions`; the API needs `conditions[].label`, non-empty `system_prompt`, `model_ids`: models.py:213-217, 250-257); the success handler read `result.id` but the API returns `{experiment, conditions}` (app.py:2785); the step-4 big number ignored the server estimate (app.py:2884-2898), which now lives on the Overview.

## 0. Entry from a conditions-type variant group (replaces batch-conditions)
Today "Run" on a conditions-type group calls `POST /api/sessions/{id}/batch-conditions`, which silently creates an experiment named "Condition run: {session_id} @ {ts}" (app.py:596-601), runs every session probe under every condition on the session's target model (app.py:638-641; runner.py:287-390), writes the responses into that experiment (app.py:654-665) **and** records a session run per cell with `notes = "condition:{label}"` (runner.py:347-348), which is what the Framing study's consistency score reads.

The rebuild keeps that route (it is the only path that also writes session runs) but says so first:

- "Run as experiment" on a conditions-type group opens `#/experiments/new?variants=<gid>&session=<sid>`. The stepper is prefilled: Basics name "Condition run: {session name} @ {local time}", description "From variant group {gid} in session {session name}"; Conditions from `GET /api/variants/files/{gid}` `variants[] {label, prompt_text}` (label → `label`, `prompt_text` → `system_prompt`; `is_baseline` → description "baseline"); Models fixed to the session's `target_model`; Probes fixed to the session's probes (`GET /api/probes?session_id=`, app.py:257-263). Steps 2 and 3 are read-only in this mode, each with the line "Set by the variant group and session. Edit the group in Library › Variant groups." (draft; brad-voice pass).
- Review (R5) adds the InsetBox "What this run does" (draft; brad-voice pass): "Runs {probes} probes under {conditions} conditions on {model}: {cells} cells. Each cell is also saved as a run in the session {session name}, so the Framing study can score consistency. Flinch creates the experiment and starts it at once; there is no separate Start." Caveat `batch_conditions_autostart`.
- Primary button reads "Create and run". It calls `POST /api/sessions/{sid}/batch-conditions` `{probe_ids: [...], conditions: [{label, system_prompt}], delay_ms: 2000, concurrency: 5}` (`BatchConditionsRequest`, app.py:171-179; concurrency 1 when `target_model` starts with `ollama:`, as the baseline did, api.js:111-178). The stream is held in the app-level run store as kind `batch-conditions`. The experiment id is not in the progress events; it arrives only in the `complete` event (app.py:671-679). So after the first `event: progress`, the screen calls `GET /api/experiments` and opens the newest row whose name starts with "Condition run: {sid} @" (app.py:598) at `#/experiments/:id` Overview, where the ProgressCard reads the same store entry. If no such row exists yet, it retries once per second for 5 s, then stays on Review with the ProgressCard inline and the toast "Running. The experiment will appear in the list in a moment." (draft; brad-voice pass).
- The experiment's responses are written without a classification (app.py:659-665; see `experiment.md` §5 `unlabelled`), the same as every other experiment.

## 1. Wireframe, 1280×800
```
Step 2 (Conditions) shown. Steps 1, 3, 4 below.
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set   Probe Studies Experiments … ? ⚙│ R1
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R2 ← Experiments      New experiment                                                          │
│    ① Basics ✓   ② Conditions ●   ③ Models and probes ○   ④ Review ○                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3 ┌ Conditions  2 so far ────────────────────────────────────────────────────────────────┐  │
│    │ ▣ In plain words: A condition is one system prompt. The model sees it before every    │  │
│    │   probe. Give each a short label; the first one is usually your baseline.            │  │
│    │ ┌ 1 ─────────────────────────────────────────────────────────────── [↑] [↓] [✕] ┐     │  │
│    │ │ LABEL *            [baseline                      ]  DESCRIPTION [plain assistant]│     │  │
│    │ │ SYSTEM PROMPT *                                                                 │     │  │
│    │ │ [You are a helpful assistant.                                                  ]│     │  │
│    │ │ [                                                                              ]│     │  │
│    │ │ 29 characters                                                                   │     │  │
│    │ └─────────────────────────────────────────────────────────────────────────────────┘     │  │
│    │ ┌ 2 ─────────────────────────────────────────────────────────────── [↑] [↓] [✕] ┐     │  │
│    │ │ LABEL *            [clinical-register             ]  DESCRIPTION [            ]│     │  │
│    │ │ SYSTEM PROMPT *                                                                 │     │  │
│    │ │ [You are a clinical writing assistant. Keep a neutral, procedural register and │     │  │
│    │ │  avoid sensational detail.                                                     ]│     │  │
│    │ │ 101 characters                                                                  │     │  │
│    │ └─────────────────────────────────────────────────────────────────────────────────┘     │  │
│    │ [+ Add condition]                                                                       │  │
│    │ ⓘ A system prompt cannot be empty: the API rejects it. For a "no system prompt"        │  │
│    │   baseline use a one-line neutral prompt and say so in its description.                │  │
│    └─────────────────────────────────────────────────────────────────────────────────────────┘  │
│ R4 [Cancel]                                                          [← Back]  [Next →]       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

Step 1 Basics (R3 body)
┌ Basics ───────────────────────────────────────────────────────────────┐
│ ▣ In plain words: Name the question. The description is what the     │
│   report and the preregistration will print.                          │
│ NAME *          [tone-vs-none                                   ]     │
│ DESCRIPTION     [Does a clinical register change refusals on the three│
│                  example probes?                                 ]     │
│ RANDOM SEED     [      ]  ⓘ optional, stored on the experiment        │
└───────────────────────────────────────────────────────────────────────┘

Step 3 Models and probes (R3 body)
┌ Models and probes ─────────────────────────────────────────────────────────────────────────┐
│ ▣ In plain words: Every probe runs under every condition on every model. 3 probes ×        │
│   2 conditions × 2 models would be 12 cells.                                                │
│ MODELS *   [claude-sonnet-4-6 ×] [gpt-4o-mini ×]   [model id…        ] [Add]               │
│            ● Anthropic key set   ● OpenAI key set   ○ Google: no key   ○ xAI: no key        │
│ BASE MODELS (optional)  [base model id…   ] [Add]   ⓘ run through the base-model target     │
│ PROBES *   ( ● From this session: crime-set-1 (4) ) ( ○ Pick from all probes )             │
│            ( ○ Paste a CSV ) ( ○ Import from Anthropic HH-RLHF )                           │
│   CRIME                                                                                      │
│   ☑ the-stabbing      crime     ☑ the-robbery      crime                                     │
│   MEDICAL                                                                                    │
│   ☑ the-autopsy       medical                                                                │
│   ROMANCE                                                                                    │
│   ☑ the-hotel-room    romance                                                                │
│   4 of 4 selected · [Select all] [Select none]                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

Step 4 Review (R3 body)
┌ Review ────────────────────────────────────────────────────────────────┐
│ ▣ In plain words: These are your choices. The size and cost estimate    │
│   comes from the server after Create, on the Overview, before Start.    │
│ NAME         tone-vs-none                                               │
│ DESCRIPTION  Does a clinical register change refusals on the three …    │
│ CONDITIONS   1 baseline · 2 clinical-register                           │
│ MODELS       claude-sonnet-4-6, gpt-4o-mini                             │
│ PROBES       4 from session crime-set-1: the-stabbing, the-robbery, …   │
│ SEED         none                                                       │
│ [Edit basics] [Edit conditions] [Edit models and probes]                │
└────────────────────────────────────────────────────────────────────────┘
R4 at step 4: [Cancel]                                [← Back]  [Create experiment]
```
Regions: R1 Header · R2 Title row and stepper · R3 Step panel · R4 Footer bar.

### 1024×700 differences
R2 stepper labels keep their words; the step numbers drop their circles' padding. In step 2 the LABEL and DESCRIPTION inputs stack (description under label). In step 3 the probe grid goes from two columns to one; the model chips wrap. R3 scrolls inside the viewport; R4 stays fixed at the bottom. Nothing is hidden.

## 2. Regions

### R1 Header
As `experiments-list.md` R1 (PrimaryNav current = Experiments).

### R2 Title row and stepper
- Components: Button ghost sm "← Experiments"; heading `text-sm font-semibold text-zinc-100` "New experiment"; stepper = four Chip `kind: 'chip'` items in a `role="list"` with ✓ (done), ● (current), ○ (next).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Step chips | none (wizard state) | `step` 1..4, `done[]` | done chips are buttons (go back); the current is `aria-current="step"`; future chips disabled with reason "finish the current step" | Chip |
| Prefill badge (§0 mode) | `GET /api/variants/files/{gid}` | `title` | tag "from variant group {title}" after the heading | Chip tag |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| ← Experiments | none | if any field is non-empty, Dialog "Leave without creating? Your entries are not saved." (draft; brad-voice pass) with "Leave" (danger) / "Stay"; else `#/experiments` |
| Done step chip | none | goes to that step; later steps keep their values |

### R3 Step panel
- Components: Panel (heading = step name, subtitle = count where it exists), Readout, step form.

**Step 1 Basics**

| Element | Source route | JSON field (request) | Formatting rule | Component |
|---|---|---|---|---|
| Name | `POST /api/experiments` | `name` (1 to 200 chars, models.py:251) | required; counter "{n} of 200" appears above 160 | Input |
| Description | same | `description` | optional; "printed by the report and the preregistration" hint (reporting.py:251, 285) | Textarea rows 3 |
| Random seed | same | `random_seed` (int or null, models.py:255) | optional number; "stored on the experiment; the analysis bootstrap uses its own fixed seed 42" (stats.py:71, 86) as a Term | Input number |

**Step 2 Conditions**

| Element | Source route | JSON field (request) | Formatting rule | Component |
|---|---|---|---|---|
| Condition card n | `POST /api/experiments` | `conditions[n]` with `sort_order = n − 1` (models.py:217; db.py:3302 orders by it) | InsetBox block; rank number as eyebrow | InsetBox |
| Label | same | `conditions[].label` (1 to 100 chars, models.py:214) | required; unique within the experiment (analysis keys pairs by label `"{a}_vs_{b}"`, stats.py:239, so duplicates would collide): inline error "Labels must be different" | Input |
| Description | same | `conditions[].description` (models.py:216) | optional; shown in the Conditions tab | Input |
| System prompt | same | `conditions[].system_prompt` (min length 1, models.py:215) | required; Textarea auto-grow; character count beneath | Textarea |
| ↑ ↓ | none | reorder (`sort_order`) | ghost icon sm; disabled at the ends | Button |
| ✕ | none | remove | ghost icon sm; the last remaining card cannot be removed (reason "at least one condition") | Button |
| + Add condition | none | appends an empty card, focus on its Label | Button secondary sm |
| Note | `lib/copy/caveats.ts` | `system_prompt_required` | inline note | Caveat |

**Step 3 Models and probes**

| Element | Source route | JSON field (request) | Formatting rule | Component |
|---|---|---|---|---|
| Model chips | `POST /api/experiments` | `model_ids[]` (models.py:253) | removable Chip; the provider is inferred by id (runner.py:447-461) and shown as a tag "anthropic" / "openai" / "google" / "xai" / "together" / "ollama" after the id | Chip |
| Model id input + Add | none | — | free text; Enter adds; duplicates rejected inline "already added" | Input, Button |
| Key readiness row | `GET /api/settings/keys` | `[].provider`, `[].is_set` (app.py:2263-2275) | one dot per provider; a chip whose provider has no key gets a Term "no key: this model cannot run until a key is set in Settings" but is allowed (drafting without keys is allowed) | KeyStatusChip data, Term |
| Base models | same request | `base_model_ids[]` (models.py:254) | same chip pattern; tag "base"; hint "run through the base-model target" with Term `base_model` (runner.py:596-597) | Chip |
| Probe source | none | decides which second call follows Create | Segmented, four options | Segmented |
| From this session | `GET /api/probes?session_id={s}` (app.py:257-263) | `[] {id, name, domain, …}` | grouped by domain, checkboxes; disabled with reason "no session is open" when the switcher is empty | List select mode (ProbeList rows) |
| Pick from all probes | `GET /api/probes` (app.py:257-263) | same | same grid plus a search Input | List select mode |
| Paste a CSV | `POST /api/experiments/{id}/prompts/import` after Create | `csv_text` with columns `prompt_text, domain` (db.py:3340-3355) | Textarea; a header-row hint; count of non-empty `prompt_text` rows parsed client-side as "{n} prompts found" | Textarea |
| Import from Anthropic HH-RLHF | `POST /api/experiments/{id}/prompts/import-hh` after Create (SSE) | `target_count` (default 800), `subsets[]` of `harmless-base`, `helpful-base`, `helpful-online`, `helpful-rejection-sampled`, `stratification{}`, `seed` (models.py:416-430; hh_import.py:288-297) | Input number, four Checkboxes, seed Input; note "Downloads from Hugging Face; needs network. Prompts from this set are not Flinch probes and have no domain groups." (draft; brad-voice pass) | Inputs |
| "k of n selected" | none | count of checked | Rate-style count, never a bare percent | text |

**Step 4 Review** (choices only; no estimate, no cost, no cell count: those come from `POST /api/experiments/{id}/estimate` on the Overview after Create, app.py:2884-2898)

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Name, Description | wizard state | — | definition grid (vocab §6) | InsetBox |
| Conditions | wizard state | — | "{n} {label}" list in order; Term `condition` | InsetBox |
| Models | wizard state | — | comma list; base models tagged | InsetBox |
| Probes | wizard state | — | "{k} from session {name}: {first three names}, …" / "{k} picked from all probes" / "{n} prompts from a pasted CSV" / "HH-RLHF: up to {target_count} from {subsets}" | InsetBox |
| Seed | wizard state | — | number or "none" | InsetBox |
| Edit buttons | none | — | three text buttons, each jumps to its step | Button text |
| §0 mode box | see §0 | — | InsetBox "What this run does" + Caveat `batch_conditions_autostart` | InsetBox, Caveat |

- Actions (R3):

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Any field | none | wizard state; `localStorage['flinch:experiment-draft']` keeps an unsent draft (per-viewer convenience only); cleared on Create or Cancel |

### R4 Footer bar
- Components: Button secondary md "Cancel"; Button secondary md "← Back" (hidden at step 1); Button primary md "Next →" (steps 1 to 3) or "Create experiment" (step 4; "Create and run" in §0 mode).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Next | none | validates the step (§3 validation states) | disabled with the first unmet reason as its `disabled.reason` ("Give the experiment a name", "Every condition needs a label and a system prompt", "Add at least one model", "Pick at least one probe, or choose a prompt source") (draft; brad-voice pass) | Button |
| Create experiment | `POST /api/experiments` `{name, description, random_seed, config: {}, model_ids, base_model_ids, conditions[{label, system_prompt, description, sort_order}]}` (models.py:250-257) → `{experiment, conditions}` (app.py:2771-2785) | loading "Creating…"; then the prompt call for the chosen source: `POST /api/experiments/{id}/prompts` `[{probe_id}]` (app.py:2837-2843) → `{added}`; or `POST …/prompts/import` `{csv_text}` → `{imported}` (app.py:2846-2851); or `POST …/prompts/import-hh` (SSE: `{event:"complete", imported, by_domain, by_subset, skipped?, warning?}` or `{event:"error", error}`, app.py:2854-2875; hh_import.py:331-337) shown as a LoadingScreen "Importing prompts" with elapsed time and no fake percent; then `#/experiments/{experiment.id}` Overview; toast "Created {name}: {prompts} prompts, {conditions} conditions, {models} models." (draft; brad-voice pass) | Button |
| Cancel | none | Dialog as R2 "← Experiments" when dirty; else `#/experiments` |

## 3. States
| State | Trigger | R2 | R3 | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|
| step 1 empty | route entered | ① current | Basics form, Name focused | Next disabled (reason "Give the experiment a name") | "Name the question. The description is what the report and the preregistration will print." |
| step 1 valid | name non-empty | ① current | — | Next enabled | same |
| step 2 | Next from 1 | ① ✓ ② current | one empty condition card, Label focused | Next disabled (reason) | "A condition is one system prompt. The model sees it before every probe. Give each a short label; the first one is usually your baseline." |
| step 2 validation | Next with an empty label or prompt, or duplicate labels | — | the offending field gets `aria-invalid` and the message; focus moves to the first | Next stays disabled | unchanged |
| step 3 loading probes | Next from 2 | ③ current | probe grid shows six `animate-pulse` rows while `GET /api/probes` is in flight | Next disabled | "Every probe runs under every condition on every model. {p} probes × {c} conditions × {m} models would be {p·c·m} cells." (the numbers are the wizard's own counts, labelled "would be"; the server's count appears on the Overview) |
| step 3, no session | SessionSwitcher is "No session" | — | "From this session" option disabled with reason "no session is open"; the Segmented defaults to "Pick from all probes" | — | as above |
| step 3, no probes anywhere | `GET /api/probes` returns `[]` | — | EmptyState "No probes yet. Add probes in Library › Probes, paste a CSV, or import from HH-RLHF." with action "Library › Probes" | Next disabled unless CSV or HH chosen | as above |
| step 3, no key for a chosen model | `GET /api/settings/keys` `is_set` false for that provider | — | the chip gets the Term and an amber dot | Next enabled (drafting allowed) | as above plus "No key is set for {provider}, so {model} cannot run until you add one in Settings." |
| step 3 probes failed | `GET /api/probes` non-2xx | — | EmptyState "Flinch could not load probes. {message}" with Retry | Next disabled unless CSV or HH chosen | — |
| step 4 | Next from 3 | ④ current | Review grid | Create enabled | "These are your choices. The size and cost estimate comes from the server after Create, on the Overview, before Start." |
| creating | Create clicked | stepper disabled | form inert | Create loading "Creating…" | unchanged |
| create failed (422) | `POST /api/experiments` 422 | — | the `detail[].loc` fields are mapped back to their inputs and the step with the first error is shown; a note "The server rejected the experiment: {detail[0].msg}" | Create enabled | unchanged, Toast error "Could not create the experiment. {msg}" |
| create failed (network / 5xx) | — | — | — | Create enabled | Toast error "Could not create the experiment. {status}." |
| created, prompts failed | `POST /api/experiments` 200 but the prompt call failed | — | — | — | navigates to `#/experiments/{id}` anyway (the experiment exists); Toast error with action "Add prompts" pointing at the Overview's "Add prompts" control (see `experiment.md` Overview R4); the Overview shows `prompts: 0` in the estimate and Start disabled |
| HH import running | `/prompts/import-hh` stream open | — | LoadingScreen "Importing prompts from HH-RLHF" with steps download → extract → sample → import (the server reports no step events, hh_import.py:298-300, so the list shows one current step "Working…" with elapsed and no ETA: "No estimate yet. Flinch is timing this for next time") and Cancel (aborts the fetch; the experiment keeps whatever was written) | hidden | — |
| HH import warning | `complete` with `warning` (experiment already has prompts, hh_import.py:331-337) | — | — | — | Toast info with the server's `warning` |
| §0 prefilled | `?variants=` present | tag "from variant group" | steps 2 and 3 read-only with the line in §0 | "Create and run" | step 4: "Runs {p} probes under {c} conditions on {model}: {p·c} cells. Each cell is also saved as a run in the session." |
| §0 variant group failed | `GET /api/variants/files/{gid}` non-2xx | — | EmptyState "Flinch could not load that variant group. {message}" with action "Library › Variant groups" | Create disabled | — |
| §0 running | first `event: progress` received | — | — | — | navigates to the new experiment (see §0); fallback toast |
| leave dialog | ← or Cancel with a dirty form | Dialog | — | — | — |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "2 so far" (step 2 subtitle) | count of condition cards | the cards | Panel subtitle |
| "{n} characters" | `system_prompt.length` | under the field | text |
| "{n} of 200" | `name.length` | under the field | text |
| "k of n selected" | checked ÷ listed probes | the list | text |
| "{n} prompts found" (CSV) | rows with a non-empty `prompt_text`, parsed client-side the same way as db.py:3344-3347 | the textarea | text |
| "would be {p·c·m} cells" (step 3 Readout) | `probes × conditions × models` from wizard state, labelled "would be"; the server's `cells` on the Overview is the one that counts (app.py:2894) | p, c, m named in the sentence | Readout |
| No cost or server estimate on this screen | by design: `POST /estimate` needs a created experiment (app.py:2888-2890) | — | — |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `system_prompt_required` | "A system prompt cannot be empty: the API rejects it. For a 'no system prompt' baseline, use a one-line neutral prompt and say so in its description." | step 2 note | `ConditionCreate.system_prompt` `min_length=1` (models.py:215) |
| `estimate_after_create` | "The size and cost estimate comes from the server after Create, on the Overview, before Start." | step 4 Readout | `POST /api/experiments/{id}/estimate` reads a stored experiment (app.py:2884-2898) |
| `hh_not_probes` | "Prompts from HH-RLHF are not Flinch probes: they have no domain groups and no policy links." | step 3 HH option | prompts imported as `custom_prompt_text` rows (db.py:3320-3337; hh_import.py:288-300) |
| `batch_conditions_autostart` | "This path creates the experiment and starts it at once. Each cell is also saved as a run in the session, so the Framing study can score consistency." | §0 Review box | app.py:594-630 creates and marks running before streaming; runner.py:347-348 writes session runs |
| `draft_without_keys` | "You can draft an experiment without API keys. Start needs a key for every model you picked." | step 3 key row when any provider lacks a key | the runner builds a target per cell and fails without a key (runner.py:545, 590-612) |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| experiment | R2 heading | `experiments-list.md` §6 |
| condition | step 2 heading, Readout | label + system prompt (models.py:213-217) |
| system prompt | step 2 field label | the text the model receives before every probe in that condition (runner.py:541-545) |
| baseline | step 2 Readout | the condition the others are compared against; Flinch does not mark one specially (analysis compares every pair, stats.py:237-239) |
| cell | step 3 Readout | one probe × condition × model (db.py:3396-3411) |
| base model | step 3 | `BaseModelTarget` (runner.py:596-597) |
| provider | step 3 chip tag | inferred from the model id (runner.py:447-461) |
| probe | step 3 | a saved prompt with a name and domain (`flinch/probes/example-probes.md` format) |
| HH-RLHF | step 3 option | Anthropic's published helpfulness/harmlessness prompt set (hh_import.py; models.py:416-424) |
| random seed | step 1 | stored on the experiment (db.py:331); not used by the bootstrap (stats.py:71) |
| variant group (conditions type) | §0 badge | a Library group whose variants are system prompts, run via batch-conditions (app.py:572-700) |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `experiment-new.condition` | `[data-tip="condition-system-prompt"]` (first System prompt field) | "This is the whole experiment: the same probes, the same model, a different system prompt. Keep the baseline plain so the difference is the prompt." why: "Analysis compares every pair of conditions on the same probes." | first time step 2 is shown |
| `experiment-new.models` | `[data-tip="model-input"]` | "Type a model id as the provider names it. Flinch works out the provider from the id." | first time step 3 is shown |
| `experiment-new.review` | `[data-tip="create-button"]` | "Create saves the plan. Nothing runs until you press Start on the next screen, after you have seen the estimate." | first time step 4 is shown (not in §0 mode) |
| `experiment-new.autostart` | `[data-tip="create-button"]` | "This one starts straight away, because a variant-group run also writes session runs." | first time step 4 is shown in §0 mode |

## 8. Keyboard and focus
- Shortcuts: `Ctrl+Enter` = Next / Create (from any field); `Escape` in a field blurs it, `Escape` on the panel asks to leave (when dirty); `Alt+Left` = Back; `/` focuses the probe search in step 3.
- Focus order: header → "← Experiments" → stepper chips → the step's fields top to bottom (condition cards: Label, Description, System prompt, ↑, ↓, ✕; then "+ Add condition") → R4 Cancel, Back, Next. On a step change focus moves to the step's first field; on a validation failure focus moves to the first invalid field.
- Live regions: Readout; validation messages linked by `aria-describedby`; "{k} of {n} selected" is `aria-live="polite"`; the LoadingScreen stage line.

## 9. Dialogs and overlays opened from here
- Leave Dialog (plain): "Leave without creating?"; "Leave" danger / "Stay".
- LoadingScreen (HH-RLHF import) with Cancel.
- FirstTimeTips in §7; global Help and Shortcuts.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/sessions` | R1 SessionSwitcher; step 3 session name |
| GET | `/api/settings/keys` | R1 chip; step 3 key readiness |
| GET | `/api/probes?session_id={s}` | step 3 "From this session" |
| GET | `/api/probes` | step 3 "Pick from all probes" |
| GET | `/api/variants/files/{gid}` | §0 prefill |
| POST | `/api/experiments` | R4 Create |
| POST | `/api/experiments/{id}/prompts` | after Create (session / all-probes source) |
| POST | `/api/experiments/{id}/prompts/import` | after Create (CSV source) |
| POST | `/api/experiments/{id}/prompts/import-hh` | after Create (HH source), SSE |
| POST | `/api/sessions/{sid}/batch-conditions` | §0 "Create and run", SSE held in the run store |
| GET | `/api/experiments` | §0 to find the auto-created experiment |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. On `#/experiments/new`, the Name input has focus and the Next button is `aria-disabled="true"` with an `aria-describedby` element reading "Give the experiment a name".
2. Entering a name and pressing `Ctrl+Enter` shows step 2 with exactly one condition card; its Label input has focus; the stepper chip ① contains "✓".
3. Leaving the System prompt empty and pressing Next keeps step 2 shown, sets `aria-invalid="true"` on that textarea, and moves focus to it.
4. Two conditions with the same label show the message "Labels must be different" and Next stays disabled.
5. With session `crime-set-1` open, step 3 lists its probes grouped by domain headings in alphabetical order (CRIME, MEDICAL, ROMANCE) with every checkbox checked and the text "4 of 4 selected".
6. Adding model id `gpt-4o-mini` renders a chip containing "gpt-4o-mini" and a tag "openai"; adding it again shows "already added" and does not add a second chip.
7. Step 4 contains no element whose text matches `/\$|cells|estimate/i` except the Readout sentence naming where the estimate appears.
8. Clicking Create sends exactly one `POST /api/experiments` whose body has `conditions[0].label`, non-empty `conditions[0].system_prompt`, `conditions[0].sort_order === 0`, `model_ids` as an array, and no `repetitions`, `probe_set_ids` or `models` keys; then one `POST /api/experiments/{id}/prompts` with a body array of `{probe_id}` objects of length 4; then `location.hash === '#/experiments/{id}'`.
9. Mocking `POST /api/experiments` to return 422 with `detail[0].loc = ["body","conditions",0,"system_prompt"]` shows step 2 with that field invalid and an error toast.
10. Mocking the prompts call to fail still navigates to `#/experiments/{id}` and shows an error toast with an action named "Add prompts".
11. Opening `#/experiments/new?variants=tone-conditions&session=4` renders the tag "from variant group" and a read-only step 2 whose cards carry the group's labels; the primary at step 4 reads "Create and run"; clicking it sends one `POST /api/sessions/4/batch-conditions` whose body has `probe_ids` (array), `conditions[].label`, `conditions[].system_prompt`, `concurrency: 5`.
12. Reloading mid-wizard restores the typed values from localStorage; Cancel then "Leave" clears them.
13. At 1024×700, the condition card's Label and Description inputs are stacked (Description's top is below Label's bottom) and no horizontal scroll exists.

## 12. Open questions for Brad
1. The API has no "no system prompt" condition (`min_length=1`, models.py:215). The spec tells the researcher to use a one-line neutral prompt. Do you want a backend change to allow an empty system prompt as a true no-prompt baseline instead?
2. The variant-group path (§0) only learns the experiment id at the end of the run (app.py:671-679), so the UI finds the new experiment by its name prefix. Acceptable, or should the plan add `experiment_id` to the first batch-conditions event?
3. Baseline wizard had "Repetitions per condition" with no API home (the response matrix is unique per condition × prompt × model, db.py:376). It is dropped here. Confirm, or should repetitions become a backend feature in this plan?
