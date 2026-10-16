# Pry design vocabulary (reference for matching the design language)

Source: `beargleindustries/pry` @ 888bd51, surveyed 2026-10-16. Paths are relative to `ui/src/` unless they start with `docs/`. Tailwind 3.4 with **no theme extension**: `tailwind.config.js` only has commented-out shadcn tokens, so every colour is a stock Tailwind palette class. Dark mode is fixed: `app.html:2` sets `<html class="dark">`, and `app.css:6` sets `color-scheme: dark`. Nothing here is imported into Flinch; it is what Flinch's tokens and components are matched against.

## 1. Shell and layout

**Root and body**
- `app.html:9` body: `bg-zinc-950 text-zinc-100`.
- `app.css:7`: `font-family: system-ui, -apple-system, 'Segoe UI', sans-serif`, antialiased.
- `routes/+layout.svelte:72` `<main class="min-h-screen bg-zinc-950 text-zinc-100">`.
- Boot state (`+layout.svelte:100-104`): a centred row, `h-2 w-2 animate-pulse rounded-full bg-indigo-500` plus `font-mono text-sm tracking-wide` "Loading Pry…" in zinc-500.

**Page shell** (`routes/+page.svelte`)
- `:1044` `flex h-screen flex-col overflow-hidden bg-zinc-950`. The page fills the viewport; only the inner panels scroll.
- **Header** `:1046` `flex h-11 flex-shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4`. 44 px tall; in order: logo `PryLogo h-5 w-5 text-indigo-400` and "Pry" in `text-sm font-semibold text-zinc-100` (`:1047-1048`); the ModelSwitcher pill and the EngineStatusChip; at 1280 px and wider the inline prompt (`:1060`): label `text-xs text-zinc-500`, input, Run button; right-aligned `ml-auto gap-1` icon and text buttons (`:1093-1170`).
- **Narrow prompt row**, below 1280 px (`:1176`): `flex-shrink-0 border-b border-zinc-800 bg-zinc-900/50 px-4 py-2`, input at `py-1.5`.
- **Token strip** row (`:1270`): `flex flex-shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4`. Label `text-[11px] text-zinc-500`, then `SharedTokenStrip`.
- **Workspace** `:1283` `relative flex-1 overflow-hidden`. Split mode `:1299` uses `<ResizableSplit>` with a `TabbedPanel` on each side; each tab body is `div.h-full overflow-y-auto p-4` (`:1303`, `:1357`). Left tabs (`:973-996`): Attention · Logit Lens · Why (DLA) · Swap test · Key parts. Right tabs (`:997-1001`): Features · Predictions · Steering.
- **Narrow, tabbed mode** (`:1404-1531`): one top strip `flex-shrink-0 flex gap-6 border-b border-zinc-800 px-4` with two tabs; tabs `relative -mb-px border-b-2 px-1 py-2 text-sm transition-colors`, active `border-indigo-400 text-indigo-300`, inactive `border-transparent text-zinc-500`; below it `flex-1 overflow-y-auto p-4` with the nested `TabbedPanel`.
- **Lessons sidebar** when on (`:1560`): `flex min-h-0 flex-1` row containing the sidebar plus `flex min-h-0 min-w-0 flex-1 flex-col` main.

**Breakpoints** (`+page.svelte:227-238`, `lib/lessons/layout.ts:1-83`)
- `windowWide = matchMedia('(min-width: 1280px)')` decides only where the prompt sits. With Lessons off the workspace splits when `windowWide`; with Lessons on it splits when the measured workspace is at least `SPLIT_AT = 760`.
- Constants: `HANDLE = 6`, `MIN_SIDEBAR = 320`, `DEFAULT_SIDEBAR = 380`, max sidebar 40% of the window, `MIN_WORKSPACE = 640`, `RAIL = 44`.
- **1280×800**: prompt in the header, panels side by side 50/50 (`docs/screenshots/attention.png`). **1024×700**: prompt on its own row, tabbed workspace.

