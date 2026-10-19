// Conditions study runs (brief 8.2.3, D28, I33, F14) and the prompt sources
// (I12). One runner, the experiments API: Start and Resume stream through the
// streams registry under `conditions:{id}`, so the status strip shows the run
// and it keeps going when you leave the page; the state lives here, per study,
// not in the component.
//
// Pause is the registry's cancel: POST /pause writes `paused` (the server's
// workers read it before each cell), then the fetch is aborted, which closes
// the server's stream and releases the study (I33). Resume opens a new stream;
// a 409 "This study is already running." shows ERROR_COPY.studyRunning once.
// There is no client retry loop: the server waits up to 5 s for the old
// stream to release before it answers 409.
import { ApiError, request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { ProviderLimit } from '$lib/api/types';
import { ERROR_COPY } from '$lib/copy/errors-copy';
import { CONDITIONS } from '$lib/copy/studies';
import { friendlyError } from '$lib/errors';
import { status } from '$lib/stores/status.svelte';
import { streams } from '$lib/stores/streams-registry.svelte';
import {
  conditionsStreamId,
  csvCount,
  eventCounts,
  eventError,
  hhBody,
  hhResult,
  hhStreamId,
  studyRoute,
  type HhResult,
  type PromptSources,
} from './conditions';

/** The Progress panel reloads at most this often while a run streams (brief 8.2.3). */
export const RELOAD_EVERY_MS = 2000;

export type RunMode = 'start' | 'resume' | 'retry';
export type RunEnd = 'paused' | 'complete' | 'failed' | null;

/** A message for the UI, with the strip error posted once. */
function report(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) {
    status.error(ERROR_COPY.studyRunning, e.detail || null);
    return ERROR_COPY.studyRunning;
  }
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

export class StudyRun {
  readonly id: number;
  /** This window's stream is open. */
  live = $state(false);
  pausing = $state(false);
  /** This run's counts (the cells pending when it started). */
  total = $state(0);
  completed = $state(0);
  failed = $state(0);
  ended = $state<RunEnd>(null);
  /** The last failure to show by the action row. */
  error = $state<string | null>(null);
  /** Bumped when the study's data should be read again (throttled while streaming). */
  version = $state(0);

  #lastBump = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(id: number) {
    this.id = id;
  }

  get streamId(): string {
    return conditionsStreamId(this.id);
  }

  /** Reload now. */
  bump(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#lastBump = Date.now();
    this.version++;
  }

  /** Reload at most every RELOAD_EVERY_MS, with a trailing reload. */
  #tick(): void {
    const wait = this.#lastBump + RELOAD_EVERY_MS - Date.now();
    if (wait <= 0) this.bump();
    else this.#timer ??= setTimeout(() => this.bump(), wait);
  }

  /**
   * Start (`/start`), Resume (`/resume`) or Retry failed (`/resume` with
   * `retry_failed`), sending the study's saved per-provider limits (B36).
   * Resolves when the stream has ended.
   */
  async run(
    mode: RunMode,
    name: string,
    limits: Record<string, number | ProviderLimit>,
  ): Promise<void> {
    if (this.live) return;
    this.live = true;
    this.pausing = false;
    this.ended = null;
    this.error = null;
    this.total = 0;
    this.completed = 0;
    this.failed = 0;

    const route = mode === 'start' ? ROUTES.startExperiment : ROUTES.resumeExperiment;
    const body =
      mode === 'retry'
        ? { concurrency_per_provider: limits, retry_failed: true }
        : { concurrency_per_provider: limits };

    await streams.open(
      {
        id: this.streamId,
        route: studyRoute(this.id),
        label: CONDITIONS.streamLabel(name),
        cancel: () => this.#postPause(),
      },
      route,
      { params: { experiment_id: this.id }, body },
      {
        on: (event, data) => this.#on(event, data),
        error: (e) => {
          this.error = report(e);
          this.ended = 'failed';
        },
        done: () => {
          this.live = false;
          this.pausing = false;
          this.bump();
        },
      },
    );
  }

  #on(event: string, data: unknown): void {
    const c = eventCounts(data);
    if (event === 'heartbeat') return;
    if (event === 'error') {
      const f = friendlyError(eventError(data));
      status.error(f.message, f.details);
      this.error = f.message;
      return;
    }
    if (c.total !== null) this.total = c.total;
    if (c.completed !== null) this.completed = c.completed;
    if (c.failed !== null) this.failed = c.failed;
    streams.report(this.streamId, {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
    });
    if (event === 'paused') {
      this.ended = 'paused';
      status.note(CONDITIONS.pausedNotice(this.completed, this.total));
    } else if (event === 'complete') {
      this.ended = 'complete';
    } else if (event === 'progress' || event === 'started') {
      this.#tick();
    }
  }

  /** POST /pause; the registry aborts the stream after it (D17). */
  async #postPause(): Promise<void> {
    this.pausing = true;
    try {
      await status.track(request(ROUTES.pauseExperiment, { params: { experiment_id: this.id } }));
      this.ended = 'paused';
    } catch (e) {
      this.error = report(e);
    }
  }

  /** Pause: writes `paused`, then the stream ends. */
  async pause(): Promise<void> {
    if (!this.live || this.pausing) return;
    await streams.cancel(this.streamId);
  }
}

class StudyRuns {
  #runs = new Map<number, StudyRun>();

  /** The study's run state; the same object for the life of the app. */
  of(id: number): StudyRun {
    let run = this.#runs.get(id);
    if (!run) {
      run = new StudyRun(id);
      this.#runs.set(id, run);
    }
    return run;
  }
}

export const studyRuns = new StudyRuns();

/**
 * Adds a study's prompts in the I12 order: HH-RLHF (a stream under
 * `hh:{id}`; the importer refuses a study that already has prompts, so it
 * goes first), then picked probes, then the pasted CSV. Stops at the first
 * failure and throws its friendly message.
 */
export async function addPromptSources(
  id: number,
  sources: PromptSources,
): Promise<{ hh: HhResult | null }> {
  const params = { experiment_id: id };
  const got: { hh: HhResult | null; failure: unknown } = { hh: null, failure: null };

  if (sources.hh.enabled) {
    await streams.open(
      { id: hhStreamId(id), route: studyRoute(id), label: CONDITIONS.importingHh },
      ROUTES.importHhPrompts,
      { params, body: hhBody(sources.hh) },
      {
        on: (event, data) => {
          if (event === 'complete') got.hh = hhResult(data);
          else if (event === 'error') got.failure ??= new Error(eventError(data));
        },
        error: (e) => {
          got.failure ??= e;
        },
      },
    );
    if (got.failure) throw new Error(friendlyError(got.failure).message);
    if (!got.hh) throw new Error(ERROR_COPY.generic);
    if (got.hh.warning) status.note(got.hh.warning);
    else status.note(CONDITIONS.hhImported(got.hh.imported));
  }

  try {
    if (sources.probeIds.size > 0) {
      await status.track(
        request(ROUTES.addExperimentPrompts, {
          params,
          body: [...sources.probeIds].map((probe_id) => ({ probe_id })),
        }),
      );
    }
    if (csvCount(sources.csvText).rows > 0) {
      await status.track(
        request(ROUTES.importExperimentPrompts, {
          params,
          body: { source: 'csv', csv_text: sources.csvText },
        }),
      );
    }
  } catch (e) {
    throw new Error(friendlyError(e).message);
  }
  return { hh: got.hh };
}
