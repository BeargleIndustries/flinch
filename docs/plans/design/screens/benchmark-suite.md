# Suite

- Route(s): `#/benchmarks/suites/:suite` (`:suite` = `suite_key`: `xstest`, `gpqa_diamond`, `swe_bench_verified`; planned keys render the planned state)
- Section: Benchmarks
- Purpose (one sentence, what the researcher does here): Read what the suite measures and how big it is, what its published recipe is and therefore what "standard" means here, what a run would cost on this machine, what it needs (Docker, a token, a judge key) and whether those are met, and the licence, then start a run or fix a prerequisite.
- Arrives from: catalog card title or "About"; New run "About {suite} ↗"; Run title-row suite link; Home question card "Benchmarks" (no: that goes to the catalog); Settings › Benchmarks "what SWE-bench needs" link. Leaves to: `#/benchmarks/new?suite=:suite` (New run), `#/benchmarks` (breadcrumb), `#/benchmarks/runs/:id` (past runs of this suite), `#/settings#keys` / `#/settings#benchmarks` or an external guide (prerequisite fixes). Back: breadcrumb or browser back.
- Components used (names from `../03-components.md`): Header (§1), Panel (§2.3), InsetBox (§2.4), Section (§2.5), Readout (§3), Term (§4), Caveat (§5), Stat (§7, estimate), Table (§12, recipe and past runs), Chip (§17: tier, `standard`, `modified`), Button (§15), Select (§16, estimate model), LoadingScreen step list (§24, prerequisites), FirstTimeTip (§22), Toast (§21).
- Baseline surfaces replaced (from `../00-content-inventory.md`): none; new.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ No session ▾ ]  ● 2 keys set     Probe Studies Experiments Benchmarks …  ? ⚙│ R0
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Benchmarks › SWE-bench Verified                 [HEAVY]            [ New run ]       │ R1
│ ▣ 500 real GitHub issues the model must fix inside a Docker sandbox. Standard here   │ R1 Readout
│   means the inspect_evals recipe, not the leaderboard's. Docker Desktop is not       │
│   running, so a run can't start yet.                                                 │
├────────────────────────────────────────────┬─────────────────────────────────────────┤
│ WHAT IT MEASURES                           │ WHAT A RUN NEEDS                        │ R2 | R5
│ Each instance is a repository at a commit  │ ✗ Docker Desktop not running  → guide   │
│ plus an issue. The model gets a shell and  │ ✓ Linux containers, x86_64              │
│ Python in a container with the internet    │ ✗ 48 GB free; needs about 120 GB → Settings│
│ off and 30 messages to produce a patch.    │ ✓ 16 GB memory, 8 CPUs                  │
│ The patch is resolved when the failing     │ ✓ Runner installed (inspect-ai x.y.z)   │
│ tests pass and the passing ones still      │ ✓ Anthropic key set                     │
│ pass.                                      │ ○ Checked 1 min ago · [Check again]     │
│ Score: resolved rate, r of 500.            │                                         │
│ ⓘ SWE-bench Verified is disputed as a      │ ESTIMATE  for [claude-sonnet-4-6 ▾]     │ R6
│   headline number…                         │ ┌ COST, ALL 500 ──┐ ┌ TIME ────────────┐│
│ ⓘ A local run is not a leaderboard entry… │ │ about $150 to   │ │ about 9 h to     ││
│                                            │ │ $1 650          │ │ 2 days           ││
│ THE PUBLISHED RECIPE (what standard means) │ │ 15 to 30 steps  │ │ 4 to 12 min per  ││
│ Field          Standard value              │ │ × 150 000 to    │ │ instance, 4      ││
│ Scaffold       basic_agent, bash + python  │ │ 450 000 input   │ │ sandboxes        ││
│ Message limit  30                          │ │ tokens…         │ │                  ││
│ Tool timeout   210 s                       │ └─────────────────┘ └──────────────────┘│
│ Internet       off                         │ First run also pulls about 100 GB of    │
│ Judge          none (the repository's      │ images; depends on your download speed. │
│                tests grade the patch)      │ ⓘ An estimate from assumed tokens…      │
│ Sampling       provider defaults           │                                         │
│ System prompt  none beyond the scaffold's  │ DATASET AND LICENCE                     │ R7
│ Samples        all 500 · 1 epoch           │ princeton-nlp/SWE-bench_Verified        │
│ Dataset        princeton-nlp/SWE-bench_    │ revision <sha> · 500 instances          │
│                Verified @ <sha>            │ MIT (harness); instances are public     │
│ Harness pins   inspect-ai x · inspect-evals y│ GitHub code under their own licences  │
│ Anything else makes a run modified; the    │ Kept on this machine under HF_HOME.     │
│ run says what changed.                     │                                         │
│                                            │ PAST RUNS OF THIS SUITE  2              │ R8
│                                            │ swe-first-50  1 · modified (subset 50)  │
│                                            │   38% (19 of 50)  2026-10-15            │
│                                            │ swe-smoke-5   1 · modified (subset 5)   │
│                                            │   n/a (failed)   2026-10-13             │
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
| tier | same | `tier` | Chip tag uppercase; planned suites "PLANNED" | Chip |
| New run | same | `prereqs.ok`, `runner.installed`, `status` | enabled when ok; disabled with reason: the first failing check's `fix`, or "Not in this release." for planned | Button |
| Readout | same | `description_long` first sentence, recipe note, first failing check | §3 sentence shapes | Readout |

