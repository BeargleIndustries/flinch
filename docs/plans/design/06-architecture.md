# Flinch rebuild: frontend architecture

Draft 1, 2026-10-16. Status: **binding on every lane once the build plan v2 cites it.** Written against the Architect review of the spec set (findings 1–16) so the app as a whole is buildable, not only each screen.

Precedence: where a screen spec and this file disagree on app structure, API client, streams, stores, persistence, first launch, desktop detection, or lane ownership, **this file wins** and the screen spec is edited to cite the section here. Screen specs keep authority over their own layout, bindings, copy and acceptance checks. Decisions already recorded in `../flinch-rebuild-input-2026-10-15.md` are not reopened: SvelteKit 5 + Tailwind 3.4 (1.1), schema additive-only (1.3 as narrowed by 2.3), rows 18 and 19 in (4.1), static build served by FastAPI behind the Tauri splash (consensus record, iteration 2).

Reading order for a developer: `01-information-architecture.md` §2–3, `02-tokens.md`, `03-components.md`, this file, then the screen spec for the lane.

---

## 1. Project layout, build and serving

### 1.1 Directory

```
flinch-ui/                      the SvelteKit app (new, repo root)
  package.json
  svelte.config.js
  vite.config.ts
  tailwind.config.js            the block in 02-tokens.md §1, verbatim
  postcss.config.js
  tsconfig.json
  playwright.config.ts
  src/
    app.html
    app.css                     @tailwind layers + the .page tokens (§11)
    routes/                     §2
    lib/
      api/    client.ts stream.ts types.d.ts (generated) endpoints.ts streams/<kind>.ts
      stores/ session.svelte.ts keys.svelte.ts shell.svelte.ts runs.svelte.ts toast.svelte.ts tips.svelte.ts prefs.svelte.ts updates.svelte.ts
      persist.ts nav.ts format.ts
      copy/   caveats.ts readouts.ts strings.ts  (+ *.test.ts)
      glossary/ index.ts
      components/ (one file per 03-components.md section)
      types/ display.ts
      popup/ place.ts
  e2e/                          Playwright specs (§12)
  static/favicon.png
flinch/static/                  BUILD OUTPUT, committed (§1.6); today's api.js, app.js … are deleted by the integrator on the first build commit
```

### 1.2 `package.json`

```json
{
  "name": "flinch-ui",
  "version": "0.9.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
    "test": "svelte-kit sync && vitest run",
    "test:e2e": "playwright test",
    "types": "openapi-typescript http://127.0.0.1:8000/openapi.json -o src/lib/api/types.d.ts",
    "types:check": "npm run types -- -o /tmp/flinch-types.d.ts && diff -q /tmp/flinch-types.d.ts src/lib/api/types.d.ts",
    "lint": "prettier --check ."
  },
  "dependencies": {
    "@tauri-apps/api": "2.1.1",
    "lucide-svelte": "0.460.1"
  },
  "devDependencies": {
    "@playwright/test": "1.48.2",
    "@sveltejs/adapter-static": "3.0.6",
    "@sveltejs/kit": "2.8.1",
    "@sveltejs/vite-plugin-svelte": "4.0.1",
    "autoprefixer": "10.4.20",
    "openapi-typescript": "7.4.3",
    "postcss": "8.4.49",
    "prettier": "3.3.3",
    "prettier-plugin-svelte": "3.2.8",
    "svelte": "5.1.9",
    "svelte-check": "4.0.9",
    "tailwindcss": "3.4.15",
    "tslib": "2.8.1",
    "typescript": "5.6.3",
    "vite": "5.4.11",
    "vitest": "2.1.9"
  }
}
```

Pins are exact (no `^`); `package-lock.json` is committed. L0 may move a pin to a later patch release on install day and records the change in its PR; majors never move inside this release. `version` tracks `pyproject.toml` (0.9.0 for this release) and is the value `kit.version.name` pins (§1.3), so the build is deterministic for the same inputs (consensus record, iteration 1 blocker).

### 1.3 `svelte.config.js`

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: '../flinch/static',
      assets: '../flinch/static',
      fallback: 'index.html',   // FastAPI serves this file at "/" (app.py:244)
      precompress: false,
      strict: false,
    }),
    router: { type: 'hash' },   // every route is #/…; no server route per deep link (IA §3)
    paths: { base: '', relative: false },
    prerender: { entries: [] },
    version: { name: pkg.version, pollInterval: 0 },  // deterministic _app/version.json; no version polling
    csp: { mode: 'hash', directives: { 'script-src': ['self'] } },
  },
};
```

Why each line: `router.type: 'hash'` makes `#/probe/3` a client route with `location.hash` as the source of truth (§2); `pages` and `assets` land the build where the sidecar already serves files; `fallback` is the single HTML the sidecar returns at `/`; `csp` in hash mode writes a `<meta http-equiv="Content-Security-Policy">` with `script-src 'self' 'sha256-…'` for SvelteKit's own inline init script, which is the only inline script allowed (the Tauri CSP in `tauri.conf.json:19` governs the splash page on `tauri.localhost`, not the app on the sidecar origin, so the app carries its own).

### 1.4 `vite.config.ts`, `src/app.html`, `src/routes/+layout.ts`

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const SIDECAR = process.env.FLINCH_SIDECAR ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': { target: SIDECAR, changeOrigin: false },
      '/health': { target: SIDECAR, changeOrigin: false },
      '/static': { target: SIDECAR, changeOrigin: false },
    },
  },
  clearScreen: false,
});
```

```html
<!-- src/app.html -->
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/static/favicon.png" />
    %sveltekit.head%
  </head>
  <body class="bg-zinc-950 text-zinc-100">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

```ts
// src/routes/+layout.ts
export const ssr = false;        // required by the hash router; the app is a static client bundle
export const prerender = false;  // one fallback index.html, nothing prerendered
```

Dev loop: terminal 1 `python -m flinch.app` (port 8000); terminal 2 `npm run dev` → `http://127.0.0.1:5180/#/`. The proxy keeps every request same-origin so `lib/api/client.ts` needs no dev base URL. SSE passes through Vite's proxy unbuffered. `FLINCH_SIDECAR` points the proxy elsewhere (a `--port` run).

### 1.5 How the sidecar serves the build

Today `app.py:131` mounts `/static` → `flinch/static/` and `app.py:244` returns `flinch/static/index.html` at `/`. The SvelteKit build writes `flinch/static/index.html` and `flinch/static/_app/**` (immutable hashed chunks), and the page references `/_app/immutable/...` at the root. One backend change (L0, counted in §8 as B4):

```python
# flinch/app.py, beside the /static mount at :131
app.mount("/_app", StaticFiles(directory=str(STATIC_DIR / "_app"), check_dir=False), name="app_assets")
```

`check_dir=False` lets the server start in a checkout where the build has not run (the route then 404s; `/` still returns the old or missing index). The favicon is `flinch/static/favicon.png`, served by the existing `/static` mount, which is why `app.html` links `/static/favicon.png` and not `%sveltekit.assets%/favicon.png`. Nothing else in `app.py` changes for serving; `allow_origin_regex` (`app.py:120-128`) already admits `127.0.0.1:*` and `localhost:*`, which covers the Vite dev origin.

Packaging, verified in this checkout: `pyproject.toml` builds with hatchling and declares no `include`/`exclude`, so the wheel carries every file under `flinch/` that git does not ignore, which includes `flinch/static/**` as long as the build output is committed (§1.6); `src-tauri/tauri.conf.json:46` lists `"../flinch/static/**/*"` in `bundle.resources`, so the NSIS installer copies the same files, and `scripts/bundle-resources.py:130` builds the wheel with `pip wheel . --no-deps`, which packages whatever the checkout holds. No change to either file.

### 1.6 The committed-build rule

- `flinch/static/` holds the **output** of `npm run build`, committed to git. It is never hand-edited. The source is `flinch-ui/`.
- Only the **integrator** (the person or lane closing a gate) runs `npm run build` and commits `flinch/static/`, in a commit that touches nothing else, titled `build: flinch/static from flinch-ui@<short sha>`. Feature lanes never commit `flinch/static/` (consensus record, iteration 1); their gates run `npm run build` to a temp dir to prove the build is clean.
- Because `kit.version.name` is pinned and chunk names are content hashes, two builds of the same source produce the same tree; the integrator's gate diffs a second build against the committed one.
- `.gitattributes` at the repo root:

```
flinch/static/** -text
*.png binary
```