**ResizableSplit** (`lib/components/ResizableSplit.svelte`)
- Container `:92` `flex h-full`. Left pane width `ratio*100%`, `min-width: 300px`, `overflow-hidden`; default ratio 0.5 persisted in `localStorage['pry:split_ratio']`.
- Divider `:101-102`: `w-1.5 flex-shrink-0 cursor-col-resize transition-colors touch-none focus:outline-none focus-visible:bg-indigo-400`; idle `bg-zinc-800 hover:bg-indigo-500/50`; dragging `bg-indigo-500`. Arrow keys move it 2%.
- Lessons sidebar handle (`lib/lessons/LessonSidebar.svelte:755`): `w-1.5 … cursor-col-resize bg-zinc-900 hover:bg-indigo-900/60 focus:bg-indigo-900/60`. Sidebar panel (`:613`): `flex h-full min-h-0 flex-col bg-zinc-950 border-l|border-r border-zinc-800`; railed width 44 px.

**Z-index layers** (`+page.svelte:1582-1589` and components)

| Layer | Element |
|---|---|
| z-10 | LoadingScreen overlay (`LoadingScreen.svelte:273`, `absolute inset-0`) |
| z-20 | LoadProgressBanner (`:62`); ModelSwitcher menu (`ModelSwitcher.svelte:92`) |
| z-30 | Settings backdrop |
| z-40 | Settings drawer; TourMenu click-catcher |
| z-45 / 49 / 55 / 59 | Pointer SVG rings (sidebar / tour / default / tip) |
| z-50 | Modals (gate, trading card, notebook, CustomModelDialog, InstallSheet); tour card; dropdown menus; heatmap tooltips |
| z-[60] | FirstTimeTip |
| z-[70] | Term glossary tooltip (`Term.svelte:9,128`) |

## 2. Surfaces

| Role | Classes | Cite |
|---|---|---|
| Page | `bg-zinc-950` | `app.html:9`, `+page.svelte:1044` |
| Header | `bg-zinc-900 border-b border-zinc-800` | `+page.svelte:1046` |
| Sub-bars | `bg-zinc-900/50 border-b border-zinc-800` | `:1176`, `:1270` |
| Panel card | `flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5` | `PredictionsPanel.svelte:43`, `DLAPanel.svelte:74`, `LogitLensPanel.svelte:127`, `PanelB.svelte:117` |
| Elevated card | `rounded-xl border border-zinc-700/60 bg-zinc-900 p-5 shadow-xl` | `PanelA.svelte:595` |
| Inset box / empty state | `rounded-md border border-zinc-800 bg-zinc-900 py-12`, centred `text-sm text-zinc-600` | `PredictionsPanel.svelte:55-56` |
| Inset info row | `rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs` | `DLAPanel.svelte:96, 220` |
| Feature card | `rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-indigo-500/40` | `FeatureCard.svelte:81` |
| Preset row | `rounded-md border border-zinc-800 bg-zinc-900/70 px-4 py-3` | `PresetList.svelte:73` |
| Modal panel | `rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl` (gate dialog `rounded-xl border-zinc-800 p-5`) | `CustomModelDialog.svelte:145`; `+page.svelte:1223` |
| Popover / menu | `rounded-md border border-zinc-700 bg-zinc-900 shadow-xl` | `TourMenu.svelte:189`; `EngineStatusChip.svelte:117` (`w-72 p-3 text-xs`) |
| Menu (alt) | `rounded-md border border-zinc-800 bg-zinc-950 shadow-lg` | `ModelSwitcher.svelte:92` |
| Section divider | `mt-8 border-t border-zinc-800 pt-5` | `+page.svelte:1697`; `UpdateSettings.svelte:9` |
| Row divider | `border-t border-zinc-800` | `PredictionsPanel.svelte:126` |

