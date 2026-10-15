# Flinch rebuild: pre-read for the ralplan session

Written 2026-10-15 in a cloud session that had both repos and the handoff bundle but not the `ralplan`/`ralph` skills. Brad decided the plan itself waits for a session with those skills. This file records the scope as Brad stated it, the baseline, and the Pry reference points that the scope actually needs.

Companion files on this branch (`flinch-rebuild-plan`):

- `docs/plans/handoff-pry-parity-2026-10-15.md`: the original handoff, unchanged. Read §2 (the nine rules) as the spec for "Pry's function philosophy". Its lesson/curriculum material (§3, §6 items 3, 4, 7) is **not** in scope; see below.
- `docs/plans/pry-design-reference.md`: where each design-language rule lives in Pry's code, so the rebuild can match it.
- `docs/plans/evidence/flinch-rebuild-2026-10-15/`: the pre-rebuild baseline (gate results, API route list, UI surface inventory, screenshots at 1280×800 and 1024×700).

## 1. Scope, in Brad's words (2026-10-15, via AskUserQuestion; BINDING)

- "this is a redesign to bring Flinch up to par and matching the design language... there's no rolling in Pry features or anything like that"
- "this is a REBUILD... there is nothing sacred in the UI, just the underlining features"
- "lessons from Pry have nothing to do with Flinch. stay in scope."
- "STOP INVENTING TASKS. stay on spec."

So:

- **In scope:** a full rebuild of Flinch's UI on Pry's design language and function philosophy. Every underlying feature of v0.8.0 is kept (the API and the Python side are the feature set); how it is presented is open.
- **Out of scope:** lessons, the lesson runner or sidebar, a shared UI package, a combined shell, a free local model bootstrap, Pry features of any kind. The handoff's Phase 2 curriculum material is background only; it is not a task list for this plan.
- The plan's tasks come from the handoff §2 rules applied to Flinch's existing screens, plus the handoff §4 workflow and §5 standing rules. Nothing else.

Decisions already made in this session: plan artifacts live on this branch under `docs/plans/`; the plan is drafted in a session that has `ralplan`.

## 2. The spec: handoff §2 rules, as they apply to a UI rebuild

Numbered as in the handoff. Each rule names what it means for Flinch; the reference file says where Pry does it.

1. **Every number shows what it is made of.** Refusal rates, consistency scores, agreement/disagreement, classification confidence, lexical metrics, effect sizes and p-values each show the counts and inputs they come from, beside the number.
2. **Every result carries its limits.** Each Flinch measurement gets a pinned caveat beside its result (the classifier is a keyword scan plus a model's guess; a rate from N runs is a rate from N runs; a held refusal after one pushback is not proof it would hold after two; a refusal may come from a product filter, not the model). The phrases are pinned by tests.
3. **Predict before reveal** applies to lessons and is out of scope here.
4. **Explain, don't rename.** Flinch's real names stay (probe, pushback move, the seven move names, the four outcome names, condition, variant group, MTLD, Cohen's d, Mann-Whitney U). Plain words sit beside the name; no renames.
5. **Lessons** are out of scope.
6. **Guided entry for a first-timer:** first-time tips, glossary hovers, popups placed beside their targets and audited at window sizes, a loading/setup screen that says what it is doing. (No tour on the lesson runner.)
7. **A first-timer rubric scored from screenshots** decides when a screen is done: what am I looking at, why it matters, what next / how back, result with its limits, every number with its source. Scored 0-2 per screen at 1280×800 and 1024×700 until zero below the bar.
8. **Copy is tested like code.** Visible strings pinned, overstatement closures tested, bare numbers and banned model verbs caught.
9. **Public text goes through the brad-voice skill** in main context with critic and cold-read backstops.
10. **Ship as a signed, self-updating installer.** Flinch's Tauri shell already has the distribution half; the updater half (own signing key, `latest.json`, update card, signature check) is the gap. Whether it ships in this release is a plan question.

Standing rules (handoff §5, memory files): reality wins; stick to spec; explain don't rename; brad-voice is the pipeline; decisions via AskUserQuestion only for decisions that are Brad's; no credentials, no merge or release without his word; sensitive probes stay out of every public artifact and screenshot.

## 3. What Flinch is today (for the plan's first task)

- Repo at 7dc2b20, v0.8.0. No `docs/` folder in git; no `CODEBASE_MAP.md`; `.omc/` gitignored.
- UI: 10,338 lines of vanilla JS/HTML served by FastAPI (`render.js` 5,132, `api.js` 1,828, `index.html` 1,293, `experiment.js` 1,022, `components.js` 248, `settings.js` 228, `shortcuts.js` 134, `state.js` 132, `app.js` 321). Dark theme in CSS custom properties, no build step.
- Python: ~13,700 lines. One test file (`tests/test_experiment_pipeline.py`) plus `scripts/verify-phase1.py` (sidecar contract). Flinch's gate set has to be stated in the plan's first task.
- Desktop: Tauri 2 shell, offline installer (bundled python-build-standalone + wheel), keys in Windows Credential Manager, stdin key handoff, `ui/index.html` splash. No updater.
- The feature surface (what the rebuild must keep): see `evidence/flinch-rebuild-2026-10-15/index.md` (UI surface inventory) and `api-routes.md` (every route).
- Research state (Open Brain, 2026-04-09): pairwise experiment scripts built, not run. Not part of this plan unless Brad says so.

## 4. Open decisions for the ralplan session

Only what the scope leaves open. Ask once, with options, when the plan needs them; do not add to this list.

1. **UI stack for the rebuild**: SvelteKit 5 + Tailwind in the Tauri shell (what Pry is), or a rebuild of the vanilla JS app. Either way nothing is shared with Pry's code; "design language" is matched, not imported.
2. **Updater in this release** or manual installs.
3. **Data**: whether existing `flinch.db` sessions and old exports must open unchanged in the rebuilt UI (the schema is untouched by a UI rebuild, so the default is yes).
