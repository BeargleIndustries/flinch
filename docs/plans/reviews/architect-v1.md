# Architect review: ralplan-flinch-ui-revamp-v1 (RALPLAN-DR short)

Verdict: SOUND WITH CHANGES

Blockers
B1. D17 "rate-limiter config shape" has no implementing B-item; section 8.2.3 sends {} to dodge it (models.py:390-392, rate_limiter.py:77-86, app.py:2928). Also provider_worker runs cells sequentially so `concurrent` is never used (runner.py:491-512). Add B36 to T07: pool accepts int or {rpm, concurrent}; run_experiment starts max_concurrent workers per provider from a per-provider queue with the pause check per item; tests: /resume with no body; {"anthropic":2}; 5 cells at 0.1 s with concurrency 5 finish under 0.3 s.
B2. Sequence work scheduled before B02 (methods sit on ExperimentRunner, runner.py:636-1313; routes call Runner, app.py:2047/2069/2085/2181). Reorder: T04 = B02, B12, B15, B16; T05 = B01, B09, B10; T06 = B05, B33. test_sse_format must assert the first event is not `error` except in the deliberate error case.
B3. Playwright wiring (T32) lands after tasks T13-T31 whose acceptance checks are Playwright specs. Split: T32a config/global-setup/localStorage init (depends on T01, T10; before T13); T32b CI workflow only.

Major
M1. Contract files (endpoints.ts, endpoints.paths.json, types.ts) are created in T10 but required by T02-T09 (I3, line 1397). Split T10 into T10a scaffold (parallel) and T10b ROUTES+snapshot after T09; I3 applies from T10b; test_app_routes_exist skipif the file is missing.
M2. Nothing prevents running one study twice at once (no registry, app.py:2901-2942; cells never claimed, runner.py:535-588, db.py:3506-3533; disconnect not guaranteed to cancel the generator: uvicorn send is silent after disconnect h11_impl.py:459, Starlette cancels only below spec 2.4, uvicorn advertises 2.3; uvicorn unpinned pyproject.toml:12). Add `_active: dict[str, asyncio.Task]` in app.py keyed experiment:{id}, batch:{session}, statrun:{session}, sequence:{id}, seqbatch:{id}; /start and /resume return 409 "This study is already running." when live; /pause cancels the task; GET /progress gains `active: bool` replacing the client-side guess (line 626). Test: two concurrent /resume, second gets 409.
M3. B03's finally runs inside a cancelled anyio scope; gather and the paused write get cancelled; `async with get_async_db()` closes the connection under the shielded write; the test's aclose() raises GeneratorExit and does not exercise this. Put the finally body under `with anyio.CancelScope(shield=True)`; wrap the inner generator in `contextlib.aclosing` in _sse_stream; add a test running uvicorn.Server in a thread, open /start with httpx, close after first progress, assert paused within 1 s.
M4. A5's Gemini fallback (transcript preface in one send_message) changes the stimulus and confounds cross-model comparison. GeminiTarget.seed stores contents; send/reply call client.aio.models.generate_content(contents=history+[user]); no transcript fallback; if that fails, pushback on saved Gemini runs is disabled with the reason shown.
M5. Migration backup via shutil.copy2 misses WAL rows (db.py:542 WAL; sidecar.rs:80-123 taskkill so close() never runs). Use the sqlite3 backup API before executescript(SCHEMA) (db.py:544), PRAGMA integrity_check on the backup; section 16 step 6 likewise. Rebuild sequence is otherwise correct; add `assert not conn.in_transaction` before the PRAGMA and carry over the sqlite_sequence value.
M6. Deleting a probe erases a study's prompt text (experiment_prompts.probe_id ON DELETE SET NULL, db.py:351; text only read via join, db.py:3521, app.py:3145; B13 startup sync rewrites probes.prompt_text, db.py:1471-1474). POST /experiments/{id}/prompts copies probe text into custom_prompt_text; B11 migration backfills; B20 refuses to delete a probe referenced by an experiment_prompts row with no text of its own.
M7. Tasks too large: split T15 into T15a (selected, custom, sending, thread, readout, pushback, done; probe-loop.spec minus saved-run) and T15b (notes, policy links, link-claim dialog, saved-run route, shortcuts); split T33 into T33a (P01, P04, P05, capabilities, plugins; CI Windows cargo check), T33b (P02, P03, P06, P07), T33c (human: installer and manual checks M1-M6); split T11 (Pry ports with tests vs 14 new components); split T21 (Results tab vs Raters+Export).

Minor
m1. T11/T12 circular: FirstTimeTip imports the tour state and tips registry (T12, T31); T12's check needs copy-lint from T11. T11 creates tour/state.svelte.ts and depends on T12, or move copy infra into T10.
m2. Windows CI cargo check fails when ui/build is missing (Pry ci.yml:49 creates it). Add `New-Item -ItemType Directory -Force ui/build` before cargo check.
m3. B05 inconsistent on the HH route (string yields vs e.get; `event: None` default). HH generator yields {"type":"complete", **result}; name falls back to "message"; each experiment route keeps `async with get_async_db()` inside its generator.
m4. Startup sweep (B23) misses stat_runs (stat_runner.py:55), sequence_batches (runner.py:1238; /start refuses non-pending, app.py:2176-2178) and sequences. Sweep stat_runs running->failed, sequence_batches running->cancelled, sequences running->failed.
m5. Fixed depth 0 not honoured (app.py:2149 `and body.fixed_n`). Test `is not None`.
m6. B13 startup sync has side effects (resurrects deleted probes, rewrites text, defeats step 4's probe check). Sync only groups with no probe_variants rows, or on demand when a group is run.
m7. B03 final status uses the current run's counters only; decide from get_experiment_progress (runner.py:526).
m8. get_pending_responses(limit=50000) truncates studies with up to 90,000 cells; page until none remain.
m9. Deleting a session deletes coach examples taught from it (db.py:931); set run_id NULL instead (nullable, db.py:65), or name the loss in the confirm label.

Improvements regardless of verdict
1. T13 depends on T02, T03, T11, T12 (not T02-T27).
2. T20, T22-T26 depend on T13 or T16, not T19, so Studies screens run in parallel.
3. Pin uvicorn and starlette upper bounds in pyproject.toml.
4. Heartbeat every 15 s on sequence-batch and whittle streams (runner.py:1250-1265), as run_experiment does (runner.py:523).
5. Give the 16 test_core_shapes routes Pydantic response_models.
6. test_sse_format asserts Content-Type and Cache-Control: no-cache per route.
7. B09: never feed "[empty response]" (target.py:87) back as an assistant turn.

Steelman antithesis: Option A pays the full no-UI cost until T13 without the frozen-contract benefit (A2a freezes paths, not shapes; Appendix C's errors are shape errors found only by consumers); ~28 of 35 B-items have one consumer and are validated end to end 10-20 tasks later; A1a changes nine routes' wire format blind for a ten-line parser saving.
Tensions: I6 costs transcript fidelity; Option A costs late validation; A1a costs a blind breaking change.
Synthesis: Option A for the foundation only (T01; B02,B12,B15,B16; B01,B09,B10; B05,B33; B07,B21,B22,B29,B32,B34; B03,B04,B11,B36; scaffold+contract; Playwright wiring; shell), then slices carrying their single-consumer B-items (B13->T19, B14->T21, B24->T29, B25/B26->T27, B27->T28, B28->T30); keep A1a and A2a, strengthen A2a with response_models on the 16 core routes.
