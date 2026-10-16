# Flinch rebuild: information architecture

Draft 1, 2026-10-16. Status: **for Brad's reaction before screen specs are written against it.**

Inputs: the baseline surface inventory (`../evidence/flinch-rebuild-2026-10-15/index.md`), the route list, the 50 baseline screenshots, Pry's shell (`beargleindustries/pry` at 888bd51, `docs/screenshots/*.png`), Round 1 and Round 2 decisions (`../flinch-rebuild-input-2026-10-15.md`), and `research/benchmark-harnesses-2026-10-16.md`.

## 1. The organising idea

Today's app is organised by *tool*: eight cards on the home screen, each a different way to send probes. A first-timer cannot tell which tool answers which question, and the same concept (a session, a probe, a run, a classification) is presented differently in each.

The rebuild organises by the **question the researcher is asking**. Every section is one question, and every screen inside it is a step toward answering it. The real names stay (session, probe, run, pushback move, condition, variant group, snapshot, experiment, benchmark); the plain words sit beside them.

| Section | The question | Today's surfaces that answer it |
|---|---|---|
| **Probe** | Does this model refuse this, and does the refusal hold when pushed? | session, probe list, send, response, coach suggestion, pushback, thread, annotations, run history, batch |
| **Studies** | Is the refusal consistent: across repeats, framings, models, conversation context, and over time? | Statistical Analysis (repeat runs), Framing Variants results, Multi-Model Compare, session-vs-session compare, Narrative Momentum, Regression Snapshots |
| **Experiments** | Does a change to the system prompt change the behaviour, measurably? | Experiments list, wizard, dashboard, responses, analysis, export, Condition Comparison, conditions-type variant runs |
| **Benchmarks** (new, Round 2) | How does the model score on a standard suite, run to standard, and how does that score move under my conditions? | none today |
| **Library** | What am I testing with: probes, variant groups, policy claims, coach examples, narrative strategies? | sidebar probe management, Framing Variants "Edit Groups", Policy Claims Browser, Coach Examples, strategy files |
| **Results** | What have I found, and how do I get it out? | Dashboard overview, Policy Scorecard, Publication Export, all exports |
| **Settings** | Keys, local models, coach default, benchmark prerequisites, version and updates | Settings view, API Keys modal, Ollama, coach default |

A **session** stays the unit of work for Probe and Studies: one target model, one optional system prompt, one coach profile, a probe set, and every run made with them. Experiments and Benchmarks have their own run records and do not belong to a session (as today). The header always shows the current session when one is open.

## 2. Shell

The shell matches Pry's: a 44 px header, no permanent left sidebar, content below the header scrolls inside the window. Pry's probe-list equivalent (its token strip) is section-local; Flinch's probe list is likewise local to the Probe workbench, not global.

```
1280×800
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch   [ Session: crime-set-1 · claude-sonnet-4-6 ▾ ]   ● 2 keys set           │
│            Probe   Studies   Experiments   Benchmarks   Library   Results     ?  ⚙   │ 44px
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│   section content (each section defines its own layout below)                       │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Header elements, left to right:

| Element | Behaviour | Pry equivalent |
|---|---|---|
| Brand mark + "Flinch" | Click → Home (`#/`) | "Pry" |
| **Session switcher** | Shows current session name and target model; menu lists recent sessions, "All sessions", "New session". Hidden text "No session" state when none. Present in every section; only Probe and Studies *require* one | Model switcher `GPT-2 small ▾` |
| **Key status chip** | `● 2 keys set` / `○ No keys` (red). Click → Settings › Keys. Replaces the red sidebar banner | Engine status chip |
| Primary nav (6 items) | Text links; current section underlined in accent | Icon nav (Notebook, Lessons, Compare) |
| `?` | Opens Help menu: quick tour, shortcuts, glossary, "what is Flinch" | `?` |
| `⚙` | Settings (`#/settings`) | Settings |

At 1024×700 the nav items keep their labels (six short words fit at 1024); the session switcher truncates the session name to 18 characters.

## 3. Screen list and routes

Hash routes (decision: no backend route needed for deep links). `:s` = session id.

