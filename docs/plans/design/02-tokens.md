# Flinch design tokens

Draft 1, 2026-10-16. Companion to `00-pry-vocabulary.md` (the classes Flinch matches; cited below as `vocab §n`) and `01-information-architecture.md`. Stack: SvelteKit 5, Tailwind 3.4, dark only (`<html class="dark">`, `color-scheme: dark`, as `vocab §1`). No Pry code is imported; the tokens below are semantic names for the same stock Tailwind values Pry uses, so a Flinch screen and a Pry screen read as one family.

Rule for the whole file: a token is an alias, not a new colour. Every token resolves to a stock Tailwind 3.4 hex or to one of the three non-Tailwind values Flinch inherits (the two signed-data colours, and nothing else). Components in `03-components.md` use the semantic name in prose and the stock class in code, so the cited Pry class is still greppable.

## 1. `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces (vocab §2). Page, header/panel, raised controls.
        surface: {
          page:   '#09090b', // zinc-950  body, page shell, panel card body, drawer
          panel:  '#18181b', // zinc-900  header, inset boxes, modals, menus, feature cards
          raised: '#27272a', // zinc-800  secondary buttons, bar tracks, selected rows, tag pills
          sunken: '#09090b', // zinc-950  inputs on a panel (same hex as page; named so the role is explicit)
        },
        // Borders (vocab §2: "Default zinc-800; inputs, modals and menus zinc-700").
        border: {
          DEFAULT: '#27272a', // zinc-800  panels, dividers, rows
          strong:  '#3f3f46', // zinc-700  inputs, modals, menus, popovers, secondary buttons
          hover:   '#71717a', // zinc-500  chip hover border (SharedTokenStrip)
        },
        // Text (vocab §3).
        text: {
          strong:    '#fafafa', // zinc-50   hero only
          primary:   '#f4f4f5', // zinc-100  headings, input text, body on dark
          body:      '#d4d4d8', // zinc-300  body copy, readouts
          secondary: '#a1a1aa', // zinc-400  secondary copy, ghost buttons, bar values
          muted:     '#71717a', // zinc-500  hints, eyebrows, form labels, inactive tabs
          faint:     '#52525b', // zinc-600  empty-state text, scale labels, placeholders
          faintest:  '#3f3f46', // zinc-700  ranks, timings (decorative only; fails AA, see §8)
        },
        // Accent (vocab §4): indigo scale, stock.
        accent: {
          50:  '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
          500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81',
          950: '#1e1b4b',
          DEFAULT: '#4f46e5', // indigo-600  primary fill: buttons, Segmented active (§8.1: white on indigo-500 is 4.47, under AA)
          hover:   '#6366f1', // indigo-500  primary hover (momentary; §8.1)
          ring:    '#818cf8', // indigo-400  focus outline, logo, pointer, tab underline
          text:    '#a5b4fc', // indigo-300  active tab text, eyebrow accent, readout answers
        },
        // Outcomes: the four classification labels (models.py Classification)
        // plus unknown. Hues are today's index.html custom properties, which
        // are already stock Tailwind 500s; text uses the 400, tint the 950,
        // border the 800. Colour is never the only cue: the word is always shown.
        outcome: {
          refused:    { DEFAULT: '#ef4444', text: '#f87171', tint: '#450a0a', edge: '#991b1b' }, // red-500/400/950/800
          collapsed:  { DEFAULT: '#f59e0b', text: '#fbbf24', tint: '#451a03', edge: '#92400e' }, // amber-500/400/950/800
          negotiated: { DEFAULT: '#f97316', text: '#fb923c', tint: '#431407', edge: '#9a3412' }, // orange-500/400/950/800
          complied:   { DEFAULT: '#22c55e', text: '#4ade80', tint: '#052e16', edge: '#166534' }, // green-500/400/950/800
          unknown:    { DEFAULT: '#71717a', text: '#a1a1aa', tint: '#18181b', edge: '#3f3f46' }, // zinc-500/400/900/700
        },
        // Signed data (vocab §4, Pry lib/signed-color.ts). Okabe-Ito; not Tailwind.
        signed: {
          positive: '#56b4e9', // sky blue; "more refusal", "+"
          negative: '#e69f00', // orange;   "less refusal", U+2212
        },
        // Semantic state (vocab §4).
        state: {
          error:   { DEFAULT: '#f87171', tint: '#450a0a', edge: '#991b1b', fill: '#7f1d1d' }, // red-400/950/800/900
          warn:    { DEFAULT: '#fbbf24', tint: '#451a03', edge: '#92400e' },                  // amber-400/950/800
          success: { DEFAULT: '#34d399', tint: '#022c22', edge: '#065f46' },                  // emerald-400/950/800
        },
      },
      fontFamily: {
        sans:    ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],       // vocab §1 app.css:7
        display: ['Segoe UI Variable Display', 'system-ui', 'sans-serif'],        // hero only, vocab §3
        mono:    ['JetBrains Mono', 'ui-monospace', 'Consolas', 'monospace'],      // today's --font-mono, kept
      },
      spacing: {
        header: '2.75rem', // 44 px, the h-11 header (vocab §1)
        rail:   '2.75rem', // 44 px, railed sidebar width (vocab §1 RAIL)
        pane:   '300px',   // left pane at 1280 (IA §5; 06-architecture §11 .pane-left)
        'pane-narrow': '280px', // left pane at 1024 (IA §5)
        gutter: '1rem',    // 16 px page gutter at 1024 (06-architecture §11 .page px-4)
        'gutter-wide': '1.5rem', // 24 px page gutter at ≥ 1280 (.page xl:px-6)
        grid:   '1rem',    // 16 px card-grid gap and panel gap (.page-grid, .page-stack, .page-cols gap-4)
      },
      maxWidth: {
        page: '1200px',    // content screens (06-architecture §11 .page max-w-[1200px])
      },
      zIndex: { 45: '45', 49: '49', 55: '55', 59: '59', 60: '60', 70: '70' }, // vocab §1 table
      boxShadow: {
        glow: '0 0 6px rgba(99,102,241,.7)', // Pointer ring only (vocab §2)
      },
      keyframes: {
        'ring-pulse': { '0%,100%': { strokeOpacity: '1' }, '50%': { strokeOpacity: '.45' } },
        breathe:      { '0%,100%': { opacity: '1' }, '50%': { opacity: '.4' } },
      },
      animation: {
        'ring-pulse': 'ring-pulse 1.6s ease-in-out infinite',
        breathe:      'breathe 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
```

Notes on the block:

- `outcome.*` and `state.*` are nested so `bg-outcome-refused-tint text-outcome-refused-text border-outcome-refused-edge` reads as one badge recipe. The same hex values are reachable as `bg-red-950 text-red-400 border-red-800`; code may use either, docs cite the stock class.
- `surface.sunken` equals `surface.page` on purpose (Pry puts inputs on `bg-zinc-950` inside `bg-zinc-900` panels, `vocab §5`). Naming it stops someone "fixing" it.
- The accent `DEFAULT` is indigo-600, Pry's dialog-primary fill, not its header Run fill (indigo-500): white on indigo-500 is 4.47 : 1 and fails this file's own rule (§8.1). Every filled primary in Flinch, the Button primary variant and the Segmented active option (`03-components.md` §15, §16), is indigo-600 with an indigo-500 hover. indigo-500 stays reachable as `accent-500` for non-text fills (bar fills, the drag divider, selected-chip tint).
- Page container and grid: `max-w-page` (1200 px), `px-gutter` / `xl:px-gutter-wide` (16 / 24 px), `gap-grid` (16 px) are the named forms of the numbers in `06-architecture.md` §11; the `.page`, `.page-grid`, `.page-stack`, `.page-cols` and `.pane-left` classes there are the only place they are applied (§3 below lists them).
- No `--color-blue`, `--color-purple`, `--color-teal` from today's `index.html`: nothing in the IA needs them. The DLA fuchsia badge (`vocab §4`) has no Flinch use either.
- Opacity variants (`bg-indigo-950/30`, `border-zinc-700/60`, `bg-zinc-900/50`) are written as stock Tailwind opacity modifiers, not tokens; §8 lists the composite results for contrast.

## 2. Type scale

Sizes are Tailwind defaults at the 16 px root. Weights: 400 normal, 500 medium, 600 semibold, 700 bold.

| Role | Classes | px / weight | Cite |
|---|---|---|---|
| Hero | `font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50` | 30 → 36 / 600 | vocab §3 LoadingScreen |
| h1 (page title) | `text-3xl font-semibold text-zinc-100` | 30 / 600 | vocab §3 welcome h1 |
| Dialog or drawer title | `text-base font-semibold text-zinc-100` | 16 / 600 | vocab §3 |
| Panel heading | `text-sm font-semibold text-zinc-100` with inline subtitle `text-xs text-zinc-600` in `flex items-baseline gap-2` | 14 / 600, 12 / 400 | vocab §3 PredictionsPanel |
| Panel heading (upper) | `text-sm font-semibold uppercase tracking-widest text-zinc-400` | 14 / 600 | vocab §3 PanelA; used for pane headers "PROBES", "HISTORY" |
| Sub-heading | `text-sm font-semibold text-zinc-200` | 14 / 600 | vocab §3 |
| Eyebrow | `text-[10px] font-medium uppercase tracking-widest text-zinc-500` | 10 / 500 | vocab §3 |
| Eyebrow (accent) | `text-[10px] font-semibold uppercase tracking-widest text-indigo-300` | 10 / 600 | vocab §3 FirstTimeTip |
| Eyebrow (mono accent) | `font-mono text-[11px] uppercase tracking-[0.14em] text-indigo-300/80` | 11 / 400 | vocab §3 UpdateCard |
| Form label | `text-xs font-medium uppercase tracking-wide text-zinc-500` | 12 / 500 | vocab §3 |
| Body | `text-sm text-zinc-300` (long runs `leading-relaxed`) | 14 / 400 | vocab §3 |
| Body (strong) | `text-sm text-zinc-200` | 14 / 400 | vocab §3 |
| Secondary | `text-xs text-zinc-400` | 12 / 400 | vocab §3 |
| Muted / hint | `text-xs text-zinc-500` | 12 / 400 | vocab §3 |
| Faint | `text-[10px] text-zinc-600` or `text-xs text-zinc-600` | 10 to 12 / 400 | vocab §3 |
| Faintest (decorative) | `text-[10px] text-zinc-700` | 10 / 400 | vocab §3; ranks and timings only, never information |
| Mono | `font-mono text-xs text-zinc-200` | 12 / 400 | vocab §3; tokens, IDs, model names, probe slugs |
| Number | `font-mono text-xs tabular-nums text-zinc-400`, right-aligned in columns | 12 / 400 | vocab §6 PredictionsPanel value |
| Number (large) | `font-mono text-2xl tabular-nums text-zinc-100` | 24 / 400 | Stat value; new to Flinch |
| Model reply text | `font-mono text-xs leading-[1.85] text-zinc-300` | 12 / 400 | today's `.response-text`, recoloured |

Line height: `leading-relaxed` (1.625) on readouts, tips, cards, caveats; `leading-snug` (1.375) on the Term tooltip; model reply text keeps today's 1.85 for long prose.

## 3. Spacing, radii, borders, shadows

**Radii** (vocab §2):

| Radius | px | Elements |
|---|---|---|
| `rounded-sm` | 2 | legend swatches, focus ring on a Term |
| `rounded` | 4 | header primary button, header input, small chips, tag pills, rank badges, verdict badges |
| `rounded-md` | 6 | buttons, inputs, selects, inset boxes, readouts, menus, popovers, Term tooltip, preset rows |
| `rounded-lg` | 8 | panel cards, modals, FirstTimeTip, tour card, feature cards |
| `rounded-xl` | 12 | elevated hero cards, UpdateCard, loading deck |
| `rounded-full` | full | bar tracks and fills, status dots, progress bars |

**Padding and gaps**:

| Place | Classes |
|---|---|
| Panel card | `p-5`, children `gap-4` (vocab §2) |
| Tab body | `p-4` (vocab §1) |
| Inset box | `px-3 py-2` (info row) or `p-3` (dialog inset) |
| Modal panel | `p-6`; gate variant `p-5` |
| Drawer header | `px-5 py-4`; drawer body `px-5 py-5` |
| Header | `h-11 px-4 gap-3` (44 px) |
| Sub-bar | `px-4 py-2` |
| Menu item | `px-3 py-1.5` |
| List row | `px-3 py-1.5` (bars) or `px-4 py-3` (preset rows) |
| Section divider | `mt-8 border-t border-zinc-800 pt-5` |
| Button row | `flex justify-end gap-2` |
| Icon sizes | `h-4 w-4` buttons and header; `h-3.5 w-3.5` chips and small buttons; `h-3 w-3` inline; `h-5 w-5` logo (vocab §9) |

**Layout constants** (vocab §1, IA §2, §5): header 44 px; left pane 300 px at ≥ 1280, 280 px at 1024 (`min-width` on the pane, ratio from `ResizableSplit` otherwise); divider 6 px (`w-1.5`); `MIN_WORKSPACE = 640`; drawer `max-w-[440px]`; dialog `max-w-lg` (normal) or `max-w-4xl` (wide); tip 320 px (min 220); tour card 400 px; Term tooltip max 256 px; popover `w-72`; menu `w-56`.

**Page container and grid** (`06-architecture.md` §11 defines the classes in `src/app.css`; this table names the tokens they use; every content-screen wireframe cites one class from it):

| Token | Value | Class in 06 §11 | Where |
|---|---|---|---|
| `page-max` (`max-w-page`) | 1200 px | `.page` | every content screen: Home, lists, Settings, Library, Results, study and experiment screens |
| `gutter` / `gutter-wide` | 16 px at 1024, 24 px at ≥ 1280 (`px-4 xl:px-6`) | `.page` | same |
| `grid-gap` (`gap-grid`) | 16 px (`gap-4`) | `.page-grid` (2 columns at 1024, 3 at ≥ 1280) | card grids: Home questions, Studies › New picker, Benchmarks catalog |
| `panel-gap` | 16 px (`gap-4`) | `.page-stack`, `.page-cols` (main + side `2fr/1fr` at ≥ 1280, stacked at 1024) | panels one under another; main-plus-side layouts |
| `pane` / `pane-narrow` | 300 px at ≥ 1280, 280 px at 1024 | `.pane-left` | two-pane screens (Probe workbench, Experiment › Responses, Benchmark › Results): full bleed under the header, no `.page` |
| page padding-y | 20 px (`py-5`) | `.page` | top and bottom of every content screen |

Vertical rhythm inside a `.page` is `gap-4` between panels and `mt-8` between Sections (above). Nothing else positions content.

**Borders**: always 1 px. `border-zinc-800` by default; `border-zinc-700` on inputs, modals, menus, popovers and secondary buttons; `border-zinc-700/60` on the elevated card; accent borders (`border-indigo-700/60` tip, `border-indigo-900/50` readout, `border-indigo-800/70` update card) only on guidance surfaces. Left-edge 2 px rules (`border-l-2 border-indigo-500/50`) mark a note, not a border.

**Shadows**: only on floating layers. `shadow-xl` modals, popovers, tips, Term; `shadow-2xl` drawer, tour card; `shadow-lg` menus (alt) and tooltips. Nothing in the page flow casts a shadow. One glow: the Pointer ring (`shadow-glow`).

**Z-index**: the Pry table (vocab §1) is kept verbatim: 10 loading overlay, 20 banners and header menus, 30 drawer backdrop, 40 drawer, 45/49/55/59 pointer rings, 50 modals, tour card, menus, 60 FirstTimeTip, 70 Term tooltip.

## 4. Interaction states

| State | Rule | Classes | Cite |
|---|---|---|---|
| Hover, filled button | one step lighter | `hover:bg-indigo-500` (indigo-600 base, §8.1; Pry's `hover:bg-indigo-400` on a 500 base is not used) | vocab §5 |
| Hover, secondary | fill one step lighter, text one step lighter | `hover:bg-zinc-700 hover:text-zinc-200` | vocab §5 |
| Hover, ghost | raised fill appears | `hover:bg-zinc-800 hover:text-zinc-100` | vocab §5 |
| Hover, card | accent border at 40 % | `hover:border-indigo-500/40` | vocab §2 |
| Hover, row | panel tint | `hover:bg-zinc-900/60` | vocab §6 |
| Hover, chip | border lightens | `hover:border-zinc-500` | vocab §5 |
| Focus, input | accent border and 1 px ring | `focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500` | vocab §4 |
| Focus, select | accent border | `focus:border-indigo-500 focus:outline-none` | vocab §4 |
| Focus, button and link | 2 px offset outline, keyboard only | `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400` | vocab §4 |
| Focus, Term | 1 px ring, no offset | `focus:outline-none focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-indigo-400` | vocab §4 |
| Focus, split divider | fill turns accent | `focus:outline-none focus-visible:bg-indigo-400` | vocab §1 |
| Selected, tab | accent underline and text | `border-b-2 border-indigo-400 text-indigo-300` | vocab §4 |
| Selected, nav item (header) | same as tab | `border-b-2 border-indigo-400 text-indigo-300` | vocab §1 narrow tabs |
| Selected, toggle | tinted fill | `bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60` | vocab §4 |
| Selected, segmented | solid fill | `bg-indigo-600 text-white` (Pry's indigo-500 is 4.47 : 1 with white and fails §8.1; `03-components.md` §16) | vocab §4 |
| Selected, chip | ringed tint | `border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50` | vocab §4 |
| Selected, list row | raised fill | `bg-zinc-800/80` | vocab §4 |
| Pressed (aria-pressed) | tint with accent border | `border-indigo-600 bg-indigo-950/40 text-indigo-300` | vocab §4 |
| Active (drag) | solid accent | `bg-indigo-500` | vocab §1 divider |
| Disabled | half opacity, no pointer | `disabled:cursor-not-allowed disabled:opacity-50` (icons `opacity-30`) | vocab §5 |
| Disabled with reason | as above, plus the reason as visible `text-xs text-zinc-500` beside it, never only a `title` | (no extra class) | pre-read §2.6 |
| Loading, button | spinner replaces icon, label becomes "…" form, `aria-busy` | `inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent` | vocab §5 |
| Error, field | red border and tint, message below | `border-red-800 bg-red-950/40` + `text-xs text-red-400` | vocab §4 |
| Stale / warning | amber text or banner | `text-amber-400`; `border-amber-800/60 bg-amber-950/30 text-amber-200` | vocab §4 |
| Success | emerald text or chip | `text-emerald-400`; `bg-emerald-950/40 text-emerald-200` | vocab §4 |

Rules: focus is `focus-visible` on anything clicked with a mouse (buttons, rows, tabs) and plain `focus` on text inputs. Hover never changes size or position. Colour alone never carries a state: a selected tab has the underline, a disabled button has the reason, an outcome badge has its word.

## 5. Motion

| Motion | Classes or value | Where | Cite |
|---|---|---|---|
| Colour change | `transition-colors` (150 ms) | tabs, divider, cards, rows, buttons | vocab §10 |
| Bar fill | `transition-all` (150 ms); update bar `motion-safe:transition-[width] motion-safe:duration-300` | Bar, DivergingBar, Progress | vocab §6, §8 |
| Spinner | `animate-spin` | loading buttons, Loader2 icon | vocab §10 |
| Pulse | `animate-pulse` | boot dot, skeletons, waiting states | vocab §10 |
| Breathing dot | `animate-breathe` (1.6 s) | current step in a step list | vocab §7 `ls-breathe` |
| Ring pulse | `animate-ring-pulse` (1.6 s) | Pointer ring | vocab §7 |
| Drawer | Svelte `fade 150ms` backdrop + `fly x:440 200ms` panel | Drawer | vocab §8 |
| Dialog | `fade 150ms` | Dialog | vocab §8 (backdrop) |
| Toast | `fly y:8 150ms` in, `fade 150ms` out | Toast | new to Flinch |
| Deck or thread card | `fly x:±16 240ms` | LoadingScreen deck; new turn in RunThread | vocab §10 |
| Tour card move | `top/left 150ms ease` | Tour card | vocab §10 |
| Loading screen enter | 360 ms fade | LoadingScreen | vocab §10 |

Reduced motion: every keyframe and Svelte transition checks `prefers-reduced-motion: reduce` (Pry: `LoadingScreen.svelte:722-736`, `Pointer.svelte:137`). Under reduce: durations become 0, `animate-pulse` and `animate-breathe` stop (the dot stays solid), `animate-spin` is kept (it is the only cue the button is busy), and the Pointer ring is static. Tailwind `motion-safe:` prefixes any decorative animation; `motion-reduce:` is not used because the default is the reduced form.

## 6. Number formatting

These are rules for a `lib/format.ts` whose tests pin every example. They apply the pre-read §2.1 rule that every number shows what it is made of.

| Rule | Form | Example |
|---|---|---|
| Counts first | "r of N" always; a percentage never appears without its count | "7 of 12 refused" |
| Percent | `pct(r, N)`: rounded to a whole percent at N ≥ 20, one decimal below that; never prints "0%" or "100%" unless r = 0 or r = N exactly; otherwise "<1%" and ">99%" | 1 of 300 → "<1%"; 299 of 300 → ">99%"; 0 of 12 → "0%" |
| Odds | `odds(p)`: "about 1 in N" where N = round(1/p), N ≥ 2; "about 2 in 3" style for p > 0.5 (numerator rounded); omitted when N > 1000 | 8.7% → "about 1 in 12"; 67.7% → "about 2 in 3" |
| Full form | `rate` = pct plus count in parentheses, or count plus pct; the component decides order but both are present | "58% (7 of 12)" |
| Minus sign | U+2212 "−", never a hyphen; a "+" always on positive signed values | "−12 pts", "+14 pts" |
| Differences | in "pts" (percentage points), never "%" of a % | "+3 pts" |
| Decimals | effect sizes two decimals; p-values three decimals, "<0.001" below that; never scientific notation | "d = 0.42", "p = 0.031", "p < 0.001" |
| Confidence intervals | "95% CI 41% to 73%", the word "to", no en dash | "95% CI 41% to 73%" |
| Durations | "2.1 s" under a minute, "1 min 12 s" above; elapsed "0:15" mono | "2.1 s", "0:15" |
| Tokens and cost | "412 tokens", "$0.0031"; cost "about $0.03" when estimated | "about $0.03" |
| Tabular numbers | every numeric column and counter has `tabular-nums`; right-aligned in tables | (class rule) |
| Thousands | thin space U+2009 as the separator above 9999 | "12 400" |
| Unknown | "n/a" in `text-zinc-600` with a Term explaining why, never a blank cell, never "0" | "n/a" |

A bare number (a percentage without its count, a confidence without the word "guess", a d without its two sample sizes) is a type error in the component API (`03-components.md` Rate, Stat) and a copy-lint failure in strings (`§7`).

## 7. Copy rules

Tested like code (pre-read §2.8). `lib/copy/copy-lint.test.ts` runs over every string in `lib/copy/*.ts` and every `data-copy` attribute in rendered fixtures.

1. **Sentence case** everywhere: nav items, tab labels, buttons, headings, eyebrows (the uppercase is CSS, the string is sentence case).
2. **No em dash** (U+2014) or en dash (U+2013) in any visible string; use a comma, a colon or a full stop. Ranges use "to".
3. **Ellipsis** is the single character "…" (U+2026), only in progress labels ("Sending…", "Loading…").
4. **Empty states are full sentences** ending in a period, and say what to do: "Pick a probe on the left, or run all of them." Never "No data", "Empty", "Nothing here".
5. **Every number carries its source** in the same sentence or the same row (§6).
6. **Explain, don't rename**: probe, pushback, move (and the seven move names), the four outcomes, condition, variant group, snapshot, experiment, benchmark, MTLD, Cohen's d, Mann-Whitney U keep their names; a plain-words clause sits beside the first use on a screen, and every term is a `Term`.
7. **Banned model-mind verbs** (lint list, extends Pry `lint-words.yaml`): thinks, believes, knows, decides, wants, feels, understands, realises, focuses on, pays attention to, is confident, is sure, refuses to admit, makes up its mind, changes its mind. Allowed: refused, complied, collapsed, negotiated, replied, wrote, held, gave way, the label, the judge's guess.
8. **Retired phrases**: "the model's confidence", "jailbreak", "bypass", "trick", "exploit", "attack", "the AI", "won" / "lost". Flinch is a research instrument; the pre-read and CLAUDE.md say so.
9. **Caveat phrases are pinned exactly** (`lib/copy/caveats.test.ts`), draft list in `03-components.md` Caveat. A screen that shows a rate, a label, a held refusal or a coach confidence must render its pinned caveat; the test renders each screen fixture and asserts the phrase.
10. **Draft strings** in this spec and the component spec are marked "(draft; brad-voice pass)"; the brad-voice pass happens in main context before they land in `lib/copy`.
11. **Spelling**: "Hugging Face" two words; "API key"; "system prompt"; "pushback" one word; "ad hoc" two words in prose, "Ad-hoc probe" as the list item name.
12. **No marketing**: no "powerful", "seamless", "effortless", "insights". A heading says what the screen is for.
13. **Shortcuts have one owner.** The keyboard shortcut table lives in `screens/overlays-help-shortcuts-toasts.md` R2 and nowhere else; `lib/copy/shortcuts.ts` is generated from it, and every other spec, this file included, cites that table and defines no key of its own (fix rulebook §6: global `?`, `/`, `Esc`, `Alt+1…n`; workbench-only `s p w k a e n ↑ ↓ Enter`; no global digit keys, no `r`).

## 8. Contrast check

WCAG 2.1 relative-luminance ratios, computed from the stock Tailwind 3.4 hex values in §1. AA: 4.5 : 1 for normal text, 3 : 1 for large text (≥ 24 px, or ≥ 19 px bold) and for UI component boundaries. Pass marks: **AA** = passes both; **large** = passes only at large size; **fail** = decorative use only.

Surfaces: page `#09090b` (zinc-950), panel `#18181b` (zinc-900), raised `#27272a` (zinc-800).

| Text token | hex | on page | on panel | on raised | Verdict |
|---|---|---|---|---|---|
| text.strong (zinc-50) | #fafafa | 19.06 | 16.97 | 14.27 | AA |
| text.primary (zinc-100) | #f4f4f5 | 18.10 | 16.12 | 13.55 | AA |
| text.body (zinc-300) | #d4d4d8 | 13.46 | 11.99 | 10.08 | AA |
| text.secondary (zinc-400) | #a1a1aa | 7.76 | 6.91 | 5.81 | AA |
| text.muted (zinc-500) | #71717a | 4.12 | 3.67 | 3.08 | large only; fails 4.5 on every surface |
| text.faint (zinc-600) | #52525b | 2.57 | 2.29 | 1.93 | fail |
| text.faintest (zinc-700) | #3f3f46 | 1.91 | 1.70 | 1.43 | fail |
| accent.text (indigo-300) | #a5b4fc | 9.98 | 8.89 | 7.47 | AA |
| accent.ring (indigo-400) | #818cf8 | 6.67 | 5.94 | 4.99 | AA |
| outcome.refused.text (red-400) | #f87171 | 7.19 | 6.40 | 5.38 | AA |
| outcome.collapsed.text (amber-400) | #fbbf24 | 11.92 | 10.61 | 8.92 | AA |
| outcome.negotiated.text (orange-400) | #fb923c | 8.79 | 7.83 | 6.58 | AA |
| outcome.complied.text (green-400) | #4ade80 | 11.42 | 10.17 | 8.55 | AA |
| outcome.unknown.text (zinc-400) | #a1a1aa | 7.76 | 6.91 | 5.81 | AA |
| signed.positive | #56b4e9 | 8.62 | 7.68 | 6.45 | AA |
| signed.negative | #e69f00 | 8.83 | 7.87 | 6.61 | AA |
| state.error (red-400) | #f87171 | 7.19 | 6.40 | 5.38 | AA |
| state.warn (amber-400) | #fbbf24 | 11.92 | 10.61 | 8.92 | AA |
| state.success (emerald-400) | #34d399 | 10.35 | 9.22 | 7.75 | AA |

Filled controls and composites:

| Pair | Ratio | Verdict |
|---|---|---|
| white on indigo-600 (accent DEFAULT: Button primary at rest, Segmented active) | 6.29 | AA |
| white on indigo-500 (accent.hover: Button primary hover; Pry's header primary and Segmented active, which Flinch does not use) | 4.47 | large only; a hair under 4.5, so Flinch uses indigo-600 for every filled label at rest (all are below 18.66 px) and indigo-500 only as the momentary hover |
| white on indigo-400 (Pry's hover of its indigo-500 primary) | 2.98 | fail; not used in Flinch (the hover is indigo-500 on an indigo-600 base) |
| zinc-100 on zinc-700 (secondary hover) | 9.50 | AA |
| indigo-300 on zinc-900 (active tab, readout answer) | 8.89 | AA |
| zinc-300 on indigo-950/30 over zinc-950 (Readout body) | 12.73 | AA |
| red-300 on red-900 (Retry button) | 5.28 | AA |
| zinc-500 on zinc-950 (placeholder, eyebrow) | 4.12 | large only |

Consequences, which `03-components.md` applies:

1. **Every filled accent control with a label uses `bg-indigo-600`**: Button primary (`hover:bg-indigo-500`) and the Segmented active option (`03-components.md` §15, §16), Pry's dialog variant, not its header variant (white on indigo-500 is 4.47, a hair under 4.5). The hover (indigo-500) is 4.47 and momentary, accepted. This is why `accent.DEFAULT` in §1 is indigo-600 and §4 lists no indigo-500 fill under a label.
2. **zinc-500 is for labels that are repeated or redundant**: eyebrows above a heading, form labels above a field with a placeholder, hints beside a control that also has a `Term`. It never carries the only copy of a fact. Wherever today's UI used `--text-muted #777` for a value, the rebuild uses zinc-400.
3. **zinc-600 and zinc-700 are decorative only**: scale ticks under a bar that also has a value, rank numbers beside a name, placeholder text in an input that has a visible label. The empty-state sentence, which Pry sets in zinc-600, is set in **zinc-500** in Flinch and is large enough (14 px) that 4.12 is accepted as the one deliberate exception, logged here.
4. **Outcome colours are never the only cue**: every badge prints its word; every bar has its count. Collapsed (amber) and negotiated (orange) are 1.3 : 1 apart from each other, which is the reason the word is mandatory.
5. The contrast test (`lib/tokens/contrast.test.ts`) recomputes this table from the config at test time and fails if any pair marked AA drops below 4.5 or any pair marked "large only" drops below 3.
