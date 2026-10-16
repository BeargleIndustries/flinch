# Flinch rebuild: ralplan input record

Round-by-round record of Brad's decisions for the Flinch UI rebuild plan, in the shape of Pry's `learning-mode-input-2026-10-12.md`. Each round is one `AskUserQuestion` call. Decisions here are binding on the plan; the plan cites them by round number.

Plan file: `docs/plans/flinch-rebuild-plan-2026-10-15.md` (status in its header).
Pre-read: `docs/plans/flinch-rebuild-pre-read-2026-10-15.md` (§1 scope is binding).

## Round 0 (2026-10-15, previous session): scope

Recorded in the pre-read §1. Full UI rebuild on Pry's design language and function philosophy; every underlying v0.8.0 feature kept; lessons, lesson runner, shared UI package, combined shell, free local model bootstrap, and all Pry features out of scope. Plan artifacts live on branch `flinch-rebuild-plan` under `docs/plans/`.

## Round 1 (2026-10-15, this session): the pre-read §4 open decisions

Asked once, three questions in one call, before the Planner drafted anything.

| # | Question | Brad's answer |
|---|---|---|
| 1.1 | UI stack for the rebuild | **SvelteKit 5 + Tailwind in the Tauri shell.** Same toolchain as Pry; static build; copy tests, Term/tips/Readout components, popup placement and the CDP popup audit take Pry's shape. Nothing is shared with Pry's code; the design language is matched, not imported. |
| 1.2 | Signed self-updating installer in this release | **Yes, as a separable final lane.** Own Flinch signing key (Brad generates and backs it up; never committed), `latest.json`, update card, pubkey in `tauri.conf.json`, release script mirroring Pry's. Last lane; droppable without touching the rest. |
| 1.3 | Data compatibility | **Schema untouched; existing `flinch.db` opens unchanged.** The rebuild is UI-only against the existing API. An existing DB is a required fixture in the plan's gates. |

## Consensus record (2026-10-16)

Planner → Architect → Critic, four iterations in session `session_01B6DGxTn5V3HWseKeTegDyZ`; every finding and its disposition is in the plan's §14.

| Iter | Architect | Critic | What changed |
|---|---|---|---|
| 1 | SOUND WITH CHANGES (1 blocker: non-deterministic build output) | ITERATE (21 findings) | G6 made deterministic; lanes never commit `flinch/static`; batch-conditions flow restored to the surface map; rubric bar redefined; FDR and cost caveats corrected; Q2 dropped as invented; Q1 recorded as baseline problem 16 |
| 2 | SOUND WITH CHANGES (A18–A24; security case against a fixed sidecar port) | ITERATE (C22–C29; cookie option for rule 6) | Rule-6 state moved to cookies on 127.0.0.1 (not port-isolated), fixed port and its shell change dropped; lane gate order serves the lane's own build; experiment progress polled (problem 18); estimate shown after Create; splash checked under the real CSP |
| 3 | SOUND WITH CHANGES (A25–A28) | APPROVE conditional on C30–C32 | Experiment run stream held in a module-level store so navigating inside Flinch does not end a run; update check gated on the runtime being installed; `/resume-conditions` added; rollback command corrected; problem 19 recorded |
| 4 | (fold-in only) | APPROVE, no regressions | Final |

Backend changes in the approved plan: B1–B5 (dead test, missing `import logging`, version 0.5.0→0.8.0, `/_app` static mount, Load Defaults H1 import) plus B6 conditional on a Windows check. Nothing else under `flinch/*.py` or `src-tauri/` outside the updater lane.

Open question for Brad, asked when L4 starts: Q1, the policy scorecard enforcement labels (baseline problem 16).

## Round 2 (2026-10-16): the iteration-4 plan is rejected; ground-up replan

Brad's verdict on `flinch-rebuild-plan-2026-10-15.md` (iteration 4): "almost none of that is about the app design and even the parts that are are deeply vague and basically just hint at a direction the design could go. none of this is actually a build plan by any standard. if you gave this to a team of developers they'd have no clue what they needed to do." The file is kept as `docs/plans/superseded/` history only; nothing in it is reused without re-justification.

| # | Question | Brad's answer |
|---|---|---|
| 2.1 | Form of the design spec | **Text specs + wireframes in the repo**: one file per screen under `docs/plans/design/`, with layout wireframes, a component inventory, concrete tokens, and end-to-end flows. The lanes build from these. |
| 2.2 | How much of the old plan survives | **Ground-up replan.** |
| 2.3 | New scope: a **Benchmarks section** | Run standard benchmarks to standard (comparable to published scores), and run the same suite under Flinch-defined conditions and compare, the way condition experiments compare system prompts today. This supersedes the pre-read §1 line "no new features" for this one feature; everything else in §1 stands. |
| 2.4 | Suites in the first release | **Pluggable runner shipping three suites**: SWE-bench Verified, one knowledge suite (GPQA or MMLU-Pro), one refusal suite (XSTest or OR-Bench). Exact picks for the knowledge and refusal suites are a plan question, decided from the research. |
| 2.5 | What varies between conditions | **System prompt; model and provider (incl. local Ollama); sampling and reasoning settings** (temperature, max tokens, reasoning effort or thinking budget where exposed). Not agent-scaffold settings. The pushback coach loop is not part of benchmarks. |
| 2.6 | Where runs execute | **Locally on Brad's machine, Docker required for SWE-bench.** The app drives the harness as a local process, shows cost and time estimates before a run, supports resumable partial runs and task subsets. |

Decisions 1.1–1.3 (stack, updater, schema) stand, except that the benchmark section needs new tables; 1.3 ("schema untouched") therefore narrows to: existing tables and columns are untouched and an existing `flinch.db` opens unchanged; additive tables for benchmarks are allowed.

## Round 3 (2026-10-16): information architecture

| # | Question | Brad's answer |
|---|---|---|
| 3.1 | Does the IA in `design/01-information-architecture.md` hold (six sections by research question plus Settings, Pry-style header with session switcher, no global sidebar, two-pane Probe workbench)? | **Yes, write the screen specs against it.** §7 open points 2 and 3 take the draft's defaults (Models study stays session-less; narrative strategies listed read-only in the Library). |
| 3.2 | Name of the consistency section | **Studies.** |

## PICKUP POINT

Rewritten every time a session is cut.

- 2026-10-16: Rounds 1–3 answered. Design groundwork in `docs/plans/design/`: Pry vocabulary, benchmark research, IA (approved in Round 3), tokens, components. Next: content inventory saved, one spec per screen under `design/screens/`, `design/benchmarks.md`, `design/04-flows.md`, then the build plan re-cut against the specs (`docs/plans/flinch-rebuild-plan-v2.md`). Nothing is approved for execution; no code moves.
