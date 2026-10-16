# Benchmarks (catalog and runs)

- Route(s): `#/benchmarks`
- Section: Benchmarks
- Purpose (one sentence, what the researcher does here): See which suites can run on this machine right now, what each would cost, and every past run with its standard or modified badge, then start a new run or open an old one.
- Arrives from: header nav "Benchmarks"; Home "Benchmarks" question card; Home "recent" benchmark run rows (those go straight to `#/benchmarks/runs/:id`); Results counts "benchmark runs". Leaves to: `#/benchmarks/new` (New run, with `?suite=` when started from a card), `#/benchmarks/suites/:suite` (suite name link), `#/benchmarks/runs/:id` (run row), `#/settings#benchmarks` (any failing prerequisite's fix link). Back: header nav or browser back.
- Components used (names from `../03-components.md`): Header (§1), Panel (§2.3), Card (§14), Chip (§17: tier tag, `standard`, `modified`), Rate (§6), Table (§12), EmptyState (§2.6), Readout (§3), Term (§4), Caveat (§5), Button (§15), Menu (§20), Dialog (§18: delete run), Toast (§21), FirstTimeTip (§22), ProgressCard (§28, compact row for a running run).
- Baseline surfaces replaced (from `../00-content-inventory.md`): none; new section (Round 2.3). The only baseline element it touches is the Dashboard overview counts (inventory §22), which gain a "benchmark runs" count on `#/results`, specified there.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ No session ▾ ]  ● 2 keys set     Probe Studies Experiments Benchmarks …  ? ⚙│ R0 Header
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Benchmarks                                                          [ New run ]      │ R1 title row
│ ▣ Three suites can run here. SWE-bench Verified needs Docker Desktop, which is not   │ R1 Readout
│   running. One run is in progress.                                                   │
│                                                                                      │
│ RUNNING                                                                              │ R2 (only while a run is running)
│ ┌ RUNNING · xstest-prompts-1 · condition 2 of 3                           12:41 ┐    │
│ │ ████████████░░░░░░░░  612 of 1 350 done · cost so far about $2.10  [Open] [Cancel]│ │
│ └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│ SUITES                                                                               │ R3 suite cards (3 across)
│ ┌ LIGHT ──────────────────────┐ ┌ MEDIUM ─────────────────────┐ ┌ HEAVY ──────────────────────┐
│ │ XSTest                      │ │ GPQA Diamond                │ │ SWE-bench Verified          │
│ │ Does the model refuse safe  │ │ Graduate-level science      │ │ Does the model fix real     │
│ │ prompts that sound unsafe?  │ │ questions, four choices.    │ │ GitHub issues in a sandbox? │
│ │ 450 prompts · judge gpt-4o  │ │ 198 questions · no judge    │ │ 500 instances · Docker      │
│ │ about $2 to $3, 5 to 9 min  │ │ about $1 to $4, 5 to 15 min │ │ about $150 to $1 650,       │
│ │ ✓ ready (OpenAI key set)    │ │ ✓ ready (Hugging Face token)│ │   9 h to 2 days at 4 sandboxes│
│ │ last run: 2026-10-14 ·      │ │ last run: none              │ │ ⚠ Docker Desktop not running│
│ │   standard                  │ │                             │ │ ⚠ 48 GB free, needs 120 GB  │
│ │ [New run]  [About]          │ │ [New run]  [About]          │ │ [Check prerequisites] [About]│
│ └─────────────────────────────┘ └─────────────────────────────┘ └─────────────────────────────┘
│ ┌ PLANNED ────────────────────┐ ┌ PLANNED ────────────────────┐  (StrongREJECT, OR-Bench Hard-1K,
│ │ StrongREJECT  Not in this   │ │ MMLU-Pro      Not in this   │   MMLU-Pro, HumanEval: dimmed)
│ │ release.                    │ │ release.                    │
│ └─────────────────────────────┘ └─────────────────────────────┘
│                                                                                      │
│ RUNS  7                                        [status ▾] [suite ▾] [search…       ] │ R4 runs table
│ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Name              Suite        Conditions                 Result            When │ │
│ │ xstest-prompts-1  XSTest       3 · A standard, B C modified  running 612 of 1 350  12:41 ago│
│ │ gpqa-haiku-vs-8b  GPQA Diamond 2 · standard               41% (81 of 198) · 29% (58 of 198)  2026-10-15│
│ │ swe-first-50      SWE-bench V. 1 · modified (subset 50)   38% (19 of 50)    2026-10-15 ⋯│
│ │ xstest-baseline   XSTest       1 · standard               86% (171 of 200) unsafe · 5% (12 of 250) safe  2026-10-14│
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
R3 suite cards go two across (the third wraps to a second row), each card keeps every line; the planned row stays dimmed below. R4 Result column text wraps to two lines inside the cell ("41% (81 of 198)" on one line per condition); the search input shrinks to 160 px. Nothing is hidden.

