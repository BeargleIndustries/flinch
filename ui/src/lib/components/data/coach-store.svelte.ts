// Coach examples state (brief 9.4, I19, B28). Every request goes through
// status.track; the screen calls these from an $effect inside `untrack`.
//
// GET /api/coach-profiles          [{name, ...}]   (the I19 union with sessions)
// GET /api/coach-examples          ?profile=&limit=500, best-rated first
// PATCH /api/coach-examples/{id}   {pushback_text} or {effectiveness}
// DELETE /api/coach-examples/{id}
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { CoachExample, UpdateCoachExampleBody } from '$lib/api/types';
import { friendlyError } from '$lib/errors';
import { DEFAULT_COACH_PROFILE } from '$lib/session';
import { status } from '$lib/stores/status.svelte';
import { EXAMPLE_LIMIT, applyUpdate, withoutExample } from './coach';

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

class CoachStore {
  /** Names from GET /api/coach-profiles; the screen adds the sessions' profiles (I19). */
  profileNames = $state<{ name: string }[]>([]);
  profilesLoaded = $state(false);

  /** The profile `examples` belong to. */
  profile = $state(DEFAULT_COACH_PROFILE);
  examples = $state<CoachExample[]>([]);
  /** The read for `profile` has finished (successfully or not). */
  loaded = $state(false);
  error = $state<string | null>(null);

  /** Ids with a PATCH or DELETE in flight; their controls are disabled. */
  busy = $state<Set<number>>(new Set());

  #seq = 0;

  async loadProfiles(): Promise<void> {
    try {
      this.profileNames = await status.track(request<{ name: string }[]>(ROUTES.listCoachProfiles));
    } catch (e) {
      report(e);
      this.profileNames = [];
    } finally {
      this.profilesLoaded = true;
    }
  }

  /** Reads every example of `profile`; a later call wins over an earlier one. */
  async load(profile: string): Promise<void> {
    const seq = ++this.#seq;
    this.profile = profile;
    this.loaded = false;
    this.error = null;
    try {
      const rows = await status.track(
        request<CoachExample[]>(ROUTES.listCoachExamples, {
          query: { profile, limit: EXAMPLE_LIMIT },
        }),
      );
      if (seq !== this.#seq) return;
      this.examples = rows;
    } catch (e) {
      if (seq !== this.#seq) return;
      this.examples = [];
      this.error = report(e);
    } finally {
      if (seq === this.#seq) this.loaded = true;
    }
  }

  #mark(id: number, on: boolean): void {
    const next = new Set(this.busy);
    if (on) next.add(id);
    else next.delete(id);
    this.busy = next;
  }

  /** PATCH one example; on success the card shows the new values in place. */
  async update(id: number, patch: UpdateCoachExampleBody, done?: string): Promise<boolean> {
    this.#mark(id, true);
    try {
      await status.track(
        request<{ updated: boolean }>(ROUTES.updateCoachExample, {
          params: { example_id: id },
          body: patch,
        }),
      );
      this.examples = applyUpdate(this.examples, id, patch);
      if (done) status.note(done);
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      this.#mark(id, false);
    }
  }

  async remove(id: number, done?: string): Promise<boolean> {
    this.#mark(id, true);
    try {
      await status.track(
        request<{ deleted: boolean }>(ROUTES.deleteCoachExample, { params: { example_id: id } }),
      );
      this.examples = withoutExample(this.examples, id);
      if (done) status.note(done);
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      this.#mark(id, false);
    }
  }
}

export const coach = new CoachStore();
