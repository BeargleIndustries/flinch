# Home

- Route(s): `#/`
- Section: Home
- Purpose (one sentence, what the researcher does here): sees where things stand (keys, the last session, anything running), picks the question to answer next, and on first launch sets a key without a modal getting in the way.
- Arrives from: app launch (browser load of `GET /`, or the Tauri bootstrap splash navigating to the sidecar URL), the brand mark in the header from any screen, the Tauri splash after first-launch setup. Leaves to: the six sections via the question cards or the header nav; `#/settings#keys` from the setup card or the key chip; the New session dialog from "New session"; `#/probe/:s` from a recent session row; `#/experiments/:id` from a recent experiment. Back: the header nav (Home is the brand mark); the browser back button walks hash routes.
- Components used (names from `../03-components.md`): Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu, Panel, InsetBox, EmptyState, Readout, Term, Caveat, Rate, Stat, Card, Button, Input (password), Table, Chip, Dialog (New session), Toast, FirstTimeTip, ProgressCard, LoadingScreen (Tauri bootstrap only, before this screen).
- Baseline surfaces replaced (from `../00-content-inventory.md`): §7 Home idle (hero and tool cards), §6 red no-key banner, §14 API Keys modal (its auto-open on first run becomes the setup card; the key form itself lives in Settings › Keys and is repeated in the setup card), §5 sidebar nav pills and EXTRAS, the session `<select>` from §1 (now the header SessionSwitcher).

All visible strings in this spec are drafts (draft; brad-voice pass). No probe text appears on Home; probe names come from `flinch/probes/example-probes.md` only.

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch   [ No session ▾ ]   ○ No keys        Probe Studies Experiments Benchmarks Library Results   ? ⚙ │ 44 px
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1 SET UP FLINCH                                                           v0.8.0     │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ▣ No provider key is set, so nothing can be sent to a model yet. You can still   │ │
│ │   add and import probes, read past sessions and export them.                     │ │
│ │                                                                                  │ │
│ │ Anthropic (Claude)   ○ not set   [ sk-ant-…            ] [Save and test]         │ │
│ │ OpenAI (GPT)         ○ not set   [ Add key ]                                     │ │
│ │ Google (Gemini)      ○ not set   [ Add key ]                                     │ │
│ │ xAI (Grok)           ○ not set   [ Add key ]                                     │ │
│ │ Together AI (Llama)  ○ not set   [ Add key ]                                     │ │
│ │ Ollama (local)       ○ not detected at http://localhost:11434  [Check again]     │ │
│ │                                                                                  │ │
│ │ WHAT WORKS WITHOUT A KEY                                                         │ │
│ │ · Library: add, import and load the example probes (3 in the library now)        │ │
│ │ · Probe: open past sessions and read their runs (0 sessions)                     │ │
│ │ · Results: export anything already recorded                                      │ │
│ │ · Labels: with no key the label is the keyword scan alone, no judge model        │ │
│ │                                                       [Do this later]            │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│ R2 (RUNNING NOW: shown only while a batch or experiment is running; absent here)     │
│ R3 WHAT DO YOU WANT TO FIND OUT?                                                      │
│ ┌ Probe ─────────────┐ ┌ Studies ───────────┐ ┌ Experiments ───────┐                 │
│ │ Does this model     │ │ Is the refusal      │ │ Does a system      │                 │
│ │ refuse this, and    │ │ consistent across   │ │ prompt change the  │                 │
│ │ does the refusal    │ │ repeats, framings,  │ │ behaviour,         │                 │
│ │ hold when pushed?   │ │ models and time?    │ │ measurably?        │                 │
│ │ 0 sessions          │ │ 0 studies           │ │ 0 experiments      │                 │
│ └─────────────────────┘ └─────────────────────┘ └────────────────────┘                 │
│ ┌ Benchmarks ────────┐ ┌ Library ───────────┐ ┌ Results ───────────┐                 │
│ │ How does the model  │ │ What am I testing   │ │ What have I found, │                 │
│ │ score on a standard │ │ with: probes,       │ │ and how do I get   │                 │
│ │ suite, and how does │ │ variant groups,     │ │ it out?            │                 │
│ │ that move under my  │ │ claims, coach       │ │                    │                 │
│ │ conditions?         │ │ examples?           │ │                    │                 │
│ │ needs Docker: see   │ │ 3 probes            │ │ 0 runs recorded    │                 │
│ │ Settings            │ │                     │ │                    │                 │
│ └─────────────────────┘ └─────────────────────┘ └────────────────────┘                 │
│ R4 RECENT                                                                             │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Nothing recorded yet. Your first session, study and experiment will show here.   │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
Same screen, keys set and data present (R1 becomes the status strip, R4 fills):
```
│ R1 ● 2 of 5 keys set · Anthropic, OpenAI     Last session: crime-set-1 · claude-sonnet-4-6 · 12 runs   [Open]  v0.8.0 │
│ R2 ┌ RUNNING · run all in crime-set-1                                   0:42 ┐                                  │
│    │ ████████░░░░░░░░  2 of 3 done   refused 1 · complied 1   now: the-hotel-room   [Cancel] │                 │
│    └──────────────────────────────────────────────────────────────────────────┘                                  │
│ R3 (six cards as above, with live counts: "1 session", "3 probes", "12 runs recorded")                           │
│ R4 RECENT                                                                                                        │
│    Session   crime-set-1      claude-sonnet-4-6   12 runs · 7 of 12 refused (58%) by first label   2026-10-16   │
│    Experiment tone-vs-none    running            2 conditions                                        2026-10-15   │
│    Models study  sonnet vs gpt-4.1   3 probes · 2 of 3 probes agree (67%)                           2026-10-14   │
```
### 1024×700 differences
R1 setup card: the provider rows keep one line each; the key input narrows to 220 px; "What works without a key" stays a list. The status strip (keys set) wraps to two lines: keys on the first, last session on the second. R3 cards go from three per row to two per row (six cards, three rows). R4 table drops the date column into a second line under the name. Nothing is hidden; the page scrolls under the 44 px header.

