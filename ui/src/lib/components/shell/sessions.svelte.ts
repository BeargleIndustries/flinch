// The header's session list (brief 4.4, 6.1 item 2): `GET /api/sessions`,
// Model compare sessions dropped (D29), the stored `flinch:session_id` when it
// is listed, else the newest. T16's session store (stores/session.svelte.ts)
// takes this over and adds what a session change resets (rail, stats,
// workspace); until then screens read `sessions.current` from here.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { SessionListItem } from '$lib/api/types';
import { friendlyError } from '$lib/errors';
import { readNumber, remove as forget, writeNumber } from '$lib/prefs';
import { pickSession, visibleSessions } from '$lib/session';
import { status } from '$lib/stores/status.svelte';

class SessionsView {
  list = $state<SessionListItem[]>([]);
  current = $state<SessionListItem | null>(null);
  /** The first load has finished (successfully or not). */
  loaded = $state(false);

  /** Reads the list again and keeps (or picks) the current session. */
  async load(): Promise<void> {
    try {
      const rows = await status.track(request<SessionListItem[]>(ROUTES.listSessions));
      this.list = visibleSessions(rows);
      const keep = this.current?.id ?? readNumber('session_id');
      this.current = pickSession(this.list, keep);
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
    } finally {
      this.loaded = true;
    }
  }

  select(id: number): void {
    const next = this.list.find((s) => s.id === id);
    if (!next) return;
    this.current = next;
    writeNumber('session_id', id);
  }

  /** Deletes a session and its runs, then reloads the list. */
  async remove(id: number): Promise<void> {
    await request(ROUTES.deleteSession, { params: { session_id: id } });
    if (this.current?.id === id) {
      this.current = null;
      forget('session_id');
    }
    await this.load();
  }
}

export const sessions = new SessionsView();