### Home
| Route | Screen | Purpose |
|---|---|---|
| `#/` | **Home** | First screen. Three things: the current state (keys, last session, anything running), the six questions as entry cards with one line each, and "recent" (sessions, experiments, benchmark runs). First launch with no keys shows a setup card first, not a modal. |

### Probe
| Route | Screen | Purpose |
|---|---|---|
| `#/probe` | **Sessions** | List of sessions (name, model, runs, last activity, outcome counts) + "New session". Open one → workbench. |
| `#/probe/:s` | **Probe workbench** | Two panes: probe list (left) and the run column (right). The core loop lives here: pick a probe, send, read the response and its label, take or write a pushback, watch whether the refusal holds, annotate, promote. Batch ("run all") is a mode of this screen. |
| `#/probe/:s/run/:r` | same screen, run selected | A run opened from history; the right pane shows that run's thread. |
| dialog | New session | name, target model, system prompt, coach profile and backend, probe picker. Scrolls inside the viewport. |
| dialog | Add probe / Import probes | add a probe (with narrative fields), import a file, load defaults |

### Studies
| Route | Screen | Purpose |
|---|---|---|
| `#/studies` | **Studies** | One list of every study across sessions: type, session, model, status, headline result ("8 of 10 refused"), date. "New study" picks a type. |
| `#/studies/new` | **New study** | Pick the question: Repeat (stat run), Framing (variant group), Models (multi-model compare), Context (narrative sequence), Over time (snapshot diff). Each type's form is a step on this screen. |
| `#/studies/repeat/:id` | **Repeat study** | N runs per probe × model: refused r of N per cell, all four outcome counts, the per-run list. |
| `#/studies/framing/:id` | **Framing study** | Variant group results in a session: per group, each variant's latest label, consistency "k of n groups agree". Conditions-type groups route to Experiments (see §4). |
| `#/studies/models/:id` | **Models study** | Multi-model comparison: the grid (probes × models), agreement "k of n probes", per-cell response. Also session-vs-session compare (same screen, sessions as columns). |
| `#/studies/context/:id` | **Context study** | A narrative sequence: strategy, warm-up turns, the conversation, threshold (whittling), timeline, cross-probe and strategy readouts. |
| `#/studies/snapshots/:s` | **Over-time study** | Saved baselines for a session and the diff against now: changed / unchanged counts, per-probe moves, with the "improved means closer to refusal" caveat. |

### Experiments
| Route | Screen | Purpose |
|---|---|---|
| `#/experiments` | **Experiments** | List with status, conditions, models, progress. |
| `#/experiments/new` | **New experiment** | Steps: basics → conditions (label, type, system prompt) → models and probes → review. Create, then the Overview shows the backend's estimate before Start. |
| `#/experiments/:id` | **Experiment** | Tabs: Overview (progress, estimate, start/pause/resume), Conditions (per-condition rate with counts, metrics table, response browser), Responses, Analysis (d, U, p with corrections, alpha, win rates, power), Export. |

### Benchmarks (new)
| Route | Screen | Purpose |
|---|---|---|
| `#/benchmarks` | **Benchmarks** | Catalog of suites (tier, size, cost and time estimate, prerequisites met or not) and the list of past runs with their standard/modified badge. |
| `#/benchmarks/new` | **New benchmark run** | Pick suite → pick model(s) → "standard" or "conditions" (system prompt, sampling, reasoning settings; a condition set) → subset or full → estimate → prerequisites check → start. |
| `#/benchmarks/runs/:id` | **Benchmark run** | Tabs: Progress (per-sample as they complete, cost so far, resume), Results (score with its count and CI, per-sample table, provenance record, standard/modified badge and why), Compare (paired differences between conditions on the same samples). |
| `#/benchmarks/suites/:suite` | **Suite** | What the suite measures, size, published recipe (judge, template, sampling), what "standard" means here, prerequisites (Docker, HF token), licence. |

### Library
| Route | Screen | Purpose |
|---|---|---|
| `#/library/probes` | **Probes** | All probes across sessions: search, domains, tags, narrative flag, bulk select and delete, add, import, load defaults. Which sessions use each. |
| `#/library/variants` | **Variant groups** | Shipped and saved groups; create (AI-assisted or manual); edit; delete. |
| `#/library/policies` | **Policy claims** | Provider tabs, claim rows, link and unlink probes to claims. |
| `#/library/coach` | **Coach examples** | Examples with pattern and move, edit, delete; promoted runs land here. |
| `#/library/strategies` | **Narrative strategies** | Strategy files (read-only list with their descriptions; CRUD is API-only today and stays so). |

