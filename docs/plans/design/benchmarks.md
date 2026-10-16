# Benchmarks section: design

Draft 1, 2026-10-16. Status: **for Brad's reaction; nothing here is approved for execution.** Companion screen specs: `screens/benchmarks-catalog.md`, `screens/benchmark-new-run.md`, `screens/benchmark-run.md`, `screens/benchmark-suite.md`.

Binding inputs: `../flinch-rebuild-input-2026-10-15.md` Round 2 (2.3 to 2.6: pluggable runner, three suites, what varies between conditions, local execution with Docker for SWE-bench, estimates before a run, resumable partial runs and subsets, additive tables only). Research: `research/benchmark-harnesses-2026-10-16.md` (cited as `R §n`; its [V]/[S]/[U] marks carry over: anything the research marked [S] or [U] is written here as "unverified; T-check in L0"). IA: `01-information-architecture.md` §3 Benchmarks routes. Tokens and components: `02-tokens.md`, `03-components.md` (ProvenanceRecord §29, ProgressCard §28, Rate §6, Stat §7, Table §12, Caveat §5, DivergingBar §11). Existing code read for the job pattern: `flinch/app.py` experiment start/progress (2884-2948), `flinch/runner.py` `run_experiment` (463-633), `flinch/db.py` experiment tables (323-384), `flinch/stat_runner.py`, `src-tauri/src/sidecar.rs` header (1-24), `src-tauri/src/bootstrap/pip.rs` (1-60).

