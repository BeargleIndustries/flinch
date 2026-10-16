# Flinch component spec

Draft 1, 2026-10-16. Reads with `02-tokens.md` (tokens, type scale, states, number and copy rules) and `00-pry-vocabulary.md` (cited as `vocab §n`). Screens are named as in `01-information-architecture.md` (`IA §n`). Pry files are under `beargleindustries/pry/ui/src/lib/`.

Conventions for every section: **Matches** names the Pry file whose classes and behaviour this component copies, or says "new to Flinch" (designed in the same vocabulary). **Props** mark required with `*`; types are TypeScript. **States** give the exact classes; a state not listed does not exist for that component. **Tests** are Vitest unit tests plus the copy tests in `lib/copy/*.test.ts` that pin strings. Every draft string is "(draft; brad-voice pass)". No component renders a bare number: a percentage, confidence or effect size arrives as an object carrying its inputs, and the TypeScript types make the bare form a compile error.

Shared types (`lib/types/display.ts`):

```ts
export type Outcome = 'refused' | 'collapsed' | 'negotiated' | 'complied';
export type Label = Outcome | 'unknown';
export interface Count { count: number; of: number }                       // r of N
export interface Signed { value: number; unit: 'pts' | 'd' | 'logit' | '' } // sign always shown
export interface LabelSource { source: 'keyword' | 'judge' | 'person' | null } // one path per label, never two (classifier.py:53-60);
                                                                           // null = row older than 06-architecture §8.2, renders "source not recorded"
export type SuiteLabel = string;                                           // a benchmark suite's own outcome words (recipe.labels, benchmarks.md §1.6)
export interface Caveat { id: CaveatId; text: string }                     // CaveatId = the union generated from 08-caveats.md table 1 (06-architecture §9)
```

The classifier runs the keyword scan **or** the judge, never both: the keyword scan decides when it is sure, and the judge decides when the scan is unsure (`classifier.py:53-60`; `07-glossary.md` `classification`). Every source line, readout and caveat below says one path, and `LabelSource.source` names it; a person's change sets `'person'` (`06-architecture.md` §8.2, §8.3).

---

## 1. Shell

### 1.1 Header
Purpose: the 44 px bar on every screen; brand, session, keys, nav, help, settings. **Matches** `routes/+page.svelte:1046-1170` (vocab §1).
```
┌ ◧ Flinch │ [crime-set-1 · claude-sonnet-4-6 ▾] │ ● 2 keys set │ Probe Studies Experiments Benchmarks Library Results │ ? ⚙ ┐ 44 px
```
Props: `session?: SessionSummary | null`, `keys*: KeyStatus`, `current*: Section`. Children: none.
States: shell `flex h-11 flex-shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4`; brand `h-5 w-5 text-indigo-400` mark plus `text-sm font-semibold text-zinc-100` "Flinch" as a link to `#/`; right group `ml-auto flex items-center gap-1`. No loading or error state; children carry their own.
Keyboard: Tab order left to right; brand is a link. Screen reader: `<header>` landmark, nav inside is `<nav aria-label="Sections">`. Used on: every screen. Tests: renders all six nav items at 1024 px without truncation (DOM width assertion), session name truncates at 18 characters below 1280 (IA §2).

### 1.2 SessionSwitcher
Purpose: shows the open session and target model; opens a menu of recent sessions. **Matches** `ModelSwitcher.svelte:78-114` (vocab §5 header model pill, §2 menu alt).
Props: `session: SessionSummary | null`, `recent*: SessionSummary[]`, `onOpen*(id)`, `onNew*()`, `onAll*()`.
States: pill `flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800` with ChevronDown `h-3.5 w-3.5`; empty (no session) same pill, text "No session" in `text-zinc-500`; open: pill `bg-zinc-800`, menu `absolute z-20 mt-1 w-72 rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-lg`; menu item `flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800`, current item has Check `h-3.5 w-3.5 text-green-400`; footer items "All sessions" and "New session" above `border-t border-zinc-800`; focus `focus-visible:outline …indigo-400`. Loading: the pill shows the name with `animate-pulse` on the model text.
Keyboard: Enter/Space opens, arrows move, Escape closes and returns focus, Tab closes. Screen reader: `aria-haspopup="menu" aria-expanded`; menu `role="menu"`, items `role="menuitem"`, current `aria-current="true"`. Used on: every screen (IA §2). Tests: renders "No session" when null; selecting an item calls `onOpen` and closes; Escape returns focus to the pill; name truncation matches Header test.

### 1.3 KeyStatusChip
Purpose: how many provider keys are set; click goes to Settings › Keys. **Matches** `EngineStatusChip.svelte:94-134` (vocab §5 engine chip, §6 definition grid).
Props: `keys*: KeyRow[]` (the `keys` store list, `06-architecture.md` §5.2). `GET /api/settings/keys` returns a **bare list** `[{env_var, provider, label, required, is_set, masked}]` (app.py:2266-2277), not `{providers: [...]}`: the chip reads `keys[].is_set`, never `providers[].is_set` (critic F12). N = `keys.total` = the list length = the number of entries in `_SUPPORTED_KEYS` (app.py:2201): 5 today, 6 once `HF_TOKEN` (provider `huggingface`) joins (`06-architecture.md` §8.8); the chip never hard-codes N.
States: chip `flex items-center gap-1.5 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800` with Key `h-3.5 w-3.5` and a `h-1.5 w-1.5 rounded-full` dot: some set `bg-emerald-400`, text "2 keys set"; none set dot `bg-red-400`, text "No keys" in `text-red-300`, border `border-red-800`. Hover/focus popover `absolute z-20 mt-1 w-72 rounded-md border border-zinc-700 bg-zinc-900 p-3 text-xs shadow-xl` with the definition grid `grid grid-cols-[auto_1fr] gap-x-3 gap-y-1`, dt `text-zinc-500` provider, dd `text-zinc-200` "set" / "not set".
Keyboard: focusable button; Enter navigates; popover shows on focus/hover, Escape hides. Screen reader: `aria-describedby` to the grid; the count is the accessible name "r of N keys set" (N as above; "2 of 6 keys set" with HF_TOKEN). The popover grid is a DefinitionGrid (§33). Used on: every screen (IA §2), Home setup card reads the same data. Tests: count string "r of N keys set" pinned with N = fixture list length (a six-row fixture prints "of 6"); red state when zero; click routes to `#/settings#keys`; a fixture shaped `{providers: []}` is a TS error against `KeyRow[]`.

### 1.4 PrimaryNav
Purpose: the six section links. **Matches** `+page.svelte:1404` narrow tab strip (vocab §1).
Props: `current*: Section`, `running?: Partial<Record<Section, boolean>>` (a dot on a section with a run going, from the `runs` store; optional). No `enabled` prop: all six items are always enabled, Benchmarks included (fix rulebook §7; consistency F15). Benchmarks' prerequisites gate the Start paths inside that section (`benchmarks.md` §8.4), never the nav item.
States: item `relative -mb-px border-b-2 px-1 py-2 text-sm transition-colors`; current `border-indigo-400 text-indigo-300`; other `border-transparent text-zinc-500 hover:text-zinc-300`; running dot `ml-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse` with sr-only "running". Focus `focus-visible:outline …indigo-400`. No disabled state.
Keyboard: links, Tab between; no arrow cycling (it is a nav, not a tablist); `Alt+1…Alt+6` are **not** section keys (the shortcuts table, `02-tokens.md` §7.13, reserves `Alt+n` for tabs inside a screen). Screen reader: `<nav aria-label="Sections">`, current link `aria-current="page"`. Used on: every screen. Tests: six items in IA order; `aria-current` on the current; every item is a link in every state (no `aria-disabled` anywhere in the nav).

### 1.5 HelpMenu
Purpose: `?` opens quick tour, shortcuts, glossary, "What is Flinch". **Matches** `TourMenu.svelte:174-206` (vocab §7).
Props: `items*: { id; label; onSelect }[]`.
States: trigger is a ghost icon button (§15) with CircleHelp; menu `absolute right-0 z-50 mt-1 w-56 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl`; item `w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800`. Open state and keyboard as SessionSwitcher.
Screen reader: `aria-haspopup="menu"`, `role="menu"`. Used on: every screen (IA §3 overlays). Tests: four items pinned "(draft; brad-voice pass)": "Quick tour", "Keyboard shortcuts", "Glossary", "What is Flinch".

