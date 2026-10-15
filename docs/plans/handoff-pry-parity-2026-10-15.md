# Handoff: rebuild Flinch on Pry's design and function philosophy

Written 2026-10-15 at the end of the Pry 0.4.0 (Lessons) release session. Give this file to a fresh session that starts in `C:\Users\Brad\Documents\Claude Code\flinch`. It says what Flinch is today, what Pry became, which rules carried Pry there, where every reference lives, and what the first session should do. Nothing here is a plan yet. The first deliverable is a ralplan brief, approved by Brad, before any code moves.

## 0. One-screen summary

- Flinch is a working research tool (v0.8.0, Python FastAPI + a 10k-line vanilla JS UI + a Tauri shell) that measures whether AI models enforce content rules consistently. It was built fast and feature by feature. Its UI never had the pass Pry got.
- Pry 0.4.0 is the reference: every number shows its measurements, every result carries its limits, first-timers are asked to predict before they see a result, lessons drive the app from a Markdown format through a tool-agnostic runner, popups sit beside their targets and are audited, all public text goes through Brad's voice pipeline, and the whole thing ships as a signed, self-updating Windows installer.
- Pry's approved curriculum already reserves Flinch's place: stages 5 and 6 of a six-stage arc (prompt engineering as controlled experiments, then refusal-consistency research), two bridge lessons, and a Flinch action set plugged into Pry's runner. That is the target.
- Brad's standing rules apply unchanged: reality wins, stick to the approved spec, explain don't rename, every public sentence through the brad-voice skill, decisions via AskUserQuestion, and never a credential or a merge/release without his word.

## 1. Where Flinch is now

Repo: `C:\Users\Brad\Documents\Claude Code\flinch` (GitHub `BeargleIndustries/flinch`, MIT, master @ 7dc2b20 "Add Windows desktop installer"). Working tree has one deleted probe file and an untracked `CODEBASE_MAP.md`; ask Brad before touching either.

Read first, in this order:

1. `CLAUDE.md` (stack, conventions, key paths, the Tauri shell layout).
2. `README.md` (the public feature list; verified against code in March, so treat it as accurate but check anything you build on).
3. `CODEBASE_MAP.md` if it is still there (untracked; someone generated it recently).
4. `flinch/playbook.md` (the research method the coach follows: seven pushback moves, the refusal taxonomy).
5. `docs/` (one note per feature: `flinch-mvp.md`, `narrative-momentum.md`, `dashboard.md`, `deception-honesty-experiment.md`, `experiment-pipeline-bridge.md`, `no-cli-release-v2.md` which is the RALPLAN-DR for the desktop installer).
6. Vault (`C:\Users\Brad\Documents\Dropbox\Claude\Vault`): `projects/flinch/flinch.md` (overview, competitors, cost estimates) and `projects/flinch/research-landscape-2026-03.md` (positioning: "a policy enforcement quality tool, not a red-teaming tool").

What is actually there:

- **Backend** `flinch/`: `app.py` (FastAPI, `READY {port}` sentinel, API keys over stdin in sidecar mode), `runner.py` (probe → classify → coach → pushback), `coach.py`, `classifier.py` (keyword scan + Haiku judge), `target.py` (Claude, OpenAI, Gemini, xAI, Together, Ollama), `db.py` (SQLite is the source of truth), `models.py` (Pydantic), the experiment framework (`stat_runner.py`, `lexical.py`, `metrics.py`, `stats.py`, `rater.py`, `hh_import.py`, `prolific.py`), export and themes (`publication.py`, `reporting.py`, `themes/`).
- **Frontend** `flinch/static/`: `index.html` (1,293 lines), `app.js`, `render.js`, `components.js`, `experiment.js`, `settings.js`, `shortcuts.js`, `state.js`, `api.js`. No build step, no component model, dark theme in CSS custom properties.
- **Desktop** `src-tauri/`: Tauri 2 shell adapted from Pry's, but it bundles python-build-standalone plus the Flinch wheel inside the installer (offline first launch; ~50 MB of deps, so no runtime download). API keys live in Windows Credential Manager and reach the sidecar over a stdin pipe. `ui/index.html` is the bootstrap splash. Last release: `v0.8.0-desktop`.
- **Data** `data/flinch.db` in dev, `%APPDATA%\Flinch\flinch.db` installed. Probes are Markdown in `flinch/probes/`; the sensitive ones are gitignored on purpose and must stay out of any public artifact.
- **Research state** (Open Brain, 2026-04-09): the deception/honesty experiment's single-prompt analysis is done (47 of 168 comparisons significant after Bonferroni); pairwise scripts exist and were not yet run. Ask Brad whether that pipeline is in scope for the rebuild or frozen.

