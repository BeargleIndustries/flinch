// The streams registry (brief 10.4). Every long-running SSE job goes through
// `streams.open`, so the status strip can show it and stop it from any screen.
//
// Rules:
// - One stream per id (`batch:{sessionId}`, `statrun:{sessionId}`,
//   `conditions:{experimentId}`, `metrics:{experimentId}`, `rate:{experimentId}`,
//   `hh:{experimentId}`, `sequence:{sequenceId}`, `seqbatch:{batchId}`):
//   opening an id that is open aborts the old stream first.
// - `cancel(id)` runs the route's own cancel (for example the batch cancel
//   POST) and then aborts the fetch.
// - Counts reported with `report` feed `status.progress`; the entry and its
//   strip line are dropped when the stream ends.
import { openStream, type StreamHandlers, type StreamOptions } from '$lib/api/streams';
import type { StreamRoute } from '$lib/api/endpoints';
import { status } from './status.svelte';

export interface StreamMeta {
  /** One of the ids above. */
  id: string;
  /** The screen that started the job; the strip's "Show" link goes there. */
  route: string;
  /** What the strip says while the job runs. */
  label: string;
  /** Stops the job on the server; runs before the fetch is aborted. */
  cancel?: () => void | Promise<void>;
  /** Known size of the job, when the screen knows it before the first event. */
  total?: number;
}

export interface StreamEntry {
  id: string;
  route: string;
  label: string;
  startedAt: number;
  completed: number;
  total: number;
  failed: number;
}

export interface StreamCounts {
  completed?: number;
  total?: number;
  failed?: number;
  label?: string;
}

/** `openStream`'s signature; tests pass a fake. */
export type StreamOpener = (
  route: StreamRoute,
  opts: StreamOptions,
  handlers: StreamHandlers,
  signal?: AbortSignal,
) => Promise<void>;

export class StreamsRegistry {
  /** Open streams by id. */
  entries = $state<Record<string, StreamEntry>>({});
  #controllers = new Map<string, AbortController>();
  #cancels = new Map<string, StreamMeta['cancel']>();
  #clock = 0;
  #opener: StreamOpener;

  constructor(opener: StreamOpener = openStream) {
    this.#opener = opener;
  }

  isOpen(id: string): boolean {
    return this.#controllers.has(id);
  }

  /** The newest open stream, or null. */
  get newest(): StreamEntry | null {
    let best: StreamEntry | null = null;
    for (const e of Object.values(this.entries))
      if (!best || e.startedAt > best.startedAt) best = e;
    return best;
  }

  /**
   * Opens a stream and registers it under `meta.id`. Resolves when the stream
   * has ended (after `handlers.done`); never rejects.
   */
  open(
    meta: StreamMeta,
    route: StreamRoute,
    opts: StreamOptions,
    handlers: StreamHandlers,
  ): Promise<void> {
    const { id } = meta;
    this.#controllers.get(id)?.abort();
    const controller = new AbortController();
    this.#controllers.set(id, controller);
    this.#cancels.set(id, meta.cancel);
    status.clearProgress(id);
    this.entries = {
      ...this.entries,
      [id]: {
        id,
        route: meta.route,
        label: meta.label,
        startedAt: ++this.#clock,
        completed: 0,
        total: meta.total ?? 0,
        failed: 0,
      },
    };
    this.#publish(id);

    return this.#opener(
      route,
      opts,
      {
        on: (name, data) => handlers.on(name, data),
        error: (err) => handlers.error?.(err),
        done: (info) => {
          // A newer stream with the same id owns the entry now; leave it alone.
          if (this.#controllers.get(id) === controller) this.#drop(id);
          handlers.done?.(info);
        },
      },
      controller.signal,
    );
  }

  /** Updates a stream's counts (and label); the strip follows. */
  report(id: string, counts: StreamCounts): void {
    const e = this.entries[id];
    if (!e) return;
    this.entries = {
      ...this.entries,
      [id]: {
        ...e,
        completed: counts.completed ?? e.completed,
        total: counts.total ?? e.total,
        failed: counts.failed ?? e.failed,
        label: counts.label ?? e.label,
      },
    };
    this.#publish(id);
  }

  /** Runs the route's cancel, then aborts the fetch. The abort happens even when the cancel fails. */
  async cancel(id: string): Promise<void> {
    const controller = this.#controllers.get(id);
    if (!controller) return;
    try {
      await this.#cancels.get(id)?.();
    } finally {
      controller.abort();
    }
  }

  /** Aborts the fetch without asking the server to stop (a screen that only reads). */
  abort(id: string): void {
    this.#controllers.get(id)?.abort();
  }

  #publish(id: string): void {
    const e = this.entries[id];
    if (!e) return;
    status.progress(id, {
      label: e.label,
      completed: e.completed,
      total: e.total,
      failed: e.failed,
      route: e.route,
      cancel: () => this.cancel(id),
    });
  }

  #drop(id: string): void {
    this.#controllers.delete(id);
    this.#cancels.delete(id);
    if (id in this.entries) {
      const next = { ...this.entries };
      delete next[id];
      this.entries = next;
    }
    status.clearProgress(id);
  }
}

export const streams = new StreamsRegistry();