## 2. Layout

### 2.1 Split
Purpose: two panes with a draggable, keyboard-resizable divider. **Matches** `ResizableSplit.svelte` (vocab §1).
Props: `left*: Snippet`, `right*: Snippet`, `initialRatio = 0.25`, `minPx = 300` (280 at < 1280; the `.pane-left` class, `06-architecture.md` §11), `prefsKey*: 'probe-workbench' | 'experiment-responses' | 'benchmark-results'`.
Persistence: the ratio is read from and written to `prefs.split[prefsKey]` (`06-architecture.md` §5.7), which the `prefs` store keeps in the `flinch_prefs` cookie through `lib/persist.ts` (§6). Never `localStorage` (the sidecar port changes every desktop launch; `persist.ts` handles the browser-mode fallback internally).
States: container `flex h-full`; left `overflow-hidden` with `min-width: {minPx}px`; divider `w-1.5 flex-shrink-0 cursor-col-resize transition-colors touch-none focus:outline-none focus-visible:bg-indigo-400`, idle `bg-zinc-800 hover:bg-indigo-500/50`, dragging `bg-indigo-500`.
Keyboard: divider focusable; Left/Right 2 %, Home/End to the limits. Screen reader: `role="separator" aria-orientation="vertical" aria-valuemin=0 aria-valuemax=100 aria-valuenow aria-label="Resize panes. Left and right arrow keys move the divider."`. Used on: Probe workbench (IA §5), Experiment › Responses, Benchmark run › Results. Tests: clamps to `minPx` both sides; writes `prefs.split[prefsKey]` on pointerup only (spied `persist.set('flinch_prefs', …)`), and `localStorage` is never touched (the copy-lint grep in 06 §6); arrow keys change `aria-valuenow` by 2.

### 2.2 Tabs
Purpose: a tab strip over a scrolling body. **Matches** `TabbedPanel.svelte`.
Props: `tabs*: { id; label; title?; anchor?; count?: Count }[]`, `activeTab?` (bindable), `onTabChange?`, `children*: Snippet<[string]>`.
States: strip `flex flex-shrink-0 gap-4 border-b border-zinc-800 px-3`; tab `relative -mb-px border-b-2 px-1 py-1.5 text-xs transition-colors`; active `border-indigo-400 text-indigo-300`; inactive `border-transparent text-zinc-500 hover:text-zinc-300`; a `count` renders as a tag pill (§17) after the label; strip hidden with one tab; body `flex-1 overflow-y-auto`.
Keyboard: roving tabindex, Left/Right cycle, Home/End. Screen reader: `role="tablist" aria-label`, `role="tab" aria-selected`, body `role="tabpanel" aria-labelledby`. Used on: Experiment (Overview, Conditions, Responses, Analysis, Export), Benchmark run (Progress, Results, Compare), Settings sections at narrow widths. Tests: strip absent with one tab; arrow cycling wraps; `onTabChange` called once per change.

### 2.3 Panel
Purpose: the standard content card with heading, subtitle and a Readout slot. **Matches** `PredictionsPanel.svelte:43-49` (vocab §2 panel card, §3 panel heading).
```
┌ Heading  subtitle in zinc-600 ───────────── [actions] ┐
│ ▣ Readout (optional)                                  │
│ body …                                                │
└───────────────────────────────────────────────────────┘
```
Props: `heading*: string`, `subtitle?`, `readout?: string | null`, `actions?: Snippet`, `children*`, `variant: 'card' | 'elevated' = 'card'`, `id?`.
States: card `flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5`; elevated `rounded-xl border border-zinc-700/60 bg-zinc-900 p-5 shadow-xl`; heading row `flex items-baseline gap-2`, `text-sm font-semibold text-zinc-100`, subtitle `text-xs text-zinc-600`; actions `ml-auto flex items-center gap-2`.
Screen reader: `<section aria-labelledby={headingId}>`; Readout gets `id` so charts can `aria-describedby` it. Used on: every content screen. Tests: heading id wiring; readout slot renders the Readout component (not a plain `<p>`).

### 2.4 InsetBox
Purpose: a quieter box inside a panel for a value, a note or a sub-group. **Matches** `DLAPanel.svelte:96, 220` and `CustomModelDialog.svelte` inset (vocab §2).
Props: `variant: 'row' | 'block' | 'empty' = 'block'`, `children*`.
States: row `rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs`; block `rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs`; empty is `§2.6`. Used on: Stat, ProvenanceRecord, dialog groups, Experiment estimate. Tests: variant class snapshot.

### 2.5 Section
Purpose: a titled group inside a long screen (Settings, Library pages). **Matches** `+page.svelte:1697-1698` section divider and eyebrow (vocab §2, §3).
Props: `eyebrow*: string`, `id*: string`, `children*`, `first = false`.
States: wrapper `mt-8 border-t border-zinc-800 pt-5` (`first` drops the border and margin); eyebrow `text-[10px] font-medium uppercase tracking-widest text-zinc-500`; setting rows `flex items-center justify-between gap-4`, label `text-sm text-zinc-300`, hint `text-xs text-zinc-500`, control right.
Screen reader: `<section aria-labelledby>` with the eyebrow as an `<h2>`. Used on: Settings, Library, Results. Tests: `#id` deep link scrolls the section into view.

### 2.6 EmptyState
Purpose: says what the area is for and what to do next, in a full sentence. **Matches** `PredictionsPanel.svelte:55-56` (vocab §2 inset / empty state), text one step lighter (tokens §8.3).
Props: `text*: string` (must end in "."), `action?: { label; onClick }`, `icon?`.
States: `flex flex-col items-center justify-center gap-3 rounded-md border border-zinc-800 bg-zinc-900 py-12 text-center text-sm text-zinc-500`; action is a secondary small button (§15).
Screen reader: plain text; the action is a button. Used on: every list and pane with nothing to show (IA §5 "no probe"). Tests: copy-lint asserts every `text` ends with "." and has no em dash; drafts pinned: "Pick a probe on the left, or run all of them." / "No studies yet. Start one from a session." / "No benchmark runs yet." (draft; brad-voice pass).

## 3. Readout
Purpose: one or two plain sentences under a panel heading saying what happened. **Matches** `Readout.svelte`.
Props: `text*: string | null`, `id?`, `tone: 'info' | 'warn' = 'info'`.
States: wrapper `div.contents role="status" aria-live="polite" aria-atomic="true"` always mounted; text `rounded-md border border-indigo-900/50 bg-indigo-950/30 px-3 py-2 text-xs leading-relaxed text-zinc-300` with `sr-only` "In plain words: "; warn `border-amber-800/60 bg-amber-950/30 text-amber-200`; null text renders the wrapper only (no box). No hover or focus.
Used on: Probe workbench run column (IA §5), every study, experiment and benchmark result. Tests: live region present when text is null; prefix in DOM; sentence shapes pinned in `lib/copy/readouts.test.ts`, drafts: "The model refused. The keyword scan put it at refused." / "The model refused. The judge model put it at refused." (one or the other by `LabelSource.source`, never both; `'person'` → "The model refused. You changed the label to refused."; `null` → "The model refused. Which path labelled it was not recorded.") / "The refusal held after one pushback." / "7 of 12 runs refused; 3 collapsed after pushback; 2 complied." (draft; brad-voice pass). A sentence naming both the scan and the judge for one label is a test failure (08-caveats.md §5 item 1).

## 4. Term
Purpose: a glossary word with a dotted underline; hover or focus shows its definition. **Matches** `Term.svelte`, placement by `popup/place.ts`.
Props: `key*: GlossaryKey` (typed union of `lib/glossary` keys; an unknown key is a type error), `children?`.
States: word `cursor-help underline decoration-dotted decoration-zinc-500 underline-offset-2 focus:outline-none focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-indigo-400`; tooltip `pointer-events-none fixed z-[70] rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-zinc-200 shadow-xl`, max 256 px, `placePopup` preferred bottom, gap 6, edge pad 8, avoids occupied rects, hides (never floats) when the word is off screen; no arrow.
Keyboard: `tabindex=0`; Escape hides this tooltip only (`stopPropagation`). Screen reader: `role="term"`, `aria-describedby` to the always-present `role="tooltip"` span. Used on: every screen; first use of every real name (tokens §7.6). Tests: glossary has an entry for every key used in `lib/copy` (test walks the strings); Escape in a dialog does not close the dialog; definitions have no banned verbs.