(`-text` stops line-ending normalisation from altering hashed chunks on Windows checkouts; the binary line covers the favicon and icons.)

---

## 2. Routes

### 2.1 `src/routes/` tree, 1:1 with IA §3

SvelteKit's hash router maps `#/probe/3` to the same `src/routes/` files a path router would. Every IA route and every sub-route a screen spec declares has a file; a screen with tabs or a drawer uses an optional parameter so the same component renders both.

| Route (IA §3 + screen specs) | File |
|---|---|
| `#/` | `routes/+page.svelte` (Home) |
| `#/probe` | `routes/probe/+page.svelte` (Sessions) |
| `#/probe/:s`, `#/probe/:s/run/:r` | `routes/probe/[s]/[[run]]/[[r]]/+page.svelte` (Workbench) |
| `#/studies` | `routes/studies/+page.svelte` |
| `#/studies/new`, `#/studies/new/:type` | `routes/studies/new/[[type]]/+page.svelte` |
| `#/studies/repeat/:id`, `…/run/:n` | `routes/studies/repeat/[id]/[[run]]/[[n]]/+page.svelte` |
| `#/studies/framing/:id` | `routes/studies/framing/[id]/+page.svelte` |
| `#/studies/models/:id`, `…/cell/:probe/:model` | `routes/studies/models/[id]/[[cell]]/[[probe]]/[[model]]/+page.svelte` |
| `#/studies/models/sessions/:ids` | `routes/studies/models/sessions/[ids]/+page.svelte` |
| `#/studies/context/:id`, `…/run/:run_id` | `routes/studies/context/[id]/[[run]]/[[runId]]/+page.svelte` |
| `#/studies/context/batch/:batch_id` | `routes/studies/context/batch/[batchId]/+page.svelte` |
| `#/studies/snapshots/:s`, `…/diff/:snap`, `…/probe/:p` | `routes/studies/snapshots/[s]/[[diff]]/[[snap]]/[[probe]]/[[p]]/+page.svelte` |
| `#/experiments` | `routes/experiments/+page.svelte` |
| `#/experiments/new` | `routes/experiments/new/+page.svelte` |
| `#/experiments/:id`, `…/:tab` | `routes/experiments/[id]/[[tab]]/+page.svelte` (tab ∈ conditions, responses, analysis, export) |
| `#/benchmarks` | `routes/benchmarks/+page.svelte` |
| `#/benchmarks/new` | `routes/benchmarks/new/+page.svelte` |
| `#/benchmarks/runs/:id`, `…/:tab` | `routes/benchmarks/runs/[id]/[[tab]]/+page.svelte` (tab ∈ progress, results, compare) |
| `#/benchmarks/suites/:suite` | `routes/benchmarks/suites/[suite]/+page.svelte` |
| `#/library/probes`, `…/:id` | `routes/library/probes/[[id]]/+page.svelte` |
| `#/library/variants`, `…/:gid`, `…/new` | `routes/library/variants/[[gid]]/+page.svelte` (`new` is a reserved value of `gid`) |
| `#/library/policies`, `…/:provider`, `…/:provider/:claimId` | `routes/library/policies/[[provider]]/[[claimId]]/+page.svelte` |
| `#/library/coach`, `…/:id` | `routes/library/coach/[[id]]/+page.svelte` |
| `#/library/strategies`, `…/:id` | `routes/library/strategies/[[id]]/+page.svelte` |
| `#/results` | `routes/results/+page.svelte` |
| `#/results/scorecard`, `…/:snapshotId` | `routes/results/scorecard/[[snapshotId]]/+page.svelte` |
| `#/results/publication`, `…/:exportId` | `routes/results/publication/[[exportId]]/+page.svelte` |
| `#/settings` (+ anchors) | `routes/settings/+page.svelte` |
| any unknown hash | `routes/+error.svelte` ("That page does not exist." with a link to `#/`) |

`routes/+layout.svelte` renders the Header (03 §1) and the Toast stack, mounts the `shell`, `session` and `keys` stores once, and shows the boot row (vocab §1) until `GET /health` answers; it never redirects (§7). Dialogs (new session, add/import probes, overlays) have no route files; the overlays' `?overlay=` and `?tour=` query lives in the hash query (§2.2).

### 2.2 The `#/route#anchor` convention and `lib/nav.ts`

A Flinch location is `#/path[?query][#anchor]`. The hash router owns `#/path?query`; the trailing `#anchor` is Flinch's own and names a `Section` id (03 §2.5) on the page: `#/settings#keys`, `#/settings#benchmarks`, `#/settings#about`, `#/settings#coach`, `#/settings#local` are the five in use. SvelteKit does not parse a second `#`, so `nav.ts` does, and every link and `goto` goes through it.

```ts
// lib/nav.ts
export interface Loc { path: string; query: URLSearchParams; anchor: string | null }

/** Parse location.hash: "#/settings?x=1#keys" → {path:"/settings", query, anchor:"keys"}. */
export function parseHash(hash = location.hash): Loc {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const [routePart, anchor = null] = splitOnce(h, '#');
  const [path, qs = ''] = splitOnce(routePart || '/', '?');
  return { path: path || '/', query: new URLSearchParams(qs), anchor };
}

export function href(path: string, o: { query?: Record<string, string>; anchor?: string } = {}): string {
  const qs = o.query ? '?' + new URLSearchParams(o.query).toString() : '';
  return `#${path}${qs}${o.anchor ? '#' + o.anchor : ''}`;
}

/** Navigate; after the route renders, scroll to and focus the anchor's first control. */
export async function goto(path: string, o: { query?: Record<string, string>; anchor?: string; replace?: boolean } = {}) {
  const { goto: kitGoto } = await import('$app/navigation');
  await kitGoto(href(path, o), { replaceState: o.replace ?? false });
  if (o.anchor) await scrollToAnchor(o.anchor);
}

/** Scroll `#id` into view and focus its first focusable child; waits one frame for mount. */
export async function scrollToAnchor(id: string): Promise<boolean> { /* rAF, scrollIntoView({block:'start'}), focus */ }
```

Rules: `<a href={href('/settings', {anchor:'keys'})}>` for links (so the browser back button works); `goto` for programmatic moves; the layout calls `scrollToAnchor(parseHash().anchor)` on every hash change so a pasted `#/settings#keys` lands on the section (settings.md check 11). Tabs that are routes (`/experiments/:id/:tab`) use `goto(..., {replace: true})` on tab change so Back leaves the screen, not the tab. Hash-query keys in use: `?session=`, `?suite=`, `?variants=`, `?group=`, `?p=`, `?r=`, `?type=` … (studies filters), `?overlay=shortcuts|glossary`, `?tour=1`, `?shell=desktop` (read once by `shell`, §5.3, then stripped with `replace: true`).

---

## 3. `lib/api/client.ts`

Same-origin always: the page is served by the sidecar (desktop and `python -m flinch.app`) or by Vite with the proxy (dev). There is no base URL to resolve, no token, and nothing to re-resolve when the sidecar restarts: if it comes back on a new port the page's origin is gone and only the Tauri splash relaunch (which re-resolves, `ui/splash.js:114`) recovers; in the browser the person reloads. The client therefore retries exactly once on a network error, after a 500 ms `GET /health` probe succeeds (a sidecar mid-restart on the same port in dev), and otherwise fails fast.

```ts
// lib/api/client.ts
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOpts {
  signal?: AbortSignal;
  timeoutMs?: number;      // default 30_000; 0 = none (whittle, compare-sessions, validate-key, exports)
  query?: Record<string, string | number | boolean | undefined>;
  raw?: boolean;           // resolve the Response instead of JSON (file downloads)
}

export type ApiErrorKind = 'http' | 'validation' | 'network' | 'timeout' | 'aborted' | 'parse';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    public readonly status: number,          // 0 for network/timeout/aborted
    public readonly detail: string,          // the server's `detail` string, or a client sentence
    public readonly fields: { loc: (string | number)[]; msg: string; type: string }[] = [], // 422 only
    public readonly path = '',
  ) { super(detail); this.name = 'ApiError'; }
}

export async function request<T>(method: Method, path: string, body?: unknown, o: RequestOpts = {}): Promise<T>
```

Behaviour, pinned by `client.test.ts`:

