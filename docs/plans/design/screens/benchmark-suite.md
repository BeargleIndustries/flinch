# Suite

- Route(s): `#/benchmarks/suites/:suite` (`:suite` = `suite_key`: `xstest`, `gpqa_diamond`; any other key renders the "unknown suite key" state)
- Section: Benchmarks
- Purpose (one sentence, what the researcher does here): Read what the suite measures and how big it is, what its published recipe is and therefore what "standard" means here, what a run would cost on this machine, what it needs (the runner, a token, a judge key) and whether those are met, and the licence, then start a run or fix a prerequisite.
- Arrives from: catalog card title or "About"; New run "About {suite} ↗"; Run title-row suite link; Settings › Benchmarks "what GPQA needs" link. Leaves to: `#/benchmarks/new?suite=:suite` (New run), `#/benchmarks` (breadcrumb), `#/benchmarks/runs/:id` (past runs of this suite), `#/settings#keys` / `#/settings#benchmarks` or the external dataset terms page (prerequisite fixes). Back: breadcrumb or browser back.
- Components used (names from `../03-components.md`): Header (§1), Panel (§2.3), InsetBox (§2.4), Section (§2.5), Readout (§3), Term (§4), Caveat (§5), Stat (§7, estimate), Table (§12, recipe and past runs), Chip (§17: tier, `standard`, `modified`), Button (§15), Select (§16, estimate model), LoadingScreen step list (§24, prerequisites), FirstTimeTip (§22), Toast (§21), EmptyState (§2.6).
- Baseline surfaces replaced (from `../00-content-inventory.md`): none; new.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ No session ▾ ]  ● 2 keys set     Probe Studies Experiments Benchmarks …  ? ⚙│ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Benchmarks › GPQA Diamond                       [MEDIUM]           [ New run ]       │ R1
│ ▣ 198 graduate-level science questions with four choices. Standard here means the    │ R1 Readout
│   inspect_evals recipe, not a lab's model card. Your Hugging Face token is set and   │
│   the terms are accepted, so a run can start.                                        │
├────────────────────────────────────────────┬─────────────────────────────────────────┤
│ WHAT IT MEASURES                           │ WHAT A RUN NEEDS                        │ R2 | R5
│ Each question is written by a domain       │ ✓ Runner installed (inspect-ai x.y.z)   │
│ expert in biology, chemistry or physics    │ ✓ Hugging Face token (GPQA terms         │
│ and has four choices; experts outside the  │   accepted)                             │
│ field score near chance with the web open. │ ✓ Anthropic key set                     │
│ The model answers with one letter.         │ ○ Checked 1 min ago · [Check again]     │
│ Score: accuracy, r of 198.                 │                                         │
│ ⓘ Model cards use each lab's own prompt…   │ ESTIMATE  for [claude-sonnet-4-6 ▾]     │ R6
│ ⓘ Dataset items stay on this machine…      │ ┌ COST, ALL 198 ──┐ ┌ TIME ────────────┐│
│                                            │ │ about $1.30 to  │ │ about 6 to       ││
│ THE PUBLISHED RECIPE (what standard means) │ │ $4.70           │ │ 21 min           ││
│ Field          Standard value              │ │ 350 input +     │ │ 8 to 25 s per    ││
│ Solver         multiple_choice             │ │ 400 to 1 500    │ │ question, 4      ││
│ Judge          none (choice scorer)        │ │ output tokens   │ │ connections      ││
│ Sampling       provider defaults           │ │ per question;   │ │                  ││
│ System prompt  none                        │ │ prices as of    │ │                  ││
│ Samples        all 198 · 1 epoch           │ │ 2026-10-16      │ │                  ││
│ Dataset        Idavidrein/gpqa (diamond)   │ └─────────────────┘ └──────────────────┘│
│                @ <sha>                     │ ⓘ An estimate from assumed tokens…      │
│ Harness pins   inspect-ai x · inspect-evals y│                                       │
│ Anything else makes a run modified; the    │ DATASET AND LICENCE                     │ R7
│ run says what changed.                     │ Idavidrein/gpqa · config gpqa_diamond   │
│                                            │ revision <sha> · 198 questions          │
│                                            │ CC-BY-4.0 with terms: gated; items must │
│                                            │ not be published; canary string present │
│                                            │ Gated: needs your Hugging Face token ↗  │
│                                            │ Kept on this machine under HF_HOME (41 MB)│
│                                            │                                         │
│                                            │ PAST RUNS OF THIS SUITE  2              │ R8
│                                            │ gpqa-haiku-vs-8b  2 · standard          │
│                                            │   41% (81 of 198) · 29% (58 of 198)  2026-10-15│
│                                            │ gpqa-sonnet-1  1 · standard             │
│                                            │   61% (121 of 198)  2026-10-15          │
└────────────────────────────────────────────┴─────────────────────────────────────────┘
```
Two columns 50/50 (plain grid). Left: R2 what it measures, R3 caveats, R4 recipe table. Right: R5 prerequisites, R6 estimate, R7 dataset and licence, R8 past runs.

### 1024×700 differences
The columns stack: R2, R3, R4, then R5, R6, R7, R8. The recipe table's "Standard value" column wraps long values (dataset id) onto two lines. The estimate Stats stay side by side. Nothing is hidden.

## 2. Regions

### R0 Header
Shared.

### R1 Title row and Readout
- Components: breadcrumb, h1 (suite name), Chip tag (tier), Button primary md "New run", Readout.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| name | `GET /api/benchmarks/suites/{suite_key}` | `name` | h1 | |
| tier | same | `tier` | Chip tag uppercase ("LIGHT" / "MEDIUM") | Chip |
| New run | same + `GET /api/benchmarks/prereqs?suite=` | `prereqs.ok`, `runner.installed` | enabled when ok; disabled with reason: the first failing check's `fix` | Button |
| Readout | same | `description_long` first sentence, recipe note, first failing check | §3 sentence shapes | Readout |

- Actions:

| Control | Calls | Then |
|---|---|---|
| New run | none | navigate `#/benchmarks/new?suite={suite_key}` |

