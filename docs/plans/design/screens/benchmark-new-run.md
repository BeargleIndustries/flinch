# New benchmark run

- Route(s): `#/benchmarks/new`, `#/benchmarks/new?suite=:suite_key` (suite preselected)
- Section: Benchmarks
- Purpose (one sentence, what the researcher does here): Pick a suite, define one or more conditions (model, system prompt, sampling and reasoning settings, judge), choose all samples or a seeded subset, read the cost and time band and whether each condition is standard, pass the prerequisite check, and start the run.
- Arrives from: catalog "New run" (title row or a suite card), Suite screen "New run", Run › Results "Run again with changes" (prefills from that run's conditions). Leaves to: `#/benchmarks/runs/:id` (Progress tab) on Start; `#/benchmarks` on Cancel; `#/benchmarks/suites/:suite` via the suite's "About" link; `#/settings#benchmarks` or `#/settings#keys` via a failing check. Back: "Cancel" or browser back; an unsaved form asks via Dialog before leaving when a condition has been edited.
- Components used (names from `../03-components.md`): Header (§1), Panel (§2.3), InsetBox (§2.4), Readout (§3), Term (§4), Caveat (§5), Stat (§7, estimate), Card (§14, suite picker), Button (§15), Input / Textarea / Select / Checkbox / Segmented (§16), Chip (§17: `standard` / `modified`, model chips), List/Row (§13, conditions), Dialog (§18), Toast (§21), FirstTimeTip (§22), LoadingScreen step list (§24, inline for the prerequisite check).
- Baseline surfaces replaced (from `../00-content-inventory.md`): none; new. Its shape follows the New experiment wizard's "create, then estimate, then start" order (consensus record iteration 2: estimate shown after Create).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ No session ▾ ]  ● 2 keys set     Probe Studies Experiments Benchmarks …  ? ⚙│ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ New benchmark run                                               [Cancel] [Create run] │ R1
│ ▣ One standard condition and two modified ones on XSTest. Each runs all 450 prompts, │ R1 Readout
│   so the three can be compared sample by sample. Estimate: about $5 to $9, 15 to 25 min.│
├────────────────────────────────────────┬─────────────────────────────────────────────┤
│ 1  SUITE                               │ 3  SAMPLES                                  │ R2 | R4
│ ( ) GPQA Diamond  198 questions · Medium│ (•) Run all 450 prompts (standard)          │
│ (•) XSTest        450 prompts · Light   │ ( ) Run a subset of [ 50 ] of 450 (modified)│
│ ( ) SWE-bench Verified 500 · Heavy      │     the same seeded 50 every time ⓘ         │
│     ⚠ Docker Desktop not running        │     [advanced ▾] seed 20261016, epochs 1    │
│ About XSTest ↗                         │                                             │
│                                        │ 4  ESTIMATE  ⓘ                              │ R5
│ 2  CONDITIONS  3                       │ ┌ COST ─────────┐ ┌ TIME ──────────────┐    │
│ ┌ A  claude-sonnet-4-6     [standard] ┐│ │ about $5 to $9 │ │ about 15 to 25 min │    │
│ │ no system prompt · defaults · judge  ││ │ 1 350 target   │ │ 1 350 samples at   │    │
│ │ gpt-4o                               ││ │ calls, 1 350   │ │ 3 s + 3 s, 4       │    │
│ └──────────────────────────────────────┘│ │ judge calls;   │ │ connections;       │    │
│ ┌ B  claude-sonnet-4-6     [modified] ┐│ │ prices as of   │ │ serial conditions  │    │
│ │ system prompt set · judge gpt-4o     ││ │ 2026-10-16     │ │                    │    │
│ └──────────────────────────────────────┘│ └────────────────┘ └────────────────────┘    │
│ ┌ C  claude-sonnet-4-6     [modified] ┐│ per condition: A $1.60 to $3 · B … · C …     │
│ │ system prompt set · judge gpt-4o     ││                                             │
│ └──────────────────────────────────────┘│ 5  BEFORE IT STARTS                         │ R6
│ [+ Add condition] [Duplicate A]        │ ✓ Runner installed (inspect-ai x.y.z)       │
│                                        │ ✓ Anthropic key set                         │
│ ── editing B ───────────────────────── │ ✓ OpenAI key set (judge gpt-4o)             │
│ Label      [B            ]             │ ✓ Dataset cached (XSTest, CC-BY-4.0)        │
│ Model      [claude-sonnet-4-6 ▾]       │ ○ Checked 2 min ago · [Check again]         │
│ System prompt                          │                                             │
│ [You are a careful assistant. Refuse  ]│                                             │
│ [anything that could cause harm.      ]│                                             │
│ Temperature [    ] Max tokens [     ]  │                                             │
│ Reasoning  [none ▾]  Thinking budget [ ]│                                             │
│ Judge      [gpt-4o (published) ▾]      │                                             │
│ Connections [4] (anthropic)            │                                             │
│ ⓘ modified: system prompt set          │                                             │
│ [Done] [Remove B]                      │                                             │
└────────────────────────────────────────┴─────────────────────────────────────────────┘
```
Left column 55 %, right 45 % (a plain two-column grid, not a Split: nothing here needs resizing). The page scrolls as one; the right column is `sticky top-0` so the estimate and the checks stay in view while conditions are edited.

### 1024×700 differences
The two columns stack: suite, conditions and the editor first, then samples, estimate and checks below; the right column loses `sticky`. The estimate's two Stat boxes stay side by side (each ≥ 220 px). The Create run button stays in R1 (the page header is sticky at 1024 so it is always reachable). Nothing is hidden.

## 2. Regions

### R0 Header
Shared. Benchmarks nav current.

### R1 Title row and Readout
- Components: h1, Button secondary md "Cancel", Button primary md "Create run" (becomes "Start run" after creation, §3), Readout.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| h1 | static | | "New benchmark run" | |
| Readout | client state + `POST /api/benchmarks/estimate` | suite, conditions' `is_standard`, subset, `estimate.cost`, `estimate.wall_clock_s` | sentence shapes in §3; the estimate clause only once an estimate exists | Readout |
| Create run / Start run | | | primary; disabled with reason while invalid: "Pick a suite.", "Add at least one condition.", "Condition B needs a model.", "The benchmark runner is not installed yet.", "A prerequisite failed; see Before it starts." | Button |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Cancel | none (Dialog "Leave without creating this run?" if edited) | navigate `#/benchmarks` |
| Create run | `POST /api/benchmarks/runs {name, suite_key, conditions, subset, epochs, connections}` | on 200: the form locks (fields read-only, "Edit" link unlocks by deleting the draft run: `DELETE /api/benchmarks/runs/{id}`), R6 shows the server's `prereqs`, the button becomes "Start run"; Toast success "Run created: {name}. Check the estimate, then start." |
| Start run | `POST /api/benchmarks/runs/{id}/start` | on 200 navigate `#/benchmarks/runs/{id}`; on 409 the Readout turns warn with `reason` and R6 shows the failing `checks`; Toast error with the reason |

### R2 Suite picker
- Components: eyebrow "1 SUITE", radio list (native radios styled as List rows), Chip tag (tier), the amber prerequisite line, text link "About {suite} ↗".
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| rows | `GET /api/benchmarks/suites` | `suites[]` where `status == 'available'` | "{name}  {sample_count} {noun} · {Tier}"; preselected from `?suite=`; a suite with `prereqs.ok == false` is selectable (so the user can see what it would cost) but Create is disabled with the reason naming the check | List/Row + radio |
| prerequisite line | same | `prereqs.checks[]` failing | one amber line per failing check, under the row | text |
| About link | | | `#/benchmarks/suites/{suite_key}` | Button text |

- Actions:

| Control | Calls | Then |
|---|---|---|
| pick a suite | `POST /api/benchmarks/estimate` (debounced 400 ms, with the current conditions) | R4 relabels its counts and noun; R5 re-estimates; each condition's judge control shows or hides (judged suites only); every condition's standard flag recomputes client-side from the suite `recipe` (the server is authoritative at Create) |

### R3 Conditions list and editor
- Components: eyebrow "2 CONDITIONS" with count tag, List/Row of condition cards, Chip `standard` / `modified` per card, Button secondary sm "+ Add condition", Button secondary sm "Duplicate {label}", the editor (Input, Select, Textarea, Input number ×2, Select ×2, Input number, Caveat inline, Button primary sm "Done", Button danger sm "Remove {label}").
- Content and bindings (editor fields):

| Element | Source route | JSON field (request) | Formatting rule | Component |
|---|---|---|---|---|
| condition card summary | client | `label`, `model_id`, `is_standard`, `standard_differences` | "no system prompt · defaults · judge gpt-4o" when standard; else the differences joined by " · " (benchmarks.md §4.2 texts) plus "judge {id}"; the chip right-aligned | List row + Chip |
| Label | | `label` | default A, B, C…; unique per run (error "Label B is already used.") | Input |
| Model | `GET /api/models` (existing route, grouped by provider; Ollama models included when detected) | `model_id` | Select grouped by provider; a model whose provider has no key is listed disabled with "(no key)"; Ollama rows show "(local)" | Select |
| System prompt | | `system_prompt` (null when empty) | Textarea rows 3, auto-grow; counter "38 tokens (estimated)" under it; hint "Leave empty for the published recipe." | Textarea |
| Temperature | | `generate_config.temperature` | number 0 to 2 step 0.1, empty = provider default; hint "empty = default" | Input number |
| Max tokens | | `generate_config.max_tokens` | integer ≥ 1, empty = default | Input number |
| Reasoning | | `generate_config.reasoning_effort` | Select none / low / medium / high; shown for every model, with hint "Only some models honour it; it is recorded either way." | Select |
| Thinking budget | | `generate_config.reasoning_tokens` | integer tokens, empty = none; shown for every model with the same hint | Input number |
| Advanced (disclosure) | | `generate_config.top_p`, `generate_config.seed` | two Input numbers under a `<details>` "Advanced: top_p, seed" | Input number |
| Judge (judged suites only) | `GET /api/models` | `judge_model` | Select; first option "{recipe judge} (published)"; others listed by provider; an Ollama judge allowed with "(local; modified)"; disabled options for providers without a key | Select |
| Connections | | `connections[provider]` | number, default and range from benchmarks.md §2.4 by the model's provider; label "Connections [4] (anthropic)"; Ollama shows "(local; 1 to 4)" | Input number |
| Context (Ollama only) | `GET /api/ollama/status` (existing) and the model's reported context (unverified field; T-check in L0) | | read-only line "context 8 192 reported by Ollama" with "GPQA's longest prompt fits." or amber "XSTest fits; SWE-bench does not." | text |
| standard line | client recompute from suite `recipe` | | Caveat inline: "standard" or "modified: system prompt set, temperature 0 set" | Caveat |

- Actions:

| Control | Calls | Then |
|---|---|---|
| + Add condition | none | appends a condition with the next label, same model as the last, empty prompt, defaults; opens the editor on it; re-estimate |
| Duplicate {label} | none | copies the selected condition with the next label; editor opens; re-estimate |
| card click | none | editor shows that condition; `aria-expanded` on the card |
| Done | none | closes the editor (validation errors keep it open and focus the first invalid field) |
| Remove {label} | Dialog "Remove condition B?" only if it has a non-empty prompt or changed settings | removes; labels of later conditions are not renumbered; re-estimate |
| any field change | `POST /api/benchmarks/estimate` debounced 400 ms | R5 updates; standard chip updates immediately client-side |

### R4 Samples
- Components: eyebrow "3 SAMPLES", Segmented-style radio pair (native radios), Input number (k), Term "seeded", Caveat `bench_subset_paired`, `<details>` "advanced" with seed Input and epochs Input.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Run all | | `subset.mode = 'full'` | "Run all {N} {noun} (standard)"; default for Light and Medium | radio |
| Run a subset | | `subset.mode = 'subset'`, `subset.size` | "Run a subset of [k] of N (modified)"; k integer 1 to N−1, default 50 (or N/2 when N < 100); default selection for Heavy only when the user switches it on (benchmarks.md §5.4); XSTest shows "k = 28 safe + 22 unsafe" under it from the proportional rule | radio + Input |
| seeded line | suite | `subset_seed` | "the same seeded {k} every time" with Term and Caveat `bench_subset_paired` | text + Caveat |
| advanced | | `subset.seed`, `epochs` | seed Input prefilled with the suite seed; changing it shows amber "A custom seed will not pair with runs on the default seed."; epochs Input prefilled from the recipe; changing it is a difference "epochs k instead of r" | Input number ×2 |

- Actions: any change → re-estimate; every condition's flag recomputes (a subset makes all conditions modified with "subset of k of N").

### R5 Estimate
- Components: eyebrow "4 ESTIMATE" with Info (Caveat `bench_estimate`), Stat ×2 (cost, time), per-condition line, InsetBox row for the image pull (SWE-bench only).
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| COST | `POST /api/benchmarks/estimate` | `cost.low`, `cost.high`, `cost.unknown_models[]`, `cost.prices_as_of` | value "about $5 to $9" (tokens §6; "n/a" when every model is unpriced); `madeOf` "1 350 target calls, 1 350 judge calls; {assumption or measured}; prices as of 2026-10-16"; when `unknown_models` is non-empty, append "plus n/a for {model}: no price in this build's table" | Stat |
| TIME | same | `wall_clock_s.low/high` or null | "about 15 to 25 min"; null → "no estimate until Flinch has timed ten samples on this machine" (Ollama) with `madeOf` naming the condition; `madeOf` otherwise "1 350 samples at 3 s + 3 s, 4 connections; serial conditions" | Stat |
| per condition | same | `per_condition[]` | "A $1.60 to $3 · B … · C …" with each condition's tokens in a hover | text |
| image pull (SWE-bench, first run) | same | `image_pull_gb` | InsetBox row: "First run also pulls about {n} GB of images; depends on your download speed, not estimated." | InsetBox |
| measured basis | same | `inputs.measured` | when present, the Stat `madeOf` says "measured from your last run on 2026-10-14" instead of the assumption | Stat |

### R6 Before it starts
- Components: eyebrow "5 BEFORE IT STARTS", step list (LoadingScreen §24 step rows reused inline: Check / amber / hollow), text "Checked {ago}", Button secondary sm "Check again", links on failing rows.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| rows | `GET /api/benchmarks/prereqs?suite=` on load and on suite change; after Create, the `prereqs` in the Create response | `checks[]` filtered to the suite and the providers the conditions use | ok: Check icon + "{name} ({detail})"; failing: amber triangle + `fix` text as a link to `link`; pending: hollow circle + "checking…" | step list |
| checked ago | client | | "Checked 2 min ago" | text |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Check again | `POST /api/benchmarks/prereqs/check {suite}` | rows refresh; button loading "Checking…" |
| failing row link | | navigate `#/settings#keys` / `#/settings#benchmarks` or open the external guide |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|
| loading | first paint | buttons disabled | skeleton rows | one empty condition card skeleton | hidden until a suite is picked | hidden | skeleton | (none) |
| empty (no suite) | arrived without `?suite=` | Create disabled "Pick a suite." | radios unselected | one condition A prefilled with the first keyed model, editor open | disabled with hint "Pick a suite first." | hidden | runner and key rows only | "Pick a suite on the left. One condition is set up already; add more to compare." |
| suite picked, standard | suite set, A standard, run all | Create enabled | | A chip standard | Run all selected | both Stats | suite's checks | "One standard condition on all 450 prompts. Estimate: about $2 to $3, 5 to 9 min." |
| modified | any condition modified or a subset | | | chips | | | | "One standard condition and two modified ones on XSTest. Each runs all 450 prompts, so the three can be compared sample by sample. Estimate: …" / "Every condition is modified (subset of 50 of 500): none is the published number, but they pair with each other." |
| no key for a provider | a condition's model provider has no key | Create disabled "Condition B's model needs an Anthropic key." | | the Model select marks it "(no key)"; the editor shows a link to `#/settings#keys` | | | key row failing | "Condition B's model needs an Anthropic key. Add it in Settings or pick another model." |
| judge needs key | XSTest with judge gpt-4o and no OpenAI key | Create disabled | | Judge select shows "(no key)" on the published judge; hint "Pick another judge (modified) or add an OpenAI key." | | | judge row failing | "XSTest's published judge is gpt-4o, and there is no OpenAI key. Add one, or pick another judge: that makes the run modified." |
| Docker absent (SWE-bench) | SWE-bench picked, Docker check fails | Create disabled "Docker Desktop is not running." | amber line under the row | | | estimate still shown | Docker row failing with the guide link | "SWE-bench Verified can't start until Docker Desktop with WSL 2 is running. The estimate below is what it would cost." |
| gated dataset (GPQA) without token | | Create disabled | amber line | | | | HF row failing → `#/settings#keys` | "GPQA Diamond is gated. Add your Hugging Face token in Settings and accept the dataset terms on huggingface.co." |
| Ollama condition | a condition on `ollama:` | | | Connections "1 (local)"; context line | | TIME "no estimate until…" for that condition; COST "$0 (local)" with `bench_local_cost` | Ollama row "model llama3.1:8b found" | "…The local model's time is unknown until it has answered ten." (clause appended) |
| estimating | request in flight | | | | | Stats `animate-pulse` | | (unchanged) |
| estimate error | 5xx | | | | | Stat values "n/a", `madeOf` the error; Create still enabled (an estimate is advisory) | | Readout warn: "Flinch couldn't estimate this run: {error}. You can still create it." |
| created | 200 from Create | button "Start run"; "Edit" text link | locked | locked (read-only summary) | locked | server estimate (same shape) | server `prereqs` | "Run {name} is ready: {k} conditions, {N} samples, about $5 to $9. Start it when you're ready." |
| start refused | 409 | | | | | | failing checks highlighted | Readout warn: "{reason}" e.g. "One run at a time; xstest-prompts-1 is still running." |
| another run running | on load, `GET …/runs?status=running` non-empty | Create enabled, Start disabled "One run at a time; a run is in progress." | | | | | | "…A run is in progress; you can create this one and start it when that finishes." |
| runner not installed | | Create disabled | | | | | runner row failing → `#/settings#benchmarks` | "The benchmark runner is not installed yet. Install it from Settings; you can set the run up now." |
| prefilled (Run again) | arrived with `?from=:run_id` | | locked to that suite | conditions copied with editor closed | copied | | | "Set up from run {name}. Change what you like; nothing runs until you start it." |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "450 prompts" / "198 questions" / "500 instances" | suite `sample_count` | noun; XSTest "250 safe + 200 unsafe" in R4 hover | text |
| k of N | user input, N = `sample_count` | "the same seeded k every time", seed in advanced; XSTest split "28 safe + 22 unsafe" | Input + text |
| "38 tokens (estimated)" | client token estimate (chars ÷ 4) | "(estimated)" always; the real count comes from the run | text |
| COST "about $5 to $9" | `estimate.cost.low/high` (benchmarks.md §5.2) | `madeOf`: calls, tokens-per-sample assumption or measured basis, prices as-of; Caveat `bench_estimate` | Stat |
| TIME "about 15 to 25 min" | `estimate.wall_clock_s` (§5.3) | `madeOf`: samples, latency assumption, connections, serial | Stat |
| per condition "A $1.60 to $3" | `per_condition[].cost` | hover: tokens in/out/judge | text |
| image pull "about 100 GB" | `image_pull_gb` | "depends on your download speed, not estimated" | InsetBox |
| Connections "4" | default by provider | provider name beside it | Input |
| context "8 192" | Ollama reported (unverified) | "reported by Ollama"; which suites fit | text |
| conditions count "3" | list length | | Chip count |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `bench_estimate` | "An estimate from assumed tokens per sample and this build's price table. The run shows the real usage." | R5 eyebrow Info and each Stat | `lib/copy/caveats.ts`; `estimate.inputs` |
| `bench_subset_paired` | "A subset is the same seeded samples every time, so conditions pair up. It is still not the published number." | R4 subset option | `lib/copy/caveats.ts` |
| `modified_bench` | "Not a standard run: a score here is not comparable to the published one." | hover on every `modified` chip; inline under the editor's standard line | `lib/copy/caveats.ts` |
| `bench_judge_swap` | "The judge is part of the benchmark. A different judge is a different benchmark." | R3 Judge select hint | `lib/copy/caveats.ts` |
| `bench_local_cost` | "$0 means no API bill. Your machine's time and power are not counted." | R5 per-condition line for Ollama | `lib/copy/caveats.ts` |
| `swebench_contested` | "SWE-bench Verified is disputed as a headline number (contamination, flawed tests). Use it to compare conditions, not to claim a rank." | R2 under the SWE-bench row when selected (note variant) | `lib/copy/caveats.ts` |
| `bench_not_leaderboard` | "A local run is not a leaderboard entry. Same suite, different scaffold and limits." | R2 same place | `lib/copy/caveats.ts` |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| condition | R3 eyebrow | `lib/glossary` `condition` |
| standard / modified | chips, R4 labels | `standard`, `modified` |
| judge | R3 Judge label | `judge` |
| system prompt | R3 label | `system_prompt`: "Text the model receives before the conversation. The published recipes have none." |
| reasoning effort / thinking budget | R3 labels | `reasoning_effort`: "How much the model may reason before answering, where the provider exposes it (low, medium, high)." `reasoning_tokens`: "A token budget for the model's thinking, where the provider exposes it." |
| seeded subset | R4 | `seeded_subset`: "A fixed random pick of k samples from a seed, so every run with the same k gets the same samples." |
| epochs | R4 advanced | `epochs`: "How many times each sample is run; the score averages them." |
| connections | R3 | `connections`: "How many requests go to a provider at once. Lower it if you hit rate limits; keep local models at 1." |
| sandbox | R2 SWE-bench | `sandbox` |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `bench.new.standard` | the first condition card's chip | "Leave the system prompt empty and the settings at their defaults and this condition is standard: it matches the published recipe. Change anything and the chip says what changed." | first visit to this screen |
| `bench.new.subset` | R4 "Run a subset" radio | "A subset is the same seeded samples every time, so two conditions, or two runs weeks apart, line up sample by sample. It is never the published number." | first time a Heavy suite is picked, or the first time the radio is enabled |
| `bench.new.estimate` | R5 COST Stat | "This is a band, not a bill: assumed tokens per sample times this build's prices. After the first run on this machine, Flinch uses what it measured." | first time an estimate renders |

## 8. Keyboard and focus
- Shortcuts: `Ctrl+Enter` = Create run (or Start run after creation) when valid; `Escape` closes the condition editor (not the page).
- Focus order: header → Cancel → Create run → suite radios (arrow keys) → About link → condition cards (listbox, Up/Down; Enter opens the editor) → editor fields top to bottom → Done → Remove → + Add condition → Duplicate → samples radios → k Input → advanced disclosure → estimate (Stats are not focusable; their Info icons are) → Check again → failing-row links.
- Live regions: Readout (`role="status"`); R5 Stat values announce on change through the Readout, not their own region; R6 rows announce a check result via one polite region "Prerequisites: all passed" / "Prerequisites: 1 failed, Docker Desktop not running".

## 9. Dialogs and overlays opened from here
- Leave without creating (Dialog: "Leave without creating this run? Your conditions will be lost." primary "Leave", cancel "Stay").
- Remove condition (Dialog, only when it has content).
- Edit after Create (Dialog: "Editing deletes the draft run {name} and its estimate. The run has not started." primary "Edit", then `DELETE /api/benchmarks/runs/{id}`).
- Term tooltips; FirstTimeTips (§7); Toasts.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/benchmarks/suites` | R2 on load |
| GET | `/api/benchmarks/prereqs?suite=` | R6 on load and suite change |
| POST | `/api/benchmarks/prereqs/check` | R6 Check again |
| GET | `/api/models` | R3 Model and Judge selects (existing route) |
| GET | `/api/ollama/status` | R3 context line for Ollama models (existing route) |
| POST | `/api/benchmarks/estimate` | R5 on every suite / condition / subset change (debounced) |
| GET | `/api/benchmarks/runs?status=running` | R1 on load (one-run-at-a-time) |
| GET | `/api/benchmarks/runs/{id}` | prefill when `?from=` |
| POST | `/api/benchmarks/runs` | R1 Create run |
| DELETE | `/api/benchmarks/runs/{id}` | Edit after Create |
| POST | `/api/benchmarks/runs/{id}/start` | R1 Start run |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. Arriving at `#/benchmarks/new?suite=xstest` selects the XSTest radio (`checked`), shows the Judge select in the editor with first option text "gpt-4o (published)", and R4 reads "Run all 450 prompts (standard)".
2. With condition A at defaults, its chip text is "standard"; typing one character into the system prompt changes the chip to "modified" within one render and the editor's standard line reads "modified: system prompt set"; clearing the prompt restores "standard".
3. Setting temperature to 0 adds "temperature 0 set" to the differences; the request body sent to `/api/benchmarks/estimate` contains `"temperature": 0` and `"system_prompt": null` when the prompt is empty.
4. Selecting "Run a subset" with k = 50 on XSTest shows "28 safe + 22 unsafe" and marks every condition modified with "subset of 50 of 450"; selecting "Run all" removes that difference from every condition.
5. The estimate request is sent at most once per 400 ms of continuous edits (debounce test with fake timers); the COST Stat shows `animate-pulse` while pending.
6. With the estimate stub returning `unknown_models: ["grok-4"]`, the COST `madeOf` contains "plus n/a for grok-4: no price in this build's table" and the value is still the band for the priced conditions.
7. With no Anthropic key in the fixture and a Claude model selected, Create run is `aria-disabled` with the reason text "Condition A's model needs an Anthropic key." and the reason contains a link to `#/settings#keys`.
8. After a 200 from `POST /api/benchmarks/runs`, every field in R2, R3 and R4 is read-only (`readonly` or `aria-disabled`), the primary button text is "Start run", and an "Edit" text button is present.
9. A 409 from Start with `{reason: "One run at a time; xstest-prompts-1 is still running.", checks: [...]}` renders the reason in the Readout with the warn classes `border-amber-800/60` and keeps the user on the page.
10. Choosing an Ollama model sets the Connections input to 1 with max 4, shows "(local)" beside it, and the TIME Stat value equals "no estimate until Flinch has timed ten samples on this machine".
11. `Ctrl+Enter` with a valid form triggers the same request as clicking Create run; with an invalid form it does nothing and focus moves to the first invalid field.
12. At 1024×700 the right column renders below the left, no element is hidden, and no horizontal scrollbar appears.
13. Copy-lint: every disabled reason ends with "."; no visible string contains an em dash; every `%` is inside a Rate.

## 12. Open questions for Brad
1. Should a run with a failing prerequisite be creatable (saved as `ready`, startable later from the catalog once Docker is up), or only creatable when everything passes? The draft allows Create and blocks Start.
2. Run name: auto "{suite}-{date}-{n}" with a rename field, or a required Name input at the top? The draft auto-names and offers Rename on the run page.
3. Reasoning effort and thinking budget are shown for every model with a hint; alternative is to show each only for providers known to honour it (needs a per-model capability table that drifts). Which?
