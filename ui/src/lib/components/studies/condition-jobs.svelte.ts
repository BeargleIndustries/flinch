// The two other long jobs a conditions study runs (brief 8.2.3, 10.4): text
// metrics (`metrics:{id}`, POST /metrics) and AI raters (`rate:{id}`, POST
// /rate). Both stream through the registry, so the status strip shows them
// and they keep going when you leave the page; the state lives here, per
// study and job, not in the component.
//
// Neither route has a cancel endpoint: the strip's Cancel aborts the fetch,
// which closes the server's stream (B05) and stops the job between items.
import { ROUTES } from '$lib/api/endpoints';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import { streams } from '$lib/stores/streams-registry.svelte';
import { eventError, studyRoute } from './conditions';
import { metricsStreamId, rateCounts, rateStreamId } from './condition-results';

export type JobKind = 'metrics' | 'rate';
/** How the last run ended: finished, had nothing to do, failed, or was stopped. */
export type JobEnd = 'complete' | 'nothing' | 'failed' | 'stopped' | null;

export class StudyJob {
  readonly id: number;
  readonly kind: JobKind;
  live = $state(false);
  total = $state(0);
  completed = $state(0);
  /** Items that failed (rate `progress` events with an `error`). */
  failed = $state(0);
  ended = $state<JobEnd>(null);
  /** The last failure, readable. */
  error = $state<string | null>(null);
  /** Bumped when the job ends, so the tab reloads what it shows. */
  version = $state(0);

  constructor(kind: JobKind, id: number) {
    this.kind = kind;
    this.id = id;
  }

  get streamId(): string {
    return this.kind === 'metrics' ? metricsStreamId(this.id) : rateStreamId(this.id);
  }

  /** Opens the job's stream; resolves when it has ended. */
  async run(label: string, body: unknown = {}): Promise<void> {
    if (this.live) return;
    this.live = true;
    this.total = 0;
    this.completed = 0;
    this.failed = 0;
    this.ended = null;
    this.error = null;
    const route = this.kind === 'metrics' ? ROUTES.computeExperimentMetrics : ROUTES.rateExperiment;

    await streams.open(
      { id: this.streamId, route: studyRoute(this.id), label },
      route,
      { params: { experiment_id: this.id }, body },
      {
        on: (event, data) => this.#on(event, data),
        error: (e) => {
          const f = friendlyError(e);
          status.error(f.message, f.details);
          this.error = f.message;
          this.ended = 'failed';
        },
        done: ({ aborted }) => {
          if (aborted && !this.ended) this.ended = 'stopped';
          this.live = false;
          this.version++;
        },
      },
    );
  }

  #on(event: string, data: unknown): void {
    if (event === 'heartbeat') return;
    if (event === 'error') {
      const f = friendlyError(eventError(data));
      status.error(f.message, f.details);
      this.error = f.message;
      this.ended = 'failed';
      return;
    }
    const c = rateCounts(data);
    if (c.total !== null) this.total = c.total;
    if (c.completed !== null) this.completed = c.completed;
    if (event === 'progress' && c.error) {
      this.failed++;
      this.error = friendlyError(c.error).message;
    }
    streams.report(this.streamId, {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
    });
    if (event === 'complete') this.ended = this.total === 0 ? 'nothing' : 'complete';
  }
}

class StudyJobs {
  #jobs = new Map<string, StudyJob>();

  /** The study's job of this kind; the same object for the life of the app. */
  of(kind: JobKind, id: number): StudyJob {
    const key = `${kind}:${id}`;
    let job = this.#jobs.get(key);
    if (!job) {
      job = new StudyJob(kind, id);
      this.#jobs.set(key, job);
    }
    return job;
  }
}

export const studyJobs = new StudyJobs();
