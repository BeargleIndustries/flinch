// Policy reader state (brief 9.6, 9.9). The All tab reads GET /api/policies;
// each provider tab reads GET /api/policies/{provider} the first time it is
// opened on a visit. Every request goes through status.track; the screen
// calls `open` from an $effect inside `untrack`.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import type { PoliciesByProvider } from '../probe/claims';
import { flattenPolicies, type PolicyRow, type PolicyTab } from './policies';

interface TabState {
  rows: PolicyRow[];
  loaded: boolean;
  error: string | null;
}

const blank = (): TabState => ({ rows: [], loaded: false, error: null });

class PolicyStore {
  tabs = $state<Record<PolicyTab, TabState>>({
    all: blank(),
    anthropic: blank(),
    openai: blank(),
    google: blank(),
    xai: blank(),
  });

  #inflight = new Set<PolicyTab>();

  /** Forget what was read, so the next `open` reads again (each visit starts fresh). */
  reset(): void {
    for (const t of Object.keys(this.tabs) as PolicyTab[]) this.tabs[t] = blank();
  }

  /** Reads the tab's claims unless they are already in (or `force`). */
  async open(tab: PolicyTab, force = false): Promise<void> {
    if (this.#inflight.has(tab)) return;
    if (this.tabs[tab].loaded && !this.tabs[tab].error && !force) return;
    this.#inflight.add(tab);
    this.tabs[tab] = { ...this.tabs[tab], loaded: false, error: null };
    try {
      const rows =
        tab === 'all'
          ? flattenPolicies(await status.track(request<PoliciesByProvider>(ROUTES.listPolicies)))
          : await status.track(
              request<PolicyRow[]>(ROUTES.getPolicy, { params: { provider: tab } }),
            );
      this.tabs[tab] = { rows, loaded: true, error: null };
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
      this.tabs[tab] = { rows: [], loaded: true, error: f.message };
    } finally {
      this.#inflight.delete(tab);
    }
  }
}

export const policies = new PolicyStore();
