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

## PICKUP POINT

Rewritten every time a session is cut.

- 2026-10-16: Plan is at consensus, `Status: pending approval`, committed on `flinch-rebuild-plan`. Next: Brad reads `docs/plans/flinch-rebuild-plan-2026-10-15.md` and approves, requests changes, or rejects. On approval: cut `flinch-rebuild` from `master`, start L0 (T0–T3) with `/oh-my-claudecode:ralph` or `team`, lane briefs under `.omc/plans/flinch-lane-<L>.md`. No code moves before his word.