## 2. Regions

### R0 Header
Shared; see `../03-components.md` §1. Benchmarks nav item has `aria-current="page"`. The SessionSwitcher shows "No session" when none is open; a session is not required here (IA §1).

### R1 Title row and Readout
- Components: h1 (tokens §2), Button primary md "New run", Readout.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| "Benchmarks" | static | | h1 | |
| New run | static | | primary md; disabled with reason "The benchmark runner is not installed yet. Install it from Settings." when `runner.installed` is false (link to `#/settings#benchmarks`) | Button |
| Readout | `GET /api/benchmarks/suites`, `GET /api/benchmarks/prereqs`, `GET /api/benchmarks/runs?status=running` | `suites[].prereqs.ok`, `runner.installed`, `runs[]` | sentence shapes in §3 | Readout |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| New run | none | navigate `#/benchmarks/new` |

### R2 Running run (conditional)
- Components: ProgressCard compact (`kind: 'benchmark'`, one line), Button secondary sm "Open", Button secondary sm "Cancel".
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| eyebrow "RUNNING · {name} · condition {i} of {k}" | `GET /api/benchmarks/runs/{id}/progress` (polled 2 s while visible) | `status`, run `name`, index of the condition with `status == 'running'`, `conditions.length` | eyebrow accent | ProgressCard |
| elapsed | same | `elapsed_s` | "12:41" mono (tokens §6 durations) | ProgressCard |
| done | same | sum `conditions[].done.count` / sum `conditions[].done.of` | Rate count-first "612 of 1 350 done"; thin-space thousands | Rate |
| cost so far | same | sum `conditions[].cost_usd`, any `cost_is_estimate` | "cost so far about $2.10" ("about" when any estimate) | ProgressCard |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Open | none | navigate `#/benchmarks/runs/{id}` (Progress tab) |
| Cancel | `POST /api/benchmarks/runs/{id}/cancel` after a Dialog "Stop this run? 612 samples are done and stay saved; you can resume later." (draft; brad-voice pass) | status → cancelled; card eyebrow "CANCELLED"; Toast info "Run stopped. Resume it from its page." |

