# Splash (desktop bootstrap screen)

- Route(s): none (it is `ui/index.html` + `ui/splash.js` + `ui/styles.css`, the Tauri window's `frontendDist` page, tauri.conf.json:24; it never shows in the browser build). It hands off to `{sidecar_url}/?shell=desktop`.
- Section: Home (pre-app; the app's Home is the first routed screen after hand-off)
- Purpose (one sentence, what the researcher does here): watch the first-launch setup (or the few-second relaunch) say what it is doing, how far along it is and how long it has taken, retry or copy diagnostics if it fails, and, when the runtime is already installed and an update is known within three seconds, decide whether to update before the app opens.
- Arrives from: launching Flinch.exe (every launch; on a warm launch it is on screen for the `/health` poll only). Leaves to: the sidecar origin via `window.location.replace(url + "/?shell=desktop")` (splash.js:109 today, without the flag); or stays on the error state.
- Components used (restyled by hand, no Svelte on this page: the tokens of `../02-tokens.md` as plain CSS classes in `ui/styles.css`): LoadingScreen (`../03-components.md §24`, without Pry's SVG stack), Progress, UpdateCard (§30, card variant), Button, Caveat note, InsetBox, Toast (one slot, errors only).
- Baseline surfaces replaced: today's `ui/index.html` (brand "F.", "Preparing Flinch…", "This is a one-time setup. It should take about 15 seconds.", indeterminate bar, stage line, error box, Troubleshooting details, diag hint) and `ui/splash.js` (STAGE_LABELS, six-stage percent, navigate loop, error wiring).

## 1. Wireframe, 1280×800
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                      │
│   R1  SETTING UP FLINCH ───────────────────────────────────────────────────── 0:42   │
│       First launch                                                                   │
│   R2  Installing Flinch into the runtime…                                            │
│       ████████████████████░░░░░░░░░░░░░░░░░░░░  3 of 5 steps                         │
│       No estimate yet. Flinch is timing this for next time.                          │
│   R3  ✓ Checked the environment                                              1 s     │
│       ✓ Extracted the Python runtime                                        18 s     │
│       ● Creating the virtual environment                                     9 s     │
│       ○ Installing Flinch                                                            │
│       ○ Starting the server                                                          │
│   R4  │ Setup runs once, offline, from files inside the installer. Nothing is        │
│       │ downloaded. The runtime lives in %LOCALAPPDATA%\Flinch\runtime.              │
│                                                                                      │
│   R5  (update card; only on a warm launch when an update is known within 3 s)        │
│       ┌ UPDATE  Flinch 0.9.0 is ready ─────────────────────────────────────────┐    │
│       │ • Benchmarks section  • Settings in one place                            │    │
│       │ Your sessions, probes and results stay where they are.                   │    │
│       │ [Update] [Later] [Skip this version]                                     │    │
│       └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│   R6  (error state replaces R2–R4)                                                   │
│       Setup didn't finish                                                            │
│       pip install failed: … (the server's words, in mono, scrollable)                │
│       ▸ Troubleshooting (anti-virus exclusion for %LOCALAPPDATA%\Flinch\runtime)      │
│       [Try again]  [Copy diagnostics]  [Open crash logs]                              │
│   R7  diag line: bootstrap:progress creating_venv · venv created (text-zinc-600)      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
The content column is `max-w-5xl`, centred, `px-6`, on `bg-zinc-950`; the brand mark (F with the red accent dot, `src-tauri/icons/`) sits above R1 at `h-10`.
### 1024×700 differences
Same single column; the step list and the update card keep full width; R4's note wraps. Nothing is hidden.

## 2. Regions

### R1 Eyebrow, elapsed, hero
- Components: LoadingScreen eyebrow row (`font-mono text-[11px] uppercase tracking-[0.18em] text-indigo-300/80`, hairline rule, elapsed `tabular-nums text-zinc-400`), hero (`font-display text-3xl font-semibold text-zinc-50`).
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| eyebrow | Tauri `invoke("runtime_status")` → `{ready}` (lib.rs:52-59) | `ready` | `false` → "Setting up Flinch"; `true` → "Starting Flinch" | eyebrow |
| elapsed | `performance.now()` since page load | | "0:42" mono, ticks every second; `aria-hidden` (the stage live region carries time at most every 15 s) | eyebrow right |
| hero | `runtime_status.ready` | | "First launch" / "Welcome back" (draft; brad-voice pass) | hero |

### R2 Stage, progress, estimate
- Components: stage line (`text-lg text-zinc-200`), Progress bar (`h-2 rounded-full bg-zinc-800/80`, indigo gradient fill, monotonic), caption `font-mono text-xs text-zinc-400`.
- Content and bindings (event `bootstrap:progress` payload `{stage, message, progress, bytes_downloaded, bytes_total}`, events.rs:17-24; `stage` is snake_case: `probing`, `cleaning`, `extracting_pbs`, `creating_venv`, `installing_deps`, `ready`, events.rs:6-15):

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| stage line | `bootstrap:progress` | `stage`, `message` | the stage's label (R3 table) plus "…"; the server `message` (e.g. "updating flinch package to bundled version...", mod.rs:128-131) is shown as a second line in `text-xs text-zinc-500` with its trailing "..." normalised to "…" | text |
| bar | `bootstrap:progress` | `progress` (0.0–1.0, −1.0 indeterminate), `stage` | fraction = (index of stage among the five visible steps + `progress` when ≥ 0, else 0) ÷ 5, never decreasing; `−1.0` on the current step shows the fill at the step's start with a sheen (`motion-safe`); `bytes_downloaded`/`bytes_total`, when present (events.rs:63-82), print "12.4 MB of 48.0 MB" in the caption | Progress |
| caption | | | "3 of 5 steps" on the left; on the right the estimate: first launch "No estimate yet. Flinch is timing this for next time." (pinned, `03-components.md §24`); later launches "about 25 s left" from `localStorage['flinch:splash:durations']` (per-stage seconds from the last successful run, same origin `tauri.localhost`, so it persists) | caption |

### R3 Step list
- Components: LoadingScreen step list (done Check `text-indigo-400`, current breathing dot, next hollow circle; seconds `font-mono text-xs tabular-nums text-zinc-500`).
- Steps and labels (draft; brad-voice pass), mapped from `BootstrapStage`:

| Step | `stage` values | Label | Notes |
|---|---|---|---|
| 1 | `probing`, `cleaning` | "Checked the environment" / current "Checking the environment" (cleaning appends "removing a previous incomplete install", mod.rs:149-152) | mod.rs:117-120 |
| 2 | `extracting_pbs` | "Extracted the Python runtime" | pbs.rs:75-156; `progress` 1.0 on completion |
| 3 | `creating_venv` | "Created the virtual environment" | venv.rs:8, 43 |
| 4 | `installing_deps` | "Installed Flinch" (warm launch with a drifted bundle: "Updated Flinch to the bundled version", mod.rs:128-131) | pip.rs:26-110 |
| 5 | (after `ready`) `sidecar:ready` or a 200 from `/health` | "Started the server" | lib.rs:80, 171; app.py:3305-3311 |

- Per-step seconds: measured from the first event of that stage to the first event of the next; written to `localStorage['flinch:splash:durations']` on success. The warm launch shows only step 5 (plus step 4 when a reinstall happens).

### R4 Note
- Components: Caveat note (`border-l-2 border-indigo-500/50 pl-3 text-sm text-zinc-400`).
- Text (draft; brad-voice pass): "Setup runs once, offline, from files inside the installer. Nothing is downloaded. The runtime lives in %LOCALAPPDATA%\Flinch\runtime." (CLAUDE.md "runs fully offline"; bootstrap/pbs.rs extracts a bundled tarball). Warm launch: "Starting the server Flinch installed on first launch."

### R5 Update card (warm launch only)
- Components: UpdateCard card variant (`03-components.md §30`).
- Show rule (all three must hold): `runtime_status.ready === true` at splash start; an update check returned "available" **before 3 000 ms from splash start** (`performance.timeOrigin`); the sidecar has not yet been navigated to. The check runs in parallel with the `/health` poll; when both the health poll and the check are pending at 3 s, navigation waits for health only, and the result of the check is discarded for this launch (the app's own banner picks it up later, Settings › About). A check that resolves after navigation started is ignored.
- Content: `info.version`, `info.currentVersion`, `info.notes` (excerpt, three bullets); pinned copy "Flinch {v} is ready", "Your sessions, probes and results stay where they are.", buttons "Update", "Later", "Skip this version".
- Actions:

| Control | Calls | Then |
|---|---|---|
| Update | updater `downloadAndInstall` (L6; not sourceable: the updater plugin is inactive, tauri.conf.json:74-82, and no `pubkey` exists) | progress bar with bytes; on install the app relaunches; on error the card shows "Download failed." / "Install failed." with Try again and Dismiss (Dismiss = Later) |
| Later | none | card hides; navigation proceeds immediately (health permitting) |
| Skip this version | writes `localStorage['flinch:update:skip'] = version` | as Later; the app's banner also honours the skip |

- While the card is shown, the health poll continues and the page holds navigation until the researcher chooses; the stage line reads "Server ready. Waiting for you." after `/health` returns 200.

### R6 Error state
- Components: hero "Setup didn't finish" (`text-zinc-50`), detail InsetBox (`font-mono text-xs text-red-300`, `max-h-40 overflow-auto`), `<details>` Troubleshooting (today's text kept, index.html:26-35, with the path in mono), Buttons (primary sm "Try again", secondary sm "Copy diagnostics", ghost sm "Open crash logs").
- Content and bindings:

| Element | Source route | JSON field | Formatting rule | Component |
|---|---|---|---|---|
| detail | (a) `invoke("bootstrap_runtime_command")` rejection: `AppError::Bootstrap(format!("{e:#}"))` flattens `BootstrapError` to its Display string (lib.rs:71-73; errors.rs:7-32), e.g. "antivirus interference detected: …"; (b) event `bootstrap:error` `{detail}` (lib.rs:201-206, background sidecar launch failure); (c) `AppError::Sidecar` rejection (lib.rs:84-92); (d) the splash's own 60 s health timeout | string | shown verbatim in mono; the page reads `payload.detail`, `payload.message`, `payload.error` and the string form (today's splash reads only `message`/`error`, splash.js:149-155, so case (b) shows "Unknown bootstrap error."); the title becomes "Blocked by anti-virus" when the string starts with "antivirus interference detected" (errors.rs:24-25; pip.rs:242) | InsetBox |
| stderr | `invoke("sidecar_stderr")` (lib.rs:41-48) when the sidecar exists | `Vec<String>` | last 20 lines appended under the detail in a second InsetBox "Server output" | InsetBox |
| Try again | `invoke("bootstrap_runtime_command")` again (lib.rs:66-93) | | clears the error, restarts R2–R3; elapsed restarts | Button |
| Copy diagnostics | `invoke("copy_diagnostic")` (crash.rs:158-161) → string | | clipboard; one Toast slot "Copied diagnostics (keys and paths removed)." | Button |
| Open crash logs | `invoke("list_crash_logs")` (crash.rs:163-170) | `Vec<String>` | lists the paths in an InsetBox; the folder is `%LOCALAPPDATA%\Flinch\logs` (CLAUDE.md) | Button |

### R7 Diagnostic line
- `text-[10px] text-zinc-600`, `aria-hidden`: the last event name and message, as today's `diag()` user-visible branch (splash.js:12-15); console logging stays (`console.log("[flinch-splash]", …)`), with every `bootstrap:log` line (events.rs:85-87) appended to the console only.

## 3. States
| State | Trigger | R1 | R2 | R3 | R4 | R5 | R6 | Readout sentence (draft; brad-voice pass) |
|---|---|---|---|---|---|---|---|---|
| no Tauri API | `window.__TAURI__` absent (dev browser) | "Flinch" | hidden | hidden | hidden | hidden | "Flinch's desktop runtime is not available. Relaunch Flinch." (today's `bail`, splash.js:195) | (the stage line is the live region: "The desktop runtime is not available.") |
| probing | page load → `runtime_status` | eyebrow pending | "Checking the environment…" indeterminate | step 1 current | hidden | hidden | hidden | "Checking the environment." |
| first launch | `ready:false` → `bootstrap_runtime_command` | "Setting up Flinch" / "First launch" | stage + bar | 5 steps | note | hidden | hidden | per stage: "Extracting the Python runtime." … |
| reinstall on warm launch | `ready:true` then `installing_deps` from `bootstrap_runtime_command` (mod.rs:128-131) | "Starting Flinch" | "Updating Flinch to the bundled version…" | steps 4, 5 | warm note | hidden | hidden | "Updating Flinch to the bundled version." |
| warm launch | `ready:true` and `sidecar:ready` or health 200 | "Starting Flinch" / "Welcome back" | "Starting the server…" | step 5 | warm note | per show rule | hidden | "Starting the server." |
| health polling | after `ready` | | "Waiting for the server…" + attempt count in R7 | step 5 current with seconds | | | | announced at 15 s: "Still waiting for the server, 15 seconds." |
| update known in time | check resolved < 3 s, runtime ready | | "Server ready. Waiting for you." once healthy | step 5 done | | card | | "Flinch 0.9.0 is ready to install." |
| update, downloading | Update | | | | | progress bytes | | "Downloading the update, 12.4 MB of 48.0 MB." |
| update, error | | | | | | error line, Try again, Dismiss | | |
| update, later / skip | | | | | | hidden | | navigation proceeds |
| update check late | > 3 s | | | | | never shown | | |
| ready, navigating | health 200 (no card, or card dismissed) | | "Opening Flinch…" | all done | | | | "Opening Flinch." |
| error (bootstrap) | invoke rejects / `bootstrap:error` | "Setup didn't finish" | hidden | hidden | hidden | hidden | detail, Troubleshooting, buttons | "Setup didn't finish: {first 80 chars of detail}." |
| error (anti-virus) | detail starts with "antivirus interference detected" | "Blocked by anti-virus" | | | | | Troubleshooting open by default | |
| error (health timeout) | 60 s without a 200 (splash.js:92, 117) | "Flinch's server did not start" | | | | | detail "No answer from {url}/health in 60 seconds." + server output | |
| retrying | Try again | as first launch | | | | | hidden | |
| reduced motion | OS setting | | fill snaps, no sheen | dot solid | | | | |

## 4. Numbers on this screen
| Number | Formula | Inputs shown beside it | Component |
|---|---|---|---|
| "0:42" | now − page load, mm:ss | the step seconds sum to it (minus waits) | R1 |
| "3 of 5 steps" | done steps of the visible step count (5 first launch; 1 or 2 warm) | the list | R2 caption |
| bar fraction | (done steps + current `progress` if ≥ 0) ÷ visible steps; monotonic | caption | Progress |
| "about 25 s left" | Σ stored durations of remaining steps (localStorage) | "from last time" in the caption `title` | R2 caption |
| per-step "18 s" | stage first-event to next-stage first-event | | R3 |
| "12.4 MB of 48.0 MB" | `bytes_downloaded` / `bytes_total` (events.rs:63-82) | | R2 caption |
| attempt count | health poll iterations (500 ms apart, splash.js:94-116) | R7 only | R7 |
| "in 60 seconds" | the poll deadline constant (splash.js:92) | | R6 |
| update bytes | updater `downloaded` of `total` | `aria-valuetext` | R5 |

## 5. Caveats (rule 2)
| ID | Phrase (draft; brad-voice pass) | Beside | Source in code |
|---|---|---|---|
| `no_estimate` | "No estimate yet. Flinch is timing this for next time." | R2 first launch | `03-components.md §24` pinned; today's "about 15 seconds" (index.html:15) has no source and is dropped |
| `offline_setup` | "Setup runs once, offline, from files inside the installer. Nothing is downloaded." | R4 | pbs.rs `extract_bundled`; CLAUDE.md bootstrap note |
| `estimate_from_last` | "The estimate is last launch's timing on this machine." | R2 caption `title` | localStorage rule above |
| `update_keeps` | "Your sessions, probes and results stay where they are." | R5 | `03-components.md §30`; data lives in `%APPDATA%\Flinch\flinch.db`, outside the runtime dir |
| `update_cap` | "Update checks that take longer than three seconds wait for the app." | R5 (sr-only when the card is skipped for time) | this spec's show rule |

## 6. Terms (rule 4)
This page has no Term component (no tooltip engine); plain words are used in place: "the Python runtime", "the virtual environment", "the server". The glossary entries `sidecar` and `runtime` exist in the app for the same things.

| Term | Where it appears | Definition source |
|---|---|---|
| Python runtime | R3 step 2 | glossary `runtime` (in-app) |
| virtual environment | R3 step 3 | glossary `runtime` |
| the server | R3 step 5, R6 | glossary `sidecar` |

## 7. First-time tips (rule 6)
None: the page is itself the first-time guidance (pre-read §2.6 "a loading/setup screen that says what it is doing"). FirstTimeTips start on the app's first routed screen.

| Tip id | Target | Blurb (draft) | Shown when |
|---|---|---|---|
| n/a | | | |

## 8. Keyboard and focus
- Shortcuts: none custom. `Enter`/`Space` on the focused button.
- Focus order: on load, focus the `<main>` (`tabindex=-1`) so a screen reader reads the eyebrow and stage; in the error state focus moves to "Try again"; when the update card appears focus moves to the card (`tabindex=-1`), then Update, Later, Skip.
- Live regions: the stage line is `role="status" aria-live="polite" aria-atomic="true"` and changes at most every 3 s (stage changes always; the elapsed time is announced only at 15 s intervals while waiting); the error detail is `role="alert"`; the bar is `role="progressbar"` with `aria-valuetext` "3 of 5 steps, about 25 seconds left" (or "no estimate yet").

## 9. Dialogs and overlays opened from here
- None. The update card is inline (R5); errors are inline (R6); the one Toast slot is for "Copied diagnostics".

## 10. Routes called (complete)
| Method | Route | From (region/action) |
|---|---|---|
| (Tauri) | `invoke("runtime_status")` → `{ready}` | page load (lib.rs:52-59) |
| (Tauri) | `invoke("bootstrap_runtime_command")` | first launch, Try again (lib.rs:66-93) |
| (Tauri) | `invoke("sidecar_url")` → base URL | health poll, re-resolved every attempt (lib.rs:32-39; splash.js:97-101) |
| (Tauri) | `invoke("sidecar_stderr")` | error state (lib.rs:41-48) |
| (Tauri) | `invoke("copy_diagnostic")`, `invoke("list_crash_logs")` | error buttons (crash.rs:158-170) |
| (Tauri event) | `bootstrap:progress`, `bootstrap:log`, `bootstrap:error`, `sidecar:ready` | listeners (events.rs:40-87; lib.rs:80, 171, 201-206); `bootstrap:ready` is listened to for compatibility but nothing emits it today |
| GET | `{sidecar_url}/health` | poll every 500 ms, 60 s deadline, `cache: "no-store"` (app.py:3305-3311; allowed by CSP `connect-src http://127.0.0.1:*`, tauri.conf.json:19) |
| (updater) | `check()` and `downloadAndInstall()` | R5 (L6; inactive today, tauri.conf.json:74-82) |
| navigation | `window.location.replace(url + "/?shell=desktop")` | ready + card dismissed |

## 11. Acceptance checks (concrete, DOM-level, runnable by a tester)
1. `ui/index.html` contains no `on*=` attributes and no inline `<script>` body; its only script tag is `<script src="./splash.js">` and its only stylesheet `./styles.css`; with the production CSP (`script-src 'self'`, tauri.conf.json:19) the WebView console shows no CSP violation on load.
2. With `runtime_status` → `{ready:false}`, the eyebrow reads "SETTING UP FLINCH", the hero "First launch", the step list has five rows, and the caption contains "No estimate yet. Flinch is timing this for next time."
3. Feeding the events `probing`, `extracting_pbs` (progress −1), `extracting_pbs` (progress 1.0), `creating_venv`, `installing_deps`, `ready` in order: the `progressbar`'s `aria-valuenow` never decreases, the done rows gain a Check and a seconds value, and after `ready` the stage line reads "Starting the server…".
4. The elapsed counter is `tabular-nums`, ticks each second, and is `aria-hidden`; the stage live region changes at most once per 3 s (assert by timestamping mutations).
5. After a successful run `localStorage['flinch:splash:durations']` holds a per-stage seconds object; on the next load with `{ready:true}` the caption reads "about N s left" where N equals the stored step-5 seconds (± 1).
6. Mocking `/health` to 200 and the updater check to resolve "available" at 1 000 ms with `{ready:true}`: the UpdateCard is in the DOM with "Flinch 0.9.0 is ready", focus is on the card, and `location.replace` has not been called; pressing Later calls `location.replace` with a URL ending in `/?shell=desktop`.
7. Same as 6 but the check resolves at 3 500 ms: the card never mounts and `location.replace` was called at the first healthy poll.
8. With `{ready:false}`, an "available" result at 500 ms does not mount the card (runtime not installed).
9. Rejecting `invoke("bootstrap_runtime_command")` with "antivirus interference detected: pip exited 1" renders the hero "Blocked by anti-virus", the detail text verbatim in a `role="alert"`, Troubleshooting `<details open>`, and focus on "Try again".
10. Emitting `bootstrap:error` with `{detail:"sidecar launch failed"}` renders that text (not "Unknown bootstrap error.").
11. With `/health` never answering, after 60 s the hero reads "Flinch's server did not start" and the detail contains "60 seconds".
12. At 1024×700 the column has no horizontal scroll and the update card is fully visible without scrolling when the step list has two rows.

## 12. Open questions for Brad
1. The updater is inactive (`active: false`, empty `pubkey`, tauri.conf.json:74-82) and no `latest.json` exists. The 3 s update card (R5) is specified now so the page needs no redesign in L6; confirm L6 is where the signing key, endpoint and `check()` land, and that nothing in R5 should ship before then.
2. The `?shell=desktop` flag is this spec's choice for telling the app it runs under Tauri (see `settings.md` Q1 about `window.__TAURI__` not being injected on the sidecar origin). Alternative: have the Rust side pass a header or serve the app under `tauri.localhost`. Which?
3. Today's "about 15 seconds" (index.html:15) is unsourced; the first launch measured on your machine would give a real default to ship in place of "No estimate yet". Do you want that number captured from `scripts/verify-phase1.py` or left to the per-machine estimate?
4. `bootstrap_runtime_command` returns the bootstrap error as a flattened string (lib.rs:71-73), so the page sniffs "antivirus interference detected" to pick the title. Change `AppError::Bootstrap` to carry `BootstrapError` `{kind, detail}` so the page can switch on `kind`?