- Borders are always 1 px. Default zinc-800; inputs, modals and menus zinc-700.
- Radii: `rounded` small controls, `rounded-md` buttons/inputs/inset boxes, `rounded-lg` panels and modals, `rounded-xl` hero and update cards.
- Shadows only on floating layers: `shadow-xl` (modals, popovers, tips), `shadow-2xl` (drawer, tour card), `shadow-lg` (tooltips).
- One glow: Pointer ring `filter: drop-shadow(0 0 6px rgba(99,102,241,.7))` (`Pointer.svelte:130`).
- Welcome page radial backdrop: `bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)]` (`routes/welcome/+layout.svelte:38`).

## 3. Text tiers

| Tier | Classes | Cite |
|---|---|---|
| Hero (loading) | `display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50`, font `'Segoe UI Variable Display'` | `LoadingScreen.svelte:373, 549-551` |
| Welcome h1 | `text-3xl font-semibold text-zinc-100` | `welcome/+layout.svelte:51` |
| Dialog / drawer title | `text-base font-semibold text-zinc-100` | `SettingsDrawer.svelte:62`, `CustomModelDialog.svelte:150` |
| Panel heading | `text-sm font-semibold text-zinc-100`, inline subtitle `text-xs text-zinc-600` in `flex items-baseline gap-2` | `PredictionsPanel.svelte:47-49` |
| Panel heading (Attention) | `text-sm font-semibold uppercase tracking-widest text-zinc-400` | `PanelA.svelte:598` |
| Sub-heading | `text-sm font-semibold text-zinc-200` / `mb-1 text-sm font-semibold text-zinc-100` | `PanelA.svelte:632`, `ComparePanel.svelte:144` |
| Eyebrow | `text-[10px] font-medium uppercase tracking-widest text-zinc-500` | `+page.svelte:1698`, `UpdateSettings.svelte:10` |
| Eyebrow (accent) | `text-[10px] font-semibold uppercase tracking-widest text-indigo-300` (or `-400`) | `FirstTimeTip.svelte:373`, `OverlayPresenter.svelte:337`, `LessonSidebar.svelte:624` |
| Eyebrow (mono accent) | `font-mono text-[11px] uppercase tracking-[0.14em] text-indigo-300/80` (loading `tracking-[0.18em]`) | `UpdateCard.svelte:129`, `LoadingScreen.svelte:365` |
| Form label | `text-xs font-medium uppercase tracking-wide text-zinc-500` | `CustomModelDialog.svelte:175`, `PresetList.svelte:67` |
| Body | `text-sm text-zinc-300` / `text-zinc-200`; lessons `text-sm leading-relaxed text-zinc-300` | `LessonSidebar.svelte:393` |
| Secondary | `text-xs text-zinc-400` | `CustomModelDialog.svelte:153` |
| Muted / hint | `text-xs text-zinc-500`; finer `text-[10px] text-zinc-500` or `-600` | `DLAPanel.svelte:215`, `PredictionsPanel.svelte:146` |
| Faintest | `text-zinc-700` (ranks, timing) | `DLAPanel.svelte:156, 262` |
| Mono | `font-mono text-xs` for tokens, numbers, IDs; `tabular-nums` on counters | `PredictionsPanel.svelte:102, 117`; `SteeringPanel.svelte:305` |

- Line heights: `leading-relaxed` for readouts, tips, cards; `leading-snug` for the Term tooltip (`Term.svelte:128`).
- Letter-spacing: `tracking-widest` eyebrows, `tracking-wide` form labels and mono status text (`+layout.svelte:91`).
- A leading space in a token is shown as `·` (U+00B7) (`PredictionsPanel.svelte:38`).

## 4. Accent and semantic colours

**Indigo accent**: primary fill `bg-indigo-500 hover:bg-indigo-400` (Run, `+page.svelte:1079`) or `bg-indigo-600 hover:bg-indigo-500` (dialogs, lessons, `+layout.svelte:85`). Active text and borders indigo-300/400. Logo indigo-400. Pointer and tour graphics `rgb(129 140 248)` = indigo-400 (`Pointer.svelte:82-123`).

