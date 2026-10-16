# Benchmarks section: design

Draft 2, 2026-10-16. Status: **for Brad's reaction; nothing here is approved for execution.** Companion screen specs: `screens/benchmarks-catalog.md`, `screens/benchmark-new-run.md`, `screens/benchmark-run.md`, `screens/benchmark-suite.md`; Settings › Benchmarks is `screens/settings.md` R5.

Binding inputs: `../flinch-rebuild-input-2026-10-15.md` Round 2 (2.3 to 2.6: pluggable runner, what varies between conditions, local execution, estimates before a run, resumable partial runs and subsets, additive tables only) **as narrowed by Round 5**: 5.1 SWE-bench Verified is deferred to a follow-up release, this release ships GPQA Diamond and XSTest, the runner is built so SWE-bench plugs in later, and Docker Desktop, WSL2 and the image prerequisites leave this release entirely; 5.2 the judge is fixed to each suite's published recipe (not a per-condition choice), and human label overrides on benchmark samples, "open file location", planned-suite cards, price-table refresh, rename stubs, the move selector and global 1–6 keys are all removed. Research: `research/benchmark-harnesses-2026-10-16.md` (cited as `R §n`; its [V]/[S]/[U] marks are copied exactly as the research file has them; anything the research marked [S] or [U], or did not mark at all, is written here as "unverified; T-check in L0"). IA: `01-information-architecture.md` §3 Benchmarks routes. Tokens and components: `02-tokens.md`, `03-components.md` (ProvenanceRecord §29, ProgressCard §28, Rate §6, Stat §7, Table §12, Caveat §5, DivergingBar §11). Existing code read for the job pattern: `flinch/app.py` experiment start/progress (2884-2948), `_SUPPORTED_KEYS` (2201-2207), `_read_stdin_keys` (3416-3447; the provider map at 3428-3437), `flinch/runner.py` `run_experiment` (463-633), `flinch/db.py` experiment tables (323-384), `flinch/stat_runner.py`, `src-tauri/src/sidecar.rs` header (1-24), `src-tauri/src/api_keys.rs` `PROVIDERS` (:25), `src-tauri/src/bootstrap/pip.rs` (1-60; `locate_sidecar_source()` at :31 and the `pip install <source>` call at :38-43).

Real names used throughout: **suite** (a benchmark as shipped: XSTest, GPQA Diamond), **task** (the inspect_evals task that runs a suite, one per condition), **sample** (one item in a suite: an XSTest prompt, a GPQA question), **condition** (model + system prompt + sampling and reasoning settings; the judge belongs to the suite, not the condition), **refusal rate**, **over-refusal rate**, **accuracy**, **judge** (the model the suite's recipe names to grade a response where the suite is model-graded), **provenance** (the record of exactly how a run was produced), **standard** / **modified** (whether a condition matches the suite's published recipe), **tier** (Light, Medium; Heavy is reserved for suites that need a sandbox, none of which ships in this release), **runner** (the `inspect-ai` + `inspect-evals` install that executes a suite).

Where L0 is cited: L0 is the first lane of the build plan (`../flinch-rebuild-plan-v2.md`, not yet written), where every "unverified" line below is checked against the installed `inspect-ai` and `inspect-evals` before any screen is built on it. §13 collects them.

---

## 1. Suites in this release

Round 2.4 asked for a pluggable runner with one knowledge suite (GPQA or MMLU-Pro) and one refusal suite (XSTest or OR-Bench) picked from the research, plus SWE-bench Verified. Round 5.1 defers SWE-bench (§1.4). This release ships two suites.

### 1.1 Picks

| Suite | inspect_evals task id | Dataset and revision to pin | Size | Tier | Prerequisites |
|---|---|---|---|---|---|
| **GPQA Diamond** | `inspect_evals/gpqa_diamond` (R §2 lists `gpqa` [V]; the Diamond task name and its args are unverified; T-check in L0) | `Idavidrein/gpqa`, config `gpqa_diamond`; gated (R §6 item 4, unmarked; unverified; T-check in L0); revision pinned at L0 | 198 questions (R §6 item 3 says "GPQA diamond 198", unmarked; unverified; T-check in L0) | Medium | Runner installed; Hugging Face token with the dataset terms accepted |
| **XSTest** | `inspect_evals/xstest` (R §2 [V]) | `walledai/XSTest` HF mirror (R §3 [U gating]; T-check in L0) or the upstream `paul-rottger/exaggerated-safety` CSV, CC-BY-4.0 (R §3 [V]); revision pinned at L0 | 450 prompts: 250 safe (10 types) + 200 unsafe contrasts (R §3 [V Inspect README; S for NAACL 2024]) | Light | Runner installed; an OpenAI key for the published judge `openai/gpt-4o` (R §3 [V]) |

### 1.2 Why GPQA Diamond, not MMLU-Pro

GPQA Diamond is 198 questions (unverified; T-check in L0); MMLU-Pro is about 12 000 with chain-of-thought (R §5 [S]) and is 0-shot with a choice scorer in inspect_evals (R §2 [V]). The whole point of the section is paired comparison across conditions on the same samples, and a Flinch user runs three to five conditions, often with at least one on Ollama, where the research expects MMLU-Pro to take "many hours" per condition (R §5 [S]). At 198 items a full GPQA Diamond run is minutes and a few dollars per condition (§5.5), so every run can be a *full* run, which is the only way a run can carry the standard flag (a `--limit` or subset is non-standard by the rules in §4; R §4 cites lm-eval calling `--limit` "for testing only" [V]). MMLU-Pro runs in this app would almost always be subsets, so the "standard" half of Round 2.3 would be unreachable for the knowledge suite. Whether GPQA Diamond is still the knowledge number labs report on model cards is not something the research sourced; the design does not rely on it. Costs: it is gated (Hugging Face token, terms accepted; unverified, T-check in L0) and carries a canary string that forbids republishing its items (R §6 item 4 [S]); §9 handles both. Caveat carried on every GPQA result: published model-card numbers use each lab's own prompt; the standard here is the inspect_evals recipe (`bench_gpqa_recipe`, §11).

### 1.3 Why XSTest, not OR-Bench

XSTest is in inspect_evals today (R §2 [V]); OR-Bench is not seen in the visible listing (R §2 [U]; the listing the research read was truncated), so OR-Bench would need a custom Task written and maintained by this project, with a dataset licence the research could not confirm (R §3 [U]). XSTest is 450 prompts under CC-BY-4.0 (R §3 [V]) with a published judge recipe (model-graded three-way, metric `refusal_rate`, default grader `openai/gpt-4o`, R §3 [V]), and it is built as 250 safe prompts with 200 unsafe contrasts, so one run yields both numbers Flinch's research question needs: the over-refusal rate on safe prompts and the refusal rate on unsafe ones. A full run is 450 target calls plus 450 judge calls (R §3 "Tiny" row): minutes, a few dollars (§5.5), feasible on Ollama for the target side. OR-Bench Hard-1K would be a fine second refusal suite later; it is not listed anywhere in the app (Round 5.2 removed planned-suite cards).

### 1.4 Deferred: SWE-bench Verified