## 5. Caveat
Purpose: the limit that travels with a result, pinned by exact phrase. **New to Flinch**; styled as Pry's note rule (vocab §7 LoadingScreen note) and the DLA total line (vocab §6).
Props: `id*: CaveatId` (the typed union generated from `08-caveats.md` table 1; text comes from `lib/copy/caveats.ts`, never free text), `n?: number` (for template ids such as `held_n`, whose phrase is a function of `n`), `variant: 'inline' | 'note' = 'inline'`, `details?: Snippet` (a `<details>` "What this is made of").
Registry: **this spec lists no caveat ids or phrases.** `08-caveats.md` is the one registry (table 1 the caveats, table 2 the hint strings that are not caveats, table 3 the retired ids); L0 creates `lib/copy/caveats.ts` from it and owns every id (`06-architecture.md` §9); a `<Caveat id="…">` with an id not in table 1 is a compile error, and a lane that needs a new id adds it to 08 first. The `classifier` phrase there says the scan **or** the judge, never both (08 §5 item 1).
States: inline `text-xs text-zinc-500` with Info `h-3 w-3` prefix, placed on the same row as the number or label; note `mt-3 border-l-2 border-indigo-500/50 pl-3 text-sm leading-relaxed text-zinc-400`; details summary `cursor-pointer text-[10px] uppercase tracking-widest text-indigo-400 hover:text-indigo-300`.
Screen reader: inline is plain text inside the same element as the value; note is `role="note"`. Used on: Rate, Stat, LabelControl, RunThread final label, CoachSuggestion, Over-time study, Benchmark results. Tests (`lib/copy/caveats.test.ts`): the registry's key set equals `08-caveats.md` table 1 exactly; every phrase is pinned by id from that table (template ids pinned with `n = 2`); the `classifier` phrase contains neither "plus" nor "agreed"; every screen fixture that renders a Rate, a LabelControl, a final label, a coach confidence or a modified benchmark contains its caveat.

## 6. Rate
Purpose: a count with its percentage, never the percentage alone. **New to Flinch**; number style from vocab §6 PredictionsPanel value.
Props: `value*: Count`, `what*: string` ("refused"), `caveat: CaveatId = 'rate_n'`, `order: 'count-first' | 'pct-first' = 'count-first'`, `size: 'sm' | 'md' = 'sm'`.
Renders `7 of 12 refused (58%)` or `58% (7 of 12 refused)` via `format.rate()` (tokens §6); sm `font-mono text-xs tabular-nums text-zinc-400`, md `text-sm text-zinc-200` with the count in `font-mono tabular-nums`. `of === 0` renders "none yet" in `text-zinc-500` with no percentage. The Caveat (inline) follows on hover of an Info icon or inline at `md`.
Screen reader: one text node "7 of 12 refused, 58 percent". Used on: Sessions list, Studies list headline, Repeat study cells, Experiment conditions, Results counts, Scorecard, workbench history strip. Tests: `Rate` without `of` is a TS error (`// @ts-expect-error` test); 1 of 300 → "<1%"; 0 of 0 → "none yet"; caveat text present.

## 7. Stat
Purpose: a headline number with the inputs it was computed from. **New to Flinch**; box from vocab §2 inset, value in large mono (tokens §2).
```
┌ EYEBROW  ⓘ ──────────────┐
│ 0.42                      │  ← font-mono text-2xl tabular-nums text-zinc-100
│ d = (m₁ − m₂) ÷ s, n 24 and 24 │  ← text-xs text-zinc-500, the formula or inputs
│ ⓘ caveat                  │
└───────────────────────────┘
```
Props: `label*: string`, `value*: { text: string; signed?: Signed }`, `madeOf*: string` (inputs sentence; required so a bare value cannot be shown), `caveat?: CaveatId`, `term?: GlossaryKey`.
States: `rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2`; label as eyebrow with Term; value; `madeOf` `mt-0.5 text-xs text-zinc-500`; signed value coloured `signed.positive` / `signed.negative` with the glyph. Loading: value `h-7 w-16 animate-pulse rounded bg-zinc-800`. Error: value "n/a" in `text-zinc-600` and `madeOf` replaced by the reason.
Used on: Experiment › Analysis (d, U, p, power), Results counts, Benchmark score (with CI), Context study threshold. Tests: `madeOf` required (TS); minus sign is U+2212; p-value formatting per tokens §6.

## 8. OutcomeBadge
Purpose: the classification word in its hue. **New to Flinch**; shape from vocab §4 verdict badge, hues from tokens §1 `outcome.*`.
Props: `label*: Label`, `size: 'xs' | 'sm' = 'xs'`, `source?: LabelSource` (adds a Term-style tooltip naming the one path: "keyword scan" / "judge model" / "you changed this" / "source not recorded" for `null`), `reason?: 'not_run' | 'unclassified' = 'unclassified'` (text of the `unknown` badge only: `not_run` → "not yet run", `unclassified` → "unclassified"; ignored for the four outcomes).
States: `inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide` (sm: `px-2 py-0.5 text-[11px]`); refused `border-red-800 bg-red-950/40 text-red-400`; collapsed `border-amber-800 bg-amber-950/40 text-amber-400`; negotiated `border-orange-800 bg-orange-950/40 text-orange-400`; complied `border-green-800 bg-green-950/40 text-green-400`; unknown `border-zinc-700 bg-zinc-900 text-zinc-400` with the `reason` text. Pending (`label` undefined while a run is in flight) is the unknown badge with `animate-pulse`. No hover, no focus unless `source` is set (then as Term). Benchmark suite labels are not OutcomeBadges: they render as a plain Chip (§17) with the suite word (`benchmark-run.md` R4).
Screen reader: the word is the content; `source` tooltip via `aria-describedby`. Used on: ProbeList rows, RunThread, Sessions and Studies lists, grids, history strip. Tests: every `Label` has a class recipe (exhaustive switch); the word is always rendered; snapshot per label and per `reason`; the `source` tooltip names exactly one path.

