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

## PICKUP POINT

Rewritten every time a session is cut.

- 2026-10-15: Round 1 answered. Planner → Architect → Critic consensus loop running in session `session_01B6DGxTn5V3HWseKeTegDyZ`. Plan marked `pending approval` on exit; Brad approves before any code.