## 2. Regions

### R0 Header
- Components: Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Brand "Flinch" | static | n/a | link to `#/`; on Home it is `aria-current="page"` | Header |
| Session pill | `GET /api/sessions` (app.py:348-350; db.py:697-699) | `[].id, name, target_model` | "No session" when none open (Home never opens one by itself); menu lists the last 8 by `id` desc, then "All sessions", "New session" | SessionSwitcher |
| Key chip | `GET /api/settings/keys` (app.py:2263-2277) | `[].provider, label, is_set` | "r of 5 keys set" with r = count of `is_set`; red "No keys" at 0; popover grid label → "set" / "not set" | KeyStatusChip |
| Nav | static | n/a | six items, IA §2 order; Benchmarks disabled with reason until prerequisites (Settings › Benchmarks) | PrimaryNav |
| `?` | static | n/a | Quick tour, Keyboard shortcuts, Glossary, What is Flinch | HelpMenu |
| `⚙` | static | n/a | link to `#/settings` | Button ghost icon |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Brand | none | `#/` |
| Session pill item | none | `#/probe/:s` |
| "New session" (pill menu) | none | opens New session dialog (`dialog-new-session.md`) |
| "All sessions" | none | `#/probe` |
| Key chip | none | `#/settings#keys` |
| Nav item | none | that section's route |
| `?` items | none | Quick tour starts the Home tour (3 steps: status, questions, recent); Shortcuts opens the Shortcuts dialog |

