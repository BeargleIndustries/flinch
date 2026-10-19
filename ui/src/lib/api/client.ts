// The sidecar API client (brief 10.3, plan I15). One place resolves the
// sidecar's address and turns failures into `ApiError`, whose `friendly`
// field is the errors.ts sentence for the UI.
//
// Rules: a fetch `TypeError` (the sidecar not answering) clears the cached
// address, re-resolves it and retries once; an HTTP status is never retried.
// No request has a timeout (whittling and Model compare are long requests);
// a caller that wants to stop one passes an AbortSignal.
import { friendlyError, type FriendlyError } from '../errors';
import { isTauri } from '../is-tauri';
import { onSidecarCrashed, onSidecarRestarted, sidecarUrl, tauriError } from '../tauri';
import { buildPath, type RouteDef } from './endpoints';

/** Longest error text kept from a non-JSON error body. */
const MAX_DETAIL = 2000;
/** At desktop cold start the sidecar may not be up yet: ask again every 750 ms for 30 s. */
const COLD_START_MS = 30_000;
const COLD_START_RETRY_MS = 750;

/** A failed request. `status` 0 means the sidecar did not answer. */
export class ApiError extends Error {
  readonly status: number;
  /** The server's `detail`, or the response text. */
  readonly detail: string;
  /** What to show the user (errors.ts). */
  readonly friendly: FriendlyError;

  constructor(status: number, detail: string) {
    const text = detail.trim() || (status ? `HTTP ${status}` : 'Failed to fetch');
    super(text);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.friendly = friendlyError(text);
  }
}

// ---------------------------------------------------------------------------
// The sidecar's address
// ---------------------------------------------------------------------------

let cachedBase: Promise<string> | null = null;
let listening = false;

/**
 * The sidecar's base URL. Dev and the browser: '' (same origin, the Vite proxy).
 * Desktop: the URL the shell reports, cached until the sidecar crashes or restarts.
 */
export function base(): Promise<string> {
  if (!isTauri()) return Promise.resolve('');
  if (!listening) {
    listening = true;
    void onSidecarCrashed(() => resetBase());
    void onSidecarRestarted((e) => {
      cachedBase = Promise.resolve(trimSlash(e.base_url));
    });
  }
  cachedBase ??= resolveSidecar().catch((e: unknown) => {
    cachedBase = null;
    throw e;
  });
  return cachedBase;
}

/** Forget the cached address; the next request asks the shell again. */
export function resetBase(): void {
  cachedBase = null;
}

async function resolveSidecar(): Promise<string> {
  const deadline = Date.now() + COLD_START_MS;
  for (;;) {
    try {
      return trimSlash(await sidecarUrl());
    } catch (e) {
      if (Date.now() + COLD_START_RETRY_MS > deadline) {
        throw new ApiError(0, `Sidecar not reachable: ${tauriError(e).message}`);
      }
      await new Promise((r) => setTimeout(r, COLD_START_RETRY_MS));
    }
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  /** Values for the route's `{name}` parameters. */
  params?: Record<string, string | number>;
  /** Query string; null and undefined values are left out. */
  query?: Query;
  /** Sent as JSON. */
  body?: unknown;
  signal?: AbortSignal;
}

/** The route's path with its parameters and query string, ready for `fetch` after `base()`. */
export function pathFor(route: RouteDef, opts: Pick<RequestOptions, 'params' | 'query'> = {}) {
  const path = buildPath(route, opts.params);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== null && v !== undefined) qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * `fetch` against the sidecar: one retry, after re-resolving the address, on a
 * network `TypeError`; never on an HTTP status. An abort rejects as it is.
 */
export async function sidecarFetch(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch((await base()) + path, init);
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    resetBase();
    try {
      return await fetch((await base()) + path, init);
    } catch (e2) {
      if (e2 instanceof TypeError) throw new ApiError(0, e2.message);
      throw e2;
    }
  }
}

/** The fetch init for a route: its method, and a JSON body when one is given. */
export function initFor(route: RouteDef, opts: RequestOptions = {}): RequestInit {
  const init: RequestInit = { method: route.method, signal: opts.signal };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return init;
}

/** An `ApiError` from a non-2xx response: the JSON `detail` when there is one, else the text. */
export async function errorFrom(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  try {
    const json: unknown = JSON.parse(text);
    if (json && typeof json === 'object' && 'detail' in json) {
      return new ApiError(res.status, detailText((json as { detail: unknown }).detail));
    }
  } catch {
    // Not JSON: keep the text.
  }
  return new ApiError(res.status, text.slice(0, MAX_DETAIL));
}

/** FastAPI's `detail`: a string, or a list of validation errors with `msg`. */
function detailText(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) =>
        d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d),
      )
      .join('; ');
  }
  return JSON.stringify(detail);
}

/**
 * Calls a route and returns its parsed JSON (text for a non-JSON answer,
 * undefined for an empty one). Throws `ApiError` on a non-2xx status or when
 * the sidecar does not answer.
 */
export async function request<T>(route: RouteDef, opts: RequestOptions = {}): Promise<T> {
  const res = await sidecarFetch(pathFor(route, opts), initFor(route, opts));
  if (!res.ok) throw await errorFrom(res);
  const text = await res.text();
  if (!text) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? JSON.parse(text) : text) as T;
}

export interface Downloaded {
  blob: Blob;
  /** From `Content-Disposition`, or null when the response names no file. */
  filename: string | null;
}

/** Fetches a file route (exports, CSVs, reports) as a Blob with its file name. */
export async function download(
  target: RouteDef | string,
  opts: RequestOptions = {},
): Promise<Downloaded> {
  const path = typeof target === 'string' ? target : pathFor(target, opts);
  const init = typeof target === 'string' ? { signal: opts.signal } : initFor(target, opts);
  const res = await sidecarFetch(path, init);
  if (!res.ok) throw await errorFrom(res);
  return { blob: await res.blob(), filename: filenameFrom(res.headers.get('content-disposition')) };
}

/** The file name in a `Content-Disposition` header: `filename*=UTF-8''…`, quoted or bare. */
export function filenameFrom(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // Fall through to the plain form.
    }
  }
  const quoted = /filename\s*=\s*"([^"]*)"/.exec(header);
  if (quoted) return quoted[1];
  const bare = /filename\s*=\s*([^;]+)/.exec(header);
  return bare ? bare[1].trim() : null;
}