## 2. What Pry became, and the rules that got it there

Pry repo: `C:\Users\Brad\Documents\Claude Code\interpretability` (GitHub `BeargleIndustries/pry`, master @ 888bd51, release `v0.4.0-alpha` published 2026-10-15, in-app update from 0.3.8 confirmed working). Read Pry's `README.md` and the `## 0.4.0` entry of `CHANGELOG.md` first; they are the shortest honest description of the result.

The philosophy, as rules you can check against code:

1. **Every number shows what it is made of.** A probability is a bar on a 0 to 100% track with an "everything else" row. A DLA total line shows the bars' total, the logit itself and the gap, with the gap's source named. A Swap test cell shows its three logits and the share formula. Steering shows what changed, a norm-matched control, and the coherence numbers with their source. A lesson never types a number: every figure is a slot bound to a live readout with a recorded expected value, and a drift test says which row moved if a library changes. Pry files: `ui/src/lib/readouts.ts`, `ui/src/lib/components/PredictionsPanel.svelte`, `DLAPanel.svelte`, `PatchingPanel.svelte`, `SteeringPanel.svelte`; lesson slots in `ui/src/lib/lessons/format/` and `ui/src/lessons/__generated__/rows.json`; drift mode `sidecar/tests/test_lessons.py`.
2. **Every result carries its limits.** Each tool has a pinned honesty caveat that must sit beside its result, in the app and in lessons, and tests pin the exact phrases (`ui/src/lib/copy/caveats.test.ts`, lessons lint "pinned caveat"). Compare is correlation. DLA counts direct pushes only. Labels are an AI's guess. A knockout that changes nothing is not proof of no use. The README's "What to keep in mind" section is the user-facing version.
3. **Predict before reveal, then say what happened.** Lessons ask for a guess, hide the panel until the learner commits, then compare the app with the guess in one message. Feedback never grades ("wrong", "great job"); it says what happened and why. Misconceptions are named targets (M1, N7, T5 and so on); a `predict` choice is tagged with one and a later `:refutes[...]` answers it. Reference: `.omc/plans/curriculum/04-concept-map.md` (the misconception catalogue is in it), `05-style-guide.md`, `06-outline-template.md`, and the 20 built lessons in `ui/src/lessons/pry.*/lesson.md`.
4. **Explain, don't rename.** Real concept names stay (logit, residual stream, DLA, SAE, activation patching). Plain words go beside the name, a term is introduced before use, at most one new term per section and three per lesson, every metaphor says where it breaks. Pry's own UI labels that differ from the concept are mapped in `05-style-guide.md` §2. The lesson linter enforces the term order from `ui/src/lessons/terms.yaml`.
5. **Lessons drive the app through a tool-agnostic runner.** A lesson is Markdown (front matter + `:::kind` directives) normalised to JSON and Zod-validated. The runner knows nothing about Pry; Pry supplies an action set (actions, readouts, anchors, views) through a registry contract. Flinch is meant to supply its own. Files: `ui/src/lib/lessons/registry/contract.ts` (the contract), `pry-actions.ts`, `pry-readouts.ts`, `pry-anchors.ts`, `pry-views/`, `dispatcher.ts`, `memo.ts`; runner `ui/src/lib/lessons/runner/`; format `ui/src/lib/lessons/format/`; public docs `docs/lessons/AUTHORING.md` and the generated `docs/lessons/ACTIONS.md`; CLI linter `ui/build-cli/lessons-lint.mjs` (built by `npm run build:cli`). The format is `format: 1`, frozen; additions are allowed, changes are not. Three outsiders (fresh agents) wrote lessons from the docs alone; their feedback rounds are in `docs/lessons/examples/`.
6. **Guided entry for a first-timer.** A 12-step overlay quick tour on the same runner, first-time tips, glossary hovers (`Term.svelte`), a loading screen that says which step it is on, and a Lessons sidebar docked beside the app (never over it; tabs below 1024 px). Popups are placed beside their targets by `ui/src/lib/popup/place.ts` and audited at four window sizes by `scripts/dev/popup-audit.mjs` (must exit `FAIL 0 / SKIP 0`), with an axe a11y pass and a geometry diff against the previous release.
7. **A first-timer rubric scored from screenshots decides when it is done.** Five criteria per lesson section (what am I looking at, why it matters, what next / how back, asked to predict first, result with its limits), scored 0 to 2 by a critic agent from real-app screenshots at 1280×800 and 1024×700. Pry went 52 → 26 → 10 → 3 → 0 sections below the bar over five rounds. The plan's T8 section (`.omc/plans/pry-learning-mode-2026-10-12.md` around line 560) has the exact criteria; `.omc/evidence/pry-learning-2026-10-12/rubric-final.md` has the final table. The walk driver is `scripts/dev/lesson-walk.mjs` (CDP over the debug build).
8. **Copy is tested like code.** Visible strings are pinned (`ui/src/lib/copy/visible-strings.ts` and the `copy-*.test.ts` files), overstatement closures are tested, the lesson linter rejects bare numbers in prose, qualitative words outside asserts, banned model verbs ("knows", "wants") outside a refutation, more than one exclamation mark per lesson.
9. **Public text goes through the brad-voice skill, in main context, with backstops.** Not the lint alone. The lanes that only ran the lint shipped slop (phantom foils, define-by-negation, "is real" tails) and Brad caught it. Memory `brad-voice-is-the-pipeline` has the rule; the PR #17 body, README, CHANGELOG, AUTHORING and all 20 lessons were rewritten that way on 2026-10-15.
10. **Ship as a signed, self-updating installer.** `scripts/release.ps1` signs with `~/.tauri/pry-updater.key` (never committed; Brad backs it up) and writes `latest.json`; `docs/releasing.md` has the steps; releases are never pre-releases because GitHub's `latest` URL skips those. Smoke runs on the debug build with a scratch `PRY_RUNTIME_DIR`, never by launching the release exe locally (it re-syncs the sidecar into Brad's installed runtime). Flinch's shell already mirrors the distribution half of this; the updater half (signing key, `latest.json`, update card, signature check) is the gap.