**Selected / active**
- Tabs: `border-b-2 border-indigo-400 text-indigo-300`; inactive `border-transparent text-zinc-500 hover:text-zinc-300` (`TabbedPanel.svelte:186-191`).
- Header toggles: `bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60`; off `text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100` (`+page.svelte:1138-1140, 1156-1158`).
- Segmented toggle: active `bg-indigo-500 text-white`, inactive `text-zinc-400 hover:text-zinc-200`, inside `flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/60 p-0.5` (`PanelA.svelte:871, 882-885`).
- Selected token chip: `border border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50` (`SharedTokenStrip.svelte:30`).
- Pressed On/Off: `border-indigo-600 bg-indigo-950/40 text-indigo-300` (`+page.svelte:1720`).
- Selected list row `bg-zinc-800/80`; rank-1 row `bg-zinc-900/80` (`PredictionsPanel.svelte:92`).
- Lesson choice: `border-indigo-500 bg-indigo-950/60 text-indigo-100` (`LessonSidebar.svelte:434`).

**Focus**: inputs `focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500` (`+page.svelte:1069`); selects `focus:border-indigo-500 focus:outline-none` (`PanelA.svelte:936`); buttons `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400` (`UpdateCard.svelte:89`); loading `.ctl:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px }` (`LoadingScreen.svelte:569-572`); Term `focus-visible:ring-1 focus-visible:ring-indigo-400` (`Term.svelte:120`).

**Semantic**
- Error: `border-red-800 bg-red-950/40`, text `text-red-400`; Retry `rounded bg-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-800` (`+page.svelte:1251-1263`). Crash banner `bg-red-950/70 text-red-100` (`EngineCrashBanner.svelte:63`).
- Warning / stale: `text-amber-400` (`+page.svelte:1072`), `text-amber-400/80` (`DLAPanel.svelte:135`), `text-amber-500` (`SteeringPanel.svelte:323`); banner `border-amber-800/60 bg-amber-950/30 text-amber-200` (`LessonSidebar.svelte:661`); load warning `bg-yellow-950/60 border-yellow-800 text-yellow-100` (`LoadProgressBanner.svelte`).
- Success: `text-emerald-400` (`LessonSidebar.svelte:474`); `bg-emerald-950/40 text-emerald-200` (`:491`); status dot `bg-emerald-400` (`EngineStatusChip.svelte:104`); Check `text-green-400` (`ModelSwitcher.svelte:108`).
- Verdict tones (`ModelSwitcher.svelte:60-64`; `CustomModelDialog.svelte:125-131` uses `/40`): good `bg-green-900/60 text-green-300 border-green-700`; warn `bg-yellow-900/60 text-yellow-300 border-yellow-700`; cpu `bg-sky-900/60 text-sky-300 border-sky-700`; bad `bg-red-900/60 text-red-300 border-red-700`; soon `bg-zinc-800 text-zinc-400 border-zinc-700`.

**Signed data colours** (`lib/signed-color.ts:4-16`): `POSITIVE_HEX = '#56b4e9'` (Okabe-Ito sky blue), `NEGATIVE_HEX = '#e69f00'` (orange). Minus sign U+2212. Colour never the only cue; a +/− glyph always accompanies it.

**Other data colours**: MLP `text-fuchsia-300`, badge `bg-fuchsia-900/40` (`DLAPanel.svelte:164, 174`); heatmaps viridis (`lib/viridis.ts`); knocked-out cell `#991b1b` (`PanelA.svelte:1299`).

## 5. Controls

