// Sequences state (brief 8.4, 9.9, plan T25, D30). The session's sequences
// (GET /api/sessions/{id}/sequences) with each card's summary, transcript and
// live work; the strategies (GET /api/strategies and their CRUD); and the
// batch (create, estimate, start).
//
// Long work:
// - "Run all turns" streams POST /api/sequences/{id}/run-auto through the
//   registry as `sequence:{id}`; each turn event reads the run's turns again,
//   so the transcript grows while it runs.
// - The batch streams POST /api/sequence-batches/{id}/start as
//   `seqbatch:{batchId}`. Neither route has a stop request, so Stop is the
//   registry's abort alone; the row stays `running` until the next start
//   sweeps it (B23).
// - Whittling is one synchronous request (POST /api/sequences/{id}/whittle)
//   that can take minutes: the card shows a working line with the expected
//   duration and the strip shows the job (R11). No client timeout.
//
// Every request goes through status.track; screens call `load()` from an
// $effect inside `untrack`.
import { request } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { Probe } from '$lib/api/types';
import { SEQUENCES } from '$lib/copy/studies';
import { friendlyError } from '$lib/errors';
import { probes } from '$lib/stores/probe.svelte';
import { status } from '$lib/stores/status.svelte';
import { streams } from '$lib/stores/streams-registry.svelte';
import {
  activeRun,
  applyAutoEvent,
  applyBatchEvent,
  batchBody,
  batchKey,
  canStep,
  clampWarmup,
  customProbeName,
  initialAuto,
  initialBatch,
  latestRun,
  mergeTurns,
  sortSequences,
  whittleExpectation,
  type AutoLive,
  type BatchEstimate,
  type BatchForm,
  type BatchLive,
  type BatchMode,
  type DropReply,
  type Sequence,
  type SequenceBatch,
  type SequenceSummary,
  type SequenceTurn,
  type Strategy,
  type StrategyForm,
  type TurnReply,
  type WhittleReply,
} from './sequences';

/** The screen's route; the strip's "Show" link returns here. */
export const SEQUENCES_ROUTE = '/studies/sequences';

export const sequenceStreamId = (id: number) => `sequence:${id}`;
export const batchStreamId = (id: number) => `seqbatch:${id}`;
export const whittleJobId = (id: number) => `whittle:${id}`;

export interface ThreadState {
  runId: number | null;
  turns: SequenceTurn[];
  /** Warmup turns planned for the run. */
  planned: number;
  loading: boolean;
  error: string | null;
}

export interface WhittleState {
  running: boolean;
  startedAt: number;
  passes: number;
  minutes: number;
  max: number;
  result: WhittleReply | null;
  error: string | null;
}

export interface NewSequenceForm {
  strategyId: number;
  /** null with `customText` set: save a custom probe first. */
  probeId: number | null;
  customText: string;
  mode: 'automatic' | 'interactive';
  warmup: number;
  engine: boolean;
}

function report(e: unknown): string {
  const f = friendlyError(e);
  status.error(f.message, f.details);
  return f.message;
}

const without = <V>(rec: Record<number, V>, id: number): Record<number, V> => {
  const next = { ...rec };
  delete next[id];
  return next;
};

class SequencesStore {
  /** The session whose sequences are listed. */
  sessionId = $state<number | null>(null);
  list = $state<Sequence[]>([]);
  loaded = $state(false);
  listError = $state<string | null>(null);

  strategies = $state<Strategy[]>([]);
  strategiesLoaded = $state(false);
  strategiesError = $state<string | null>(null);

  /** GET /api/sequences/{id} per card. */
  summaries = $state<Record<number, SequenceSummary>>({});
  /** The transcript per card, and whether it is shown. */
  threads = $state<Record<number, ThreadState>>({});
  shown = $state<Record<number, boolean>>({});
  /** A single request in flight on a card. */
  pending = $state<Record<number, 'turn' | 'drop' | 'delete' | 'create'>>({});
  /** The automatic stream's state per sequence. */
  auto = $state<Record<number, AutoLive>>({});
  whittles = $state<Record<number, WhittleState>>({});
  /** The card to scroll to (a sequence just created). */
  focusId = $state<number | null>(null);

  /** The open tab: 'run' or 'results'. */
  tab = $state<string>('run');
  /** "Show results" picks a sequence for the Results tab (T26 reads it). */
  resultsFor = $state<number | null>(null);