- Actions:

| Control | Calls | Then |
|---|---|---|
| New run | none | navigate `#/benchmarks/new?suite={suite_key}` |

### R2 What it measures
- Components: Section (eyebrow "WHAT IT MEASURES"), body text, "Score:" line with Term.
- Bindings: `description_long` (two to five sentences from `suites.yaml`, drafted in §3 below for the three suites), `recipe.metric` → "Score: resolved rate, r of 500." / "Score: refusal rate on 200 unsafe prompts and over-refusal rate on 250 safe ones, each r of N; the judge grades each response full refusal, partial, or full compliance." / "Score: accuracy, r of 198."

### R3 Caveats
- Components: Caveat `note` variant ×n.
- Bindings: `caveats[]` from the suite payload: SWE-bench `swebench_contested`, `bench_not_leaderboard`, `bench_resource_limits`; XSTest `bench_judge_swap`; GPQA `bench_gpqa_recipe`, `bench_gated_text`.

### R4 The published recipe
- Components: Section (eyebrow "THE PUBLISHED RECIPE (what standard means)"), Table (two columns: Field, Standard value), closing sentence.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| rows | suite payload | `recipe.*` (benchmarks.md §1.6): `solver`, `message_limit`, `tool_timeout_s`, `internet`, `judge`, `sampling`, `system_prompt`, `samples`, `epochs`, `dataset_id`, `dataset_revision`, `harness_pins` | one row per field present; `null` renders "none"; dataset revision as a short sha with the full one in `title`; a field whose value is "unverified; T-check in L0" in the catalog file renders with an amber "(to be confirmed)" suffix so the state of the pin is visible in the app during L0 and absent after | Table text |
| closing line | static | | "Anything else makes a run modified; the run says what changed." (draft; brad-voice pass) | text |

### R5 What a run needs
- Components: Section (eyebrow "WHAT A RUN NEEDS"), step list rows (Check / amber ✗ / hollow), text "Checked {ago}", Button secondary sm "Check again".
- Bindings: `prereqs.checks[]` for this suite (benchmarks.md §2.7); ok rows "✓ {name} ({detail})"; failing rows "✗ {fix}" with "→ {link label}" as a link (Settings, or "guide" for external); pending "○ checking…".
- Actions:

| Control | Calls | Then |
|---|---|---|
| Check again | `POST /api/benchmarks/prereqs/check {suite}` | rows refresh; R1 New run enables when all pass; Toast success "Everything {suite} needs is in place." |
| row link | | navigate `#/settings#keys` / `#/settings#benchmarks`, or open the external guide with the platform opener |

