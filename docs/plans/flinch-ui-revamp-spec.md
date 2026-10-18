# Flinch 0.9: UI revamp specification

Status: ready for implementation. Every decision in this document is final. There are no options, no "to be decided" items and no defaults waiting for approval. Where the document says "do X", do X. Where an implementer finds a real contradiction between this document and the code, the code they find is the fact and the document's intent (stated next to each rule) decides; they note the discrepancy in the task's commit message.

Source of truth for the current code is the repository at the commit this document was written against (`flinch` branch `main` at 0.8.0, Pry at `888bd51`, 0.4.0). Line numbers cited are from that state.

## 0. How to read this document

- Section 1 is the decision register: every product decision, numbered, with the one-line reason. Later sections only apply them.
- Sections 2 to 7 are the design: shell, screens, components, copy. Each screen is specified element by element with the exact strings, the API calls it makes and what it does on every state (empty, loading, error, done).
- Section 8 is the frontend code layout, file by file, and the modules every screen uses (API client, streams, stores, Tauri bridge).
- Section 9 is the backend change list: each change names the file, the function, the exact edit and the test that proves it.
- Section 10 is packaging: Tauri, wheel, bundle script, dev flow.
- Section 11 is the test harness.
- Section 12 is the task breakdown, in order, with the acceptance check for each task.
- Section 13 is the deletion list: everything removed at switch-over.
- Appendix A is the full copy inventory (glossary, tips, tour, methodology page, errors).
- Appendix B maps every current feature and route to its new home, so nothing is dropped by accident.

Terms used throughout:
- "Sidecar": the Python FastAPI process (`python -m flinch.app`).
- "Shell": the Tauri 2 desktop wrapper (`src-tauri/`).
- "App": the new SvelteKit frontend (`ui/`).
- "Section": one of the three top-level areas (Probe, Studies, Data).
- "Study": any of the six multi-run tools under Studies.
- "Run": one probe sent once to one model in one session (a `runs` row).
- "Session": a named container for runs against one target model (a `sessions` row).

## 1. Decision register

Each row is final. "Reason" is the one-line justification so later readers do not reopen it.