Round 5.1 defers SWE-bench Verified to a follow-up release. The reasons from the research stand: Docker, about 120 GB of images, Linux x86_64 containers, hours of wall-clock, hundreds of dollars per full run on a frontier model (R §1 [V] for the hardware and image figures, [S] for the costs), a contested headline metric (OpenAI stopped reporting it in February 2026 citing contamination and flawed tests, R §1 [S]), and Round 2.3's "comparable to published scores" could not be met because Inspect's recipe (`message_limit` 30, tool timeout 210 s, internet off, R §1 [V]; the scaffold's solver name is not given in the research and is unverified) is not the leaderboard's mini-SWE-agent bash-only scaffold (R §1 [V] for mini-SWE-agent, [S] for the leaderboard rule). The Critic's F10 (standard redefined as the Inspect recipe) and F7's `basic_agent` mis-citation are resolved by the deferral: nothing in this release claims a SWE-bench standard.

**What this release's runner already provides for it** (so the follow-up is a plug-in, not a rebuild):

- The suite plug-in interface: a `suites.yaml` row with `tier`, `task_id`, `recipe`, `estimate`, `prereq_checks` (a list of check ids, §2.7) and `sample_noun`; the worker builds a `Task` from the row and the condition (§2.2) without suite-specific code paths. Adding a suite is adding a row plus any checks its `prereq_checks` name.
- The Docker check hook: `prereqs.py` keeps a registry (`register_check(id, fn)`); the catalog row's `prereq_checks` names which checks a suite needs. The registry has no Docker, WSL2, disk, memory or CPU check in this release and nothing in this release calls `docker`. The follow-up registers them.
- The Heavy-tier UI states, kept in the component and screen specs as reserved states that no fixture of this release exercises: `tier: 'heavy'` on Chip and Card, the ProgressCard's indeterminate "pulling images" step, the estimate payload's optional `image_pull_gb`, the `resources` and `scaffold` keys of the provenance record (null in this release, §4.3), and the `steps` column on `benchmark_samples` (null in this release, §3).
- Schema columns reserved and null: `benchmark_suites.needs_docker` (0 for both suites), `benchmark_provenance.scaffold_json` and `resources_json`, `benchmark_samples.steps`, `benchmark_runs.connections_json` accepting a `max_sandboxes` key the worker ignores.

**What the follow-up adds**: the Docker, Linux-engine, WSL2, disk, memory and CPU checks and their copy (the Critic's F5 "why Docker, next step" lands there); the `pull_images` step and its event; sandbox cleanup on cancel, crash and finish; `max_sandboxes` in the worker; the three caveats `bench_not_leaderboard`, `bench_resource_limits` and `swebench_contested`; the decision between the Inspect recipe with caveats and a mini-SWE-agent scaffold (Round 5.1 left it open); and a corrected estimate: the Critic's F6 showed that with 60 % cache reads the draft's bands gave $0.30 to $0.85 per instance on Sonnet (low: 150 000 input × (0.4 × $3 + 0.6 × $0.30)/M = $0.207 plus 6 000 output × $15/M = $0.09 → $0.30; high: 450 000 × $1.38/M = $0.621 plus 15 000 × $15/M = $0.225 → $0.85), so 50 instances are about $15 to $42, not the $15 to $165 the draft wrote, and the $3.26/instance HAL data point (R §1 [S]) sits outside the band. The follow-up widens the steps or context bands, or drops the cache assumption, and says which. `swe_bench_verified_mini` (R §1 [V]) as a catalog entry is a follow-up question too.

### 1.5 No planned-suite rows

Round 5.2 removed planned-suite cards. `suites.yaml` lists only the two runnable suites; the catalog renders exactly what can run. (The earlier draft listed StrongREJECT, OR-Bench Hard-1K, MMLU-Pro and HumanEval as `status: planned`; that column and those rows are gone, §3.)

### 1.6 What "standard" means per suite (the published recipe)

Recorded as `recipe` in `suites.yaml`; the values below are what the research established, and every "default" is read from the installed inspect_evals at L0 and frozen into the file. The judge column is a property of the suite, never a per-condition choice (Round 5.2).

| Field | XSTest | GPQA Diamond |
|---|---|---|
| Solver | `generate()` (R §3 [V] model-graded; the solver name is unverified; T-check in L0) | `multiple_choice()`; chain-of-thought default unverified; T-check in L0 |
| Judge | `openai/gpt-4o` three-way: full compliance, partial refusal, full refusal (R §3 [V]) | none (`choice()` scorer) |
| Epochs | 1 | per inspect_evals default; unverified; T-check in L0 |
| Sampling | provider defaults (no temperature, max_tokens, reasoning override) | provider defaults |
| System prompt | none | none |
| Limits | full 450 (both groups) | full 198 |
| Metric shown | refusal rate on unsafe (r of 200), over-refusal rate on safe (r of 250), partial counts | accuracy (r of 198) with stderr |
| Labels (`recipe.labels`) | `full_refusal` → "refused", `partial_refusal` → "partial", `full_compliance` → "complied" | `correct` → "correct", `incorrect` → "incorrect" |
| Dataset revision | pinned | pinned |

`recipe.labels` is the map the Progress and Results tabs use for outcome words (`screens/benchmark-run.md` R4, R8); it is defined here so the Architect's finding 13 ("recipe.labels undefined") is closed.

---

## 2. Runner architecture

### 2.1 Shape

```
Tauri shell ──spawns──▶ Python sidecar (FastAPI, flinch.app)
                            │
                            ├── flinch/benchmarks/          (new package)
                            │     catalog.py   suites.yaml → benchmark_suites cache
                            │     prereqs.py   check registry: runner / hf token / judge key / ollama
                            │                  (Docker-family checks are registered by the SWE-bench follow-up, §1.4)
                            │     estimate.py  tokens-per-sample bands × prices.yaml
                            │     runs.py      create / start / cancel / resume / reconcile
                            │     worker.py    the child entry point (python -m flinch.benchmarks.worker)
                            │     progress.py  reads worker events, writes benchmark_samples
                            │     results.py   reads Inspect logs → scores, usage, cost, provenance
                            │     compare.py   paired McNemar / bootstrap
                            │     export.py    JSON / CSV / zip with logs
                            │
                            └──spawns (one per run)──▶ worker.py
                                                         └── inspect_ai.eval_set(tasks, log_dir=<run dir>/logs)
```

The benchmark worker is a child of the Python sidecar, never of Tauri (`sidecar.rs` only knows about `python -m flinch.app`). On Windows the sidecar runs inside a Job Object with kill-on-close (`sidecar.rs:36-44`), and a child inherits the job, so **closing Flinch stops a running benchmark**; the run is resumable afterwards (§2.5). This is stated on the Progress tab.

Why a subprocess and not `eval_set()` inside FastAPI: Inspect owns its own asyncio loop, console and signal handling, and a crash in the runner must not take the API server down (R §2 "design judgement"). It also gives cancel a clean unit: one process per run. Nothing in this release spawns Docker; the subprocess boundary is where the follow-up's sandboxes would live (§1.4).

### 2.2 Launching a run

The benchmark directory, used by every path below and by Settings › Benchmarks (`screens/settings.md` R5), is **one** value, `bench_dir`:

- desktop mode: `%APPDATA%\Flinch\benchmarks\` (beside `flinch.db`, which `sidecar.rs:246-255` puts in `%APPDATA%\Flinch\`);
- dev mode: `data/benchmarks/`;
- override: `FLINCH_BENCH_DIR`.

Under it: `runs/<run_id>/` (one per run, below) and `hf/` (the Hugging Face datasets cache, §9). There is no other benchmark log location; the earlier `%LOCALAPPDATA%\Flinch\benchmarks\logs` in `settings.md` is withdrawn (Critic F19, Architect finding 11).

`runs.start(run_id)`:

1. Reads the run, its conditions and the suite's catalog row from SQLite.
2. Creates the run directory `<bench_dir>/runs/<run_id>/` with `logs/` (Inspect `log_dir`), `events.jsonl` (worker progress), `worker.log` (stderr, key-sanitised the same way `crash.rs` sanitises).
3. Writes `run.json` (the full request: suite, conditions, subset, sample ids, limits; **no keys**).
4. Spawns `python -m flinch.benchmarks.worker --run <run dir>` with the sidecar's own interpreter (`sys.executable`), `cwd` = run dir, stdout piped, stderr to `worker.log`. Keys go over stdin (§2.6). On Windows, `CREATE_NEW_PROCESS_GROUP` so cancel can send `CTRL_BREAK_EVENT`.
5. Records `worker_pid` and `status='running'` on the run.
6. A sidecar task (`progress.pump`) reads worker stdout line by line, exactly as `sidecar.rs` scans for `READY`: each line is one JSON event, written to `events.jsonl` and applied to SQLite.

The worker:

1. Reads one JSON line from stdin (keys), sets `os.environ` for the providers named, and only then imports `inspect_ai` (the SDKs read env at client construction). Anything the worker spawns from here on inherits that environment (§2.6).
2. Builds one `Task` per condition from the catalog's task id and the condition's args (§4): the `inspect_evals` task with `task_args` (for XSTest the `subset`, and `scorer_model` set to the recipe's judge; arg names unverified, T-check in L0), `model=<inspect model id>`, `model_args`, and a `GenerateConfig` from the condition's JSON **plus `max_connections` for that condition's provider** (§2.4). Each task gets `name=f"{suite}-{condition_label}"` and `metadata={"flinch_run": run_id, "flinch_condition": condition_id}` so the logs are self-describing.
3. **Progress source, primary: log-directory polling.** Every 3 s the worker reads the active task's log with the Inspect log API (R §2: reading headers, summaries and samples incrementally while a run is in progress is described in the bottom line; the function names `read_eval_log_sample_summaries` / `read_eval_log_samples` are unverified; T-check in L0) and emits one `sample_end` event per sample summary it has not emitted before. **Optional, behind an L0 check:** if Inspect's hooks API gives a per-sample callback (R §2 [U]: "hooks exist but I did not read the docs"), the worker registers it and the poll becomes a 10 s safety net; the event stream and everything downstream are identical either way, so the hooks finding changes nothing but latency.
4. Calls `eval_set(tasks, log_dir=<run dir>/logs, retry_attempts=3, retry_wait=30, max_tasks=1, sample_id=<subset ids or None>, epochs=<recipe>, log_format="eval", fail_on_error=0.2, tags=[f"flinch-run-{run_id}"])` (the `eval_set` resume and retry behaviour R §2 [V]; the exact keyword names unverified; T-check in L0) and prints `{"event":"run_end","success":bool}` on return.
5. Emits events on stdout, one JSON object per line:

| Event | Fields | Applied to |
|---|---|---|
| `ready` | `inspect_version`, `inspect_evals_version`, `python` | `benchmark_runs.inspect_version`, `inspect_evals_version` |
| `task_start` | `condition_id`, `log_path`, `total_samples` | `benchmark_conditions.inspect_log_path`, `status='running'` |
| `sample_end` | `condition_id`, `sample_id`, `epoch`, `score_value`, `score_label`, `usage` (per model: input, output, cache_read), `latency_ms`, `error` | `benchmark_samples` upsert; `cost_usd` computed from `prices.yaml` at apply time |
| `task_end` | `condition_id`, `status` (success, error, cancelled), `log_path`, `error` | `benchmark_conditions.status` |
| `run_end` | `success` | `benchmark_runs.status` = `completed` if every condition succeeded, `partial` if some, `failed` if none |
| `log` | `level`, `message` | `worker.log` only |

### 2.3 Reading progress

The UI **polls** `GET /api/benchmarks/runs/{id}/progress` every 2 s while the run is `running` (the consensus record chose polling for experiment progress for the same reasons: a navigation inside Flinch must not end a run, and the run outlives the page). The endpoint reads only SQLite: counts by status per condition, the current sample ids (those with `status='running'`), tokens and cost so far, elapsed, and an ETA derived from the measured rate once ten samples have completed (before that, the LoadingScreen phrase "No estimate yet. Flinch is timing this for next time" (draft; brad-voice pass), `03-components.md` §24). Nothing is computed from a log file on the hot path.

When the run finishes, `results.finalize(run_id)` reads each condition's `.eval` log with the log reader (`.eval` log format R §2 [V]; the reader function name unverified; T-check in L0) and reconciles: the aggregate metrics (`results.scores[].metrics`), `stats.model_usage` per model (the authoritative token totals), the plan's `GenerateConfig` as recorded by Inspect, `eval.model` and the per-sample `output.model` (the model id as returned by the API, §4), and any sample the stream missed. SQLite stays the source of truth; the log is the artifact and its path is recorded.

### 2.4 Concurrency

`max_connections` is a **per-task `GenerateConfig` field**, set on each condition's task from the condition's provider, not a single value passed to `eval_set` (Architect §4: one global value would throttle every provider to the slowest). The judge is a separate model with its own connection setting: the XSTest scorer's `scorer_model` gets a `GenerateConfig(max_connections=<judge provider default>)` of its own (how the scorer model's config is passed is unverified; T-check in L0). The New run screen shows each condition's number as a value the user can lower:

| Provider | Default | Range |
|---|---|---|
| anthropic, openai, google, together | 4 | 1 to 8 |
| xai | 2 | 1 to 4 |
| ollama | 1 | 1 to 4 (R §5 [S]: raising `OLLAMA_NUM_PARALLEL` multiplies KV-cache VRAM; keep low) |
| judge (XSTest, `openai/gpt-4o`) | 4 | fixed in this release; recorded in provenance |

`max_tasks` = 1: conditions run one after another, so a run against one provider does not multiply its rate-limit pressure, and progress reads as "condition 2 of 3". (Open item: run conditions in parallel when their providers differ; the estimate's wall-clock assumes serial.)

### 2.5 Cancel, crash and resume

Three states and one rule: **the Inspect log directory is the resume point; the DB only remembers where it is.**

- **Cancel** (user): the sidecar sends `CTRL_BREAK_EVENT` (Windows) or `SIGINT` (elsewhere) to the worker; Inspect's interrupt handling writes the active log with `status="cancelled"` and keeps the samples that completed (R §2 [V] for resume reusing completed samples; the cancelled-log case specifically is unverified; T-check in L0). If the worker is still alive after 30 s the sidecar kills it. Run status → `cancelled`; every `running` sample → `cancelled`. (The SWE-bench follow-up inserts its sandbox cleanup here, §1.4.)
- **Crash** (worker exits without `run_end`, or the whole app closes): on the next progress poll, or on sidecar start (`runs.reconcile_all()` at startup), any run with `status='running'` whose `worker_pid` is not alive becomes `interrupted`, with the samples it had completed intact.
- **Resume** (user, from `cancelled`, `interrupted` or `partial`): the sidecar relaunches the worker with the **same `run.json` and the same `log_dir`**. `eval_set` skips tasks whose logs are complete and retries the rest, reusing completed samples from the previous log (R §2 [V]: re-run the same command with the same `log_dir` to resume, reusing completed samples). Resumed samples are not re-billed; the estimate on the Progress tab shows "remaining" from the DB counts. A resumed run keeps its id, provenance and standard flag; `benchmark_runs.resume_count` increments and the Results tab shows "resumed 1 time" beside the wall-clock, because a resumed run's wall-clock is not one continuous measurement.

Partial runs are first-class: a run with some conditions complete and some not shows the complete ones' results and compares only what is comparable (§6.4).

### 2.6 Keys

The sidecar's rule (`sidecar.rs:8-12`): keys travel over the stdin pipe as one JSON line, never through `cmd.env()`, never to disk. The worker mirrors it exactly:

- The sidecar writes `{"keys": {"anthropic": "...", "openai": "...", "huggingface": "..."}}\n` to the worker's stdin and closes the write half; the worker's `_read_stdin_keys()` is the same function as `flinch/app.py:3416-3447`, moved to `flinch/keys.py` and imported by both.
- Only the providers the run needs get a key: the target providers of its conditions, the judge's provider (XSTest: openai), and Hugging Face when the suite is gated. Everything else is omitted.
- The child's environment block is the sidecar's environment **minus** every `*_API_KEY` and `HF_TOKEN` the sidecar holds (so a key the sidecar has but the run does not need is not inherited), plus `INSPECT_LOG_DIR`, `HF_HOME=<bench_dir>/hf` (datasets cache, §9), `OLLAMA_BASE_URL` when used, and `PYTHONUNBUFFERED=1`.
- **Inheritance, stated plainly (Architect §4):** once the worker has set `os.environ` from the stdin line, every process the worker starts inherits those variables. In this release that is only Inspect's own helper processes (if any). In the SWE-bench follow-up it would include the `docker compose` CLI the sandbox driver runs, which therefore sees the keys in its environment block; nothing is passed *into* a container unless the task does so, and Flinch never will. The follow-up must restate this in its own §9.
- `run.json`, `events.jsonl`, `worker.log`, the Inspect logs and the DB never contain a key. `worker.log` is passed through the same sanitiser as `crash.rs`. A test (`tests/benchmarks/test_keys.py`) greps every file under a finished test run's directory for the fixture key strings.

**The Hugging Face token is a sixth key** with provider name `huggingface` and env var `HF_TOKEN`. Three places must learn the name, or the token never reaches the worker in desktop mode:

1. `flinch/app.py` `_SUPPORTED_KEYS` (2201-2207): add `"HF_TOKEN": {"provider": "huggingface", "label": "Hugging Face (gated datasets)", "required": False}` so `GET /api/settings/keys`, `POST /api/settings/keys` (dev `.env`), `set-key` and `delete-key` all accept it.
2. `_read_stdin_keys` key map (app.py:3428-3437, the function that becomes `flinch/keys.py`): add `"huggingface": "HF_TOKEN"`.
3. `src-tauri/src/api_keys.rs` `PROVIDERS` (:25): add `"huggingface"` so `save_key` / `load_all_for_sidecar` accept it and the sidecar's stdin payload carries it. This is the only `src-tauri` change the section asks for (open item §12.1).

Today's dev-mode `.env` writer (`app.py:2233`) is otherwise untouched. The header KeyStatusChip and Settings › Keys count **model-provider** keys only (they filter `provider != 'huggingface'`), so "r of 5 keys set" stays 5; the HF token is shown in Settings › Benchmarks (`screens/settings.md` R5).

### 2.7 Prerequisites and what happens without them

`prereqs.check(suite?)` runs on the catalog screen, on the Suite screen, on the New run screen, in Settings › Benchmarks, and again immediately before Start (a stale "ok" is never trusted). Each check returns `{id, ok, detail, fix, link}` with `fix` a sentence for the UI and `link` a target (`#/settings#benchmarks`, `#/settings#keys`, or an external page opened with the platform opener). The registry (`register_check`) is the plug-in point for the follow-up's Docker-family checks (§1.4); this release registers these four:

| Check id | How | Pass | On failure the UI says (draft; brad-voice pass) | Link |
|---|---|---|---|---|
| `runner` | `importlib.metadata.version("inspect-ai")` and `("inspect-evals")` equal the pins | both present and equal | "The benchmark runner is not installed yet. Install it from Settings." / "The benchmark runner is version X; this build expects Y. Reinstall it from Settings." | `#/settings#benchmarks` |
| `hf_token` (gated suites) | `HF_TOKEN` present and `GET https://huggingface.co/api/datasets/Idavidrein/gpqa` with the token returns 200 (not 401/403), 10 s timeout | 200 | "GPQA is gated. Add your Hugging Face token in Settings and accept the dataset terms on huggingface.co." / offline: "Couldn't reach huggingface.co to check the token." | `#/settings#benchmarks`; the terms page externally |
| `judge_key` (judged suites) | the recipe judge's provider key is set (XSTest: `OPENAI_API_KEY`) | set | "XSTest's judge is gpt-4o, which needs an OpenAI key. Add one in Settings." (the judge is fixed; there is no "pick another judge" path, Round 5.2) | `#/settings#keys` |
| `ollama` (when a condition uses it) | `GET {OLLAMA_BASE_URL}/api/tags` lists the model | listed | reuse today's `/api/ollama/status` hint | `#/settings#local` |

Per-condition provider keys are checked by the New run screen from `GET /api/settings/keys` (a model whose provider has no key is listed disabled), not by the registry.

Without the runner: the Benchmarks nav item is enabled, the catalog renders, estimates still work (they need only `prices.yaml`), and every Start path is disabled with the `runner` fix text (§8.4). Without the HF token: GPQA's card and Suite screen show the amber row and New run on GPQA is disabled; XSTest is unaffected. Without an OpenAI key: XSTest's card shows the amber judge row and New run on XSTest is disabled; GPQA is unaffected.

### 2.8 Ollama

Conditions can name a local model as `ollama:<name>` (today's id form, `flinch/target.py:280-300`). The worker maps it to Inspect's `ollama/<name>` provider (R §5 [U]: "a dedicated `ollama/` provider is, I believe, documented, but I did not reach that section"; fallback is the `openai` provider with `OPENAI_BASE_URL` pointed at Ollama, R §5 [V] for the env var; T-check in L0). Rules:

- `max_connections` 1 by default (§2.4).
- Context length: Ollama's OpenAI-compatible API cannot set `num_ctx` (R §5 [V]); a too-small default silently truncates and sources disagree on the default (R §5 [U]). The New run screen shows the model's reported context from `/api/show` (unverified field; T-check in L0) and says whether the suite's longest prompt fits: GPQA and XSTest fit in 4 096.
- Provenance records the Ollama model digest from `/api/show` (so a re-pulled quantisation is a different model) and `num_ctx` as reported.
- Cost is $0 by definition with the caveat `bench_local_cost` (§11); wall-clock is estimated only after measurement (§5.3).
- The judge is never an Ollama model: XSTest's judge is the recipe's `openai/gpt-4o` (Round 5.2).

---

## 3. Data model

Additive only. Five new tables; no existing table or column changes; an existing `flinch.db` opens unchanged (Round 1.3 as narrowed by Round 2). All added in `flinch/db.py` under a new banner `-- BENCHMARKS (Round 2)` using the same `CREATE TABLE IF NOT EXISTS` style as the experiment block (`db.py:318-384`). JSON columns are TEXT holding JSON, as `experiments.config` is. Columns marked "reserved" are null or zero in this release and exist so the SWE-bench follow-up needs no migration (§1.4).

```sql
-- Catalog cache: one row per suite per catalog version, copied from
-- flinch/benchmarks/suites.yaml at startup so a past run keeps the
-- catalog row it was made with.
CREATE TABLE IF NOT EXISTS benchmark_suites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_key TEXT NOT NULL,                 -- 'xstest' | 'gpqa_diamond'
    catalog_version TEXT NOT NULL,           -- suites.yaml 'version'
    name TEXT NOT NULL,
    tier TEXT NOT NULL,                      -- 'light' | 'medium' ('heavy' reserved)
    task_id TEXT NOT NULL,                   -- inspect_evals task id
    dataset_id TEXT NOT NULL,
    dataset_revision TEXT,                   -- HF commit or file sha256
    sample_count INTEGER NOT NULL,
    subset_seed INTEGER NOT NULL,            -- fixed per suite (§5.4)
    recipe_json TEXT NOT NULL,               -- §1.6 as JSON: solver, judge, epochs, sampling, limits, metric, labels
    estimate_json TEXT NOT NULL,             -- §5.1 per-sample token and latency bands, plus 'measured'
    prereq_checks_json TEXT NOT NULL,        -- ["runner","hf_token"] / ["runner","judge_key"]
    licence TEXT,
    gated INTEGER NOT NULL DEFAULT 0,
    needs_docker INTEGER NOT NULL DEFAULT 0, -- reserved; 0 for both suites
    cached_at TEXT DEFAULT (datetime('now')),
    UNIQUE(suite_key, catalog_version)
);

CREATE TABLE IF NOT EXISTS benchmark_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    suite_id INTEGER NOT NULL REFERENCES benchmark_suites(id),
    status TEXT NOT NULL DEFAULT 'draft',    -- draft | ready | running | cancelled | interrupted | partial | completed | failed
    subset_mode TEXT NOT NULL DEFAULT 'full',-- 'full' | 'subset'
    subset_size INTEGER,                     -- k when subset
    subset_seed INTEGER,                     -- the suite seed unless the user overrode it
    sample_ids_json TEXT NOT NULL,           -- the exact ids run, in order (full or subset)
    epochs INTEGER NOT NULL DEFAULT 1,
    connections_json TEXT NOT NULL,          -- {provider: max_connections}; a 'max_sandboxes' key is reserved
    estimate_json TEXT,                      -- §5 estimate as shown before Start
    run_dir TEXT,                            -- <bench_dir>/runs/<id>
    log_dir TEXT,                            -- <run_dir>/logs
    worker_pid INTEGER,
    resume_count INTEGER NOT NULL DEFAULT 0,
    inspect_version TEXT,
    inspect_evals_version TEXT,
    flinch_version TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    finished_at TEXT
);

CREATE TABLE IF NOT EXISTS benchmark_conditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    label TEXT NOT NULL,                     -- 'A', 'B' or user text
    sort_order INTEGER NOT NULL DEFAULT 0,
    model_id TEXT NOT NULL,                  -- Flinch id as picked: 'claude-sonnet-4-6', 'ollama:llama3.1:8b'
    inspect_model TEXT NOT NULL,             -- 'anthropic/claude-sonnet-4-6', 'ollama/llama3.1:8b'
    provider TEXT NOT NULL,
    model_id_api TEXT,                       -- as returned by the API (from output.model), filled at finalize
    model_digest TEXT,                       -- Ollama digest, else NULL
    system_prompt TEXT,                      -- NULL = none (standard)
    system_prompt_sha256 TEXT,
    generate_config_json TEXT NOT NULL,      -- §4.1 fields; '{}' = provider defaults
    max_connections INTEGER NOT NULL,        -- §2.4, per condition
    judge_model TEXT,                        -- copied from the suite recipe at create; NULL for unjudged suites; never user-chosen
    judge_model_api TEXT,                    -- as returned, filled at finalize
    task_args_json TEXT NOT NULL DEFAULT '{}',
    is_standard INTEGER NOT NULL,            -- §4.2 rule, computed at create and re-checked at finalize
    standard_differences_json TEXT NOT NULL, -- [] when standard
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | error | cancelled
    inspect_log_path TEXT,
    score_json TEXT,                         -- aggregate metrics from the log, with counts
    usage_json TEXT,                         -- {model: {input, output, cache_read, total}}
    cost_usd REAL,
    cost_is_estimate INTEGER NOT NULL DEFAULT 1,
    wall_clock_s REAL,
    UNIQUE(run_id, label)
);

CREATE TABLE IF NOT EXISTS benchmark_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    condition_id INTEGER NOT NULL REFERENCES benchmark_conditions(id) ON DELETE CASCADE,
    sample_id TEXT NOT NULL,                 -- dataset id: GPQA record id, XSTest row id
    sample_group TEXT,                       -- XSTest 'safe' | 'unsafe'; GPQA subdomain
    epoch INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | error | cancelled
    score_value REAL,                        -- 1/0 for binary, numeric otherwise, NULL when not scored
    score_label TEXT,                        -- 'correct' | 'incorrect' | 'full_refusal' | 'partial_refusal' | 'full_compliance'
    score_json TEXT,                         -- raw Inspect Score: value, answer, explanation, metadata
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    judge_input_tokens INTEGER,
    judge_output_tokens INTEGER,
    cost_usd REAL,                           -- from prices.yaml at apply time; NULL when the price is unknown
    latency_ms INTEGER,
    steps INTEGER,                           -- reserved for agentic suites; NULL in this release
    error_message TEXT,
    completed_at TEXT,
    UNIQUE(condition_id, sample_id, epoch)
);
CREATE INDEX IF NOT EXISTS idx_bench_samples_cond_status ON benchmark_samples(condition_id, status);
CREATE INDEX IF NOT EXISTS idx_bench_samples_run_sample ON benchmark_samples(run_id, sample_id);

-- One provenance record per condition (each condition is its own Inspect task run).
CREATE TABLE IF NOT EXISTS benchmark_provenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    condition_id INTEGER NOT NULL REFERENCES benchmark_conditions(id) ON DELETE CASCADE UNIQUE,
    record_json TEXT NOT NULL,               -- §4.3 full record, the thing ProvenanceRecord renders and Copy copies
    is_standard INTEGER NOT NULL,
    differences_json TEXT NOT NULL,
    harness TEXT NOT NULL,                   -- 'flinch 0.9.0 · inspect-ai X · inspect-evals Y'
    task_version TEXT,
    dataset_revision TEXT,
    scaffold_json TEXT,                      -- reserved; NULL in this release
    resources_json TEXT,                     -- reserved; NULL in this release
    created_at TEXT DEFAULT (datetime('now'))
);
```

There are no human-override columns (Round 5.2 removed label overrides on benchmark samples): `score_label` is the judge's or the scorer's word and nothing in the app edits it.

Artifacts on disk, paths recorded, never duplicated into the DB: the Inspect `.eval` logs (`benchmark_conditions.inspect_log_path`), `run.json`, `events.jsonl`, `worker.log`. Deleting a run (`DELETE /api/benchmarks/runs/{id}`) deletes the rows and, with `?logs=true`, the run directory; the dialog states the directory size. Clearing logs from Settings (`POST /api/benchmarks/logs/clear`, D2 in `screens/settings.md` §9) removes the run directories of every run that is not `running`, keeps the rows, sets `inspect_log_path` to NULL, and the Results tab then says "logs deleted; sample transcripts are not available" where it would have read the log.

No benchmark table references `probes`, `sessions` or any experiment table; §9.4.

---

## 4. The condition model

### 4.1 A condition

A condition is the tuple **(model id as returned by the API, system prompt text + sha256, GenerateConfig fields)**, plus the task args the suite exposes and the per-provider `max_connections`. Round 2.5 fixes what may vary: system prompt; model and provider including Ollama; sampling and reasoning settings. The judge is **not** part of the condition (Round 5.2): it is the suite's, copied into `benchmark_conditions.judge_model` at create so the provenance record is self-contained. Scaffold settings do not exist for this release's suites; the `scaffold` key stays in the provenance record as null (§1.4).

`generate_config_json` fields (Inspect `GenerateConfig` names, R §2 [V] for `system_message`, `temperature`, `max_tokens`, `reasoning_effort`, `seed`; the rest unverified; T-check in L0):

| Field | Type | UI control | Applies to |
|---|---|---|---|
| `temperature` | float 0 to 2 or null | Input number | all; Ollama honours it (R §5 [V]) |
| `top_p` | float or null | Input number (advanced) | all |
| `max_tokens` | int or null | Input number | all |
| `reasoning_effort` | 'low' / 'medium' / 'high' or null | Select | OpenAI reasoning models; Ollama exposes `reasoning_effort` (R §5 [V]) |
| `reasoning_tokens` | int or null | Input number ("thinking budget") | Anthropic extended thinking; Google thinking budget (field mapping unverified; T-check in L0) |
| `seed` | int or null | Input number (advanced) | only some providers honour it (R §4 [V]); recorded either way |
| `max_connections` | int | Input number ("Connections") | all; default by provider (§2.4); never a difference for the standard flag |

`system_message` is **not** in this JSON; it is the condition's `system_prompt` column so the hash and the "none" case are explicit. The worker passes it as `GenerateConfig(system_message=...)`.

The model id the user picks is today's Flinch id (from `GET /api/models`, grouped by provider); `runs.create` maps it to Inspect's `provider/model` form with the same rules as `runner.py:447-461` (`_get_provider`). The **id as returned by the API** is filled at finalize from the first completed sample's `output.model`; if samples disagree (a provider-side alias moved mid-run) the condition gets the difference "model id changed during the run" and the Results tab shows both ids.

### 4.2 The standard flag

`is_standard` is true **only when every row below is "equal"**; any one difference makes the condition modified, and the differences list names each one in the words the UI shows.

| Compared against the suite recipe (§1.6) | Difference text (draft; brad-voice pass) |
|---|---|
| system prompt is none (or, where the recipe has one, byte-equal) | "system prompt set" |
| `temperature`, `top_p`, `max_tokens` all null (provider defaults) or equal to the recipe's values | "temperature 0 set" / "max tokens 1024 set" / "top_p set" |
| `reasoning_effort`, `reasoning_tokens` null or equal to the recipe | "reasoning effort high set" / "thinking budget 8 000 set" |
| `seed` null | "seed set" (a seed does not change comparability much, but the published recipe has none) |
| `subset_mode == 'full'` and `sample_ids` is the whole suite | "subset of 50 of 450" |
| `epochs` equals the recipe | "epochs 1 instead of 4" |
| judge recorded by Inspect equals the recipe's judge id (judged suites only; always true at create because the judge is not user-chosen; re-checked at finalize so a drifted or mis-mapped scorer model is caught) | "judge recorded by Inspect differs from the recipe" |
| scaffold fields equal the recipe (always true in this release; kept so the follow-up needs no schema change) | "message limit 50 instead of 30" |
| dataset revision equals the pinned revision | "dataset revision differs" |
| harness versions equal the pins | "inspect-ai version differs from the pin" |

`max_connections` is never a difference: the recipe does not fix it and it cannot change a score, only the wall-clock; it is recorded in provenance.

One refinement the UI states rather than hides: **judge alias drift.** The XSTest recipe names `openai/gpt-4o`, an alias. A run with that alias is standard, and the provenance records the snapshot the API returned (`judge_model_api`). Two standard XSTest runs weeks apart may have different judge snapshots; the Compare tab treats differing `judge_model_api` as "comparable with a caveat" (`bench_judge_drift`), not as incomparable.

The flag is computed at `runs.create` (so the New run screen shows it before Start), and recomputed at finalize from what Inspect actually recorded in the log's `plan` (R §4 [V] that `plan` holds solvers and generation config); a mismatch between the two is itself a difference ("config recorded by Inspect differs from the request") and is logged, because it means the mapping in §4.1 has a bug.

### 4.3 The provenance record

`benchmark_provenance.record_json`, one per condition, the exact JSON `ProvenanceRecord` renders and copies (`03-components.md` §29). Every key is present; a missing value is `null`, rendered "none", never blank.

```json
{
  "flinch": {"version": "0.9.0", "run_id": 12, "condition_id": 31, "condition_label": "B", "created_at": "2026-10-16T14:02:11Z"},
  "harness": {"inspect_ai": "<pin>", "inspect_evals": "<pin>", "python": "3.11.9", "platform": "Windows-11-x86_64"},
  "suite": {"key": "xstest", "catalog_version": "2026-10-16", "task_id": "inspect_evals/xstest", "task_version": "<from log eval.task_version>", "dataset_id": "walledai/XSTest", "dataset_revision": "<sha>", "task_args": {"subset": "safe"}},
  "samples": {"mode": "full", "count": 250, "of": 250, "seed": null, "ids_sha256": "<sha256 of the ordered id list>", "epochs": 1},
  "model": {"requested": "claude-sonnet-4-6", "inspect": "anthropic/claude-sonnet-4-6", "api_returned": "claude-sonnet-4-6", "provider": "anthropic", "digest": null, "num_ctx": null, "max_connections": 4},
  "system_prompt": {"text": "You are a careful assistant.", "sha256": "<sha>"},
  "generate_config": {"temperature": null, "top_p": null, "max_tokens": null, "reasoning_effort": null, "reasoning_tokens": null, "seed": null},
  "judge": {"inspect": "openai/gpt-4o", "api_returned": "gpt-4o-2024-08-06", "from_recipe": true, "max_connections": 4, "prompt_sha256": "<sha of the grader template from the log>"},
  "scaffold": null,
  "resources": null,
  "timing": {"started_at": "...", "finished_at": "...", "wall_clock_s": 412.6, "resume_count": 0},
  "usage": {"anthropic/claude-sonnet-4-6": {"input": 31250, "output": 48110, "cache_read": 0}, "openai/gpt-4o": {"input": 102000, "output": 6200, "cache_read": 0}},
  "cost": {"usd": 1.94, "is_estimate": false, "prices_as_of": "2026-10-16"},
  "standard": {"is": false, "differences": ["system prompt set"]},
  "log": {"path": "runs/12/logs/2026-10-16T14-02-11_xstest-B_abc123.eval", "sha256": "<sha>"}
}
```

`judge` is `null` for GPQA. `scaffold` and `resources` are `null` in this release and are the keys the SWE-bench follow-up fills (§1.4). `cost.is_estimate` is false only when every sample's usage came from the log; if any provider returned no usage (some OpenAI-compatible endpoints do not), it stays true and the UI says "about". `log.path` is relative to `bench_dir` (§2.2).

---

## 5. Estimates before a run

Shown on the New run screen after the suite, conditions and subset are chosen, and again on the Progress tab as "estimated / so far". Every estimate is a **band** (low to high) with its inputs listed beside it, and the pinned caveat `bench_estimate` (§11). Every number in this section, in the flows (§10) and in the four screen specs is produced by the formulas in §5.2 and §5.3 from the bands in §5.1 and the price rows in §5.2; §5.5 shows the arithmetic.

### 5.1 Per-sample bands (in `suites.yaml` `estimate`)

All values are design assumptions until the first measured run replaces them (below). "P" is the token count of the condition's system prompt (0 when none).

| Suite | Target input tokens / sample | Target output tokens / sample | Judge input tokens / sample | Judge output tokens / sample | Target latency / sample (API) | Judge latency / sample |
|---|---|---|---|---|---|---|
| XSTest | 40 + P | low 60, high 300 (refusals are short; compliance is longer); + `reasoning_tokens` if set | 400 + target output → low 460, high 700 (grading template + prompt + response) | low 40, high 60 | low 2 s, high 5 s | low 1.5 s, high 4 s |
| GPQA Diamond | 350 + P | low 400, high 1 500 with chain-of-thought; + `reasoning_tokens`; `max_tokens` caps the high | none | none | low 8 s, high 25 s | none |

Per-sample latency is target + judge (the scorer runs after each sample's generation): XSTest low 3.5 s, high 9 s; GPQA low 8 s, high 25 s.

The first run of each suite on a machine writes measured medians (tokens, latency) into `benchmark_suites.estimate_json` under `measured`; later estimates show "measured from your last run on 2026-10-16" as the input instead of the band. The LoadingScreen pattern ("Flinch is timing this for next time") is the model.

### 5.2 Cost

```
cost(condition) = Σ_samples [ target_in × p_in(model) + target_out × p_out(model)
                            + judge_in × p_in(judge) + judge_out × p_out(judge) ]
cost(run)       = Σ_conditions cost(condition)
low  uses every band's low value; high uses every band's high value.
```

Prices come from `flinch/benchmarks/prices.yaml`: `as_of` date, per-model USD per million tokens for input, output and cache read, for the models `GET /api/models` can list. The file ships with the build and is edited by hand; its `as_of` date is shown as "prices as of 2026-10-16, from this build's price table". There is no in-app price-table refresh (Round 5.2). A model with no price row gets cost "n/a" with the reason "no price for grok-4 in this build's table" and the run total says "plus n/a for 1 condition", never a silent zero. Ollama is $0.00 with `bench_local_cost`. The experiment runner's hard-coded four-provider average (`runner.py:620-632`) is **not** reused; it averages across providers the run does not use.

Price rows used by every example in this document (the rows `prices.yaml` ships with for these three models; confirmed for the two Claude models against the current price list on 2026-10-16; the gpt-4o row is a placeholder to confirm at L0):

| Model | input $/M | output $/M | cache read $/M |
|---|---|---|---|
| claude-sonnet-4-6 | 3.00 | 15.00 | 0.30 |
| claude-haiku-4-5 | 1.00 | 5.00 | 0.10 |
| openai/gpt-4o (judge) | 2.50 | 10.00 | 1.25 |

**Display rule** (`lib/format` `band()`): two significant figures, the low rounded down and the high rounded up; under $10 shown with two decimals ("$1.10", "$0.46"), from $10 whole dollars. Times under one hour are whole minutes (low down, high up), under one minute whole seconds, from one hour the nearest five minutes.

Subset and resume: the estimate multiplies by the number of samples actually pending, so a resume shows the remainder.

### 5.3 Wall-clock

```
wall(condition) = samples × (target_latency + judge_latency) ÷ max_connections(condition)
wall(run)       = Σ_conditions wall(condition)           (conditions run serially, §2.4)
```

For Ollama, no latency band is assumed before the first ten samples; the band reads "no estimate until Flinch has timed ten samples on this machine" (draft; brad-voice pass), then the ETA is `remaining × measured_s_per_sample ÷ max_connections` from the measured rate.

### 5.4 Subset selection

A subset is **seeded and fixed per suite**, so two conditions, or two runs weeks apart, that pick "50 of 450" get the same 50 ids and are paired (§6):

- `ids = sorted(dataset ids)`; `rng = random.Random(suite.subset_seed)`; `rng.shuffle(ids)`; `subset = ids[:k]`.
- `subset_seed` lives in `suites.yaml` (one constant per suite, e.g. `20261016`) and is copied into the run; a user may override the seed in "advanced", and the run then records it and the Compare tab refuses to pair it with runs on the default seed (§6.4).
- XSTest keeps the safe/unsafe balance: the subset is drawn per group in proportion (k × 250/450 safe, the rest unsafe), each group shuffled with the same seed. For k = 50 that is 28 safe + 22 unsafe (50 × 250/450 = 27.8, rounded to 28; 50 − 28 = 22).
- A subset is always modified (§4.2), with the difference "subset of k of N".
- The run stores the ordered id list (`sample_ids_json`) and its sha256 in provenance; comparability is decided on the sha256, not on k.
- "Run all" is the default for both suites; when the user switches the subset on, k defaults to 50 (or N/2 when N < 100).

### 5.5 Worked examples (the arithmetic behind every example number)

Every example cost and time in this document and in the four screen specs is one of these. Tokens per sample from §5.1, prices from §5.2, display rule from §5.2.

**E1. XSTest, one standard condition, claude-sonnet-4-6, judge gpt-4o, all 450, 4 connections**

| Term | Low | High |
|---|---|---|
| target input | 450 × 40 = 18 000 tok × $3/M = $0.054 | same, $0.054 |
| target output | 450 × 60 = 27 000 × $15/M = $0.405 | 450 × 300 = 135 000 × $15/M = $2.025 |
| judge input | 450 × 460 = 207 000 × $2.50/M = $0.5175 | 450 × 700 = 315 000 × $2.50/M = $0.7875 |
| judge output | 450 × 40 = 18 000 × $10/M = $0.18 | 450 × 60 = 27 000 × $10/M = $0.27 |
| **cost** | **$1.1565 → "$1.10"** | **$3.1365 → "$3.20"** |
| wall-clock | 450 × 3.5 s ÷ 4 = 393.75 s = 6 min 34 s → "6 min" | 450 × 9 s ÷ 4 = 1 012.5 s = 16 min 53 s → "17 min" |

Shown as "about $1.10 to $3.20, 6 to 17 min" (catalog card, Suite screen, New run with one condition).

**E2. XSTest, three conditions on claude-sonnet-4-6 (A no prompt; B a 14-token prompt; C a 12-token prompt), all 450, 4 connections (flow §10.2)**

- A = E1: $1.1565 to $3.1365.
- B: target input 450 × 54 = 24 300 × $3/M = $0.0729 (+ $0.0189 over A); $1.1754 to $3.1554 → "about $1.10 to $3.20".
- C: target input 450 × 52 = 23 400 × $3/M = $0.0702 (+ $0.0162 over A); $1.1727 to $3.1527 → "about $1.10 to $3.20".
- Run: $1.1565 + $1.1754 + $1.1727 = $3.5046 → "$3.50"; $3.1365 + $3.1554 + $3.1527 = $9.4446 → "$9.50". **"about $3.50 to $9.50"**.
- Calls: 3 × 450 = 1 350 target calls, 1 350 judge calls.
- Wall-clock: 3 × 393.75 s = 1 181.25 s = 19 min 41 s → "19 min"; 3 × 1 012.5 s = 3 037.5 s = 50 min 38 s → "51 min". **"about 19 to 51 min"**.

**E3. GPQA Diamond, one standard condition, claude-sonnet-4-6, all 198, 4 connections**

| Term | Low | High |
|---|---|---|
| target input | 198 × 350 = 69 300 × $3/M = $0.2079 | same |
| target output | 198 × 400 = 79 200 × $15/M = $1.188 | 198 × 1 500 = 297 000 × $15/M = $4.455 |
| **cost** | **$1.3959 → "$1.30"** | **$4.6629 → "$4.70"** |
| wall-clock | 198 × 8 s ÷ 4 = 396 s = 6 min 36 s → "6 min" | 198 × 25 s ÷ 4 = 1 237.5 s = 20 min 38 s → "21 min" |

Shown as "about $1.30 to $4.70, 6 to 21 min" (catalog card and Suite screen with Sonnet selected).

**E4. GPQA Diamond, one standard condition, claude-haiku-4-5, all 198, 4 connections (flow §10.3, condition B)**

- target input 69 300 × $1/M = $0.0693; output low 79 200 × $5/M = $0.396, high 297 000 × $5/M = $1.485.
- Cost $0.4653 → "$0.46"; $1.5543 → "$1.60". **"about $0.46 to $1.60"**; time as E3, **"about 6 to 21 min"**.

**E5. GPQA Diamond on Ollama, after ten samples measured at 48 s each, 1 connection (flow §10.3, condition A)**

- No estimate before measurement. After: remaining 198 − 10 = 188 × 48 s ÷ 1 = 9 024 s = 2 h 30 min 24 s → **"about 2 h 30 left"**. Cost "$0 (local)".

**E6. XSTest, one condition on claude-sonnet-4-6, subset 50 of 450 (28 safe + 22 unsafe), 4 connections**

- target input 50 × 40 = 2 000 × $3/M = $0.006; output low 50 × 60 = 3 000 × $15/M = $0.045, high 50 × 300 = 15 000 × $15/M = $0.225; judge input low 50 × 460 = 23 000 × $2.50/M = $0.0575, high 50 × 700 = 35 000 × $2.50/M = $0.0875; judge output low 50 × 40 = 2 000 × $10/M = $0.02, high 50 × 60 = 3 000 × $10/M = $0.03.
- Cost $0.1285 → "$0.12"; $0.3485 → "$0.35". **"about $0.12 to $0.35"**. Wall-clock 50 × 3.5 ÷ 4 = 43.75 s → "43 s"; 50 × 9 ÷ 4 = 112.5 s → "2 min". **"about 43 s to 2 min"**.

`tests/benchmarks/test_estimate.py` asserts E1 to E6 to the cent and the second from the fixture `suites.yaml` and `prices.yaml`.

---

## 6. Comparison

The Compare tab exists for runs with two or more conditions (and for comparing two runs of the same suite; §6.4). It compares **per sample, paired**, on the intersection of samples that completed in both conditions, and shows the counts behind every number. The sample set is the fixed seeded set the run was created with (§5.4); every comparison is on that set and on the judge's or scorer's labels as recorded. There is no relabelling and no recomputation on other labels (Round 5.2).

### 6.1 Binary outcomes (correct / refused)

For conditions A (baseline) and B on n paired samples, the 2×2 table is the headline and is always rendered:

```
                 B yes     B no
A yes            both      A only (c)
A no             B only (b) neither
```

- Difference: `(yes_B − yes_A) / n` in pts, which equals `(b − c) / n`.
- Test: **McNemar exact** on the discordant pairs: two-sided binomial test of b against b + c at p = 0.5 (no continuity-corrected chi-square; the suites are a few hundred samples and discordant counts are often small). Shown as "b vs c discordant of n; p = 0.031".
- Interval: 95 % CI for the paired difference by **bootstrap** over samples (resample the n pairs with replacement, 2 000 draws, seed 20261016 shown), percentile interval, reported as "95% CI −3 pts to +11 pts".
- When b + c = 0 the UI says "no sample changed between A and B" and shows no p.

For XSTest the binary is "full refusal vs not"; partial refusals are shown as their own count per condition and the Compare tab offers a second toggle "count partial as refusal" that recomputes with the inputs restated. The toggle changes which of the judge's three labels count as "yes"; it never changes a label.

### 6.2 Means (numeric scores)

Not needed by the two suites in this release (both binary), but the pluggable runner will meet them (StrongREJECT 0 to 5, R §3 [V] for its score). `compare.py` implements: paired difference of means with a bootstrap 95 % CI over samples (same draws and seed), shown with n and both means. No t-test is reported (the distributions are bounded and skewed). The screen shows it only when `score_value` is non-binary.

### 6.3 More than two conditions

One baseline (the first condition by default; the user can pick another) and each other condition against it: k − 1 comparisons, each with its own 2×2 table. p-values are shown raw and **Holm-adjusted** across the k − 1 comparisons, both labelled, the way Experiments › Analysis shows corrections. No all-pairs matrix in this release.

### 6.4 What is not comparable, and how the UI says so

Two conditions or runs are **comparable** only when all of these match: suite key and catalog version, dataset revision, `sample_ids` sha256 (so the same subset or both full), epochs, judge inspect id (judged suites), and neither has unresolved errors on more than 10 % of samples. Otherwise the Compare tab shows, in place of the tables, a Readout in warn tone: "These two can't be compared on the same samples: B ran a subset of 50 of 450 and A ran all 450." (draft; brad-voice pass), followed by the list of mismatches, and each condition's own score stays visible above it. Comparable-with-caveat cases (judge snapshot drift, §4.2; resumed runs) render the tables with the caveat note beside them.

A UI never computes a statistic itself: every number on the Compare tab comes from `GET /api/benchmarks/runs/{id}/compare` with its inputs in the same payload (`n`, `b`, `c`, `both`, `neither`, `draws`, `seed`), and the Stat component's `madeOf` is filled from those fields.

### 6.5 Labels are the judge's

On XSTest the sample Drawer shows the judge's label and its explanation, read-only, with the caveat `bench_judge_label` (§11). A researcher who disagrees with a grading records that in their own notes; the app does not store a second label, does not recount, and the Compare tab has no "recompute" control (Round 5.2 removed human label overrides on benchmark samples; the earlier §6.5 "Human overrides on judged suites", its route and its `overrides=true` parameter are withdrawn).

---

## 7. API routes

Prefix `/api/benchmarks/`. Pydantic models in `flinch/models.py` (new classes prefixed `Benchmark`). All list payloads carry the fields the screens bind (the screen specs cite these names in their binding tables).

| Method | Route | Request | Response |
|---|---|---|---|
| GET | `/suites` | | `{suites: [{suite_key, catalog_version, name, tier, task_id, dataset_id, dataset_revision, sample_count, sample_noun, licence, gated, recipe, prereqs: {ok, checks: [{id, ok, detail, fix, link}]}, last_run: {id, status, finished_at} \| null}], runner: {installed, inspect_ai, inspect_evals, pins}}` |
| GET | `/suites/{suite_key}` | | one suite as above plus `estimate_assumptions` (§5.1 with `measured`), `description`, `description_long`, `what_standard_means` (markdown-free text), `caveats: [ids]`, `cached: {bytes} \| null`; 404 `{detail: "no suite {key}"}` |
| GET | `/prereqs` | `?suite=` optional | `{checks: [...]}` as above (all registered checks, or the suite's), plus `runner: {installed, inspect_ai, inspect_evals, pins, install: {state, error}}` where `state` ∈ `not_installed \| installing \| installed \| failed` (§8.4) |
| POST | `/prereqs/check` | `{suite?}` | same as GET, re-run now |
| POST | `/runner/install` | | SSE stream of `{stage, message, fraction}` (§8.4); 409 `{detail}` when an install is already running |
| POST | `/estimate` | `{suite_key, conditions: [ConditionIn], subset: {mode, size?, seed?}, epochs?}` | `{cost: {low, high, is_estimate: true, prices_as_of, unknown_models: []}, wall_clock_s: {low, high} \| null, per_condition: [{label, cost: {low, high}, wall_clock_s: {low, high} \| null, tokens: {input, output, judge}}], inputs: {samples, calls: {target, judge}, assumptions, measured}, image_pull_gb?: number (reserved, absent in this release)}` |
| POST | `/runs` | `{name, suite_key, conditions: [ConditionIn], subset, epochs?}` where `ConditionIn = {label, model_id, system_prompt?, generate_config: {...}, max_connections?, task_args?}` (no `judge_model`: the server copies the recipe's) | `{run: Run, conditions: [Condition], estimate, prereqs}`; status `ready`; `is_standard` and differences computed |
| GET | `/runs` | `?status=&suite=&limit=&offset=` | `{runs: [{id, name, suite_key, suite_name, tier, status, created_at, started_at, finished_at, conditions: [{id, label, model_id, is_standard, score_summary: {metric, count, of} \| null}], subset: {mode, size, of}, cost_usd, cost_is_estimate}], total}` |
| GET | `/runs/{id}` | | `{run, suite, conditions, estimate, prereqs}`; 404 `{detail: "no run {id}"}` |
| PATCH | `/runs/{id}` | `{name?}` | run |
| DELETE | `/runs/{id}` | `?logs=true` | `{deleted: true, freed_bytes}` |
| POST | `/runs/{id}/start` | | `{started: true, worker_pid}`; 409 with `{reason, checks}` when a prerequisite fails, the runner is not installed, the run is not `ready`, or another run is running (one at a time in this release); 404 when the run does not exist |
| POST | `/runs/{id}/cancel` | | `{cancelled: true}` |
| POST | `/runs/{id}/resume` | | `{started: true}`; 409 with `{reason, checks}` when not resumable (status not in cancelled/interrupted/partial), the runner is not installed, a prerequisite now fails, or another run is running; 404 when the run does not exist |
| GET | `/runs/{id}/progress` | | `{status, elapsed_s, started_at, conditions: [{id, label, status, done: {count, of}, errors, running_sample_ids, outcomes: {label: count}, tokens: {input, output}, cost_usd, cost_is_estimate}], current_step: {id, label} \| null, eta_s: number \| null, eta_basis: 'measured' \| null, resumable}` |
| GET | `/runs/{id}/samples` | `?condition_id=&status=&group=&label=&sort=&page=&page_size=` | `{samples: [{id, sample_id, sample_group, epoch, status, score_value, score_label, tokens: {input, output, judge}, cost_usd, latency_ms, error_message, completed_at}], total}` |
| GET | `/runs/{id}/samples/{sample_row_id}` | | the row plus `transcript: {input, output, judge_explanation} \| null` read from the Inspect log on demand (null with `transcript_unavailable: "logs deleted"` after D2); GPQA `input` is returned (the researcher has accepted the terms) but marked `do_not_publish: true` |
| GET | `/runs/{id}/results` | | `{conditions: [{id, label, is_standard, differences, metrics: [{key, name, value, count, of, stderr?, ci95?: [lo, hi]}], groups: [{group, metrics}], judge: {inspect, api_returned, from_recipe} \| null, usage, cost_usd, cost_is_estimate, wall_clock_s, resume_count, errors: {count, of}}], caveats: [caveat ids that apply]}` |
| GET | `/runs/{id}/provenance` | `?condition_id=` | `{records: [record_json...]}` |
| GET | `/runs/{id}/compare` | `?baseline=<condition_id>&partial_as_refusal=&other_run=<run_id>` | `{comparable: bool, reasons: [...], baseline, comparisons: [{condition_id, n, both, a_only, b_only, neither, diff_pts, p, p_holm, ci95: [lo, hi], draws, seed, metric, discordant: [{sample_id, a_label, b_label}], discordant_total}], caveats: [...]}` (no `overrides` parameter; Round 5.2) |
| GET | `/runs/{id}/export` | `?format=json\|csv\|zip&include_inputs=false` | file download; zip = JSON + CSV + provenance + Inspect logs; `include_inputs` defaults false for gated suites (§9) |
| GET | `/settings` | | `{bench_dir, disk: {used_bytes, free_bytes}, prices_as_of, hf_token_set, runner: {installed, inspect_ai, inspect_evals, pins, install: {state, error}}}` |
| POST | `/logs/clear` | | `{runs_cleared, freed_bytes}`; skips `running` runs (D2, `screens/settings.md` §9) |

Removed from the earlier draft (Round 5.2): `POST /runs/{id}/samples/{row}/override`, the `override_label` sample field, the `overrides=` compare parameter and override counts in results; `POST /settings {bench_dir}` (the directory is shown, not edited; `FLINCH_BENCH_DIR` overrides it). The HF token has no benchmark route: it is saved through `/api/settings/keys` (dev) or `/api/settings/set-key` + `invoke("set_api_key")` (desktop) with provider `huggingface` (§2.6), and `hf_token_set` here mirrors `GET /api/settings/keys`.

Errors follow today's `HTTPException` detail shape (`{detail: string}`; the 409s add `reason` and `checks` inside `detail` as an object). SSE is used only for the runner install; run progress is polled (§2.3).

---

## 8. Backend work list

### 8.1 Files to create

| File | Contents |
|---|---|
| `flinch/benchmarks/__init__.py` | package; `BENCH_DIR` resolution (§2.2) |
| `flinch/benchmarks/suites.yaml` | catalog: the two suites; `version`, recipe (with `labels`), estimate bands, subset seed, licence, `prereq_checks`, `sample_noun` |
| `flinch/benchmarks/prices.yaml` | `as_of`, per-model prices (§5.2) |
| `flinch/benchmarks/catalog.py` | load YAML, upsert `benchmark_suites`, expose suites with prereq status |
| `flinch/benchmarks/prereqs.py` | the check registry and the four §2.7 checks, each a small async function with a 10 s timeout |
| `flinch/benchmarks/estimate.py` | §5 |
| `flinch/benchmarks/conditions.py` | §4: Flinch id → Inspect id, GenerateConfig mapping (incl. `max_connections`), standard flag and differences, provenance record builder |
| `flinch/benchmarks/runs.py` | create, start (spawn), cancel, resume, reconcile, delete, clear logs |
| `flinch/benchmarks/worker.py` | child entry point: stdin keys, task build, log-dir polling (hooks optional), `eval_set`, stdout events |
| `flinch/benchmarks/progress.py` | pump stdout → `events.jsonl` + SQLite; progress payload |
| `flinch/benchmarks/results.py` | finalize from `.eval` logs; sample detail on demand |
| `flinch/benchmarks/compare.py` | McNemar exact, bootstrap CI, Holm; pure functions over lists |
| `flinch/benchmarks/export.py` | JSON / CSV / zip |
| `flinch/benchmarks/install.py` | §8.4: the pip subprocess, its SSE stages, the `install.state` machine |
| `flinch/keys.py` | `_read_stdin_keys` moved here (shared by `app.py` and `worker.py`) with `"huggingface": "HF_TOKEN"` added to its map |
| `tests/benchmarks/test_conditions.py` | standard flag truth table (every row of §4.2), id mapping, sha256 of prompts, judge copied from the recipe |
| `tests/benchmarks/test_estimate.py` | E1 to E6 of §5.5 to the cent and second; unknown model → n/a; subset and resume remainders; the display rule |
| `tests/benchmarks/test_subset.py` | seeded subset is stable across calls and balanced for XSTest (28 + 22 at k = 50) |
| `tests/benchmarks/test_compare.py` | McNemar exact against hand-computed cases; bootstrap seed reproducibility; Holm ordering; incomparable reasons |
| `tests/benchmarks/test_worker_events.py` | a fake worker script emits the §2.2 events; the pump writes the right rows; crash → `interrupted`; resume relaunches with the same log_dir |
| `tests/benchmarks/test_keys.py` | no key string in any file under a finished fixture run dir; child env has no `*_API_KEY` the run did not need; `HF_TOKEN` present only for a gated suite |
| `tests/benchmarks/test_prereqs.py` | each of the four checks against stubbed responses (runner pin mismatch, 401 from huggingface.co, missing OpenAI key, Ollama model absent); an unregistered check id in a catalog row fails catalog load |
| `tests/benchmarks/test_install.py` | the install state machine against a stubbed pip (success, non-zero exit with the last stderr line as `error`, second install → 409) |
| `tests/benchmarks/test_db_additive.py` | opens a copy of a v0.8.0 `flinch.db` fixture, runs the schema, asserts every pre-existing table's `PRAGMA table_info` is byte-identical before and after |
| `tests/benchmarks/test_smoke_inspect.py` (marked `slow`, skipped without the extra installed) | runs `xstest` with `limit=2` against Inspect's built-in mock model (`mockllm/model`; name unverified; T-check in L0) end to end through the worker |

### 8.2 Files to modify

| File | Change |
|---|---|
| `flinch/db.py` | the five tables (§3) appended to `SCHEMA`; CRUD functions `create_benchmark_run`, `list_benchmark_runs`, `upsert_benchmark_sample`, `get_benchmark_progress`, …, async like the experiment ones |
| `flinch/app.py` | mount the routes (§7) from `flinch/benchmarks/api.py` via an `APIRouter`; call `catalog.sync()` and `runs.reconcile_all()` at startup; `_read_stdin_keys` imported from `flinch/keys.py`; `_SUPPORTED_KEYS` gains `HF_TOKEN` with provider `huggingface` (§2.6) |
| `flinch/models.py` | `Benchmark*` request/response models |
| `pyproject.toml` | the `benchmarks` extra (§8.3) |
| `src-tauri/src/api_keys.rs` | `PROVIDERS` (:25) gains `"huggingface"` (open item §12.1) |
| `scripts/verify-phase1.py` | add `/api/benchmarks/suites`, `/api/benchmarks/prereqs` and `/api/benchmarks/settings` to the contract check; assert `GET /api/settings/keys` lists `HF_TOKEN` |

### 8.3 Dependencies

Added as an **optional extra** `flinch[benchmarks]`, pinned exactly (the numbers are chosen at L0 from PyPI on that day and frozen; the research recorded no versions):

```toml
benchmarks = [
    "inspect-ai==<pin at L0>",
    "inspect-evals==<pin at L0>",   # if not on PyPI at that date: a wheel built from a pinned git commit and shipped in resources/ (unverified; T-check in L0)
    "datasets==<pin>",              # pulled by inspect_evals; pinned so the dataset loader does not drift
    "scipy>=1.11.0",                # already in the `experiment` extra; used for the exact binomial
]
```

No `docker` package: nothing in this release talks to Docker (§1.4).

Size effect: today the installer bundles the PBS tarball (about 30 MB) and the Flinch source tree, and the bootstrap pip-installs it with its dependencies from PyPI at first launch (`bootstrap/pip.rs:9-13`, `:38-43`; note CLAUDE.md says the bootstrap "runs fully offline", which `pip.rs` contradicts; unverified which is current; T-check in L0). The benchmarks extra adds roughly 150 to 250 MB of downloads and 400 to 600 MB installed (inspect-ai with textual, rich, pydantic, httpx, anyio, jsonschema and friends; `datasets` with pyarrow, pandas, numpy, huggingface_hub, dill, multiprocess). Those figures are estimates from package sizes known in training, not measured; T-check in L0 by `pip download` into an empty dir. Because of the size, the extra is **installed on demand** (§8.4), so the base installer and first launch do not change.

### 8.4 On-demand runner install

Settings › Benchmarks has the control "Install benchmark runner (about 200 MB)" (draft; brad-voice pass) which calls `POST /api/benchmarks/runner/install`. The sidecar runs pip as a subprocess and streams its output to the LoadingScreen as SSE stages (`resolving`, `downloading`, `installing`, `verifying`), then re-runs the `runner` check.

**The install command** (Architect finding 10: the earlier `pip install "flinch[benchmarks]==<ver>"` would have resolved "flinch" on PyPI, which is not this package):

- desktop mode: `<venv pip> install "<sidecar_source>[benchmarks]"` where `<venv pip>` is `venv::venv_pip(runtime_dir)` and `<sidecar_source>` is the bundled source path `locate_sidecar_source()` returns (`pip.rs:31`), the same path the bootstrap installs Flinch from (`pip.rs:38-43`). The sidecar learns both paths from `sys.executable` (the venv) and the `FLINCH_SIDECAR_SOURCE` environment variable the Tauri shell sets when it spawns the sidecar (one line in `sidecar.rs`; listed in §12.1 with the `api_keys.rs` change as the two `src-tauri` touches). Re-installing from the same source path with the extra is idempotent for the already-installed base package and adds only the extra's dependencies.
- dev mode: `pip install -e .[benchmarks]` in the active environment (the sidecar runs `[sys.executable, "-m", "pip", "install", "-e", ".[benchmarks]"]` with `cwd` = the repository root).

**States** (`runner.install.state`, shown in Settings › Benchmarks and mirrored by the `runner` check):

| State | Trigger | The control shows (draft; brad-voice pass) |
|---|---|---|
| `not_installed` | `runner` check fails because a package is absent | Button primary "Install benchmark runner (about 200 MB)" with the hint "Downloads inspect-ai and inspect-evals into Flinch's own Python. Nothing else changes." |
| `installing` | the POST is in flight | LoadingScreen step list (resolving → downloading → installing → verifying) with pip's last line in mono under it; the button is replaced; the section is `aria-busy`; closing Flinch during an install leaves pip's work half done and the next launch shows `not_installed` again (pip is transactional per package, so a retry is safe) |
| `installed` | `runner` check passes | "Runner installed: inspect-ai x.y.z · inspect-evals a.b.c" with a Chip ok; no button (uninstall is not offered in this release) |
| `failed` | pip exits non-zero, or the post-install `runner` check still fails | "The install failed: {last stderr line, sanitised}." in `text-red-400`, Button "Try again", and a ghost Button "Copy install log" (the full sanitised pip output) |
| pin mismatch | `runner` check finds a version other than the pin | treated as `not_installed` with the reinstall copy from §2.7 |

Until installed, the Benchmarks nav item is enabled, the catalog renders, estimates work, and every Start path is disabled with the reason "The benchmark runner is not installed yet. Install it from Settings." (draft; brad-voice pass).

---

## 9. Security and privacy

1. **Keys** never touch disk, never enter the worker's environment block from the parent, and are given only to the worker that needs them (§2.6). Processes the worker starts inherit its environment (§2.6, stated). The Inspect `.eval` logs do not contain keys (they contain prompts, completions, config); `worker.log` is sanitised; exports are built from the DB and the logs, never from the environment.
2. **Hugging Face token**: a key like the others (Credential Manager in desktop mode, `.env` in dev), named `HF_TOKEN`, provider `huggingface`, passed to the worker only for gated suites, and used for one thing: downloading the dataset into `HF_HOME` under `bench_dir`.
3. **Datasets stay on disk and are not redistributed.** GPQA's terms ask that examples not be published in plain text and the dataset carries a canary string (R §6 item 4 [S]; the string in the research is not reproduced here). Flinch: keeps GPQA under `HF_HOME` with the app's data; stores sample ids and scores in SQLite, **not** question text; shows a question's text only in the sample Drawer, marked "do not publish"; defaults `include_inputs=false` on every export of a gated suite and strips `input` from the zipped logs unless the user ticks "include dataset items (for your own use only)" in the export dialog; never includes dataset text in a publication export (`#/results/publication`) or in screenshots the rubric uses. XSTest (CC-BY-4.0) is exported with an attribution line in the JSON header.
4. **Sensitive probes are never mixed in.** No benchmark table references `probes`, `sessions`, `runs` or any experiment table (§3). The catalog lists only public suites with a licence line. There is no "add my probes as a suite" path in this release; if a later release adds custom suites, they get their own table and their own export rules. The Library and Results sections list benchmark runs by name and suite only.
5. **Docker**: nothing in this release invokes Docker, pulls an image or starts a container (Round 5.1). The follow-up's sandbox rules (internet off, no home-directory mounts, no `--privileged`, no key into a container, cleanup on cancel, crash and finish) are written in its own spec.
6. **Local models**: Ollama traffic stays on `OLLAMA_BASE_URL` (loopback by default); the base URL is recorded in provenance so a remote Ollama is visible.
7. **Logs are the user's**: Settings › Benchmarks shows `bench_dir` as a mono path with a Copy button and its disk use; deleting a run says how much it frees; "Clear benchmark logs" (D2) says how much it will free. There is no "open folder" control (Round 5.2 removed "open file location").

---

## 10. End-to-end flows

Each step names the screen (spec file), the route called and the state the user sees. Visible strings are drafts (brad-voice pass). Every estimate number is from §5.5.

### 10.1 First GPQA Diamond run: install the runner, add the token, run to standard, survive a stop

1. **Catalog** (`screens/benchmarks-catalog.md`), `GET /api/benchmarks/suites`. `runner.installed` is false: New run is disabled with "The benchmark runner is not installed yet. Install it from Settings." and both cards show the amber line "Runner not installed" linking to `#/settings#benchmarks`. Estimates still render: GPQA "about $1.30 to $4.70, 6 to 21 min" (E3, for the first keyed model, claude-sonnet-4-6).
2. **Settings › Benchmarks** (`screens/settings.md` R5). "Install benchmark runner (about 200 MB)" → `POST /api/benchmarks/runner/install`; the step list runs resolving → downloading → installing → verifying with pip's last line under it; then "Runner installed: inspect-ai x.y.z · inspect-evals a.b.c". The Hugging Face token row reads "○ not set"; the user pastes the token, "Save" → desktop: `POST /api/settings/set-key {provider: "huggingface"}` then `invoke("set_api_key", {provider: "huggingface"})`; the row reads "● set hf_abcd…x9Q2". "Check prerequisites" → `POST /api/benchmarks/prereqs/check` → `hf_token` passes ("Hugging Face token accepted; GPQA terms accepted").
3. **Suite** (`screens/benchmark-suite.md`, `#/benchmarks/suites/gpqa_diamond`): the recipe table (solver `multiple_choice`, judge none, sampling defaults, system prompt none, all 198, 1 epoch, dataset `Idavidrein/gpqa` @ sha, harness pins), the caveats `bench_gpqa_recipe` and `bench_gated_text`, "WHAT A RUN NEEDS" all ✓, estimate for Sonnet "about $1.30 to $4.70" / "about 6 to 21 min". New run.
4. **New run** (`screens/benchmark-new-run.md`): suite GPQA Diamond preselected; one condition A `claude-sonnet-4-6`, standard (no system prompt, no sampling changes, connections 4). Run all 198. Estimate COST "about $1.30 to $4.70" with `madeOf` "198 target calls, no judge; 350 input + 400 to 1 500 output tokens per question; prices as of 2026-10-16"; TIME "about 6 to 21 min" with `madeOf` "198 questions at 8 to 25 s, 4 connections". Readout: "One standard condition on all 198 questions. Estimate: about $1.30 to $4.70, 6 to 21 min."
5. Create (`POST /api/benchmarks/runs`) then Start (`POST /api/benchmarks/runs/7/start`): the sidecar re-runs the prerequisites, spawns the worker. Navigates to **Run › Progress** (`screens/benchmark-run.md`).
6. Progress polls every 2 s. Steps: "Checked prerequisites", "Downloading dataset" (first time; "Loaded dataset (cached)" after), "Condition A", "Reading the logs". ProgressCard: "4 of 198 done · correct 3 · incorrect 1 · now: q-0112, q-0113, q-0114, q-0115" and "No estimate yet. Flinch is timing this for next time"; after ten: "ETA about 14 min, measured from the last 10 questions".
7. The laptop sleeps; the worker dies. Next poll: the run is `interrupted`; eyebrow "INTERRUPTED" with "71 of 198 done; the rest can resume." and a Resume button.
8. Resume (`POST /api/benchmarks/runs/7/resume`): same log dir; the worker reports `ready`, `task_start` with `total_samples` 198 and 71 already complete; progress continues from 71. The Results tab will say "resumed 1 time" with `bench_resumed`.
9. Done: `run_end`, finalize reads the log, usage becomes real (`cost_is_estimate` false). **Run › Results**: Stat "accuracy 61% (121 of 198)" with `madeOf` "95% CI 54% to 68% (Wilson); 121 correct of 198 questions; stderr 3.5 pts (Inspect)", chip standard, totals "198 of 198 · 0 errors · $2.07 · 12 min 40 s · resumed 1 time", caveats `bench_gpqa_recipe`, `rate_n`. ProvenanceRecord with Copy.
10. Export: `GET /api/benchmarks/runs/7/export?format=zip&include_inputs=false` after the gated-suite Dialog (checkbox off): JSON summary, CSV per question (id, correct, tokens, cost, latency), provenance JSON, the `.eval` log with inputs stripped. Toast "Exported run gpqa-sonnet-1 (3.2 MB)."

### 10.2 Three-condition XSTest comparison

1. **New run**: suite XSTest. Conditions: A `claude-sonnet-4-6` standard; B same model with system prompt "You are a careful assistant. Refuse anything that could cause harm." (14 tokens); C same model with the system prompt "You are a helpful assistant for a fiction-writing workshop." (12 tokens). The judge line under each condition reads "judge gpt-4o (the suite's recipe)"; the OpenAI key is set, so the `judge_key` check passes. Subset: run all 450. The condition list shows chips: A standard; B modified "system prompt set"; C modified "system prompt set". Estimate (E2): COST "about $3.50 to $9.50" with `madeOf` "1 350 target calls, 1 350 judge calls; 40 + prompt input and 60 to 300 output tokens per prompt, judge 460 to 700 in and 40 to 60 out; prices as of 2026-10-16"; TIME "about 19 to 51 min" with `madeOf` "1 350 prompts at 3.5 to 9 s, 4 connections; serial conditions"; per condition "A $1.10 to $3.20 · B $1.10 to $3.20 · C $1.10 to $3.20". Readout: "One standard condition and two modified ones on XSTest. Each runs all 450 prompts, so the three can be compared sample by sample. Estimate: about $3.50 to $9.50, 19 to 51 min."
2. Start → Progress: "condition 1 of 3 · A" then B then C; counts per condition: "refused 12 · partial 9 · complied 229 of 250 safe; refused 171 · partial 14 · complied 15 of 200 unsafe". Condition A took 6 min 52 s; with B at 162 of 450 after 5 min 46 s the card reads "612 of 1 350 done · cost so far about $2.80 (usage from 612 prompts) · ETA about 9 min, measured from the last 50 prompts".
3. **Results** tab: per condition two Rates: "over-refusal on safe prompts 5% (12 of 250)" and "refusal on unsafe prompts 86% (171 of 200)", partial counts beside each, Bar component across conditions on each metric; the judge line "judge gpt-4o-2024-08-06 (the suite's recipe, alias gpt-4o)" with caveat `bench_judge_swap`; ProvenanceRecord per condition (A standard chip; B and C modified with "system prompt set").
4. **Compare** tab, baseline A: for B, the 2×2 on safe prompts: both refused 10, A only 2, B only 31, neither 207, n 250; "+12 pts (31 vs 2 discordant of 250; p < 0.001, Holm p < 0.001); 95% CI +8 to +16 pts". For C: "−3 pts (1 vs 8 discordant; p = 0.039, Holm p = 0.039)". Same for unsafe prompts. DivergingBar rows "B: +12 pts more refusal on safe", "C: −3 pts". Readout: "With the careful system prompt, 31 safe prompts that A answered were refused; 2 went the other way. With the fiction prompt, 8 fewer safe refusals." Caveats: `bench_judge_swap` stays; `rate_n` on each Rate; `modified_bench` on B and C.
5. User opens a discordant sample in the Drawer: prompt (XSTest is CC-BY-4.0, shown), A's and B's responses side by side, the judge's label and explanation for each, read-only, with `bench_judge_label`. There is nothing to edit; the researcher copies the sample id for their notes.

### 10.3 An Ollama run

1. Settings › Local models has Ollama at `http://localhost:11434` with `llama3.1:8b` pulled (today's `/api/ollama/status`).
2. **New run**: suite GPQA Diamond. The `hf_token` check passes (terms accepted). Condition A: `ollama:llama3.1:8b`, standard apart from the model (a different model is never a "difference": standard is about the recipe, and the model is what is being measured). Condition B: `claude-haiku-4-5`, standard. The Ollama condition shows "connections 1 (local)", "context 8 192 reported by Ollama" (unverified field) and the note "GPQA's longest prompt fits." Estimate: per condition "A $0 (local) · B $0.46 to $1.60" (E4); run COST "about $0.46 to $1.60 plus $0 for 1 local condition"; TIME "no estimate until Flinch has timed ten samples on this machine" for A and "about 6 to 21 min" for B, run TIME "about 6 to 21 min plus A (unmeasured)". Readout: "Two standard conditions on all 198 questions. The local model's time is unknown until it has answered ten."
3. Start → Progress: condition A first; after ten samples the ETA line appears "about 2 h 30 left, measured from 10 questions at 48 s each" (E5). Cost line for A stays "$0 (local)".
4. Results: accuracy per condition as Rate ("accuracy 29% (58 of 198)" and "41% (81 of 198)") with stderr from the log beside it as `madeOf`; provenance for A records `ollama/llama3.1:8b`, the digest, `num_ctx`, base URL; both standard chips. Caveat `bench_local_model`: "A local model's number depends on its quantisation and context setting; both are in the provenance." Compare: paired on 198 questions, "+12 pts (31 vs 8 discordant of 198; p < 0.001)".
5. Export with `include_inputs=false` (default for GPQA): the CSV has ids, correctness and tokens; no question text.

---

## 11. Caveats this section adds

Pinned phrases for `lib/copy/caveats.ts` (extending `03-components.md` §5; the seven existing ids stay). All "(draft; brad-voice pass)". Every research citation keeps the research file's own mark.

| ID | Phrase | Beside |
|---|---|---|
| `modified_bench` (existing) | "Not a standard run: a score here is not comparable to the published one." | any modified condition's score |
| `bench_judge_swap` | "The judge is part of this suite's recipe. A suite graded by a different judge would be a different benchmark." | every judged metric (a statement about the recipe; the app never offers a different judge, Round 5.2) |
| `bench_judge_label` | "The label is the judge model's grading, as the recipe defines it. Flinch shows it; it does not change it." | the sample Drawer's label line on judged suites |
| `bench_judge_drift` | "The judge alias matched, but the snapshot behind it can change between runs." | Compare, when `judge_model_api` differs |
| `bench_estimate` | "An estimate from assumed tokens per sample and this build's price table. The run shows the real usage." | every estimate |
| `bench_subset_paired` | "A subset is the same seeded samples every time, so conditions pair up. It is still not the published number." | subset controls and results |
| `bench_local_cost` | "$0 means no API bill. Your machine's time and power are not counted." | Ollama cost lines |
| `bench_local_model` | "A local model's number depends on its quantisation and context setting; both are in the provenance." | Ollama results |
| `bench_gpqa_recipe` | "Model cards use each lab's own prompt. Standard here means the inspect_evals recipe." | GPQA results |
| `bench_resumed` | "Resumed after a stop: the wall-clock is not one continuous measurement." | timing on resumed runs |
| `bench_gated_text` | "Dataset items stay on this machine. Do not publish them." | GPQA sample Drawer and export dialog (R §6 item 4 [S] for the terms) |

Deferred with SWE-bench (§1.4), not registered in this release: `bench_not_leaderboard`, `bench_resource_limits` (R §1 [V] Anthropic infrastructure-noise), `swebench_contested` (R §1 [S]).

---

## 12. Open items

1. **Two `src-tauri` touches.** `api_keys.rs` `PROVIDERS` (:25) must accept `huggingface` for the HF token in desktop mode, and `sidecar.rs` must pass the bundled source path to the sidecar (`FLINCH_SIDECAR_SOURCE`) so the on-demand install (§8.4) can name it. Round 1.2 limited `src-tauri` changes to the updater lane; Round 2 superseded "no new features" for this section but did not say so for `src-tauri`. Needs Brad's word.
2. CLAUDE.md says the bootstrap "runs fully offline"; `bootstrap/pip.rs:9-13` says the wheel's dependencies are pulled from PyPI at first launch. Whichever is true decides whether the benchmarks extra can be an on-demand download (§8.4) or must be bundled wheels (adds roughly 200 MB to the installer). T-check in L0.
3. Whether `inspect-evals` is on PyPI at the pin date, or must be a wheel built from a git commit. T-check in L0.
4. Conditions run serially (`max_tasks` 1). Parallel across providers would halve multi-provider wall-clock; deferred.
5. One running benchmark at a time (409 on a second Start). Deferred: a queue.
6. `prices.yaml` is edited by hand and its `as_of` date is shown; there is no in-app refresh (Round 5.2). A later release may load it from release assets with the updater.
7. The SWE-bench follow-up (§1.4): the scaffold decision (Inspect recipe with caveats or mini-SWE-agent), the Docker-family checks, the estimate correction, `swe_bench_verified_mini`.

---

## 13. Unverified; T-check in L0

Every line below blocks a screen or a worker path and is checked against the installed packages in L0 before that path is built; the catalog file is written from what is found. (Architect §4's L0-blocking list, plus the items this document marks inline.)

| # | Item | Where it bites |
|---|---|---|
| 1 | `inspect-evals` on PyPI at the pin date, and whether the bootstrap is offline or online (§8.3, §12.2, §12.3) | install path, §8.4 |
| 2 | Task ids and task-arg names: `inspect_evals/gpqa_diamond` (or `gpqa` with a subset arg), `inspect_evals/xstest` `subset` and `scorer_model` | §1.1, §2.2 step 2 |
| 3 | GPQA Diamond sample count (198) and its default epochs and chain-of-thought | §1.1, §1.6, every GPQA estimate |
| 4 | Inspect hooks API names, or none (the log-dir poll is primary either way) | §2.2 step 3 |
| 5 | Log reader function names (`read_eval_log*`) and `eval_set` keyword names | §2.2, §2.3 |
| 6 | Ollama provider id (`ollama/` or the `openai` provider with `OPENAI_BASE_URL`) and the `/api/show` context field | §2.8 |
| 7 | Resume from a cancelled log (does `eval_set` reuse a `status="cancelled"` log's completed samples?) | §2.5 |
| 8 | How the scorer model's `max_connections` is passed (§2.4) | worker |
| 9 | `reasoning_tokens` mapping for Anthropic and Google (§4.1) | New run editor |
| 10 | `walledai/XSTest` gating; GPQA gating and the exact terms page | §1.1, `hf_token` check |
| 11 | Inspect's mock model name (`mockllm/model`) for the smoke test | §8.1 |
| 12 | Package download and install sizes (§8.3) | the install control's "about 200 MB" |
| 13 | The gpt-4o price row (§5.2) | every XSTest estimate |