  // The batch
  batch = $state<SequenceBatch | null>(null);
  batchMode = $state<BatchMode>('whittle');
  estimate = $state<BatchEstimate | null>(null);
  /** The form the estimate belongs to (`batchKey`). */
  estimateKey = $state('');
  estimating = $state(false);
  batchError = $state<string | null>(null);
  batchLive = $state<BatchLive | null>(null);

  #listToken = 0;
  #strategyToken = 0;
  #batchToken = 0;

  get batchRunning(): boolean {
    return this.batchLive?.phase === 'running';
  }

  /** GET /api/sessions/{id}/sequences, newest first. */
  async load(sessionId: number): Promise<void> {
    if (sessionId !== this.sessionId) {
      this.sessionId = sessionId;
      this.list = [];
      this.loaded = false;
      this.listError = null;
      this.summaries = {};
      this.threads = {};
      this.shown = {};
      this.focusId = null;
      this.resultsFor = null;
      if (!this.batchRunning) this.resetBatch();
    }
    const token = ++this.#listToken;
    try {
      const rows = await status.track(
        request<unknown>(ROUTES.listSequences, { params: { session_id: sessionId } }),
      );
      if (token !== this.#listToken || sessionId !== this.sessionId) return;
      this.list = sortSequences(rows);
      this.listError = null;
    } catch (e) {
      if (token === this.#listToken) this.listError = report(e);
    } finally {
      if (token === this.#listToken) this.loaded = true;
    }
  }

  /** GET /api/strategies (builtins first, then by name). */
  async loadStrategies(): Promise<void> {
    const token = ++this.#strategyToken;
    try {
      const rows = await status.track(request<Strategy[]>(ROUTES.listStrategies));
      if (token !== this.#strategyToken) return;
      this.strategies = Array.isArray(rows) ? rows : [];
      this.strategiesError = null;
    } catch (e) {
      if (token === this.#strategyToken) this.strategiesError = report(e);
    } finally {
      if (token === this.#strategyToken) this.strategiesLoaded = true;
    }
  }

  strategyById(id: number): Strategy | null {
    return this.strategies.find((s) => s.id === id) ?? null;
  }

  sequenceById(id: number): Sequence | null {
    return this.list.find((s) => s.id === id) ?? null;
  }

  /** GET /api/sequences/{id}: the runs and the summary line. */
  async loadSummary(id: number): Promise<SequenceSummary | null> {
    try {
      const s = await status.track(
        request<SequenceSummary>(ROUTES.getSequence, { params: { sequence_id: id } }),
      );
      if (s && Array.isArray(s.runs)) this.summaries = { ...this.summaries, [id]: s };
      return s;
    } catch (e) {
      report(e);
      return null;
    }
  }

  /** Reads the summary once per card (completed and failed cards show it). */
  ensureSummary(id: number): void {
    if (!(id in this.summaries)) void this.loadSummary(id);
  }

  /** GET /api/sequence-runs/{id}/turns into the card's transcript. */
  async loadTurns(id: number, runId: number, planned: number): Promise<void> {
    const prev = this.threads[id];
    this.threads = {
      ...this.threads,
      [id]: {
        runId,
        turns: prev?.runId === runId ? prev.turns : [],
        planned,
        loading: true,
        error: null,
      },
    };
    try {
      const turns = await status.track(
        request<SequenceTurn[]>(ROUTES.listSequenceRunTurns, { params: { run_id: runId } }),
      );
      const cur = this.threads[id];
      if (!cur || cur.runId !== runId) return;
      this.threads = {
        ...this.threads,
        [id]: { ...cur, turns: mergeTurns(cur.turns, turns ?? []), loading: false },
      };
    } catch (e) {
      const cur = this.threads[id];
      if (cur && cur.runId === runId)
        this.threads = {
          ...this.threads,
          [id]: { ...cur, loading: false, error: friendlyError(e).message },
        };
    }
  }

  /**
   * Shows a card's transcript: the active run of an interactive sequence,
   * else the newest run. Reads the runs first.
   */
  async showThread(seq: Sequence): Promise<void> {
    this.shown = { ...this.shown, [seq.id]: true };
    if (this.threads[seq.id]?.turns.length) return;
    const summary = await this.loadSummary(seq.id);
    if (!summary) return;
    const run = canStep(seq) ? activeRun(summary.runs) : latestRun(summary.runs);
    if (run) await this.loadTurns(seq.id, run.id, run.warmup_count);
  }

  hideThread(id: number): void {
    this.shown = { ...this.shown, [id]: false };
  }

  /**
   * POST /api/sessions/{id}/sequences. A custom prompt is saved first as a
   * probe in the session (POST /api/probes, domain "custom"). Interactive
   * sequences open with their first run's empty transcript.
   */
  async create(sessionId: number, form: NewSequenceForm): Promise<Sequence | null> {
    try {
      let probeId = form.probeId;
      if (probeId === null) {
        const made = await status.track(
          request<Probe>(ROUTES.createProbe, {
            body: {
              name: customProbeName(Date.now()),
              domain: 'custom',
              prompt_text: form.customText,
              session_id: sessionId,
            },
          }),
        );
        probeId = made.id;
        await probes.reload();
      }
      const warmup = clampWarmup(form.warmup);
      const seq = await status.track(
        request<Sequence>(ROUTES.createSequence, {
          params: { session_id: sessionId },
          body: {
            probe_id: probeId,
            strategy_id: form.strategyId,
            mode: form.mode,
            max_warmup_turns: warmup,
            use_narrative_engine: form.engine,
          },
        }),
      );
      if (form.mode === 'interactive')
        this.threads = {
          ...this.threads,
          [seq.id]: {
            runId: seq.current_run_id ?? null,
            turns: [],
            planned: warmup,
            loading: false,
            error: null,
          },
        };
      this.shown = { ...this.shown, [seq.id]: form.mode === 'interactive' };
      this.focusId = seq.id;
      await this.load(sessionId);
      return seq;
    } catch (e) {
      report(e);
      return null;
    }
  }

  /** POST /api/sequences/{id}/run-turn: the coach's warmup and the model's reply. */
  async nextTurn(seq: Sequence): Promise<void> {
    if (this.pending[seq.id]) return;
    this.pending = { ...this.pending, [seq.id]: 'turn' };
    this.shown = { ...this.shown, [seq.id]: true };
    try {
      const reply = await status.track(
        request<TurnReply>(ROUTES.runSequenceTurn, { params: { sequence_id: seq.id } }),
      );
      const cur = this.threads[seq.id];
      this.threads = {
        ...this.threads,
        [seq.id]: {
          runId: cur?.runId ?? null,
          turns: mergeTurns(cur?.turns ?? [], [reply.coach_turn, reply.target_turn]),
          planned: reply.warmup_turns_planned ?? cur?.planned ?? seq.max_warmup_turns,
          loading: false,
          error: null,
        },
      };
    } catch (e) {
      report(e);
    } finally {
      this.pending = without(this.pending, seq.id);
    }
  }

  /** POST /api/sequences/{id}/drop-probe: the setup turn and the probe. Ends the sequence. */
  async dropProbe(seq: Sequence): Promise<void> {
    if (this.pending[seq.id]) return;
    this.pending = { ...this.pending, [seq.id]: 'drop' };
    this.shown = { ...this.shown, [seq.id]: true };
    try {
      const reply = await status.track(
        request<DropReply>(ROUTES.dropSequenceProbe, { params: { sequence_id: seq.id } }),
      );
      const cur = this.threads[seq.id];
      this.threads = {
        ...this.threads,
        [seq.id]: {
          runId: cur?.runId ?? null,
          turns: mergeTurns(cur?.turns ?? [], reply.turns ?? []),
          planned: cur?.planned ?? seq.max_warmup_turns,
          loading: false,
          error: null,
        },
      };
    } catch (e) {
      report(e);
    } finally {
      this.pending = without(this.pending, seq.id);
      await this.#settle(seq.id);
    }
  }

  /** Streams POST /api/sequences/{id}/run-auto as `sequence:{id}`. */
  async runAll(seq: Sequence, probeName: string): Promise<void> {
    const id = seq.id;
    if (this.auto[id]?.phase === 'running') {
      status.note(SEQUENCES.busySequence);
      return;
    }
    const live = initialAuto(seq.max_warmup_turns);
    this.auto = { ...this.auto, [id]: live };
    this.shown = { ...this.shown, [id]: true };
    this.threads = without(this.threads, id);
    this.#patchStatus(id, 'running');
    const streamId = sequenceStreamId(id);
    await streams.open(
      {
        id: streamId,
        route: SEQUENCES_ROUTE,
        label: SEQUENCES.autoStrip(probeName),
        total: live.total,
      },
      ROUTES.runSequenceAuto,
      { params: { sequence_id: id } },
      {
        on: (name, data) => {
          const cur = this.auto[id];
          if (!cur) return;
          const next = applyAutoEvent(cur, name, data);
          this.auto = { ...this.auto, [id]: next };
          streams.report(streamId, { completed: next.step, total: next.total });
          if (next.runId !== null && (name === 'turn' || name === 'complete'))
            void this.loadTurns(id, next.runId, seq.max_warmup_turns);
          if (name === 'error') report(next.error ?? '');
        },
        error: (err) => {
          const cur = this.auto[id];
          if (cur)
            this.auto = { ...this.auto, [id]: { ...cur, phase: 'failed', error: report(err) } };
        },
        done: ({ aborted }) => {
          const cur = this.auto[id];
          if (cur?.phase === 'running')
            this.auto = { ...this.auto, [id]: { ...cur, phase: aborted ? 'stopped' : 'failed' } };
          void this.#settle(id);
        },
      },
    );
  }

  /** Stop from the card: the same path as the strip's Cancel (the abort). */
  stopAll(id: number): Promise<void> {
    return streams.cancel(sequenceStreamId(id));
  }

  /**
   * POST /api/sequences/{id}/whittle. One request that runs every pass; the
   * card shows the working line and the strip shows the job meanwhile.
   */
  async whittle(seq: Sequence, probeName: string): Promise<void> {
    const id = seq.id;
    if (this.whittles[id]?.running) return;
    const { passes, minutes } = whittleExpectation(seq.max_warmup_turns);
    this.whittles = {
      ...this.whittles,
      [id]: {
        running: true,
        startedAt: Date.now(),
        passes,
        minutes,
        max: seq.max_warmup_turns,
        result: null,
        error: null,
      },
    };
    this.#patchStatus(id, 'running');
    status.progress(whittleJobId(id), {
      label: SEQUENCES.whittleStrip(probeName),
      completed: 0,
      total: passes,
      route: SEQUENCES_ROUTE,
    });
    let result: WhittleReply | null = null;
    let error: string | null = null;
    try {
      result = await status.track(
        request<WhittleReply>(ROUTES.whittleSequence, { params: { sequence_id: id } }),
      );
    } catch (e) {
      error = report(e);
    } finally {
      status.clearProgress(whittleJobId(id));
      const cur = this.whittles[id];
      if (cur)
        this.whittles = { ...this.whittles, [id]: { ...cur, running: false, result, error } };
      await this.#settle(id);
    }
  }

  /** DELETE /api/sequences/{id}. */
  async remove(seq: Sequence): Promise<void> {
    if (this.pending[seq.id]) return;
    this.pending = { ...this.pending, [seq.id]: 'delete' };
    try {
      await status.track(request(ROUTES.deleteSequence, { params: { sequence_id: seq.id } }));
      this.summaries = without(this.summaries, seq.id);
      this.threads = without(this.threads, seq.id);
      this.auto = without(this.auto, seq.id);
      this.whittles = without(this.whittles, seq.id);
      if (this.resultsFor === seq.id) this.resultsFor = null;
      status.note(SEQUENCES.deleted);
    } catch (e) {
      report(e);
    } finally {
      this.pending = without(this.pending, seq.id);
      if (this.sessionId !== null) await this.load(this.sessionId);
    }
  }

  /** "Show results": the Results tab with this sequence picked. */
  showResults(id: number): void {
    this.resultsFor = id;
    this.tab = 'results';
  }

  // ── The batch ──────────────────────────────────────────────────

  /** Whether the estimate on screen belongs to `form`. */
  estimateFits(form: BatchForm): boolean {
    return this.estimate !== null && this.estimateKey === batchKey(form);
  }

  /**
   * POST /api/sessions/{id}/sequence-batch (one pending sequence per probe),
   * then POST /api/sequence-batches/{id}/estimate.
   */
  async estimateBatch(sessionId: number, form: BatchForm): Promise<void> {
    const body = batchBody(form);
    if (!body || this.estimating || this.batchRunning) return;
    const token = ++this.#batchToken;
    this.estimating = true;
    this.batchError = null;
    this.batchLive = null;
    try {
      const batch = await status.track(
        request<SequenceBatch>(ROUTES.createSequenceBatch, {
          params: { session_id: sessionId },
          body,
        }),
      );
      const estimate = await status.track(
        request<BatchEstimate>(ROUTES.estimateSequenceBatch, { params: { batch_id: batch.id } }),
      );
      if (token !== this.#batchToken) return;
      this.batch = batch;
      this.batchMode = body.mode;
      this.estimate = estimate;
      this.estimateKey = batchKey(form);
    } catch (e) {
      if (token === this.#batchToken) this.batchError = report(e);
    } finally {
      if (token === this.#batchToken) this.estimating = false;
      void this.load(sessionId);
    }
  }

  /** Streams POST /api/sequence-batches/{id}/start as `seqbatch:{batchId}`. */
  async startBatch(nameOf: (sequenceId: number | null) => string): Promise<void> {
    const batch = this.batch;
    if (!batch || this.batchRunning) return;
    const token = ++this.#batchToken;
    const mode = this.batchMode;
    const sessionId = batch.session_id;
    const streamId = batchStreamId(batch.id);
    this.batchLive = initialBatch(batch.probes_total);
    this.batchError = null;
    await streams.open(
      {
        id: streamId,
        route: SEQUENCES_ROUTE,
        label: SEQUENCES.batchStrip(batch.probes_total),
        total: batch.probes_total,
      },
      ROUTES.startSequenceBatch,
      { params: { batch_id: batch.id } },
      {
        on: (name, data) => {
          if (token !== this.#batchToken || !this.batchLive) return;
          const next = applyBatchEvent(this.batchLive, name, data, mode, nameOf);
          this.batchLive = next;
          streams.report(streamId, {
            completed: next.completed,
            total: next.total,
            failed: next.failed,
          });
          if (next.phase === 'failed') this.batchError = report(next.error ?? '');
          if (name === 'progress' || name === 'error') void this.load(sessionId);
        },
        error: (err) => {
          if (token !== this.#batchToken || !this.batchLive) return;
          this.batchLive = {
            ...this.batchLive,
            phase: 'failed',
            error: friendlyError(err).message,
          };
          this.batchError = report(err);
        },
        done: ({ aborted }) => {
          if (token !== this.#batchToken) return;
          const cur = this.batchLive;
          if (cur?.phase === 'running')
            this.batchLive = { ...cur, phase: aborted ? 'stopped' : 'finished' };
          void this.load(sessionId);
        },
      },
    );
  }

  stopBatch(): Promise<void> {
    if (!this.batch || !this.batchRunning) return Promise.resolve();
    return streams.cancel(batchStreamId(this.batch.id));
  }

  /** Clears the batch panel for the next one. */
  resetBatch(): void {
    if (this.batchRunning) return;
    ++this.#batchToken;
    this.batch = null;
    this.estimate = null;
    this.estimateKey = '';
    this.estimating = false;
    this.batchError = null;
    this.batchLive = null;
  }

  // ── Strategies ─────────────────────────────────────────────────

  /** GET /api/strategies/{id} (Edit reads the stored fields). Throws for the dialog. */
  getStrategy(id: number): Promise<Strategy> {
    return status.track(request<Strategy>(ROUTES.getStrategy, { params: { strategy_id: id } }));
  }

  /** POST /api/strategies, or PUT /api/strategies/{id} with `id`. Throws for the dialog. */
  async saveStrategy(body: StrategyForm, id: number | null): Promise<Strategy> {
    const saved = await status.track(
      id === null
        ? request<Strategy>(ROUTES.createStrategy, { body })
        : request<Strategy>(ROUTES.updateStrategy, { params: { strategy_id: id }, body }),
    );
    await this.loadStrategies();
    return saved;
  }

  /** DELETE /api/strategies/{id} (custom strategies only). */
  async deleteStrategy(s: Strategy): Promise<void> {
    try {
      await status.track(request(ROUTES.deleteStrategy, { params: { strategy_id: s.id } }));
      status.note(SEQUENCES.strategyDeleted(s.name));
    } catch (e) {
      report(e);
    } finally {
      await this.loadStrategies();
    }
  }

  // ── Internals ──────────────────────────────────────────────────

  /** Sets a listed sequence's status on screen before the list reads it again. */
  #patchStatus(id: number, next: string): void {
    this.list = this.list.map((s) => (s.id === id ? { ...s, status: next } : s));
  }

  /** After a run ends: the list, the card's summary and its transcript. */
  async #settle(id: number): Promise<void> {
    if (this.sessionId !== null) await this.load(this.sessionId);
    const summary = await this.loadSummary(id);
    if (!summary || !this.shown[id]) return;
    const run = latestRun(summary.runs);
    if (run) await this.loadTurns(id, run.id, run.warmup_count);
  }
}

export const sequences = new SequencesStore();