### R1 Status, or Setup card on first launch
- Components: Panel (variant `elevated` for the setup card, `card` for the status strip), Readout, InsetBox (row), Input (password), Button, Chip, Term, Caveat, FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Eyebrow "Set up Flinch" / status eyebrow | `GET /api/settings/keys` | count of `is_set` | setup card when 0 keys are set and Ollama is not available; status strip otherwise | Panel heading (upper) |
| Version "v0.8.0" | `GET /health` (app.py:3305-3312) | `version` | "v{version}"; `/health` is used, not `/api/version`, because `/api/version` reads `flinch/__init__.py` which says 0.5.0 (baseline #3) | text, `font-mono text-xs text-zinc-500` |
| Readout | derived | keys count, Ollama `available` | sentences in §3 | Readout |
| Provider row label | `GET /api/settings/keys` | `[].label` | as returned: "Anthropic (Claude)", "OpenAI (GPT)", "Google (Gemini)", "xAI (Grok)", "Together AI (Llama)" (app.py:2201-2207) | InsetBox row |
| Provider state | same | `[].is_set`, `[].masked` | "● set sk-ant-…xyzw" (masked is first 8, "...", last 4, app.py:2210-2214) or "○ not set" | Chip count + text |
| Key input | none | n/a | password Input, placeholder from provider ("sk-ant-…", "sk-…", "AIza…"); shown inline for Anthropic (first row) and on "Add key" for the others | Input |
| "Save and test" | see Actions | n/a | primary sm; loading label "Testing…" | Button |
| Ollama row | `GET /api/ollama/status` (app.py:2372-2385) | `available`, `base_url`, `models[]` | "● detected at {base_url} · {n} models" or "○ not detected at {base_url}" | InsetBox row |
| "Check again" | re-calls `GET /api/ollama/status` | n/a | secondary sm | Button |
| "What works without a key" list | `GET /api/probes` (app.py:257-263) count; `GET /api/dashboard/sessions` (app.py:2438-2440; db.py:2646-2661) length; `GET /api/dashboard/stats` (db.py:2606-2634) `total_runs` | counts | each line a full sentence with its count: "Library: add, import and load the example probes (3 in the library now)."; "Probe: open past sessions and read their runs (0 sessions)."; "Results: export anything already recorded (0 runs)."; "Labels: with no key the label is the keyword scan alone, no judge model." | list `text-sm text-zinc-300` |
| Label caveat | static | n/a | `keyword_only` (proposed id, see §5) beside the Labels line | Caveat inline |
| "Do this later" | none | n/a | text button; collapses the card to the status strip for this browser (localStorage `flinch:setup-dismissed`); the card returns on the next launch while 0 keys are set | Button text |
| Status strip: keys | `GET /api/settings/keys` | `[].is_set, label` | "● 2 of 5 keys set · Anthropic, OpenAI" (labels of the set ones, provider part before the parenthesis) | Rate (md, what "keys set", caveat none) + text |
| Status strip: last session | `GET /api/dashboard/sessions` | `[0].name, target_model, run_count, created_at` | "Last session: {name} · {target_model} · {run_count} runs" (summary is ordered `created_at` desc, db.py:2659); "No sessions yet" when empty | text + Button "Open" (secondary sm) |
| Status strip: no Anthropic key but another key set | `GET /api/settings/keys` | `is_set` per provider | warn Readout: "No Anthropic key: Claude targets cannot be sent, and the judge model will be {provider}'s default." (llm.py:143-184 picks the first available of Anthropic, OpenAI, Google, then Ollama) | Readout tone `warn` |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| "Save and test" (browser) | `POST /api/settings/keys {ENV_VAR: value}` (app.py:2280-2308; writes `.env`, hot-reloads, rebuilds the runner for Anthropic) then `POST /api/settings/test-key {provider}` (app.py:2311-2369; anthropic, openai, google only) | row flips to "● set …"; toast success "Anthropic key saved and tested." or, for xai and meta where test returns 400, "Together AI key saved. This provider has no test; the first send will tell." (draft; brad-voice pass); key chip re-fetches; when every provider is still unset the card stays, otherwise it becomes the status strip |
| "Save and test" (desktop, `window.__TAURI__` present, settings.js:102) | `POST /api/settings/validate-key {provider, key}` (app.py:3368-3400) → `POST /api/settings/set-key {provider, key}` (app.py:3342-3356) → Tauri `set_api_key` (Credential Manager, `src-tauri/src/api_keys.rs`) | as above; `validate-key` `{valid:false, error}` shows the error under the input `role="alert"` and nothing is stored |
| "Add key" (other rows) | none | reveals that row's Input and "Save and test" |
| "Check again" | `GET /api/ollama/status` | row text updates; if `available` and 0 keys, the Readout changes to the Ollama sentence (§3) |
| "Do this later" | none | collapses to the status strip; focus moves to the Probe card |
| "Open" (last session) | none | `#/probe/:s` |
| Key chip | none | `#/settings#keys` |

### R2 Running now
- Components: ProgressCard (`kind: 'batch' | 'experiment'`), Rate, OutcomeBadge, Button, Dialog (cancel confirm).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Batch card | client store `batch` fed by the open SSE from `POST /api/sessions/{id}/batch` (app.py:540-569; runner.py:240-285). There is no `GET` route for batch runs, so a batch exists on Home only while this page's app holds the SSE connection | `progress.completed, total, probe_name, classification` (runner.py:244-253); `error.probe_id, error` (runner.py:256-265); `complete.total, completed, failed` (runner.py:277-284) | title "run all in {session name}"; "2 of 3 done" (Rate count-first); outcome tally counted from `progress.classification`; "now: {probe_name}"; failed "1 failed" in amber from `error` events; elapsed from the client `startedAt` | ProgressCard |
| Experiment card | `GET /api/experiments` (app.py:2788-2791; db.py:3247-3262) filtered `status === 'running'`, then `GET /api/experiments/{id}` (app.py:2794-2802) `progress` | `progress.total, completed, failed, pending` (db.py:3456-3503) | "18 of 60 done"; polled every 5 s while on Home (the `/progress` route is JSON, baseline #18) | ProgressCard |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Cancel (batch) | `POST /api/batch/{batch_id}/cancel` (app.py:700-703) and close the SSE `EventSource` | Dialog "Stop running all? 2 of 3 are done and stay recorded." when `done.count > 0`; card shows "CANCELLED"; note: the runner loop does not read the cancelled status (runner.py:240-275), so closing the connection is what stops the client, and the server may finish the probe in flight (§12) |
| Pause / Resume (experiment) | `POST /api/experiments/{id}/pause` / `/resume` (app.py:2920-2935) | card eyebrow "PAUSED" / "RUNNING" |
| Card title | none | `#/probe/:s` (batch) or `#/experiments/:id` (experiment) |

### R3 Questions
- Components: Card ×6, Rate, Term, FirstTimeTip.
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Eyebrow "What do you want to find out?" | static | n/a | Panel heading (upper) | text |
| Probe card | `GET /api/dashboard/sessions` | length | title "Probe"; body "Does this model refuse this probe, and does the refusal hold when pushed?"; meta "{n} sessions" ("1 session"); `Term` on "probe" and "pushed" (pushback) | Card |
| Studies card | `GET /api/comparisons` (app.py:1805-1808; db.py:2493-2503) length + `GET /api/dashboard/sequences` (app.py:2446-2448) length | lengths | title "Studies"; body "Is the refusal consistent across repeats, framings, models, conversation context and time?"; meta "{n} studies" counts comparisons plus sequences (stat runs are per session and not countable without N calls; §12) | Card |
| Experiments card | `GET /api/experiments` | `experiments.length`, `status` | title "Experiments"; body "Does a change to the system prompt change the behaviour, measurably?"; meta "{n} experiments · {k} running" | Card |
| Benchmarks card | none today (Round 2 section; prerequisites come from Settings › Benchmarks) | n/a | title "Benchmarks"; body "How does the model score on a standard suite, and how does that score move under your conditions?"; disabled with reason "Needs Docker and a Hugging Face token: see Settings." until the Benchmarks screen reports prerequisites met | Card (disabled) |
| Library card | `GET /api/probes` | length | title "Library"; body "What am I testing with: probes, variant groups, policy claims, coach examples?"; meta "{n} probes" | Card |
| Results card | `GET /api/dashboard/stats` | `total_runs`, `total_sessions`, `total_comparisons`, `total_sequences`, `total_annotations` (db.py:2606-2634) | title "Results"; body "What have I found, and how do I get it out?"; meta "{total_runs} runs recorded · {total_annotations} annotated" | Card |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Probe card | none | `#/probe` (the Sessions list); when there are 0 sessions it opens the New session dialog over `#/probe` |
| Studies card | none | `#/studies` |
| Experiments card | none | `#/experiments` |
| Benchmarks card | none | `#/benchmarks` when enabled; not clickable when disabled (reason shown) |
| Library card | none | `#/library/probes` |
| Results card | none | `#/results` |

### R4 Recent
- Components: Panel, Table, OutcomeBadge, Rate, Caveat, EmptyState, Menu (row export).
- Content and bindings (every element):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| Eyebrow "Recent" | static | n/a | Panel heading (upper) | text |
| Session rows (up to 5) | `GET /api/dashboard/sessions` (db.py:2646-2661; excludes sessions whose `notes` contain "Auto-created by multi-model comparison", db.py:2657) | `id, name, target_model, run_count, refused_count, collapsed_count, negotiated_count, complied_count, created_at` | kind "Session"; name mono; model mono; "{run_count} runs · {refused_count} of {run_count} refused (58%) by first label" (Rate, what "refused", caveat `first_label`, §5); date `created_at` as YYYY-MM-DD; "none yet" when `run_count` is 0 | Table rows |
| Experiment rows (up to 3) | `GET /api/experiments` | `experiments[].id, name, status, created_at` | kind "Experiment"; status word as a Chip tag; date; conditions count needs `GET /api/experiments/{id}` (`conditions.length`), fetched lazily per row | Table rows |
| Models study rows (up to 3) | `GET /api/comparisons` | `[].id, name, models[], total_probes, agreement_rate, created_at` | kind "Models study"; models shortened to the first hyphen segment joined " vs "; "{total_probes} probes · {aligned} of {total_probes} probes agree ({pct})" where aligned = round(`agreement_rate` × `total_probes`) because the list payload has no aligned count (app.py:1779, 1800 compute the rate as aligned ÷ probes; §12 asks for the count) | Table rows |
| Context study rows (up to 3) | `GET /api/dashboard/sequences` (db.py:2678-) | `[].id, status, max_warmup_turns, created_at, probe_name` | kind "Context study"; "{probe_name} · up to {max_warmup_turns} warm-up turns"; status Chip | Table rows |
| Empty | all four empty | n/a | "Nothing recorded yet. Your first session, study and experiment will show here." | EmptyState |

- Actions:

| Control | Calls | Then (navigation / state change / toast) |
|---|---|---|
| Session row | none | `#/probe/:s` |
| Experiment row | none | `#/experiments/:id` |
| Models study row | none | `#/studies/models/:id` |
| Context study row | none | `#/studies/context/:id` |
| Row "⋯" › Export JSON / CSV (session) | `GET /api/sessions/{id}/export?format=json|csv` (app.py:945-948) | browser download named by `Content-Disposition`; toast "Exported crime-set-1 as JSON." |
| "See all" (per kind) | none | `#/probe`, `#/experiments`, `#/studies` |

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|
| Loading | first paint until `keys`, `ollama/status`, `dashboard/sessions`, `dashboard/stats`, `experiments`, `comparisons`, `dashboard/sequences`, `health` resolve | skeleton rows (`animate-pulse`) | absent | cards render with meta "…" | three skeleton rows | (Readout wrapper mounted, text null) |
| First launch, no keys, no Ollama | every `is_set` false and `available` false | setup card, Anthropic input open, FirstTimeTip `home.key` on it | absent | Benchmarks disabled; other cards clickable | empty sentence | "No provider key is set, so nothing can be sent to a model yet. You can still add and import probes, read past sessions and export them." |
| No keys, Ollama detected | every `is_set` false, `available` true, `models.length > 0` | setup card; Ollama row "● detected … · 2 models"; Labels line says the judge is the first Ollama model (llm.py:170-181) | absent | same | same | "No provider key is set. Ollama is running with 2 models, so local targets (ollama:…) can be sent and the judge model is {models[0]}; everything else waits for a key." |
| No keys, Ollama detected, no models | `available` true, `models` empty | setup card; Ollama row "● running at … · no models pulled" | absent | same | same | "Ollama is running but has no models. Pull one, or set a provider key." |
| Setup dismissed | "Do this later" | status strip "○ No keys" red, with "Set up" text button | absent | same | same | "No keys set. Sends are disabled until one is." |
| Keys set, nothing recorded | ≥1 `is_set`, `total_runs` 0, no sessions | status strip | absent | counts 0; Probe card meta "0 sessions · start here" with FirstTimeTip `home.start` | empty sentence | "2 of 5 keys set. Nothing is recorded yet: start a session under Probe." |
| Keys set, data present | ≥1 `is_set`, sessions exist | status strip with last session | absent | live counts | rows | "2 of 5 keys set. Last session crime-set-1 has 12 runs; 7 of 12 refused by first label." |
| Partial keys, no Anthropic | Anthropic `is_set` false, another true | status strip plus warn Readout | | | | "No Anthropic key: Claude targets cannot be sent, and the judge model will be OpenAI's default." |
| Running a batch | client `batch.status === 'running'` | | ProgressCard batch | | | "Running all 3 probes in crime-set-1: 2 of 3 done, 1 refused, 1 complied so far. Labels are keyword scan plus judge and can be wrong." |
| Running an experiment | any experiment `status === 'running'` | | ProgressCard experiment | | | "Experiment tone-vs-none is running: 18 of 60 done." |
| Batch finished while on Home | SSE `complete` | | card "DONE" with "View results" | | | "Run all finished: 3 of 3 done, 0 failed." |
| Batch cancelled | Cancel confirmed | | card "CANCELLED" | | | "Stopped after 2 of 3. The two runs stay recorded." |
| Key save error | `POST /api/settings/keys` 400 or `validate-key` `{valid:false}` | error line under the input (`role="alert"`) with the server `error` / `detail` | | | | (unchanged) |
| API unreachable | any fetch fails with no response | status strip replaced by warn Readout; cards still render with meta "n/a" | absent | cards clickable | "Could not reach the Flinch server." | "Flinch could not reach its own server at {origin}. In desktop mode, restart the app; in the browser, start `python -m flinch.app`." |
| Tour running | Help › Quick tour | Pointer on R1 | | Pointer on R3 | Pointer on R4 | (tour card text, three steps) |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "2 of 5 keys set" | count(`is_set`) of 5 providers (app.py:2200-2207) | the five providers and their set / not set state in the chip popover and the setup card rows | Rate (what "keys set") / KeyStatusChip |
| "3 in the library now" | `GET /api/probes`.length | the Library card repeats it; Library › Probes lists them | text in the setup list |
| "{run_count} runs" per session | `run_count` (db.py:2650) | the four outcome counts on the same row | Table cell |
| "7 of 12 refused (58%)" | `refused_count` of `run_count` (db.py:2651) | "by first label" and the `first_label` caveat on hover | Rate |
| "2 of 3 done" (batch) | `progress.completed` of `progress.total` (runner.py:251-252) | outcome tally and "now: {probe_name}" | ProgressCard / Rate |
| "18 of 60 done" (experiment) | `progress.completed` of `progress.total` (db.py:3456-3503) | failed and pending counts on the card | ProgressCard |
| "2 of 3 probes agree (67%)" | round(`agreement_rate` × `total_probes`) of `total_probes` (app.py:1779, 1800) | "probes" and the word "agree"; §12 asks the API for the aligned count so the rounding goes away | Rate |
| "{total_runs} runs recorded · {total_annotations} annotated" | `GET /api/dashboard/stats` | both counts in one phrase | Card meta |
| "0:42" elapsed | now − client `startedAt` | the progress count on the same card | ProgressCard |
| "v0.8.0" | `GET /health`.version | none needed (a version is its own input) | text |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `classifier` | "The label is a keyword scan plus a judge model's guess. You can change it." | the batch ProgressCard outcome tally, the Results card meta | classifier.py:48-61 (keyword first, judge when keyword confidence ≤ 0.8) |
| `keyword_only` (proposed new id) | "With no judge model available, the label is the keyword scan alone." | the "Labels" line of the setup card; the batch tally when 0 keys and no Ollama | classifier.py:57-59; app.py:101-108; llm.py:143-184 |
| `first_label` (proposed new id) | "Counts here are by the first label, before any pushback." | every session row's Rate in R4 and the status strip | db.py:2651-2654 sums `initial_classification` only |
| `rate_n` | "A rate from N runs is a rate from N runs." | R4 session Rate on hover of the Info icon | tokens §6 |
| `product_filter` | "A refusal can come from a product filter, not the model." | the refused count in R4 and the batch tally, in the Rate's "What this is made of" details | runner.py:124-131 (the target reply is whatever the provider returns; no filter detection exists) |
| `coach_conf` | not on Home | | |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| probe | Probe card body, Library card, setup list | "a prompt sent to the target model, with a name, a domain and tags" (db.py:18-29 columns; CLAUDE.md "Markdown for probe definitions") |
| session | Probe card meta, R4 rows, status strip | "one target model, one optional system prompt, one coach profile and a probe set, plus every run made with them" (IA §1; db.py:31-42) |
| run | R4 "12 runs", Results card | "one probe sent once: the reply, its label, any pushback and the reply to that" (db.py:44-61) |
| pushback | Probe card body ("pushed") | "a follow-up question that tests whether the refusal holds" (coach.py:49-52) |
| refused, collapsed, negotiated, complied | R4 counts, batch tally | classifier.py:94-97: "declined the request" / "said it was reluctant, then wrote the content anyway in the same reply" / "gave a changed version with caveats or warnings" / "wrote it without resistance" |
| first label | R4 Rate | "the label on the first reply, before any pushback" (db.py:2651) |
| judge model | setup card Labels line, warn Readout | "the model that labels a reply when the keyword scan is unsure; Anthropic's default is Claude Haiku 4.5" (classifier.py:110-125; llm.py:24) |
| keyword scan | setup card Labels line | "a list of refusal and compliance phrases counted in the reply" (classifier.py:6-47, 63-88) |
| provider key | setup card, key chip | "an API key for one provider, stored in `.env` in the browser build or in Windows Credential Manager on desktop" (app.py:2280-2308; `src-tauri/src/api_keys.rs`) |
| study | Studies card | "a saved consistency check: repeat, framing, models, context or over time" (IA §3) |
| experiment | Experiments card, R4 | "conditions × models × prompts, run to compare system prompts" (models.py:213-257 via api-routes.md) |
| benchmark | Benchmarks card | "a standard suite run to its published recipe; a modified run is not comparable" (IA §3; components §29) |
| system prompt | Experiments card body | "text the target model receives before the probe" (db.py:38; runner.py:32-40) |
| Ollama | setup card row | "a local model server; Flinch talks to it at `OLLAMA_BASE_URL`" (app.py:2372-2385) |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `home.key` | `[data-tip="home.key"]` (the Anthropic key Input) | title "Start with one key"; blurb "Paste a provider key here. It never leaves this machine: the browser build writes it to .env, the desktop build keeps it in Credential Manager."; why "Flinch sends probes with your key and reads the replies back; nothing is sent anywhere else." | setup card visible, input rendered, not seen before |
| `home.start` | `[data-tip="home.start"]` (the Probe card) | title "Start here"; blurb "Probe is the core loop: pick a probe, send it, read the label, push back, see whether the refusal holds." | ≥1 key set, 0 sessions, `home.key` seen or never shown |
| `home.running` | `[data-tip="home.running"]` (ProgressCard) | title "You can leave this page"; blurb "A run all keeps going while you move around Flinch; it stops only if you close the tab or press Cancel." | first time a ProgressCard appears on Home |
| `home.recent` | `[data-tip="home.recent"]` (first R4 row) | title "Counts are by first label"; blurb "The refused count on a session row is the first reply's label, before pushback. Open the session for the outcome after pushback." | first time R4 has a session row |

Placement audit: all four anchor beside their target at 1280×800 and 1024×700 (components §22 test); `home.key` places to the right of the input at 1280 and below it at 1024.

## 8. Keyboard and focus
- Shortcuts: `?` opens the Help menu (not in an input); `F8` focuses the newest toast; `Escape` closes a tip, then a menu, then a dialog, in that order (each stops propagation). No single-letter shortcuts on Home.
- Focus order: brand → session pill → key chip → nav items (6) → `?` → `⚙` → R1 (Anthropic input → Save and test → each "Add key" → Check again → Do this later; or status strip "Open" → "Set up" when present) → R2 ProgressCard buttons (Pause, Cancel) → R3 cards in IA order (disabled Benchmarks card is skipped, its reason is read with the card via `aria-describedby`) → R4 rows (roving tabindex in the Table) → row "⋯" menus. Initial focus on load: the main landmark (`<main tabindex="-1">`), not the input, so a screen reader hears the Readout first.
- Live regions: the R1 Readout (`role="status"`, polite) announces the state sentence once on load and again when keys change; the ProgressCard counts line (polite, throttled 3 s); toasts (status or alert by tone); the key save error line (`role="alert"`).

## 9. Dialogs and overlays opened from here
- New session dialog (`dialog-new-session.md`): from the session pill menu, from the Probe card when there are 0 sessions, and from the Quick tour's last step "Start a session".
- Cancel confirm Dialog for a running batch when `done.count > 0`: title "Stop running all?", intro "2 of 3 are done and stay recorded. The probe in flight may still finish on the server.", primary danger "Stop".
- Help menu, Shortcuts dialog, Quick tour (3 steps), Term tooltips, FirstTimeTips, Toasts.
- Key chip popover (definition grid of the five providers).
- No native `alert`, `confirm` or `prompt` anywhere (components §18 lint).

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/health` | R1 version |
| GET | `/api/settings/keys` | R0 chip, R1 rows and strip, after every key save |
| POST | `/api/settings/keys` | R1 Save and test (browser) |
| POST | `/api/settings/test-key` | R1 Save and test (browser, anthropic/openai/google) |
| POST | `/api/settings/validate-key` | R1 Save and test (desktop) |
| POST | `/api/settings/set-key` | R1 Save and test (desktop) |
| GET | `/api/ollama/status` | R1 Ollama row, Check again, Readout choice |
| GET | `/api/sessions` | R0 SessionSwitcher menu |
| GET | `/api/dashboard/sessions` | R1 last session, R3 Probe count, R4 session rows |
| GET | `/api/dashboard/stats` | R1 setup list counts, R3 Results meta |
| GET | `/api/probes` | R1 setup list count, R3 Library meta |
| GET | `/api/experiments` | R2 running experiments, R3 Experiments meta, R4 rows |
| GET | `/api/experiments/{id}` | R2 progress poll, R4 conditions count (lazy) |
| POST | `/api/experiments/{id}/pause` | R2 Pause |
| POST | `/api/experiments/{id}/resume` | R2 Resume |
| GET | `/api/comparisons` | R3 Studies meta, R4 Models study rows |
| GET | `/api/dashboard/sequences` | R3 Studies meta, R4 Context study rows |
| POST | `/api/batch/{batch_id}/cancel` | R2 Cancel (batch) |
| GET | `/api/sessions/{id}/export?format=` | R4 row menu export |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With all five `is_set` false and Ollama `available` false, `#/` renders `section[aria-labelledby]` whose heading text is "Set up Flinch", and no element with `role="dialog"` is open.
2. The setup card contains exactly five provider rows whose label text equals the five `label` values from `GET /api/settings/keys`, in that order, plus one Ollama row.
3. The setup card's "What works without a key" list has four `<li>` items; the first contains the probe count from `GET /api/probes` in parentheses and ends with a period.
4. Typing a key into the Anthropic input and pressing Enter sends `POST /api/settings/keys` with body `{"ANTHROPIC_API_KEY": "<value>"}` in the browser build, or `POST /api/settings/validate-key` then `POST /api/settings/set-key` with `{"provider":"anthropic","key":"<value>"}` in the desktop build; the row text then reads "● set" followed by a masked value of the form `^.{8}\.\.\..{4}$`.
5. After one key is set, the header chip's accessible name is "1 of 5 keys set" and the chip has no `border-red-800` class.
6. "Do this later" collapses the card: the heading "Set up Flinch" is gone, a red chip "No keys" remains in the header, and `localStorage['flinch:setup-dismissed']` is `"1"`; reloading with 0 keys shows the card again.
7. The version text matches `^v\d+\.\d+\.\d+$` and equals `GET /health`.version, not `GET /api/version`.version.
8. R3 renders six `a` or `button` elements named "Probe", "Studies", "Experiments", "Benchmarks", "Library", "Results" in that order; the Benchmarks card has `aria-disabled="true"` and a visible reason text node when prerequisites are not met, and no `href`.
9. Every card body text ends with "?" or "." and contains no U+2014 or U+2013; every Rate on the screen renders a count "of" count before or after any percentage (regex from components Appendix B).
10. With one session having 12 runs and 7 refused by first label, the R4 row text contains "7 of 12 refused (58%)" and an Info icon whose tooltip contains "Counts here are by the first label, before any pushback."
11. Starting a run all in the workbench and navigating to `#/` shows a ProgressCard with "n of N done" that increases without the page being reloaded; pressing Cancel with n > 0 opens a dialog, and confirming sends `POST /api/batch/{id}/cancel` and closes the EventSource (no further `progress` events update the card).
12. Clicking a session row navigates to `#/probe/<id>`; clicking the row's export menu item "JSON" triggers a download whose filename comes from the `Content-Disposition` header of `GET /api/sessions/<id>/export?format=json`.
13. With the server stopped, the page still renders the six cards, each meta reads "n/a", and the Readout text starts with "Flinch could not reach its own server".
14. At 1024×700 the six cards lay out two per row, no horizontal scrollbar appears (`document.documentElement.scrollWidth <= 1024`), and every registered tip for Home places with `anchored` or `inset` (components §22 audit).
15. Tab from the `⚙` button lands on the first interactive element of R1; Shift+Tab from it returns to `⚙`.

## 12. Open questions for Brad
1. The Models study row shows "2 of 3 probes agree" by rounding `agreement_rate × total_probes`, because `GET /api/comparisons` carries the rate but not the aligned count (app.py:1779, 1800; db.py:2493-2503). A one-line API addition (`aligned_count`) removes the rounding. Worth doing in this release, or accept the rounding with its caveat?
2. A batch has no `GET` route, so "Running now" can show a run all only while this page's app holds the SSE. If you want Home to show a batch started in another tab, the server needs `GET /api/batch/{id}` (the `batch_runs` table already has the fields, db.py:93-102).
3. Cancel: `POST /api/batch/{id}/cancel` marks the row cancelled but `run_batch` never reads it (runner.py:240-275). The spec closes the EventSource, which stops the client; the probe in flight finishes on the server and is recorded. Accept, or add the status check to the loop?
4. Two new caveat ids are proposed (`keyword_only`, `first_label`), extending the seven in `03-components.md` §5. Confirm the wording or fold them into `classifier`.
5. "Studies" count on the card adds comparisons and sequences; stat runs are only listable per session (`GET /api/sessions/{id}/stat-runs`, app.py:2589). Should the count stay partial with a note, or should the Studies list get one aggregate route first?