### R3 Suite cards
- Components: Card ×(available + planned), Chip tag (tier), Term on "judge", "standard", "sandbox", Caveat inline (`bench_estimate`) on the cost line, Button secondary sm ×2 per card.
- Content and bindings (per card):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| eyebrow tier | `GET /api/benchmarks/suites` | `suites[].tier` | "LIGHT" / "MEDIUM" / "HEAVY" / "PLANNED" (uppercase by CSS) | Card eyebrow |
| title | same | `name` | Card title; a link to `#/benchmarks/suites/{suite_key}` | Card |
| body (one sentence) | same | `description` | ends with "."; drafts in §3 | Card body |
| size line | same | `sample_count`, `recipe.judge` | "450 prompts · judge gpt-4o" / "198 questions · no judge" / "500 instances · Docker" ("prompts", "questions", "instances" from `recipe.sample_noun`) | meta |
| estimate line | `POST /api/benchmarks/estimate` with a default one-condition standard request on the user's first available model for the suite (cached per suite per session) | `cost.low`, `cost.high`, `wall_clock_s.low/high` | "about $2 to $3, 5 to 9 min"; "n/a" with reason when no priced model is available; Caveat `bench_estimate` on hover of the Info icon; the model assumed is in the hover: "for claude-sonnet-4-6, one standard condition, all samples" | meta + Caveat |
| prerequisites | same route | `prereqs.ok`, `prereqs.checks[]` | ok: one line "✓ ready (OpenAI key set)" naming the gating check that passed; not ok: one line per failing check in `text-amber-400` with its `fix` text, each a link to `link` | meta |
| last run | same | `last_run` | "last run: 2026-10-14 · standard" (date, then the run's badge: standard when every condition is standard, else modified); "last run: none" | meta + Chip |
| New run / Check prerequisites | | | "New run" when `prereqs.ok` and `runner.installed`; "Check prerequisites" when not ok; disabled "Not in this release." for planned | Button secondary sm |
| About | | | always | Button secondary sm |

- Actions:

| Control | Calls | Then |
|---|---|---|
| title link / About | none | navigate `#/benchmarks/suites/{suite_key}` |
| New run | none | navigate `#/benchmarks/new?suite={suite_key}` |
| Check prerequisites | `POST /api/benchmarks/prereqs/check {suite}` | card prerequisites re-render; button shows loading "Checking…"; if all pass, the button becomes "New run" and a Toast success "Everything SWE-bench needs is in place." |
| failing check link | none | navigate to `link` (`#/settings#benchmarks` or an external URL opened with the platform opener, never in-app) |

### R4 Runs table
- Components: panel heading (upper) "RUNS" with count tag, Select ×2 (status, suite), Input header variant (search), Table, Chip (`standard` / `modified`), Rate, OutcomeBadge is not used (benchmark labels are not the four outcomes), Menu per row (⋯), Dialog (delete), EmptyState.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| count tag | `GET /api/benchmarks/runs` | `runs.length` (server total) | count pill | Chip count |
| Name | same | `runs[].name` | text, link to the run | Table text |
| Suite | same | `suite_name` | text; truncated at 14 chars with full name in `title` and sr text | Table text |
| Conditions | same | `conditions[]` | "3 · A standard, B C modified": count, then labels grouped by flag; one condition: "1 · standard" or "1 · modified (subset 50)" where the parenthesis is the first difference | Table text + Chip |
| Result | same | `conditions[].score_summary` | per condition `Rate` pct-first "41% (81 of 198)" joined by " · "; XSTest shows both groups "86% (171 of 200) unsafe · 5% (12 of 250) safe"; running: "running 612 of 1 350"; draft/ready: "not started"; interrupted/cancelled: "stopped at 27 of 50"; failed: "failed" in `text-red-400` | Rate |
| When | same | `finished_at` or `started_at` or `created_at` | relative under 24 h ("12:41 ago" uses elapsed for running; "3 h ago"), else date "2026-10-15" | Table text |
| ⋯ menu | | | Open, Export (JSON / CSV / zip), Rename, Delete (danger) | Menu |
| sort | client | | by When desc default; sortable Name, Suite, When | Table |
| filters | `GET /api/benchmarks/runs?status=&suite=` | | status Select: all, running, completed, partial, stopped (cancelled + interrupted), failed, not started; suite Select from the catalog; search matches name client-side | Select, Input |

- Actions:

| Control | Calls | Then |
|---|---|---|
| row click / Open | none | navigate `#/benchmarks/runs/{id}` (Progress tab if running or resumable, else Results) |
| Export JSON / CSV / zip | `GET /api/benchmarks/runs/{id}/export?format=` | file download; Toast success "Exported run {name} ({size})."; for gated suites the Dialog from `benchmark-run.md` §9 asks about dataset items first |
| Rename | Dialog with one Input, `PATCH /api/benchmarks/runs/{id} {name}` | row updates; Toast success "Renamed." |
| Delete | Dialog confirm (typed phrase = the run name) "Delete {name}? Its {n} samples and provenance go too. Logs on disk: {size}. [x] Also delete the logs" then `DELETE /api/benchmarks/runs/{id}?logs=` | row removed; Toast success "Deleted {name}; freed {size}." |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|
| loading | first paint | h1, New run disabled, Readout null (live region mounted) | hidden | three cards with `animate-pulse` lines | three skeleton rows | (none) |
| runner not installed | `runner.installed == false` | New run disabled with reason and link | hidden | every card: prerequisites line "Runner not installed" amber, button "Install from Settings" → `#/settings#benchmarks` | as data | "The benchmark runner is not installed yet. Install it from Settings; the three suites below show what it can run." |
| empty (no runs, all ready) | `runs == []` | as with data | hidden | as data | EmptyState "No benchmark runs yet. Start one from a suite card above." with action "New run" | "Three suites can run here. Pick one above to see its cost before anything runs." |
| no key | zero provider keys | New run enabled (Ollama needs no key) | hidden | XSTest: "judge needs an OpenAI key, or pick another judge (modified)"; GPQA: ready if the HF token is set; estimate lines "n/a (no priced model available)" | as data | "No API keys are set. Local models can still run; XSTest's published judge needs an OpenAI key." |
| Docker absent | SWE-bench `prereqs.ok == false` | as data | | SWE-bench card: amber lines, "Check prerequisites" | as data | "…SWE-bench Verified needs Docker Desktop, which is not running." (clause appended) |
| with data, idle | runs exist, none running | as data | hidden | as data | table | "Three suites can run here. 7 runs so far; the last one finished 2026-10-15." |
| with data, running | a run has `status == 'running'` | as data | shown, polling | New run on every card disabled with reason "One run at a time; a run is in progress." | the running row first, Result "running 612 of 1 350" | "…One run is in progress." (clause appended) |
| resumable run exists | any run `interrupted` or `cancelled` | as data | hidden (not running) | as data | row Result "stopped at 27 of 50" with a Resume text button in the row | "…One run stopped early and can be resumed." |
| error | any route fails | as data | | card estimate "n/a (couldn't reach the server)" | EmptyState with the error and Retry | Readout warn: "Flinch couldn't load the benchmark catalog: {error}. Retry." |
| estimate pending | estimate route slow | | | estimate line `animate-pulse` "estimating…" | | |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| suite size "450 prompts" | `sample_count` | the noun and, for XSTest, "250 safe + 200 unsafe" in the About page; here the total only | meta |
| estimate "about $2 to $3" | `estimate.cost.low/high` (benchmarks.md §5.2) | hover: model assumed, samples, tokens per sample assumption or "measured from your last run", prices as-of date; Caveat `bench_estimate` | meta + Caveat |
| estimate "5 to 9 min" | `estimate.wall_clock_s.low/high` (§5.3) | hover: latency assumption, connections | meta |
| "48 GB free, needs 120 GB" | prereq check `detail` | the check name | meta |
| running "612 of 1 350 done" | sum of condition `done` | per-condition breakdown on the run page; here the sum with its total | Rate |
| "cost so far about $2.10" | sum `cost_usd` | "about" when estimated; usage basis on the run page | ProgressCard |
| Result "41% (81 of 198)" | `score_summary.count / of` | count in parentheses always | Rate |
| runs count "7" | server total | | Chip count |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `bench_estimate` | "An estimate from assumed tokens per sample and this build's price table. The run shows the real usage." | every card estimate line (Info hover) | `lib/copy/caveats.ts`; the estimate payload `inputs` |
| `swebench_contested` | "SWE-bench Verified is disputed as a headline number (contamination, flawed tests). Use it to compare conditions, not to claim a rank." | SWE-bench card body, as a `note` variant below the size line | `lib/copy/caveats.ts` |
| `modified_bench` | "Not a standard run: a score here is not comparable to the published one." | hover on every `modified` chip in R4 | `lib/copy/caveats.ts` |
| `rate_n` | "A rate from N runs is a rate from N runs." | hover on every Rate in R4 (Rate's default) | Rate component |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| suite | R3 heading, R4 column | `lib/glossary` `suite`: "A benchmark as shipped: its samples, its prompt recipe and its scoring." |
| sample / prompt / question / instance | size lines | `sample`: "One item in a suite. XSTest calls them prompts, GPQA questions, SWE-bench instances." |
| judge | XSTest size line | `judge`: "The model that grades each response where a suite is model-graded. A different judge is a different benchmark." |
| standard / modified | R3 last run, R4 conditions | `standard`: "Matches the suite's published recipe: no system prompt, default sampling, all samples, the published judge." `modified`: "Differs from the recipe in at least one way; the run says which." |
| condition | R4 column | `condition`: "One model with one system prompt and one set of sampling and reasoning settings, plus the judge." |
| sandbox | SWE-bench card | `sandbox`: "A Docker container the model works in for SWE-bench, with the repository checked out and the internet off." |
| tier | eyebrows | `tier`: "Light runs in minutes for a few dollars; Medium in under an hour; Heavy needs Docker and hours or days." |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `bench.catalog.standard` | the first `standard` or `modified` chip in R3 or R4 | "Standard means the run matched the published recipe. Modified runs say what changed, and their numbers are not the published ones." | first visit with at least one chip visible |
| `bench.catalog.estimate` | the first card's estimate line | "Every cost here is a band from assumed tokens and this build's prices. Open a suite to see the assumptions." | first visit, runner installed |
| `bench.catalog.docker` | SWE-bench card prerequisites | "SWE-bench runs real repositories in Docker. Flinch checks Docker, WSL 2, memory and disk before it lets a run start." | first visit when the SWE-bench check fails |

## 8. Keyboard and focus
- Shortcuts: `n` New run (when not in an input); `/` focuses the runs search; `Escape` clears the search.
- Focus order: header → New run → (Running card: Open, Cancel) → suite cards in tier order (title link, then the two buttons) → planned cards (skipped: disabled, not focusable, their reason is read with the card) → status Select → suite Select → search → table header buttons → rows (Enter opens; the ⋯ menu is reachable with Tab inside the row).
- Live regions: the Readout (`role="status"`); the Running card's counts line (polite, throttled 3 s); Toasts.

## 9. Dialogs and overlays opened from here
- Cancel run (Dialog, R2).
- Rename run (Dialog, one Input).
- Delete run (Dialog confirm, typed run name, checkbox "Also delete the logs ({size})").
- Export dataset-items warning for gated suites (Dialog, specified in `benchmark-run.md` §9).
- Menu ⋯ per run row.
- Term tooltips; FirstTimeTips (§7).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/benchmarks/suites` | R1, R3 on load |
| GET | `/api/benchmarks/prereqs` | R1 (runner status), R3 |
| POST | `/api/benchmarks/prereqs/check` | R3 Check prerequisites |
| POST | `/api/benchmarks/estimate` | R3 estimate line (one default request per available suite, cached per session) |
| GET | `/api/models` | R3 estimate default model (first priced model with a key; existing route) |
| GET | `/api/benchmarks/runs` | R4 on load and on filter change; `?status=running` for R2 |
| GET | `/api/benchmarks/runs/{id}/progress` | R2 poll every 2 s |
| POST | `/api/benchmarks/runs/{id}/cancel` | R2 Cancel |
| POST | `/api/benchmarks/runs/{id}/resume` | R4 row Resume |
| PATCH | `/api/benchmarks/runs/{id}` | R4 Rename |
| DELETE | `/api/benchmarks/runs/{id}` | R4 Delete |
| GET | `/api/benchmarks/runs/{id}/export` | R4 Export |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With the fixture catalog (three available, four planned), R3 renders seven Cards; the four planned have no `href`, `aria-disabled="true"`, and the text "Not in this release." inside the card.
2. With a stubbed `prereqs` where Docker fails, the SWE-bench card shows one `text-amber-400` line per failing check, each an `<a>` whose `href` equals the check's `link`, and its first button text is "Check prerequisites".
3. Clicking "Check prerequisites" sends `POST /api/benchmarks/prereqs/check` with `{"suite":"swe_bench_verified"}`; while pending the button has `aria-busy="true"` and text "Checking…"; with a stub that now passes, the button text becomes "New run" and a success Toast appears.
4. Every estimate line matches `/^about \$\d[\d ]*( to \$\d[\d ]*)?, .+$/` or `n/a` followed by a reason; an Info icon beside it has `aria-describedby` to the `bench_estimate` phrase.
5. R4 Result cells never contain a `%` without "(r of N)" in the same cell (copy-lint regex from `03-components.md` Appendix B).
6. With one run `status: running` in the fixture, R2 is present, `GET …/progress` is called at least twice within 5 s, and every suite card's "New run" button is disabled with the visible reason text "One run at a time; a run is in progress."
7. With zero runs, R4 renders EmptyState text "No benchmark runs yet. Start one from a suite card above." and its action navigates to `#/benchmarks/new`.
8. With `runner.installed: false`, the New run button is `aria-disabled` with `aria-describedby` to the reason text, and the reason contains a link to `#/settings#benchmarks`.
9. Delete: the confirm primary stays disabled until the typed value equals the run name exactly (case-sensitive); the request carries `?logs=true` only when the checkbox is ticked.
10. At 1024×700 no horizontal scrollbar on `document.documentElement`; every card line from the 1280 wireframe is present in the DOM and visible.
11. The Readout `role="status"` element exists on first paint before data (text empty), and after load contains the sentence shape from §3 for the fixture state.
12. Keyboard: with focus on the page body, pressing `n` navigates to `#/benchmarks/new`; with focus inside the search input, `n` types the letter.

## 12. Open questions for Brad
1. The card estimate assumes "your first priced model with a key" (benchmarks.md §5). Alternative: no estimate on the card, only on the Suite and New run screens. Which?
2. Should the planned suites (StrongREJECT, OR-Bench Hard-1K, MMLU-Pro, HumanEval) show at all in release 1, or does a four-card "Not in this release" row read as clutter?