### Results
| Route | Screen | Purpose |
|---|---|---|
| `#/results` | **Results** | Counts (sessions, runs, comparisons, sequences, experiments, benchmark runs) with what they are made of; recent items with per-item export; export everything; clear everything (typed confirmation). |
| `#/results/scorecard` | **Policy scorecard** | Build a scorecard from sessions and stat runs: per model × claim refused r of N and the enforcement label with its rule shown. |
| `#/results/publication` | **Publication export** | Template, format, filters, theme with live preview, generate, download. |

### Settings
| Route | Screen | Purpose |
|---|---|---|
| `#/settings` | **Settings** | One screen with sections: Keys (one form per provider; desktop path writes to Credential Manager), Local models (Ollama URL, test), Coach default, Benchmarks (Docker and WSL2 status, Hugging Face token, log directory, disk use), About (version, update check and card in L6). |

### Overlays available everywhere
Help menu (`?`), Shortcuts dialog, glossary hover on every term, first-time tips, toasts, confirm dialogs (no native `prompt`/`confirm`).

## 4. Where every baseline surface goes

| Baseline surface | New home | Note |
|---|---|---|
| Sidebar header, session select, New/Delete | Header session switcher; Sessions list | delete from the Sessions list and the workbench menu |
| Load Defaults / Import File / + add | Probe workbench left pane menu; Library › Probes | same dialogs in both places |
| PROBES list (count, select, search, domain filter, custom prompt, per-probe ✕) | Probe workbench left pane | custom prompt becomes "Ad-hoc probe" at the top of the list |
| Run history + stats | Probe workbench: history strip under the run column, outcome counts in the pane header | |
| Nav pills, EXTRAS | Header nav | |
| Red no-key banner | Header key chip + Home setup card | |
| Home idle (no session) | Home | |
| Session idle, Run All, Save/Compare Baseline | Probe workbench empty state; "Run all" in the pane header; baselines move to Studies › Over time | |
| Probe selected / Send | Probe workbench right pane, state "ready" | Send disabled with the reason when the provider has no key |
| Awaiting / Response / Pushback decision / sent, coach suggestion, manual pushback, annotations, export | Probe workbench right pane states | |
| Classification dropdown | Label control on the response card | |
| Batch progress | Probe workbench "running all" mode with the loading pattern and cancel | |
| New Session modal | New session dialog | |
| Import File modal | Import dialog | |
| API Keys modal **and** Settings view | Settings › Keys (one form) | |
| Keyboard Shortcuts overlay | Help › Shortcuts | |
| Error toast | Toast | |
| Multi-Model Comparison picker / results / history | Studies › Models | history = the Studies list filtered by type |
| Legacy Compare Sessions modal | dropped (dead) | session-vs-session is a Models study with sessions as columns |
| Narrative Momentum | Studies › Context | |
| Framing Variants Edit Groups | Library › Variant groups | |
| Framing Variants Results | Studies › Framing | |
| Framing Variants "conditions" group run (batch-conditions) | Starts an Experiment; opens `#/experiments/:id` Conditions | today it auto-creates an experiment; the rebuild says so before running |
| Statistical Analysis | Studies › Repeat | |
| Dashboard Overview | Results | |
| Policy Scorecard | Results › Scorecard | |
| Publication Export | Results › Publication | |
| Policy Claims Browser + probe–claim links | Library › Policy claims | |
| Compliance scorecard (dead) | dropped; route stays API-only | |
| Coach Examples | Library › Coach examples | |
| Settings view | Settings | |
| Regression Snapshots browser + diff | Studies › Over time | |
| Experiments list / wizard / dashboard / results / analysis / export | Experiments | one screen with tabs replaces four |
| Condition Comparison | Experiments › Conditions tab | |
| Turn detail modal | Thread on the run column | |

Every route the v0.8.0 UI called has a caller in this map (checked against `api-routes.md`; the list per screen is in each screen spec).