## 3. What Pry's plan already decided about Flinch

These are binding inputs, decided by Brad during Pry's planning (`.omc/plans/learning-mode-input-2026-10-12.md` is the round-by-round record; rounds 1 to 12 are his decisions):

- Flinch (Phase 2) gets a **full UI rebuild on Pry's design language plus the same sidebar and lesson runner**. Phase 1 was built so as not to paint Phase 2 into a corner: the runner and format are tool-agnostic, and a tool plugs in by supplying an action set.
- The learning arc is six stages. Pry covers 1 to 3 and the first bridge lesson (P4.1, "Why doesn't GPT-2 act like ChatGPT?", which seeds base model, fine-tuning and system prompt). Flinch covers the other two bridge lessons (B2, B3) and stages 5 and 6: prompt engineering as controlled experiments (baseline, change one thing, run enough times to see a rate, check the limits) and refusal-consistency research (a follow-up that tests why a model refused, classify whether the refusal held, write the finding with its limits). Concepts C25 to C35 and the Flinch lesson titles are outlined in `04-concept-map.md` §3.5 and §7.3; they are outlines, not approved lessons, so they go through the same outline → review → approval gates Pry's did.
- **Flinch costs money and needs API keys**, and the primary learner has handled neither. Phase 2 needs a free local default (Ollama is already supported) so the lessons run without a key, and the key-and-cost note belongs in the first Flinch lesson, not buried in settings.
- Flinch measures; it is not a jailbreak tool, and the sensitive probes stay out of public artifacts, screenshots and lessons.
- Out of Pry's scope and therefore open for this plan: the Flinch action set, bridge lessons B2/B3, a shared UI package, a combined shell, classroom features, branching lessons.

