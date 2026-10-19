// The status strip's store (brief 6.4). Long jobs report progress here by id,
// so leaving a screen never hides a running job; failures post one error.
// StatusStrip.svelte reads it. T15 mounts the strip and connects the streams
// registry (brief 10.4) to `progress` and `clearProgress`.

export interface ProgressInput {
  label: string;
  completed: number;
  total: number;
  failed?: number;
  /** The route that started the job; the strip's "Show" link goes back there. */
  route: string;
  /** Present when the job can be stopped; the strip shows "Cancel". */
  cancel?: () => void | Promise<void>;
}

export interface ProgressEntry extends Required<Omit<ProgressInput, 'cancel'>> {
  id: string;
  cancel?: () => void | Promise<void>;
  /** When the id was first reported; the strip shows the newest job. */
  startedAt: number;
}

export interface StatusError {
  id: number;
  message: string;
  details: string | null;
}

class StatusStore {
  jobs = $state<Record<string, ProgressEntry>>({});
  errors = $state<StatusError[]>([]);
  #nextError = 1;
  #clock = 0;

  /** The newest running job, or null. */
  get current(): ProgressEntry | null {
    let best: ProgressEntry | null = null;
    for (const j of Object.values(this.jobs)) if (!best || j.startedAt > best.startedAt) best = j;
    return best;
  }

  /** The newest error, or null. */
  get lastError(): StatusError | null {
    return this.errors.at(-1) ?? null;
  }

  /** Report or update a job's progress. An id keeps its start order across updates. */
  progress(id: string, p: ProgressInput): void {
    const startedAt = this.jobs[id]?.startedAt ?? ++this.#clock;
    this.jobs[id] = {
      id,
      label: p.label,
      completed: p.completed,
      total: p.total,
      failed: p.failed ?? 0,
      route: p.route,
      cancel: p.cancel,
      startedAt,
    };
  }

  clearProgress(id: string): void {
    if (!(id in this.jobs)) return;
    const next = { ...this.jobs };
    delete next[id];
    this.jobs = next;
  }

  /** Post an error; returns its id for `dismissError`. Only the newest few are kept. */
  error(message: string, details: string | null = null): number {
    const id = this.#nextError++;
    this.errors = [...this.errors.slice(-4), { id, message, details }];
    return id;
  }

  dismissError(id: number): void {
    this.errors = this.errors.filter((e) => e.id !== id);
  }
}

export const status = new StatusStore();