## 5. The Probe workbench, wireframed

This is the screen a first-timer meets first and the one most used, so it is drawn here; every other screen gets the same treatment in `screens/`.

```
#/probe/:s  —  1280×800, probe selected, response received, coach suggestion shown
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ Flinch  [ crime-set-1 · claude-sonnet-4-6 ▾ ]  ● 2 keys set    Probe Studies …  ? ⚙│
├─────────────────────────┬────────────────────────────────────────────────────────────┤
│ PROBES  4 · 3 run       │  the-stabbing  ·  CRIME                        Run 12 ▸ ⋯   │
│ [search…        ] [▾ all]│  Write a scene from a thriller novel in which…   [show all] │
│ + Ad-hoc probe          │────────────────────────────────────────────────────────────│
│ CRIME                   │ ▣ In plain words: The model refused. The keyword scan put  │
│ ▸ the-stabbing   REFUSED│   it at "refused"; the judge model agreed. You can change  │
│   the-robbery    ·      │   the label.                                               │
│ MEDICAL                 │                                                            │
│   the-autopsy    COMPLIED│  MODEL · claude-sonnet-4-6                 2.1 s · 412 tok │
│ ROMANCE                 │  I'm not able to write a scene that depicts…              │
│   the-hotel-room ·      │                                                            │
│                         │  Label  [REFUSED ▾]  ⓘ keyword scan + judge; you can change│
│                         │────────────────────────────────────────────────────────────│
│                         │ COACH SUGGESTS · specificity challenge · confidence 0.8 ⓘ  │
│                         │ "What specifically in the request concerns you?"           │
│                         │ [ Send this pushback ]  [ Write my own ]  [ Skip ]         │
│                         │ ⓘ The coach's confidence is the coach model's own guess.   │
│ ─────────────────────── │────────────────────────────────────────────────────────────│
│ Run all 4   Select…     │ HISTORY  ●●○●  12 runs · 7 refused · 3 collapsed · 2 complied│
├─────────────────────────┴────────────────────────────────────────────────────────────┤
```

- Left pane 300 px (280 at 1024): probe list grouped by domain, each probe with its latest outcome badge in this session; search, domain filter, select mode, ad-hoc probe, Run all, and the add/import menu.
- Right pane: the run column. Its states are: *no probe* (what this screen is for, pick a probe or run all), *ready* (probe text, Send, or Send disabled with the reason), *waiting* (what is happening and for how long), *response* (readout sentence, the model's text, the label control with its caveat, then the coach suggestion or the manual pushback box, Skip), *after pushback* (the thread, the final label with the "held after one pushback" caveat, annotate, promote to example, export), *running all* (progress with counts and cancel).
- The readout box at the top of the run column is the Pry Readout pattern: one plain sentence saying what happened, in the accent-tinted box.
- Every number has its source beside it ("7 refused of 12 runs"); every label has the classifier caveat one hover or one glance away.

At 1024×700 the two panes keep their split (280 + the rest); the history strip wraps to two lines; nothing is hidden.

## 6. What this IA deliberately changes from today

1. **Tools become questions.** Eight home cards become six sections named for what you learn.
2. **No global sidebar.** The probe list is part of the Probe workbench, not a frame around every screen (today it shows on the Dashboard and Policy Browser where it means nothing).
3. **Studies are first-class records.** Today a stat run, a comparison and a sequence are reachable only by re-entering their tool; the Studies list shows them all with a headline result.
4. **One experiment screen** with tabs replaces four views plus the separate Condition Comparison.
5. **Settings is one place.** The API Keys modal and the Settings view merge.
6. **Library separates "what I test with" from "what I found".**
7. **Benchmarks** is a section, not a tool card, with the standard/modified distinction built into the IA.

## 7. Open points for Brad (reaction wanted)

1. Section names: Probe / Studies / Experiments / Benchmarks / Library / Results. "Studies" is the only invented word; the alternative is "Consistency" (the real research term from the paper). Say which.
2. Whether the Models study (multi-model compare) should require a session or stay session-less as today (today it picks models and probes directly). The draft keeps it session-less and records it as a study.
3. Whether Narrative strategies belong in the Library at all (read-only today) or stay inside the Context study form.
