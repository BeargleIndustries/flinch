// Shared e2e helpers (plan 6.3: owned by T14; later specs only read this file
// and seed their own data through it). Everything here is lazy: the config
// imports this module, and its first statements must run before any of it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The `ui/` folder. */
export const UI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export type E2EPorts = { fake: number; sidecar: number; preview: number };

const DEFAULT_PORTS: E2EPorts = { fake: 8766, sidecar: 8765, preview: 4173 };

const PORT_ENV: Record<keyof E2EPorts, string> = {
  fake: 'FLINCH_E2E_FAKE_PORT',
  sidecar: 'FLINCH_E2E_SIDECAR_PORT',
  preview: 'FLINCH_E2E_PREVIEW_PORT',
};

function asPort(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : undefined;
}

/** The raw `ui/.e2e-ports.json` (written by scripts/new-worktree.ps1), or null. */
export function readPortsFile(): Partial<Record<keyof E2EPorts, unknown>> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(UI_DIR, '.e2e-ports.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** Ports: env var, else `ui/.e2e-ports.json`, else the defaults (plan F9, K3). */
export function readPorts(): E2EPorts {
  const file = readPortsFile() ?? {};
  const pick = (key: keyof E2EPorts): number =>
    asPort(process.env[PORT_ENV[key]]) ?? asPort(file[key]) ?? DEFAULT_PORTS[key];
  return { fake: pick('fake'), sidecar: pick('sidecar'), preview: pick('preview') };
}

/**
 * A static file served by `vite preview`, for specs that only need a page on the
 * preview origin. The app's own routes redirect on load, and a navigation in
 * flight aborts any fetch the spec starts from `page.evaluate`.
 */
export const BLANK_PAGE = '/favicon.png';

export function sidecarUrl(): string {
  return `http://127.0.0.1:${readPorts().sidecar}`;
}

export function previewUrl(): string {
  return `http://127.0.0.1:${readPorts().preview}`;
}

/** This run's folder (`FLINCH_E2E_TMP`, set by playwright.config.ts). */
export function tmpDir(): string {
  const dir = process.env.FLINCH_E2E_TMP;
  if (!dir)
    throw new Error('FLINCH_E2E_TMP is not set; run the suite through playwright.config.ts');
  return dir;
}

/** Calls the sidecar directly (not through the preview proxy) and returns its JSON. */
export async function api<T = unknown>(method: string, route: string, body?: unknown): Promise<T> {
  const res = await fetch(`${sidecarUrl()}${route}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} returned ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

export type Probe = { id: number; name: string; prompt_text: string };
export type Session = { id: number; name: string; probe_ids?: number[] | null };
export type Run = {
  id: number;
  session_id: number;
  probe_id: number;
  initial_classification: string;
};

/** Creates a probe, or returns the existing one with that name. */
export async function ensureProbe(
  name: string,
  promptText: string,
  domain = 'e2e',
): Promise<Probe> {
  const existing = (await api<Probe[]>('GET', '/api/probes')).find((p) => p.name === name);
  if (existing) return existing;
  return api<Probe>('POST', '/api/probes', { name, domain, prompt_text: promptText });
}

export async function createSession(name: string, probeIds: number[]): Promise<Session> {
  return api<Session>('POST', '/api/sessions', { name, probe_ids: probeIds });
}

/** Sends one probe in a session and returns the saved run. */
export async function sendProbe(sessionId: number, probeId: number): Promise<Run> {
  return api<Run>('POST', `/api/sessions/${sessionId}/run`, { probe_id: probeId });
}

/** What global-setup.ts seeded; written to `{FLINCH_E2E_TMP}/seed.json`. */
export type Seed = {
  sessionId: number;
  probes: { refuseMe: number; answerMe: number };
  refusedRunId: number;
};

export function seedFile(): string {
  return path.join(tmpDir(), 'seed.json');
}

export function readSeed(): Seed {
  return JSON.parse(fs.readFileSync(seedFile(), 'utf8')) as Seed;
}