### R6 Estimate
- Components: Section (eyebrow "ESTIMATE"), Select (model, from `GET /api/models`, default the first keyed model; Ollama models included), Stat ×2, InsetBox row (image pull, SWE-bench), Caveat `bench_estimate`.
- Bindings: `POST /api/benchmarks/estimate {suite_key, conditions: [{label:'A', model_id, generate_config:{}}], subset:{mode:'full'}}` on load and on model change → COST "about $150 to $1 650", `madeOf` the per-sample assumptions (or "measured from your last run on {date}") and "prices as of {date}"; TIME "about 9 h to 2 days", `madeOf` "4 to 12 min per instance, 4 sandboxes" (or Ollama: "no estimate until Flinch has timed ten samples on this machine"); `image_pull_gb` row for SWE-bench.
- Actions: model Select change → re-estimate.

### R7 Dataset and licence
- Components: Section (eyebrow "DATASET AND LICENCE"), mono text lines, Caveat `bench_gated_text` (GPQA).
- Bindings: `dataset_id`, `dataset_revision`, `sample_count` with noun, `licence` (suite file text: XSTest "prompts CC-BY-4.0"; SWE-bench "MIT (harness); instances are public GitHub code under their own licences"; GPQA "CC-BY-4.0 with terms: gated; items must not be published; canary string present"), `gated` → "Gated: needs your Hugging Face token and accepted terms on huggingface.co" with a link, `cached` → "Kept on this machine under HF_HOME ({size})" or "Not downloaded yet; the first run fetches it."

### R8 Past runs of this suite
- Components: Section (eyebrow "PAST RUNS OF THIS SUITE" with count tag), Table (name, conditions with chips, result Rate, date), EmptyState.
- Bindings: `GET /api/benchmarks/runs?suite={suite_key}&limit=10` → same row rules as the catalog R4; row click → `#/benchmarks/runs/{id}`; EmptyState "No runs of this suite yet." with action "New run".

