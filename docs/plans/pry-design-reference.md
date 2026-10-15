# Pry design reference (for the Flinch UI rebuild)

Source: BeargleIndustries/pry at 888bd51 (v0.4.0-alpha), surveyed 2026-10-15. Paths and line numbers are relative to the Pry repo root. This is where each design-language rule in the handoff §2 lives in Pry's code, so the Flinch rebuild can match it. Nothing here is a task; lessons and the lesson runner are out of scope for Flinch and are left out.

## Where the rules live

| Handoff §2 rule | Pry code |
|---|---|
| 1. Every number shows what it is made of | `ui/src/lib/readouts.ts` (plain-language sentence builders per panel, honesty rules in its header), `components/Readout.svelte`, `PredictionsPanel.svelte` (0-100% track, "Everything else" row), `DLAPanel.svelte` (bars total / logit / gap line), `PatchingPanel.svelte` (three logits + share formula), `SteeringPanel.svelte` (what changed, control run, both coherence numbers) |
| 2. Every result carries its limits | `ui/src/lib/copy/caveats.test.ts` pins six caveat phrases to the file or tip they must appear in; README "What to keep in mind" is the user-facing list |
| 4. Explain, don't rename | `lib/glossary.ts` + `components/Term.svelte` (real term, plain definition on hover) |
| 6. Guided entry | `lib/tips/tips-registry.ts` + `components/FirstTimeTip.svelte`; `components/LoadingScreen.svelte` (step it is on, elapsed time, tips deck); `lib/popup/place.ts` (one placement rule for every popup) audited by `scripts/dev/popup-audit.mjs` |
| 8. Copy tested like code | `lib/copy/visible-strings.ts` and `visible-strings.test.ts`, `copy-closure.test.ts`, `copy-pass.test.ts`, `overstatement-closure.test.ts`, `copy-files.ts` |
| 10. Signed self-updating installer | `scripts/release.ps1`, `docs/releasing.md`, `src-tauri/tauri.conf.json` `plugins.updater`, `components/UpdateCard.svelte` |

## Design system and shared UI
- Tokens: `ui/tailwind.config.js` has `darkMode: 'class'` and an empty `extend` (the shadcn colour tokens are commented out). `ui/src/app.css` (31 lines) has the Tailwind layers and `:root {color-scheme: dark; system-ui font}`. `app.html:2` sets `<html class="dark">`. Theming is dark only. Colours are inline Tailwind (zinc-950/900/800 surfaces, zinc-300/400 text, indigo-900/950 accents). There is no token file; "design language" means these class conventions, the Readout box, the Term hover, the tip cards and the popup rule.
- `lib/components/Term.svelte` (137 lines) is a glossary word with a dotted underline. It shows a definition from `lib/glossary.ts` (`lookupTerm`) on hover or focus via `placePopup`, `measure.ts` and `occupied.svelte.ts`. It uses aria-describedby, z-[70], and never takes focus.
- `lib/readouts.ts` (654 lines) holds plain-language sentence builders per panel (`predictionsReadout`, `logitLensReadout`, `dlaReadout`, `attentionReadout`, `featuresReadout`, `patchingReadout`, `circuitReadout`, `steeringReadout`, plus pinned constants). Honesty rules are in the header (1-11). `components/Readout.svelte` (28 lines) is a `role=status aria-live=polite` box (`border-indigo-900/50 bg-indigo-950/30 text-xs`) with an sr-only "In plain words:" prefix.
- `lib/popup/place.ts` (601 lines) is pure geometry, one rule for every popup. Modes: sheet (viewport < 760), anchored (preferred side, then opposite, then cross sides, shrinking to minW), inset (large targets, at the focus point), nearest, fallback. It also computes arrows and carets. Exports `placePopup`, `DEFAULT_SHEET_BELOW=760`, `MAX_ARROW=160`, `jumped`, `placementFlags`.
- First-time tips: `lib/tips/tips-registry.ts` defines `TipDef {id, title, target(selector), blurb, why, placement, focus?}` and `tipsRegistry`. Seen state is localStorage `pry:tip_seen:{id}` (`tips/coordinate.ts`: `markTipSeen`, `isTipSeen`, `resetAllTips`). `components/FirstTimeTip.svelte` (422 lines) is z-60 and uses a MutationObserver, an IntersectionObserver and placePopup.
- Loading screen: `components/LoadingScreen.svelte` (737 lines) shows load progress (`load-progress.ts`, which step it is on and how long it has been) plus a card deck from `lib/loading-deck.ts` (tips and terms).
- Window sizes: 1024×700 is the app's minimum window; 1280 is "wide" (`WINDOW_WIDE` in `lessons/layout.ts`). Screenshots and the popup audit run at both.
- `lib/copy/visible-strings.ts` (482 lines) extracts user-visible strings from .svelte, .ts and .json (`USER_FIELDS`, `CODE_FIELDS`, `visibleStrings(src, filename)`, `visibleHits`) so copy tests match only what users read.