| Control | Classes | Cite |
|---|---|---|
| Primary (header) | `rounded bg-indigo-500 px-4 py-1 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50` | `+page.svelte:1079` |
| Primary (dialog) | `rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:…opacity-50` | `CustomModelDialog.svelte:282` |
| Primary (small) | `rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500` | `LessonSidebar.svelte:450` |
| Secondary | `rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700` | `CustomModelDialog.svelte:274` |
| Secondary (small) | `rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200` | `+page.svelte:1639` |
| Outline (small) | `rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800` | `LessonSidebar.svelte:446` |
| Indigo-tint secondary | `rounded-md border border-indigo-700 bg-indigo-900/40 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-800/60` | `CustomModelDialog.svelte:195` |
| Dashed add | `rounded-md border border-dashed border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500 hover:border-indigo-600 hover:text-indigo-400` | `+page.svelte:1671` |
| Ghost icon | `rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed` | `+page.svelte:1099` |
| Ghost text+icon | `flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100` | `+page.svelte:1116` |
| Text link button | `text-sm text-zinc-400 hover:text-zinc-200` | `+page.svelte:1231` |
| Spinner | `inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent` | `+page.svelte:1083` |

Disabled is `opacity-50` (icons `opacity-30`, lessons `opacity-40`) with `cursor-not-allowed`.

**Inputs**: text `rounded border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500` (`+page.svelte:1069`); dialog variant `rounded-md bg-zinc-800 py-2` (`CustomModelDialog.svelte:190`); textarea `w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm … focus:border-indigo-500` (`LessonSidebar.svelte:440`); number `w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono` (`WatchItWrite.svelte:117`).

**Selects** (native): `rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none` (`PanelA.svelte:936`); mono variant `bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-200` (`DLAPanel.svelte:112`).

**Checkbox and slider**: native, `accent-indigo-500` (`WatchItWrite.svelte:125`; `SteeringPanel.svelte:318`). Slider row `[Suppress] range [Amplify]` with end labels `text-[10px] text-zinc-600`; above it label `text-xs font-medium text-zinc-400` and value `text-xs tabular-nums text-zinc-300` in `justify-between` (`SteeringPanel.svelte:302-321`).

**Chips and pills**: token chip `flex-shrink-0 rounded px-2 py-1 font-mono text-xs border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500` in a strip `flex h-9 items-center gap-1.5 overflow-x-auto whitespace-nowrap` (`SharedTokenStrip.svelte:28-31`); tag pill `rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300` (`PredictionsPanel.svelte:67`); verdict badge `rounded border px-1.5 py-0.5 text-[10px] {tone}` (`ModelSwitcher.svelte:114`); header model pill `flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800` with ChevronDown (`ModelSwitcher.svelte:78`); engine chip `rounded-md border px-2 py-1 text-[11px]` with a 1.5 status dot and Cpu icon (`EngineStatusChip.svelte:94-107`).

**Tabs** (`TabbedPanel.svelte`): strip `:174` `flex flex-shrink-0 gap-4 border-b border-zinc-800 px-3`; tab `:186` `relative -mb-px border-b-2 px-1 py-1.5 text-xs transition-colors`; strip hidden with one tab; body `:198` `flex-1 overflow-y-auto`; arrow keys cycle.

**Toggles**: no switch widget; pressed buttons with `aria-pressed` (`+page.svelte:1716-1722`) or the segmented group.

## 6. Data display

**Readout** (`Readout.svelte:219-228`): `<p class="rounded-md border border-indigo-900/50 bg-indigo-950/30 px-3 py-2 text-xs leading-relaxed text-zinc-300">` with sr-only prefix "In plain words: ", wrapped in `div.contents role=status aria-live=polite`. A faint indigo box with one or two plain sentences under every panel heading.

**PredictionsPanel probability bars**: scale header `:74-83` `text-[10px] text-zinc-600` 0% / 50% / 100%; row `:92` button `pred-row flex items-center gap-3 rounded-md px-3 py-1.5` containing rank badge `:96` `h-5 w-5 rounded text-[10px] font-bold` (rank 1 `bg-indigo-600 text-white`, others `bg-zinc-800 text-zinc-500`), token `w-28 truncate font-mono text-xs text-zinc-200`, track `:108` `h-2 w-full overflow-hidden rounded-full bg-zinc-800`, fill `:110` `h-full rounded-full transition-all` (`bg-indigo-500` top 3, `bg-zinc-600` rest), value `w-36 text-right font-mono text-xs text-zinc-400` such as "8.7% (about 1 in 12)". Fill width is the raw probability on a 0–100% track, never rescaled (`readouts.ts:465-468`). "Everything else" row `:124-138`: `border-t border-zinc-800`, label `text-xs text-zinc-400`, fill `bg-zinc-700`, value 1 − sum of the top ten. Shape sentence plus tag pills above (`:63-70`); hint "Click a bar to see its logit." below (`:146`). At container width ≤ 440 px the value wraps under the bar (`:156-177`).