1. `path` starts with `/api/` or is `/health`; `query` is appended with `URLSearchParams` (undefined values dropped). Bodies are JSON with `Content-Type: application/json`; `DELETE` with query only (e.g. `DELETE /api/settings/set-key?provider=`).
2. **Server error shapes** (FastAPI): `HTTPException(status, "text")` → `{"detail": "text"}` → `ApiError('http', status, text)`. Pydantic 422 → `{"detail": [{"loc": ["body","probe_id"], "msg": "...", "type": "..."}]}` → `ApiError('validation', 422, "<first msg>", fields)`. A non-JSON error body (500 from an unhandled exception) → `ApiError('http', status, "<status text>")`. A 2xx that is not JSON when JSON was expected → `ApiError('parse', status, …)`.
3. Some routes return `200 {"ok": false, "error": "…"}` or `{"valid": false, "error": "…"}` (set-key, validate-key, `app.py:3342-3393`): these are **not** thrown; the caller reads the flag. `endpoints.ts` types them so.
4. Timeout: `AbortSignal.timeout(timeoutMs)` combined with the caller's `signal` (`AbortSignal.any`); a timeout throws `ApiError('timeout', 0, "The server did not answer in 30 s.")`; a caller abort throws `ApiError('aborted', 0, …)` and is never shown as a toast.
5. Retry: on `TypeError` from `fetch` (network), wait 500 ms, `GET /health` with a 2 s timeout; if it answers 200, repeat the request once; otherwise throw `ApiError('network', 0, "Could not reach the Flinch server.")`. No retry on any HTTP status, ever (POSTs are not idempotent).
6. The toast store (§5.6) shows `detail` for every unhandled `ApiError` except `aborted`; screens that render the error inline (home R1 key save, settings R2) catch first.

**Types.** `npm run types` runs `openapi-typescript` against the live sidecar's `/openapi.json` and writes `src/lib/api/types.d.ts`, committed; `npm run types:check` fails the gate when the committed file is stale. Request bodies and route paths are fully typed from it (`paths['/api/sessions/{session_id}/run']['post']['requestBody']`). Most responses are untyped in FastAPI (handlers return `dict`), so `lib/api/endpoints.ts` declares one typed function per route the screen specs call, with a hand-written response interface that cites the `db.py`/`app.py` line the binding table cites, e.g. `getRunTurns(runId): Promise<RunTurn[]>` with `RunTurn = {id, run_id, role: 'probe'|'response'|'pushback', content, classification: Label|null, created_at, latency_ms: number|null, input_tokens: number|null, output_tokens: number|null, label_source: 'keyword'|'judge'|'person'|null, pushback_source: 'coach'|'override'|null, pushback_move: string|null}` (§8). Every "Source route / JSON field" cell in a screen spec maps to a field on one of these interfaces; the contract test `tests/contract/*.test.ts` loads recorded responses from the fixture DB (`npm run fixtures:record`, L0 script) and type-checks them against the interfaces with `satisfies`.

---

## 4. `lib/api/stream.ts`