### R2 What it measures
- Components: Section (eyebrow "WHAT IT MEASURES"), body text, "Score:" line with Term.
- Bindings: `description_long` (two to five sentences from `suites.yaml`, drafted in §3 below for the two suites), `recipe.metric` → "Score: accuracy, r of 198." / "Score: refusal rate on 200 unsafe prompts and over-refusal rate on 250 safe ones, each r of N; the judge grades each response full refusal, partial, or full compliance."

### R3 Caveats
- Components: Caveat `note` variant ×n.
- Bindings: `caveats[]` from the suite payload: XSTest `bench_judge_swap`; GPQA `bench_gpqa_recipe`, `bench_gated_text`.

### R4 The published recipe
- Components: Section (eyebrow "THE PUBLISHED RECIPE (what standard means)"), Table (two columns: Field, Standard value), closing sentence.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| rows | suite payload | `recipe.*` (benchmarks.md §1.6): `solver`, `judge`, `sampling`, `system_prompt`, `samples`, `epochs`, `dataset_id`, `dataset_revision`, `harness_pins` | one row per field present, in that order; `null` renders "none"; the judge row reads "openai/gpt-4o, three-way (full compliance, partial, full refusal)" for XSTest and "none (choice scorer)" for GPQA; dataset revision as a short sha with the full one in `title`; a field whose value is "unverified; T-check in L0" in the catalog file renders with an amber "(to be confirmed)" suffix so the state of the pin is visible in the app during L0 and absent after | Table text |
| closing line | static | | "Anything else makes a run modified; the run says what changed." (draft; brad-voice pass) | text |

### R5 What a run needs
- Components: Section (eyebrow "WHAT A RUN NEEDS"), step list rows (Check / amber ✗ / hollow), text "Checked {ago}", Button secondary sm "Check again".
- Bindings: `GET /api/benchmarks/prereqs?suite=` → `checks[]` for this suite (benchmarks.md §2.7: `runner`, then `hf_token` for GPQA or `judge_key` for XSTest) plus one row per keyed provider from `GET /api/settings/keys` ("Anthropic key set"); ok rows "✓ {name} ({detail})"; failing rows "✗ {fix}" with "→ {link label}" as a link (Settings, or "terms page" for external); pending "○ checking…".
- Actions:

| Control | Calls | Then |
|---|---|---|
| Check again | `POST /api/benchmarks/prereqs/check {suite}` | rows refresh; R1 New run enables when all pass; Toast success "Everything {suite} needs is in place." |
| row link | | navigate `#/settings#keys` / `#/settings#benchmarks`, or open the external terms page with the platform opener |

### R6 Estimate
- Components: Section (eyebrow "ESTIMATE"), Select (model, from `GET /api/models`, default the first keyed priced model; Ollama models included), Stat ×2, Caveat `bench_estimate`.
- Bindings: `POST /api/benchmarks/estimate {suite_key, conditions: [{label:'A', model_id, generate_config:{}}], subset:{mode:'full'}}` on load and on model change → COST "about $1.30 to $4.70" (GPQA on Sonnet, benchmarks.md §5.5 E3) / "about $1.10 to $3.20" (XSTest on Sonnet, E1), `madeOf` the per-sample bands (or "measured from your last run on {date}") and "prices as of {date}"; TIME "about 6 to 21 min" / "about 6 to 17 min", `madeOf` "8 to 25 s per question, 4 connections" / "3.5 to 9 s per prompt (target + judge), 4 connections" (or Ollama: "no estimate until Flinch has timed ten samples on this machine").
- Actions: model Select change → re-estimate.

### R7 Dataset and licence
- Components: Section (eyebrow "DATASET AND LICENCE"), mono text lines, Caveat `bench_gated_text` (GPQA).
- Bindings: `dataset_id`, `dataset_revision`, `sample_count` with noun, `licence` (suite file text: XSTest "prompts CC-BY-4.0"; GPQA "CC-BY-4.0 with terms: gated; items must not be published; canary string present"), `gated` → "Gated: needs your Hugging Face token and accepted terms on huggingface.co" with an external link, `cached` → "Kept on this machine under HF_HOME ({size})" or "Not downloaded yet; the first run fetches it." The HF_HOME path is `<bench_dir>/hf` (benchmarks.md §2.2), shown in full in Settings › Benchmarks.

### R8 Past runs of this suite
- Components: Section (eyebrow "PAST RUNS OF THIS SUITE" with count tag), Table (name, conditions with chips, result Rate, date), EmptyState.
- Bindings: `GET /api/benchmarks/runs?suite={suite_key}&limit=10` → same row rules as the catalog R4; row click → `#/benchmarks/runs/{id}`; EmptyState "No runs of this suite yet." with action "New run".