**DLAPanel**: target row `:96-103` inset box, label zinc-500, answer `font-mono text-indigo-300`. Waterfall row `:153` `flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-900/60`: rank `font-mono text-[10px] text-zinc-700`, name `w-16 font-mono text-xs`, type badge `w-8 rounded text-center text-[9px]` (Attn `bg-indigo-900/40 text-indigo-400`, MLP `bg-fuchsia-900/40 text-fuchsia-300`), a 16 px diverging bar from centre (positive right `#56b4e9`, negative left `#e69f00`, `opacity .75`, `rounded-r`/`rounded-l`), value `w-16 text-right font-mono text-[10px]` by sign. Total line `:220-232` `rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-300`, e.g. "Bars total 4.56. Logits 18.47 and 15.10, difference 3.36. Gap −1.20: …", with a `<details>` "What the gap is made of". Legend `:236` `text-[10px] text-zinc-500` with `h-2 w-4 rounded-sm` swatches.

**Lists and tables**: definition grid `grid grid-cols-[auto_1fr] gap-x-3 gap-y-1`, dt `text-zinc-500`, dd `text-zinc-200` (`EngineStatusChip.svelte:121-134`); lesson table cells `border border-zinc-800 px-2 py-1` (`LessonSidebar.svelte:378`); small bar `h-2 w-32 rounded-full bg-zinc-800` with a coloured fill (`FeatureCard.svelte:89`).

**Number formatting** (`lib/readouts.ts`): `pct()` never shows 0% or 100% for non-exact values (`<1%`, `>99%`, `:47-52`); `num()` two decimals with a real minus (`:458`); `formatProbability` gives "9.7% (about 1 in 10)" (`lessons/slots.ts:61`).

**Readout sentence shapes** (`lib/readouts.ts`):
- `:114-115`: `The model's top guess for ${what} is ${guess} (${pct}). Next most likely: ${guess} (${pct}).`
- `:216-220`: `The parts that pushed ${word} up most directly: ${list}. Pushing it down most: ${list}.`
- `:529`: `Bars total ${num}. Logit ${num}. Gap ${num}: the embedding's own direct push plus the attention-output and unembedding biases, not drawn as bars.`
- `:511`: `"${tok}" has a logit of ${num}. Softmax turns the logits into the probabilities above.`
- `:584`: `Share = (${patched} − ${corrupted}) ÷ (${clean} − ${corrupted}) = ${n}%`

## 7. Guidance

**Term** (`Term.svelte`): word `:120` `cursor-help underline decoration-dotted decoration-zinc-500 underline-offset-2`, focusable. Popup `:128` `pointer-events-none fixed z-[70] rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-zinc-200 shadow-xl`, max-width 256 px; placed with `placePopup` (preferred bottom, gap 6, edge 8); no arrow; hover or focus; Escape hides.

**FirstTimeTip** (`FirstTimeTip.svelte:353-401`): card `fixed z-[60] rounded-lg border border-indigo-700/60 bg-zinc-900 p-3 shadow-xl`, 320 px wide (220 min); title = indigo eyebrow; blurb `mt-1 text-xs leading-relaxed text-zinc-200`; dismiss "×" `rounded p-0.5 text-zinc-400 hover:bg-zinc-800`; optional "why?" / "less" toggle `mt-2 text-[10px] uppercase tracking-widest text-indigo-400` expanding to `text-xs leading-relaxed text-zinc-400`. Caret `:404-417`: a 12 px rotated square in zinc-900 with `rgba(67,56,202,.6)` border on the target-facing edge, offset −7 px. Pointer (`Pointer.svelte`): SVG ring `rx=7 stroke rgb(129 140 248) width 2` padded 4 px, pulsing stroke-opacity 1 → .45 over 1.6 s; dashed `5 4` arrow with a triangle head from tip edge to target.