Every stream route in `app.py` is a **POST** (`/batch` :540, `/batch-conditions` :572, `/stat-run` :2560, `/sequences/{id}/run-auto` :2038, `/sequence-batches/{id}/start` :2172, `/experiments/{id}/start` :2901 and `/resume` :2928, `/metrics` :2950, `/rate` :2966, `/hh-import` :2846, `/resume-conditions` :3260, benchmarks `/runner/install`). **`EventSource` is never used**: it can only GET, so it cannot reach any of them (review finding 2; it also cannot carry a JSON body or be aborted with a signal). Every screen that wrote "EventSource" or asserted `readyState === 2` (probe-workbench R8/§11 #18, home R2/#11, study-repeat, study-context R9, studies-new, study-framing) is edited to "the runs store (06 §5.4) opens the stream with `streamSSE`; the check asserts `signal.aborted` and that no further events apply".

Two server shapes exist and the parser accepts both frame by frame:

- **Named events** (`event: progress\ndata: {...}\n\n`): batch, batch-conditions, stat-run, run-auto, sequence-batches, resume-conditions.
- **Data-only JSON** (`data: {"type": "progress", ...}\n\n`): experiment start/resume, metrics, rate (`type` field); hh-import uses `data: {"event": "complete", ...}`.

```ts
// lib/api/stream.ts
export interface StreamEvent<D = unknown> { name: string; data: D; raw: string }
export type StreamEnd =
  | { state: 'done' }                       // server closed after a terminal event
  | { state: 'interrupted'; reason: string } // closed with no terminal event, or network error mid-stream
  | { state: 'aborted' }                    // the caller's signal fired
  | { state: 'error'; error: ApiError };    // non-2xx before any frame, or a terminal `error` event

export interface StreamOpts {
  signal: AbortSignal;                      // required: every stream is cancellable
  terminal?: string[];                      // event names that end the stream cleanly; default ['complete','batch_complete','cancelled','run_end','error']
  onEvent(ev: StreamEvent): void;
}

export function streamSSE(path: string, body: unknown, o: StreamOpts): Promise<StreamEnd>
```

Parser rules, pinned by `stream.test.ts` with fixtures copied from `app.py:555-569`, `runner.py:240-285`, `runner.py:493-533`, `stat_runner.py:63-180`:

1. `fetch(path, {method:'POST', body: JSON, headers, signal})`; a non-2xx resolves `{state:'error', error}` using §3 rule 2. `res.body` read with `getReader()` and a `TextDecoder({stream:true})`; frames split on `\n\n` (also `\r\n\r\n`); the remainder is kept across reads.
2. In a frame, `event:` sets the name, each `data:` line is appended (joined by `\n`), `:` comment lines and `id:`/`retry:` are ignored. No `event:` line → name `message`.
3. `data` is parsed as JSON; a non-JSON payload is delivered as `{name, data: null, raw}`. When the name is `message` and the JSON has a string `type`, the name becomes that `type` (experiment shape); else if it has a string `event`, that (hh-import shape).
4. Heartbeats (`{type:'heartbeat'}`) are delivered (the runs store uses them to refresh `lastSeen`) and are never terminal.
5. The stream ends `done` when a terminal name was seen and the body closes; `interrupted` when the body closes without one (the sidecar died, the experiment generator raised, Vite's proxy dropped). `AbortError` → `aborted`. **No backoff, no reconnect**: none of these routes can resume a stream mid-way (a resumed experiment is a new POST), so a dropped stream is reported as `interrupted` and the owning store switches to polling where a poll route exists (experiments `/progress`, sequences `/sequences/{id}`, sequence batches `/sequence-batches/{id}`) or shows the interrupted state (batch, stat-run: no poll route).
6. Per-route event unions live in `lib/api/streams/<kind>.ts` so screens never read `data` untyped, e.g. `BatchEvent = {name:'start', data:{batch_id,total}} | {name:'progress', data:{batch_id, probe_id, probe_name, run_id, classification: Label, completed, total}} | {name:'error', data:{probe_id, error, completed, total}} | {name:'cancelled', data:{batch_id, completed, total}} | {name:'complete', data:{batch_id, total, completed, failed}}` (§8.5 adds `start` and `cancelled`); `ExperimentEvent = started | progress | heartbeat | complete` as `experiment.md` R4 lists; `StatRunEvent = batch_start | start | iteration | iteration_error | complete | batch_complete | error`; `SequenceEvent = turn | complete | error`; `SequenceBatchEvent = progress | error | complete`.

---

## 5. Stores (`lib/stores/*.svelte.ts`, Svelte 5 runes modules)

Each store is a module with `$state` fields and exported functions; components read `store.x` and never assign to it. Module-level state survives route changes (the app is one page) and is reset only by a reload. The "writes / reads" columns are the ownership rule: a lane not listed under "writes" sends a PR to L0.

### 5.1 `session`

```ts
export const session = $state({
  current: null as SessionSummary | null,           // {id, name, target_model, coach_backend, coach_model, coach_profile, system_prompt, probe_ids, created_at}
  recent: [] as SessionSummary[],                    // GET /api/sessions, newest 8 by created_at desc
  loading: false, error: null as ApiError | null,
});
export async function load(): Promise<void>;        // layout mount; refresh after create/delete
export async function open(id: number): Promise<void>; // GET /api/sessions/{id}; sets current; remembers id in prefs.lastSession
export function clear(): void;
```
Writes: layout (load), SessionSwitcher (open/clear), New session dialog (open after create), Sessions list and workbench menus (clear after delete). Reads: Header, Home status strip, every Probe/Studies screen (`current` is required there; a route param `:s` always wins and calls `open(s)`). The Experiments and Benchmarks sections read it only for the header.

### 5.2 `keys`

```ts
export const keys = $state({
  list: [] as KeyRow[],   // GET /api/settings/keys → {env_var, provider, label, required, is_set, masked}
  ollama: null as { available: boolean; base_url: string; models: string[]; anthropic_key_set: boolean } | null,
  loadedAt: 0, warning: null as string | null,  // warning: Credential Manager refused (settings R2)
});
export const setCount = $derived(keys.list.filter(k => k.is_set).length);
export const total = $derived(keys.list.length);     // 6 once HF_TOKEN joins (§8.8); the chip prints "r of N"
export function hasKeyFor(provider: string): boolean;
export async function refresh(): Promise<void>;      // keys + ollama/status, in parallel
```
Refresh triggers: layout mount; after every save, remove and test in Settings R2 and Home R1; after `POST /api/settings/ollama`; on window `focus` when `loadedAt` is older than 60 s. Writes: `refresh()` only (the two save paths call it; they never patch `list` by hand). Reads: KeyStatusChip, Home R1, Settings R2/R3, the disabled-Send reason in the workbench, New session dialog, New study, Experiments new, Benchmarks new.

### 5.3 `shell`

```ts
export const shell = $state({ desktop: false, origin: location.origin, version: null as string | null });
export function init(): void;  // once, in +layout.svelte before anything renders
```
`init()`: if `parseHash().query.get('shell') === 'desktop'` → `sessionStorage['flinch:shell'] = 'desktop'` and the query is stripped with `goto(path, {replace:true})`; then `desktop = sessionStorage['flinch:shell'] === 'desktop'`. `sessionStorage` is right here because it is per tab and per launch: the splash (`splash.md`) appends `?shell=desktop` on every launch, and a reload inside the same tab keeps it. `version` is filled from `GET /health` by the layout. **`window.__TAURI__` is never consulted** (it is not injected on the sidecar origin; settings.md Q1). Writes: `init()` and the layout. Reads: Settings (storage line, key-save path, About), Home R1 (key-save path), the `updates` store (update checks run only when `desktop`), every "Open folder" / diagnostics button (disabled with reason when not desktop).

### 5.4 `runs`

One store for every long-running thing, keyed by `kind:id`, alive across route changes (consensus record, iteration 3), with progress, cancel and the interrupted state. It is the only place `streamSSE` is called from a screen's point of view.

```ts
export type RunKind = 'batch' | 'batch-conditions' | 'stat-run' | 'experiment' | 'sequence' | 'sequence-batch'
                    | 'benchmark' | 'metrics' | 'raters' | 'hh-import' | 'runner-install';
export type RunStatus = 'running' | 'done' | 'cancelled' | 'interrupted' | 'error';
export interface RunEntry {
  key: `${RunKind}:${string}`; kind: RunKind; id: number | string; title: string; href: string; // where "View" goes
  startedAt: number; lastSeen: number; status: RunStatus;
  done: { count: number; of: number }; failed: number;
  outcomes: Record<string, number>;          // batch/stat-run: Outcome counts; benchmark: suite labels
  current: string | null;                    // "the-hotel-room", "the-stabbing × B × claude-…"
  events: StreamEvent[];                     // capped at 500, newest kept (the workbench results table reads these)
  error: string | null;
  cancel: (() => Promise<void>) | null;      // null when the server has no cancel route (sequences)
  abort: AbortController;
}
export const runs = $state({ entries: {} as Record<string, RunEntry> });
export const running = $derived(Object.values(runs.entries).filter(r => r.status === 'running'));

export function start(spec: {
  kind: RunKind; id: number | string; title: string; href: string;
  open: (signal: AbortSignal) => Promise<StreamEnd>;              // usually () => streamSSE(path, body, {signal, onEvent})
  reduce: (entry: RunEntry, ev: StreamEvent) => void;             // per-kind reducer from lib/api/streams/<kind>.ts
  cancel?: (entry: RunEntry) => Promise<void>;                    // e.g. POST /api/batch/{batch_id}/cancel
  poll?: { path: string; everyMs: number; reduce: (entry: RunEntry, payload: unknown) => void }; // benchmark, experiment reconcile
}): RunEntry;                                                      // throws when the key is already running ("Already running")
export function get(kind: RunKind, id: number | string): RunEntry | undefined;
export async function cancel(key: string): Promise<void>;          // calls spec.cancel if any, then abort(); status 'cancelled'
export function dismiss(key: string): void;                        // removes a finished entry
```

Rules: a `StreamEnd` of `interrupted` sets `status = 'interrupted'` and, when `poll` is set, keeps polling until the poll payload reports a terminal status; `done` sets `'done'`; `error` sets `'error'` with the detail. The benchmark run (`benchmarks.md` §2.3) is `poll` only (`open` resolves immediately). Experiment entries set both: the stream for liveness and the 2 s `/progress` poll as the count of record (experiment.md R4). Home R2 and the workbench R8 both render `running` through ProgressCard; neither opens a stream of its own. Writes: `start/cancel/dismiss` from the screen that launches the run (workbench, studies-new, experiment overview, benchmarks new/run, settings benchmarks). Reads: any screen with a ProgressCard, the Header (a dot on the section whose run is going; optional), PrimaryNav "Already running" reasons. The per-kind `reduce` functions are the only files other lanes add (§10).

### 5.5 `toast`

```ts
export const toast = $state({ items: [] as ToastItem[] });   // {id, tone:'info'|'success'|'error', text, action?, timeout}
export function show(t: Omit<ToastItem,'id'>): string;        // error: no timeout; others 6 s
export function dismiss(id: string): void;
```
Writes: anything (03 §21). Reads: the stack in `+layout.svelte` only. `client.ts` never calls it; the layout's unhandled-rejection handler does, for `ApiError` not `aborted`.

### 5.6 `tips`

```ts
export const tips = $state({ seen: new Set<string>(), active: null as string | null, suppressed: false }); // suppressed during tour/loading
export function markSeen(id: string): void;   // persists via persist.set('flinch_tips', [...seen])
export function reset(): void;                // Help menu "Show tips again"
```
Backed by the `flinch_tips` cookie (§6), not `localStorage` (03 §22 is edited to cite this). Writes: FirstTimeTip component. Reads: FirstTimeTip, Help menu.

### 5.7 `prefs`

```ts
export const prefs = $state({
  split: {} as Record<string, number>,        // ratio per Split storageKey ("probe-workbench", "experiment-responses", "benchmark-results")
  historyOpen: false,                          // workbench R7 "show runs"
  experimentsFilter: 'all' as string,          // experiments list
  experimentConcurrency: 4,
  tourDone: {} as Record<string, boolean>,     // per section
  updateSkip: null as string | null,           // skipped version
  lastSession: null as number | null,
});
export const draft = $state({ experiment: null as ExperimentDraft | null });  // experiments/new autosave
```
`prefs` is one cookie `flinch_prefs` written on change (debounced 300 ms); `draft.experiment` is the cookie `flinch_draft_experiment`; setup-card dismissal is the cookie `flinch_first` read through `prefs.setupDismissed` getter/`dismissSetup()`. Every `localStorage['flinch:…']` key a screen spec names maps to a field here (the specs are edited: `flinch:split:*` → `prefs.split`, `flinch:history-open`, `flinch:experiments:filter`, `flinch:experiment:concurrency`, `flinch:experiment-draft` → `draft.experiment`, `flinch:tour:*` → `prefs.tourDone`, `flinch:update:skip`, `flinch:setup-dismissed` → `flinch_first`). The splash's `flinch:splash:durations` stays `localStorage` on the `tauri.localhost` origin, which is stable. Writes: the owning screen or component. Reads: same, plus Home (`lastSession`, `setupDismissed`).

### 5.8 `updates` (L6, declared now so Settings and the splash can bind)

`{ phase: 'idle'|'available'|'downloading'|'stopping'|'installing'|'error', info, downloaded, total, errorKind }` as 03 §30; `check()` is a no-op that resolves `idle` until L6 lands, and runs only when `shell.desktop`.

---

## 6. Persistence: `lib/persist.ts`

The sidecar port is random on every desktop launch (`sidecar.rs:338`, `portpicker::pick_unused_port()`), so `localStorage` on the app origin is a fresh bucket each launch (review finding 7). **Cookies are keyed by host, not host:port**, so a cookie set on `127.0.0.1` is readable at every port; that is the store (consensus record, iteration 2; 05 row 30).

```ts
// lib/persist.ts
export type PersistKey = 'flinch_tips' | 'flinch_first' | 'flinch_prefs' | 'flinch_draft_experiment';
export const MAX_BYTES = 3000;   // per key, after encoding; a cookie over ~4 KB is dropped by browsers
export class PersistTooLarge extends Error {}

export function get<T>(key: PersistKey): T | null;           // JSON.parse(decodeURIComponent(value)); null when absent or unparsable
export function set(key: PersistKey, value: unknown): void;  // throws PersistTooLarge before writing when over MAX_BYTES
export function remove(key: PersistKey): void;               // Max-Age=0
export function backend(): 'cookie' | 'local' | 'none';
```

Write: `document.cookie = \`${key}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=31536000; SameSite=Strict; Path=/\``. No `Domain` (host-only is what makes an IP-literal host work), no `Secure` (the origin is `http:`). Read: split `document.cookie` on `; ` and match the key. Fallback: on first use `persist` writes and reads a probe cookie `flinch_probe=1`; when that fails (`navigator.cookieEnabled` false or the read-back is empty) the backend becomes `localStorage` with the same keys, and `backend()` reports `'local'` so Settings › About can say "preferences will not survive a desktop relaunch"; when `localStorage` throws too (private mode, blocked storage) the backend is `'none'` and every `get` returns null. Every call is wrapped in try/catch; the app renders with nothing persisted.

Registry (the only keys that may exist; the test `persist.test.ts` asserts the union and the cap):

| Key | Type | Max bytes | Owner (writes) | Contents |
|---|---|---|---|---|
| `flinch_tips` | `string[]` of tip ids | 1 500 | `tips` store | ids seen (≈ 40 ids × 25 chars) |
| `flinch_first` | `"1"` | 8 | `prefs.dismissSetup()` | set when the Home setup card is dismissed (§7); never set by a redirect |
| `flinch_prefs` | `Prefs` (§5.7) | 2 000 | `prefs` store | split ratios, filters, tour flags, skipped version, last session id |
| `flinch_draft_experiment` | `ExperimentDraft` | 3 000 | experiments/new | name, question, condition labels and system prompts, model ids, probe ids; when `set` throws `PersistTooLarge` the screen keeps the draft in `sessionStorage` for the tab and shows "Draft kept for this window only: the system prompts are too long to save between launches." |

Tests: round trip per key; a 3 001-byte value throws and writes nothing; `Max-Age`, `SameSite=Strict` and `Path=/` present in the written string (spied `document.cookie` setter); fallback engages when the probe read fails; keys outside the union are a TS error.

**Never persisted anywhere** (cookie, localStorage, sessionStorage, IndexedDB): API keys or any key text (they go only to `POST /api/settings/*` and `invoke('set_api_key')`); probe text, ad-hoc probe text, model replies, pushback text (the draft experiment holds probe ids, not text); session names beyond `lastSession`'s id. The copy-lint test greps `lib/` for `localStorage.` and `document.cookie` outside `persist.ts` and fails on any hit.

---

## 7. First launch and desktop detection, decided once

Review finding 8: `home.md` (setup card, `window.__TAURI__`) and `settings.md` (§3 first-launch redirect to `#/settings#keys` via `flinch_first`) cannot both be built. The decision:

1. **Home shows the setup card; there is no redirect.** `#/` with `keys.setCount === 0` and Ollama not available renders Home R1 as the setup card (home.md §3), on every launch, until a key is set or the card is dismissed. `+layout.svelte` never navigates on its own. Settings R1 (the "first launch" Readout) and Settings §3 rows "first launch" / check 7 are edited: Settings has no first-launch state; arriving at `#/settings#keys` with no keys shows the Keys section hint "No key yet. Anthropic is the one most of Flinch needs." and nothing else special.
2. **`flinch_first` only suppresses the card after dismissal.** "Do this later" sets the cookie; the card then collapses to the status strip until a key exists. It is not set by visiting Settings, not set by the layout, and cleared by nothing (a person who dismissed it reaches keys through the red chip or Settings). home.md's `localStorage['flinch:setup-dismissed']` and check 6 are edited to `flinch_first` via `persist`.
3. **Desktop means `shell.desktop`** (§5.3), set from `?shell=desktop` which the splash appends (`splash.md` line 3, replacing `ui/splash.js:114`'s `window.location.replace(url)` with `window.location.replace(url + "/?shell=desktop")`). `window.__TAURI__` is never read (home.md line 110 and settings.js:102's check are gone).
4. **Key save, desktop** (Home R1 and Settings R2 share one function `saveKey(provider, key)` in `lib/api/keys.ts`): `POST /api/settings/validate-key {provider, key}` → if `valid`, `POST /api/settings/set-key {provider, key}` → if `ok`, `invoke('set_api_key', {provider, key})` from `@tauri-apps/api/core` → `keys.refresh()`. Failure handling exactly as settings.md R2 (inline error; `ok:false` inline; invoke rejection → `keys.warning` and "Saved for this session only"). `POST /api/settings/keys` (the `.env` writer) is **never called when `shell.desktop`** (check 1 of settings.md stands). Remove: `DELETE /api/settings/set-key?provider=` then `invoke('delete_api_key', {provider})`.
5. **Key save, browser**: `validate-key` → `POST /api/settings/keys {ENV_VAR: key}` → `keys.refresh()`. Remove: `POST /api/settings/keys {ENV_VAR: ""}`.
6. **The capability** that lets the sidecar-origin page call the three commands (05 row 17): new file `src-tauri/capabilities/sidecar-keys.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "sidecar-keys",
  "description": "The app page served by the sidecar on 127.0.0.1 may call the three key commands and nothing else.",
  "windows": ["main"],
  "remote": { "urls": ["http://127.0.0.1:*"] },
  "permissions": ["allow-set-api-key", "allow-get-api-keys", "allow-delete-api-key"]
}
```

The three permission identifiers are the ones `tauri_build` generates for the commands in `lib.rs:98-109` (`AppManifest::commands`); L0 confirms the exact spelling from `src-tauri/gen/schemas/` on the first build (unverified here). `default.json` is unchanged. **Risk, recorded** (review finding 16): any page the main window shows from any `127.0.0.1` port could call these three commands. Mitigation: the main window only ever navigates to the URL the sidecar handle reports; the commands return `()` or `HashMap<String, bool>` and never a key; `set_api_key` only stores a key the page already holds; no other command is granted to the remote origin. Accepted for this release; the alternative (proxying the app under `tauri.localhost`) is out of scope.

---

## 8. Backend contract changes the screens rely on

Every change is additive: new columns with `NULL` defaults, new routes, new event names, new fields in existing payloads. An existing `flinch.db` opens unchanged (Round 1.3; `tests/test_db_additive.py` asserts `PRAGMA table_info` of every pre-existing column is byte-identical before and after). Migrations follow the `db.py:548-567` pattern (`ALTER TABLE … ADD COLUMN` inside `try/except`). L0 owns every change here; `scripts/verify-phase1.py` gains one check per route.

### 8.1 Row 18: per-turn latency and tokens

```sql
ALTER TABLE run_turns ADD COLUMN latency_ms INTEGER;
ALTER TABLE run_turns ADD COLUMN input_tokens INTEGER;
ALTER TABLE run_turns ADD COLUMN output_tokens INTEGER;
```

`runner.py:130/174/204` keep the `TargetResponse` (`target.py:13-17`) instead of `.text` and pass `latency_ms=resp.latency_ms, input_tokens=resp.input_tokens, output_tokens=resp.output_tokens` to `db.add_run_turn` (signature gains the three keyword arguments, default `None`). `GET /api/runs/{id}/turns` (`SELECT *`, `db.py:786-791`) returns them; old rows return `null` and the RunThread prints `created_at` as `HH:MM` instead of a duration (probe-workbench R4 "Model turn timing" is edited to this rule; `tokens` becomes `number | null` on the RunThread model turn, printing "412 tokens" only when both counts are present). Read by: probe-workbench R4, study-context R5 (sequence turns are a different table and unchanged), probe-sessions list ("avg 2.1 s" is **not** added; the list stays as specified).

### 8.2 Row 19: label source

```sql
ALTER TABLE run_turns ADD COLUMN label_source TEXT;             -- 'keyword' | 'judge' | 'person' | NULL
ALTER TABLE runs ADD COLUMN initial_label_source TEXT;          -- same values
ALTER TABLE runs ADD COLUMN final_label_source TEXT;
ALTER TABLE experiment_responses ADD COLUMN label_source TEXT;  -- for §8.4
```

`classifier.py:48-61` gains `classify_with_source(response_text, probe_text, backend) -> tuple[Classification, Literal['keyword','judge']]`: `'keyword'` when the scan returned with confidence > 0.8 or when no backend exists (the `COMPLIED` default is also `'keyword'`, and the UI's `keyword_only` caveat covers it), `'judge'` when `_llm_classify` ran. `classify()` stays as a wrapper. `send_probe`, `send_pushback`, `continue_pushback` write the source to the turn and to `runs.initial_label_source` / `final_label_source`. `ALLOWED_RUN_FIELDS` (`db.py:721`) gains the two run columns. The display type becomes `LabelSource = { source: 'keyword' | 'judge' | 'person' | null }` (03 `lib/types/display.ts` and §9 LabelControl are edited; the fixed phrase "keyword scan plus judge" and the `{keyword, judge, override}` triple are gone). The source line reads "keyword scan" / "judge model" / "you changed this" and `null` (old rows) reads "label source not recorded". Read by: probe-workbench R4, probe-sessions, every study screen's badge tooltip, experiment Responses.

### 8.3 Per-turn override and the run-level PATCH

```
PATCH /api/run-turns/{turn_id}/classification
  body     {"value": "refused" | "collapsed" | "negotiated" | "complied"}
  200      {"turn": RunTurn, "run": Run}
  400      {"detail": "Invalid classification value"} | {"detail": "Only response turns carry a label"}
  404      {"detail": "Turn not found"}
```

Writes `run_turns.classification = value, label_source = 'person'`. Mirrors: when the turn is the **first** `response` turn of its run → `runs.initial_classification = value, initial_label_source = 'person'`; when it is the **last** `response` turn and the run has at least one `pushback` turn → `runs.final_classification = value, final_label_source = 'person'` (a run with one reply has first = last and only `initial_*` changes). The existing `PATCH /api/runs/{id}/classification` (`app.py:432-439`) is kept for callers and now also sets the matching `*_label_source = 'person'` and mirrors to the first or last response turn. The workbench LabelControl on any model turn calls the per-turn route (probe-workbench R4 actions are edited; review finding 5). Read by: probe-workbench, study-context (turn override is **not** offered there; `no_override_turn` stays).

### 8.4 A7: experiment responses are classified on write, and can be overridden

`ExperimentRunner._run_single_cell` (`runner.py:563-573`) and the batch-conditions writer (`app.py:659-665`) call `classify_with_source(resp.text, prompt_text, backend)` after a completed send and write `classification`, `label_source`. The judge backend is the one `Runner` holds (`_runner.backend`), passed into `ExperimentRunner` at construction (`app.py:2901-2917`, `2928-2942`, `3260`); with no backend the keyword scan alone labels, source `'keyword'`. Classification failure never fails the cell: the response is saved with `classification = NULL` and a log line. `ALLOWED_RESPONSE_FIELDS` gains `label_source`.

```
PATCH /api/experiments/{experiment_id}/responses/{response_id}/classification
  body  {"value": Outcome}           200 the response row (as GET …/responses returns it, plus label_source)
  400   invalid value                 404 experiment or response not found, or response not in that experiment
```

`GET …/responses` already returns `classification` (`SELECT *`); it now carries `label_source`. `condition-comparison` and the Conditions tab compute the rate from real labels; `experiment.md` §5 `unlabelled` becomes the state "not yet labelled" only for rows with `classification = NULL` (pending, failed, or classifier error) and the Responses LabelControl is enabled with the per-response route. Read by: experiment Conditions, Responses, Analysis; experiments-list (no change).

### 8.5 Batch cancel honoured; `start` and `cancelled` events

`Runner.run_batch` (`runner.py:222-285`): before the loop, `yield {"event": "start", "data": {"batch_id": batch_id, "total": total}}`; before each probe, `db.get_batch_run(batch_id)["status"] == "cancelled"` → `yield {"event": "cancelled", "data": {"batch_id", "completed", "total"}}` and return (the batch row keeps `status='cancelled'`, `completed_at` set). The same check goes into `run_batch_conditions` (`runner.py:295-`). `POST /api/batch/{id}/cancel` (`app.py:700-703`) is unchanged. Client rule (runs store): Cancel calls the route with the `batch_id` from `start`, then aborts the stream; if no `start` has arrived yet (first 100 ms) it aborts only. The stat-run route has no cancel today and none is added (05 row 22 stayed out); its ProgressCard offers "Stop watching" (abort) with the sentence that the server finishes the probe in flight.

### 8.6 `/_app` mount

§1.5. Counted as the consensus record's B4.

### 8.7 Benchmarks

Routes, payloads and the runner contract are `benchmarks.md` §7 and §2, by reference; nothing is restated here. Two edits that file takes from the review: the compare route gains `?overrides=true` (recomputes with `override_label` where set; the response carries `overrides: {count, applied: bool}`), and `GET /suites/{key}` carries `recipe.labels: string[]` (the suite's outcome words, used by ProgressCard and LabelControl; XSTest `["full refusal","partial refusal","full compliance"]`). The install command in §8.4 becomes `<venv pip> install "<sidecar_source>[benchmarks]"` where `<sidecar_source>` is the path `bootstrap/pip.rs:31-43` installs from (dev: `pip install -e ".[benchmarks]"`), never a PyPI name.

### 8.8 Hugging Face token as a provider

`app.py:2201` `_SUPPORTED_KEYS["HF_TOKEN"] = {"provider": "huggingface", "label": "Hugging Face", "required": False}` (sixth entry; `GET /api/settings/keys` now returns six rows and the chip prints "r of 6 keys set"; 03 §1.3's N=5 is edited). `app.py:3319` `_PROVIDER_ENV_VARS["huggingface"] = "HF_TOKEN"`. `_read_stdin_keys` (`app.py:3428-3437`) `key_map["huggingface"] = "HF_TOKEN"`. `validate-key` for `huggingface`: `GET https://huggingface.co/api/whoami-v2` with `Authorization: Bearer`, 200 → valid. `test-key` keeps returning 400 for it (the `no_test_call` caveat applies). `src-tauri/src/api_keys.rs:25` `PROVIDERS` gains `"huggingface"` (one entry; `save_key`/`delete_key`/`list_configured` need no other change; `load_all_for_sidecar` then emits it in the stdin JSON). Read by: Settings R2 (the card appears with the others) and R5 (the same card's state, not a second form), Benchmarks catalog and new-run prerequisites.

### 8.9 The other A rows, as contracts (one line each)

| Row | Contract |
|---|---|
| A2 | §8.5 |
| A5 | `GET /api/probe-groups` resolves file-backed groups' `variants[].probe_id` by matching the variant's base probe slug against `probes.name` (null when no probe exists); `library-variants` and `study-framing` bind to it |
| A8 | `POST /api/experiments/{id}/resume` body gains `{"retry_failed": bool}` (default true): failed cells are reset to `pending` before the run |
| A9 | `GET /api/experiments/{id}/condition-comparison` returns the newest analysis per type (`ORDER BY created_at DESC`); the client workaround in experiment.md is dropped |
| A10 | `POST /api/comparisons/sessions` persists (the route returns `{id}`); `DELETE /api/comparisons/{id}` commits (`db.py:2518`) |
| A11 | run-auto and interactive runs set `sequences.status = 'completed'` on the probe turn; `completed_at` set; study-context's derived status is removed |
| A12 | the snapshot diff labels one-sided probes `new` / `gone`, never improved or regressed |
| A14 | the PDF publication route returns `application/pdf` bytes (`Response`), 501 `{"detail": "PDF export needs the pdf extra"}` when weasyprint is absent |
| A15 | `POST /api/probes/load-defaults` skips the H1 block (`db.py:1021-1031`) |
| A16 | `flinch/__init__.py.__version__` = pyproject version (`0.9.0`); `import logging` at `app.py` top; dead test file removed |
| A17 | §7.6 |
| A1, A3, A4, A6, A13 | UI-only; no contract |

---

## 9. Caveat and glossary registries

`lib/copy/caveats.ts` and `lib/glossary/index.ts` are created and owned by L0 and hold **every** id any screen uses, with the draft phrase from the screen spec that introduced it (marked "(draft; brad-voice pass)"). The `CaveatId` and `GlossaryKey` unions are the only source of ids; a `<Caveat id="…">` or `<Term key="…">` with an unlisted id is a compile error. Lanes edit the phrase text of their own ids during the brad-voice pass and **never add an id**: a new id is added to this section first, then to the registry by L0. `caveats.test.ts` asserts the registry's key set equals the list below exactly, and `glossary.test.ts` asserts every key below has a definition without banned verbs (02 §7.7).

### 9.1 Caveat ids (harvested from every `screens/*.md` §5, `benchmarks.md` §11 and `03-components.md` §5; 123 ids)

Common (03 §5): `classifier`, `rate_n`, `held_once`, `product_filter`, `coach_conf`, `improved`, `modified_bench`.

Probe, Home, Sessions, dialogs: `held_n`, `keyword_only`, `closed_conversation`, `batch_fresh`, `first_label`, `fixed_set`, `no_coach_key`, `import_skips`, `narrative_plain`.

Studies: `latest_only`, `threshold_once`, `compare_sessions`, `first_reply_only`, `cost_estimate`, `experiment_not_here`, `warmup_label`, `fresh_run`, `adapted_probe`, `strategy_success`, `stale_status`, `no_override_turn`, `two_needed`, `disagree_def`, `score_no_colour`, `one_run_cell`, `error_not_disagree`, `same_prompt`, `not_saved`, `latest_only_side`, `side_note`, `steps_not_measure`, `final_wins`, `excerpt_500`, `no_override_stat`, `fresh_context`, `failed_not_counted`, `one_label_stored`.

Experiments: `system_prompt_required`, `estimate_after_create`, `hh_not_probes`, `batch_conditions_autostart`, `draft_without_keys`, `cell_definition`, `run_stops_on_close`, `interrupted_run`, `unlabelled`, `negotiated_counts`, `report_markdown_only`, `win_rate_meaning`, `t_vs_u`, `responses_cap`, `rater_criteria`, `prompts_fixed`, `prolific_once`, `prereg_fixed_text`, `power_even_split`, `per_pair_only`, `pause_lag`, `pairs_on_analysis`, `metrics_listed_phrases`, `full_record_no_text`, `fdr_scope`, `estimate_assumptions`, `d_made_of`, `cost_not_measured`, `analysis_csv_blank_means`.

Benchmarks: `bench_estimate`, `bench_subset_paired`, `bench_judge_swap`, `bench_local_cost`, `swebench_contested`, `bench_not_leaderboard`, `bench_judge_drift`, `bench_resource_limits`, `bench_resumed`, `bench_local_model`, `bench_gpqa_recipe`, `bench_gated_text`, `bench_judge_label`.

Library: `example_failed`, `shipped_example`, `effectiveness_is_yours`, `outcome_is_final`, `cap_ten`, `claim_paraphrase`, `claim_untested`, `claim_seed_date`, `csam_not_tested`, `probe_runs_kept`, `bulk_no_run_check`, `defaults_h1`, `added_is_db_date`, `notes_are_paper`, `strategy_readonly`, `max_turns_is_cap`, `db_only`, `includes_not_ran`, `variant_gen_model`, `conditions_all_probes`, `same_request`.

Results: `table_as_generated`, `pct_one_decimal`, `initial_only`, `matrix_fraction`, `success_def`, `seeded_examples`, `theme_not_stored`, `empty_saved`, `rule_is_setting`, `inverted_over`, `total_is_runs`, `stat_runs_counted`, `auto_sessions`, `clear_keeps`, `export_all_scope`, `agreement_def`.

Settings, overlays, splash: `no_test_call`, `key_scope_desktop`, `key_scope_browser`, `ollama_in_memory`, `coach_in_memory`, `local_no_judge`, `local_coach`, `hf_gated`, `updater_inactive`, `keys_in_fields`, `r_not_resend`, `local_only`, `glossary_is_flinch`, `no_estimate`, `offline_setup`, `estimate_from_last`, `update_keeps`, `update_cap`.

Phrases that take a number (`held_n`) are functions `(n: number) => string` in the registry; the test pins `held_n(2)`. Ids retired by the §8 changes keep their entry but their phrase changes: `unlabelled` now reads "This response has no label yet: it is pending, failed, or the classifier could not run."; `no_override_turn` stays (sequence turns); the probe-workbench `classifier` source line no longer says "keyword scan plus judge" (§8.2).

### 9.2 Glossary keys (harvested from every `screens/*.md` §6, deduplicated; slug = lower-kebab of the term)

Core: `probe`, `ad-hoc-probe`, `domain`, `tag`, `run`, `label`, `first-label`, `outcome`, `keyword-scan`, `judge-model`, `refused`, `collapsed`, `negotiated`, `complied`, `unlabelled`, `pushback`, `pushback-move`, `specificity-challenge`, `equivalence-probe`, `projection-check`, `contradiction-mirror`, `category-reductio`, `reality-anchor`, `minimal-pressure`, `coach`, `coach-profile`, `coach-backend`, `coach-example`, `pattern`, `annotation`, `pattern-tag`, `key-finding`, `session`, `target-model`, `system-prompt`, `fresh-conversation`, `narrative-probe`, `narrative-opening`, `narrative-target`, `variant`, `variant-group`, `framing`, `baseline-variant`, `conditions-group`, `probe-set`, `fixed-set`, `library`, `shipped-defaults`, `probes-folder`, `provider`, `provider-key`, `api-key`, `ollama`, `legacy`, `findings`, `latency`.

Studies: `study`, `stat-run`, `iteration`, `consistency-rate`, `consistency-score`, `batch`, `comparison`, `session-comparison`, `hidden-session`, `agreement`, `disagreement`, `latest-run`, `narrative-sequence`, `sequence-run`, `sequence-batch`, `strategy`, `narrative-strategy`, `narrative-engine`, `warm-up-turn`, `setup-turn`, `probe-turn`, `target`, `got-through`, `whittling`, `threshold`, `automatic`, `interactive`, `abandoned`, `opening`, `escalation`, `setup`, `built-in`, `snapshot`, `baseline`, `regression-diff`, `improved`, `regressed`, `steps`, `one-side`, `context-study`, `framing-study`.

Experiments: `experiment`, `condition`, `cell`, `base-model`, `experiment-status`, `interrupted-run`, `done-with-pending`, `concurrency`, `estimate`, `compliance-rate`, `random-seed`, `hh-rlhf`, `mtld`, `ttr`, `honore-statistic`, `flesch-kincaid-grade`, `flesch-reading-ease`, `gunning-fog`, `hedging-ratio`, `confidence-ratio`, `evasion-ratio`, `subjectivity`, `polarity`, `words-per-sentence`, `oov-rate`, `pos-rate`, `word-frequency-rank`, `cohens-d`, `pooled-sd`, `bootstrap-ci`, `mann-whitney-u`, `rank-biserial-r`, `wilcoxon-w`, `pairs`, `median-difference`, `bonferroni`, `fdr`, `significant`, `power`, `required-n`, `target-d`, `win-rate`, `ranking`, `blind`, `rater-model`, `krippendorffs-alpha`, `prolific-task`, `tracking-id`, `eval-task`, `preregistration`, `finish-reason`, `attempts`.

Benchmarks: `benchmark`, `benchmark-run`, `suite`, `sample`, `judge`, `standard`, `modified`, `scaffold`, `sandbox`, `provenance`, `tier`, `resolved-rate`, `refusal-rate`, `over-refusal-rate`, `accuracy`, `partial-refusal`, `discordant-pair`, `mcnemar-exact`, `holm`, `wilson-interval`, `fail-to-pass`, `pass-to-pass`, `no-price`, `reasoning-effort`, `thinking-budget`, `seeded-subset`, `epoch`, `connections`, `message-limit`, `tool-timeout`, `dataset-revision`, `gated`, `canary-string`, `hf-home`.

Library and Results: `policy-claim`, `expected-behaviour`, `severity`, `testable-statement`, `scorecard`, `scorecard-snapshot`, `enforcement-label`, `over-label`, `total-probes`, `effectiveness`, `promote`, `shipped-example`, `template`, `theme`, `repeat-study`.

Settings and shell: `credential-manager`, `hugging-face-token`, `docker-desktop`, `wsl2`, `sidecar`, `python-runtime`, `virtual-environment`, `the-server`.

Where two specs define the same term differently (`judge model`: home.md vs probe-workbench.md), the longer definition that cites code wins; L0 records the choice in the registry comment.

---

## 10. Lane ownership

Lane map assumed by this file (the build plan v2 may regroup screens; the ownership rules below survive regrouping): **L0** foundation and backend contracts (§8); **L1** Home, Probe (Sessions, Workbench, New session, Add/Import), Settings; **L2** Studies (list, new, five study screens) and Library; **L3** Experiments (list, new, experiment); **L4** Results (three screens) and Benchmarks (four screens plus the Python runner); **L5** overlays, tours, publication preview polish; **L6** updater (separable). L0 closes before any screen lane opens.

### 10.1 L0 creates and owns

Everything in §1 (`flinch-ui/` scaffold, configs, `app.html`, `app.css` with §11, the first committed build), §2 (`routes/` tree with placeholder pages that render the Header and an EmptyState per route, `+layout.svelte`, `+error.svelte`, `nav.ts`), §3 (`client.ts`, `endpoints.ts` for every route in every screen spec's §10, `types.d.ts`, the fixture recorder and contract test), §4 (`stream.ts`, `streams/*.ts` for every stream route), §5 (all eight stores), §6 (`persist.ts`), §7 (`lib/api/keys.ts`, the capability file, the splash flag), §8 (every Python and Rust change, migrations, `verify-phase1.py` additions, fixture DB `tests/fixtures/flinch-fixture.db` with one session, three probes, twelve runs, one experiment, one sequence, one snapshot), §9 (both registries, full), §11 (the tokens), §12 (the test harness, Playwright config, the fixture server script), and every component in `03-components.md` §§1–30 with the review's prop additions folded in: RunThread `kind` gains `'warmup' | 'setup' | 'probe-adapted'` (study-context) and model-turn `tokens: number | null`; LabelControl gains `labels?: readonly string[]` (judged suites; default the four outcomes) and `source: LabelSource` per §8.2; ProgressCard `status` gains `'interrupted' | 'partial'` and `outcomes` becomes `Record<string, number>` with `labels?: string[]`; OutcomeBadge gains `reason?: string`; KeyStatusChip N from `keys.total`.

### 10.2 What L1–L5 may touch

- Their own route files under `routes/<section>/…` and screen-local components under `lib/components/<section>/`.
- `lib/api/endpoints.ts`: **add** functions for a route L0 missed, in a block headed by the lane; never change an existing signature.
- `lib/api/streams/<kind>.ts`: a lane that owns the launching screen owns that kind's event union and `reduce` (L1 batch and batch-conditions; L2 stat-run, sequence, sequence-batch; L3 experiment, metrics, raters, hh-import; L4 benchmark, runner-install).
- Registry phrase text for their own ids (§9), during the brad-voice pass.
- Tests for everything they add.

### 10.3 Collision points and the rule for each

| Point | Rule |
|---|---|
| `runs.svelte.ts` | L0 only. A lane needs new behaviour (a new field on `RunEntry`, a second poll) → PR against L0's file with a test; the lane does not fork a store. Per-kind reducers (§10.2) are the extension seam. |
| RunThread, ProbeList, LabelControl | L0 ships them with the full prop set in §10.1. A lane needing a prop not there → PR to L0's component with a story in its test; no copies, no wrappers that re-implement rendering. ProbeList's session footer is a prop (`footer?: Snippet`) so Library › Probes reuses the rows (03 §25). |
| `caveats.ts`, `glossary/index.ts` | §9: ids by L0 only; phrases by the owning lane. |
| `shell.svelte.ts`, `keys.svelte.ts`, `session.svelte.ts`, `persist.ts` | L0 only; lanes read. A lane needing a new persisted key adds it to §6's registry table first. |
| `+layout.svelte`, Header | L0 only. Section-local sub-bars live inside the section's route, under the Header. |
| `app.css`, `tailwind.config.js` | L0 only; a lane needing a token proposes it in `02-tokens.md`. |
| `flinch/*.py`, `src-tauri/**` | L0 for §8; L4 for `flinch/benchmarks/**` and the benchmarks routes; L6 for the updater. No other lane edits Python or Rust. |
| `flinch/static/` | integrator only (§1.6). |

---

## 11. Page container and grid tokens

Added here to be cited by `02-tokens.md` §3 (review finding 9) and by every wireframe. Defined once in `src/app.css` under `@layer components`:

```css
@layer components {
  /* Content screens: Home, lists, Settings, Library, Results, study and experiment screens. */
  .page       { @apply mx-auto w-full max-w-[1200px] px-4 py-5 xl:px-6; }   /* 16 px gutter at 1024, 24 px at ≥ 1280 */
  .page-grid  { @apply grid gap-4 grid-cols-2 xl:grid-cols-3; }            /* card grid: 16 px gap; 2 columns at 1024, 3 at 1280 */
  .page-stack { @apply flex flex-col gap-4; }                               /* panels one under another: 16 px */
  .page-cols  { @apply grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]; } /* main + side panel at 1280; stacked at 1024 */
  /* Two-pane workbench screens (Probe workbench, Experiment › Responses, Benchmark › Results): no .page, full bleed under the header. */
  .pane-left  { @apply min-w-pane-narrow xl:min-w-pane; }                   /* 280 px at 1024, 300 px at ≥ 1280 (02 §1 spacing) */
}
```

Numbers: page max-width 1200 px; gutters 16 / 24 px; card-grid gap 16 px; panel gap 16 px; two-pane split 300 px at 1280 and 280 px at 1024 (IA §5), divider 6 px (02 §3); the header stays 44 px. Each content screen's wireframe cites `.page` and one of `.page-grid` / `.page-stack` / `.page-cols` in its §1; the split screens cite `.pane-left`. Vertical rhythm inside a `.page` is `gap-4` between panels and `mt-8` between Sections (02 §3). Nothing else positions content.

---

## 12. Testing surfaces

| Surface | Tool | Where | What it pins |
|---|---|---|---|
| Stores, parsers, persist, format, nav | Vitest (jsdom) | `src/lib/**/*.test.ts` | `stream.test.ts` both SSE shapes and every end state from fixture frames; `runs.test.ts` cancel order, interrupted → poll, "Already running"; `persist.test.ts` §6; `client.test.ts` §3 rules 1–5; `nav.test.ts` `#/settings?x=1#keys`; `format.test.ts` 02 §6 |
| Components | Vitest + `@testing-library/svelte` | `src/lib/components/*.test.ts` | the Tests line of each 03 section, including `// @ts-expect-error` bare-number cases |
| Copy | Vitest | `src/lib/copy/*.test.ts`, `glossary.test.ts`, `tokens/contrast.test.ts`, `popup/audit.test.ts` | 02 §7, §8; 03 Appendix B; §9 id sets |
| Contract | Vitest | `tests/contract/*.test.ts` | recorded fixture responses `satisfies` the `endpoints.ts` interfaces; `types:check` clean |
| Screens | Playwright | `flinch-ui/e2e/<screen>.spec.ts` | every numbered check in a screen spec's §11 is one `test()` with the same number; network assertions use `page.waitForRequest`; no `window.alert/confirm/prompt` (spy) |
| Backend | pytest | `tests/` | §8 migrations additive (`test_db_additive.py`), each new route, batch cancel, `verify-phase1.py` |

Playwright runs against the real sidecar: `playwright.config.ts` `webServer` copies `tests/fixtures/flinch-fixture.db` to a temp path and runs `python -m flinch.app --port 8011 --db-path <tmp>` with no keys in the environment, `baseURL: http://127.0.0.1:8011`, so the build under test is the committed `flinch/static` (the gate builds first). Flows that would call a provider (send, pushback, batch, experiment start) intercept the route with `page.route('**/api/sessions/*/run', …)` and `page.route('**/api/sessions/*/batch', …)` returning fixture JSON or a fixture SSE body; the key-set states use `page.route('**/api/settings/keys', …)`. Desktop-mode checks load `/#/?shell=desktop` and stub `window.__TAURI_INTERNALS__.invoke`. Viewports: every spec runs at 1280×800 and 1024×700 (`projects`).

Gates: `npm run check` with zero warnings (`--fail-on-warnings`), `npm run test`, `npm run types:check`, `npm run build` to a temp dir (lanes) or to `flinch/static` (integrator), `npm run test:e2e` for the lane's screens, `pytest`. The copy, contrast and audit tests run in every lane's gate because the registries are shared.

---

## 13. Not pinned from code (confirm at L0)

1. The exact Tauri permission identifiers for the three app commands on a remote origin (§7.6) and whether `withGlobalTauri` injects `__TAURI_INTERNALS__` for `remote.urls` pages in Tauri 2.1; confirmed on the first `cargo tauri build`.
2. Whether hatchling honours `.gitignore` for wheel contents in the installed version (the committed-build rule holds either way; it only decides whether an uncommitted build would leak into a wheel).
3. The `inspect`-side items `benchmarks.md` §12 lists; unchanged here.
4. `AbortSignal.any` availability in the shipped WebView2 (Chromium ≥ 116); `client.ts` falls back to a manual combiner if absent.