## 9. LabelControl
Purpose: show the label with how it was made, and let the human change it. **New to Flinch**; select from vocab §5, caveat §5.
```
Label  [REFUSED ▾]  ⓘ keyword scan   [Reset]
```
The control's own label is the word "Label"; the thing it shows and changes is the reply's **classification** (the Term on the word is `classification`, `07-glossary.md`; critic F15).
Props: `value*: L`, `labels: readonly L[] = OUTCOMES` (generic over the label set `L extends string`; default the four outcomes `['refused','collapsed','negotiated','complied']`; a benchmark suite passes its `recipe.labels` words, e.g. XSTest `['refused','partial','complied']`, `benchmarks.md` §1.6), `source*: LabelSource`, `onChange?(label: L)`, `readonly?: { reason: string }` (no select; the value renders as a badge or Chip with the reason inline), `disabled?: { reason: string }`.
Rule: on benchmark screens the control is **always** `readonly` (Round 5.2 removed human overrides on benchmark samples; the judge is the suite's recipe) and the value renders as a plain Chip, not an OutcomeBadge; `onChange` is required whenever `readonly` is absent (TS: a discriminated union of the two shapes).
States: row `flex flex-wrap items-center gap-2 text-xs`; label `text-zinc-500`; select `rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none` whose current option is coloured by the OutcomeBadge text class (four outcomes) or plain `text-zinc-300` (suite labels); source line `text-zinc-500` naming the one path that produced the label: `'keyword'` → "keyword scan", `'judge'` → "judge model", `'person'` → "you changed this to {value}" in `text-indigo-300` with Reset (a text link button that re-sends the stored machine label; Reset is absent when no machine label exists), `null` → "source not recorded" (`label_source_unknown`, 08-caveats.md); never two paths on one line. Caveat `classifier` inline (keyword or judge, never both). Writes: the workbench calls `PATCH /api/run-turns/{turn_id}/classification` (`06-architecture.md` §8.3); Experiment › Responses calls `PATCH /api/experiments/{id}/responses/{rid}/classification` (§8.4); both set `source` to `'person'` on success; disabled shows the reason inline.
Keyboard: native select. Screen reader: `<label for>`; a change announces "Label changed to collapsed" via a polite live region. Used on: Probe workbench response state (IA §5) on every model turn, Experiment › Responses, Benchmark per-sample table (read-only, suite labels). Tests: caveat phrase present; `source: 'person'` renders "you changed this to" and Reset; `source: null` renders "source not recorded"; the source line never contains both "keyword" and "judge"; `labels` default is the four outcomes and a suite list renders Chips; `readonly` renders no `<select>`; `onChange` not called when the same value is picked; a `value` outside `labels` is a TS error.

## 10. Bar
Purpose: one value on a 0 to 100 % track, never rescaled, plus an "everything else" row when it is a share. **Matches** `PredictionsPanel.svelte:74-138` (vocab §6).
```
        0%            50%           100%
 1  refused   ████████░░░░░░░░░░░░   58% (7 of 12)
    everything else ░░░░░░░░░░░░░   42% (5 of 12)
```
Props: `rows*: { key; label: string; value: Count; rank?: number; tone?: 'accent' | 'muted' | Outcome }[]`, `rest?: Count` ("everything else"), `scale = true`, `onSelect?(key)`.
States: scale header `flex justify-between text-[10px] text-zinc-600`; row `flex items-center gap-3 rounded-md px-3 py-1.5` (`hover:bg-zinc-900/60` when selectable, selected `bg-zinc-800/80`); rank `h-5 w-5 rounded text-[10px] font-bold` (rank 1 `bg-indigo-600 text-white`, others `bg-zinc-800 text-zinc-500`); label `w-28 truncate font-mono text-xs text-zinc-200`; track `h-2 w-full overflow-hidden rounded-full bg-zinc-800`; fill `h-full rounded-full transition-all` (accent `bg-indigo-500`, muted `bg-zinc-600`, outcome `bg-{hue}-500`); value `w-36 text-right font-mono text-xs text-zinc-400` from `format.rate()`; rest row `border-t border-zinc-800`, label `text-xs text-zinc-400`, fill `bg-zinc-700`. At container ≤ 440 px the value wraps under the track.
Keyboard: rows are buttons when `onSelect` is set. Screen reader: each row `role="img" aria-label="refused, 7 of 12, 58 percent"`; selectable rows are buttons with that name. Used on: Repeat study, Experiment conditions, Scorecard, Results overview, Benchmark results. Tests: fill width equals `count/of*100` (no rescale); rest equals `of − sum`; a `rows` entry without `of` is a TS error.

## 11. DivergingBar
Purpose: a signed value drawn from a centre line. **Matches** `DLAPanel.svelte:153-236` (vocab §6), colours `signed.*`.
Props: `rows*: { key; label; value: Signed; madeOf: string }[]`, `max?: number` (shared scale; default max |value|), `legend = true`.
States: row `flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-900/60`; label `w-24 font-mono text-xs text-zinc-200`; a 16 px track with a centre hairline `bg-zinc-800`; positive fill right `bg-[#56b4e9] opacity-75 rounded-r`, negative left `bg-[#e69f00] opacity-75 rounded-l`; value `w-16 text-right font-mono text-[10px]` in the signed colour with "+" or "−" glyph; legend `text-[10px] text-zinc-500` with `h-2 w-4 rounded-sm` swatches "more refusal" / "less refusal"; total line below as InsetBox row with the `madeOf` sentence.
Screen reader: row `aria-label="specificity challenge, plus 14 points"`. Used on: Framing study, Benchmark › Compare (paired differences), Over-time study per-probe moves, Experiment › Conditions deltas. Tests: glyph always present; U+2212 for negatives; colour class matches sign; zero draws no fill and prints "0".

## 12. Table
Purpose: sortable rows with right-aligned mono number columns. **Matches** lesson table cells (vocab §6) and ComparePanel column headers (`docs/screenshots/compare.png`).
Props: `columns*: { key; label; kind: 'text' | 'number' | 'signed' | 'badge' | 'rate'; sortable?; width? }[]`, `rows*: Record<string, unknown>[]`, `sort?: { key; dir }` (bindable), `rowKey*`, `onRowClick?`, `empty*: string`, `caption*: string`.
States: table `w-full border-collapse text-xs`; th `border-b border-zinc-800 px-2 py-1 text-left font-medium text-zinc-500` (`text-right` for number kinds), sortable th is a button with ChevronDown rotated by dir and `hover:text-zinc-300`, sorted `text-zinc-200`; td `border-b border-zinc-800 px-2 py-1 text-zinc-200`; number/signed cells `text-right font-mono tabular-nums`; badge cells render OutcomeBadge; rate cells render Rate; clickable rows `hover:bg-zinc-900/60 cursor-pointer`, selected `bg-zinc-800/80`; empty renders EmptyState inside a full-width td; loading three rows of `animate-pulse` cells.
Keyboard: sortable headers are buttons; clickable rows are focusable with Enter. Screen reader: `<caption class="sr-only">`, `aria-sort` on the sorted th, number cells carry the formatted text. Used on: Sessions, Studies, Experiments, Benchmarks lists; Models study grid; per-sample table; Scorecard; Analysis metrics. Tests: `aria-sort` toggles; number kinds right-aligned; a `rate` column requires `Count` values (TS).

## 13. List / Row
Purpose: a vertical list of selectable rows (probes, runs, conditions, examples). **Matches** `PresetList.svelte:73` preset row and `PredictionsPanel.svelte:92` selected row (vocab §2, §4).
Props: `items*`, `selected?` (bindable, single or `Set` in select mode), `selectMode = false`, `renderRow*: Snippet<[item]>`, `onActivate?`, `group?: (item) => string` (headed groups).
States: group head `sticky top-0 bg-zinc-950 px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500`; row `flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-900/60`; selected `bg-zinc-800/80`; current (keyboard cursor) `ring-1 ring-inset ring-indigo-500/50`; select mode adds a checkbox `accent-indigo-500` at the left; disabled row `opacity-50`.
Keyboard: `role="listbox"` roving focus, Up/Down, Home/End, type-ahead on the label, Space toggles in select mode, Enter activates. Screen reader: `role="option" aria-selected`; groups `role="group" aria-label`. Used on: ProbeList, Library lists, Experiment conditions, Coach examples. Tests: type-ahead; `aria-selected` tracks state; select mode exposes `aria-multiselectable`.

## 14. Card
Purpose: an entry card (Home questions, suite cards, study type picker). **Matches** `FeatureCard.svelte:81` (vocab §2 feature card).
Props: `title*`, `body*: string` (one sentence), `href?` or `onClick?`, `eyebrow?`, `meta?: Snippet` (counts, badges), `disabled?: { reason }`.
States: `block rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-left transition-colors hover:border-indigo-500/40`; title `text-sm font-semibold text-zinc-100`; body `mt-1 text-xs leading-relaxed text-zinc-400`; eyebrow as tokens §2; focus `focus-visible:outline …indigo-400`; disabled `opacity-50` with the reason `mt-2 text-xs text-zinc-500`, not clickable.
Screen reader: an `<a>` or `<button>` whose name is the title. Used on: Home, Studies › New, Benchmarks catalog, Results recent. Tests: disabled card has no `href`; body ends with "." (copy-lint).

## 15. Button
Purpose: every click target with a label. **Matches** vocab §5 (primary at indigo-600 per tokens §8.1).
Props: `variant*: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'text'`, `size: 'sm' | 'md' = 'md'`, `icon?`, `loading?: { label: string }` ("Sending…"), `disabled?: boolean | { reason: string }`, `type = 'button'`, `pressed?`.
| Variant | md | sm |
|---|---|---|
| primary | `rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500` | `rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500` |
| secondary | `rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700` | `… px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200` |
| outline | `rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800` | `… px-2.5 py-1 text-xs` |
| ghost | `flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100` | `… text-xs`; icon-only `rounded-md p-1.5` |
| danger | `rounded-md border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300 hover:bg-red-900` | `rounded bg-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-800` |
| text | `text-sm text-zinc-400 hover:text-zinc-200 underline-offset-2 hover:underline` | `text-xs` |
All: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-50` (ghost icon `disabled:opacity-30`); `pressed` adds `border-indigo-600 bg-indigo-950/40 text-indigo-300`; loading swaps the icon for the spinner `inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent` (zinc-400 border on non-primary), sets the label to `loading.label`, `aria-busy`; a disabled object renders the reason as `text-xs text-zinc-500` beside the button (wrapper `inline-flex items-center gap-2`).
Keyboard: native. Screen reader: `aria-pressed` when `pressed` is defined; disabled-with-reason uses `aria-disabled` and `aria-describedby` to the reason so it is still focusable and readable. Used on: everywhere. Tests: snapshot per variant × size; disabled reason rendered and focusable; loading label replaces the label and ends with "…".

## 16. Input, Textarea, Select, Checkbox, Slider, Segmented
Purpose: form controls, native where Pry is native. **Matches** vocab §5 inputs, selects, checkbox and slider, segmented toggle (`PanelA.svelte:871`).
Common props: `label*` (visible unless `hideLabel` with `aria-label`), `hint?`, `error?: string`, `disabled?`, `required?`, `value` (bindable), `id`.
| Control | Default classes |
|---|---|
| Input | `w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500`; header variant `rounded py-1`; number `w-20 font-mono` |
| Textarea | `w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 … focus:border-indigo-500`, `rows` prop, auto-grow to 12 rows |
| Select | native `rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none`; mono variant `bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-200` |
| Checkbox | native `accent-indigo-500`, label `text-sm text-zinc-300` in `flex items-center gap-2` |
| Slider | native range `accent-indigo-500 w-full`; above: label `text-xs font-medium text-zinc-400` and value `text-xs tabular-nums text-zinc-300` in `flex justify-between`; end labels `text-[10px] text-zinc-600` |
| Segmented | group `flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/60 p-0.5`; option `rounded px-2 py-0.5 text-xs transition-all`; active `bg-indigo-600 text-white` (tokens §8.1: Pry's indigo-500 is 4.47 : 1 with white and fails AA; `accent.DEFAULT`); inactive `text-zinc-400 hover:text-zinc-200` |
Label `text-xs font-medium uppercase tracking-wide text-zinc-500` above (`mb-1`); hint `mt-1 text-xs text-zinc-500`; error: control `border-red-800 bg-red-950/40`, message `mt-1 text-xs text-red-400` linked by `aria-describedby`, `aria-invalid`; disabled `opacity-50 cursor-not-allowed`.
Keyboard: native; Segmented is `role="radiogroup"` with arrow keys. Screen reader: `<label for>` always; slider `aria-valuetext` with the unit. Used on: New session, Add probe, New study/experiment/benchmark, Settings, manual pushback box. Tests: label association; error wiring; Segmented arrow keys and active class `bg-indigo-600`; slider valuetext.

## 17. Chip / Pill / Tag
Purpose: small inline markers. **Matches** vocab §5 chips and pills.
Props: `kind*: 'tag' | 'chip' | 'count' | 'standard' | 'modified'`, `text*`, `selected?`, `onClick?`, `onRemove?`.
States: tag `rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300`; chip `flex-shrink-0 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-300 hover:border-zinc-500`, selected `border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50`; count `rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-zinc-400`; standard `rounded border border-green-700 bg-green-900/40 px-1.5 py-0.5 text-[10px] text-green-300` "standard"; modified `rounded border border-yellow-700 bg-yellow-900/40 px-1.5 py-0.5 text-[10px] text-yellow-300` "modified"; removable adds X `h-3 w-3` button "Remove {text}".
Keyboard: chips with `onClick` are buttons; strips `flex h-9 items-center gap-1.5 overflow-x-auto whitespace-nowrap` scroll with arrow keys via roving focus. Used on: domain and tag filters, model pickers, Benchmarks (standard/modified), Tabs counts. Tests: standard/modified words pinned; selected chip `aria-pressed`.

## 18. Dialog
Purpose: a modal; `confirm` variant needs the typed phrase. **Matches** `CustomModelDialog.svelte:140-289` (vocab §8); gate dialog for `confirm`.
```
┌ Title                                    ┐
│ intro text-xs text-zinc-400              │
│ [inset groups / form]                    │
│                       [Cancel] [Primary] │
└──────────────────────────────────────────┘
```
Props: `open*` (bindable), `title*`, `size: 'md' | 'wide' = 'md'`, `intro?`, `primary*: { label; onClick; disabled?; loading?; danger? }`, `cancelLabel = 'Cancel'`, `confirm?: { phrase: string; prompt: string }`, `children*`, `onClose*`.
States: overlay `fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-8` (`fade 150ms`); panel `w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl` (wide `max-w-4xl`, overlay `items-start py-10 bg-black/70`); title `text-base font-semibold text-zinc-100`; intro `mt-1 text-xs text-zinc-400`; footer `mt-6 flex justify-end gap-2`; confirm variant: panel `rounded-xl border-zinc-800 p-5`, an Input labelled `prompt` ("Type delete everything to continue"), primary is `danger` and disabled until `value === phrase`; loading primary shows the spinner; error line `mt-3 text-xs text-red-400 role="alert"`.
Keyboard: focus trapped; initial focus on the first field or the primary; Escape closes (not while loading); Tab cycles. Screen reader: `role="dialog" aria-modal="true" aria-labelledby aria-describedby={intro}`; background `inert`. Used on: New session, Add/Import probe, Shortcuts, Results › clear everything (typed), delete session (typed name). Tests: focus trap; Escape returns focus to the opener; confirm primary disabled until exact match (case-sensitive); no native `confirm()`/`prompt()` anywhere (lint).

## 19. Drawer
Purpose: a right-side panel for secondary detail (run detail from a list, Settings sub-forms at narrow widths). **Matches** `SettingsDrawer.svelte:46-75` (vocab §8).
Props: `open*` (bindable), `title*`, `children*`, `onClose*`, `width = 440`.
States: backdrop `fixed inset-0 z-30 bg-black/50` (`fade 150ms`); panel `fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl` (`fly x:440 200ms`); header `flex items-center justify-between border-b border-zinc-800 px-5 py-4` with the title and a ghost X; body `flex-1 overflow-y-auto px-5 py-5`.
Keyboard: focus trap, Escape closes. Screen reader: `role="dialog" aria-modal="true" aria-labelledby`. Used on: Studies and Experiments lists (row detail), Benchmark per-sample detail, Library probe detail. Tests: transitions skipped under reduced motion; Escape closes; scroll stays inside the body.

## 20. Menu / Popover
Purpose: a dropdown of actions, or an anchored info panel. **Matches** `TourMenu.svelte:189` menu, `EngineStatusChip.svelte:117` popover (vocab §2, §7).
Props: `trigger*: Snippet`, `items?: { label; onSelect; danger?; disabled?: { reason } }[]` (menu) or `children` (popover), `placement = 'bottom-end'`, `width = 'w-56'`.
States: menu `absolute z-50 mt-1 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl`; item `flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800`, danger `text-red-300`, disabled `opacity-50` with the reason as a second line `text-[10px] text-zinc-500`; separator `my-1 border-t border-zinc-800`; popover `absolute z-50 w-72 rounded-md border border-zinc-700 bg-zinc-900 p-3 text-xs shadow-xl`, placed by `placePopup` (gap 10, edge 12).
Keyboard: menu `role="menu"` arrows/Home/End/Escape/type-ahead; popover opens on click, Escape closes. Screen reader: trigger `aria-haspopup aria-expanded aria-controls`. Used on: workbench "⋯" run menu, list row menus, ProbeList add/import menu, KeyStatusChip. Tests: menu closes on select; focus returns to the trigger; off-screen placement flips.

## 21. Toast
Purpose: a transient message for a completed or failed action. **New to Flinch**; surfaces from vocab §4 semantic banners.
Props (store API `toast.show({ tone, text, action? })`): `tone*: 'info' | 'success' | 'error'`, `text*`, `action?: { label; onClick }`, `timeout = 6000` (error: no timeout).
States: stack `fixed bottom-4 right-4 z-50 flex flex-col gap-2`; toast `flex items-start gap-3 rounded-md border px-3 py-2 text-sm shadow-xl` (`fly y:8 150ms`); info `border-zinc-700 bg-zinc-900 text-zinc-200`; success `border-emerald-800 bg-emerald-950/40 text-emerald-200`; error `border-red-800 bg-red-950/40 text-red-300` with AlertTriangle `h-4 w-4`; action is a text button; close ghost X.
Keyboard: F8 moves focus to the newest toast (documented in Shortcuts); Escape dismisses the focused one. Screen reader: info/success in a `role="status" aria-live="polite"` region, error in `role="alert"`. Used on: every save, export, delete, failed request (IA §4 "Error toast"). Tests: error toasts persist; polite vs assertive region by tone; text ends with "."

## 22. FirstTimeTip (+ Pointer)
Purpose: a one-shot explanation anchored to a control the first time it is usable. **Matches** `FirstTimeTip.svelte` and `Pointer.svelte` (vocab §7).
Props: registry entries `{ id; target: string (CSS selector, `data-tip="…"`); title; blurb; why?; placement: Side; focus? }`. Seen state lives in the `tips` store (`06-architecture.md` §5.6), which persists the id set through `lib/persist.ts` as the `flinch_tips` cookie (§6; 1 500 bytes); `markSeen(id)` is the only writer and `reset()` ("Show tips again" in the Help menu) the only clearer. Never `localStorage` (the sidecar port changes every desktop launch; `persist.ts` handles the browser-mode fallback internally). Tip ids use one namespace, `section.screen.name` (`probe.workbench.send`, `studies.new.whittle`, `benchmarks.run.closing`; consistency F37): the screen specs' short prefixes (`wb.`, `ns.`, `pa.`, `experiment-new.`, …) map to these at registry time in a mapping column, and the registry is the id of record.
States: card `fixed z-[60] rounded-lg border border-indigo-700/60 bg-zinc-900 p-3 shadow-xl`, 320 px (min 220); title `text-[10px] font-semibold uppercase tracking-widest text-indigo-300`; blurb `mt-1 text-xs leading-relaxed text-zinc-200`; dismiss `shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100` "×"; "why?" / "less" `mt-2 text-[10px] uppercase tracking-widest text-indigo-400 hover:text-indigo-300`, body `mt-2 text-xs leading-relaxed text-zinc-400`; caret 12 px rotated square, zinc-900 fill, `rgba(67,56,202,.6)` border, offset −7 px on the facing edge; Pointer SVG ring `rx=7`, stroke `rgb(129 140 248)` width 2, pad 4, `animate-ring-pulse`; dashed `5 4` arrow with a triangle head when `arrowLen ≤ 160`.
Behaviour: one tip at a time; waits while the target is hidden, disabled or covered; dismissed when the target scrolls out (IntersectionObserver < 0.1); suppressed during the tour and the LoadingScreen; placed with `placePopup` (`anchored` → narrower → `inset` → hide); Escape, click outside or "×" marks it seen and returns focus to the target.
Screen reader: `role="dialog" aria-modal="false" aria-labelledby`; the target gets `aria-describedby` to the tip while shown, restored after. Used on: Probe workbench (Send, label control, coach card, Run all), Studies › New, Benchmarks › New, Settings › Keys. Tests: registry titles are sentence case and ≤ 40 chars; blurbs have no banned verbs; a hidden target never shows a tip; seen state round-trips through `persist.get('flinch_tips')` (spied) and the set stays under 1 500 bytes with every registered id; every registry id matches `/^[a-z]+\.[a-z-]+\.[a-z-]+$/`; audit at 1280×800 and 1024×700 asserts no `fallback` placement for any registered tip (pre-read §2.6).

## 23. Tour card
Purpose: a stepped walk-through of a screen ("Quick tour"). **Matches** `lessons/OverlayPresenter.svelte:313-370` (vocab §7).
Props: `steps*: { target; title; body; focus? }[]`, `open*` (bindable), `onDone*`.
States: card `fixed z-50 w-[400px] rounded-lg border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur` (`top/left 150ms ease`); sheet mode below 760 px: full width at the bottom, `max-h-[45vh]`; header `border-b border-zinc-800 px-4 py-3` with eyebrow "Step n of N" (`text-[10px] font-semibold uppercase tracking-widest text-indigo-300`) and `text-sm font-medium text-zinc-100` title; body `px-4 py-3 text-sm leading-relaxed text-zinc-200`; footer `flex items-center justify-between border-t border-zinc-800 px-4 py-2`: "Skip tour" `text-[11px] text-zinc-500 hover:text-zinc-300`, Back (secondary sm), Next (primary sm, "Done" on the last); Pointer ring on the target (z-49); page stays usable.
Keyboard: Left/Right or Back/Next, Escape skips, focus moves into the card on open and back to the trigger on close. Screen reader: `role="dialog" aria-modal="false" aria-labelledby`; step change announced via the title. Used on: Help › Quick tour over the Probe workbench; a shorter tour per section. Tests: step counter "n of N"; sheet mode at 720 px; `onDone` on the last Next and on Skip.

## 24. LoadingScreen / Progress
Purpose: a full-pane wait that says what it is doing, with a step list, elapsed time and cancel. **Matches** `LoadingScreen.svelte` (vocab §7; the SVG stack is Pry's and is not reproduced); the inline Progress bar matches `UpdateCard.svelte:60-82`.
```
LOADING MODEL ──────────────────────── 0:15
Setup name (hero)
Stage text…
████████░░░░░░░░░░░░░░░░ 25%            ETA or "No estimate yet. Flinch is timing this for next time"
● Current step                       15 s
○ Next step
✓ Done step                           3 s
│ note
[Cancel]
```
Props (screen): `track*: { startedAt; steps: { id; label; status: 'done' | 'current' | 'next'; seconds: number | null }[]; fraction: number; message?; etaSeconds?: number | null }`, `title*`, `onCancel?`. Props (Progress): `value*: Count | { fraction: number; text: string }`, `label*`, `size: 'sm' | 'md' = 'sm'`.
States: overlay `absolute inset-0 z-10 overflow-y-auto bg-zinc-950` (fade 360 ms); eyebrow `font-mono flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-indigo-300/80` with `h-px flex-1 bg-zinc-800` rule and elapsed `tabular-nums tracking-normal text-zinc-400`; hero `font-display mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl`; stage `mt-2 text-lg text-zinc-200`; bar `relative h-2 overflow-hidden rounded-full bg-zinc-800/80`, fill `absolute inset-y-0 left-0 origin-left rounded-full bg-gradient-to-r from-indigo-600 via-indigo-400 to-indigo-200` scaled by `fraction`, monotonic (never moves back); `%` and ETA `font-mono mt-2 flex justify-between text-xs text-zinc-400`; step list `mt-5 space-y-1.5 text-sm`, done `text-zinc-400` with Check `h-3.5 w-3.5 text-indigo-400`, current `text-zinc-100` with `h-2 w-2 rounded-full bg-indigo-400 animate-breathe`, next `text-zinc-500` with `h-2 w-2 rounded-full border border-zinc-600`, seconds `font-mono text-xs tabular-nums text-zinc-500`; note `mt-4 border-l-2 border-indigo-500/50 pl-3 text-sm leading-relaxed text-zinc-400`; Cancel secondary sm. Inline Progress: `h-1.5 w-full overflow-hidden rounded-full bg-zinc-800`, fill `bg-gradient-to-r from-indigo-500 to-indigo-300 motion-safe:transition-[width] motion-safe:duration-300`, text `font-mono text-xs tabular-nums text-zinc-400` beside it.
Screen reader: `role="progressbar" aria-valuemin=0 aria-valuemax=100 aria-valuenow aria-valuetext="25 percent, about 40 s left"`; stage changes announced through a polite region at most every 3 s; steps carry sr-only "(done)/(now)/(next)". Reduced motion: no breathe, no sheen, fill snaps. Used on: first-launch bootstrap (Tauri `ui/index.html` replaced by this), model warm-up, Benchmark prerequisites install, "running all" mode (IA §5). Tests: fraction never decreases for one `startedAt`; ETA text pinned "No estimate yet. Flinch is timing this for next time" (draft; brad-voice pass); Cancel present whenever `onCancel` is set; `aria-valuetext` format.

## 25. ProbeList
Purpose: the left pane of the Probe workbench: every probe in the session, grouped by domain, with its latest outcome. **New to Flinch**; built from List (§13), OutcomeBadge (§8), Input (§16), Chip (§17), Menu (§20), panel heading (upper) from vocab §3.
```
┌ PROBES  4 · 3 run            [⋯] ┐  ← heading row: text-sm font-semibold uppercase tracking-widest text-zinc-400; count tag
│ [search…           ] [domain ▾]  │
│ + Ad-hoc probe                   │  ← dashed add row
│ CRIME                            │  ← group head
│ ▸ the-stabbing          REFUSED  │  ← selected row, badge right
│   the-robbery           ·        │  ← unknown badge "not yet run" collapses to "·" with title
│ MEDICAL                          │
│   the-autopsy           COMPLIED │
│ ───────────────────────────────  │
│ [Run all 4]  [Select…]           │  ← footer, border-t
└──────────────────────────────────┘
```
Props: `probes*: { id; slug; domain; text; tags; latest: Label; runs: number }[]`, `selected?` (bindable), `selectMode` (bindable), `checked: Set<string>` (bindable), `onRunAll*(ids)`, `onAdHoc*()`, `onAdd*()`, `onImport*()`, `onLoadDefaults*()`, `onRemove*(id)`, `query` (bindable), `domain` (bindable), `busy?: boolean` (while running all).
States: pane `flex h-full flex-col border-r border-zinc-800 bg-zinc-950`; heading row `flex items-center gap-2 px-4 py-3`; counts `font-mono text-[11px] tabular-nums text-zinc-500` "4 · 3 run" (Rate semantics: run count of total); search Input header variant with Search icon; domain Select; ad-hoc row `mx-3 rounded-md border border-dashed border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500 hover:border-indigo-600 hover:text-indigo-400`; rows as List with `text-xs`, slug `font-mono text-zinc-200 truncate`, badge `ml-auto`; selected row `bg-zinc-800/80`; running row (in batch) badge pending; hover reveals a ghost X "Remove from session" (ghost icon sm); footer `mt-auto flex items-center gap-2 border-t border-zinc-800 px-3 py-2`, Run all (primary sm, label "Run all N", disabled with reason when no key or `busy`), Select… (outline sm) toggling select mode where the footer becomes "Run selected k" / "Remove k" / "Cancel"; empty (no probes) EmptyState "No probes in this session yet. Add one, import a file, or load the defaults." (draft; brad-voice pass) with a Menu for the three; filtered-empty "No probe matches that search." Loading: six `animate-pulse` rows.
Keyboard: search focused by `/`; list as §13; Delete key on a focused row prompts removal via Dialog. Screen reader: pane `role="region" aria-label="Probes"`; list `role="listbox" aria-label="Probes in this session"`; row name "the-stabbing, crime, refused, 3 runs"; counts live region updates after a batch. Used on: Probe workbench (IA §5); Library › Probes reuses the rows without the session footer. Tests: grouping is by domain in alphabetical order with the selected probe's group open; filter by domain and query combine; "Run all N" count equals visible probes; select-mode footer labels pinned; 280 px width at 1024 shows no horizontal scroll.

## 26. RunThread
Purpose: one run as a conversation: probe, model reply, pushback, reply, each turn labelled and timed. **New to Flinch**; turn boxes from vocab §2 inset box and today's `.response-text`, eyebrows from vocab §3.
```
┌ PROBE · the-stabbing                              ┐
│ Write a scene from a thriller novel…    [show all]│
├ MODEL · claude-sonnet-4-6          2.1 s · 412 tok┤
│ I'm not able to write a scene that…               │
│ Label [REFUSED ▾] ⓘ keyword scan + judge          │
├ PUSHBACK · specificity challenge · coach           ┤
│ "What specifically in the request concerns you?"  │
├ MODEL                              1.8 s · 380 tok┤
│ …                                                 │
│ Label [REFUSED ▾]  ⓘ held after one pushback      │
└ final: REFUSED · [Annotate] [Promote to example] [Export] ┘
```
Props: `turns*: ({ kind: 'probe'; slug; text } | { kind: 'model'; model: string; text; seconds: number; tokens: number; label: Label; source: LabelSource; onLabel(l) } | { kind: 'pushback'; move: PushbackMove | 'manual'; text; source: 'coach' | 'override' | 'skip' })[]`, `final?: { label: Label; caveat: CaveatId }`, `actions?: Snippet`, `collapsedAt = 200` (px).
States: thread `flex flex-col gap-3`; turn `rounded-md border border-zinc-800 bg-zinc-900/60`; turn header `flex items-center gap-2 border-b border-zinc-800 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-zinc-500` with the kind, the model or move name as a Term in `normal-case tracking-normal font-mono text-zinc-300`, and timing `ml-auto font-mono tabular-nums text-zinc-500` "2.1 s · 412 tokens"; probe text `px-3 py-2 text-sm text-zinc-300`; model text `px-3 py-2 font-mono text-xs leading-[1.85] text-zinc-300 whitespace-pre-wrap`, collapsed at 200 px with a bottom fade `bg-gradient-to-t from-zinc-900` and a "Show all" text button; pushback text `px-3 py-2 text-sm text-zinc-200 border-l-2 border-indigo-500/50`; model turn footer holds LabelControl; final row `flex flex-wrap items-center gap-2 pt-2 text-xs text-zinc-400` with "final:" plus OutcomeBadge sm and the Caveat (`held_once`); streaming turn: text grows, header shows the spinner and "Waiting…" with elapsed; error turn `border-red-800 bg-red-950/40` with the message and a Retry danger sm button; empty (no turns) is not rendered (the workbench shows EmptyState).
Keyboard: "Show all" is a button; turns are plain content; Tab reaches each LabelControl in order. Screen reader: thread `role="log" aria-live="polite" aria-relevant="additions"` so a new turn is read once; each turn is an `<article aria-label="Model reply, refused, 2.1 seconds">`. Used on: Probe workbench response and after-pushback states, `#/probe/:s/run/:r`, Context study conversation, Experiment › Responses detail, Drawer detail from lists. Tests: timing format; a model turn without `label`/`source` is a TS error; collapse threshold; final caveat phrase present when `final` is set; streaming turn shows elapsed, not a fake percent.

## 27. CoachSuggestion card
Purpose: the coach's proposed pushback, its move, and the three choices: send, write my own, skip. **New to Flinch**; card from vocab §2 elevated, eyebrow accent from vocab §3, buttons §15.
```
┌ COACH SUGGESTS · specificity challenge · confidence 0.8 ⓘ ┐
│ "What specifically in the request concerns you?"          │
│ why: the refusal named no specific harm                   │
│ [Send this pushback]  [Write my own]  [Skip]              │
│ ⓘ The coach's confidence is the coach model's own guess.  │
└───────────────────────────────────────────────────────────┘
```
Props: `suggestion*: { move: PushbackMove; text: string; confidence: { value: number; madeOf: 'coach_self_report' }; rationale?: string; backend: string }`, `onSend*()`, `onWriteOwn*()`, `onSkip*()`, `busy?: 'sending' | 'thinking'`, `draft?: string` (bindable; the manual box).
States: card `rounded-lg border border-indigo-900/50 bg-indigo-950/20 p-4`; eyebrow `flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-indigo-300` with the move as a Term and "confidence 0.8" in `font-mono normal-case tracking-normal text-zinc-400`; text `mt-2 text-sm leading-relaxed text-zinc-200`; rationale `mt-1 text-xs text-zinc-400`; buttons `mt-3 flex flex-wrap gap-2`: Send (primary sm, loading "Sending…"), Write my own (secondary sm), Skip (text sm); Caveat `coach_conf` inline below; `thinking` state shows the eyebrow "COACH IS WORKING…" with the spinner and three `animate-pulse` lines, Skip still enabled; "write my own" swaps the text for a Textarea (`rows=3`, label "Your pushback") with a move Select ("manual" default) and Send/Cancel; error state `border-red-800 bg-red-950/40` with the message and Retry; the coach disabled (no coach backend) shows the manual box only with the reason.
Keyboard: Ctrl+Enter sends from the textarea; Escape cancels "write my own". Screen reader: `<section aria-labelledby>` "Coach suggests"; arrival announced via the Readout live region, not this card. Used on: Probe workbench response state (IA §5), Context study turn. Tests: `confidence` requires `madeOf` (TS); the caveat phrase present; move names are the seven enum values plus manual, each a Term; Skip always enabled unless `busy === 'sending'`.

## 28. ProgressCard
Purpose: the running state of a batch, experiment or benchmark run: counts so far, the current item, elapsed, cost, pause/resume/cancel. **New to Flinch**; combines Progress (§24), Rate (§6), InsetBox (§4), Button (§15).
```
┌ RUNNING · experiment "tone-vs-none"                 0:42 ┐
│ ████████████░░░░░░░░░░░░░  18 of 60 done                 │
│ refused 11 · collapsed 3 · negotiated 1 · complied 3     │
│ now: the-stabbing × condition B × claude-sonnet-4-6      │
│ cost so far about $0.31 · 2 failed (retry queued)        │
│ [Pause] [Cancel]                                         │
└──────────────────────────────────────────────────────────┘
```
Props: `kind*: 'batch' | 'experiment' | 'benchmark'`, `title*`, `done*: Count`, `outcomes?: Record<Outcome, number>`, `current?: string`, `startedAt*: number`, `cost?: { value: number; estimated: boolean }`, `failed?: Count`, `status*: 'running' | 'paused' | 'done' | 'failed' | 'cancelled'`, `onPause?`, `onResume?`, `onCancel*`.
States: card `rounded-lg border border-zinc-800 bg-zinc-950 p-5`; eyebrow accent with status and the title, elapsed `ml-auto font-mono tabular-nums text-zinc-400`; Progress md with "18 of 60 done" (Rate count-first; a percent only beside it); outcome counts as four OutcomeBadge xs each followed by `font-mono tabular-nums text-zinc-300`; current line `text-xs text-zinc-400` with `animate-pulse` dot; cost line `text-xs text-zinc-500` ("about" when estimated); failed `text-amber-400`; paused: eyebrow "PAUSED", bar static, Resume primary sm; done: eyebrow "DONE" in `text-emerald-400`, buttons replaced by "View results" primary sm; cancelled/failed: eyebrow in `text-red-400`, reason line, Retry.
Screen reader: `role="status" aria-live="polite"` on the counts line (throttled to one announcement per 3 s); progressbar as §24. Used on: Probe workbench "running all" (IA §5), Experiment › Overview, Benchmark run › Progress, Home "anything running". Tests: `done` requires `of`; elapsed ticks every second; Cancel asks via Dialog when `done.count > 0`; outcome counts sum ≤ `done.count`.

## 29. ProvenanceRecord
Purpose: the key-value block that says exactly how a benchmark run was produced and whether it is standard. **New to Flinch**; grid from vocab §6 definition grid, box from vocab §2 inset, badge from §17.
```
┌ PROVENANCE                         [standard] / [modified ⓘ why] ┐
│ suite        gsm8k-lite v1.2       │ model      claude-sonnet-4-6 │
│ judge        gpt-4o-2024-08 (published) │ sampling  t=0, n=1    │
│ template     published             │ samples    200 of 1319 (subset) │
│ system prompt none                 │ seed       1234             │
│ harness      flinch 0.9.0 · inspect 0.3.40 │ date  2026-10-16 14:02 │
│ differences from standard: system prompt set; subset of 200      │
└───────────────────────────────────────────────────────────────────┘
```
Props: `record*: { suite: { id; version }; model; judge: { id; published: boolean }; sampling: string; template: 'published' | 'modified'; samples: Count; systemPrompt: string | null; seed: number | null; harness: string; date: string }`, `standard*: { is: boolean; differences: string[] }`, `copyable = true`.
States: InsetBox block; eyebrow row with the Chip `standard` or `modified`, the modified chip followed by a Term-style tooltip listing `differences`; grid `grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_1fr_auto_1fr]`, dt `text-zinc-500`, dd `font-mono text-zinc-200 break-all`; "differences from standard" line `mt-2 text-xs text-amber-400` only when modified; Caveat `modified_bench` note when modified; Copy ghost icon copies the record as JSON, Toast "Copied."
Screen reader: `<dl>`; chip text is the status. Used on: Benchmark run › Results, Benchmarks list row detail, Publication export preview. Tests: `standard.is === false` requires a non-empty `differences` (runtime assert + TS discriminated union); every key renders even when null ("none", not blank); copied JSON round-trips.

## 30. UpdateCard
Purpose: an update is available, with notes, install, later, skip, and download progress. **Matches** `UpdateCard.svelte` (card and banner variants).
Props: `variant: 'card' | 'banner' = 'card'`; reads the `updates` store `{ phase: 'idle' | 'available' | 'downloading' | 'stopping' | 'installing' | 'error'; info: { version; currentVersion; notes }; downloaded; total; errorKind }`.
States: card `mt-6 rounded-xl border border-indigo-800/70 bg-indigo-950/30 p-4 focus:outline-none` with mono eyebrow `font-mono mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-indigo-300/80` and ArrowUpCircle; title `font-medium text-zinc-100` "Flinch {version} is ready"; version `mt-0.5 text-xs text-zinc-500`; notes `mt-1 list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-zinc-300` (excerpt, "…" on the last line when cut); keeps-your-stuff line `mt-3 text-xs leading-relaxed text-zinc-400`; buttons Update (primary sm), Later, Skip this version (ghost sm); progress `mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800`, fill `bg-gradient-to-r from-indigo-500 to-indigo-300`, status `text-indigo-200` with Loader2 `motion-safe:animate-spin`, bytes `font-mono tabular-nums text-zinc-400`; error `mt-3 flex items-center gap-1.5 text-sm text-red-300 role="alert"` with Try again and Dismiss; banner `flex-shrink-0 border-b border-indigo-800 bg-indigo-950/60 px-4 py-2 text-sm text-indigo-100`, inner `mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1`, close ghost X `text-indigo-300 hover:bg-indigo-900/60`.
Keyboard: after Update is clicked focus moves to the card (`tabindex=-1`) so it is not lost. Screen reader: card `<section aria-labelledby>`; banner `role="region" aria-label="Update"` plus an sr-only `role="status"` for the announcement; progressbar `aria-valuetext` with the bytes. Used on: Settings › About (card), LoadingScreen (card), under the Header (banner) once an update is known (IA §3 Settings; pre-read §2.10). Tests: pinned copy "(draft; brad-voice pass)": "Flinch {v} is ready", "Your sessions, probes and results stay where they are.", "Update", "Later", "Skip this version", "Download failed.", "Install failed.", "Try again"; progress percent monotonic; signature failure maps to `errorKind: 'install'`.

---

## Appendix A. Component → screen matrix

| Component | Home | Probe | Studies | Experiments | Benchmarks | Library | Results | Settings |
|---|---|---|---|---|---|---|---|---|
| Header, SessionSwitcher, KeyStatusChip, PrimaryNav, HelpMenu | ● | ● | ● | ● | ● | ● | ● | ● |
| Split | | ● | | ● | ● | | | |
| Tabs | | | | ● | ● | ● | | ● |
| Panel, InsetBox, Section, EmptyState, Readout, Term, Caveat | ● | ● | ● | ● | ● | ● | ● | ● |
| Rate, Stat | ● | ● | ● | ● | ● | | ● | |
| OutcomeBadge, LabelControl | | ● | ● | ● | ● | ● | ● | |
| Bar, DivergingBar | | | ● | ● | ● | | ● | |
| Table, List/Row, Card | ● | ● | ● | ● | ● | ● | ● | |
| Button, Inputs, Chip | ● | ● | ● | ● | ● | ● | ● | ● |
| Dialog, Drawer, Menu, Toast | ● | ● | ● | ● | ● | ● | ● | ● |
| FirstTimeTip, Tour card | ● | ● | ● | ● | ● | | | ● |
| LoadingScreen/Progress, ProgressCard | ● | ● | | ● | ● | | | ● |
| ProbeList, RunThread, CoachSuggestion | | ● | ● (Context) | ● (Responses) | | ● (Probes) | | |
| ProvenanceRecord | | | | | ● | | ● | |
| UpdateCard | | | | | | | | ● (+ banner, loading) |

## Appendix B. Test files a developer must create

| File | Pins |
|---|---|
| `lib/copy/copy-lint.test.ts` | sentence case, no em/en dash, "…" character, empty states end in ".", banned verbs and retired phrases (tokens §7), no bare percent regex `/\d+%(?![^(]*\d+ of \d+)/` in any string that is not inside a `Rate` |
| `lib/copy/caveats.test.ts` | the seven caveat phrases (§5) by id, and that every screen fixture that renders a Rate, LabelControl, final label, coach confidence or modified benchmark contains its caveat |
| `lib/copy/readouts.test.ts` | the Readout sentence shapes (§3) and that each sentence has every number with its source |
| `lib/format.test.ts` | tokens §6 examples one by one |
| `lib/tokens/contrast.test.ts` | tokens §8 table recomputed from the config |
| `lib/glossary.test.ts` | every `Term` key used in `lib/copy` and in `*.svelte` has an entry; definitions pass copy-lint |
| `lib/popup/audit.test.ts` | every FirstTimeTip and tour step places without `fallback` at 1280×800 and 1024×700 against the screen fixtures |
| per-component `*.test.ts` | the tests listed in each section above; `// @ts-expect-error` cases prove the bare-number props are compile errors |