**Tour card** (`lib/lessons/OverlayPresenter.svelte:313-370`): `fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur`, `w-[400px]`; sheet mode `max-h-[45vh]`. Header: eyebrow "Step n of N" and `text-sm font-medium` title; body `text-sm leading-relaxed text-zinc-200`; footer `border-t` with "Skip" (`text-[11px] text-zinc-500`), Back (secondary small), Next (`bg-indigo-500`).

**placePopup rules** (`lib/popup/place.ts:1-26, 98-108`): modes in order: `sheet` (tour only, viewport < 760 px, full-width bottom card); `anchored` (beside the target: previous side first, then preferred, opposite, cross sides; may narrow to `minW`); `inset` (inside a large target next to the focus point, 14 px focus ring); `fallback` (no target or off screen: tips and Terms hide, tour centres). Constants `DEFAULT_GAP = 10`, `DEFAULT_EDGE_PAD = 12`, `MAX_ARROW = 160`, `CARET_INSET = 14`, `RING_PAD = 4`. Popups avoid "occupied" rects (banners, other popups).

**LoadingScreen** (`LoadingScreen.svelte`): overlay `absolute inset-0 z-10 bg-zinc-950`, fades in 360 ms; grid `sm:grid-cols-[minmax(190px,280px)_1fr]`, `max-w-5xl`. Left: animated SVG layer stack (slabs light indigo as loading progresses, token chips drift, a "?" output chip, a pulse rising). Right: mono eyebrow "Loading model" with hairline rule and elapsed timer; model name as hero; stage text `text-lg`; progress bar `h-2 rounded-full bg-zinc-800/80` with indigo gradient `#4f46e5 → #818cf8 → #c7d2fe` plus sheen; % and ETA in mono; step list with Check / breathing dot / hollow circle and per-step seconds; note `border-l-2 border-indigo-500/50 pl-3`; card deck (tip, term or lesson) `rounded-xl border-zinc-800 bg-zinc-900/60` with dot pager, prev/next, play/pause.

**TourMenu** (`TourMenu.svelte:174-206`): CircleHelp ghost icon opens `w-56 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl`; items `px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-800`.

## 8. Dialogs and drawers

**SettingsDrawer** (`SettingsDrawer.svelte:46-75`): backdrop `fixed inset-0 z-30 bg-black/50` fade 150 ms; panel `fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl` (`fly x:440 200ms`); header `border-b border-zinc-800 px-5 py-4` with title and X ghost; body `flex-1 overflow-y-auto px-5 py-5`; sections `mt-8 border-t pt-5` with zinc-500 eyebrows; setting rows `flex items-center justify-between`, `text-sm text-zinc-300` over hint `text-xs text-zinc-500`, button right (`+page.svelte:1700-1723`).

**CustomModelDialog** (`CustomModelDialog.svelte:140-289`): overlay `fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-8`; panel `max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl`; title, `text-xs text-zinc-400` intro, inset boxes `rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs`, input row; footer `flex justify-end gap-2` Cancel + primary, no footer border.

**Other modals**: notebook and hardware card `bg-black/70`, `items-start py-10`, panel `max-w-4xl rounded-lg border-zinc-700 bg-zinc-900 p-6` (`NotebookPanel.svelte:123-129`; `+page.svelte:1761-1765`); gate dialog `bg-black/60`, `max-w-lg rounded-xl border-zinc-800 p-5` (`+page.svelte:1222-1223`).