## 3. States
| State | Trigger | R1 | R2 to R4 | R5 | R6 | R7 | R8 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|
| loading | first paint | h1 skeleton, New run disabled | skeleton | skeleton | skeleton | skeleton | skeleton | (none) |
| ready (all checks pass) | `prereqs.ok` | New run enabled | data | all ✓ | Stats | data | data or empty | XSTest: "450 prompts, 250 that only sound unsafe and 200 that are. The published judge is gpt-4o; your OpenAI key is set, so a standard run can start." |
| | | | | | | | | GPQA: "198 graduate-level science questions with four choices. Standard here means the inspect_evals recipe, not a lab's model card. Your Hugging Face token is set and the terms are accepted, so a run can start." |
| | | | | | | | | SWE-bench: "500 real GitHub issues the model must fix inside a Docker sandbox. Standard here means the inspect_evals recipe, not the leaderboard's. Docker Desktop is ready, 130 GB free." |
| Docker absent | SWE-bench check fails | New run disabled with the Docker fix | data | ✗ rows | Stats still shown | | | "…Docker Desktop is not running, so a run can't start yet." (clause replaces the last) |
| low disk | disk check fails | disabled "SWE-bench needs about 120 GB free where Docker keeps images; you have 48 GB." | | ✗ disk row → Settings › Benchmarks | | | | "…48 GB free where Docker keeps images; SWE-bench needs about 120 GB." |
| no HF token (GPQA) | token check fails | disabled | | ✗ token row → `#/settings#keys` | | "Gated: …" line amber | | "…GPQA is gated. Add your Hugging Face token in Settings and accept the dataset terms on huggingface.co." |
| no judge key (XSTest) | OpenAI key missing | New run **enabled** (a modified judge is allowed) | | ✗ "XSTest's published judge is gpt-4o. Add an OpenAI key, or pick another judge (that makes the run modified)." | estimate assumes the published judge and says so | | | "…The published judge is gpt-4o and there is no OpenAI key: a run can start with another judge, and it will be modified." |
| runner not installed | | disabled "The benchmark runner is not installed yet. Install it from Settings." | data | ✗ runner row → `#/settings#benchmarks` | Stats (estimates do not need the runner) | | | "…The benchmark runner is not installed yet; install it from Settings." |
| no priced model | no key for any priced model and no Ollama | | | | COST "n/a", `madeOf` "no model with a key and a price in this build's table" | | | |
| Ollama model picked (R6) | | | | | COST "$0 (local)" with `bench_local_cost`; TIME "no estimate until…" | | | |
| planned suite | `status == 'planned'` | New run disabled "Not in this release." | R2 text and the recipe as far as known, with "(planned)" | hidden; a line "Prerequisites will be listed when the suite ships." | hidden | data | hidden | "StrongREJECT is on the list for a later release. Here is what it measures and what it would need." |
| checking | Check again pending | | | rows ○, button "Checking…" | | | | |
| error | suite route fails | | EmptyState with Retry | | | | | Readout warn: "Flinch couldn't load this suite: {error}. Retry." |
| unknown suite key | 404 | | EmptyState "There is no suite called {key}." with action "Back to Benchmarks" | | | | | |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "500 instances" / "450 prompts (250 safe + 200 unsafe)" / "198 questions" | `sample_count`, `recipe.groups` | the noun and the split | text |
| recipe values "30", "210 s" | `recipe.*` | the field name | Table |
| "48 GB free; needs about 120 GB" | prereq `detail` | | step row |
| "16 GB memory, 8 CPUs" | `docker info` via prereqs | | step row |
| COST "about $150 to $1 650" | estimate band (benchmarks.md §5.2) | `madeOf`: steps × tokens assumptions or measured, cache assumption, prices as-of; the model in the Select; Caveat `bench_estimate` | Stat |
| TIME "about 9 h to 2 days" | estimate (§5.3) | `madeOf`: per-instance latency band, sandboxes or connections | Stat |
| "about 100 GB of images" | `image_pull_gb` | "depends on your download speed" | InsetBox |
| dataset cache "({size})" | `cached.bytes` | | text |
| past runs results | `score_summary` | Rate with counts | Rate |
| past runs count | server total | | Chip count |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `swebench_contested` | "SWE-bench Verified is disputed as a headline number (contamination, flawed tests). Use it to compare conditions, not to claim a rank." | R3 on SWE-bench | `lib/copy/caveats.ts` |
| `bench_not_leaderboard` | "A local run is not a leaderboard entry. Same suite, different scaffold and limits." | R3 on SWE-bench | same |
| `bench_resource_limits` | "Sandbox CPU and memory shift agentic scores by a few points. The limits used are in the provenance." | R3 on SWE-bench | same |
| `bench_judge_swap` | "The judge is part of the benchmark. A different judge is a different benchmark." | R3 on XSTest; R5 judge row | same |
| `bench_gpqa_recipe` | "Model cards use each lab's own prompt. Standard here means the inspect_evals recipe." | R3 on GPQA | same |
| `bench_gated_text` | "Dataset items stay on this machine. Do not publish them." | R7 on GPQA | same |
| `bench_estimate` | "An estimate from assumed tokens per sample and this build's price table. The run shows the real usage." | R6 | same |
| `bench_local_cost` | "$0 means no API bill. Your machine's time and power are not counted." | R6 when an Ollama model is picked | same |
| `modified_bench` | "Not a standard run: a score here is not comparable to the published one." | hover on `modified` chips in R8 | same |
| `rate_n` | "A rate from N runs is a rate from N runs." | R8 Rates | Rate default |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| suite, sample / instance / prompt / question, judge, standard, modified, scaffold, sandbox, tier, condition | throughout | `lib/glossary` (as in `benchmarks-catalog.md` §6) |
| resolved rate / refusal rate / over-refusal rate / accuracy | R2 Score line | as in `benchmark-run.md` §6 |
| message limit | R4 | `message_limit`: "How many messages the agent may exchange with the model before it must stop; 30 in the inspect_evals recipe." |
| tool timeout | R4 | `tool_timeout`: "How long one shell or Python command may run in the sandbox before it is cut off." |
| epoch | R4 | `epochs` |
| dataset revision | R4, R7 | `dataset_revision`: "The exact version of the dataset, as a commit on Hugging Face or a file hash. Two runs on different revisions are different benchmarks." |
| gated | R7 | `gated`: "The dataset's owner requires you to accept terms on huggingface.co and use a token before it downloads." |
| canary string | R7 (GPQA) | `canary`: "A marker inside the dataset that lets its authors detect if it leaked into training data. It is one reason not to publish the items." |
| HF_HOME | R7 | `hf_home`: "The folder on this machine where Hugging Face datasets are cached; Flinch keeps it under its own data folder." |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `bench.suite.recipe` | R4 table | "This table is the whole definition of standard for this suite. A run that matches every row is standard; change any row and the run is modified and says which." | first visit to any Suite screen |
| `bench.suite.prereqs` | R5 "Check again" | "Flinch checks these again right before a run starts, so a green tick here is a preview, not a promise." | first visit when any check has ever failed |

