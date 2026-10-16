# Settings

- Route(s): `#/settings`, with section anchors `#/settings#keys`, `#/settings#local`, `#/settings#coach`, `#/settings#benchmarks`, `#/settings#about`
- Section: Settings
- Purpose (one sentence, what the researcher does here): put in and test provider API keys (one place, one form per provider), point Flinch at a local Ollama, choose the default coach backend for new sessions, see whether the benchmark prerequisites are met, and read the version and update state.
- Arrives from: header `⚙`; KeyStatusChip click (`#/settings#keys`); Home setup card; any "Needs an … key. Set one in Settings." disabled-reason link; first launch with no keys (once, see §3 "first launch"); Benchmarks "prerequisites" link (`#/settings#benchmarks`); UpdateCard banner "See details" (`#/settings#about`). Leaves to: wherever the researcher came from (browser back) or the header nav; after the first-launch landing, "Continue to Probe" at the top goes to `#/probe`.
- Components used: Header, PrimaryNav, Section ×5, Tabs (at < 1280 the five sections become a tab strip, `03-components.md §2.2`), Panel, Readout, Input (password), Button, Chip, InsetBox, Caveat, Term, Select, Toast, Dialog, UpdateCard, Progress, FirstTimeTip, EmptyState.
- Baseline surfaces replaced: §14 API Keys modal (`#settings-modal`, settings.js) **and** §28 Settings view (render.js:4499-4597) merged into one screen; §6 red no-key banner (replaced by the header chip plus this screen's first-launch landing); the native `alert()` on Ollama test (api.js:830-835).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ R0 ◧ Flinch  [ No session ▾ ]  ○ No keys   Probe Studies Experiments Benchmarks Library Results  ? ⚙ │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R1 (first launch only)  ▣ Welcome. Flinch sends probes to a model through your own    │
│    API key. Add one below; Anthropic also runs the coach and the judge.  [Continue to Probe] │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R2 KEYS                                                       stored in Windows Credential Manager │
│    ┌ Anthropic (Claude)  ANTHROPIC_API_KEY  ● set sk-ant-a…x9Q2 ──────────────────────┐ │
│    │ Used for: target model, coach, judge (classifier).    [Test] [Replace…] [Remove…] │ │
│    │ Tested 14:02: Connected — claude-haiku-4-5-20251001                               │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│    ┌ OpenAI (GPT)  OPENAI_API_KEY  ○ not set ──────────────────────────────────────┐ │
│    │ [password input                                   ] [Validate and save]        │ │
│    │ Used for: target model, judge fallback.                                        │ │
│    └──────────────────────────────────────────────────────────────────────────────┘ │
│    ┌ Google (Gemini) … ┐ ┌ xAI (Grok) … ⓘ no test call; validated on save ┐ ┌ Together AI (Llama) … ┐ │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R3 LOCAL MODELS (OLLAMA)                              ● connected · 3 models · lost on restart ⓘ │
│    Base URL [http://localhost:11434          ] [Test]   models: llama3.1:8b, mistral:7b, qwen2.5:7b │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R4 COACH DEFAULT FOR NEW SESSIONS                                      held in memory ⓘ │
│    Backend (Anthropic | Local)   Model [llama3.1:8b ▾]  ⓘ Local coach: slower, no judge  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R5 BENCHMARKS                                      checks defined in benchmarks.md     │
│    Docker Desktop  ○ not found    WSL2  ● ready    Hugging Face token  ○ not set [Add…] │
│    Log directory  %LOCALAPPDATA%\Flinch\benchmarks\logs   Disk used  0 B   [Open folder] │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ R6 ABOUT                                                                             │
│    Flinch 0.8.0 · desktop · database %APPDATA%\Flinch\flinch.db   [Check for updates]  │
│    ┌ UPDATE  Flinch 0.9.0 is ready ───────────────────────────────────────────────┐   │
│    │ • Benchmarks section  • Settings in one place                                  │   │
│    │ Your sessions, probes and results stay where they are.                         │   │
│    │ [Update] [Later] [Skip this version]                                           │   │
│    └────────────────────────────────────────────────────────────────────────────┘   │
│    [Copy diagnostics]  [Open crash logs]                                             │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
### 1024×700 differences
The five sections become Tabs (Keys · Local models · Coach · Benchmarks · About) over one scrolling body; the anchor routes select the tab. Key cards go from a three-per-row grid (the last three) to one per row. Nothing is hidden.

## 2. Regions

### R0 Header
As `03-components.md §1`; `⚙` is `aria-current`. KeyStatusChip reflects this screen's saves immediately (shared store).

### R1 First-launch readout
- Components: Readout (`tone: info`), Button (primary sm "Continue to Probe").
- Shown only in the first-launch state (§3). Text (draft; brad-voice pass): "Welcome. Flinch sends probes to a model through your own API key. Add one below; Anthropic also runs the coach and the judge."

### R2 Keys
- Components: Section (eyebrow "Keys", `id="keys"`), Panel per provider (five, order as the API), Input type=password (`autocomplete="off"`, show/hide toggle), Button, Chip, Caveat, Term.
- Content and bindings (`GET /api/settings/keys` → `[{env_var, provider, label, required, is_set, masked}]`, app.py:2263-2277; providers anthropic, openai, google, xai, meta, app.py:2200-2206):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| storage line | shell flag `?shell=desktop` (see §12 Q1) | | desktop: "stored in Windows Credential Manager"; browser: "stored in .env next to the server" | Section hint |
| card title | | `label`, `env_var` | "Anthropic (Claude)" with `env_var` in mono beside | Panel heading |
| status | | `is_set`, `masked` | "● set sk-ant-a…x9Q2" (the server's first-8…last-4 mask, app.py:2209-2213) or "○ not set"; `required` is false for all five today, so no REQUIRED badge; the word "required" is not shown | Chip |
| used for | static per provider | | anthropic: "target model, coach, judge (classifier)"; openai, google: "target model, judge fallback" (ollama_status warning text, app.py:2381); xai, meta: "target model" | text `text-zinc-500` |
| input | | | shown when not set, or after Replace…; placeholder "Paste the key"; never prefilled | Input password |
| Validate and save | | | primary sm; loading "Checking…" | Button |
| Test | | `provider` ∈ anthropic, openai, google (app.py:2311-2369) | secondary sm; for xai and meta the button is absent and a Caveat `no_test_call` line reads "No test call for this provider; the key was validated when saved." | Button |
| last test line | `POST /api/settings/test-key` | `ok`, `message` or `error` | "Tested 14:02: Connected — claude-haiku-4-5-20251001" in `text-emerald-400`; failure in `text-red-400` with the error string; the em dash in the server's message is kept because it is quoted server output, shown in mono | text |
| Replace…, Remove… | | | ghost sm; Remove opens D1 | Button |

- Actions (the two paths; the client picks one from the shell flag and never falls through from one to the other):

| Control | Calls | Then |
|---|---|---|
| Validate and save (desktop) | 1. `POST /api/settings/validate-key {provider, key}` (app.py:3368-3393) → `{valid, error}`; if `valid`: 2. `POST /api/settings/set-key {provider, key}` (app.py:3342-3356) → `{ok}`; 3. Tauri `invoke("set_api_key", {provider, key})` (lib.rs:96-99 → api_keys.rs:37; providers api_keys.rs:25) | all three succeed → input cleared, status "● set" with the mask from a refreshed `GET /api/settings/keys`, Toast "Anthropic key saved to Credential Manager."; step 1 invalid → inline error under the input with `error`; step 2 `ok:false` → inline "The server did not accept the key: {error}"; step 3 rejects → inline "Saved for this session only; Credential Manager refused: {error}. It will be asked for again next launch." and the KeyStatusChip shows a warning dot. The `.env` route is never called on desktop. |
| Validate and save (browser) | 1. `POST /api/settings/validate-key` as above; if valid: 2. `POST /api/settings/keys {ENV_VAR: key}` (app.py:2280-2308; writes `.env`, hot-reloads, recreates the runner for Anthropic) → `{ok, keys[]}` | status from the returned `keys`; Toast "OpenAI key saved to .env." |
| Test | `POST /api/settings/test-key {provider}` | last test line; Toast on failure only |
| Remove… (desktop) | D1; `DELETE /api/settings/set-key?provider=` (app.py:3359-3365) then `invoke("delete_api_key", {provider})` (lib.rs:106-109) | status "○ not set"; Toast "Removed the Anthropic key." |
| Remove… (browser) | D1; `POST /api/settings/keys {ENV_VAR: ""}` (app.py:2291-2297 deletes from the process env and writes an empty value) | same |
| Replace… | none | shows the input on a set card; Cancel hides it |

### R3 Local models (Ollama)
- Components: Section (`id="local"`), Input (URL), Button (secondary sm "Test", loading "Testing…"), Chip (status), Caveat, text list.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| status chip | `GET /api/ollama/status` (app.py:2372-2385) | `available`, `models[]` | "● connected · 3 models" / "○ offline"; checked on section mount and after Test | Chip |
| base URL | `GET /api/settings/ollama` (app.py:2388-2396) | `base_url` | default `http://localhost:11434` | Input |
| models | `GET /api/ollama/status` | `models[]` | comma list in mono; empty with available → "connected, no models pulled yet" | text |
| judge warning | | `anthropic_key_set`, `anthropic_key_warning` | when false, the server string is shown as a Caveat `local_no_judge` line (verbatim: "No Anthropic key set. Classification will use keyword-only mode or another available provider.") | Caveat |
| persistence | | | Caveat `ollama_in_memory` | Caveat |

- Actions:

| Control | Calls | Then |
|---|---|---|
| Test (also Enter in the URL) | `POST /api/settings/ollama {base_url}` (app.py:2399-2410) → `{base_url, available, models[]}` | chip and models update; Toast "Ollama at {url}: connected, 3 models." or error Toast "Nothing answered at {url}."; the URL is now in the server's environment (and used by sessions with `ollama:` models) until restart |

### R4 Coach default
- Components: Section (`id="coach"`), Segmented ("Anthropic" / "Local"), Select (model, shown for Local), Caveat.
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| backend | `GET /api/settings/coach-default` (app.py:2416-2419) | `backend` ∈ anthropic, local (as the baseline UI, inventory §28) | Segmented | Segmented |
| model | `GET /api/ollama/status` `models[]`; current from `model` | | Select, disabled with reason "Ollama is offline." when not available | Select |
| hint | | | "Applies to new sessions only; a session keeps the coach it was made with." and, for Local, Caveat `local_coach` "A local coach is slower and does not run the judge; labels come from the keyword scan unless an Anthropic key is set." | text, Caveat |
| persistence | | | Caveat `coach_in_memory` | Caveat |

- Actions:

| Control | Calls | Then |
|---|---|---|
| backend or model change | `POST /api/settings/coach-default {backend, model}` (app.py:2422-2429) → `{backend, model}` | Toast "Coach default: Local, llama3.1:8b." |

### R5 Benchmarks (short; checks defined in `benchmarks.md`)
- Components: Section (`id="benchmarks"`), definition grid (InsetBox rows), Chip (status), Button, Input password (HF token, same two-path save as R2 with provider `huggingface`; route defined in `benchmarks.md`), Caveat.
- Rows: Docker Desktop (status chip + version or "not found"), WSL2 (status chip), Hugging Face token (set / not set, Add…/Remove…, with the Caveat `hf_gated` "Needed for gated datasets such as GPQA; you must have accepted the dataset's terms on Hugging Face first." per `../research/benchmark-harnesses-2026-10-16.md §6 item 4`), Log directory (path, "Open folder" desktop-only), Disk used (bytes, "Clear logs…" with D2). Every check's route, payload and refresh rule is **defined in `benchmarks.md`**; this section only places them. When the benchmarks API is absent the section shows EmptyState "Benchmarks are not set up in this build."

### R6 About
- Components: Section (`id="about"`), text, Button (secondary sm "Check for updates", loading "Checking…"), UpdateCard (card variant), Button (ghost sm "Copy diagnostics", "Open crash logs").
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| version | `GET /health` (app.py:3305-3311, installed package version) | `version` | "Flinch 0.8.0"; `GET /api/version` is not used because `flinch/__init__.py` says 0.5.0 while pyproject says 0.8.0 (inventory §1, baseline #3) | text |
| shell | `?shell=desktop` | | "desktop" / "browser" | text |
| database | desktop: `%APPDATA%\Flinch\flinch.db` (CLAUDE.md; sidecar `db_path`, lib.rs:72); browser: "data/flinch.db or FLINCH_DB_PATH" | | mono path | text |
| update card | `updates` store (`03-components.md §30`) | `phase`, `info` | shown when `phase != 'idle'`; in a browser the Check button is disabled with reason "Updates are installed through the desktop app."; the Tauri updater plugin is inactive in this build (tauri.conf.json:74-82), so until L6 lands the button is disabled with reason "Update checks arrive in a later build." | UpdateCard |
| diagnostics | Tauri `invoke("copy_diagnostic")` (crash.rs:158-161), `invoke("list_crash_logs")` (crash.rs:163-170) | | desktop only; browser disables with reason "Available in the desktop app." | Button |

- Actions: Check for updates → updater `check()` (L6; not sourceable today); Copy diagnostics → clipboard + Toast "Copied diagnostics (keys and paths removed)."; Open crash logs → list in a Drawer with "Open folder".

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|
| loading | route enter | hidden | five pulse cards | pulse | pulse | pulse | version pulse | (wrapper only) |
| first launch | app boot: every `is_set` false **and** cookie `flinch_first` absent → the router lands here once and sets `flinch_first=1` (path `/`, max-age 1 year; cookies are per host, so the sidecar's changing port does not matter) | shown | all five "○ not set" | | | | | "Welcome. Flinch sends probes to a model through your own API key. …" |
| no keys, not first launch | every `is_set` false, cookie present | hidden | as above; the header chip stays red | | | | | (none; the Keys section hint reads "No key yet. Anthropic is the one most of Flinch needs.") |
| some keys | | hidden | mixed cards | | | | | |
| validating | Validate and save | | button loading "Checking…" | | | | | |
| invalid key | `valid:false` | | inline error with the provider's message | | | | | |
| saved (desktop) | three steps ok | | "● set" + Toast | | | | | |
| saved, credential store refused | invoke rejects | | inline warning; key works until restart | | | | | |
| saved (browser) | `.env` written | | "● set" + Toast | | | | | |
| testing | Test | | button loading "Testing…" | | | | | |
| test ok / failed | | | last-test line green / red | | | | | |
| remove | D1 confirmed | | "○ not set" | | | | | |
| Ollama checking | section mount, Test | | | chip pulse | | | | |
| Ollama connected / offline | | | | chip + models / "○ offline" + hint "Is Ollama running? Try `ollama serve`." | model select enabled / disabled | | | |
| coach saved | POST ok | | | | Toast | | | |
| benchmarks absent | API 404 | | | | | EmptyState | | |
| update available | store `available` | | | | | | card | |
| update downloading / installing / error | store phases | | | | | | card progress / spinner / error with Try again | |
| browser shell | no `?shell=desktop` | | ".env" hints | | | Open folder disabled | Check, diagnostics disabled with reasons | |
| error | any GET fails | | that section shows "Could not load. Try again." | same | same | same | same | error Toast |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "2 of 5 keys set" (header chip, mirrored in the Keys eyebrow) | count of `is_set` | the five cards | KeyStatusChip, Section hint |
| "3 models" | `models.length` | the model names listed | Chip |
| "sk-ant-a…x9Q2" | server mask (first 8, last 4; "***" under 16 chars) | | Chip |
| "Tested 14:02" | local time of the last test this visit | the result text | text |
| Disk used "0 B" | defined in `benchmarks.md` | | R5 |
| "Flinch 0.8.0" | `/health.version` | shell and DB path | R6 |
| update bytes | `downloaded` of `total` | progress bar `aria-valuetext` | UpdateCard |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `no_test_call` | "No test call for this provider; the key was validated when saved." | xAI, Together cards | app.py:2368-2369 (400 for other providers); validate covers them (app.py:3375-3390) |
| `key_scope_desktop` | "Keys are stored in Windows Credential Manager and handed to the server over a pipe at launch; they are never written to a file." | R2 hint (desktop) | sidecar.rs:8-11, 406-416; api_keys.rs |
| `key_scope_browser` | "Keys are written to the .env file next to the server and loaded into the running process." | R2 hint (browser) | app.py:2280-2308 |
| `ollama_in_memory` | "The Ollama URL is kept for this server run only; set OLLAMA_BASE_URL to make it permanent." | R3 | app.py:2402 (`os.environ` only) |
| `coach_in_memory` | "This default is kept in memory and resets to Anthropic when the server restarts." | R4 | app.py:2413, 2422-2429 (`_coach_defaults` dict) |
| `local_no_judge` | (verbatim server string) "No Anthropic key set. Classification will use keyword-only mode or another available provider." | R3 when `anthropic_key_set` false | app.py:2381 |
| `local_coach` | "A local coach is slower and does not run the judge; labels come from the keyword scan unless an Anthropic key is set." | R4 Local | inventory §28 warning; app.py:2381 |
| `hf_gated` | "Needed for gated datasets such as GPQA; you must have accepted the dataset's terms on Hugging Face first." | R5 | research §6 item 4 |
| `updater_inactive` | "Update checks arrive in a later build." | R6 Check (until L6) | tauri.conf.json:74-82 |

## 6. Terms (rule 4)
| Term | Where it appears | Definition source |
|---|---|---|
| API key | R2 | glossary |
| judge (classifier) | R2 used-for, R3, R4 | glossary; classifier.py |
| coach | R2, R4 | glossary |
| Ollama | R3 | glossary ("a local model server; Flinch talks to it at the base URL") |
| coach backend | R4 | glossary |
| Credential Manager | R2 hint | glossary |
| Hugging Face token, Docker Desktop, WSL2 | R5 | glossary (definitions in `benchmarks.md`) |
| sidecar | R6 | glossary ("the Python server the desktop app runs") |

## 7. First-time tips (rule 6)
| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| `settings.anthropic` | Anthropic card input | "One key does most of Flinch: it runs the target model, the coach and the judge. The others add models to compare." | first launch landing |
| `settings.test` | first Test button | "Test sends a ten-token message to the provider and shows what came back." | first time a key is set |
| `settings.coach` | R4 segmented | "This only changes new sessions. Each session remembers its own coach." | first visit to #coach |

## 8. Keyboard and focus
- Shortcuts: `Enter` in a key input = Validate and save; `Enter` in the URL = Test; `Esc` cancels Replace…; `?` Help.
- Focus order: header → (R1 Continue) → Keys cards in API order (input, Validate and save, Test, Replace…, Remove…) → Ollama URL, Test → coach segmented, model → benchmarks rows → Check for updates → UpdateCard buttons → diagnostics. On the first-launch landing the initial focus is the Anthropic input. Arriving at `#/settings#keys` scrolls the section into view and focuses its first control.
- Live regions: each card's status line is `role="status"` (announces "Anthropic key set"); last-test line `role="status"`; Toasts; UpdateCard sr-only status.

## 9. Dialogs and overlays opened from here
- **D1 Remove key** (Dialog md, danger "Remove the Anthropic key"): intro "Sessions on Claude models will not run until a key is set again. Nothing recorded is deleted."
- **D2 Clear benchmark logs** (defined in `benchmarks.md`).
- Crash logs Drawer (R6).
- UpdateCard; Toasts; tips. No native `alert()`.

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| GET | `/api/settings/keys` | R2 load; after every save and remove |
| POST | `/api/settings/validate-key` | R2 Validate and save (both shells) |
| POST | `/api/settings/set-key` | R2 save (desktop) |
| DELETE | `/api/settings/set-key?provider=` | R2 Remove (desktop) |
| POST | `/api/settings/keys` | R2 save and Remove (browser only) |
| POST | `/api/settings/test-key` | R2 Test (anthropic, openai, google only) |
| GET | `/api/ollama/status` | R3 load, R4 model list |
| GET | `/api/settings/ollama` | R3 load |
| POST | `/api/settings/ollama` | R3 Test |
| GET | `/api/settings/coach-default` | R4 load |
| POST | `/api/settings/coach-default` | R4 change |
| GET | `/health` | R6 version |
| (Tauri) | `invoke set_api_key`, `delete_api_key`, `get_api_keys`, `copy_diagnostic`, `list_crash_logs` | R2 desktop path; R6 |
| defined in `benchmarks.md` | benchmark prerequisite checks, HF token save, log dir, disk use | R5 |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. With `?shell=desktop` and a valid key, Validate and save produces exactly these requests in order: `POST /api/settings/validate-key`, `POST /api/settings/set-key`, then `invoke("set_api_key")`; no request to `POST /api/settings/keys` is made (network assertion).
2. Without the flag, the same action produces `POST /api/settings/validate-key` then `POST /api/settings/keys` with body `{"OPENAI_API_KEY":"<key>"}`; `set-key` is never called.
3. With `validate-key` mocked to `{"valid":false,"error":"401"}`, no save request follows and the inline error under the input contains "401".
4. With `invoke("set_api_key")` mocked to reject, the card shows the inline warning containing "Saved for this session only" and the KeyStatusChip's dot has the warning class.
5. The xAI and Together cards contain no Test button and do contain the `no_test_call` phrase; the Together card's `provider` sent on save is `meta` (from the GET payload), never `together`.
6. The masked status equals the server's `masked` string verbatim (fixture `sk-ant-a...x9Q2`).
7. First launch: with all `is_set` false and no `flinch_first` cookie, loading `#/` redirects to `#/settings#keys`, R1 is visible, focus is in the Anthropic input, and `document.cookie` contains `flinch_first=1`; reloading `#/` with the cookie present does not redirect and R1 is absent.
8. Ollama Test sends `POST /api/settings/ollama {"base_url":"<input>"}` and, on `{"available":false}`, shows the chip "○ offline" and the hint containing `ollama serve`; no `window.alert` is called.
9. Changing the coach backend sends `POST /api/settings/coach-default` with `{"backend":"local","model":"<selected>"}` and the `coach_in_memory` phrase is visible in R4.
10. R6 shows the version from `/health`, not `/api/version` (fixture: health 0.8.0, api/version 0.5.0 → DOM reads "Flinch 0.8.0").
11. In a browser shell, Check for updates, Copy diagnostics and Open crash logs are `aria-disabled` with visible reasons; `#/settings#about` scrolls the About section into view (its `getBoundingClientRect().top` within the viewport).
12. At 1024×700 the five sections render as a `role="tablist"` with five tabs and `#/settings#coach` selects the Coach tab.

## 12. Open questions for Brad
1. **Desktop detection and IPC.** After the splash navigates to the sidecar origin (`window.location.replace(url)`, splash.js:109), the page is `http://127.0.0.1:{port}`, and `src-tauri/capabilities/default.json` grants no `remote.urls`, so `window.__TAURI__` is not injected there: today's settings.js:102 check would read false in the desktop app and fall through to the `.env` path. This spec uses `?shell=desktop` (appended by the splash, `splash.md`) to pick the path and requires the capability to add `"remote": {"urls": ["http://127.0.0.1:*"]}` so `invoke` works. Confirm this is the fix you want, or should the Tauri shell proxy the sidecar under `tauri.localhost` instead?
2. Ollama URL and coach default live only in the server's memory (app.py:2402, 2413). Persist them (a `settings` table, or `.env` keys) in this release, or keep the caveats?
3. `GET /api/version` reports 0.5.0 (flinch/__init__.py) against pyproject 0.8.0. Fix `__version__` so both routes agree?
4. Should the first-launch landing also run when the desktop app has keys in Credential Manager but the sidecar reports none (a pipe failure), so the user sees the mismatch?