**UpdateCard** (`UpdateCard.svelte`): card `:125` `mt-6 rounded-xl border border-indigo-800/70 bg-indigo-950/30 p-4` with mono eyebrow and ArrowUpCircle, `font-medium` title, version `text-xs text-zinc-500`, notes list, buttons; banner `:167` `flex-shrink-0 border-b border-indigo-800 bg-indigo-950/60 px-4 py-2 text-sm text-indigo-100`, inner `mx-auto max-w-3xl`; progress `h-1.5 rounded-full bg-zinc-800`, fill `bg-gradient-to-r from-indigo-500 to-indigo-300`.

## 9. Icons

`lucide-svelte ^0.460` (`ui/package.json`), 24 files. Used: AlertTriangle, ArrowLeft, ArrowRight, ArrowUpCircle, BookOpen, BookmarkPlus, Check, CheckCircle2, ChevronDown/Left/Right, CircleHelp, Copy, Cpu, Download, ExternalLink, FileDown, FlaskConical, GitCompareArrows, GraduationCap, Key, Lightbulb, Loader2, Lock, MoveHorizontal, PanelLeftClose, PanelRightClose, Pause, Play, PlayCircle, RefreshCcw, RotateCcw, Settings, SkipForward, Sparkles, X, Zap. Sizes: `h-4 w-4` ×44 (header, buttons), `h-3.5 w-3.5` ×23 (chips, small buttons), `h-3 w-3` ×7, `h-5 w-5` ×4 (logo). Custom: `lib/components/icons/PryLogo.svelte`, 24×24, stroke 1.5, `currentColor`.

## 10. Motion

`animate-spin` spinners; `animate-pulse` boot dots, skeletons, Download icon; `transition-colors` tabs, divider, cards; `transition-all` bar fills, chips, segmented buttons. Svelte: drawer `fade 150ms` + `fly x:440 200ms` (`SettingsDrawer.svelte:49,56`); loading deck `fly x:±16 240ms` (`LoadingScreen.svelte:447`). CSS: Pointer pulse 1.6 s; LoadingScreen keyframes `ls-enter` 360 ms, `ls-sheen` 2.4 s, `ls-breathe` 1.6 s, `ls-fire`, `ls-rise` 2.8 s, `ls-drift` 5.6 s; slab/output 600 ms ease-out; bar 260 ms linear; tour card `top/left 150ms ease`; welcome stepper `transition-all duration-300`. `prefers-reduced-motion` disables (`LoadingScreen.svelte:722-736`, `Pointer.svelte:137`, `OverlayPresenter.svelte:381`); UpdateCard uses `motion-safe:`.

## 11. Copy conventions

- Sentence case everywhere (tabs "Swap test", "Key parts", "Why (DLA)"; buttons "Run", "Not now", "Add model"; tips "Will it fit?", "Word chips"; `tips/tips-registry.ts:42-56`).
- Ellipsis "…" in progress labels.
- Empty states are full sentences ending in a period: "Run a prompt and this tab fills in on its own." (`PredictionsPanel.svelte:56`).
- Tests: no em dash in visible strings (`lib/copy/copy-lint.test.ts:57-62`); "Hugging Face" two words (`:32`).
- `lessons/lint-words.yaml` bans model-mind verbs: thinks, believes, knows, decides, focuses on, pays attention to (`:63-80`); retires "makes up its mind", "the model's confidence", "opens the black box" (`:8-30`).
- Caveats are plain hedged clauses pinned by exact phrase (`lib/copy/caveats.test.ts`): `:34` "Which parts of the model pushed directly toward or against its guess. Help that goes through other parts isn't counted."; `:50` "Labels are best guesses from Neuronpedia, not certainties."; `:45` "On their own they don't show what causes the model's answer."; `:70` "a hint, not proof".

## 12. Screenshots

`docs/screenshots/` 1280×800 PNGs referenced from `README.md:9-89`: attention, lessons, lesson-predict, lesson-check, quick-tour, logit-lens, why-dla, swap-test, key-parts, features, compare, loading. Lesson illustrations under `ui/src/lessons/*/images/`. App icons `src-tauri/icons/*.png`.