## 8. Keyboard and focus
- Shortcuts: `n` New run (when enabled and not in an input).
- Focus order: header → breadcrumb → New run → R2 Term links (in text order) → R4 table (not focusable; Terms inside it are) → R5 Check again and row links → R6 model Select, Stat Info icons → R7 links → R8 rows.
- Live regions: Readout; R5 result announcement "Prerequisites: all passed" / "Prerequisites: 2 failed, Docker Desktop not running, 48 GB free" after Check again; Toasts.

## 9. Dialogs and overlays opened from here
None of its own. Term tooltips; FirstTimeTips; Toasts. External links (Docker guide, huggingface.co dataset page) open with the platform opener, never inside the app.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/benchmarks/suites/{suite_key}` | R1 to R5, R7 on load |
| POST | `/api/benchmarks/prereqs/check` | R5 Check again |
| GET | `/api/models` | R6 model Select (existing route) |
| POST | `/api/benchmarks/estimate` | R6 on load and model change |
| GET | `/api/benchmarks/runs?suite=&limit=10` | R8 |
| GET | `/api/benchmarks/settings` | R7 cache size (`disk`) and `hf_token_set` |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. `#/benchmarks/suites/swe_bench_verified` renders h1 "SWE-bench Verified", a tier chip "HEAVY", and R4 rows for exactly the recipe fields present in the fixture, in the order: Scaffold, Message limit, Tool timeout, Internet, Judge, Sampling, System prompt, Samples, Dataset, Harness pins.
2. With the Docker check failing in the fixture, New run is `aria-disabled` with `aria-describedby` to the reason "Docker Desktop is not installed or not running. SWE-bench needs it."; R5 shows that row with the amber class and an `<a href>` to the guide; the estimate Stats are still rendered with values.
3. Clicking Check again sends `POST /api/benchmarks/prereqs/check` with `{"suite":"swe_bench_verified"}`; with a stub that passes everything, New run becomes enabled and a success Toast appears whose text ends with ".".
4. R3 on the SWE-bench fixture contains the three pinned phrases `swebench_contested`, `bench_not_leaderboard`, `bench_resource_limits`, each exactly once; on the XSTest fixture `bench_judge_swap` once; on the GPQA fixture `bench_gpqa_recipe` and `bench_gated_text` once each.
5. Changing the R6 model Select to an Ollama model sets the COST Stat value to "$0 (local)" with the `bench_local_cost` phrase beside it and the TIME Stat value to "no estimate until Flinch has timed ten samples on this machine".
6. The COST Stat's `madeOf` contains "prices as of " followed by a date, and either an assumption clause or "measured from your last run on ".
7. For GPQA with `hf_token_set: false`, R7 shows the gated line in the amber class with a link to `#/settings#keys`, and the Readout contains "Hugging Face token".
8. For XSTest with no OpenAI key, New run is enabled and R5 shows the judge row failing with the text "XSTest's published judge is gpt-4o. Add an OpenAI key, or pick another judge (that makes the run modified)."
9. A planned suite key renders New run disabled with "Not in this release.", R5 replaced by the one-line note, and R6 and R8 absent.
10. R8 with two past runs renders two rows whose Result cells match the catalog's Rate rule (every `%` followed by "(r of N)"), and a failed run shows "n/a (failed)".
11. At 1024×700 the two columns stack in the order R2, R3, R4, R5, R6, R7, R8 (DOM order equals visual order); no horizontal scrollbar.
12. Every recipe value that the catalog file marks unverified carries the visible suffix "(to be confirmed)" in the L0 build fixture and the test asserts the release fixture has none.

## 12. Open questions for Brad
1. The recipe table shows "(to be confirmed)" during L0 so unverified pins are visible in the app itself. Keep that as an L0-only affordance, or never ship a build that can show it?
2. Should the Suite screen let the user pick the dataset cache location, or does that belong only in Settings › Benchmarks (the draft)?