## 4. The workflow that worked for Pry

1. **Gather, then ralplan.** Pry's plan went through five architect/critic rounds (`review-architect-lm-2026-10-12.md`, `review-critic-lm-2026-10-12.md`) and a separate curriculum track (concept map, style guide, outline template, 20 outlines, each with its own review) before Brad approved rev 7. Brad's answers were collected with AskUserQuestion, one call per round, and recorded in the input file. Copy that shape: `.omc/plans/learning-mode-input-2026-10-12.md` is the template for the input record.
2. **Build with `/oh-my-claudecode:ralph`** on a feature branch, lanes in git worktrees, one brief per lane (`.omc/plans/ralph-lane-brief-2026-10-13.md`), decisions logged in `progress.txt`, a PICKUP POINT rewritten in the input file every time a session is cut (they were cut often: usage limits, expired OAuth).
3. **Evidence folder** from day one (`.omc/evidence/<plan>/index.md` lists baselines, gate counts, harness output, screenshots, rubric tables, voice transcripts). Architect verification against the PRD, then the deslop pass, then regression, then cancel.
4. **Gates** every lane must keep green, from Pry: `npm run check` 0 errors, `npm test` (1466 at the end), lessons lint `--release` 0 errors, `cargo test`, sidecar pytest including drift mode. Flinch's equivalents exist in part (`scripts/verify-phase1.py`, pytest); the rebuild plan should state Flinch's gate set in its first task.
5. **Rubric rounds from screenshots** until zero sections below the bar, then the outsider gate (a fresh agent writes a lesson from the docs alone), then build, walk, release notes.

## 5. Brad's standing rules (verbatim where it matters)

- "stop inventing things and then acting confused about it. stick to reality. this is about teaching real existing concepts. reality wins, every time." When a measurement contradicts an outline claim, the lesson states the real result; never ask whether to follow reality.
- Stick to the approved spec. Agents do not invent changes and forward them to Brad as choices; reject them.
- Explain, don't rename. No plain-word renames of real concepts; every shown number comes with the measurements behind it.
- All user-facing copy (UI, tour, tips, lessons, changelog, release notes, README, PR descriptions) through `/anthropic-skills:brad-voice`, run in main context, with the critic and cold-read backstops. The lint is the backstop, not the pass.
- Questions to Brad go through AskUserQuestion, with options plus Other, only for decisions that are his. Do not stop between steps once he has said go ("the point of using /ralph is that you don't stop between steps").
- Never enter credentials or accept licences for him; never print API keys or the HF token; never commit a signing key; never install over his running apps; merges to master and releases wait for his explicit word, then happen without further asking.
- Do not touch his other projects' processes (Etsy vite on 5173, WhiskyGame 8097/8099, Codex, MCP servers) or worktrees named `distracted-pasteur-*` / `stoic-shirley-*` in the Pry repo.

