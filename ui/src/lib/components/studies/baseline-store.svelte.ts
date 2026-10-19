// Baselines state (brief 8.6, plan T28). The list is GET
// /api/sessions/{id}/snapshots; each row's saved results (probe count, badges
// per class, "Show saved results") come from GET /api/snapshots/{id}; Save is
// POST /api/sessions/{id}/snapshots {name, description} (the dialog shows its
// error inline, so `save` throws); Delete is DELETE /api/snapshots/{id}.
// Compare with now is GET /api/snapshots/{id}/diff?session_id={id}; baseline
// against baseline is worked out from the two saved results (baselines.ts
// diffRows), since the sidecar has no route for it.
//
// Every request goes through status.track; screens call the loaders from an
// $effect inside `untrack`.
import { ApiError, request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import { BASELINES } from '$lib/copy/studies';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import {
  diffRows,
  saveBody,
  toDetail,
  toDiff,
  toSummaries,
  type BaselineDetail,
  type BaselineDiff,
  type BaselineSummary,
  type CompareTarget,
} from './baselines';

export interface DetailState {
  loading: boolean;
  detail: BaselineDetail | null;
  error: string | null;
}

export interface DiffState {
  before: number;
  after: CompareTarget;
  loading: boolean;
  result: BaselineDiff | null;
  error: string | null;
}

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

class BaselinesStore {
  /** The session the list belongs to. */
  sessionId = $state<number | null>(null);
  list = $state<BaselineSummary[]>([]);
  /** The list for `sessionId` has been read (successfully or not). */
  loaded = $state(false);
  error = $state<string | null>(null);
  details = $state<Record<number, DetailState>>({});
  /** Ids with a delete in flight. */
  removing = $state<Set<number>>(new Set());
  diff = $state<DiffState | null>(null);

  #listToken = 0;
  #diffToken = 0;
  #inflight = new Map<number, Promise<BaselineDetail | null>>();

  /** Whether the list shown is this session's and has landed. */
  readyFor(sessionId: number): boolean {
    return this.loaded && this.sessionId === sessionId;
  }

  /** GET /api/sessions/{id}/snapshots, then each baseline's saved results. */
  async load(sessionId: number): Promise<void> {
    if (sessionId !== this.sessionId) {
      this.sessionId = sessionId;
      this.list = [];
      this.loaded = false;
      this.error = null;
      this.details = {};
      this.#inflight.clear();
      this.diff = null;
    }
    const token = ++this.#listToken;
    try {
      const rows = await status.track(
        request<unknown>(ROUTES.listSnapshots, { params: { session_id: sessionId } }),
      );
      if (token !== this.#listToken) return;
      this.list = toSummaries(rows);
      this.error = null;
      for (const b of this.list) void this.loadDetail(b.id);
    } catch (e) {
      if (token === this.#listToken) this.error = report(e);
    } finally {
      if (token === this.#listToken) this.loaded = true;
    }
  }

  /** GET /api/snapshots/{id}, once per baseline (a saved baseline never changes). */
  loadDetail(id: number): Promise<BaselineDetail | null> {
    const done = this.details[id]?.detail;
    if (done) return Promise.resolve(done);
    const pending = this.#inflight.get(id);
    if (pending) return pending;
    this.details = { ...this.details, [id]: { loading: true, detail: null, error: null } };
    const work = (async () => {
      try {
        const raw = await status.track(
          request<unknown>(ROUTES.getSnapshot, { params: { snapshot_id: id } }),
        );
        const detail = toDetail(raw);
        this.details = { ...this.details, [id]: { loading: false, detail, error: null } };
        return detail;
      } catch (e) {
        const message =
          e instanceof ApiError && e.status === 404 ? friendlyError(e).message : report(e);
        this.details = { ...this.details, [id]: { loading: false, detail: null, error: message } };
        return null;
      } finally {
        this.#inflight.delete(id);
      }
    })();
    this.#inflight.set(id, work);
    return work;
  }

  /**
   * POST /api/sessions/{id}/snapshots. Throws the request's error for the
   * dialog to show inline; on success the new baseline heads the list.
   */
  async save(sessionId: number, name: string, description: string): Promise<BaselineSummary> {
    const raw = await status.track(
      request<unknown>(ROUTES.createSnapshot, {
        params: { session_id: sessionId },
        body: saveBody(name, description),
      }),
    );
    const detail = toDetail(raw);
    if (!detail) throw new Error(BASELINES.loadAgain);
    const summary: BaselineSummary = {
      id: detail.id,
      session_id: detail.session_id,
      name: detail.name,
      description: detail.description,
      created_at: detail.created_at,
    };
    if (this.sessionId === sessionId) {
      this.list = [summary, ...this.list.filter((b) => b.id !== summary.id)];
      this.details = { ...this.details, [detail.id]: { loading: false, detail, error: null } };
    }
    status.note(BASELINES.saved(summary.name));
    return summary;
  }

  /** Compares `before` with now (the sidecar's diff) or with another baseline. */
  async compare(sessionId: number, before: number, after: CompareTarget): Promise<void> {
    const token = ++this.#diffToken;
    this.diff = { before, after, loading: true, result: null, error: null };
    try {
      let result: BaselineDiff;
      if (after === 'now') {
        const raw = await status.track(
          request<unknown>(ROUTES.getSnapshotDiff, {
            params: { snapshot_id: before },
            query: { session_id: sessionId },
          }),
        );
        result = toDiff(raw);
      } else {
        const [a, b] = await Promise.all([this.loadDetail(before), this.loadDetail(after)]);
        const err = this.details[before]?.error ?? this.details[after]?.error;
        if (!a || !b) throw new Error(err ?? BASELINES.loadAgain);
        result = diffRows(a.rows, b.rows);
      }
      if (token !== this.#diffToken) return;
      this.diff = { before, after, loading: false, result, error: null };
    } catch (e) {
      if (token !== this.#diffToken) return;
      this.diff = { before, after, loading: false, result: null, error: report(e) };
    }
  }

  closeDiff(): void {
    this.#diffToken++;
    this.diff = null;
  }

  /** DELETE /api/snapshots/{id}. Resolves true once it is gone. */
  async remove(id: number): Promise<boolean> {
    if (this.removing.has(id)) return false;
    this.removing = new Set([...this.removing, id]);
    try {
      await status.track(request(ROUTES.deleteSnapshot, { params: { snapshot_id: id } }));
      this.list = this.list.filter((b) => b.id !== id);
      const next = { ...this.details };
      delete next[id];
      this.details = next;
      if (this.diff && (this.diff.before === id || this.diff.after === id)) this.closeDiff();
      status.note(BASELINES.deleted);
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      const next = new Set(this.removing);
      next.delete(id);
      this.removing = next;
    }
  }
}

export const baselines = new BaselinesStore();
