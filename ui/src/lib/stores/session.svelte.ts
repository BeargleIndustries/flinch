// The session store (brief 4.4): `{ current, list }` over GET /api/sessions.
// Model compare sessions are dropped (D29, `$lib/session` isCompareSession);
// the current session is the stored `flinch:session_id` when it is listed,
// else the newest, else null. Picking or creating a session writes
// `flinch:session_id` (brief 4.3).
//
// A change of the current session's id notifies `onChange` listeners once;
// stores/probe.svelte.ts listens to reset the Probe workspace to idle and
// reload the rail, its stats and run history (brief 4.4 last bullet).
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { CreateSessionBody, Session, SessionListItem } from '$lib/api/types';
import { friendlyError } from '$lib/errors';
import { readNumber, remove as forget, writeNumber } from '$lib/prefs';
import { pickSession, visibleSessions } from '$lib/session';
import { status } from './status.svelte';

export type SessionListener = (id: number | null) => void;

class SessionStore {
  /** Sessions the switcher lists: compare sessions dropped, newest first. */
  list = $state<SessionListItem[]>([]);
  /** Every row of GET /api/sessions, compare sessions included (I19 reads their profiles). */
  all = $state<SessionListItem[]>([]);
  current = $state<SessionListItem | null>(null);
  /** The first load has finished (successfully or not). */
  loaded = $state(false);

  #listeners = new Set<SessionListener>();
  /** The id listeners last heard; undefined before the first load. */
  #heard: number | null | undefined = undefined;

  /**
   * Calls `fn` with the new id whenever the current session changes, and once
   * right away when the first load has already finished. Returns an unsubscribe.
   */
  onChange(fn: SessionListener): () => void {
    this.#listeners.add(fn);
    if (this.#heard !== undefined) fn(this.#heard);
    return () => this.#listeners.delete(fn);
  }

  #setCurrent(next: SessionListItem | null): void {
    this.current = next;
    const id = next?.id ?? null;
    if (id === this.#heard) return;
    this.#heard = id;
    for (const fn of this.#listeners) fn(id);
  }

  /** Reads the list again and keeps (or picks) the current session. */
  async load(): Promise<void> {
    try {
      const rows = await status.track(request<SessionListItem[]>(ROUTES.listSessions));
      this.all = rows;
      this.list = visibleSessions(rows);
      const keep = this.current?.id ?? readNumber('session_id');
      this.#setCurrent(pickSession(this.list, keep));
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
      if (this.#heard === undefined) this.#setCurrent(null);
    } finally {
      this.loaded = true;
    }
  }

  /** Same as `load`; the name screens use after their own writes. */
  refresh(): Promise<void> {
    return this.load();
  }

  select(id: number): void {
    const next = this.list.find((s) => s.id === id);
    if (!next) return;
    writeNumber('session_id', id);
    this.#setCurrent(next);
  }

  /**
   * Creates a session (POST /api/sessions), makes it current and reloads the
   * list. Throws the request's error for the dialog to show inline.
   */
  async create(body: CreateSessionBody): Promise<Session> {
    const made = await status.track(request<Session>(ROUTES.createSession, { body }));
    writeNumber('session_id', made.id);
    const row: SessionListItem = { ...made, run_count: 0 };
    this.list = visibleSessions([row, ...this.list.filter((s) => s.id !== made.id)]);
    this.all = [row, ...this.all.filter((s) => s.id !== made.id)];
    this.#setCurrent(this.list.find((s) => s.id === made.id) ?? row);
    // Pick up server-side fields (run_count, probe_ids) without moving off it.
    void this.load();
    return made;
  }

  /** Deletes a session and its runs, then reloads the list. */
  async remove(id: number): Promise<void> {
    await request(ROUTES.deleteSession, { params: { session_id: id } });
    if (this.current?.id === id) {
      forget('session_id');
      this.#setCurrent(null);
    }
    await this.load();
  }
}

export const session = new SessionStore();