Memories to read in `C:\Users\Brad\.claude\projects\C--Users-Brad-Documents-Claude-Code-interpretability\memory\`: `reality-wins.md`, `stick-to-spec.md`, `explain-dont-rename.md`, `public-text-brad-voice.md`, `brad-voice-is-the-pipeline.md`, `pry-release-state.md`, `pry-test-launch-runtime.md`, `pry-updater-key.md`. The Flinch project's memory folder is `C:\Users\Brad\.claude\projects\C--Users-Brad-Documents-Claude-Code-flinch\memory\`; read whatever is in it.

## 6. Decisions the first session has to get from Brad

Put these in the pre-plan AskUserQuestion rounds. Do not assume.

1. **UI stack.** Pry is SvelteKit 5 (runes) + Tailwind inside Tauri. Flinch's UI is vanilla JS served by FastAPI. Options: rebuild Flinch's UI in SvelteKit so the lesson runner, popup placement, Term/tips, Readout and the copy tests are shared (a shared UI package, which Pry's ADR lists as a follow-up); or port the runner and design tokens into the vanilla JS app. The first option is what "same sidebar/lesson runner" implies; confirm it and how the package is shared (npm workspace across two repos, git subtree, or a copy with a sync script).
2. **Scope of "rebuild".** Which existing Flinch surfaces survive: the session runner and coach loop (core), comparisons, statistical runs, framing variants, narrative momentum, policy scorecards, the experiment framework and rater pipeline, themed exports. Each needs a yes, a "keep as is behind the new shell", or a cut.
3. **Backend changes.** The Python side mostly stays. The rebuild needs a lesson-facing API surface for the action set (actions, readouts, anchors) and probably deterministic fixtures (recorded responses) so lessons have expected values; model outputs are nondeterministic across providers, so decide what "expected value" means for Flinch (a recorded transcript per lesson row, a rate with a tolerance, or a local Ollama model pinned by digest).
4. **Free local default.** Which Ollama model ships as the lesson model, how it is downloaded (Flinch has no runtime download today; Pry has the whole bootstrap flow), and what the no-key experience looks like.
5. **Updater.** Whether Flinch gets Pry's signed-updater path now (needs its own key, `latest.json`, update card) or stays on manual installs for the rebuild release.
6. **Data.** Migration of existing `flinch.db` sessions into whatever the rebuilt UI expects; whether old exports must still open.
7. **Lesson set for the first release.** B2/B3 plus how many of the §7.3 titles; whether any Pry lesson concepts need re-teaching cold for someone who starts in Flinch (the concept map's `cold_entry` pattern answers this).
8. **Research pipeline freeze.** Whether the pairwise experiment scripts run before or independent of the rebuild.

## 7. Suggested first session

1. Read sections 1 to 3 above and the files they point at. Budget most of the session for reading Pry's plan, concept map, style guide and `contract.ts`; the rebuild inherits their decisions.
2. Run Flinch locally (`pip install -e .`, `python -m flinch.app`) and the desktop build's `scripts/verify-phase1.py` so the baseline is recorded before anything changes. Capture baseline screenshots of every Flinch screen at 1280×800 and 1024×700 into `.omc/evidence/flinch-rebuild-<date>/`.
3. Write the ralplan input file (`.omc/plans/flinch-rebuild-input-<date>.md`) with the section 6 questions as round 1, and ask them.
4. Only after Brad's answers: `/oh-my-claudecode:ralplan` for the rebuild, with a curriculum track (B2, B3, stage 5 and 6 outlines through the same gates Pry used) and a build track (shell, design tokens, runner integration, Flinch action set, rubric, release). Mark the plan `pending approval`; Brad approves before any code.

## 8. Gotchas carried over from Pry

- `core.autocrlf=true` on this machine: CRLF checkouts change hashes of bundled files; keep resources LF via `.gitattributes`, normalise before hashing. Generators that write LF (Pry's `lessons:schema`) show as whole-file diffs; restore them if only line endings changed.
- `cargo tauri build` rewrites `src-tauri/Cargo.toml` line endings; restore the bytes afterwards (Pry's `release.ps1` does).
- A debug Tauri build on a fresh WebView2 profile lands on the first-run welcome screen; a CDP harness has to click through it before the app's hooks exist.
- Writing escape sequences through bash heredoc → python inserts literal CR/LF; use the Edit tool for those.
- The auto-mode classifier blocks `gh pr merge` unless Brad said "merge" in that turn.
- Pry's harness scripts assume Node 22 and a debug build with `VITE_POPUP_AUDIT=1`; the walk driver attaches over `--remote-debugging-port=9333`.

## 9. Links

- Pry repo and release: https://github.com/BeargleIndustries/pry, https://github.com/BeargleIndustries/pry/releases/tag/v0.4.0-alpha
- Pry PR #17 (the Lessons build, with its description as a model of the voice): https://github.com/BeargleIndustries/pry/pull/17
- Flinch repo and last desktop release: https://github.com/BeargleIndustries/flinch, https://github.com/BeargleIndustries/flinch/releases/tag/v0.8.0-desktop
- Flinch project page: https://beargleindustries.com/projects/flinch
- The research Flinch grew from: https://beargleindustries.com/notes/rules-are-rules-until-they-arent