## 3. States
| State | Trigger | R1 | R2 to R4 | R5 | R6 | R7 | R8 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|
| loading | first paint | h1 skeleton, New run disabled | skeleton | skeleton | skeleton | skeleton | skeleton | (none) |
| ready (all checks pass) | `prereqs.ok` | New run enabled | data | all ✓ | Stats | data | data or empty | XSTest: "450 prompts, 250 that only sound unsafe and 200 that are. The judge is gpt-4o, part of the suite; your OpenAI key is set, so a standard run can start." |
| | | | | | | | | GPQA: "198 graduate-level science questions with four choices. Standard here means the inspect_evals recipe, not a lab's model card. Your Hugging Face token is set and the terms are accepted, so a run can start." |
| no HF token (GPQA) | `hf_token` fails | disabled "GPQA is gated. Add your Hugging Face token in Settings and accept the dataset terms on huggingface.co." | | ✗ token row → `#/settings#benchmarks` | Stats still shown | "Gated: …" line amber | | "…GPQA is gated. Add your Hugging Face token in Settings and accept the dataset terms on huggingface.co." (clause replaces the last) |
| no judge key (XSTest) | `judge_key` fails | disabled "XSTest's judge is gpt-4o, which needs an OpenAI key. Add one in Settings." | | ✗ "XSTest's judge is gpt-4o, which needs an OpenAI key. Add one in Settings." → `#/settings#keys` | Stats still shown (the estimate assumes the recipe judge) | | | "…The judge is gpt-4o and there is no OpenAI key, so a run can't start yet. The judge is part of the suite and can't be swapped." |
| runner not installed | `runner.installed == false` | disabled "The benchmark runner is not installed yet. Install it from Settings." | data | ✗ runner row → `#/settings#benchmarks` | Stats (estimates do not need the runner) | | | "…The benchmark runner is not installed yet; install it from Settings." |
| no priced model | no key for any priced model and no Ollama | | | | COST "n/a", `madeOf` "no model with a key and a price in this build's table" | | | |
| Ollama model picked (R6) | | | | | COST "$0 (local)" with `bench_local_cost`; TIME "no estimate until…" | | | |
| checking | Check again pending | | | rows ○, button "Checking…" | | | | |
| error | suite route fails (not 404) | | EmptyState with Retry | | | | | Readout warn: "Flinch couldn't load this suite: {error}. Retry." |
| unknown suite key | 404 | New run absent | EmptyState "There is no suite called {key}." with action "Back to Benchmarks" | hidden | hidden | hidden | hidden | "There is no suite called {key}." |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "450 prompts (250 safe + 200 unsafe)" / "198 questions" | `sample_count`, `recipe.groups` | the noun and the split | text |
| recipe values | `recipe.*` | the field name | Table |
| COST "about $1.30 to $4.70" | estimate band (benchmarks.md §5.2; arithmetic §5.5 E3, E1) | `madeOf`: tokens-per-sample bands or measured, prices as-of; the model in the Select; Caveat `bench_estimate` | Stat |
| TIME "about 6 to 21 min" | estimate (§5.3) | `madeOf`: per-sample latency band, connections | Stat |
| dataset cache "(41 MB)" | `cached.bytes` | | text |
| past runs results | `score_summary` | Rate with counts | Rate |
| past runs count | server total | | Chip count |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `bench_judge_swap` | "The judge is part of this suite's recipe. A suite graded by a different judge would be a different benchmark." | R3 on XSTest; R4 judge row Info | `lib/copy/caveats.ts` (registry benchmarks.md §11) |
| `bench_gpqa_recipe` | "Model cards use each lab's own prompt. Standard here means the inspect_evals recipe." | R3 on GPQA | same |
| `bench_gated_text` | "Dataset items stay on this machine. Do not publish them." | R3 and R7 on GPQA | same |
| `bench_estimate` | "An estimate from assumed tokens per sample and this build's price table. The run shows the real usage." | R6 | same |
| `bench_local_cost` | "$0 means no API bill. Your machine's time and power are not counted." | R6 when an Ollama model is picked | same |
| `modified_bench` | "Not a standard run: a score here is not comparable to the published one." | hover on `modified` chips in R8 | same |
| `rate_n` | "A rate from N runs is a rate from N runs." | R8 Rates | Rate default |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| suite, sample / prompt / question, judge, standard, modified, tier, condition | throughout | `lib/glossary` (as in `benchmarks-catalog.md` §6) |
| refusal rate / over-refusal rate / accuracy | R2 Score line | as in `benchmark-run.md` §6 |
| epoch | R4 | `epochs` |
| dataset revision | R4, R7 | `dataset_revision`: "The exact version of the dataset, as a commit on Hugging Face or a file hash. Two runs on different revisions are different benchmarks." |
| gated | R7 | `gated`: "The dataset's owner requires you to accept terms on huggingface.co and use a token before it downloads." |
| canary string | R7 (GPQA) | `canary`: "A marker inside the dataset that lets its authors detect if it leaked into training data. It is one reason not to publish the items." |
| HF_HOME | R7 | `hf_home`: "The folder on this machine where Hugging Face datasets are cached; Flinch keeps it under its own benchmarks folder." |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `bench.suite.recipe` | R4 table | "This table is the whole definition of standard for this suite. A run that matches every row is standard; change any row and the run is modified and says which." | first visit to any Suite screen |
| `bench.suite.prereqs` | R5 "Check again" | "Flinch checks these again right before a run starts, so a green tick here is a preview, not a promise." | first visit when any check has ever failed |

## 8. Keyboard and focus
- Shortcuts: `n` New run (when enabled and not in an input).
- Focus order: header → breadcrumb → New run → R2 Term links (in text order) → R4 table (not focusable; Terms inside it are) → R5 Check again and row links → R6 model Select, Stat Info icons → R7 links → R8 rows.
- Live regions: Readout; R5 result announcement "Prerequisites: all passed" / "Prerequisites: 1 failed, Hugging Face token not set" after Check again; Toasts.