## Caveat pins
- There is no `copy/caveats.ts`. Pins live in `ui/src/lib/copy/caveats.test.ts` (128 lines): `PINS: {caveat, where, phrase, lane, isNew?}[]` (27-80). `where` is a file under ui/src or `tip:<id>`. The tests are `describe('honesty caveats are present')` with `covers all six caveats` and one `it` per pin. The six caveats are: DLA direct only; Edges = direct value path; Compare = correlation; Labels auto-generated; Neuronpedia; Logit lens rough early. Related tests: copy-closure, copy-pass, overstatement-closure, visible-strings, and copy-files.ts (`PENDING_LANES`, `read`).
- Flinch's equivalent is a list of its own caveats (classifier is a guess; a rate from N runs; a held refusal after one pushback; product filters) pinned to the screens that show those results.

## Gates and scripts
- `ui/package.json` scripts: `check` = `svelte-kit sync && svelte-check`; `test` = `svelte-kit sync && vitest run`; `lint` = prettier; `build` = `vite build`.
- `scripts/dev/popup-audit.mjs` is a CDP driver (Node 22, no deps). It needs a `VITE_POPUP_AUDIT=1` build. It emulates sizes (1280x800, 1024x700, ...), loads `/?popupAudit=1`, and reads `window.__popupAudit` (no tip over another surface, no arrow over 160 px), and can run axe-core with `--a11y`. It exits non-zero on FAIL or SKIP. `scripts/dev/geometry.mjs` diffs popup geometry against the previous release with an allow-list (`geometry-allowed-additions.json`).
- `scripts/release.ps1` (115 lines): sets `TAURI_SIGNING_PRIVATE_KEY` to a key path (default `$HOME\.tauri\pry-updater.key`), runs `cargo tauri build --ci`, restores the Cargo.toml bytes, clears the env vars, requires `<installer>.sig`, writes `latest.json` (`{version, notes, pub_date, platforms.windows-x86_64 {signature, url}}`), prints the SHA256 and a `gh release create` command it does not run. `-SkipBuild` only rewrites latest.json. No key material is in the repo.
- `docs/releasing.md` (47 lines): version bump in three places, the tag, the script, "don't mark pre-release" (the `latest` URL skips pre-releases). The update replaces the app only, not the runtime venv. `stop_sidecar_for_update` runs before install.
- `src-tauri/tauri.conf.json`: `bundle.createUpdaterArtifacts: true`; `plugins.updater` = `{pubkey, endpoints: ['https://github.com/BeargleIndustries/pry/releases/latest/download/latest.json'], windows: {installMode: 'passive'}}`. The CSP allows connect to `127.0.0.1:*` and `ws://127.0.0.1:*`. `components/UpdateCard.svelte` is the in-app update card.

## Sidecar transport (Flinch's shell was adapted from this)
- Rust, `src-tauri/src/sidecar.rs` (853 lines):
  - `launch_with_app` (491+) picks a free port (portpicker) and resolves Python: managed venv from `%LOCALAPPDATA%/Pry/runtime/active.json`, then `PRY_PYTHON_OVERRIDE`, then system python in dev.
  - Spawns `python -m pry_sidecar.main` with `PRY_PORT`, `PYTHONUNBUFFERED`, `PRY_TOKEN` (a fresh random token per launch, `generate_token` at 478), optional HF_HOME and the saved HF token.
  - On Windows it uses a job object (kill-on-close).
  - Waits up to 60 s for the stdout sentinel `READY {port}`, then drains stdout. stderr goes into a ring buffer.
  - A heartbeat polls `{base}/health` (10 s timeout). Crashes emit `sidecar:crashed`; restart emits `sidecar:restarted`. Concurrency rule: tokio Mutex if held across await, std Mutex otherwise.
- Commands in `src-tauri/src/lib.rs`: `sidecar_url`, `sidecar_connection` (returns `{base_url, token}`), `restart_sidecar`, `stop_sidecar_for_update`, `sidecar_stderr`, `open_devtools`, `probe_hardware`, `evaluate_presets`, `cached_hardware_report`.
- UI, `ui/src/lib/sidecar.ts` (674 lines):
  - `resolveConnection` invokes `sidecar_connection`, retrying 40 times at 750 ms on cold start. Under `npm run dev` it falls back to `VITE_PRY_SIDECAR` or `http://127.0.0.1:8765`.
  - The connection is cached and invalidated on the crash and restart events.
  - `sidecarFetch` adds `X-Pry-Token`; on a network error or 403 it re-resolves once and retries once. `request<T>` turns non-OK responses into a `SidecarError` with friendly text (`sidecar-errors.ts`).
  - `loadPreset` reads the `/load` SSE-style stream (`data: {...}\n\n`, stages up to ready, already_loaded or error).
- `analysis-core.ts:49-54`: `SidecarCaller = (req{endpoint, model, body}, fetcher) => Promise`, with `directCall` as the pass-through.
- Python (`sidecar/pry_sidecar/main.py`) is Starlette. Auth middleware (1303-1322) requires `X-Pry-Token` when PRY_TOKEN is set. Routes (1256-1275): GET /health, GET /models, POST /load, /unload, /custom-models/validate, /generate, /sae-features, /logit-lens, /dla, /steer, /ablate-head, /ablate-feature, /patch, /tokenize, /embedding, /circuit, /head-scores, GET /feature/{id}, POST /concept-search.