Real names used throughout: **suite** (a benchmark as shipped: XSTest, GPQA Diamond, SWE-bench Verified), **task** (the inspect_evals task that runs a suite, one per condition), **sample** (one item in a suite: an XSTest prompt, a GPQA question, a SWE-bench instance), **condition** (model + system prompt + sampling and reasoning settings + judge), **resolved rate**, **refusal rate**, **accuracy**, **judge** (the model that grades a response where the suite is model-graded), **scaffold** (the agent loop, tools and limits around the model in SWE-bench), **provenance** (the record of exactly how a run was produced), **standard** / **modified** (whether a condition matches the suite's published recipe).

Where L0 is cited: L0 is the first lane of the build plan (`../flinch-rebuild-plan-v2.md`, not yet written), where every "unverified" line below is checked against the installed `inspect-ai` and `inspect-evals` before any screen is built on it.

---

## 1. Suites in release 1

Round 2.4 fixes SWE-bench Verified and asks the plan to pick one knowledge suite (GPQA or MMLU-Pro) and one refusal suite (XSTest or OR-Bench) from the research.

### 1.1 Picks

| Suite | inspect_evals task id | Dataset and revision to pin | Size | Tier | Prerequisites |
|---|---|---|---|---|---|
| **SWE-bench Verified** | `inspect_evals/swe_bench_verified` (R §1 names `swe_bench` with `dataset="princeton-nlp/SWE-bench_Verified"` and a separate `swe_bench_verified_mini`; the exact task function names are unverified; T-check in L0) | `princeton-nlp/SWE-bench_Verified`, HF revision = the commit inspect_evals pins at the pinned inspect_evals version (R §4 [V] that it pins one; the hash itself is read from the installed package at L0 and written into `suites.yaml`) | 500 instances (R §1); `mini` subset size unverified; T-check in L0 | Heavy | Docker Desktop + WSL2, 120 GB free disk, 16 GB RAM, x86_64 (R §1 [V]) |
| **GPQA Diamond** | `inspect_evals/gpqa_diamond` (R §2 lists `gpqa`; the Diamond task name is unverified; T-check in L0) | `Idavidrein/gpqa`, config `gpqa_diamond`, gated; revision pinned at L0 | 198 questions (R §6 [V]) | Medium | Hugging Face token with GPQA terms accepted |
| **XSTest** | `inspect_evals/xstest` (R §2 [V]) | `walledai/XSTest` HF mirror (R §3: gating unverified; T-check in L0) or the upstream `paul-rottger/exaggerated-safety` CSV, CC-BY-4.0 (R §3 [V]); revision pinned at L0 | 450 prompts: 250 safe, 200 unsafe contrasts (R §3 [V]) | Light | A judge: OpenAI key for the published judge `openai/gpt-4o` (R §3 [V]) |

### 1.2 Why GPQA Diamond, not MMLU-Pro

GPQA Diamond is 198 questions; MMLU-Pro is about 12 000 with chain-of-thought by default (R §2, §5). The whole point of the section is paired comparison across conditions on the same samples, and a Flinch user runs three to five conditions, often with at least one on Ollama, where the research expects MMLU-Pro to take "many hours" per condition (R §5). At 198 items a full GPQA Diamond run is minutes and a few dollars per condition, so every run can be a *full* run, which is the only way a run can carry the standard flag (a `--limit` or subset is non-standard by the rules in §4; R §4 cites lm-eval calling `--limit` "for testing only"). MMLU-Pro runs in this app would almost always be subsets, so the "standard" half of Round 2.3 would be unreachable for the knowledge suite. GPQA Diamond is also the knowledge number labs still report on model cards, so the published recipe is a live reference point. Costs: it is gated (Hugging Face token, terms accepted) and carries a canary string that forbids republishing its items; §9 handles both. Caveat carried on every GPQA result: published model-card numbers use each lab's own prompt; the standard here is the inspect_evals recipe (§4.2).

### 1.3 Why XSTest, not OR-Bench

XSTest is in inspect_evals today (R §2 [V]); OR-Bench is not seen in the listing (R §2 [U]), so OR-Bench would need a custom Task written and maintained by this project, with a dataset licence the research could not confirm (R §3). XSTest is 450 prompts under CC-BY-4.0 with a published judge recipe (model-graded three-way, metric `refusal_rate`, default judge `openai/gpt-4o`, R §3 [V]), and it is built as 250 safe prompts with 200 unsafe contrasts, so one run yields both numbers Flinch's research question needs: the over-refusal rate on safe prompts and the refusal rate on unsafe ones. A full run is 450 target calls plus 450 judge calls: minutes, a few dollars, feasible on Ollama for the target side. OR-Bench's Hard-1K would be a fine second refusal suite later; it is a catalog entry marked "not in this release" (§1.5).

### 1.4 Why SWE-bench Verified stays, with its label

Round 2.4 fixes it. The research is blunt about it: Docker, 120 GB, Linux containers, hours of wall-clock, hundreds of dollars per full run on a frontier model (R §1), and a contested headline metric (OpenAI stopped reporting it in February 2026 citing contamination and flawed tests, R §1 [S]). The design keeps it as the Heavy tier with four consequences: it is never the default suite; a run cannot start until Docker Desktop with WSL2 is detected (§2.7); the estimate is a band with its inputs (§5); and every result carries the caveats `swebench_contested`, `bench_resource_limits` and `bench_not_leaderboard` (§11). "Standard" for SWE-bench in Flinch means the inspect_evals recipe (Inspect's own scaffold: `basic_agent`, `message_limit` 30, tool timeout 210 s, internet off, R §1 [V]), which is **not** the leaderboard's mini-SWE-agent bash-only scaffold (R §1). The Suite screen says so in its first paragraph.

### 1.5 Catalog entries shipped but not runnable in release 1

The catalog (`flinch/benchmarks/suites.yaml`) also lists StrongREJECT, OR-Bench Hard-1K, MMLU-Pro and HumanEval as `status: planned` rows so the catalog screen shows the shape of the pluggable runner. They render disabled with the reason "Not in this release." (draft; brad-voice pass). No code path runs them.

### 1.6 What "standard" means per suite (the published recipe)

Recorded as `recipe` in `suites.yaml`; the values below are what the research established, and every "default" is read from the installed inspect_evals at L0 and frozen into the file.

| Field | XSTest | GPQA Diamond | SWE-bench Verified |
|---|---|---|---|
| Solver | `generate()` (R §3 [V] model-graded; solver name unverified) | `multiple_choice()`; chain-of-thought default unverified; T-check in L0 | `basic_agent` with bash and python tools in a Docker sandbox (R §1 [V]) |
| Judge | `openai/gpt-4o` three-way: full compliance, partial, full refusal (R §3 [V]) | none (`choice()` scorer) | none (upstream test harness grades in the container, R §1 [V]) |
| Epochs | 1 | per inspect_evals default; unverified; T-check in L0 | 1 |
| Sampling | provider defaults (no temperature, max_tokens, reasoning override) | provider defaults | provider defaults |
| System prompt | none | none | the scaffold's own; a user system prompt is appended as a modification |
| Limits | full 450 (both subsets) | full 198 | full 500; `message_limit` 30, tool timeout 210 s, internet off |
| Metric shown | refusal rate on unsafe (r of 200), over-refusal rate on safe (r of 250), partial counts | accuracy (r of 198) with stderr | resolved rate (r of 500) |
| Dataset revision | pinned | pinned | pinned (R §4 [V]) |

---

## 2. Runner architecture

### 2.1 Shape

```
Tauri shell ──spawns──▶ Python sidecar (FastAPI, flinch.app)
                            │
                            ├── flinch/benchmarks/          (new package)
                            │     catalog.py   suites.yaml → benchmark_suites cache
                            │     prereqs.py   docker / wsl2 / disk / hf token / ollama checks
                            │     estimate.py  tokens-per-sample tables × prices.yaml
                            │     runs.py      create / start / cancel / resume / reconcile
                            │     worker.py    the child entry point (python -m flinch.benchmarks.worker)
                            │     progress.py  reads worker events, writes benchmark_samples
                            │     results.py   reads Inspect logs → scores, usage, cost, provenance
                            │     compare.py   paired McNemar / bootstrap
                            │     export.py    JSON / CSV / zip with logs
                            │
                            └──spawns (one per run)──▶ worker.py
                                                         └── inspect_ai.eval_set(tasks, log_dir=<run dir>)
                                                               └── (SWE-bench only) Docker sandboxes
```

The benchmark worker is a child of the Python sidecar, never of Tauri (`sidecar.rs` only knows about `python -m flinch.app`). On Windows the sidecar runs inside a Job Object with kill-on-close (`sidecar.rs:36-44`), and a child inherits the job, so **closing Flinch stops a running benchmark**; the run is resumable afterwards (§2.5). This is stated on the Progress tab.

Why a subprocess and not `eval_set()` inside FastAPI: Inspect owns its own asyncio loop, console and signal handling, and a crash in a Docker sandbox must not take the API server down (R §2 "design judgement"). It also gives cancel a clean unit: one process per run.

### 2.2 Launching a run

`runs.start(run_id)`:

1. Reads the run, its conditions and the suite's catalog row from SQLite.
2. Creates the run directory `<app data>/benchmarks/runs/<run_id>/` with `logs/` (Inspect `log_dir`), `events.jsonl` (worker progress), `worker.log` (stderr, key-sanitised the same way `crash.rs` sanitises).
   App data dir: `%APPDATA%/Flinch/` in desktop mode (the directory `sidecar.rs:246-255` puts `flinch.db` in), `data/` in dev mode; override `FLINCH_BENCH_DIR`.
3. Writes `run.json` (the full request: suite, conditions, subset, sample ids, limits; **no keys**).
4. Spawns `python -m flinch.benchmarks.worker --run <run dir>` with the sidecar's own interpreter (`sys.executable`), `cwd` = run dir, stdout piped, stderr to `worker.log`. Keys go over stdin (§2.6). On Windows, `CREATE_NEW_PROCESS_GROUP` so cancel can send `CTRL_BREAK_EVENT`.
5. Records `worker_pid` and `status='running'` on the run.
6. A sidecar task (`progress.pump`) reads worker stdout line by line, exactly as `sidecar.rs` scans for `READY`: each line is one JSON event, written to `events.jsonl` and applied to SQLite.

The worker:

1. Reads one JSON line from stdin (keys), sets `os.environ` for the providers named, and only then imports `inspect_ai` (the SDKs read env at client construction).
2. Builds one `Task` per condition from the catalog's task id and the condition's args (`§4`): `inspect_evals` task with `task_args` (for XSTest the `subset` and `scorer_model`; for SWE-bench `instance_ids` is expressed through `sample_id`), `model=<inspect model id>`, `model_args`, and a `GenerateConfig` from the condition's JSON. Each task gets `name=f"{suite}-{condition_label}"` and `metadata={"flinch_run": run_id, "flinch_condition": condition_id}` so the logs are self-describing.
3. Registers a Flinch hooks class (Inspect's hooks API: `on_sample_end`, `on_task_end`, `on_run_end`; the research did not read the hooks docs, so the exact names are unverified; T-check in L0. Fallback if hooks cannot give per-sample events: poll `read_eval_log_sample_summaries()` on the active log every 3 s, which the research did verify, R §2 [V]).
4. Calls `eval_set(tasks, log_dir=<run dir>/logs, retry_attempts=3, retry_wait=30, max_connections=<per provider, §2.4>, max_sandboxes=<§2.4>, sample_id=<subset ids or None>, epochs=<recipe>, log_format="eval", fail_on_error=0.2, tags=[f"flinch-run-{run_id}"])` and prints `{"event":"run_end","success":bool}` on return.
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

When the run finishes, `results.finalize(run_id)` reads each condition's `.eval` log with `read_eval_log()` (R §2 [V]) and reconciles: the aggregate metrics (`results.scores[].metrics`), `stats.model_usage` per model (the authoritative token totals), the plan's `GenerateConfig` as recorded by Inspect, `eval.model` and the per-sample `output.model` (the model id as returned by the API, §4), and any sample the stream missed. SQLite stays the source of truth; the log is the artifact and its path is recorded.

### 2.4 Concurrency

`max_connections` is set **per provider** in `model_args`, not globally, and shown on the New run screen as a number the user can lower:

| Provider | Default | Range |
|---|---|---|
| anthropic, openai, google, together | 4 | 1 to 8 |
| xai | 2 | 1 to 4 |
| ollama | 1 | 1 to 4 (R §5: raising `OLLAMA_NUM_PARALLEL` multiplies KV-cache VRAM; keep low) |
| SWE-bench sandboxes (`max_sandboxes`) | `min(4, max(1, floor(0.75 × cpu_count)))` | 1 to `min(24, floor(0.75 × cpu_count))` (R §1 [V] for the upper rule) |

`max_tasks` = 1: conditions run one after another, so a run against one provider does not multiply its rate-limit pressure, and progress reads as "condition 2 of 3". (Open item: run conditions in parallel when their providers differ; the estimate's wall-clock assumes serial.)

### 2.5 Cancel, crash and resume

Three states and one rule: **the Inspect log directory is the resume point; the DB only remembers where it is.**

- **Cancel** (user): the sidecar sends `CTRL_BREAK_EVENT` (Windows) or `SIGINT` (elsewhere) to the worker; Inspect's interrupt handling writes the active log with `status="cancelled"` and keeps the samples that completed (R §2 [V] for resume reusing completed samples; the cancelled-log case specifically is unverified; T-check in L0). If the worker is still alive after 30 s the sidecar kills it. For SWE-bench the sidecar then runs Inspect's sandbox cleanup (`inspect sandbox cleanup docker`; command name unverified; T-check in L0) so no containers are left running. Run status → `cancelled`; every `running` sample → `cancelled`.
- **Crash** (worker exits without `run_end`, or the whole app closes): on the next progress poll, or on sidecar start (`runs.reconcile_all()` at startup), any run with `status='running'` whose `worker_pid` is not alive becomes `interrupted`, with the samples it had completed intact. SWE-bench: the same sandbox cleanup runs.
- **Resume** (user, from `cancelled`, `interrupted` or `partial`): the sidecar relaunches the worker with the **same `run.json` and the same `log_dir`**. `eval_set` skips tasks whose logs are complete and retries the rest, reusing completed samples from the previous log (R §2 [V] for `eval_set` retry/resume; it retries whole tasks and preserves completed samples under `eval-retry` semantics). Resumed samples are not re-billed; the estimate on the Progress tab shows "remaining" from the DB counts. A resumed run keeps its id, provenance and standard flag; `benchmark_runs.resume_count` increments and the Results tab shows "resumed 1 time" beside the wall-clock, because a resumed SWE-bench run's wall-clock is not one continuous measurement.

Partial runs are first-class: a run with some conditions complete and some not shows the complete ones' results and compares only what is comparable (§6.4).

### 2.6 Keys

The sidecar's rule (`sidecar.rs:8-12`): keys travel over the stdin pipe as one JSON line, never through `cmd.env()`, never to disk. The worker mirrors it exactly:

- The sidecar writes `{"keys": {"anthropic": "...", "openai": "...", "huggingface": "..."}}\n` to the worker's stdin and closes the write half; the worker's `_read_stdin_keys()` is the same function as `flinch/app.py:3416-3447`, moved to `flinch/keys.py` and imported by both.
- Only the providers the run needs get a key: the target providers of its conditions, the judge's provider, and Hugging Face when the suite is gated. Everything else is omitted.
- The child's environment block is the sidecar's environment **minus** every `*_API_KEY` and `HF_TOKEN` the sidecar holds (so a key the sidecar has but the run does not need is not inherited), plus `INSPECT_LOG_DIR`, `HF_HOME=<app data>/benchmarks/hf` (datasets cache, §9), `OLLAMA_BASE_URL` when used, and `PYTHONUNBUFFERED=1`.
- `run.json`, `events.jsonl`, `worker.log`, the Inspect logs and the DB never contain a key. `worker.log` is passed through the same sanitiser as `crash.rs`. A test (`tests/benchmarks/test_keys.py`) greps every file under a finished test run's directory for the fixture key strings.

Today's dev-mode `.env` writer (`app.py:2233`) is untouched; the HF token joins `_SUPPORTED_KEYS` as `HF_TOKEN` (`provider: "huggingface"`) so Settings › Keys shows it with the others. Desktop mode needs `api_keys.rs` to accept the `huggingface` provider name (one match arm); this is the only `src-tauri` change the section asks for and it is listed as an open item in §12.

### 2.7 Docker, WSL2 and what happens without them

`prereqs.check()` runs on the catalog screen, on the Suite screen, before the estimate for a Heavy suite, and again immediately before Start (a stale "ok" is never trusted). Each check returns `{ok, detail, fix}` with `fix` a sentence for the UI and a link target (Settings › Benchmarks or an external page):

| Check | How | Pass | On failure the UI says (draft; brad-voice pass) |
|---|---|---|---|
| Docker CLI | `docker version --format '{{json .}}'`, 10 s timeout | exit 0 with `Server` present | "Docker Desktop is not installed or not running. SWE-bench needs it." |
| Linux engine | `Server.Os == "linux"`, `Server.Arch == "amd64"` | both | "Docker is running Windows containers. Switch Docker Desktop to Linux containers." / "This Docker engine is arm64. SWE-bench images are x86_64 and the arm64 images expose the reference fixes." (R §4 [V]) |
| WSL2 backend (Windows only) | `docker info --format '{{.OperatingSystem}}'` contains "Docker Desktop" and `wsl --status` exits 0 with "Default Version: 2" (exact strings unverified; T-check in L0) | both | "Docker Desktop needs the WSL 2 backend for SWE-bench." with the Docker guide link (R §1 [V] docker_setup.md) |
| Disk | `shutil.disk_usage()` on the drive holding Docker's data root (`docker info --format '{{.DockerRootDir}}'`; on Windows the WSL vhdx under `%LOCALAPPDATA%\Docker\wsl`) | free ≥ 120 GB | "SWE-bench needs about 120 GB free where Docker keeps images; you have 48 GB." (R §1 [V] for 120 GB) |
| Memory | `docker info --format '{{.MemTotal}}'` | ≥ 16 GB | "Docker Desktop has 8 GB; the SWE-bench guide asks for 16 GB." (R §1 [V]) |
| CPUs | `docker info --format '{{.NCPU}}'` | ≥ 4 (8 recommended) | "Docker Desktop has 2 CPUs; 8 are recommended." |
| Runner installed | `importlib.metadata.version("inspect-ai")` and `("inspect-evals")` equal the pins | yes | "The benchmark runner is not installed yet. Install it from Settings." (§8.4) |
| Hugging Face token (gated suites) | `HF_TOKEN` present and `GET https://huggingface.co/api/datasets/Idavidrein/gpqa` with the token returns 200 (not 401/403) | 200 | "GPQA is gated. Add your Hugging Face token in Settings and accept the dataset terms on huggingface.co." |
| Judge key (judged suites) | the judge provider's key is set | yes | "XSTest's published judge is gpt-4o. Add an OpenAI key, or pick another judge (that makes the run modified)." |
| Ollama (when a condition uses it) | `GET {OLLAMA_BASE_URL}/api/tags` lists the model | yes | reuse today's `/api/ollama/status` hint |

When Docker is absent: the SWE-bench card on the catalog shows the prerequisites as a list with the failing ones in `text-amber-400` and the Start path is disabled with the reason; the Suite screen explains the requirement; the other two suites are unaffected. Flinch never installs Docker, never changes Docker Desktop settings, and never pulls images outside a run. The first SWE-bench run's image pull is part of the run and is reported as its own step on the Progress tab ("Pulling environment images"), with the size from the research shown as an input, not a promise: about 100 GB at Inspect's default cache level (R §1 [V] for the SWE-bench `env` level; whether inspect_evals uses the same images and tiers is unverified; T-check in L0). Docker Hub pull-rate limits can dominate (R §1 [S]); the tip says to sign in to Docker Desktop first.

### 2.8 Ollama

Conditions can name a local model as `ollama:<name>` (today's id form, `flinch/target.py:280-300`). The worker maps it to Inspect's `ollama/<name>` provider (the research expects the provider but did not reach its docs, R §5 [U]; fallback is `openai-api/ollama/<name>` with `OLLAMA_BASE_URL`; T-check in L0). Rules:

- `max_connections` 1 by default (§2.4).
- Context length: Ollama's OpenAI-compatible API cannot set `num_ctx` (R §5 [V]); a too-small default silently truncates. The New run screen shows the model's reported context from `/api/show` (unverified field; T-check in L0) and warns when the suite's longest prompt exceeds it: GPQA and XSTest fit in 4 096; SWE-bench does not fit in any typical local context and the screen says "SWE-bench on a local model is impractical; it is allowed, not recommended." (draft; brad-voice pass).
- Provenance records the Ollama model digest from `/api/show` (so a re-pulled quantisation is a different model) and `num_ctx` as reported.
- Cost is $0 by definition with the caveat `bench_local_cost` (§11); wall-clock is estimated only after measurement (§5.3).
- The judge for XSTest can be an Ollama model, which makes the condition modified (§4.2) and is labelled so at pick time.

---

## 3. Data model

Additive only. Five new tables; no existing table or column changes; an existing `flinch.db` opens unchanged (Round 1.3 as narrowed by Round 2). All added in `flinch/db.py` under a new banner `-- BENCHMARKS (Round 2)` using the same `CREATE TABLE IF NOT EXISTS` style as the experiment block (`db.py:318-384`). JSON columns are TEXT holding JSON, as `experiments.config` is.

```sql
-- Catalog cache: one row per suite per catalog version, copied from
-- flinch/benchmarks/suites.yaml at startup so a past run keeps the
-- catalog row it was made with.
CREATE TABLE IF NOT EXISTS benchmark_suites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_key TEXT NOT NULL,                 -- 'xstest' | 'gpqa_diamond' | 'swe_bench_verified' | planned keys
    catalog_version TEXT NOT NULL,           -- suites.yaml 'version'
    name TEXT NOT NULL,
    tier TEXT NOT NULL,                      -- 'light' | 'medium' | 'heavy'
    status TEXT NOT NULL DEFAULT 'available',-- 'available' | 'planned'
    task_id TEXT NOT NULL,                   -- inspect_evals task id
    dataset_id TEXT NOT NULL,
    dataset_revision TEXT,                   -- HF commit or file sha256
    sample_count INTEGER NOT NULL,
    subset_seed INTEGER NOT NULL,            -- fixed per suite (§5.4)
    recipe_json TEXT NOT NULL,               -- §1.6 as JSON: solver, judge, epochs, sampling, limits, metric
    estimate_json TEXT NOT NULL,             -- §5.1 per-sample token and latency assumptions
    licence TEXT,
    gated INTEGER NOT NULL DEFAULT 0,
    needs_docker INTEGER NOT NULL DEFAULT 0,
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
    connections_json TEXT NOT NULL,          -- {provider: max_connections}, plus max_sandboxes
    estimate_json TEXT,                      -- §5 estimate as shown before Start
    run_dir TEXT,                            -- <app data>/benchmarks/runs/<id>
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
    judge_model TEXT,                        -- inspect id of the judge, NULL for unjudged suites
    judge_model_api TEXT,                    -- as returned
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
    sample_id TEXT NOT NULL,                 -- dataset id: SWE-bench instance_id, GPQA record id, XSTest row id
    sample_group TEXT,                       -- XSTest 'safe' | 'unsafe'; GPQA subdomain; SWE-bench repo
    epoch INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | error | cancelled
    score_value REAL,                        -- 1/0 for binary, numeric otherwise, NULL when not scored
    score_label TEXT,                        -- 'resolved' | 'unresolved' | 'correct' | 'incorrect' | 'full_refusal' | 'partial_refusal' | 'full_compliance'
    score_json TEXT,                         -- raw Inspect Score: value, answer, explanation, metadata
    override_label TEXT,                     -- human relabel on judged suites (§6.5); NULL otherwise
    override_note TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cache_read_tokens INTEGER,
    judge_input_tokens INTEGER,
    judge_output_tokens INTEGER,
    cost_usd REAL,                           -- from prices.yaml at apply time; NULL when the price is unknown
    latency_ms INTEGER,
    steps INTEGER,                           -- SWE-bench agent messages used, else NULL
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
    scaffold_json TEXT,                      -- solver, message_limit, tool timeout, sandbox, internet
    resources_json TEXT,                     -- docker version, cpus, memory, image set, arch
    created_at TEXT DEFAULT (datetime('now'))
);
```

Artifacts on disk, paths recorded, never duplicated into the DB: the Inspect `.eval` logs (`benchmark_conditions.inspect_log_path`), `run.json`, `events.jsonl`, `worker.log`, and for SWE-bench the per-instance test output inside the log. Deleting a run (`DELETE /api/benchmarks/runs/{id}`) deletes the rows and, with `?logs=true`, the run directory; the dialog states the directory size.

No benchmark table references `probes`, `sessions` or any experiment table; §9.3.

---

## 4. The condition model

### 4.1 A condition

A condition is the tuple **(model id as returned by the API, system prompt text + sha256, GenerateConfig fields, judge model id)**, plus the task args the suite exposes. Round 2.5 fixes what may vary: system prompt; model and provider including Ollama; sampling and reasoning settings. Scaffold settings (SWE-bench `message_limit`, tool timeout, sandbox resources, internet) **do not vary** between conditions in release 1; they are fixed to the recipe and recorded.

`generate_config_json` fields (Inspect `GenerateConfig` names, R §2 [V] for `system_message`, `temperature`, `max_tokens`, `reasoning_effort`, `seed`; the rest unverified; T-check in L0):

| Field | Type | UI control | Applies to |
|---|---|---|---|
| `temperature` | float 0 to 2 or null | Input number | all; Ollama honours it (R §5 [V]) |
| `top_p` | float or null | Input number (advanced) | all |
| `max_tokens` | int or null | Input number | all |
| `reasoning_effort` | 'low' / 'medium' / 'high' or null | Select | OpenAI reasoning models; Ollama exposes `reasoning_effort` (R §5 [V]) |
| `reasoning_tokens` | int or null | Input number ("thinking budget") | Anthropic extended thinking; Google thinking budget (field mapping unverified; T-check in L0) |
| `seed` | int or null | Input number (advanced) | only some providers honour it (R §4 [V]); recorded either way |

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
| judge equals the recipe's judge id (judged suites only) | "judge claude-haiku-4-5 instead of gpt-4o" |
| scaffold fields equal the recipe (always true in release 1; kept so a later release that lets them vary needs no schema change) | "message limit 50 instead of 30" |
| dataset revision equals the pinned revision | "dataset revision differs" |
| harness versions equal the pins | "inspect-ai version differs from the pin" |
| human overrides: none on this condition's samples | "k labels overridden" (applies to the displayed number, §6.5) |

Two refinements the UI states rather than hides:

1. **Judge alias drift.** The XSTest recipe names `openai/gpt-4o`, an alias. A run with that alias is standard, and the provenance records the snapshot the API returned (`judge_model_api`). Two standard XSTest runs weeks apart may have different judge snapshots; the Compare tab treats differing `judge_model_api` as "comparable with a caveat" (`bench_judge_drift`), not as incomparable.
2. **SWE-bench "standard" is Inspect's recipe, not the leaderboard's.** The flag is still called standard, and the caveat `bench_not_leaderboard` sits beside every SWE-bench score, standard or not (§1.4).

The flag is computed at `runs.create` (so the New run screen shows it before Start), and recomputed at finalize from what Inspect actually recorded in the log's `plan` (R §4 [V] that `plan` holds solvers and generation config); a mismatch between the two is itself a difference ("config recorded by Inspect differs from the request") and is logged, because it means the mapping in §4.1 has a bug.

### 4.3 The provenance record

`benchmark_provenance.record_json`, one per condition, the exact JSON `ProvenanceRecord` renders and copies (`03-components.md` §29). Every key is present; a missing value is `null`, rendered "none", never blank.

```json
{
  "flinch": {"version": "0.9.0", "run_id": 12, "condition_id": 31, "condition_label": "B", "created_at": "2026-10-16T14:02:11Z"},
  "harness": {"inspect_ai": "<pin>", "inspect_evals": "<pin>", "python": "3.11.9", "platform": "Windows-11-x86_64"},
  "suite": {"key": "xstest", "catalog_version": "2026-10-16", "task_id": "inspect_evals/xstest", "task_version": "<from log eval.task_version>", "dataset_id": "walledai/XSTest", "dataset_revision": "<sha>", "task_args": {"subset": "safe"}},
  "samples": {"mode": "full", "count": 250, "of": 250, "seed": null, "ids_sha256": "<sha256 of the ordered id list>", "epochs": 1},
  "model": {"requested": "claude-sonnet-4-6", "inspect": "anthropic/claude-sonnet-4-6", "api_returned": "claude-sonnet-4-6", "provider": "anthropic", "digest": null, "num_ctx": null},
  "system_prompt": {"text": "You are a careful assistant.", "sha256": "<sha>"},
  "generate_config": {"temperature": null, "top_p": null, "max_tokens": null, "reasoning_effort": null, "reasoning_tokens": null, "seed": null},
  "judge": {"inspect": "openai/gpt-4o", "api_returned": "gpt-4o-2024-08-06", "published": true, "prompt_sha256": "<sha of the grader template from the log>"},
  "scaffold": {"solver": "generate", "message_limit": null, "tool_timeout_s": null, "sandbox": null, "internet": null},
  "resources": {"docker_version": null, "cpus": null, "memory_gb": null, "arch": null, "image_set": null, "max_sandboxes": null, "max_connections": 4},
  "timing": {"started_at": "...", "finished_at": "...", "wall_clock_s": 412.6, "resume_count": 0},
  "usage": {"anthropic/claude-sonnet-4-6": {"input": 31250, "output": 48110, "cache_read": 0}, "openai/gpt-4o": {"input": 102000, "output": 6200, "cache_read": 0}},
  "cost": {"usd": 1.94, "is_estimate": false, "prices_as_of": "2026-10-16"},
  "standard": {"is": false, "differences": ["system prompt set"]},
  "log": {"path": "benchmarks/runs/12/logs/2026-10-16T14-02-11_xstest-B_abc123.eval", "sha256": "<sha>"}
}
```

For SWE-bench `scaffold` and `resources` are filled (`basic_agent`, 30, 210, `docker`, `false`; Docker version, `NCPU`, `MemTotal`, `amd64`, the image tag prefix, `max_sandboxes`). `cost.is_estimate` is false only when every sample's usage came from the log; if any provider returned no usage (some OpenAI-compatible endpoints do not), it stays true and the UI says "about".

---

## 5. Estimates before a run

Shown on the New run screen after the suite, conditions and subset are chosen, and again on the Progress tab as "estimated / so far". Every estimate is a **band** (low to high) with its inputs listed beside it, and the pinned caveat `bench_estimate` (§11).

### 5.1 Per-sample assumptions (in `suites.yaml` `estimate`)

| Suite | Target input tokens / sample | Target output tokens / sample | Judge tokens / sample | Latency / sample (API) | Source |
|---|---|---|---|---|---|
| XSTest | 40 + system prompt tokens | low 60, high 300 (refusals are short; compliance is longer); + `reasoning_tokens` if set | gpt-4o: 450 in, 40 out (prompt + response + grading template) | 3 s target + 3 s judge | design assumption; T-check against the first real run in L0 and replace with measured medians |
| GPQA Diamond | 350 + system prompt | low 400, high 1 500 with chain-of-thought; + `reasoning_tokens`; `max_tokens` caps the high | none | 15 s | design assumption; same |
| SWE-bench Verified | per instance: steps × context, with steps low 15, high 30 (`message_limit`), context growing to about 20 000 by the last step: low 150 000, high 450 000 input, prompt caching assumed 60 % cache reads for Anthropic/OpenAI | low 6 000, high 15 000 | none | low 4 min, high 12 min per instance | R §1 [S]: $0.30/instance (mini-SWE-agent, Sonnet 4) to $3.26/instance (HAL, GPT-5 medium, 50 tasks); the bands are tuned so those two land inside them; unverified; T-check in L0 |

The first run of each suite on a machine writes measured medians (tokens, latency, steps) into `benchmark_suites.estimate_json` under `measured`; later estimates show "measured from your last run on 2026-10-16" as the input instead of the assumption. The LoadingScreen pattern ("Flinch is timing this for next time") is the model.

### 5.2 Cost

`cost = Σ_samples Σ_models (input × price_in + output × price_out + cache_read × price_cache)` using `flinch/benchmarks/prices.yaml`: `as_of` date, per-model USD per million tokens for input, output, cache read, for the models `GET /api/models` can list. The file ships with the build; the UI shows "prices as of 2026-10-16, from this build's price table" and the Settings › Benchmarks section has "Update price table" (loads a newer `prices.yaml` from the release assets; L6 updater lane; until then, the file is edited by hand). A model with no price row gets cost "n/a" with the reason "no price for grok-4 in this build's table" and the run total says "plus n/a for 1 condition", never a silent zero. Ollama is $0.00 with `bench_local_cost`. The experiment runner's hard-coded four-provider average (`runner.py:620-632`) is **not** reused; it averages across providers the run does not use.

Subset and resume: the estimate multiplies by the number of samples actually pending, so a resume shows the remainder.

### 5.3 Wall-clock

`wall = Σ_conditions (samples × latency / max_connections_for_that_provider)` (conditions run serially, §2.4), plus for SWE-bench a first-run image pull shown as a separate line with its size and "depends on your download speed; Flinch does not estimate it". For Ollama, no latency assumption is made before the first ten samples; the band reads "no estimate until Flinch has timed ten samples on this machine" (draft; brad-voice pass), then ETA from the measured rate. Resource-limited sandboxes: the SWE-bench estimate shows `max_sandboxes` as an input so lowering it visibly lengthens the band.

### 5.4 Subset selection

A subset is **seeded and fixed per suite**, so two conditions, or two runs weeks apart, that pick "50 of 450" get the same 50 ids and are paired (§6):

- `ids = sorted(dataset ids)`; `rng = random.Random(suite.subset_seed)`; `rng.shuffle(ids)`; `subset = ids[:k]`.
- `subset_seed` lives in `suites.yaml` (one constant per suite, e.g. `20261016`) and is copied into the run; a user may override the seed in "advanced", and the run then records it and the Compare tab refuses to pair it with runs on the default seed (§6.4).
- XSTest keeps the safe/unsafe balance: the subset is drawn per group in proportion (k × 250/450 safe, the rest unsafe), each group shuffled with the same seed.
- A subset is always modified (§4.2), with the difference "subset of k of N".
- The run stores the ordered id list (`sample_ids_json`) and its sha256 in provenance; comparability is decided on the sha256, not on k.
- "Run all" is the default; the subset control defaults to k = 50 for the Heavy tier only when the user switches it on.

---

## 6. Comparison

The Compare tab exists for runs with two or more conditions (and for comparing two runs of the same suite; §6.4). It compares **per sample, paired**, on the intersection of samples that completed in both conditions, and shows the counts behind every number.

### 6.1 Binary outcomes (resolved / correct / refused)

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

For XSTest the binary is "full refusal vs not"; partial refusals are shown as their own count per condition and the Compare tab offers a second toggle "count partial as refusal" that recomputes with the inputs restated.

### 6.2 Means (numeric scores)

Not needed by the three release-1 suites (all binary), but the pluggable runner will meet them (StrongREJECT 0 to 5). `compare.py` implements: paired difference of means with a bootstrap 95 % CI over samples (same draws and seed), shown with n and both means. No t-test is reported (the distributions are bounded and skewed). This is the "bootstrap CI for means" line from the brief and the screen shows it only when `score_value` is non-binary.

### 6.3 More than two conditions

One baseline (the first condition by default; the user can pick another) and each other condition against it: k − 1 comparisons, each with its own 2×2 table. p-values are shown raw and **Holm-adjusted** across the k − 1 comparisons, both labelled, the way Experiments › Analysis shows corrections. No all-pairs matrix in release 1.

### 6.4 What is not comparable, and how the UI says so

Two conditions or runs are **comparable** only when all of these match: suite key and catalog version, dataset revision, `sample_ids` sha256 (so the same subset or both full), epochs, judge inspect id (judged suites), scaffold fields and `max_sandboxes` band (SWE-bench; `bench_resource_limits` applies even when they match), and neither has unresolved errors on more than 10 % of samples. Otherwise the Compare tab shows, in place of the tables, a Readout in warn tone: "These two can't be compared on the same samples: B ran a subset of 50 of 450 and A ran all 450." (draft; brad-voice pass), followed by the list of mismatches, and each condition's own score stays visible above it. Comparable-with-caveat cases (judge snapshot drift, §4.2; resumed runs) render the tables with the caveat note beside them.

A UI never computes a statistic itself: every number on the Compare tab comes from `GET /api/benchmarks/runs/{id}/compare` with its inputs in the same payload (`n`, `b`, `c`, `both`, `neither`, `draws`, `seed`), and the Stat component's `madeOf` is filled from those fields.

### 6.5 Human overrides on judged suites

On XSTest a researcher can relabel a sample (LabelControl with the three judge labels). Overrides never change `score_label`; they fill `override_label`. The Results and Compare tabs show the judged number by default and, when any override exists, a second line "with your 3 overrides: 41 of 200" and the condition's standard flag gains the difference "3 labels overridden" for that view. Exports include both columns.

---

## 7. API routes

Prefix `/api/benchmarks/`. Pydantic models in `flinch/models.py` (new classes prefixed `Benchmark`). All list payloads carry the fields the screens bind (the screen specs cite these names in their binding tables).

| Method | Route | Request | Response |
|---|---|---|---|
| GET | `/suites` | | `{suites: [{suite_key, catalog_version, name, tier, status, task_id, dataset_id, dataset_revision, sample_count, licence, gated, needs_docker, recipe, prereqs: {ok, checks: [{id, ok, detail, fix, link}]}, last_run: {id, status, finished_at} \| null}]}` |
| GET | `/suites/{suite_key}` | | one suite as above plus `estimate_assumptions` (§5.1 with `measured`), `description`, `what_standard_means` (markdown-free text) |
| GET | `/prereqs` | `?suite=` optional | `{checks: [...]}` as above, plus `runner: {installed, inspect_ai, inspect_evals, pins}` |
| POST | `/prereqs/check` | `{suite?}` | same as GET, re-run now |
| POST | `/runner/install` | | SSE stream of `{stage, message, fraction}` (§8.4) |
| POST | `/estimate` | `{suite_key, conditions: [ConditionIn], subset: {mode, size?, seed?}, epochs?, connections?}` | `{cost: {low, high, is_estimate: true, prices_as_of, unknown_models: []}, wall_clock_s: {low, high} \| null, per_condition: [{label, cost, wall_clock_s, tokens: {input, output, judge}}], inputs: {samples, assumptions, measured}, image_pull_gb?: number}` |
| POST | `/runs` | `{name, suite_key, conditions: [ConditionIn], subset, epochs?, connections?}` where `ConditionIn = {label, model_id, system_prompt?, generate_config: {...}, judge_model?, task_args?}` | `{run: Run, conditions: [Condition], estimate, prereqs}`; status `ready`; `is_standard` and differences computed |
| GET | `/runs` | `?status=&suite=&limit=&offset=` | `{runs: [{id, name, suite_key, suite_name, tier, status, created_at, started_at, finished_at, conditions: [{id, label, model_id, is_standard, score_summary: {metric, count, of} \| null}], subset: {mode, size, of}, cost_usd, cost_is_estimate}]}` |
| GET | `/runs/{id}` | | `{run, suite, conditions, estimate, prereqs}` |
| PATCH | `/runs/{id}` | `{name?}` | run |
| DELETE | `/runs/{id}` | `?logs=true` | `{deleted: true, freed_bytes}` |
| POST | `/runs/{id}/start` | | `{started: true, worker_pid}`; 409 with `{reason, checks}` when a prerequisite fails or another run is running (one at a time in release 1) |
| POST | `/runs/{id}/cancel` | | `{cancelled: true}` |
| POST | `/runs/{id}/resume` | | `{started: true}`; 409 when not resumable |
| GET | `/runs/{id}/progress` | | `{status, elapsed_s, started_at, conditions: [{id, label, status, done: {count, of}, errors, running_sample_ids, outcomes: {label: count}, tokens: {input, output}, cost_usd, cost_is_estimate}], current_step: {id, label} \| null, eta_s: number \| null, eta_basis: 'measured' \| null, resumable}` |
| GET | `/runs/{id}/samples` | `?condition_id=&status=&group=&label=&sort=&page=&page_size=` | `{samples: [{id, sample_id, sample_group, epoch, status, score_value, score_label, override_label, tokens: {input, output, judge}, cost_usd, latency_ms, steps, error_message, completed_at}], total}` |
| GET | `/runs/{id}/samples/{sample_row_id}` | | the row plus `transcript: {input, output, judge_explanation, events_excerpt}` read from the Inspect log on demand (`read_eval_log_samples`, R §2 [V]); GPQA `input` is returned (the researcher has accepted the terms) but marked `do_not_publish: true` |
| POST | `/runs/{id}/samples/{sample_row_id}/override` | `{override_label \| null, note?}` | the row |
| GET | `/runs/{id}/results` | | `{conditions: [{id, label, is_standard, differences, metrics: [{key, name, value, count, of, stderr?, ci95?: [lo, hi]}], groups: [{group, metrics}], usage, cost_usd, cost_is_estimate, wall_clock_s, resume_count, errors: {count, of}}], caveats: [caveat ids that apply]}` |
| GET | `/runs/{id}/provenance` | `?condition_id=` | `{records: [record_json...]}` |
| GET | `/runs/{id}/compare` | `?baseline=<condition_id>&partial_as_refusal=&other_run=<run_id>` | `{comparable: bool, reasons: [...], baseline, comparisons: [{condition_id, n, both, a_only, b_only, neither, diff_pts, p, p_holm, ci95: [lo, hi], draws, seed, metric}], caveats: [...]}` |
| GET | `/runs/{id}/export` | `?format=json\|csv\|zip&include_inputs=false` | file download; zip = JSON + CSV + provenance + Inspect logs; `include_inputs` defaults false for gated suites (§9) |
| GET | `/settings` | | `{bench_dir, disk: {used_bytes, free_bytes}, prices_as_of, hf_token_set, docker: {...}, runner: {...}}` |
| POST | `/settings` | `{bench_dir?}` | same |

Errors follow today's `HTTPException` detail shape. SSE is used only for the runner install; run progress is polled (§2.3).

---

## 8. Backend work list

### 8.1 Files to create

| File | Contents |
|---|---|
| `flinch/benchmarks/__init__.py` | package; `BENCH_DIR` resolution |
| `flinch/benchmarks/suites.yaml` | catalog: three available suites, four planned; `version`, recipe, estimate assumptions, subset seed, licence, prerequisites |
| `flinch/benchmarks/prices.yaml` | `as_of`, per-model prices |
| `flinch/benchmarks/catalog.py` | load YAML, upsert `benchmark_suites`, expose suites with prereq status |
| `flinch/benchmarks/prereqs.py` | the §2.7 checks, each a small async function with a 10 s timeout |
| `flinch/benchmarks/estimate.py` | §5 |
| `flinch/benchmarks/conditions.py` | §4: Flinch id → Inspect id, GenerateConfig mapping, standard flag and differences, provenance record builder |
| `flinch/benchmarks/runs.py` | create, start (spawn), cancel, resume, reconcile, delete |
| `flinch/benchmarks/worker.py` | child entry point: stdin keys, task build, hooks, `eval_set`, stdout events |
| `flinch/benchmarks/progress.py` | pump stdout → `events.jsonl` + SQLite; progress payload |
| `flinch/benchmarks/results.py` | finalize from `.eval` logs; sample detail on demand |
| `flinch/benchmarks/compare.py` | McNemar exact, bootstrap CI, Holm; pure functions over lists |
| `flinch/benchmarks/export.py` | JSON / CSV / zip |
| `flinch/keys.py` | `_read_stdin_keys` moved here (shared by `app.py` and `worker.py`); `HF_TOKEN` added to `_SUPPORTED_KEYS` |
| `tests/benchmarks/test_conditions.py` | standard flag truth table (every row of §4.2), id mapping, sha256 of prompts |
| `tests/benchmarks/test_estimate.py` | bands from fixed assumptions; unknown model → n/a; subset and resume remainders |
| `tests/benchmarks/test_subset.py` | seeded subset is stable across calls and balanced for XSTest |
| `tests/benchmarks/test_compare.py` | McNemar exact against hand-computed cases; bootstrap seed reproducibility; Holm ordering; incomparable reasons |
| `tests/benchmarks/test_worker_events.py` | a fake worker script emits the §2.2 events; the pump writes the right rows; crash → `interrupted`; resume relaunches with the same log_dir |
| `tests/benchmarks/test_keys.py` | no key string in any file under a finished fixture run dir; child env has no `*_API_KEY` the run did not need |
| `tests/benchmarks/test_prereqs.py` | each check against stubbed `docker` output (present, Windows containers, arm64, low disk) |
| `tests/benchmarks/test_db_additive.py` | opens a copy of a v0.8.0 `flinch.db` fixture, runs the schema, asserts every pre-existing table's `PRAGMA table_info` is byte-identical before and after |
| `tests/benchmarks/test_smoke_inspect.py` (marked `slow`, skipped without the extra installed) | runs `xstest` with `limit=2` against a mock model (`mockllm/model`, Inspect's built-in; name unverified; T-check in L0) end to end through the worker |

### 8.2 Files to modify

| File | Change |
|---|---|
| `flinch/db.py` | the five tables (§3) appended to `SCHEMA`; CRUD functions `create_benchmark_run`, `list_benchmark_runs`, `upsert_benchmark_sample`, `get_benchmark_progress`, …, async like the experiment ones |
| `flinch/app.py` | mount the routes (§7) from `flinch/benchmarks/api.py` via an `APIRouter`; call `catalog.sync()` and `runs.reconcile_all()` at startup; `_read_stdin_keys` imported from `flinch/keys.py`; `_SUPPORTED_KEYS` gains `HF_TOKEN` |
| `flinch/models.py` | `Benchmark*` request/response models |
| `pyproject.toml` | the `benchmarks` extra (§8.3) |
| `src-tauri/src/api_keys.rs` | accept provider `huggingface` (open item §12) |
| `scripts/verify-phase1.py` | add `/api/benchmarks/suites` and `/api/benchmarks/prereqs` to the contract check |

### 8.3 Dependencies

Added as an **optional extra** `flinch[benchmarks]`, pinned exactly (the numbers are chosen at L0 from PyPI on that day and frozen; the research recorded no versions):

```toml
benchmarks = [
    "inspect-ai==<pin at L0>",
    "inspect-evals==<pin at L0>",   # if not on PyPI at that date: a wheel built from a pinned git commit and shipped in resources/ (unverified; T-check in L0)
    "datasets==<pin>",              # pulled by inspect_evals; pinned so the dataset loader does not drift
    "docker==<pin>",                # Inspect's docker sandbox talks to the CLI, not this SDK; keep only if inspect_evals swe_bench needs it (unverified)
    "scipy>=1.11.0",                # already in the `experiment` extra; used for the exact binomial
]
```

Size effect: today the installer bundles the PBS tarball (about 30 MB) and the Flinch wheel built with `--no-deps` (about 1 MB), and the bootstrap pip-installs the wheel's dependencies from PyPI at first launch (`bootstrap/pip.rs:9-13`; note CLAUDE.md says the bootstrap "runs fully offline", which `pip.rs` contradicts; unverified which is current; T-check in L0). The benchmarks extra adds roughly 150 to 250 MB of downloads and 400 to 600 MB installed (inspect-ai with textual, rich, pydantic, httpx, anyio, jsonschema and friends; `datasets` with pyarrow, pandas, numpy, huggingface_hub, dill, multiprocess; the SWE-bench task's own needs). Those figures are estimates from package sizes known in training, not measured; T-check in L0 by `pip download` into an empty dir. Because of the size, the extra is **installed on demand** (§8.4), so the base installer and first launch do not change.

### 8.4 On-demand runner install

Settings › Benchmarks has "Install benchmark runner (about 200 MB)" which calls `POST /api/benchmarks/runner/install`: the sidecar runs `<venv pip> install "flinch[benchmarks]==<own version>"` streaming pip's output to the LoadingScreen (step list: resolving, downloading, installing, verifying), then re-runs the `Runner installed` check. In dev mode the same route runs pip in the active environment. Until installed, the Benchmarks nav item is enabled, the catalog renders, and every Start path is disabled with the reason "The benchmark runner is not installed yet. Install it from Settings." (draft; brad-voice pass). Uninstall is not offered in release 1.

---

## 9. Security and privacy

1. **Keys** never touch disk, never enter the worker's environment block from the parent, and are given only to the worker that needs them (§2.6). The Inspect `.eval` logs do not contain keys (they contain prompts, completions, config); `worker.log` is sanitised; exports are built from the DB and the logs, never from the environment.
2. **Hugging Face token**: a key like the others (Credential Manager in desktop mode, `.env` in dev), named `HF_TOKEN`, passed to the worker only for gated suites, and used for one thing: downloading the dataset into `HF_HOME` under the app data dir.
3. **Datasets stay on disk and are not redistributed.** GPQA's terms ask that examples not be published in plain text and the dataset carries a canary string (R §6 [S]; the string in the research is not reproduced here). Flinch: keeps GPQA under `HF_HOME` with the app's data; stores sample ids and scores in SQLite, **not** question text; shows a question's text only in the sample Drawer, marked "do not publish"; defaults `include_inputs=false` on every export of a gated suite and strips `input` from the zipped logs unless the user ticks "include dataset items (for your own use only)" in the export dialog; never includes dataset text in a publication export (`#/results/publication`) or in screenshots the rubric uses. XSTest (CC-BY-4.0) and SWE-bench (the instances are public GitHub code) are exported with attribution lines in the JSON header.
4. **Sensitive probes are never mixed in.** No benchmark table references `probes`, `sessions`, `runs` or any experiment table (§3). The catalog lists only public suites with a licence line. There is no "add my probes as a suite" path in release 1; if a later release adds custom suites, they get their own table and their own export rules. The Library and Results sections list benchmark runs by name and suite only.
5. **Docker**: Flinch runs Inspect's sandbox with the recipe's defaults (internet off for SWE-bench, R §1 [V]); it never mounts the user's home directory, never runs with `--privileged`, and passes no key into a container. Containers are cleaned up on cancel, crash and finish (§2.5).
6. **Local models**: Ollama traffic stays on `OLLAMA_BASE_URL` (loopback by default); the base URL is recorded in provenance so a remote Ollama is visible.
7. **Logs are the user's**: the Settings › Benchmarks section shows the run directory, its size, and "Open folder"; deleting a run says how much it frees.

---

## 10. End-to-end flows

Each step names the screen (spec file), the route called and the state the user sees. Visible strings are drafts (brad-voice pass).

### 10.1 First SWE-bench Verified run

1. **Catalog** (`screens/benchmarks-catalog.md`), `GET /api/benchmarks/suites`. The SWE-bench card shows tier Heavy, "500 instances", "needs Docker Desktop with WSL 2, about 120 GB free", and the prerequisite list with Docker "not detected" in amber. The card's primary action reads "Check prerequisites" instead of "New run".
2. User installs Docker Desktop, enables WSL 2, allocates 16 GB, signs in. Back in Flinch: **Suite** screen (`screens/benchmark-suite.md`), "Check again", `POST /api/benchmarks/prereqs/check {suite: "swe_bench_verified"}`. All checks ok except disk: "SWE-bench needs about 120 GB free where Docker keeps images; you have 48 GB." User moves Docker's disk image; checks again; ok. The Suite screen's first paragraph has already told them: Inspect's scaffold, not the leaderboard's; contamination debate; resource limits.
3. **New run** (`screens/benchmark-new-run.md`): suite SWE-bench Verified (preselected from the Suite screen); one condition, `claude-sonnet-4-6`, standard (no system prompt, no sampling changes). Subset: "Run all 500" is the default; the user switches to "Run a subset" and keeps k = 50, the screen shows "modified: subset of 50 of 500; the same 50 instances every time (seed 20261016)". `POST /api/benchmarks/estimate` → cost band "about $15 to $165" with the inputs (50 instances × 15 to 30 steps × …; prices as of …), wall-clock "about 50 min to 2 h 30 at 4 sandboxes" plus the line "first run also pulls about 100 GB of images; depends on your download speed". The Readout: "This run is modified: a subset is not the published number. 50 instances, one condition, Docker ready."
4. Create (`POST /api/benchmarks/runs`) then Start (`POST /api/benchmarks/runs/12/start`): the sidecar re-runs the prerequisites, spawns the worker. Navigates to **Run › Progress** (`screens/benchmark-run.md`).
5. Progress polls every 2 s. Step list: "Pulling environment images" (current, elapsed), "Running instances" (next), "Grading" (inside each instance). After the pull, the ProgressCard shows "3 of 50 done · resolved 1 · unresolved 2 · now: django__django-11099, astropy__astropy-12907, …" and "cost so far about $4.10 (usage from 3 instances; the rest estimated)". ETA appears after ten instances: "measured from 10 instances".
6. The machine sleeps, Docker Desktop restarts, the worker dies. Next poll: the run is `interrupted`; the ProgressCard eyebrow reads "INTERRUPTED" with "27 of 50 done; the rest can resume. Containers from the stopped run were cleaned up." and a Resume button.
7. Resume (`POST /api/benchmarks/runs/12/resume`): same log dir; the worker reports `ready`, `task_start` with `total_samples` 50 and 27 already complete; progress continues from 27. The Results tab will say "resumed 1 time".
8. Done: `run_end`, finalize reads the log, usage becomes real (`cost_is_estimate` false). **Run › Results**: Stat "resolved rate 38% (19 of 50)" with `madeOf` "19 resolved of 50 instances; a subset, seed 20261016" and the caveats beside it: `modified_bench` (subset), `bench_not_leaderboard`, `bench_resource_limits` ("4 sandboxes, 16 GB, 8 CPUs"), `swebench_contested`. ProvenanceRecord shows the modified chip with "subset of 50 of 500" and Copy.
9. Export: `GET /api/benchmarks/runs/12/export?format=zip` → JSON summary, CSV per instance (instance_id, resolved, steps, tokens, cost, latency), provenance JSON, the `.eval` log. Toast "Exported run 12 (184 MB)."

### 10.2 Three-condition XSTest comparison

1. **New run**: suite XSTest. Conditions: A `claude-sonnet-4-6` standard; B same model with system prompt "You are a careful assistant. Refuse anything that could cause harm."; C same model with the system prompt "You are a helpful assistant for a fiction-writing workshop." Judge `openai/gpt-4o` (published) on all three; the OpenAI key is set, so the judge check passes. Subset: run all 450. The condition list shows chips: A standard; B modified "system prompt set"; C modified "system prompt set". Estimate: "about $5 to $9 for three conditions (1 350 target calls, 1 350 judge calls); about 15 to 25 min at 4 connections". Readout: "One standard condition and two modified ones. Each runs all 450 prompts, so the three can be compared sample by sample."
2. Start → Progress: "condition 1 of 3 · A" then B then C; counts per condition: "refused 12 · partial 9 · complied 229 of 250 safe; refused 171 · partial 14 · complied 15 of 200 unsafe".
3. **Results** tab: per condition two Rates: "over-refusal on safe prompts 5% (12 of 250)" and "refusal on unsafe prompts 86% (171 of 200)", partial counts beside each, Bar component across conditions on each metric; the judge line "judge gpt-4o-2024-08-06 (published alias gpt-4o)" with caveat `bench_judge_swap` explained as "a different judge would be a different benchmark"; ProvenanceRecord per condition (A standard chip; B and C modified with "system prompt set").
4. **Compare** tab, baseline A: for B, the 2×2 on safe prompts: both refused 10, A only 2, B only 31, neither 207, n 250; "+12 pts (31 vs 2 discordant of 250; p < 0.001, Holm p < 0.001); 95% CI +8 to +16 pts". For C: "−3 pts (1 vs 8 discordant; p = 0.039, Holm p = 0.039)". Same for unsafe prompts. DivergingBar rows "B: +12 pts more refusal on safe", "C: −3 pts". Readout: "With the careful system prompt, 31 safe prompts that A answered were refused; 2 went the other way. With the fiction prompt, 8 fewer safe refusals." Caveats: `bench_judge_swap` stays; `rate_n` on each Rate; `modified_bench` on B and C.
5. User opens a discordant sample in the Drawer: prompt (XSTest is CC-BY-4.0, shown), A's and B's responses side by side, the judge's explanation for each, LabelControl to override. They override one B label from "partial refusal" to "full compliance"; the Results tab now shows "with your 1 override: 30 of 250" beside the judged number and the Compare tab recomputes on request ("Recompute with overrides"), restating its inputs.

### 10.3 An Ollama run

1. Settings › Local models has Ollama at `http://localhost:11434` with `llama3.1:8b` pulled (today's `/api/ollama/status`).
2. **New run**: suite GPQA Diamond. The HF token check passes (terms accepted). Condition A: `ollama:llama3.1:8b`, standard apart from the model (a different model is never a "difference": standard is about the recipe, and the model is what is being measured). Condition B: `claude-haiku-4-5`, standard. The Ollama condition shows "connections 1 (local)", "context 8 192 reported by Ollama" (unverified field) and the note "GPQA's longest prompt fits." Estimate: Haiku "about $0.40 to $1.20"; Ollama "$0 (local; your electricity is not counted)"; wall-clock for Ollama "no estimate until Flinch has timed ten samples on this machine", for Haiku "about 12 to 25 min at 4 connections". Readout: "Two standard conditions on all 198 questions. The local model's time is unknown until it has answered ten."
3. Start → Progress: condition A first; after ten samples the ETA line appears "about 1 h 40 left, measured from 10 samples at 48 s each". Cost line for A stays "$0 (local)".
4. Results: accuracy per condition as Rate ("accuracy 29% (58 of 198)" and "41% (81 of 198)") with stderr from the log beside it as `madeOf`; provenance for A records `ollama/llama3.1:8b`, the digest, `num_ctx`, base URL; both standard chips. Caveat `bench_local_model`: "A local model's number depends on its quantisation and context setting; both are in the provenance." Compare: paired on 198 questions, "+12 pts (31 vs 8 discordant of 198; p < 0.001)".
5. Export with `include_inputs=false` (default for GPQA): the CSV has ids, correctness and tokens; no question text.

---

## 11. Caveats this section adds

Pinned phrases for `lib/copy/caveats.ts` (extending `03-components.md` §5; the seven existing ids stay). All "(draft; brad-voice pass)".

| ID | Phrase | Beside |
|---|---|---|
| `modified_bench` (existing) | "Not a standard run: a score here is not comparable to the published one." | any modified condition's score |
| `bench_not_leaderboard` | "A local run is not a leaderboard entry. Same suite, different scaffold and limits." | every SWE-bench score |
| `bench_resource_limits` | "Sandbox CPU and memory shift agentic scores by a few points. The limits used are in the provenance." | every SWE-bench score (R §1 [V] Anthropic infrastructure-noise) |
| `swebench_contested` | "SWE-bench Verified is disputed as a headline number (contamination, flawed tests). Use it to compare conditions, not to claim a rank." | SWE-bench suite and results (R §1 [S]) |
| `bench_judge_swap` | "The judge is part of the benchmark. A different judge is a different benchmark." | every judged metric |
| `bench_judge_drift` | "The judge alias matched, but the snapshot behind it can change between runs." | Compare, when `judge_model_api` differs |
| `bench_estimate` | "An estimate from assumed tokens per sample and this build's price table. The run shows the real usage." | every estimate |
| `bench_subset_paired` | "A subset is the same seeded samples every time, so conditions pair up. It is still not the published number." | subset controls and results |
| `bench_local_cost` | "$0 means no API bill. Your machine's time and power are not counted." | Ollama cost lines |
| `bench_local_model` | "A local model's number depends on its quantisation and context setting; both are in the provenance." | Ollama results |
| `bench_gpqa_recipe` | "Model cards use each lab's own prompt. Standard here means the inspect_evals recipe." | GPQA results |
| `bench_resumed` | "Resumed after a stop: the wall-clock is not one continuous measurement." | timing on resumed runs |
| `bench_gated_text` | "Dataset items stay on this machine. Do not publish them." | GPQA sample Drawer and export dialog |

---

## 12. Open items

1. `api_keys.rs` must accept a `huggingface` provider name for the HF token in desktop mode (one match arm). Round 1.2 limited `src-tauri` changes to the updater lane; Round 2 superseded "no new features" for this section but did not say so for `src-tauri`. Needs Brad's word.
2. CLAUDE.md says the bootstrap "runs fully offline"; `bootstrap/pip.rs:9-13` says the wheel's dependencies are pulled from PyPI at first launch. Whichever is true decides whether the benchmarks extra can be an on-demand download (§8.4) or must be bundled wheels (adds roughly 200 MB to the installer). T-check in L0.
3. Whether `inspect-evals` is on PyPI at the pin date, or must be a wheel built from a git commit. T-check in L0.
4. The exact inspect_evals task function names for SWE-bench Verified and GPQA Diamond, the GPQA default epochs and chain-of-thought, the XSTest `subset` and `scorer_model` arg names, and the Inspect hooks API names. All T-check in L0 against the installed packages; the catalog file is written from what is found.
5. Conditions run serially (`max_tasks` 1). Parallel across providers would halve multi-provider wall-clock; deferred.
6. One running benchmark at a time (409 on a second Start). Deferred: a queue.
7. The price table update path depends on the L6 updater lane; until then `prices.yaml` is edited by hand and its `as_of` date is shown.
8. Whether Flinch should offer the `swe_bench_verified_mini` subset as its own catalog entry (an Inspect-defined subset, standard with respect to that task) in addition to the seeded subset. Depends on item 4.