| # | Decision | Reason |
|---|----------|--------|
| D1 | Stack: SvelteKit 2 + Svelte 5 runes + Tailwind 3 + TypeScript strict + Vitest, `adapter-static` with `fallback: index.html`, built into `ui/build`. Same versions as Pry 0.4.0 (`ui/package.json` in Pry). | One toolchain across both products; Pry components port without rewriting. |
| D2 | Replace the vanilla-JS UI in one go. `flinch/static/` is deleted at switch-over. No iframe shim, no legacy mode. | Two UIs would double every bug. |
| D3 | The sidecar serves the API only. Tauri loads `ui/build` as `frontendDist`. The bootstrap splash and first-run setup are routes in the app. The wheel no longer ships HTML. | Matches Pry's serving model; removes the sidecar/WebView cache problem. |
| D4 | Dev flow: `vite dev` on `127.0.0.1:5173` proxies `/api` and `/health` to `http://127.0.0.1:8000` where `python -m flinch.app` runs. `cargo tauri dev` uses `devUrl` 5173 with `beforeDevCommand`. | Same as Pry. |
| D5 | Palette: Pry's dark zinc scale with indigo accent. Flinch red (`#dc2626`) appears only on the brand mark's dot. Dark only; tokens are CSS variables so a light theme can be added later without touching components. | Visual kinship with Pry; red is reserved so it never competes with classification colours. |
| D6 | Classification colours: Pry's orange/blue pair. Refused and Collapsed on two orange shades, Negotiated and Complied on two blue shades. Each badge carries a letter glyph: R, X, N, C. | Two hues read as "pushed against" vs "went along"; glyphs survive colour-blindness and tiny sizes. |
| D7 | Fonts: system UI stack for everything; monospace only for prompt text, model responses, ids and numbers. No Google Fonts, no bundled webfonts. | Offline, fast, matches Pry. |
| D8 | Three sections in the header: Probe, Studies, Data. | Three questions a researcher asks: "what does it do", "what does it do across many runs", "what did I find". |
| D9 | Session switcher lives in the header (left, next to the brand), with "New session" as the first menu item. | A session is the unit of all Probe work; it must be visible everywhere. |
| D10 | Settings is a 440px right-hand drawer, ported from Pry's `SettingsDrawer`. One panel holds keys, Ollama, coach default and the Developer section. | One place for configuration; the drawer never leaves the current screen. |
| D11 | Keys: in the desktop app, keys are saved to Windows Credential Manager through the `set_api_key` Tauri command and pushed to the running sidecar with `POST /api/settings/set-key`. In dev, keys are written to `.env` through `POST /api/settings/keys`. The drawer shows one line naming which store is in use. | Keeps keys out of the process environment in the shipped app; keeps dev simple. |
| D12 | Guidance: a Guide (?) menu in the header with five items: Take the tour, Glossary, Methodology, Policies, Keyboard shortcuts. The tour is at most 10 steps. First-time tips (Pry's `FirstTimeTip`) and glossary hovers (Pry's `Term`) are used throughout. No Lessons sidebar. | Pry's guidance pattern minus the lesson runner Flinch does not need. |
| D13 | Pushback: one editable text box prefilled with the coach's draft, one "Send pushback" button, one "Skip" button. If the text was edited it is stored with `source: "override"`; the panel says so before sending. | Removes the three-button choice nobody could explain. |
| D14 | "Promote to coach example" is renamed "Teach the coach this exchange". | Says what it does. |
| D15 | Probe rail: 288px, collapsible to a 44px strip, open by default, hidden in the Data section. | Pry's panel density; Data has no probe context. |
| D16 | Renames: Stat Analysis becomes Repeat runs; Experiments and the conditions half of Framing Variants become Conditions; Framing Variants becomes Framings; Multi-Model Compare becomes Model compare; Snapshots becomes Baselines; Dashboard becomes Browse; Policy Scorecard becomes Scorecard; Publication Export becomes Publish. Narrative Momentum becomes Sequences. | Names say what the thing is, not how it was built. |
| D17 | Backend bugs are all fixed now (section 9): batch Cancel honoured server-side; Pause keeps `paused` and cancels worker tasks; rate-limiter config shape; classification written for every condition-study response; `.env` loading never overrides already-set variables; `/export?format=jsonl`; empty system prompt allowed as a control condition; `Cache-Control: no-store` on API responses; the real app version in every export. | The UI cannot be trusted while it papers over server faults. |
| D18 | Repetitions are implemented in the backend: each (condition, prompt, model) cell runs N times; repeats are separate `experiment_responses` rows with a `repetition` column. | A study with one sample per cell is not a study. |
| D19 | Tests: pytest static/contract checks on the sidecar, Vitest copy-lint and unit tests in `ui/`, and a Playwright smoke suite that drives the built app against the sidecar with a fake model server. Playwright is a dev-only dependency. | Same three layers as Pry, plus the end-to-end run Flinch needs because its core loop crosses three processes. |
| D20 | Condition-study exports: CSV of responses, JSONL, full JSON, preregistration (Markdown), report (Markdown). The Prolific CSV is exported from the Human raters panel, not the Export dialog. | One place per artefact. |
| D21 | Orphaned backend features all get UI: AI rater pipeline, HH-RLHF import, Prolific task generation and CSV, human-eval import, compliance scorecard, cross-probe thresholds, strategy effectiveness. | Nothing shipped in the sidecar is dark. |
| D22 | Keyboard shortcuts: S, P, K, N, R, Up, Down scoped to the Probe section; `?` opens the shortcuts overlay from anywhere; Enter sends in single-line fields and submits dialogs; Escape closes the topmost layer. | Keeps the current muscle memory without the cross-view misfires. |
| D23 | Version 0.9.0 everywhere: `flinch/__init__.py`, `pyproject.toml`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `ui/package.json`. `/health` falls back to "0.9.0". | One number. |
| D24 | Export dialog: a grouped list. Raw data (JSON, CSV, with four include checkboxes under "For tools"), Reports (Findings, Research report, HTML, PDF with a theme picker), For tools (AI agent format). Cross-session compare is its own row. One sentence under every row. | A row you can read beats a button you have to guess. |
| D25 | Developer section in Settings: database path, app and sidecar versions, link to `/docs`, Open DevTools (desktop only). | Same as Pry, plus the two facts support asks for. |
| D26 | First run: Welcome, Setting up Python, Add a key, Load probes, Done. Step dots as in Pry's `welcome/+layout.svelte`. | Pry's pattern; Flinch has no hardware step and needs a key step. |
| D27 | Reuse from Pry by copying and adapting: `TabbedPanel`, `ResizableSplit`, `Readout`, `Term`, `FirstTimeTip`, `Pointer`, `SettingsDrawer`, `TourMenu` (renamed `GuideMenu`), `popup/place.ts` and `popup/measure.ts` and `popup/occupied.svelte.ts`, `copy/visible-strings.ts`, `copy/copy-lint.test.ts`, `errors.ts` (rules replaced), `update-copy.ts` pattern for copy modules. | Proven, tested, already in the house style. |
| D28 | Conditions studies are global (not session-scoped) and run through the experiments API only. The session-scoped `/batch-conditions` route and `Runner.run_batch_conditions` are deleted. "Conditions" variant files (`- type: conditions`) become an import source for a study's condition list. | One runner for one concept. |
| D29 | Model compare keeps creating one session per model (as today) and is listed under Studies; its auto-created sessions are hidden from the session switcher and Browse (as today's `WHERE s.notes NOT LIKE` filter does). | Persistence without clutter. |
| D30 | Sequences keep both modes (automatic and interactive), auto-whittle, batches with cost estimate, the IF narrative engine toggle, cross-probe thresholds and strategy effectiveness, all in one screen with two tabs: Run and Results. | Everything the backend does, in the order a researcher does it. |

## 2. Product shape

### 2.1 Sections and what each answers

| Section | Question it answers | Needs a session | Probe rail |
|---------|---------------------|-----------------|------------|
| Probe | What does this model do with this probe, and what happens when I push back? | Yes | Shown |
| Studies | What does it do across many probes, many runs, many framings, many models? | Framings, Repeat runs, Sequences, Baselines: yes. Conditions, Model compare: no. | Shown |
| Data | What did I find, and how do I get it out? | No | Hidden |

### 2.2 Routes

SvelteKit file routes under `ui/src/routes/`. Client-side only (`ssr = false` in the root `+layout.ts`, as Pry).

| Route | Screen | Section |
|-------|--------|---------|
| `/` | Redirect: to `/welcome` when `localStorage["flinch:onboarding_done"] !== "true"`, else to `/probe`. | |
| `/welcome` | First run step 1: Welcome | |
| `/welcome/python` | Step 2: Setting up Python | |
| `/welcome/key` | Step 3: Add a key | |
| `/welcome/probes` | Step 4: Load probes | |
| `/welcome/done` | Step 5: Done | |
| `/probe` | The Probe workspace | Probe |
| `/probe/runs/[runId]` | The Probe workspace showing a saved run | Probe |
| `/studies` | Redirect to `/studies/framings` | Studies |
| `/studies/framings` | Framings | Studies |
| `/studies/conditions` | Conditions: list | Studies |
| `/studies/conditions/new` | Conditions: new study | Studies |
| `/studies/conditions/[id]` | Conditions: one study (tabs: Run, Results, Raters, Export) | Studies |
| `/studies/repeat` | Repeat runs | Studies |
| `/studies/sequences` | Sequences | Studies |
| `/studies/compare` | Model compare: new comparison and history | Studies |
| `/studies/compare/[id]` | Model compare: one saved comparison | Studies |
| `/studies/baselines` | Baselines | Studies |
| `/data` | Redirect to `/data/browse` | Data |
| `/data/browse` | Browse: all sessions, comparisons, sequences | Data |
| `/data/browse/sessions/[id]` | One session's runs | Data |
| `/data/browse/sequences/[id]` | One sequence's turns | Data |
| `/data/scorecard` | Scorecard | Data |
| `/data/publish` | Publish | Data |
| `/data/coach` | Coach examples | Data |
| `/guide/methodology` | Methodology page | (opens in the workspace with the rail hidden) |
| `/guide/glossary` | Glossary page | same |
| `/guide/policies` | Policy reader | same |

Settings (drawer), Export (dialog), New session (dialog), Keyboard shortcuts (overlay) and the tour are not routes; they are state in the root layout.

### 2.3 Persistent client state (localStorage keys)

All keys are prefixed `flinch:`. Reads and writes go through `ui/src/lib/prefs.ts` (one `read(key)`/`write(key, value)` pair wrapped in try/catch, as Pry's `lessons/layout.ts` does).

| Key | Value | Written by |
|-----|-------|-----------|
| `flinch:onboarding_done` | `"true"` | Welcome step 5 |
| `flinch:onboarding_step` | one of `welcome`, `python`, `key`, `probes` | each welcome step on leaving it |
| `flinch:session_id` | integer as string | session switcher |
| `flinch:rail_open` | `"true"`/`"false"` | the rail's collapse button |
| `flinch:split_ratio` | float | `ResizableSplit` in Conditions results |
| `flinch:tip_seen:{id}` | `"true"` | `FirstTimeTip` |
| `flinch:tour_seen` | `"true"` | the tour, on finish or close |
| `flinch:devtools_autoopen` | `"true"`/`"false"` | Settings > Developer |
| `flinch:export_theme` | theme name | Export dialog theme picker |
| `flinch:probe_filter_domain` | domain string | rail domain filter |

Nothing else is stored client-side. Every other fact comes from the sidecar on each visit.

### 2.4 Session model in the app

- `session` store (`ui/src/lib/session.svelte.ts`): `{ current: Session | null, list: Session[] }`. On app start: `GET /api/sessions`, then pick `flinch:session_id` if it exists in the list, else the newest session, else `null`.
- Model compare's auto-created sessions (notes beginning `Auto-created by multi-model comparison`) are excluded from `list` in the client as well as by the server's Browse query.
- Every Probe and session-scoped Studies screen reads `session.current`. When it is `null` the screen shows the "No session yet" panel (section 5.1) instead of its content.
- Changing the session resets the Probe workspace to idle and reloads the rail (`GET /api/probes?session_id=`), stats, snapshots and run history.
## 3. Visual system

### 3.1 Tokens

Defined once in `ui/src/app.css` on `:root` and consumed through Tailwind's `extend.colors` so components write `bg-surface` rather than hex. The values are Pry's zinc/indigo palette. A light theme later only redefines the variables under `:root[data-theme="light"]`; no component changes.

```css
:root {
  --bg: 9 9 11;            /* zinc-950, window background */
  --surface: 24 24 27;     /* zinc-900, header, cards, drawer */
  --surface-2: 39 39 42;   /* zinc-800, hover rows, dividers */
  --border: 39 39 42;      /* zinc-800 */
  --border-strong: 63 63 70; /* zinc-700, inputs */
  --text: 244 244 245;     /* zinc-100 */
  --text-2: 212 212 216;   /* zinc-300 */
  --text-3: 161 161 170;   /* zinc-400 */
  --text-4: 113 113 122;   /* zinc-500, labels, hints */
  --accent: 99 102 241;    /* indigo-500, primary buttons */
  --accent-hover: 129 140 248; /* indigo-400 */
  --accent-soft: 49 46 129;    /* indigo-900, selected rows */
  --accent-text: 165 180 252;  /* indigo-300 */
  --brand-dot: 220 38 38;  /* Flinch red, brand mark only */
  --danger: 239 68 68;     /* red-500, errors and destructive buttons */
  --danger-soft: 69 10 10; /* red-950 */
  --ok: 52 211 153;        /* emerald-400, "connected", "saved" */
  --warn: 251 191 36;      /* amber-400, "edited", "unsaved" */
  --cls-refused: 249 115 22;     /* orange-500 */
  --cls-collapsed: 253 186 116;  /* orange-300 */
  --cls-negotiated: 125 211 252; /* sky-300 */
  --cls-complied: 59 130 246;    /* blue-500 */
  --cls-unknown: 113 113 122;    /* zinc-500 */
}
```

Tailwind config (`ui/tailwind.config.js`): `darkMode: 'class'`, `content: ['./src/**/*.{html,js,svelte,ts}']`, `theme.extend.colors` maps each token as `rgb(var(--name) / <alpha-value>)`, named `bg`, `surface`, `surface2`, `border`, `borderStrong`, `text`, `text2`, `text3`, `text4`, `accent`, `accentHover`, `accentSoft`, `accentText`, `brandDot`, `danger`, `dangerSoft`, `ok`, `warn`, `clsRefused`, `clsCollapsed`, `clsNegotiated`, `clsComplied`, `clsUnknown`. `fontFamily.sans` is `['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']`; `fontFamily.mono` is `['ui-monospace', 'Cascadia Mono', 'Consolas', 'Menlo', 'monospace']`.

`app.html` is Pry's with `class="dark"` on `<html>`, `<body class="bg-bg text-text">`, title "Flinch". No external stylesheet or script tags.

### 3.2 Type scale

| Use | Classes |
|-----|---------|
| Page title (one per screen) | `text-base font-semibold text-text` |
| Section label (uppercase eyebrow) | `text-[10px] font-medium uppercase tracking-widest text-text4` |
| Body | `text-sm text-text2` |
| Hint under a control | `text-xs text-text4` |
| Readout (plain-words summary) | Pry's `Readout` component, unchanged |
| Prompt text, model responses, pushback text | `font-mono text-[13px] leading-relaxed text-text2 whitespace-pre-wrap` |
| Ids, counts, percentages in tables | `font-mono tabular-nums text-xs` |

### 3.3 Classification badge

Component `ClassBadge` (`ui/src/lib/components/ClassBadge.svelte`). Props: `value: 'refused' | 'collapsed' | 'negotiated' | 'complied' | 'unknown' | null`, `size: 'sm' | 'md'` (default `md`), `glyphOnly: boolean` (default false), `onChange?: (next) => void` (when set, the badge is a button that opens the override menu).

Rendering: an inline-flex pill, `rounded-md border px-1.5 py-0.5 text-xs font-medium`. The glyph is a 14px square (`sm`: 12px) with the letter in `font-mono font-bold text-[10px]` on the classification colour at full strength, white text for `refused` and `complied`, zinc-950 text for `collapsed` and `negotiated` (the lighter shades). The word follows the glyph unless `glyphOnly`.

| value | glyph | word | pill classes |
|-------|-------|------|--------------|
| refused | R | Refused | `border-clsRefused/50 bg-clsRefused/15 text-orange-200` |
| collapsed | X | Collapsed | `border-clsCollapsed/50 bg-clsCollapsed/15 text-orange-100` |
| negotiated | N | Negotiated | `border-clsNegotiated/50 bg-clsNegotiated/15 text-sky-100` |
| complied | C | Complied | `border-clsComplied/50 bg-clsComplied/15 text-blue-200` |
| unknown / null | ? | Not classified | `border-border bg-surface2 text-text3` |

`title` attribute on the pill: the glossary definition of the value (from `glossary.ts`), so hovering any badge explains it. When `onChange` is set the pill has `aria-haspopup="menu"` and clicking opens a 4-row menu (Refused, Collapsed, Negotiated, Complied) with the current row marked; picking a row calls `onChange`. Escape closes the menu.

Stacked bars (session stats, Browse, Repeat runs) use the same four colours in the order refused, collapsed, negotiated, complied and always render a legend of four glyph badges (`glyphOnly`, `sm`) with counts beneath.

### 3.4 Layout constants

| Element | Size |
|---------|------|
| Header | 44px tall (`h-11`), `border-b border-border bg-surface` |
| Probe rail | 288px open, 44px collapsed; `border-r border-border bg-surface` |
| Workspace padding | `p-4` (16px); screen content `max-w-[880px]` unless the screen says `max-w-none` |
| Settings drawer | `max-w-[440px]`, z-index 40 over a z-30 backdrop (Pry's) |
| Dialogs | z-50, `max-w-lg`, `rounded-xl border border-border bg-surface p-5 shadow-xl` |
| First-time tips | z-60 (Pry) |
| Glossary tooltip | z-70 (Pry) |
| Status strip (errors and progress) | fixed bottom, full width, z-45, 36px tall |
| Minimum window | 1024 x 700 (unchanged in `tauri.conf.json`) |

### 3.5 Components ported from Pry (copied into `ui/src/lib/components/`, names kept)

| Component | Changes from Pry |
|-----------|------------------|
| `Readout.svelte` | None. |
| `Term.svelte` | Imports `$lib/glossary` (Flinch's). `data-tour="glossary-term"` kept. |
| `FirstTimeTip.svelte` | Imports `$lib/tips/tips-registry` (Flinch's). The `quickTour` import points at `$lib/tour/state.svelte.ts`. The `.loading-screen` wait is replaced by a `[data-busy="true"]` wait on the root. localStorage prefix `pry:` becomes `flinch:` in `tips/coordinate.ts`. |
| `Pointer.svelte` | None. |
| `TabbedPanel.svelte` | None. |
| `ResizableSplit.svelte` | Default `storageKey` becomes `flinch:split_ratio`. |
| `SettingsDrawer.svelte` | The `lessonsSection` snippet prop is removed. |
| `TourMenu.svelte` renamed `GuideMenu.svelte` | Five menu items (section 7.6). `data-tour="header-help"` kept. |
| `EngineStatusChip.svelte` renamed `SidecarChip.svelte` | Reads `GET /health` and `GET /api/settings/keys`. Shows "Sidecar ready", "Sidecar offline" or "Sidecar starting". Popover rows: Version, Database, Keys (count set), and a "Restart sidecar" button in the desktop app (new Tauri command, section 10.3). |
| `EngineCrashBanner.svelte` renamed `SidecarCrashBanner.svelte` | Text: "Flinch's sidecar stopped." Button "Restart sidecar". Listens to `sidecar:crashed` and `sidecar:restarted` (new events, section 10.3). |
| `popup/place.ts`, `popup/measure.ts`, `popup/occupied.svelte.ts` | None. `OCCUPIED.updateBanner` is kept and registered to the status strip's selector. |
| `errors.ts` (`friendlyError`) | Rules replaced by Flinch's (Appendix A.5). |
| `copy/visible-strings.ts`, `copy/copy-files.ts`, `copy/copy-lint.test.ts` | `COPY_FILES` lists Flinch's copy modules (section 11.2). Lanes machinery (`PENDING_LANES`, `FILE_OWNER`) is deleted; every file is checked. |

### 3.6 New shared components

| Component | Props | Behaviour |
|-----------|-------|-----------|
| `ClassBadge.svelte` | section 3.3 | |
| `ClassBar.svelte` | `counts: Record<cls, number>`, `total: number`, `legend: boolean` | 6px stacked bar plus the glyph legend. |
| `Panel.svelte` | `title: string`, `eyebrow?: string`, `readout?: string | null`, `actions?: Snippet`, `children` | Card: eyebrow, title row with actions on the right, `Readout` under the title when `readout` is set, then content. Every Studies and Data screen is built from panels. |
| `EmptyState.svelte` | `title`, `body`, `action?: {label, onClick}` | Centered, `max-w-sm`, used for every empty list. |
| `StatusStrip.svelte` | reads `status` store | Fixed bottom strip. Shows at most one progress line (left) and one error (right, with a "Details" disclosure and a "Dismiss" button). Errors auto-dismiss after 8 seconds unless the pointer is over the strip. Registers itself as an occupied rect. |
| `Dialog.svelte` | `open`, `title`, `onClose`, `width?: 'md' | 'lg'`, `children`, `footer?` | Backdrop click and Escape close. Focus moves into the dialog on open and back on close. |
| `ModelPicker.svelte` | `value: string`, `onChange`, `providers: ProviderGroup[]`, `allowCustom: boolean` | Grouped `<select>` from `GET /api/models`; unavailable providers' options disabled with the hint in the group label; "Other model id…" option reveals a text input when `allowCustom`. |
| `ProbePicker.svelte` | `probes`, `selected: Set<number>`, `onChange`, `height?: string` | Search box, domain group headers with a tri-state checkbox, one checkbox per probe, "All" and "None" links. Used by New session, Repeat runs, Conditions, Model compare. |
| `ConfirmButton.svelte` | `label`, `confirmLabel`, `onConfirm`, `danger: boolean` | First click swaps the label to `confirmLabel` for 4 seconds; second click runs. Replaces every `window.confirm`. |
| `CopyButton.svelte` | `text` | Copies, shows "Copied" for 1.5 s. |
| `DownloadLink.svelte` | `href`, `label`, `filename?` | Fetches with the sidecar client, reads `Content-Disposition`, saves through the browser download path in dev and through `@tauri-apps/plugin-dialog` save dialog in the desktop app (section 8.6). |
| `KeyRow.svelte` | `provider`, `label`, `isSet`, `masked` | One provider row in Settings (section 7.5). |
| `StreamProgress.svelte` | `label`, `completed`, `total`, `failed`, `onCancel?` | Progress bar with counts and a Cancel button; used by every SSE-driven run. |

### 3.7 Copy rules (enforced by `copy-lint.test.ts`)

1. No em dashes in user-visible strings. Use a comma, a colon or a new sentence.
2. No banned example names (Pry's list, copied verbatim).
3. "Hugging Face" spelled as two words (kept from Pry; appears in HH-RLHF import copy).
4. Every button label is a verb phrase ("Send pushback", "Run selected"), never a noun ("Export").
5. Every screen opens with one sentence saying what it is for, in the `Panel` readout or the page's lead line. The sentence names a research question, not a feature.
6. No "please", no exclamation marks, no "simply".
7. Model and provider names are spelled: Anthropic, OpenAI, Google, xAI, Together, Ollama.
8. Classification words are always the badge words: Refused, Collapsed, Negotiated, Complied. Never "refusal rate" in a label; say "Refused" with a percentage.
9. Strings live in copy modules (`ui/src/lib/copy/*.ts`) when they appear in more than one component or in a test; otherwise inline in the component.
## 4. The shell

The root layout (`ui/src/routes/+layout.svelte`) renders, top to bottom: the header, then a row of [probe rail | workspace], then the status strip. Overlays (settings drawer, dialogs, tips, tour, shortcuts) mount here. The welcome routes use their own layout (`ui/src/routes/welcome/+layout.svelte`) with no header.

### 4.1 Header (44px)

Left to right:

1. Brand mark: the "F" with the red dot (SVG, `ui/src/lib/components/FlinchMark.svelte`, 20px), then the word "Flinch" in `text-sm font-semibold`. Clicking goes to `/probe`.
2. Session switcher (`SessionSwitcher.svelte`, `data-tour="session-switcher"`): a button showing the current session name and its model in `text-xs text-text3` after a middle dot, truncated at 28 characters. When no session: "No session" in `text-text4`. Click opens a menu: first row "New session…" (opens the New session dialog), a divider, then every session newest first as "name · model · N runs" (`N runs` from `GET /api/sessions` extended in section 9.14 to carry `run_count`), the current one marked. A trailing row "Delete current session…" (danger colour) uses `ConfirmButton` inline: label becomes "Delete 'name' and its runs" on first click. Escape closes.
3. `SidecarChip` (section 3.5).
4. Section tabs, centred in the remaining space, `role="tablist"`: Probe, Studies, Data. Each is a link; the active one has `border-b-2 border-accentHover text-accentText`, others `text-text3 hover:text-text`. `data-tour="section-tabs"`. Keyboard: Left and Right move between tabs when the strip has focus.
5. Right cluster: Export button (icon `Download`, `aria-label="Export"`, `data-tip="export-button"`, disabled when no session; opens the Export dialog), `GuideMenu` (icon `CircleHelp`), Settings button (icon `Settings`, `aria-label="Open settings"`, `data-tour="settings-button"`; shows a 8px red dot in its corner while no key is set and the drawer has not been opened this launch).

### 4.2 Probe rail (`ProbeRail.svelte`)

Visible in Probe and Studies. Hidden (not rendered) in Data and Guide routes. Open state from `flinch:rail_open`, default open.

Collapsed (44px): a vertical strip with the collapse toggle (icon `PanelLeftOpen`, `aria-label="Show probes"`) at the top and the probe count rotated 90 degrees in `text-xs text-text4`.

Open (288px), top to bottom:

1. Rail header row: label "Probes" (eyebrow), count `visible / total` in `font-mono text-xs text-text4`, a "Select" toggle button (`text-xs`), the collapse toggle (icon `PanelLeftClose`, `aria-label="Hide probes"`).
2. Search input: placeholder "Search probes", clears with Escape when focused, `data-tour="probe-search"`.
3. Domain select: first option "All domains", then each distinct domain of the session's probes, sorted. Stored in `flinch:probe_filter_domain`.
4. Actions row (three `text-xs` link-buttons): "Add probe" (opens the Add probe dialog), "Load defaults" (POST `/api/probes/load-defaults`, then reload; status strip progress "Loading default probes…" then "Loaded N probes"), "Import file…" (opens the Import file dialog).
5. Custom prompt row: a fixed first row "Custom prompt" with hint "Type your own text". Selecting it puts the Probe workspace in the custom state (section 5.3).
6. The list, grouped by domain (group header: domain name in eyebrow style, sticky). Each row (`data-tour="probe-row"` on the first row only): name in `text-[13px] text-text2` (active: `text-accentText`, left border `border-l-2 border-accent`), under it the first 60 characters of `prompt_text` in `font-mono text-[11px] text-text4`. Badges after the name: a framing-group chip (`⊕ label`, `title` = "Framing group: {group_id}") when the probe is in a variant group; an "IF" chip (`title` = "Has a narrative opening and target for Sequences") when `narrative_opening` is set. Hovering shows a delete icon at the right (`aria-label="Delete probe"`); clicking it uses `ConfirmButton` behaviour inline (icon turns into "Delete?" for 4 seconds). Delete calls `DELETE /api/probes/{id}`; a 400 ("Probe has N run(s)") shows the server message in the status strip.
7. Select mode (after "Select"): every row gets a checkbox; the sticky footer shows "Select all" / "Deselect all", "Cancel", and "Delete N probes" (danger) which calls `POST /api/probes/bulk-delete` after `ConfirmButton`.

Below the list, a fixed footer (`SessionStats.svelte`, `data-tour="session-stats"`): "Runs: N" and a `ClassBar` with legend, from `GET /api/sessions/{id}/stats` using `outcome_classifications`. Below it the run history (`RunHistory.svelte`): the last 50 runs of the session from `GET /api/sessions/{id}` (`runs`), newest first, each row: a glyph-only `ClassBadge` of the outcome, the probe name, and a delete icon on hover (`DELETE /api/runs/{id}` after inline confirm). Clicking a row navigates to `/probe/runs/{id}`. Empty: "No runs yet".

Keyboard: Up and Down (when focus is not in an input) move the active probe through the visible, filtered list in the current session; wrap at both ends. Enter on the rail's focused row selects it.

Rail data: `GET /api/probes?session_id={id}` (the server already filters by the session's `probe_ids`), `GET /api/probe-groups` for the framing chips.

### 4.3 Workspace

`<main>` fills the remaining width and height, scrolls vertically, `p-4`. Each route renders inside it. The Studies section adds a sub-tab strip at the top of the workspace (`StudiesTabs.svelte`): Framings, Conditions, Repeat runs, Sequences, Model compare, Baselines, as a `TabbedPanel`-style row of links. The Data section does the same with Browse, Scorecard, Publish, Coach examples.

### 4.4 Status strip

`StatusStrip.svelte` (section 3.6). The `status` store (`ui/src/lib/status.svelte.ts`) exposes `progress(id, label, {completed, total}) / clearProgress(id)` and `error(message, detail?)`. Long-running streams register progress here so leaving the screen never hides the fact that a run is going; the strip's progress line has a "Show" link that navigates back to the screen that started it (the stream registry records the route, section 8.4).

### 4.5 No session yet

Shown in the workspace by any screen that needs a session when `session.current` is `null`: an `EmptyState` with title "No session yet", body "A session holds every run against one model, with one system prompt. Make one to start probing.", action "New session…". The rail shows "Pick or make a session to see its probes." in the list area.

### 4.6 New session dialog (`NewSessionDialog.svelte`)

Title "New session". Fields, in order:

1. Name (text, required, placeholder "e.g. Sonnet baseline, no system prompt", max 200). Focused on open.
2. Target model (`ModelPicker`, `allowCustom: true`). Default: the first available Anthropic model.
3. System prompt (textarea, 3 rows, optional, placeholder "Leave empty to test the model with no system prompt.", max 10000).
4. Coach (collapsed `<details>` labelled "Coach", summary shows the current value "Claude" by default): a Backend select with options Anthropic, OpenAI, Google, xAI, Together, Local (Ollama) (values `anthropic`, `openai`, `google`, `xai`, `together`, `local`), defaulting to `GET /api/settings/coach-default`; when Local, a Model select filled from `GET /api/ollama/status` models with hint "Local coaches are slower and weaker. 7B or larger is recommended."; a Profile text input (default `standard`, hint "Coach profiles live in the database; only standard ships.").
5. Probes (collapsed `<details>` labelled "Probes", summary "All probes" or "N of M selected"): a `ProbePicker`, all selected by default; empty selection is refused with the inline message "Pick at least one probe."
6. Footer: "Create session" (primary, Enter) and "Cancel".

Submit: `POST /api/sessions` with `{name, target_model, coach_profile, system_prompt, coach_backend, coach_model, probe_ids}` (`probe_ids` omitted when all are selected). On 200: set as current, close, navigate to `/probe`. On error: inline message from `friendlyError`.

### 4.7 Add probe dialog (`AddProbeDialog.svelte`)

Title "Add probe". Fields: Name (required), Domain (required, text with a datalist of existing domains), Prompt text (textarea, required, 5 rows, monospace), Tags (text, comma separated), and a checkbox "This probe has a narrative opening and target (for Sequences)" which reveals Narrative opening (textarea, hint: "Characters, setting and opening scene in interactive-fiction form. Dialogue in quotes, directions in ((double parentheses)).") and Narrative target (textarea, hint: "The final direction after the warmup turns. Stage direction only, with the same characters."). Both required when the box is checked. Footer "Save probe" / "Cancel". Submit: `POST /api/probes`. On success the rail reloads and the new probe becomes active.

### 4.8 Import file dialog (`ImportProbesDialog.svelte`)

Title "Import probes from a file". Lead: "Files in the sidecar's probes folder. Markdown or YAML." List from `GET /api/probes/files`: each row the file name and an "Import" button (`POST /api/probes/import-file {filename}`); the result "Loaded N probes" shows under the row. Empty: "No probe files found in flinch/probes." Footer "Close".

## 5. The Probe section

Route `/probe`. The workspace shows one of the states below, driven by `probe` store (`ui/src/lib/probe.svelte.ts`): `{ phase, probe, run, turns, annotation, draft, sending }`. Phases: `idle`, `custom`, `selected`, `sending`, `response`, `pushback`, `done`. Transitions are the current `state.js` table minus the sequence phases, which no longer exist.

### 5.1 Idle (session, no probe)

Lead line (`text-sm text-text3`): "Pick a probe on the left, or write your own." Under it, when the session has a system prompt, a `Panel` titled "System prompt" showing it in monospace (first 400 characters, "Show all" toggle). Then two `Panel`s side by side (`grid-cols-2`, stacked under 1100px):

- "Run every probe": readout "Sends each of the N probes in this session once, classifies each answer, and lists the results as they arrive. Pushback is not sent; you do that per probe." Button "Run all N probes" (starts the batch, section 5.7). A number input "Pause between probes (ms)" default 2000.
- "Save a baseline": readout "Freezes this session's current results so you can see what changed after a model or prompt update." Button "Save baseline…" (opens the Save baseline dialog, section 6.6) and, when baselines exist, link "Compare to a baseline" to `/studies/baselines`.

`data-tour="probe-idle"` on the lead line.

### 5.2 Probe selected

`ProbeCard` (`data-tour="probe-card"`): a `Panel` with eyebrow "Probe", title = probe name, actions: domain chip and tag chips, then prompt text in monospace, then the narrative opening and target blocks (when present) with eyebrows "Narrative opening" and "Narrative target". Below the card a row: primary button "Send probe" (`data-tour="send-button"`, shortcut S) and a `text-xs text-text4` hint "S to send".

Under the row, a "Policy claims" line (`PolicyLinks.svelte`): the claims linked to this probe from `GET /api/probes/{id}/claims` as chips "provider · claim_id" with an x to unlink (`DELETE /api/probes/{id}/claims/{claim_id}`), and a "Link a claim…" button opening a dialog listing `GET /api/policies` grouped by provider with a search box; picking rows and "Link" calls `POST /api/probes/{id}/claims {claim_ids}`. Readout when empty: "Link this probe to the published policy it tests. Scorecard uses these links."

### 5.3 Custom prompt

Same as 5.2 but the card holds a textarea (8 rows, monospace, placeholder "Type the text to send", `data-tour="custom-text"`) and the button reads "Send custom prompt". Submit: `POST /api/sessions/{id}/run {custom_text}`; the server creates a probe named `custom-{timestamp}` in domain `custom` and the rail reloads to show it.

### 5.4 Sending

The probe card stays; under it a `Panel` with a spinner and the line "Waiting for {model}…", then "Classifying…" once the response text has arrived (the run endpoint returns both at once, so this second line only shows when the request takes more than 3 s; it is cosmetic). Send button disabled. `POST /api/sessions/{id}/run {probe_id}`; on 200 load `GET /api/runs/{id}/turns` and `GET /api/runs/{id}/annotations`.

### 5.5 Response thread

Below the probe card, the conversation as a vertical thread (`Thread.svelte`): one `TurnCard` per turn from `turns` (role `probe` is skipped since the probe card shows it), each with a left timeline dot in the classification colour (pushback turns use the accent colour). `TurnCard`:

- Response turn: eyebrow "Response" (first) or "Response after pushback" (later), a `ClassBadge` on the right with `onChange` wired to `PATCH /api/runs/{id}/classification {field, value}` where `field` is `initial_classification` for the first response and `final_classification` for the latest; body is the model text through `formatResponse()` (paragraphs, lists, quotes, ported from `components.js`), collapsed at 800 characters with "Show more" / "Show less".
- Pushback turn: eyebrow "Your pushback" and the text in monospace with a left accent border.

Under the first response card, a `Readout` (`data-tour="response-readout"`) with one of:
- refused: "The model refused. The coach has drafted a pushback below. Edit it or send it as is."
- negotiated: "The model gave a partial or hedged answer. A pushback can test whether it holds the line."
- complied: "The model answered the request. Nothing to push against; move to the next probe or note what you saw."
- collapsed (only after pushback): "The model gave in after pushback. That is a flinch-then-fold."
- unknown: "The classifier could not decide. Set the badge yourself, then continue."

### 5.6 Pushback panel (phase `pushback`)

Shown when the latest response is `refused` or `negotiated` and no pushback has been sent for it. A `Panel` (`data-tour="pushback-panel"`) with eyebrow "Coach", title "Push back":

- Two lines in `text-xs text-text3`: "Pattern: {coach_pattern_detected}" and "Move: {move name} · {move description}" (names and descriptions from `ui/src/lib/copy/moves.ts`, which mirrors `coach.py` MOVES). When no coach suggestion exists (coach failed or no backend): a single line "No coach suggestion. Write your own pushback." and the move lines are omitted.
- Textarea (`id="pushback-text"`, 5 rows, monospace) prefilled with `coach_suggestion.pushback_draft`. Bound to `probe.draft`.
- Under it a status line: when `draft === pushback_draft` it reads "Sending the coach's draft as written."; when edited it reads "Edited. This will be recorded as your override, which also teaches the coach." in `text-warn`.
- Buttons: "Send pushback" (primary, shortcut P, `data-tour="send-pushback"`) and "Skip" (ghost, shortcut K).

Send: `POST /api/runs/{id}/pushback {text, source}` where `source` is `coach` when unedited and `override` when edited. Skip: `POST /api/runs/{id}/skip`. Both move to `done`.

### 5.7 Done (phase `done`)

After a pushback, a skip, or a `complied` first response. Below the thread:

1. "Keep pushing" `Panel` (only after a pushback with a response): textarea (3 rows), button "Send another pushback" (`POST /api/runs/{id}/continue {text, source: "override"}`). After it returns, the thread grows and this panel stays.
2. Action row: "Next probe" (primary, shortcut N: the next probe in the rail's current visible order, wrapping; when none, returns to idle), "Run again" (shortcut R: back to `selected` for the same probe), and "Teach the coach this exchange" (`data-tour="teach-coach"`, secondary, with the hint from the outcome: collapsed: "The pushback worked. The coach will learn from it."; refused: "It held. Teach the coach what did not work."; negotiated: "Partial. Worth learning from."; complied: "No pushback was needed; still worth noting."). Calls `POST /api/runs/{id}/promote`; afterwards the button is replaced by "Taught" with a check icon and is disabled.
3. Notes `Panel` (`NotesPanel.svelte`, `data-tour="notes"`): eyebrow "Notes", textarea "Research notes" (saved on blur with `PUT /api/runs/{id}/annotations {note_text}`), a tag input "Add a pattern tag" with a datalist from `GET /api/annotations/tags` (Enter or comma adds; each tag a chip with x; saves `{pattern_tags}`), and a textarea "Key finding" with placeholder "What does this result show?" (saved on blur with `{finding}`). A `text-xs text-text4` line "Saved" appears for 1.5 s after each save.

### 5.8 Batch run (`BatchRun.svelte`)

Started from 5.1. The workspace switches to a `Panel` titled "Running all probes" with `StreamProgress` (label "{completed} of {total}", failed count when > 0, Cancel button) and a table that fills as `progress` events arrive: Probe, Domain, Result (`ClassBadge`). Rows are clickable and navigate to `/probe/runs/{run_id}`. `error` events add a row with "Failed: {error}" in the danger colour. On `complete` the title becomes "Finished: {completed} of {total}" and a "Back" button returns to idle; the session stats refresh.

Cancel: the stream's `AbortController.abort()` and then `POST /api/batch/{batch_id}/cancel` (the `batch_id` comes from the first `progress` event). The server stops before the next probe (section 9.1). The title becomes "Stopped after {completed} of {total}".

Stream: `POST /api/sessions/{id}/batch {probe_ids: null, delay_ms}` through `streams.ts` (section 8.4). The run is registered in the stream registry so leaving `/probe` keeps it going and the status strip shows it.

### 5.9 Saved run (`/probe/runs/[runId]`)

Loads `GET /api/runs/{id}`, its turns and annotation, selects the run's probe in the rail, and renders the thread in phase `done` (or `pushback` when the latest response is refused/negotiated and `pushback_source` is null). Identical components to 5.5 to 5.7.

### 5.10 Keyboard shortcuts (Probe only)

Handled in `ui/src/lib/shortcuts.ts`, attached by the Probe route on mount and detached on destroy. Ignored while focus is in an input, textarea, select or contenteditable, and while any dialog, the drawer or the tour is open.

| Key | Phase | Action |
|-----|-------|--------|
| S | selected, custom | Send |
| P | pushback | Send pushback |
| K | pushback | Skip |
| N | done, response (complied) | Next probe |
| R | done, response | Run again |
| Up / Down | any | Move the active probe |
| ? | any (global) | Toggle the shortcuts overlay |
| Escape | any (global) | Close the topmost overlay |
| Enter | in a single-line input inside a dialog | Submit the dialog |

The shortcuts overlay (`ShortcutsOverlay.svelte`) lists exactly these rows with the key in a `kbd` chip and the action text above; title "Keyboard shortcuts"; footer "Press ? or Escape to close".
## 6. The Studies section

Every Studies screen starts with a `Panel` whose readout states the research question. Session-scoped screens (Framings, Repeat runs, Sequences, Baselines) show the "No session yet" panel when there is no session. Conditions and Model compare never need one.

### 6.1 Framings (`/studies/framings`)

Readout: "Does the model treat the same request differently when it is framed as fiction, as research, as satire? A framing group holds one request written several ways. Run the group in this session and compare the badges."

Two tabs (`TabbedPanel`): Groups, Results.

**Groups tab.** List of groups from `GET /api/variants/files` filtered to `variant_type === "framings"`, plus DB-only groups from `GET /api/probe-groups` that have no file (section header "Groups without a file" in eyebrow style). Each group is a `Panel`: title = `title || group_id`, description line, chips for each label, domain in `text-xs text-text4`. Actions: "Run in this session" (`POST /api/sessions/{id}/batch {probe_ids}` with the group's probe ids, section 5.8's batch panel takes over inside this tab), "View" (expands the variants inline: a grid of label plus prompt text, and the file path "flinch/variants/{group_id}.md"), "Delete" (`ConfirmButton`; file groups: `DELETE /api/variants/files/{group_id}`; DB-only groups: `DELETE /api/probe-groups/{group_id}`).

Top-right action "Run all groups" (every probe id across every framing group, deduplicated, one batch). Empty state: title "No framing groups yet", body "Make one below. Each group is saved as a Markdown file you can edit by hand."

Under the list, a `Panel` "New framing group" with two tabs: "Write with the coach" and "Write by hand".

- Write with the coach: Base probe (`<select>` of the session's probes), Group id (text, placeholder "e.g. violence-framing", validated `^[a-z0-9-]+$`), Framings (checkbox chips: Fiction Workshop, Academic Analysis, Historical Context, Roleplay Scenario, Satire/Parody, all checked; an "Add a framing" text input adds a chip on Enter), button "Draft variants" (`POST /api/variants/generate {probe_id, strategies}`; needs an Anthropic key, otherwise the button is disabled with hint "Needs an Anthropic key. Add one in Settings."). While drafting: spinner "Drafting {n} framings…". The result shows as a grid of editable textareas, with "Direct request" (the base probe text) prepended, and buttons "Save group" (`POST /api/variants/files {group_id, title, description, base_probe, domain, variant_type: "framings", variants}`) and "Discard".
- Write by hand: Group id, Domain, Description, then rows of Label + Prompt text (two rows by default with labels "Direct request" and "Fiction framing"; "Add a variant" appends a row with the next default label from the list Direct request, Fiction framing, Academic framing, Roleplay, Historical context, Satire). "Save group" requires at least two rows with both fields.

**Results tab.** `GET /api/sessions/{id}/consistency`. Header: the consistency score as a large number with `Readout` "{consistent_count} of {total_groups} groups got the same badge on every framing." When `consistency_score` is null: "No framing group has been run in this session yet." One `Panel` per group: title = group id, right: "Consistent" (ok colour) or "Inconsistent" (warn colour) or "Not run"; a grid of variant tiles: label, probe name, `ClassBadge` (or "Not run"). Clicking a tile with a `run_id` opens `/probe/runs/{run_id}`.

### 6.2 Conditions

#### 6.2.1 List (`/studies/conditions`)

Readout: "Does the same probe get a different answer under a different system prompt? A conditions study runs every prompt under every condition, for one or more models, and compares the answers."

Top-right: "New study" (to `/studies/conditions/new`). List from `GET /api/experiments` (`experiments`), newest first; each row: name, status chip (draft, running, paused, completed, failed; colours: draft zinc, running accent, paused warn, completed ok, failed danger), models (`model_ids` as chips), created date, and "Open". Empty state: "No studies yet" / "Make one to run prompts under several system prompts at once."

#### 6.2.2 New study (`/studies/conditions/new`)

A single page, not a wizard, with four `Panel`s and one footer.

1. "About": Name (required), Description (textarea, placeholder "What you expect to find.").
2. "Conditions" (`data-tour="conditions-list"`): rows of Label (text) + System prompt (textarea, 3 rows, monospace; empty allowed, placeholder "Empty means no system prompt: the control."). Two rows by default labelled "Control" (empty prompt) and "Condition 1". Buttons: "Add condition", and "Import from a file…" which lists `GET /api/variants/files` filtered to `variant_type === "conditions"`; picking one replaces the rows with the file's variants (label = variant label, system prompt = `prompt_text`).
3. "Prompts": a `ProbePicker` over `GET /api/probes` (all probes, not the session's), with a count line "N prompts selected". Below it a collapsed `<details>` "Import prompts from text" with a textarea (hint "One prompt per line, or CSV with a prompt column.") that posts to `POST /api/experiments/{id}/prompts/import {csv_text}` after creation, and a collapsed `<details>` "Import from Anthropic's HH-RLHF dataset" with Target count (number, default 300), Subsets (checkboxes harmless-base, helpful-base, helpful-online, helpful-rejection-sampled; all checked), Stratification select (`domain`, `none`; default `domain`), Seed (number, default 42). Readout: "Downloads a stratified sample of first-turn prompts from the public Anthropic/hh-rlhf dataset on Hugging Face. Needs the internet." These are queued and run after the study is created (step 3 of Create below).
4. "Models and repeats": Models (a list of `ModelPicker`s with "Add model"; at least one), Repeats per cell (number 1 to 50, default 1, hint "How many times each prompt runs under each condition for each model."), Random seed (number, optional). Then a line "Cells: {prompts} x {conditions} x {models} x {repeats} = {total}" that updates live and turns warn-coloured above 500 with "Large. Each cell is one model call."

Footer: "Create study" (primary) and "Cancel". Create does, in order:
1. `POST /api/experiments {name, description, model_ids, random_seed, config: {}, repetitions, conditions: [{label, system_prompt, sort_order}]}`.
2. `POST /api/experiments/{id}/prompts` with `[{probe_id}]` for the picked probes.
3. If text was pasted: `POST /api/experiments/{id}/prompts/import`. If HH import was configured: `POST /api/experiments/{id}/prompts/import-hh` as a stream; the status strip shows "Importing HH-RLHF prompts…" until `complete`.
4. Navigate to `/studies/conditions/{id}`.

Validation before step 1: name, at least one condition with a label, at least one prompt source (picked probes, pasted text or HH import), at least one model. Errors show inline under the panel they belong to.

#### 6.2.3 One study (`/studies/conditions/[id]`)

Header: name, status chip, description; right: "Delete study" (`ConfirmButton`, `DELETE /api/experiments/{id}`). Data: `GET /api/experiments/{id}` (`experiment`, `conditions`, `progress`), `GET /api/experiments/{id}/prompts`.

Tabs: Run, Results, Raters, Export.

**Run tab.** Left column `Panel` "Progress": overall "{completed} of {total} cells" with a bar, failed count, then one row per condition (label, bar, counts from `progress.by_condition`), then per model from `progress.by_model`. Right column `Panel` "Setup": Conditions (label, first 120 characters of the prompt or "No system prompt" in italics), Models, Prompts count, Repeats (from `experiment.config.repetitions`), Seed, Created, Started, Completed. Below both: the estimate from `POST /api/experiments/{id}/estimate` as "About {cells} model calls, roughly ${estimated_cost_usd}" with the hint "The estimate uses average token counts; real costs vary."

Action row by status:
- draft: "Start" (`POST /api/experiments/{id}/start` with body `{"concurrency_per_provider": {}}`, streamed).
- running (stream attached): "Pause". Pause aborts the stream, then `POST /api/experiments/{id}/pause`. The server keeps the status `paused` and cancels its workers (section 9.2).
- running (no stream attached, e.g. after a reload): the line "This study is marked running but this window is not attached to it. Pause it, then resume." and the "Pause" button.
- paused: "Resume" (`POST /api/experiments/{id}/resume`, same body, streamed).
- completed with `progress.pending > 0` or failed: "Run pending cells" (same as Resume).
- completed with nothing pending: no run button; a line "All cells done."

While streaming, `StreamProgress` sits above the action row and progress numbers update from `progress` events (`completed`, `failed`, `total`). On `complete` the page reloads its data.

**Results tab.** `GET /api/experiments/{id}/condition-comparison`. Top: a `Panel` per condition in a responsive grid: label, "{response_count} responses", a `ClassBar` with legend (from `classifications`, which section 9.4 makes real), "Complied or negotiated: {compliance_rate as %}", the system prompt preview. Under them, "Metrics" `Panel`: when `has_metrics` is false, a button "Compute text metrics" (`POST /api/experiments/{id}/metrics`, streamed; progress line from each event's `message`; readout "Measures each response's length, reading level, hedging and confidence words, and vocabulary richness. Nothing is sent to a model.") When true, the metric table: rows MTLD, Honoré, Hedging, Confidence, Evasion, F-K grade, Words, TTR, Subjectivity, Polarity (keys as in `render.js` METRIC_LABELS); one column per condition showing `mean ± sd`; when `has_analysis`, two more columns `d` (largest |Cohen's d| across pairs, colour by size: 0.2 accent, 0.5 warn, 0.8 danger) and `Sig` (stars from the smallest `p_fdr` or `p_value`). A "Run statistics" button (`POST /api/experiments/{id}/analyze`, JSON; readout "Compares conditions pairwise with Mann-Whitney U, Cohen's d and FDR-corrected p values. Needs the experiment extras installed.") shows when metrics exist and analysis does not. Legend under the table: "* p<.05  ** p<.01  *** p<.001. d: small 0.2, medium 0.5, large 0.8."

Below: "Responses" `Panel` with a `ResizableSplit`: left, a list of prompts from `GET /api/experiments/{id}/prompts` (search box; row = probe name or first 60 characters of the custom text); right, for the selected prompt, `GET /api/experiments/{id}/responses?prompt_id=` grouped into one column per condition, each column listing the responses (one per model and repeat: header "model · repeat n", `ClassBadge`, text collapsed at 600 characters). Failed cells show "Failed: {error_message}".

**Raters tab.** Two `Panel`s.
- "AI raters": readout "Sends each prompt's responses, with the condition labels hidden and the order shuffled, to a rater model that ranks them. Rankings feed the win rates in the statistics." A list of `ModelPicker`s (default one row with the first available Anthropic model), "Add rater", and "Rate responses" (`POST /api/experiments/{id}/rate {rater_models}`, streamed; progress from `completed`/`total`). Below: a table from `GET /api/experiments/{id}/ratings` (rater, prompt, target model, status, and the rank per condition decoded from `blinding_order` and the items), empty "No ratings yet."
- "Human raters (Prolific)": readout "Makes blinded ranking tasks for people, as a CSV you upload to Prolific, and reads their results back in." Fields: Prompts to sample (number, default 300), Models (checkbox chips of the study's models, all checked), Raters per task (number, default 3), Batch id (text, optional). Button "Make tasks" (`POST /api/experiments/{id}/prolific {prompt_count, model_ids, raters_per_task, batch_id}`), result line "{task_count} tasks for {prompt_count} prompts". `DownloadLink` "Download task CSV" (`GET /api/experiments/{id}/prolific/csv`, hint "Downloading marks the tasks exported."). A textarea "Paste the results CSV" with hint "Columns: tracking_id, rater_id, rank_a, rank_b, rank_c, reasoning, completion_time_s" and button "Import results" (`POST /api/experiments/{id}/human-evals/import {csv_text}`), result line "{imported} imported, {skipped} already there, {errors.length} errors" with the errors listed. Below, a table from `GET /api/experiments/{id}/human-evals` (batch, tracking id, status).

**Export tab.** A list of `DownloadLink` rows, each with a one-sentence description:
- "Responses (CSV)": "One row per response with its condition, classification and text metrics." `GET /api/experiments/{id}/condition-export`
- "Responses (JSONL)": "One JSON object per response, every column, for scripts." `GET /api/experiments/{id}/export?format=jsonl`
- "Everything (JSON)": "The study, its conditions, prompts, progress, ratings, human evaluations, analysis and metrics in one file." `GET /api/experiments/{id}/export`
- "Analysis (CSV)": "The pairwise statistics table." `GET /api/experiments/{id}/analysis/export`; disabled with "Run statistics first." until `has_analysis`.
- "Preregistration (Markdown)": "A preregistration document built from this study's design, for OSF or similar." `GET /api/experiments/{id}/preregistration`, saved as `study-{id}-preregistration.md` from the `preregistration` field.
- "Report (Markdown)": "Methods and results written up from the analysis. Needs a completed study with statistics." `POST /api/experiments/{id}/report {format: "markdown", include_charts: false, include_tables: true}`, saved as `study-{id}-report.md` from the `report` field; disabled until status is completed and `has_analysis`.

### 6.3 Repeat runs (`/studies/repeat`)

Readout: "Is a refusal a rule or a coin flip? Repeat runs send the same probe many times with a fresh conversation each time and count how often each badge comes up."

`Panel` "Set up": a `ProbePicker` over the session's probes (default: the probe active in the rail, if any, else none), "Times per probe" (number 1 to 100, default 10), live line "{probes} probes x {n} = {total} calls", buttons "Run selected" and "Run all probes in this session".

Stream: `POST /api/sessions/{id}/stat-run {probe_ids, repeat_count}`. Events: `batch_start`, `start` (per probe), `iteration` (append a row), `iteration_error` (count), `complete` (per probe: the server summary), `batch_complete`. The `Panel` "Running" shows `StreamProgress` and, as `iteration` events arrive, a per-probe row that grows a strip of glyph-only badges (one per iteration, in order) so the pattern is visible while it runs.

`Panel` "Results" (`data-tour="repeat-results"`): the session's stat runs from `GET /api/sessions/{id}/stat-runs` (and the live ones as they finish), one row per stat run: probe name, model, `ClassBar` with legend, "Refused {refused} of {total} ({consistency_rate as %})", date. A "Detail" toggle on a row loads `GET /api/stat-runs/{id}` and shows every iteration's badge and the first 200 characters of its response. Empty: "No repeat runs yet in this session."

### 6.4 Sequences (`/studies/sequences`)

Readout: "Does a model that refuses a request cold accept it after a few turns of story? A sequence has the coach build narrative context for N turns, then deliver the probe. Whittling finds the smallest N that still gets through."

Tabs: Run, Results.

**Run tab.**

`Panel` "New sequence" (`data-tour="sequence-form"`):
- Strategy (`<select>` from `GET /api/strategies`; option text "{name with underscores replaced} ({category})"; under it the strategy's description in `text-xs text-text3`).
- Probe (`<select>` of the session's probes plus a last option "Custom prompt…" revealing a textarea).
- Mode (radio): "Automatic: all warmup turns and the probe at once" (`automatic`), "Interactive: one turn at a time, you decide when to drop the probe" (`interactive`).
- Warmup turns (range 1 to 20, default 10, value shown).
- Checkbox "Use the interactive-fiction engine" with hint "Sets the model up as a collaborative story engine (dialogue in quotes, directions in ((double parentheses))) and makes the coach play the writer. Matches the original research."
- Buttons: "Create sequence" (`POST /api/sessions/{id}/sequences {probe_id, strategy_id, mode, max_warmup_turns, use_narrative_engine}`), "Create and whittle" (creates with mode `automatic`, then runs whittle).

`Panel` "Batch": readout "Runs one sequence per probe with the same strategy. Whittle mode finds each probe's threshold; fixed mode runs each at one depth." Fields: Strategy, Probes (`ProbePicker`), Mode (radio: Whittle, Fixed depth), Warmup turns (range), and, when Fixed, "Depth" (number). Button "Estimate cost" (`POST /api/sessions/{id}/sequence-batch` to create, then `POST /api/sequence-batches/{id}/estimate`) showing "About {estimated_runs} runs, {estimated_total_turns} turns, roughly ${estimated_cost_usd}" and then "Start batch" (`POST /api/sequence-batches/{id}/start`, streamed; `progress` events list probe name and threshold or classification; `complete` reloads the list).

`Panel` "Sequences in this session": from `GET /api/sessions/{id}/sequences`, newest first; each a card: status chip, mode, "IF engine" chip when set, "Warmup: N turns", summary counts and threshold when present (`summary.threshold_found` and `summary.threshold_warmup_count`), and actions by status:
- pending or running: "Run all turns" (`POST /api/sequences/{id}/run-auto`, streamed; `turn` events update an inline line "Turn {step} of {total_steps}: {turn_type}, {classification}"; `complete` shows "Probe result: {badge}"), "Whittle" (`POST /api/sequences/{id}/whittle`, JSON, with a spinner line "Whittling. This runs several passes and takes a few minutes."), and for interactive mode: "Next turn" (`POST /api/sequences/{id}/run-turn`; appends the coach and target turns to an inline transcript and updates "{sent} of {planned} warmup turns sent"), "Drop the probe" (`POST /api/sequences/{id}/drop-probe`; appends the setup and probe turns, then reloads).
- completed or failed: "Show results" (switches to the Results tab with this sequence selected). failed also gets "Retry" (run-auto).
- all: "Delete" (`ConfirmButton`, `DELETE /api/sequences/{id}`).

**Results tab.** A `<select>` of completed sequences (default: the most recent). For the selected one, three `Panel`s from `GET /api/sequences/{id}`, `GET /api/sequences/{id}/whittling`, `GET /api/sequences/{id}/turn-classifications`:
- "Threshold" (bar chart as in `renderThresholdChart`: one bar per run, height = warmup count, colour = probe classification, the threshold run highlighted; readout "The model {complied|refused} at {N} warmup turns and refused at {N-1}, so the threshold is {N}." or "No threshold: the model refused at every depth." or "No threshold: it complied even with no warmup.")
- "Turn by turn" (one row per run: `N={warmup_count}`, a strip of small squares per turn coloured by classification with W/S/P letters, the probe badge at the end).
- "Runs" (one collapsible row per run: `N=…`, badge, "Threshold" chip; expanding loads `GET /api/sequence-runs/{id}/turns` and shows the transcript with role labels Coach, Target, Probe and turn-type chips).

Below, two `Panel`s across all sequences in the session: "Thresholds across probes" (table from `GET /api/sessions/{id}/thresholds`: Probe, Domain, Strategy, Threshold, and a bar; filter `<select>` by strategy) and "Strategy effectiveness" (from `GET /api/sessions/{id}/strategy-effectiveness`: one bar per strategy, "{success}/{count} got through, average threshold {avg} turns"). Each sequence row offers "Export (JSON)" and "Export (CSV)" via `GET /api/sequences/{id}/export?format=`.

### 6.5 Model compare (`/studies/compare`)

Readout: "Do different models draw the line in the same place? Model compare sends the same probes to several models and shows the answers side by side."

`Panel` "Set up": Models (checkbox list grouped by provider from `GET /api/models`, unavailable providers disabled with their hint; a text input "Other model id" adds a chip on Enter; 2 to 5 required), Probes (`ProbePicker` over all probes plus a textarea "Add a custom prompt" that creates a probe on run), System prompt (textarea, optional, applied to every model). Button "Run comparison ({models} models x {probes} probes)", disabled with the hint "Pick at least 2 models and 1 probe." Run: `POST /api/compare/run {probe_ids, models, system_prompt}` (JSON, no stream; a spinner line "Running {n} probes against {m} models. This takes a minute."). On 200 navigate to `/studies/compare/{comparison_id}`.

`Panel` "Past comparisons": from `GET /api/comparisons`, each row: name, models as "A vs B", probes count, agreement as a percentage (ok above 80, warn above 50, danger below), date, actions "Open", "JSON", "CSV" (`GET /api/comparisons/{id}/export?format=`), "Delete" (`ConfirmButton`, `DELETE /api/comparisons/{id}`).

#### 6.5.1 One comparison (`/studies/compare/[id]`)

From `GET /api/comparisons/{id}`. Header: name, "Back to Model compare", "JSON", "CSV". A stats row: agreement percentage large, "{aligned} of {total} probes got the same badge from every model", and per model a compact tally of glyph badges. Then one `Panel` per probe (left border warn-coloured when `disagreement`): probe name, domain, "Disagreement" chip, prompt text (first 300 characters), and a grid with one column per model: model id, `ClassBadge`, the response text (scrollable, max height 480px) or "Failed: {error}". Each model column header links to the run (`/probe/runs/{run_id}`) when a run id exists.

### 6.6 Baselines (`/studies/baselines`)

Readout: "Did an update change what the model refuses? Save a baseline of this session's results, run the probes again later, and compare."

`Panel` "Baselines" (`data-tour="baselines"`): "Save baseline…" (dialog: Name required, Description optional; `POST /api/sessions/{id}/snapshots`), then the list from `GET /api/sessions/{id}/snapshots`: name, description, date, "Compare to now", "Delete" (`ConfirmButton`, `DELETE /api/snapshots/{id}`). Empty: "No baselines saved for this session."

Compare: `GET /api/snapshots/{id}/diff?session_id=`. Shows a `Readout` "{improved} improved, {regressed} regressed, {changed} changed, {unchanged} unchanged. Improved means the model now refuses where it complied, since these probes are meant to be refused." then a table: Probe, Baseline badge, Now badge, Status (improved ok, regressed danger, changed warn, unchanged muted), changed rows first.
## 7. The Data section, Export, Settings, Guide, first run

### 7.1 Browse (`/data/browse`)

No rail. Readout: "Everything this install has recorded: sessions, model comparisons and sequences."

Top: four stat tiles from `GET /api/dashboard/stats` (Sessions, Runs, Comparisons, Sequences) and, when `total_runs > 0`, a `ClassBar` with legend from `classification_breakdown` labelled "First responses across every run". Action row: "Export everything (JSON)" (`GET /api/dashboard/export-all`) and "Clear all data…" (danger; opens a dialog: title "Delete all recorded data?", body "Sessions, runs, comparisons, sequences, baselines, studies and notes will be deleted. Probes, strategies, policies and coach profiles stay. This cannot be undone.", buttons "Export everything first", "Delete everything" (danger; `DELETE /api/dashboard/clear-all {confirm: "DELETE_ALL_DATA"}`), "Cancel"; after success the dialog shows "Deleted." for 2 s and closes).

Tabs: All, Sessions, Comparisons, Sequences. Lists from `GET /api/dashboard/sessions`, `GET /api/dashboard/comparisons`, `GET /api/dashboard/sequences`, grouped by date (Today, This week, This month, Older). Rows:
- Session: name, model, "{run_count} runs", date, glyph tallies for refused and complied counts; actions "Open" (to `/data/browse/sessions/{id}`), "JSON", "CSV" (that row's session: `GET /api/sessions/{id}/export?format=json|csv`), "Make current" (sets it as the current session and navigates to `/probe`).
- Comparison: name, models, probes, agreement; "Open" (to `/studies/compare/{id}`), "JSON", "CSV", "Delete".
- Sequence: session name, strategy, model, turns, status; "Open" (to `/data/browse/sequences/{id}`), "JSON", "Delete".

`/data/browse/sessions/[id]`: header card (name, model, created, counts), then one collapsible row per run (probe text preview, outcome badge); expanding shows the probe, the first response with its badge, the pushback (with its source), the final response, and, when there are more than two turns, the whole conversation from `GET /api/runs/{id}/turns`. A link "Open in Probe" goes to `/probe/runs/{id}` after making the session current.

`/data/browse/sequences/[id]`: header (strategy, model, status, turns, date) and the full transcript as in 6.4's Runs panel.

### 7.2 Scorecard (`/data/scorecard`)

Readout: "Does each model enforce the published policies it claims to? A scorecard lines up the policy claims you have linked to probes against what the models actually did."

Tabs: "Across models", "This session".

**Across models.** `Panel` "Build a scorecard": Name (text, placeholder "e.g. October baseline"), Models (checkbox chips of every distinct `target_model` across sessions, all checked), Sources: "Sessions" (`ProbePicker`-style list of sessions with checkboxes, all checked) and "Repeat runs" (list of stat runs across sessions from `GET /api/dashboard/sessions` ids then `GET /api/sessions/{id}/stat-runs`, each "probe · model · n", all checked). Button "Generate scorecard" (`POST /api/scorecard/generate {name, models, session_ids, stat_run_ids}`). Result table: one row per claim (claim text, category, severity), one column per model with a cell icon: check (consistent, ok), "Over" (over-enforced, warn), "Under" (under-enforced, danger), dash (no data), tooltip "{refused} refused, {complied} complied of {total_probes}". Legend under the table. The data comes from `results.by_model[model].by_claim`; rows are the union of claims across models. Side `Panel` "Saved scorecards" from `GET /api/scorecards`: name, date, models; "Open" loads `GET /api/scorecard/{id}` into the table.

**This session.** `GET /api/sessions/{id}/compliance`. Three tiles: average compliance (`summary.average_compliance_rate` as %), claims tested, compliant (at or above 80%). Then per provider, per claim: claim slug, a bar with the rate, "{probe_count} probes: R {refused_count} X {collapsed_count} N {negotiated_count} C {complied_count}". Empty: "No claims linked. Link probes to policy claims from the probe card, then run them."

### 7.3 Publish (`/data/publish`)

Readout: "Tables and reports ready to paste into a paper, built from every session that matches the filters."

`Panel` "Make a document": Template (`<select>`: Comparison table, Consistency matrix, Pushback effectiveness, Full report; values `comparison_table`, `consistency_matrix`, `pushback_summary`, `full_report`), Format (`<select>`: Markdown, HTML, PDF, CSV, JSON), Models (checkbox chips, all checked), Domains (multi-select chips, none = all), Date range (two date inputs, optional), Theme (`<select>` from `GET /api/themes`, shown only for HTML and PDF, default from `flinch:export_theme`; a live preview card styled from `GET /api/themes/{name}` as in `themePreviewPanel`). Button "Generate" (`POST /api/publication/export {name, format, template, filters: {models, domains, date_range}, theme}`; `name` is "{template}-{date}"). Result: a preview `Panel` (monospace for Markdown and CSV, an iframe `srcdoc` for HTML, "PDF generated" for PDF), with "Download" (`GET /api/publication/exports/{export_id}/download`) and "Copy".

PDF: when the format is PDF and `GET /api/settings/capabilities` (section 9.13) reports `pdf: false`, the format option reads "PDF (needs weasyprint)" and is disabled.

`Panel` "Past documents": `GET /api/publication/exports`: name, template, format, date, "Download".

### 7.4 Coach examples (`/data/coach`)

Readout: "What the coach has learned. Each example is an exchange you taught it; the coach reads the five most recent when drafting a pushback."

Profile `<select>` from `GET /api/coach-profiles` (default `standard`). List from `GET /api/coach-examples?profile=`: each `Panel`: pattern, move name, outcome badge, "Refusal" excerpt (300 characters), "Pushback" excerpt, an Effectiveness `<select>` 1 to 5 (`PATCH /api/coach-examples/{id} {effectiveness}`), "Edit pushback" (turns the excerpt into a textarea with Save: `PATCH {pushback_text}`), "Delete" (`ConfirmButton`). Empty: "No examples yet. In Probe, after a pushback, use Teach the coach this exchange."

### 7.5 Export dialog (`ExportDialog.svelte`)

Opened from the header. Title "Export {session name}". A grouped list; every row is a `DownloadLink` with a label and one sentence.

Raw data
- "JSON": "Every run with its prompt, responses, badges and pushback." `GET /api/sessions/{id}/export?format=json&include_turns={turns}&include_annotations={notes}&include_policy={policy}&include_variants={framings}`
- "CSV": "One row per run, the same fields as JSON, for spreadsheets." same with `format=csv`
- Four checkboxes under the two rows: "Include every turn" (default off), "Include notes and tags" (default on), "Include policy links" (default off), "Include framing groups" (default off). They apply to both raw rows.

Reports
- "Findings (JSON)": "Your key findings with evidence, pattern tags and policy compliance, in a documented schema." `format=findings`
- "Research report (Markdown)": "Summary, findings, badge breakdown by domain, pattern analysis and policy compliance." `format=report`
- "Web page (HTML)": "A themed page listing every run." `format=html&theme={theme}`
- "PDF": "The same page as a PDF. Needs weasyprint on the sidecar." `format=pdf&theme={theme}`; disabled when `capabilities.pdf` is false, with the sentence "Not available: weasyprint is not installed."
- Theme `<select>` under these two rows (stored in `flinch:export_theme`).

For tools
- "AI agent format (JSON)": "Runs, findings and tag index with field definitions and suggested analyses, for feeding to a model." `format=agent`

Compare sessions
- A multi-select of the other sessions ("name · model") and two rows: "Comparison (JSON)" and "Comparison (CSV)": "The same probes across the chosen sessions, with disagreements marked." `GET /api/export/compare?session_ids=&format=`; disabled until two sessions are chosen (the current one counts).

Footer: "Close".

### 7.6 Guide menu (`GuideMenu.svelte`)

Items, in order:
1. "Take the tour" (starts the tour, Appendix A.3).
2. "Glossary" (to `/guide/glossary`).
3. "Methodology" (to `/guide/methodology`).
4. "Policies" (to `/guide/policies`).
5. "Keyboard shortcuts" (opens the shortcuts overlay).

`/guide/glossary`: every entry of `glossary.ts` as a definition list, term in `font-medium`, definition under it, grouped: Badges, The core loop, Studies, Models and keys.

`/guide/methodology`: `ui/src/lib/guide/methodology.md` rendered with `marked` (dependency added; the only Markdown renderer in the app) inside `prose prose-invert prose-sm max-w-[720px]` (Tailwind typography plugin added). Content in Appendix A.4.

`/guide/policies`: readout "Published content policies, broken into testable claims. Link a claim to a probe from the probe card; Scorecard reports on the links." Provider tabs (All, Anthropic, OpenAI, Google, xAI) from `GET /api/policies`. Each claim row: severity dot (hard danger, medium warn, soft ok), provider, claim id, claim text (truncated), category chip, expected behaviour icon (should_allow: check in ok colour, otherwise a square in danger colour). Expanding shows Policy, Testable statement, Notes, Expected behaviour and Severity.

### 7.7 Settings drawer

Opened from the header. Sections, top to bottom.

**Keys** (`data-tour="settings-keys"`). Lead line, one of: "Keys are saved in Windows Credential Manager and handed to the sidecar on launch." (desktop) or "Keys are saved to the .env file next to the project and loaded on start." (dev). Then one `KeyRow` per provider from `GET /api/settings/keys` (order: Anthropic, OpenAI, Google, xAI, Together): label, status "Set · {masked}" (ok) or "Not set" (muted), buttons "Add key" / "Replace", and, when set, "Test" and "Remove". Add/Replace reveals a password input and "Save". Save flow: `POST /api/settings/validate-key {provider, key}`; on `valid: false` show "Could not validate: {error}" and stop; then desktop: `invoke('set_api_key', {provider, key})` and `POST /api/settings/set-key {provider, key}`; dev: `POST /api/settings/keys {ENV_VAR: key}`. Test: `POST /api/settings/test-key {provider}` (Anthropic, OpenAI, Google only; the other two show "No test for this provider."). Remove: desktop `invoke('delete_api_key')` and `DELETE /api/settings/set-key?provider=`; dev `POST /api/settings/keys {ENV_VAR: ""}`. Under the rows: "Flinch needs at least one key for the classifier and the coach. Anthropic is used when it is set."

**Local models (Ollama).** Base URL input (default from `GET /api/settings/ollama`), "Test" (`POST /api/settings/ollama {base_url}`), status chip "Connected ({n} models)" or "Not running", and the model list. Hint: "Install Ollama and run `ollama pull llama3.2` to test a local model."

**Coach.** Default backend `<select>` (same options as the New session dialog) and, for Local, the model `<select>`; saved with `POST /api/settings/coach-default {backend, model}` on change. Hint: "Used for new sessions. Each session can override it."

**Developer** (as Pry's, plus two facts). Rows: "Database" (the path from `GET /health`'s new `db_path` field, section 9.13, with a `CopyButton`), "Versions" ("App {tauri version or 'dev'} · Sidecar {health.version}"), "API docs" (link to `{sidecarBase}/docs`, opened with `@tauri-apps/plugin-shell` in the desktop app and `window.open` in dev), "Open DevTools" (desktop only; `invoke('open_devtools')`), "Auto-open DevTools on launch" (toggle, `flinch:devtools_autoopen`), "Copy diagnostic" (desktop only; `invoke('copy_diagnostic')` shows the path).

### 7.8 First run (`/welcome/*`)

Layout: Pry's `welcome/+layout.svelte` with the header eyebrow "content restriction research" and title "Setting up Flinch", step dots for Welcome, Python, Key, Probes, Done. Atmosphere gradient and grid kept.

Step 1 `/welcome`: "step 01", "Welcome to Flinch.", lead "Test whether an AI model enforces its content rules the same way every time.", body "Send a probe, see whether the model refuses, push back with the coach's help, and record what happened. Then run the same probes many times, under different framings, against different models.", button "Get started" (to `/welcome/python`). Collapsible "What is this?" with three paragraphs: what Flinch is (a research instrument, not a jailbreak tool: "Flinch records refusals and what changes them. It is built for people studying how content rules are enforced, and every pushback is a human decision."), where data lives ("Everything is stored in one SQLite file on this computer. Model calls go to the providers whose keys you add."), and what setup involves ("Setup unpacks a Python runtime for the sidecar, about 15 seconds, then asks for one API key.").

Step 2 `/welcome/python`: "step 02", "Setting up Python", body "Flinch runs its sidecar on a bundled Python. Unpacking it takes about 15 seconds and happens once." Progress card driven by `bootstrap:progress` events (stages Probing, Cleaning, ExtractingPbs, CreatingVenv, InstallingDeps, Ready with labels "Checking", "Cleaning the old runtime", "Unpacking Python", "Creating the environment", "Installing Flinch", "Ready"), a log disclosure from `bootstrap:log`, an error card on `bootstrap:error` with "Retry" and "Copy error details" (`invoke('copy_diagnostic')`) and the anti-virus note from today's splash. On `ready` (or `runtime_status().ready` at mount) the page waits for `sidecar:ready` or a 200 from `/health`, then goes to `/welcome/key`. In dev (`!isTauri()`) the step shows "Running in development: the sidecar is started by hand." and a "Continue" button.

Step 3 `/welcome/key`: "step 03", "Add a key", body "The classifier and the coach need one model provider. Anthropic is recommended; you can add others later in Settings." One `KeyRow` for Anthropic expanded by default, the other four collapsed under "Other providers". "Continue" is enabled once any key is set (`GET /api/settings/keys`); a "Skip for now" link goes on with the hint "Without a key, responses are classified by keywords only and the coach is off."

Step 4 `/welcome/probes`: "step 04", "Load probes", body "Probes are the test prompts. The default set comes from the research the tool is based on. You can add your own later.", button "Load the default set" (`POST /api/probes/load-defaults`, result "Loaded {loaded} probes"), link "I have my own files" (opens the Import dialog), "Continue" (enabled once `GET /api/probes` is non-empty; "Skip" link otherwise).

Step 5 `/welcome/done`: "setup complete" chip, "Flinch is ready.", lead "Make a session and send your first probe.", buttons "Take the tour" (sets `flinch:onboarding_done`, navigates to `/probe?tour=1`) and "Just take me in" (sets `flinch:onboarding_done` and `flinch:tour_seen`, navigates to `/probe`). On `/probe` with `?tour=1` the New session dialog opens first; the tour starts when it closes with a session.
## 8. Frontend architecture

### 8.1 Project layout (`ui/`)

```
ui/
  package.json              name "flinch-ui", version 0.9.0, scripts: dev, build, check, lint, test, test:e2e
  svelte.config.js          Pry's: adapter-static, fallback index.html, strict false
  vite.config.ts            Pry's plus server.proxy (section 8.2)
  tailwind.config.js        section 3.1
  postcss.config.js         tailwindcss + autoprefixer
  tsconfig.json             Pry's (strict)
  .prettierrc               Pry's
  vitest.config.ts          environment jsdom for component tests, node for the rest
  playwright.config.ts      section 11.3
  static/favicon.png
  src/
    app.html                section 3.1
    app.css                 tokens, Tailwind layers, the response-text styles
    routes/
      +layout.ts            export const ssr = false; prerender = false
      +layout.svelte        shell: header, rail, workspace, status strip, overlays, tour
      +page.svelte          redirect (section 2.2)
      welcome/+layout.svelte, +page.svelte, python/, key/, probes/, done/
      probe/+page.svelte
      probe/runs/[runId]/+page.svelte
      studies/+layout.svelte      StudiesTabs
      studies/+page.svelte        redirect
      studies/framings/+page.svelte
      studies/conditions/+page.svelte, new/+page.svelte, [id]/+page.svelte
      studies/repeat/+page.svelte
      studies/sequences/+page.svelte
      studies/compare/+page.svelte, [id]/+page.svelte
      studies/baselines/+page.svelte
      data/+layout.svelte         DataTabs
      data/+page.svelte           redirect
      data/browse/+page.svelte, sessions/[id]/+page.svelte, sequences/[id]/+page.svelte
      data/scorecard/+page.svelte
      data/publish/+page.svelte
      data/coach/+page.svelte
      guide/glossary/+page.svelte, methodology/+page.svelte, policies/+page.svelte
    lib/
      api/
        client.ts           section 8.3
        streams.ts          section 8.4
        types.ts            every request and response shape (section 8.5)
        endpoints.ts        one function per route, typed (section 8.5)
      stores/
        session.svelte.ts   section 2.4
        probe.svelte.ts     section 5 state
        status.svelte.ts    section 4.4
        streams-registry.svelte.ts  section 8.4
        prefs.ts            section 2.3
      tauri.ts              section 8.6
      is-tauri.ts           Pry's
      errors.ts             friendlyError with Flinch rules (A.5)
      format.ts             formatResponse(), formatDate(), pct(), truncate()
      shortcuts.ts          section 5.10
      glossary.ts           A.1
      tips/tips-registry.ts, coordinate.ts   A.2
      tour/steps.ts, state.svelte.ts, Tour.svelte   A.3
      copy/moves.ts, screens.ts, errors.ts, visible-strings.ts, copy-files.ts, *.test.ts
      popup/place.ts, measure.ts, occupied.svelte.ts, *.test.ts   (Pry's)
      guide/methodology.md
      components/           section 3.5 and 3.6, plus one folder per screen:
        shell/   Header, SessionSwitcher, SidecarChip, SidecarCrashBanner, GuideMenu, StatusStrip, ShortcutsOverlay
        rail/    ProbeRail, ProbeRow, SessionStats, RunHistory
        probe/   ProbeCard, PolicyLinks, Thread, TurnCard, PushbackPanel, NotesPanel, BatchRun, ResponseReadout
        dialogs/ Dialog, NewSessionDialog, AddProbeDialog, ImportProbesDialog, ExportDialog, SaveBaselineDialog, LinkClaimDialog, ClearAllDialog
        studies/ FramingGroups, FramingResults, FramingNew, ConditionsList, ConditionsNew, ConditionRun, ConditionResults, ConditionRaters, ConditionExport, RepeatRuns, Sequences, SequenceResults, ModelCompare, ComparisonView, Baselines
        data/    Browse, SessionDetail, SequenceDetail, Scorecard, Publish, CoachExamples, PolicyReader, GlossaryPage
        settings/ SettingsDrawer, KeyRow, OllamaSection, CoachSection, DeveloperSection
        welcome/ (the five step pages' pieces)
  tests/e2e/                Playwright specs (section 11.3)
```

Rules:
- Every component is Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`). No stores from `svelte/store` except `$page`.
- No `window.*` globals, no inline event handler strings, no `innerHTML`. Model text is rendered through `formatResponse()` which returns a tree of `{type: 'p'|'ul'|'quote', lines}` that the `TurnCard` renders with Svelte blocks, never `{@html}`.
- No `confirm()`, `prompt()` or `alert()`. `ConfirmButton` and dialogs only.
- Every fetch goes through `client.ts`; every SSE through `streams.ts`.
- Every user-visible string obeys section 3.7.

### 8.2 Dev proxy

`vite.config.ts`:

```ts
server: {
  port: 5173, strictPort: true, host: '127.0.0.1',
  proxy: {
    '/api': { target: process.env.FLINCH_SIDECAR ?? 'http://127.0.0.1:8000', changeOrigin: false },
    '/health': { target: process.env.FLINCH_SIDECAR ?? 'http://127.0.0.1:8000' },
    '/docs': { target: ..., same },
    '/openapi.json': { target: ..., same },
  },
}
```

The proxy must not buffer: Vite's `http-proxy` streams responses by default, which keeps SSE working through `vite dev`.

### 8.3 API client (`lib/api/client.ts`)

- `base(): Promise<string>`: in Tauri, `invoke('sidecar_url')` cached until a `sidecar:crashed` or `sidecar:restarted` event; retried every 750 ms for up to 30 s at cold start (Pry's `resolveConnection`). In dev, `''` (relative, proxied).
- `request<T>(path, init?)`: `fetch(base + path, {headers: {'Content-Type': 'application/json'}, ...init})`; `init.body` objects are JSON-encoded; non-2xx throws `ApiError {status, message}` where `message` is the JSON `detail` when the body is JSON, else the text. 404 on `/api/*` after a sidecar restart triggers one base re-resolve and retry (Pry's 403 pattern).
- `download(path): Promise<{blob, filename}>` reads `Content-Disposition`.
- No request has a timeout except `/health` (3 s).

### 8.4 Streams (`lib/api/streams.ts` and `stores/streams-registry.svelte.ts`)

`openStream(path, body, handlers, {id, route, label})`:
- POSTs with `fetch`, `signal` from a new `AbortController`.
- Parses SSE across chunk boundaries: a `TextDecoder` with `stream: true`, a buffer split on `\n`, state `{event: string|null, data: string[]}` that persists across reads; a blank line dispatches. Lines starting `event:` set the event name; `data:` lines accumulate. A `data:` block with no preceding `event:` dispatches with event name `message`, and if the parsed JSON has a `type` field that field is used as the event name. This covers both the `event:`-prefixed streams (batch, stat-run, sequences, batches) and the bare-`data:` streams (`/experiments/*/start`, `/resume`, `/metrics`, `/rate`, `/prompts/import-hh`).
- `handlers.on(event, data)`, `handlers.done()`, `handlers.error(err)`. An aborted fetch calls `done()` with `{aborted: true}`.
- Registers `{id, route, label, controller, startedAt}` in the registry; the status strip shows the newest registered stream's label and progress; `cancel(id)` aborts; the registry drops the entry on `done`.
- Exactly one stream per `id` at a time: opening with an existing id aborts the old one first.

Stream ids: `batch:{sessionId}`, `statrun:{sessionId}`, `conditions:{experimentId}`, `metrics:{experimentId}`, `rate:{experimentId}`, `hh:{experimentId}`, `sequence:{sequenceId}`, `seqbatch:{batchId}`.

### 8.5 Types and endpoints

`types.ts` declares, as TypeScript interfaces, every response shape used by a screen, copied from the sidecar's return statements (not from `models.py`, which does not describe the dict responses). The shapes needed are the ones each screen names above; the implementer reads the cited sidecar function for each. `endpoints.ts` exports one typed function per route the app uses, named after the route (`listProbes(sessionId?)`, `createSession(body)`, `sendProbe(sessionId, body)`, …). A Vitest test (`endpoints.test.ts`) asserts every function's path against a snapshot list, and `tests/test_api_contract.py` (section 11.1) asserts the same list exists in the sidecar's OpenAPI document, so the two sides cannot drift silently.

### 8.6 Tauri bridge (`lib/tauri.ts`)

Typed wrappers with dev fallbacks, as Pry's `tauri.ts`:

| Function | Command | Dev fallback |
|----------|---------|--------------|
| `sidecarUrl()` | `sidecar_url` | `''` |
| `sidecarStderr()` | `sidecar_stderr` | `[]` |
| `runtimeStatus()` | `runtime_status` → `{ready}` | `{ready: true}` |
| `bootstrapRuntime()` | `bootstrap_runtime_command` | resolves immediately |
| `restartSidecar()` | `restart_sidecar` (new, 10.3) | throws "Not in the desktop app" |
| `getApiKeys()` | `get_api_keys` → `{provider: bool}` | `{}` |
| `setApiKey(provider, key)` | `set_api_key` | no-op |
| `deleteApiKey(provider)` | `delete_api_key` | no-op |
| `copyDiagnostic()` | `copy_diagnostic` | throws |
| `listCrashLogs()` | `list_crash_logs` | `[]` |
| `openDevtools()` | `open_devtools` (new, 10.3) | no-op |
| `appVersion()` | `@tauri-apps/api/app` `getVersion()` | `'dev'` |
| `saveFile(blob, filename)` | `@tauri-apps/plugin-dialog` `save()` then `@tauri-apps/plugin-fs` `writeFile` | anchor download |
| `openExternal(url)` | `@tauri-apps/plugin-shell` `open` | `window.open` |
| `onBootstrapProgress/Log/Error`, `onSidecarReady/Crashed/Restarted` | `listen(...)` | never fire |

Events and their payloads are the ones `src-tauri/src/bootstrap/events.rs` and `lib.rs` emit today, plus `sidecar:crashed {detail}` and `sidecar:restarted {base_url}` (section 10.3).

### 8.7 Error handling

- Every `request` failure in a screen goes to `status.error(friendlyError(e).message, friendlyError(e).details)` unless the screen shows it inline (dialog forms, key rows).
- Every stream `error` event with an `error` field becomes a status-strip error and, where the screen has a table, a row.
- A failed `/health` at startup shows the `SidecarCrashBanner` text "Flinch's sidecar is not reachable." with "Restart sidecar" (desktop) or "Start it with python -m flinch.app" (dev).
## 9. Backend changes

Each item: the file and function, the exact edit, and the test in `tests/` that proves it. All tests are pytest; the ones that need the app use `fastapi.testclient.TestClient` against `flinch.app:app` with `FLINCH_DB_PATH` pointed at a temp file (fixture `app_client` in `tests/conftest.py`, new). Nothing here calls a model provider; where a target is needed the test monkeypatches `Runner._make_target` with `tests/fakes.py`'s `FakeTarget` (returns canned text, records calls) and `flinch.classifier.classify` with a keyword-only shim.

### 9.1 Batch cancel honoured server-side

`flinch/runner.py`, `Runner`: add `self._cancelled: set[int] = set()` and `def cancel_batch(self, batch_id: int) -> None: self._cancelled.add(batch_id)`. In `run_batch`, at the top of the `for probe_id in probe_ids:` loop body: `if batch_id in self._cancelled: break`. After the loop, the final `update_batch_run` writes `status="cancelled"` when the id is in the set (and discards it from the set), else `"complete"`; the `complete` event's data gains `"cancelled": bool`. `flinch/app.py` `cancel_batch`: call `_runner.cancel_batch(batch_id)` before writing the status. Also wrap the generator loop in `try/finally` so a client disconnect (the UI's abort) sets the batch `cancelled` the same way (asyncio cancels the generator when the response is dropped; the `finally` runs).

Test `test_batch_cancel.py`: start a batch of 5 probes with `delay_ms=200` in a thread through `TestClient.stream`, read the first `progress` event, POST cancel, drain; assert the batch row's status is `cancelled`, fewer than 5 runs exist, and the last event is `complete` with `cancelled: true`.

### 9.2 Pause keeps `paused` and cancels workers

`flinch/runner.py`, `ExperimentRunner.run_experiment`:
- Replace the "every 10 cells" DB check with a check before every cell (`SELECT status FROM experiments WHERE id = ?`), break when `paused`.
- Wrap the `while True` consumer loop and the `gather` in `try/finally`; in `finally`, cancel every task in `tasks` that is not done and `await asyncio.gather(*tasks, return_exceptions=True)`.
- After the loop, re-read the status: if it is `paused`, do not write `completed`; yield `{"type": "paused", "completed": completed, "failed": failed, "total": total}` and return. Otherwise write `completed` as today.
- `pause()` stays (it is unused by the route) and additionally sets `self._paused = True`.

`flinch/app.py` `api_pause_experiment`: unchanged (writes `paused`). The UI aborts the stream first (section 6.2.3), so the `finally` cancels the workers.

Test `test_experiment_pause.py`: create an experiment with 2 conditions, 3 prompts, 1 model, repetitions 1 (6 cells) with `FakeTarget` that sleeps 50 ms; start the stream, after the first `progress` POST pause and close the stream; assert status is `paused`, pending cells remain, and no `experiment_responses` row flips to `completed` after a 300 ms wait (workers were cancelled).

### 9.3 Rate-limiter config shape

`flinch/rate_limiter.py` `RateLimiterPool.get`: accept `int` values: `cfg = self._config.get(provider, {}); if isinstance(cfg, int): cfg = {"concurrent": cfg}`. `flinch/models.py` `StartExperimentRequest.concurrency_per_provider`: type `dict[str, int | dict[str, int]]`, default `{}` (an empty map means the limiter defaults). `flinch/app.py`: both `/start` and `/resume` already pass the field through; no change.

Test `test_rate_limiter.py`: `RateLimiterPool({"anthropic": 2}).get("anthropic").max_concurrent == 2`; `RateLimiterPool({"openai": {"rpm": 10}}).get("openai").rpm == 10`; `RateLimiterPool({}).get("google").max_concurrent == 3`.

### 9.4 Classification written for every condition-study response

- `flinch/runner.py` `ExperimentRunner.__init__`: `backend` is an `LLMBackend | None` (today it defaults to the string `"anthropic"`, which nothing reads); store it. `_run_single_cell`: after `resp = await target.send(prompt_text)`, `classification = await classify(resp.text, prompt_text, self.backend)` and pass `classification=classification.value` to `update_experiment_response`.
- `flinch/app.py` `/start` and `/resume`: construct `ExperimentRunner(db_conn, pool, backend=_runner.backend if _runner else None)`.
- `flinch/app.py` `/resume-conditions` and `/batch-conditions`: deleted (D28, section 13).

Test `test_condition_classification.py`: run a 1x1x1 experiment with `FakeTarget` returning "I can't help with that." and the keyword classifier; assert the response row's `classification == "refused"` and `/condition-comparison` reports `classifications == {"refused": 1}`.

### 9.5 `.env` never overrides set variables

`flinch/app.py` `_load_dotenv`: `os.environ.setdefault(key, value)` instead of assignment. `_read_env_file` and `_write_env_file` unchanged (the settings route still writes and hot-loads explicitly).

Test `test_dotenv.py`: with `ANTHROPIC_API_KEY=from-env` in `os.environ` and a temp `.env` holding `ANTHROPIC_API_KEY="from-file"`, call `_load_dotenv()` (patched `Path`) and assert the env value survives; with the variable absent, assert the file value is loaded.

### 9.6 `/export?format=jsonl` for condition studies

`flinch/app.py` `api_export_experiment`: add `format: str = "json"`. When `jsonl`: return a `StreamingResponse` whose generator opens its own `get_async_db()` connection, iterates `SELECT * FROM experiment_responses WHERE experiment_id = ? ORDER BY id`, yields `json.dumps(dict(row)) + "\n"` per row, media type `application/x-ndjson`, `Content-Disposition: attachment; filename="study-{id}-responses.jsonl"`. Any other value keeps today's JSON object, now also with `Content-Disposition` (`study-{id}.json`).

Test `test_export_jsonl.py`: 2x2x1 experiment with fake completions; `GET /export?format=jsonl` returns 4 lines, each parsing to a dict with `condition_id`, `prompt_id`, `model_id`, `repetition`, `classification`.

### 9.7 Empty system prompt as a control condition

`flinch/models.py` `ConditionCreate.system_prompt`: `str = Field(default="")` (drop `min_length=1`, make it optional). Test `test_models.py`: `ConditionCreate(label="Control")` validates with `system_prompt == ""`.

### 9.8 Repetitions

- `flinch/models.py` `CreateExperimentRequest.repetitions: int = Field(default=1, ge=1, le=50)`.
- `flinch/db.py`: schema for `experiment_responses` gains `repetition INTEGER NOT NULL DEFAULT 0` and the unique constraint becomes `UNIQUE(experiment_id, condition_id, prompt_id, model_id, repetition)`. Migration `_migrate_experiment_responses_table`: if `repetition` is missing, rebuild the table (create `experiment_responses_new` with the new schema, `INSERT INTO … SELECT …, 0 AS repetition FROM experiment_responses`, drop old, rename, recreate `idx_expr_resp_exp_status`). This runs inside `init_db` before any query.
- `create_experiment` (async): store `repetitions` in `config["repetitions"]` (the route copies `req.repetitions` into `req.config` before calling). `create_experiment_responses`: read `repetitions = int(config.get("repetitions", 1))` and insert `repetition` 0..N-1 per cell.
- `find_experiment_response` is deleted with `/batch-conditions`.
- `get_pending_responses` and `_run_single_cell` are unchanged (they work on row ids).
- `/responses` adds `repetition` to each row implicitly (`SELECT *`).
- `/condition-export` adds `er.repetition` as a column after `condition_label`.
- `api_estimate_experiment`: `total_cells` multiplies by repetitions.

Test `test_repetitions.py`: create with `repetitions=3`, 1 condition, 2 prompts, 1 model; `create_experiment_responses` makes 6 rows with repetitions 0,1,2 per cell; running with `FakeTarget` completes all 6; `/condition-export` has 6 data rows. `test_migration_repetition.py`: build a DB with the old `experiment_responses` schema and two rows, run `init_db`, assert the rows survive with `repetition = 0` and a third row with `repetition = 1` inserts.

### 9.9 Cache headers on API responses

`flinch/app.py`: a pure ASGI middleware class `NoStoreMiddleware` (`__call__(scope, receive, send)`; wraps `send` to append `(b"cache-control", b"no-store")` to the `http.response.start` headers when `scope["type"] == "http"` and `scope["path"]` starts with `/api/` or equals `/health`, and the response has no `cache-control` header already). Registered with `app.add_middleware(NoStoreMiddleware)`. Not `BaseHTTPMiddleware` (it would buffer the SSE streams). Test `test_api_contract.py::test_no_store_header` and `::test_no_base_http_middleware` (walks `app.user_middleware` and asserts no class is a `BaseHTTPMiddleware` subclass).

### 9.10 App version in exports

`flinch/app.py`: every literal `"0.2"` in `flinch_version` fields and the report footer `Flinch v0.2` become `__version__` (imported at module top). `/health` fallback `"0.8.0"` becomes `__version__`. `flinch/__init__.py` `__version__ = "0.9.0"`. Test: `GET /api/version` and `/health` both return `0.9.0`; a session JSON export has `flinch_version == "0.9.0"`.

### 9.11 Sidecar is API-only

`flinch/app.py`: remove `app.mount("/static", …)`, `STATIC_DIR`, and the `/` `FileResponse` route. Add `GET /` returning `{"name": "flinch", "version": __version__, "docs": "/docs"}`. `pyproject.toml`: add `[tool.hatch.build.targets.wheel] exclude = ["flinch/static/**"]` (the folder is deleted anyway; the exclude guards against a stray file). `src-tauri/tauri.conf.json` `bundle.resources`: remove `"../flinch/static/**/*"`. Test `test_api_contract.py::test_no_static_mount`.

### 9.12 Sessions carry `run_count`

`flinch/db.py` `list_sessions`: `LEFT JOIN runs` and `COUNT(r.id) AS run_count`, `GROUP BY s.id`. Test: a session with two runs lists `run_count == 2`.

### 9.13 `/health` facts and `/api/settings/capabilities`

`/health` adds `db_path` (the resolved SQLite path) and `keys_set` (count of set provider keys). New `GET /api/settings/capabilities` returns `{"pdf": bool, "experiment_extras": bool, "openai_sdk": bool, "google_sdk": bool}` from import probes (`weasyprint`, `scipy`+`numpy`+`krippendorff`, `openai`, `google.genai`). Test: shape and types.

### 9.14 Routes removed

`POST /api/sessions/{id}/batch-conditions`, `POST /api/experiments/{id}/resume-conditions`, `Runner.run_batch_conditions`, `db.find_experiment_response`, `ConditionItem`, `BatchConditionsRequest`. Also the dead `corpus_*` CRUD in `db.py` (`create_corpus_import` through `confirm_extracted_probes`; no route calls them) and the `corpus_imports` and `extracted_probes` tables are left in place in the schema (dropping tables is not worth a migration) but the functions go. `test_api_contract.py::test_removed_routes` asserts the two paths are absent from OpenAPI.

### 9.15 Contract test (`tests/test_api_contract.py`)

Loads `app.openapi()` and asserts:
- every path in `ui/src/lib/api/endpoints.ts`'s snapshot (`ui/src/lib/api/endpoints.paths.json`, generated by the Vitest test) exists with the method used;
- the removed routes are absent;
- `/api/settings/keys` returns a list whose entries have `provider` and boolean `is_set` and no raw key (ported from `scripts/verify-phase1.py`);
- the no-store header and the absence of `BaseHTTPMiddleware`;
- `GET /` is JSON.

`scripts/verify-phase1.py` keeps its stdin-handoff and `--db-path` cases and drops the static-serving assumptions.

## 10. Packaging and the desktop shell

### 10.1 `src-tauri/tauri.conf.json`

```json
"build": {
  "frontendDist": "../ui/build",
  "devUrl": "http://localhost:5173",
  "beforeDevCommand": "npm run dev --prefix ./ui",
  "beforeBuildCommand": "npm run build --prefix ./ui"
}
```
`version` 0.9.0. `bundle.resources` loses `../flinch/static/**/*`. CSP unchanged (it already allows `connect-src http://127.0.0.1:*`; the app fetches the sidecar by absolute URL from `sidecar_url`). `app.withGlobalTauri` stays `true` (harmless; the app uses `@tauri-apps/api` imports).

### 10.2 Capabilities (`src-tauri/capabilities/default.json`)

Add `"dialog:allow-save"`, `"fs:allow-write-file"` scoped to `$DOWNLOAD/**` and `$DOCUMENT/**`, `"shell:allow-open"`. Add the plugins to `Cargo.toml` (`tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-shell`, the versions Pry pins) and register them in `lib.rs`.

### 10.3 New Tauri commands and events (`src-tauri/src/lib.rs`, `sidecar.rs`)

- `restart_sidecar`: shuts the current handle down and launches again (Pry's `restart_sidecar` and `restart_sidecar_engine` pattern); emits `sidecar:restarted {base_url}` on success.
- `open_devtools(window)`: `window.open_devtools()` behind `#[cfg(debug_assertions)]` or the `devtools` feature, as Pry.
- The sidecar monitor task emits `sidecar:crashed {detail}` when the child exits unexpectedly (Pry's monitor), keeping the existing crash log write.
- `runtime_status` keeps returning `{ready}`.

### 10.4 Bundle hash

`src-tauri/src/bootstrap/mod.rs` `bundle_hash()` hashes `pyproject.toml` and `flinch/*.py`. With `flinch/static/` gone this is already complete for the sidecar; no change. The app's own code lives in `ui/build` inside the installer and needs no runtime hash.

### 10.5 Scripts

- `scripts/bundle-resources.py`: unchanged except that `pip wheel` now produces a wheel without `static/` (the folder no longer exists).
- `scripts/build-installer.ps1`: before step 1, run `npm ci --prefix ui` and `npm run build --prefix ui`, failing the build if `ui/build/index.html` is missing. The expected installer size band becomes 45 to 75 MB (the UI adds under 2 MB; the old band was a guess).
- New `scripts/dev.ps1` and `scripts/dev.sh`: start `python -m flinch.app --port 8000` and `npm run dev --prefix ui` together (two processes, Ctrl-C stops both), and print `http://127.0.0.1:5173`.

### 10.6 Dev modes

| Mode | Command | Sidecar | UI |
|------|---------|---------|----|
| Browser dev | `scripts/dev.sh` | `python -m flinch.app` on 8000 | `vite dev` on 5173, proxied |
| Desktop dev | `cargo tauri dev` in `src-tauri/` | spawned by the shell from the managed runtime, or from `FLINCH_PYTHON_OVERRIDE` | `devUrl` 5173 via `beforeDevCommand` |
| Packaged | the NSIS installer | managed runtime | `ui/build` from `frontendDist` |

In browser dev, `isTauri()` is false: keys go to `.env` through the sidecar, Developer shows "dev" as the app version, DevTools rows are hidden, downloads use the anchor path.
## 11. Tests

### 11.1 Sidecar (pytest, `tests/`)

`pip install -e ".[dev]"` then `pytest`. Files: `conftest.py` (temp-DB `app_client` fixture, `FakeTarget`, keyword-classifier shim), `fakes.py`, and the files named in section 9. `test_experiment_pipeline.py` stays and is adapted to the `repetition` column. CI: `.github/workflows/ci.yml` (new) runs `ruff check`, `pytest`, `npm ci && npm run check && npm test` in `ui/`, and the Playwright smoke on `ubuntu-latest`.

### 11.2 App (Vitest, `ui/`)

- `copy/copy-lint.test.ts` (Pry's): every `.svelte` and every file in `COPY_FILES` = `lib/glossary.ts`, `lib/tips/tips-registry.ts`, `lib/tour/steps.ts`, `lib/copy/moves.ts`, `lib/copy/screens.ts`, `lib/copy/errors.ts`, `lib/errors.ts`, `lib/guide/methodology.md`.
- `glossary.test.ts`: every definition at most 140 characters; every alias resolves; no duplicate aliases.
- `tips/tips-registry.test.ts`: unique ids; every `target` selector appears literally in some `.svelte` file (grep of `data-tip="…"` or `data-tour="…"`).
- `tour/steps.test.ts`: at most 10 steps; every anchor appears in a `.svelte` file; every step has a title under 40 characters and a body under 240.
- `api/endpoints.test.ts`: writes `endpoints.paths.json` and asserts every function's path and method is in it.
- `api/streams.test.ts`: the parser handles an `event:` block split across two chunks, two `data:` blocks in one chunk, a bare `data:` block with `type`, and abort mid-stream.
- `format.test.ts`: `formatResponse` for paragraphs, lists, quotes; `pct` rounding (Pry's rules).
- `popup/*.test.ts`: Pry's, unchanged.
- `components/ClassBadge.test.ts` (jsdom): renders glyph and word for each value; `onChange` menu picks.
- `stores/probe.test.ts`: phase transitions table.

### 11.3 End-to-end (Playwright, `ui/tests/e2e/`)

`playwright.config.ts`: `webServer` starts two processes: `python -m flinch.app --port 8765 --db-path {tmp}` with env `ANTHROPIC_API_KEY=test`, `ANTHROPIC_BASE_URL=http://127.0.0.1:8766`, `OPENAI_API_KEY=test`, `OPENAI_BASE_URL=http://127.0.0.1:8766/v1`, and `python tests/fake_models.py --port 8766`; then `vite preview --port 4173` of `ui/build` with `FLINCH_SIDECAR=http://127.0.0.1:8765`. Chromium only. `localStorage` seeded with `flinch:onboarding_done=true` and `flinch:tour_seen=true` except in the first-run spec.

`tests/fake_models.py`: a FastAPI app with
- `POST /v1/messages` (Anthropic shape) and `POST /v1/chat/completions` (OpenAI shape). The reply is chosen from the last user message: if the system prompt starts with "You are a response classifier", reply with the single word the text implies (contains "I can't" → `REFUSED`; contains "Here is" → `COMPLIED`; contains "partially" → `NEGOTIATED`; else `COMPLIED`); if the system prompt contains "pushback" (the coach), reply with the JSON `{"pattern_detected": "generic-refusal", "move_suggested": "specificity_challenge", "pushback_draft": "What specifically about this is problematic?", "confidence": 0.5, "reasoning": "test"}`; otherwise, if the user message contains `[REFUSE]` reply "I can't help with that."; if the conversation has more than one user message (a pushback arrived) reply "Here is the thing you asked for."; else reply "Here is a plain answer.". Usage fields and `stop_reason` are filled so `TargetResponse` parsing works.
- `GET /v1/models` returns one model so `validate-key` passes.

Specs:
1. `first-run.spec.ts`: lands on `/welcome`, walks the five steps in dev mode (Python step shows the dev notice), adds the fake Anthropic key, loads the default probes (the example file), reaches `/probe`.
2. `probe-loop.spec.ts`: creates a session, picks the probe whose text contains `[REFUSE]` (the spec seeds it through `POST /api/probes`), sends it, sees the Refused badge and the coach draft, edits the draft, sees the "recorded as your override" line, sends, sees Collapsed after pushback, teaches the coach, checks `/data/coach` lists one example.
3. `batch-cancel.spec.ts`: runs all probes with `delay_ms` 500, cancels after the first row, sees "Stopped after".
4. `conditions.spec.ts`: creates a study with a control and one condition, 2 probes, 1 model, repeats 2, starts it, sees 8 cells complete, opens Results and sees four badges per condition, downloads the JSONL and asserts 8 lines.
5. `repeat.spec.ts`: 1 probe x 3 times; sees three glyphs and the stat row.
6. `export-dialog.spec.ts`: every enabled row downloads a file with the expected `Content-Disposition` name.
7. `settings.spec.ts`: Settings shows the dev key sentence, Replace validates and saves, Remove clears.
8. `shortcuts.spec.ts`: S sends from `selected`; S in a textarea types an "s".

## 12. Task breakdown

Tasks are ordered; each names its files and the check that closes it. Tasks marked (P) can run in parallel with their neighbours once their dependency is done. Every task ends with `ruff check`, `pytest`, and in `ui/` `npm run check && npm test` passing. The branch for all of this is `claude/beautiful-carson-kj2mt2`; commits are one per task with the task id in the subject.

| Id | Task | Files | Depends on | Acceptance check |
|----|------|-------|------------|------------------|
| T01 | Backend contract fixes: 9.3, 9.5, 9.7, 9.9, 9.10, 9.12, 9.13 | `flinch/app.py`, `models.py`, `rate_limiter.py`, `db.py`, `__init__.py`, `pyproject.toml`, `tests/conftest.py`, `tests/fakes.py`, `tests/test_*.py` | none | The tests in those sections pass; `GET /api/version` is 0.9.0. |
| T02 | Batch cancel (9.1) | `runner.py`, `app.py`, `tests/test_batch_cancel.py` | T01 | 9.1's test passes. |
| T03 | Pause and worker cancellation (9.2); classification for condition responses (9.4); `ExperimentRunner` backend wiring | `runner.py`, `app.py`, tests | T01 | 9.2 and 9.4 tests pass. |
| T04 | Repetitions and migration (9.8); JSONL export (9.6) | `db.py`, `models.py`, `app.py`, tests | T03 | 9.6 and 9.8 tests pass; `test_experiment_pipeline.py` passes. |
| T05 | Sidecar API-only (9.11); route and dead-code removals (9.14); contract test (9.15); `verify-phase1.py` update | `app.py`, `db.py`, `runner.py`, `models.py`, `tests/test_api_contract.py`, `scripts/verify-phase1.py`, `tauri.conf.json` resources | T04 | `GET /` is JSON; `/static/...` is 404; removed routes absent; `verify-phase1.py` passes. The old `flinch/static/` is left in place until T30. |
| T06 | `ui/` scaffold: package, configs, `app.html`, `app.css` tokens, Tailwind, Prettier, Vitest, root layout with an empty header, `/` redirect, `prefs.ts`, `is-tauri.ts`, `tauri.ts`, `client.ts`, `streams.ts`, `types.ts`, `endpoints.ts` (empty), `errors.ts` | `ui/**` | none (P with T01) | `npm run check`, `npm test` pass; `npm run dev` serves a blank shell that reaches `/health` through the proxy. |
| T07 | Port Pry components (3.5) and new shared components (3.6) with their tests | `ui/src/lib/components/**`, `popup/**` | T06 | Component tests pass; `copy-lint` runs over the new files. |
| T08 | Copy modules: `glossary.ts`, `tips-registry.ts`, `tour/steps.ts`, `copy/moves.ts`, `copy/screens.ts`, `copy/errors.ts`, `guide/methodology.md` from Appendix A | `ui/src/lib/**` | T06 | 11.2's copy tests pass. |
| T09 | Shell: header, session switcher, sidecar chip, crash banner, guide menu (items wired to routes), status strip, shortcuts overlay, settings drawer frame | `components/shell/**`, `routes/+layout.svelte`, stores | T07, T08 | Playwright can open the shell, switch sections, open and close the drawer with Escape. |
| T10 | Session and probe stores, New session dialog, Add probe dialog, Import dialog, probe rail with stats and history | `stores/**`, `components/rail/**`, `components/dialogs/**` | T09 | `probe.test.ts` passes; rail shows probes for a session in the browser. |
| T11 | Probe workspace: idle, selected, custom, sending, thread, pushback, done, notes, policy links, saved run route, shortcuts | `components/probe/**`, `routes/probe/**`, `shortcuts.ts` | T10, T02 | `probe-loop.spec.ts` and `shortcuts.spec.ts` pass. |
| T12 | Batch run panel | `components/probe/BatchRun.svelte` | T11 | `batch-cancel.spec.ts` passes. |
| T13 | Settings drawer content: keys (both stores), Ollama, coach, developer | `components/settings/**` | T09 | `settings.spec.ts` passes in dev mode; desktop path verified by hand in T28. |
| T14 | Export dialog | `components/dialogs/ExportDialog.svelte` | T11 | `export-dialog.spec.ts` passes. |
| T15 | Studies layout and tabs; Framings | `routes/studies/**`, `components/studies/Framing*` | T11 | Groups list, create both ways (coach path mocked by the fake server), run a group, results tab shows badges. |
| T16 | Conditions: list, new, run tab | `components/studies/Conditions*`, `ConditionRun` | T04, T15 | `conditions.spec.ts` steps 1 to 3 pass; pause and resume by hand against the fake server. |
| T17 | Conditions: results, raters, export tabs | `ConditionResults`, `ConditionRaters`, `ConditionExport` | T16 | `conditions.spec.ts` passes fully; raters tab rates against the fake server; Prolific CSV downloads. |
| T18 | Repeat runs | `RepeatRuns.svelte` | T15 | `repeat.spec.ts` passes. |
| T19 | Sequences: run tab (new, batch, list, interactive, auto, whittle) | `Sequences.svelte` | T15 | By hand against the fake server: automatic run completes; interactive run advances a turn and drops the probe. |
| T20 | Sequences: results tab, thresholds, strategy effectiveness | `SequenceResults.svelte` | T19 | Charts render for a whittled sequence (fake server makes the model refuse once `[REFUSE]` appears in the adapted probe). |
| T21 | Model compare and comparison view | `ModelCompare.svelte`, `ComparisonView.svelte` | T15 | A 2-model comparison against the fake server shows two columns and saves to history. |
| T22 | Baselines | `Baselines.svelte` | T15 | Save, compare, delete work; diff table shows statuses. |
| T23 | Data layout; Browse with detail routes; clear-all dialog | `routes/data/**`, `components/data/Browse*`, `SessionDetail`, `SequenceDetail` | T11 | Rows open, exports download, clear-all deletes and preserves probes. |
| T24 | Scorecard (both tabs) | `Scorecard.svelte` | T23 | A linked claim produces a cell; the session tab shows bars. |
| T25 | Publish | `Publish.svelte` | T23 | Markdown preview and download for each template; PDF option disabled when `capabilities.pdf` is false. |
| T26 | Coach examples; Guide pages (glossary, methodology, policies) | `CoachExamples.svelte`, `GlossaryPage`, `PolicyReader`, `routes/guide/**` | T23 | Pages render; edit and delete work; claims expand. |
| T27 | First-time tips, the tour, first run routes | `tips/**`, `tour/**`, `routes/welcome/**` | T11, T13 | `first-run.spec.ts` passes; the tour runs its 10 steps on a session with one run. |
| T28 | Desktop shell: `tauri.conf.json`, capabilities, plugins, `restart_sidecar`, `open_devtools`, crash events, build script, dev scripts | `src-tauri/**`, `scripts/**` | T05, T13 | `cargo tauri dev` loads the app from 5173 and reaches the sidecar; `cargo tauri build` produces an installer that runs the first-run flow on a clean Windows 11 VM and saves a key to Credential Manager. |
| T29 | CI workflow and Playwright wiring | `.github/workflows/ci.yml`, `ui/playwright.config.ts`, `tests/fake_models.py` | T06, T05 | CI is green on the branch. |
| T30 | Switch-over: delete `flinch/static/`, `ui/index.html`, `ui/splash.js`, `ui/styles.css`, update `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `.env.example`; bump versions (D23) | repo-wide | all above | `grep -rn "static/" flinch/ src-tauri/` is empty; `pytest`, `npm test`, Playwright all green; `scripts/verify-phase1.py` passes. |

## 13. Deletions at switch-over (T30)

Files: `flinch/static/` (every file), `ui/index.html`, `ui/splash.js`, `ui/styles.css`.

Code (done in T05): `app.py` static mount and `/` file route, `STATIC_DIR`, `/batch-conditions`, `/resume-conditions`, `ConditionItem`, `BatchConditionsRequest`; `runner.py` `run_batch_conditions`; `db.py` `find_experiment_response` and the eight `corpus_*`/`extracted_probe*` functions; `models.py` nothing else.

Features retired with the UI (no backend route is lost): the legacy session-to-session compare modal (never worked; `/api/compare?session_ids=` stays and is used by Export's comparison rows), the "Experiments" tab's separate wizard (merged into Conditions), the condition "type" presets honest/deceptive/neutral/high_effort_honest (they were labels with no behaviour; the Import-from-file path covers canned condition sets), the "Legacy groups (DB only)" wording (the groups themselves are still listed).

`CLAUDE.md` is rewritten so that Key Paths lists `ui/` (SvelteKit app), the API-only sidecar, and the new scripts; the Running section becomes the two dev modes of section 10.6.
## Appendix A. Copy inventory

Every string here is final and is the string the code ships. Definitions are at most 140 characters (tested). No em dashes anywhere.

### A.1 Glossary (`ui/src/lib/glossary.ts`)

Same shape as Pry's (`term`, `definition`, `aliases`), plus `group`: `badges`, `loop`, `studies`, `models`.

| key | term | definition | aliases |
|-----|------|------------|---------|
| refused | Refused | The model declined the request outright: an apology, a redirect, or a flat no. | refuse, refusal |
| collapsed | Collapsed | The model refused first, then gave in after pushback. The flinch-then-fold. | collapse, fold |
| negotiated | Negotiated | A partial or hedged answer: some of the request with caveats, conditions or a watered-down version. | negotiate, partial |
| complied | Complied | The model did what was asked, with no refusal and no conditions. | comply, compliance |
| classification | classification | The badge given to a response: Refused, Collapsed, Negotiated or Complied. A keyword scan decides easy cases; a model judges the rest. | badge, classifier |
| probe | probe | A test prompt chosen to sit near a content rule. Probes have a domain, tags and sometimes a narrative opening for Sequences. | probes |
| session | session | A named set of runs against one model with one system prompt. Every probe in a session starts a fresh conversation. | sessions |
| run | run | One probe sent once to one model in one session, with any pushback that followed. | runs |
| pushback | pushback | Your reply after a refusal, written to test whether the refusal holds. The coach drafts it; you decide. | push back |
| coach | coach | A model that reads a refusal and drafts a pushback using one of seven moves and the examples you have taught it. | pushback coach |
| move | move | One of the coach's seven pushback tactics, such as asking what specifically is the problem. | moves |
| override | override | A pushback you edited or wrote yourself instead of sending the coach's draft as written. Overrides teach the coach. | overrides |
| flinch-then-fold | flinch-then-fold | A refusal that gives way under light pushback. The pattern Flinch is named for. | |
| system-prompt | system prompt | Instructions given to the model before the conversation. Sessions and conditions each set their own. | system prompts |
| domain | domain | A probe's subject area, such as violence or sexuality. Used to group probes and to filter reports. | domains |
| framing | framing | The same request written another way: as fiction, as research, as satire. A framing group holds several. | framings, framing group, variant |
| condition | condition | One system prompt in a conditions study. The control is the condition with no system prompt. | conditions |
| conditions-study | conditions study | Every prompt run under every condition for one or more models, so the answers can be compared. | study, experiment |
| cell | cell | One combination of prompt, condition and model in a conditions study. Repeats make more than one response per cell. | cells |
| repeat-run | repeat run | The same probe sent many times with a fresh conversation each time, to see how often each badge comes up. | repeat runs, stat run |
| sequence | sequence | Several turns of story built by the coach before the real probe arrives, to test whether context changes the answer. | sequences, narrative momentum |
| whittle | whittle | Running a sequence at fewer and fewer warmup turns until the model refuses, to find the smallest number that gets through. | whittling, threshold |
| strategy | strategy | The kind of story a sequence builds: fiction workshop, academic research, character study and so on. | strategies |
| baseline | baseline | A saved copy of a session's results, kept so a later run of the same probes can be compared with it. | baselines, snapshot |
| model-compare | model compare | The same probes sent to several models at once, shown side by side with their badges. | comparison |
| policy-claim | policy claim | One testable sentence from a provider's published content policy. Link it to the probes that test it. | claim, claims, policy |
| scorecard | scorecard | For each model, whether it enforced each linked policy claim: consistently, more than claimed, or less. | scorecards |
| text-metrics | text metrics | Measures of a response's wording: length, reading level, hedging and confidence words, vocabulary richness. | metrics |
| rater | rater | A model, or a person on Prolific, who ranks several responses to the same prompt without knowing their conditions. | raters, ai rater |
| sidecar | sidecar | The Python server that talks to the model providers and keeps the database. The app starts it for you. | |
| api-key | API key | The credential a provider gives you. Flinch keeps it on this computer and sends it only to that provider. | key, keys |

### A.2 First-time tips (`ui/src/lib/tips/tips-registry.ts`)

Same `TipDef` shape as Pry's (`id`, `title`, `target`, `blurb`, `why`, `placement`, optional `focus`, `tutorialStepId`). Order is priority order.

| id | title | target | placement | blurb | why | tour step |
|----|-------|--------|-----------|-------|-----|-----------|
| session-switcher | Sessions | `[data-tour="session-switcher"]` | bottom | Everything in Probe happens inside a session: one model, one system prompt, its own runs. Switch or make one here. | A session keeps results comparable. Change the model or the system prompt and you want a new session, so the old numbers stay what they were. | step-1 |
| probe-rail | Probes | `[data-tour="probe-row"]` | right | Each row is a probe, a test prompt near a content rule. Click one to read it, then send it. | The default set comes from the research behind Flinch. Domains group them; the search box filters by name or text. | step-2 |
| send-button | Send | `[data-tour="send-button"]` | bottom | Sends the probe in a fresh conversation and classifies the answer. S does the same. | Every probe starts clean so earlier turns cannot change the result. Sequences are the study for testing context on purpose. | step-3 |
| response-readout | The badge | `[data-tour="response-readout"]` | top | The badge says what the model did. Click it to change it if the classifier got it wrong. | A keyword scan handles the clear cases and a model judges the rest. Your correction is saved on the run and used in every export. | step-4 |
| pushback-panel | Pushing back | `[data-tour="pushback-panel"]` | top | The coach drafted a reply that tests the refusal. Send it as is, or edit it. Edits are recorded as yours. | The coach picks one of seven moves from the refusal's wording and your past examples. What you send, and what happens next, is the data. | step-5 |
| teach-coach | Teaching the coach | `[data-tour="teach-coach"]` | top | Saves this refusal and your pushback as an example. The coach reads recent examples when drafting. | Examples are the only way the coach improves. Teach it the ones that worked and the ones that did not, with the outcome attached. | step-6 |
| notes | Notes | `[data-tour="notes"]` | top | Write what you saw, tag the pattern, and record the finding. All three go into the Findings export. | Findings are what you will cite. A run without a note is a number; a run with one is evidence. | |
| section-tabs | Three sections | `[data-tour="section-tabs"]` | bottom | Probe is one run at a time. Studies run many. Data is where you read and export what you found. | Most questions start in Probe and move right: a surprising refusal becomes a repeat run, then a framing group, then a report. | step-7 |
| export-button | Export | `[data-tip="export-button"]` | bottom | Gets this session out as JSON, CSV, a findings file, a report or a web page. | The findings file carries your notes and tags in a documented schema. The agent format is the same data shaped for a model to analyse. | |
| settings-keys | Keys | `[data-tour="settings-keys"]` | left | One provider key is enough to start. Add others to test their models or to use them as the coach. | Keys stay on this computer. In the desktop app they live in Windows Credential Manager and reach the sidecar through a pipe, never the environment. | |
| conditions-list | Conditions | `[data-tour="conditions-list"]` | top | The control has no system prompt. Each other condition is one system prompt the prompts run under. | Keep one control so the comparison has a baseline. Repeats give each cell more than one sample, which the statistics need. | |
| repeat-results | Repeat runs | `[data-tour="repeat-results"]` | top | The bar is how often each badge came up. Half and half means the rule is not a rule. | One run tells you what happened once. Ten tell you whether the model has a policy or a coin. | |
| sequence-form | Sequences | `[data-tour="sequence-form"]` | top | The coach builds a story for N turns, then delivers the probe inside it. Whittle finds the smallest N that works. | Context changes answers. The original research found refusals that disappear after a few turns of fiction. This measures where. | |
| baselines | Baselines | `[data-tour="baselines"]` | top | Save the session now. Run the same probes after a model update and compare. | Providers change models quietly. A baseline is the only way to show a rule moved. | |

### A.3 The tour (`ui/src/lib/tour/steps.ts`)

Ten steps, each `{id, anchor, title, body, requires}`. The tour runs on the Probe section with the current session; steps 4 to 6 need a run that was refused, so the tour's first step offers to send the first probe for you. The tour card is Pry's overlay card style placed with `placePopup`, with "Back", "Next" and "Close" buttons and a "step n of 10" line. `requires` names the state a step needs; when it is missing the card shows the `missing` text instead of the body and "Next" skips ahead.

| n | id | anchor | title | body |
|---|----|--------|-------|------|
| 1 | step-1 | session-switcher | Your session | One model, one system prompt, its runs. Everything in Probe belongs to the session shown here. |
| 2 | step-2 | probe-row | A probe | A prompt chosen to sit near a content rule. Pick one here or write your own with Custom prompt. |
| 3 | step-3 | send-button | Send it | Sends the probe in a fresh conversation and classifies the answer. Press Next and the tour sends this one for you. (`requires: none`; Next sends the active probe when no run exists) |
| 4 | step-4 | response-readout | The badge | Refused, Collapsed, Negotiated or Complied. Click a badge to correct it. (`requires: run`; missing: "Send a probe to see a badge.") |
| 5 | step-5 | pushback-panel | Push back | The coach drafted a reply that tests the refusal. Edit it if you like; edits count as yours. Send it. (`requires: pushback`; missing: "This one was not refused, so there is nothing to push against.") |
| 6 | step-6 | teach-coach | Teach the coach | After a pushback, save the exchange as an example. The coach reads these when drafting. (`requires: done`) |
| 7 | step-7 | section-tabs | Three sections | Probe is one run. Studies run many: framings, conditions, repeats, sequences, models, baselines. Data reads it all back. |
| 8 | step-8 | session-stats | Where you stand | Runs in this session and how they split across the four badges. It updates as you go. |
| 9 | step-9 | header-help | Help | The glossary, the methodology and the policies live under this button. Hover any dotted word for its meaning. |
| 10 | step-10 | settings-button | Settings | Keys, the local model server, the coach's default, and developer details. The red dot means no key is set yet. |

Finishing or closing sets `flinch:tour_seen`. Tips whose `tutorialStepId` the tour showed are marked seen (Pry's `coordinate.ts`).

### A.4 Methodology page (`ui/src/lib/guide/methodology.md`)

The page is the current `flinch/playbook.md` rewritten in the copy rules, with the move list from `coach.py` MOVES and the pattern names as section headings. Its sections and the first sentence of each are fixed; the implementer fills each from the playbook without adding claims the playbook does not make.

```
# How Flinch works

Flinch records what a model does at the edge of its content rules, and what changes it.
It is a research instrument. Every pushback is written or approved by a person.

## The badges
Four outcomes: Refused, Collapsed, Negotiated, Complied. (One paragraph each, from the playbook's Classification Protocol.)

## The loop
Send a probe. Read the badge. If it refused or hedged, push back once with the coach's draft or your own. Read the badge again. Note what you saw. (Expanded from the playbook.)

## What to watch for
### Flinch-then-fold
### Post-hoc justification instability
### Confidence-accuracy inversion
### Lexical versus semantic triggering
### Context position effects
### Forward projection
(Each: the playbook's text, one short paragraph.)

## The coach's moves
Specificity challenge, Equivalence probe, Projection check, Contradiction mirror, Category reductio, Reality anchor, Minimal pressure. (Each: name, what it does, the example line from coach.py.)

## From one run to a study
Repeat runs measure how stable a rule is. Framings test wording. Conditions test system prompts. Sequences test context. Model compare tests providers. Baselines test time. (One sentence each, pointing at the study.)

## Honesty
The classifier is a heuristic plus a model's judgement; correct it when it is wrong. A collapse shows the refusal was weak, not that the content was harmless. Findings are your observations, exported as such.
```

### A.5 Error rules (`ui/src/lib/errors.ts`)

`friendlyError(raw)` keeps Pry's shape. Rules, in order:

| test (regex, case-insensitive) | message |
|----|---------|
| `Anthropic API key required\|No Anthropic API key\|No LLM backend available` | "No provider key is set. Add one in Settings, then try again." |
| `Unknown model prefix` | "Flinch does not know that model id. Use one from the list, or an id starting with claude-, gpt-, gemini-, grok-, meta-llama/ or ollama:." |
| `openai package not installed\|google-genai package not installed\|pip install` | "That provider's library is not installed on the sidecar. Reinstall Flinch with the multi-model extras." |
| `weasyprint` | "PDF export needs weasyprint on the sidecar. Choose HTML instead." |
| `Missing experiment dependencies` | "Statistics need the experiment extras (scipy, numpy, krippendorff). Install them on the sidecar." |
| `Probe has \d+ run` | the server text as is (it is already plain) |
| `failed to fetch\|networkerror\|econnrefused\|not reachable` | "Flinch's sidecar is not reachable. Restart it from the chip at the top." |
| `401\|authentication\|invalid x-api-key\|incorrect api key` | "The provider rejected the key. Check it in Settings." |
| `429\|rate limit` | "The provider is rate limiting. Wait a minute and try again, or lower the pause between probes." |
| `Session not found\|Run not found\|Probe not found` | "That item no longer exists. It may have been deleted in another window." |

Unknown errors keep the server text, truncated to 160 characters, with the full text under Details. `GENERIC_ERROR`: "Something went wrong in Flinch. Try again, or restart the sidecar from the chip at the top."

### A.6 Screen lead sentences (`ui/src/lib/copy/screens.ts`)

The readouts quoted in sections 5 to 7 live here under keys `probe.idle`, `framings`, `conditions.list`, `conditions.new`, `repeat`, `sequences`, `compare`, `baselines`, `browse`, `scorecard`, `publish`, `coach`, `policies`, plus the response readouts `response.refused` … `response.unknown` and the teach-coach hints `teach.collapsed` … `teach.complied`.

## Appendix B. Feature map (nothing dropped)

Every current UI feature and every sidecar route, with its new home. "Same" means the route is called unchanged.

| Today | New home | Route(s) |
|-------|----------|----------|
| Session select, new, delete | Header session switcher, New session dialog | same |
| Probe list, search, domain filter, select mode, bulk delete | Probe rail | same |
| Load defaults, import file, add probe (incl. narrative fields) | Rail actions and dialogs | same |
| Custom prompt | Rail first row, Probe custom state | same |
| Send probe, response, classification override | Probe 5.4 to 5.5 | same |
| Coach suggestion, send as coach / override, skip | Pushback panel (one button, source by edit state) | same |
| Continue pushback | "Keep pushing" panel | same |
| Promote to example | Teach the coach this exchange | same |
| Annotations, tags, finding | Notes panel | same |
| Run history, session stats | Rail footer | same |
| Run all probes, batch view, cancel | Probe idle panel, Batch run | same, cancel now effective |
| Export dropdown (JSON, CSV, findings, report, agent, enhanced, compare) | Export dialog | same |
| HTML and PDF export with theme | Export dialog Reports group | same |
| Framing variants: files, DB groups, AI generate, manual, run, run all, results | Studies > Framings | same |
| Conditions variant files, batch-conditions | Studies > Conditions, "Import from a file" | `/batch-conditions` removed; experiments routes used |
| Experiments tab: list, wizard, dashboard, results, analysis, export | Studies > Conditions (list, new, study tabs) | same experiments routes; `/export?format=jsonl` added |
| Condition comparison dashboard: metrics, analysis, response browser, resume, CSV | Conditions > Results tab and Run tab | same; `/resume-conditions` replaced by `/resume` |
| AI raters, Prolific tasks and CSV, human-eval import (no UI today) | Conditions > Raters tab | same |
| HH-RLHF import (no UI today) | Conditions > New study | same |
| Stat analysis | Studies > Repeat runs | same, results now rendered |
| Narrative momentum: create, auto, interactive, drop probe, whittle, batch, estimate, results | Studies > Sequences | same |
| Thresholds, strategy effectiveness (no UI today) | Sequences > Results tab | same |
| Multi-model compare, history, export, review | Studies > Model compare | same |
| Snapshots: save, browse, diff, delete | Studies > Baselines | same |
| Dashboard overview, lists, detail views, export all, clear all | Data > Browse | same |
| Policy scorecard | Data > Scorecard > Across models | same |
| Compliance scorecard (no UI today) | Data > Scorecard > This session | same |
| Publication export, themes, preview, download, copy | Data > Publish | same |
| Coach examples: list, edit, delete | Data > Coach examples (plus effectiveness) | same |
| Policy browser | Guide > Policies | same |
| Link claims to probes (no UI today) | Probe card > Policy claims | same |
| Settings: keys (.env), test, Ollama, coach default | Settings drawer | same, plus Tauri key commands in the desktop app |
| Settings modal (Tauri keys) | Settings drawer Keys section | same |
| Keyboard shortcuts | Probe section, overlay | |
| Bootstrap splash (`ui/index.html`) | `/welcome/python` | same Tauri commands and events |
| Strategies CRUD routes (no UI today, builtin only) | Not given UI: the six strategies are builtin and the routes refuse edits to builtins; `GET /api/strategies` is used by Sequences | `POST/PUT/DELETE /api/strategies` kept, unused |
| `GET /api/sessions/{id}/findings`, `/export/summary`, `/api/compare` (session compare), `/api/ollama/status`, `/api/stat-runs/{id}/distribution`, `/api/comparisons/{id}` | Used by: Export (findings via `format=findings`), Browse session detail (`/export/summary` for the header counts), Export compare rows, Settings Ollama section, Repeat runs detail, Model compare view | same |
