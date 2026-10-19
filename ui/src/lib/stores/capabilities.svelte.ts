// Sidecar facts (brief 6.1, B21, D25): `/health` (version, database path,
// how many keys are set) and `GET /api/settings/capabilities` (PDF export,
// optional SDKs). Capabilities load once and again after a sidecar restart;
// `/health` is polled every 15 s while the shell is mounted and drives the
// sidecar chip and the crash banner.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { Capabilities, Health } from '$lib/api/types';
import { onSidecarCrashed, onSidecarRestarted, type SidecarCrashed } from '$lib/tauri';

/** connecting: no answer yet; ready: the last `/health` was 200; crashed: it failed, or the shell said so. */
export type SidecarState = 'connecting' | 'ready' | 'crashed';

export const HEALTH_POLL_MS = 15_000;
/** Dev only: failed `/health` checks in a row before the "not reachable" banner. */
export const UNREACHABLE_AFTER = 3;

class CapabilitiesStore {
  health = $state<Health | null>(null);
  caps = $state<Capabilities | null>(null);
  sidecar = $state<SidecarState>('connecting');
  /** Failed `/health` checks in a row. */
  failures = $state(0);
  /** The desktop shell's `sidecar:crashed` payload, until the sidecar answers again. */
  crash = $state<SidecarCrashed | null>(null);

  #capsLoading: Promise<void> | null = null;

  /** Dev: the sidecar has not answered `/health` several times in a row. */
  get unreachable(): boolean {
    return this.failures >= UNREACHABLE_AFTER;
  }

  /** Asks `/health` once. Never throws. */
  async checkHealth(): Promise<void> {
    try {
      const h = await request<Health>(ROUTES.health);
      this.health = h;
      this.sidecar = 'ready';
      this.failures = 0;
      this.crash = null;
      if (!this.caps) void this.loadCapabilities();
    } catch {
      this.failures += 1;
      this.sidecar = 'crashed';
    }
  }

  /** Loads capabilities; a second call while one is in flight shares it. `force` reloads. */
  loadCapabilities(force = false): Promise<void> {
    if (this.#capsLoading && !force) return this.#capsLoading;
    if (this.caps && !force) return Promise.resolve();
    const run = (async () => {
      try {
        this.caps = await request<Capabilities>(ROUTES.getCapabilities);
      } catch {
        // The next healthy `/health` tries again.
      } finally {
        this.#capsLoading = null;
      }
    })();
    this.#capsLoading = run;
    return run;
  }

  /** The sidecar was restarted: forget the crash and read everything again. */
  async restarted(): Promise<void> {
    this.crash = null;
    this.failures = 0;
    this.sidecar = 'connecting';
    await this.checkHealth();
    await this.loadCapabilities(true);
  }

  /** Starts polling and listens for the shell's sidecar events; returns the stop function. */
  start(): () => void {
    void this.checkHealth();
    const timer = setInterval(() => void this.checkHealth(), HEALTH_POLL_MS);
    const unlisten: (() => void)[] = [];
    let stopped = false;
    const keep = (p: Promise<() => void>) =>
      p.then((u) => (stopped ? u() : unlisten.push(u))).catch(() => {});
    keep(
      onSidecarCrashed((e) => {
        this.crash = e;
        this.sidecar = 'crashed';
      }),
    );
    keep(onSidecarRestarted(() => void this.restarted()));
    return () => {
      stopped = true;
      clearInterval(timer);
      unlisten.forEach((u) => u());
    };
  }
}

export const capabilities = new CapabilitiesStore();
