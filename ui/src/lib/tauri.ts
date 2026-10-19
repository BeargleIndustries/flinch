// The desktop shell bridge (brief 10.6, 12.3): typed wrappers over the Tauri
// commands and events in src-tauri/src/lib.rs, sidecar.rs, crash.rs and
// bootstrap/events.rs. Outside the desktop app every wrapper is a no-op with a
// dev value, or rejects with a clear message where there is nothing to fake.
//
// Command and event names are the Rust ones. `restart_sidecar`,
// `open_devtools`, the `sidecar:restarted` event and `runtime_status`'s
// `installed` and `current` fields arrive with P01 and P04 (brief 12.3).
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { downloadDir, join } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { isTauri } from './is-tauri';

/** What a wrapper with no dev value rejects with outside the desktop app. */
export const NOT_IN_DESKTOP = 'Not in the desktop app';

// ---------------------------------------------------------------------------
// Rust types. KEEP IN SYNC with the files named on each.
// ---------------------------------------------------------------------------

/** src-tauri/src/error.rs `AppError` (`#[serde(tag = "kind", content = "detail")]`). */
export interface AppError {
  kind: 'Io' | 'Bootstrap' | 'Sidecar' | 'Json' | 'ApiKey' | string;
  detail: string;
}

/** src-tauri/src/sidecar.rs `RuntimeStatus`; `installed` and `current` come with P01. */
export interface RuntimeStatus {
  ready: boolean;
  installed?: boolean;
  current?: boolean;
}

/** src-tauri/src/bootstrap/events.rs `BootstrapStage` (snake_case). */
export type BootstrapStage =
  | 'probing'
  | 'cleaning'
  | 'extracting_pbs'
  | 'creating_venv'
  | 'installing_deps'
  | 'ready';

/** `bootstrap:progress` payload (bootstrap/events.rs `BootstrapEvent`). */
export interface BootstrapProgress {
  stage: BootstrapStage;
  message: string;
  /** 0 to 1, or -1 when the step has no measurable progress. */
  progress: number;
  bytes_downloaded: number | null;
  bytes_total: number | null;
}

/** `bootstrap:error` payload (lib.rs, background launch failure). */
export interface BootstrapError {
  detail: string;
}

/** `sidecar:crashed` payload (sidecar.rs, three missed health checks). */
export interface SidecarCrashed {
  stderr_tail: string[];
  reason: string;
}

/** `sidecar:restarted` payload (P04 `restart_sidecar`). */
export interface SidecarRestarted {
  base_url: string;
}

export type Unlisten = () => void;

/** A Tauri rejection as an Error: `AppError` as "kind: detail", a string as itself. */
export function tauriError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (typeof e === 'object' && e !== null && 'kind' in e && 'detail' in e) {
    const err = e as AppError;
    return new Error(`${String(err.kind).toLowerCase()}: ${err.detail}`);
  }
  return new Error(String(e));
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw tauriError(e);
  }
}

// ---------------------------------------------------------------------------
// Sidecar
// ---------------------------------------------------------------------------

/** The sidecar's base URL (`http://127.0.0.1:{port}`); '' in dev (same origin, proxied). Rejects until it runs. */
export async function sidecarUrl(): Promise<string> {
  if (!isTauri()) return '';
  return call<string>('sidecar_url');
}

export async function runtimeStatus(): Promise<RuntimeStatus> {
  if (!isTauri()) return { ready: true, installed: true, current: true };
  return call<RuntimeStatus>('runtime_status');
}

/** Installs the Python runtime, then launches the sidecar (emits `bootstrap:*`, then `sidecar:ready`). */
export async function bootstrapRuntime(): Promise<void> {
  if (!isTauri()) return;
  await call<void>('bootstrap_runtime_command');
}

/** Stops the sidecar (a crashed one included) and launches a new one; emits `sidecar:restarted`. */
export async function restartSidecar(): Promise<void> {
  if (!isTauri()) throw new Error(NOT_IN_DESKTOP);
  await call<void>('restart_sidecar');
}

// ---------------------------------------------------------------------------
// API keys (Windows Credential Manager)
// ---------------------------------------------------------------------------

export async function setApiKey(provider: string, key: string): Promise<void> {
  if (!isTauri()) return;
  await call<void>('set_api_key', { provider, key });
}

export async function deleteApiKey(provider: string): Promise<void> {
  if (!isTauri()) return;
  await call<void>('delete_api_key', { provider });
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/** The sanitized diagnostic text (crash.rs), for the clipboard. */
export async function copyDiagnostic(): Promise<string> {
  if (!isTauri()) throw new Error(NOT_IN_DESKTOP);
  return call<string>('copy_diagnostic');
}

/** Crash log file names, newest first. */
export async function listCrashLogs(): Promise<string[]> {
  if (!isTauri()) return [];
  return call<string[]>('list_crash_logs');
}

export async function openDevtools(): Promise<void> {
  if (!isTauri()) return;
  await call<void>('open_devtools');
}

export async function appVersion(): Promise<string> {
  if (!isTauri()) return 'dev';
  return getVersion();
}

// ---------------------------------------------------------------------------
// Files and links
// ---------------------------------------------------------------------------

/** What `saveFile` rejects with when the person closes the save dialog. */
export const SAVE_CANCELLED = 'Save cancelled.';

/**
 * Saves a downloaded file. Desktop: a save dialog in the Downloads folder,
 * resolving to the path written. Dev: a browser download, resolving to null.
 */
export async function saveFile(blob: Blob, name: string): Promise<string | null> {
  if (!isTauri()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return null;
  }
  const path = await save({ defaultPath: await join(await downloadDir(), name) });
  if (!path) throw new Error(SAVE_CANCELLED);
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return path;
}

export async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await shellOpen(url);
}

// ---------------------------------------------------------------------------
// Events. Outside the desktop app they never fire.
// ---------------------------------------------------------------------------

async function on<T>(event: string, cb: (payload: T) => void): Promise<Unlisten> {
  if (!isTauri()) return () => {};
  return listen<T>(event, (e) => cb(e.payload));
}

export const onBootstrapProgress = (cb: (p: BootstrapProgress) => void) =>
  on<BootstrapProgress>('bootstrap:progress', cb);
export const onBootstrapLog = (cb: (line: string) => void) => on<string>('bootstrap:log', cb);
export const onBootstrapError = (cb: (e: BootstrapError) => void) =>
  on<BootstrapError>('bootstrap:error', cb);
export const onSidecarCrashed = (cb: (e: SidecarCrashed) => void) =>
  on<SidecarCrashed>('sidecar:crashed', cb);
export const onSidecarRestarted = (cb: (e: SidecarRestarted) => void) =>
  on<SidecarRestarted>('sidecar:restarted', cb);
