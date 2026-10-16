# Backend gaps found while writing the screen specs

Collected 2026-10-16 from the §12 "open questions" of every screen spec and from `00-content-inventory.md`. Each row says what the screen needs, what the code does today (file:line is in the cited spec), and which bucket it falls in. The build plan takes every **A** row; **B** rows are Brad's call because they add data or routes the v0.8.0 feature set never had; **C** rows are design choices already made in the specs and listed here only so nobody re-litigates them.

Buckets:
- **A: kept feature broken at baseline.** The v0.8.0 UI promised it and the code cannot deliver it. Fixing it is in scope (pre-read §1: every underlying feature kept).
- **B: new data or route the screen wants.** Not in v0.8.0. Needs Brad's yes/no; default is no, and the screen spec already says what it shows instead.
- **C: UI-side design choice.** No backend change.

| # | Gap | Today | Bucket | Spec |
|---|---|---|---|---|
| 1 | Sidebar stats and run history never render | `#stats-content`, `#run-history-list` absent from index.html; stats route fetched, never shown | A (UI only; rebuild renders them) | probe-workbench |
| 2 | "Batch complete" never shows; batch cancel never honoured | runner loop never reads cancelled status | A (cancel is backend) | probe-workbench |
| 3 | Stat-run results never collected, table never appears | stat_runner returns results the UI drops | A (UI) | study-repeat |
| 4 | Policy scorecard table can never render | UI reads `data.categories`; API returns `{snapshot_id, results.by_model}` | A (UI) | results-scorecard |
| 5 | File-backed variant groups show "Run (0)" and cannot run | no `probe_ids` on variant files | A: needs a resolution rule (match by base probe slug) in the API or UI | library-variants, study-framing |
| 6 | Experiment dashboard misreads payload; exports all download the same JSON | UI bugs | A (UI) | experiment |
| 7 | Experiment responses never get a classification | nothing writes `experiment_responses.classification` (runner.py:563-573, app.py:659-665) and no route sets it; the Conditions "compliance rate" can never be computed | A (backend): classify on write or add a classify route; otherwise the rate stays "not labelled" | experiment |
| 8 | Failed experiment cells cannot be re-run | resume re-reads `pending` only | A (backend) | experiment |
| 9 | `condition-comparison.analysis_results` returns the oldest analysis after a re-run | db.py:3844-3856 | A (backend, or the spec's workaround of reading `/analysis` newest-per-type) | experiment |
| 10 | Session-vs-session compare never saved; DELETE comparison never commits | db.py:2518 | A (backend, one-line commit) | study-models |
| 11 | Narrative run-auto / interactive never set `sequences.status = completed`; cross-probe thresholds miss them | only whittle sets it | A (backend) | study-context |
| 12 | Snapshot diff mislabels one-sided probes as improved/regressed | app.py diff rule | A (backend) | study-over-time |
| 13 | Dashboard sequence detail always says "No turns recorded"; per-row JSON/CSV export uses the sidebar's session | UI bugs | A (UI) | results |
| 14 | PDF publication export broken server-side (bytes into JSON) | publication route | A (backend) | results-publication |
| 15 | Load Defaults imports the file's H1 block as a probe | db.py:1021-1031 | A (backend; baseline problem 7) | dialog-probes-add-import |
| 16 | Version string 0.5.0 vs 0.8.0; `logging` not imported (NameError on batch-conditions path); dead test file | baseline problems 1–3 | A (backend) | settings, experiment-new |
| 17 | Desktop key save: `window.__TAURI__` not injected on the sidecar origin, so the key form would fall through to the plaintext `.env` route | capabilities/default.json has no `remote.urls` | A (shell: capability for the three key commands; UI never calls the `.env` route on desktop) | settings |
| 18 | Per-turn latency and token counts are discarded | TargetResponse has them (target.py:13-17); runner keeps only `.text` (runner.py:130/174/204) | B: store them (additive columns on `run_turns`) so the run column can show "2.1 s · 412 tokens"; otherwise client-measured elapsed only, no tokens | probe-workbench |
| 19 | Label source (keyword scan vs judge) and override flag not stored | one `classification` column | B: additive `label_source` column; otherwise the caveat says "keyword scan + judge" without saying which | probe-workbench, study-* |
| 20 | Which judge backend is active is not exposed | no route | B: add to `/api/settings/coach-default` or `/api/ollama/status`; otherwise the no-key notice infers it from keys set | settings, home |
| 21 | Session "last activity" absent from the sessions list | no field | B: derive from max(run.created_at) server-side; otherwise omit the column | probe-sessions |
| 22 | No studies aggregate route; stat runs have no batch id, status, date, export or cancel | per-type routes only | B: one `GET /api/studies` union route; otherwise the Studies list issues one request per type and merges client-side (spec'd) | studies-list |
| 23 | No sequence/batch cancel or delete; whittle is blocking | routes absent | B | study-context |
| 24 | No snapshot rename or export | routes absent | B | study-over-time |
| 25 | Per-claim probe listing, per-probe run counts, scorecard provider field absent from payloads | fields absent | B: small additive fields; otherwise the screens omit them | library-policies, library-probes, results-scorecard |
| 26 | No per-row progress in the experiments list (N+1 fetch) | list route lacks progress | B: add `progress` to the list payload; otherwise N+1 (spec'd with a cap) | experiments-list |
| 27 | batch-conditions emits the experiment id only on `complete` | SSE shape | B: emit it on `start`; otherwise the UI finds it by name prefix (spec'd) | experiment-new |
| 28 | Server never sums experiment cost; report and preregistration are Markdown only; six export routes not five | as is | C: the spec shows the six real outputs and sums cost client-side from per-cell fields it already receives | experiment |
| 29 | Pushback is only valid on the session's latest run (shared target conversation) | runner design | C: the run column disables pushback on older runs with the reason | probe-workbench |
| 30 | `?shell=desktop` flag and `flinch_first` cookie for first-launch and tip state | design choices | C | settings, home |
| 31 | Benchmarks: everything (24 routes, 5 tables, runner module, HF token in `api_keys.rs`, Inspect deps) | new feature (Round 2) | New feature, in scope by decision 2.3; listed in `benchmarks.md` §7–8 | benchmarks |

Counts: A = 17, B = 10, C = 3, plus the Benchmarks feature.

Backend work the build plan takes without asking: every A row. The B rows go to Brad in one AskUserQuestion before the build plan is finalised; the screens are specified both ways so either answer is buildable.