## 9. Dialogs and overlays opened from here
None of its own. Term tooltips; FirstTimeTips; Toasts. External links (the dataset terms page) open with the platform opener, never inside the app.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/benchmarks/suites/{suite_key}` | R1 to R4, R7 on load (404 → unknown suite key) |
| GET | `/api/benchmarks/prereqs?suite=` | R1, R5 on load |
| POST | `/api/benchmarks/prereqs/check` | R5 Check again |
| GET | `/api/settings/keys` | R5 provider key rows (existing route) |
| GET | `/api/models` | R6 model Select (existing route) |
| POST | `/api/benchmarks/estimate` | R6 on load and model change |
| GET | `/api/benchmarks/runs?suite=&limit=10` | R8 |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. `#/benchmarks/suites/gpqa_diamond` renders h1 "GPQA Diamond", a tier chip "MEDIUM", and R4 rows for exactly the recipe fields present in the fixture, in the order: Solver, Judge, Sampling, System prompt, Samples, Dataset, Harness pins; the Judge row reads "none (choice scorer)".
2. `#/benchmarks/suites/xstest` renders a tier chip "LIGHT" and a Judge row containing "openai/gpt-4o" with an Info icon whose `aria-describedby` is the `bench_judge_swap` phrase; no control on the page changes the judge.
3. With the `hf_token` check failing in the GPQA fixture, New run is `aria-disabled` with `aria-describedby` to the reason "GPQA is gated. Add your Hugging Face token in Settings and accept the dataset terms on huggingface.co."; R5 shows that row with the amber class and an `<a href="#/settings#benchmarks">`; the estimate Stats are still rendered with values.
4. Clicking Check again sends `POST /api/benchmarks/prereqs/check` with `{"suite":"gpqa_diamond"}`; with a stub that passes everything, New run becomes enabled and a success Toast appears whose text ends with ".".
5. R3 on the XSTest fixture contains `bench_judge_swap` exactly once; on the GPQA fixture `bench_gpqa_recipe` and `bench_gated_text` once each; no fixture renders `bench_not_leaderboard`, `bench_resource_limits` or `swebench_contested`.
6. With the fixture `prices.yaml` and claude-sonnet-4-6 selected, the GPQA COST Stat reads "about $1.30 to $4.70" and TIME "about 6 to 21 min"; the XSTest COST Stat reads "about $1.10 to $3.20" and TIME "about 6 to 17 min" (benchmarks.md §5.5 E3, E1).
7. Changing the R6 model Select to an Ollama model sets the COST Stat value to "$0 (local)" with the `bench_local_cost` phrase beside it and the TIME Stat value to "no estimate until Flinch has timed ten samples on this machine".
8. The COST Stat's `madeOf` contains "prices as of " followed by a date, and either a band clause or "measured from your last run on ".
9. For GPQA with `hf_token_set: false`, R7 shows the gated line in the amber class with an external link, and the Readout contains "Hugging Face token".
10. For XSTest with the `judge_key` check failing, New run is `aria-disabled` and R5 shows the judge row failing with the text "XSTest's judge is gpt-4o, which needs an OpenAI key. Add one in Settings." linking to `#/settings#keys`.
11. `#/benchmarks/suites/swe_bench_verified` (or any unknown key) renders the EmptyState "There is no suite called swe_bench_verified." with an action whose `href` is `#/benchmarks`; R5 to R8 are absent; New run is absent.
12. R8 with two past runs renders two rows whose Result cells match the catalog's Rate rule (every `%` followed by "(r of N)"), and a failed run shows "n/a (failed)".
13. At 1024×700 the two columns stack in the order R2, R3, R4, R5, R6, R7, R8 (DOM order equals visual order); no horizontal scrollbar.
14. Every recipe value that the catalog file marks unverified carries the visible suffix "(to be confirmed)" in the L0 build fixture and the test asserts the release fixture has none.

## 12. Open questions for Brad
1. The recipe table shows "(to be confirmed)" during L0 so unverified pins are visible in the app itself. Keep that as an L0-only affordance, or never ship a build that can show it?
