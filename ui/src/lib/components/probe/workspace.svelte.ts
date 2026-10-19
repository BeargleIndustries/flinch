// The Probe workspace's requests (brief 7.2 to 7.9). The phase lives in
// `probes.machine` (stores/probe.svelte.ts over $lib/probe-machine); this
// module makes the requests each phase needs and feeds their results to the
// machine as events. It also holds what the machine does not: the run's
// turns and annotation, the custom prompt text, and which runs were taught.
//
// Every request is wrapped in `status.track`; a failure posts its
// friendlyError line to the status strip and to the machine (REQUEST_FAILED),
// which shows it inline under the control that sent it (brief 7.4). No Probe
// route streams; the batch run (T18) is the only stream in this section.
import { request, ApiError } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { Annotation, AnnotationBody, Run, RunTurn } from '$lib/api/types';
import { friendlyError } from '$lib/errors';
import { probes } from '$lib/stores/probe.svelte';
import { session } from '$lib/stores/session.svelte';
import { status } from '$lib/stores/status.svelte';
import {
  badgeField,
  coachDraft,
  openRunEvents,
  pushbackSource,
  threadItems,
  type ThreadItem,
} from './thread';

export type OpenResult = 'ok' | 'missing' | 'error';

class Workspace {
  /** The turns of `turnsFor`'s run. */
  turns = $state<RunTurn[]>([]);
  turnsFor = $state<number | null>(null);
  annotation = $state<Annotation | null>(null);
  /** The custom prompt being written (brief 7.3). */
  customText = $state('');
  /** Runs promoted to coach examples in this window (brief 7.7: "Taught"). */
  taught = $state<Set<number>>(new Set());
  teaching = $state(false);

  /** Bumped by each send, so an answer that arrives after a newer send is dropped. */
  #token = 0;

  /** The machine's run with every field the routes return. */
  get run(): Run | null {
    return (probes.machine.run as Run | null) ?? null;
  }

  /** The thread of the machine's run, or empty while it loads. */
  get items(): ThreadItem[] {
    const run = this.run;
    return run && this.turnsFor === run.id ? threadItems(this.turns) : [];
  }

  /** The current session's target model, for "Waiting for {model}…". */
  get model(): string {
    return this.run?.target_model ?? session.current?.target_model ?? '';
  }

  #fail(e: unknown): void {
    const f = friendlyError(e);
    status.error(f.message, f.details);
    probes.dispatch({ type: 'REQUEST_FAILED', message: f.message });
  }

  /** The machine still shows `runId` (a session switch or a newer pick moves it off). */
  #still(runId: number): boolean {
    return probes.machine.run?.id === runId;
  }

  async #turns(runId: number): Promise<RunTurn[]> {
    return status.track(request<RunTurn[]>(ROUTES.listRunTurns, { params: { run_id: runId } }));
  }

  /** Send (S): the picked probe, or the custom text (brief 7.2 to 7.4). */
  async send(): Promise<void> {
    const sessionId = probes.sessionId;
    const m = probes.machine;
    if (sessionId === null || !probes.can('SEND')) return;
    const custom = m.phase === 'custom';
    const text = this.customText;
    probes.dispatch({ type: 'SEND', text: custom ? text : undefined });
    if (probes.machine.phase !== 'sending') return;
    const token = ++this.#token;
    try {
      const run = await status.track(
        request<Run>(ROUTES.sendProbe, {
          params: { session_id: sessionId },
          body: custom ? { custom_text: text } : { probe_id: m.probeId },
        }),
      );
      if (token !== this.#token || probes.machine.phase !== 'sending') return;
      if (custom) {
        // The sidecar made a probe for the text (and, B18, added it to the session).
        this.customText = '';
        await probes.reload();
        void session.refresh();
        if (token !== this.#token || probes.machine.phase !== 'sending') return;
      }
      probes.dispatch({ type: 'RUN_RETURNED', run });
      void probes.refreshActivity();
      await this.#loadThread(run, token);
    } catch (e) {
      if (token === this.#token && probes.machine.phase === 'sending') this.#fail(e);
    }
  }

  /** GET turns and annotation, then THREAD_LOADED with the coach's draft. */
  async #loadThread(run: Run, token: number): Promise<void> {
    try {
      const [turns, annotation] = await status.track(
        Promise.all([
          this.#turns(run.id),
          request<Annotation>(ROUTES.getAnnotation, { params: { run_id: run.id } }),
        ]),
      );
      if (token !== this.#token || !this.#still(run.id)) return;
      this.turns = turns;
      this.turnsFor = run.id;
      this.annotation = annotation;
      probes.dispatch({ type: 'THREAD_LOADED', run, draft: coachDraft(run) });
    } catch (e) {
      if (token === this.#token && this.#still(run.id)) this.#fail(e);
    }
  }

  /** Send pushback (P): the box's text, `coach` when it is the draft unchanged (D13). */
  async pushback(): Promise<void> {
    const run = this.run;
    const m = probes.machine;
    if (!run || m.phase !== 'pushback' || m.sending || m.draft.trim() === '') return;
    const text = m.draft;
    const source = pushbackSource(text, coachDraft(run));
    probes.dispatch({ type: 'REQUEST_START' });
    try {
      const next = await status.track(
        request<Run>(ROUTES.sendPushback, { params: { run_id: run.id }, body: { text, source } }),
      );
      const turns = await this.#turns(run.id);
      if (!this.#still(run.id)) return;
      this.turns = turns;
      this.turnsFor = run.id;
      probes.dispatch({ type: 'PUSHBACK_SENT', run: next });
      void probes.refreshActivity();
    } catch (e) {
      if (this.#still(run.id)) this.#fail(e);
    }
  }

  /** Skip (K): records that no pushback was sent. */
  async skip(): Promise<void> {
    const run = this.run;
    const m = probes.machine;
    if (!run || m.phase !== 'pushback' || m.sending) return;
    probes.dispatch({ type: 'REQUEST_START' });
    try {
      const next = await status.track(
        request<Run>(ROUTES.skipPushback, { params: { run_id: run.id } }),
      );
      if (!this.#still(run.id)) return;
      probes.dispatch({ type: 'SKIPPED', run: next });
      void probes.refreshActivity();
    } catch (e) {
      if (this.#still(run.id)) this.#fail(e);
    }
  }

  /** "Send another pushback" (brief 7.7 item 1). Resolves true when it was sent. */
  async continueWith(text: string): Promise<boolean> {
    const run = this.run;
    const m = probes.machine;
    if (!run || m.phase !== 'done' || m.sending || text.trim() === '') return false;
    probes.dispatch({ type: 'REQUEST_START' });
    try {
      const next = await status.track(
        request<Run>(ROUTES.continuePushback, {
          params: { run_id: run.id },
          body: { text, source: 'override' },
        }),
      );
      const turns = await this.#turns(run.id);
      if (!this.#still(run.id)) return false;
      this.turns = turns;
      this.turnsFor = run.id;
      probes.dispatch({ type: 'CONTINUED', run: next });
      void probes.refreshActivity();
      return true;
    } catch (e) {
      if (this.#still(run.id)) this.#fail(e);
      return false;
    }
  }

  /** A badge correction (brief 7.5): PATCH the field the response's badge edits. */
  async correct(item: ThreadItem, value: string): Promise<void> {
    const run = this.run;
    const field = badgeField(item);
    if (!run || !field) return;
    try {
      const next = await status.track(
        request<Run>(ROUTES.updateClassification, {
          params: { run_id: run.id },
          body: { field, value },
        }),
      );
      probes.dispatch({ type: 'RUN_UPDATED', run: next });
      void probes.refreshActivity();
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
    }
  }

  /** "Teach the coach this exchange" (D14): POST /promote, then "Taught". */
  async teach(): Promise<void> {
    const run = this.run;
    if (!run || this.teaching || this.taught.has(run.id)) return;
    this.teaching = true;
    try {
      await status.track(request(ROUTES.promoteRun, { params: { run_id: run.id } }));
      this.taught = new Set([...this.taught, run.id]);
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
    } finally {
      this.teaching = false;
    }
  }

  /** PUT one or more annotation fields of the current run. Resolves true when saved. */
  async saveAnnotation(body: AnnotationBody): Promise<boolean> {
    const run = this.run;
    if (!run) return false;
    try {
      const saved = await status.track(
        request<Annotation>(ROUTES.saveAnnotation, { params: { run_id: run.id }, body }),
      );
      if (this.#still(run.id)) this.annotation = saved;
      return true;
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
      return false;
    }
  }

  /** Every pattern tag used so far, for the tag box's suggestions. */
  async tagSuggestions(): Promise<string[]> {
    try {
      return await status.track(request<string[]>(ROUTES.listAnnotationTags));
    } catch {
      return [];
    }
  }

  /** Next probe (N): the next probe in the rail's visible order, or idle when none is left. */
  next(): void {
    probes.dispatch({ type: 'NEXT', probeId: probes.nextId() });
  }

  /** Run again (R): back to `selected` for the same probe. */
  runAgain(): void {
    probes.dispatch({ type: 'RUN_AGAIN' });
  }

  /**
   * Opens a saved run (brief 7.9): GET the run, switch to its session when it
   * is another listed one, load its turns and annotation, then put the
   * machine on it (`pushback` or `done`). Call once the session list has loaded.
   */
  async openRun(runId: number): Promise<OpenResult> {
    const token = ++this.#token;
    let run: Run;
    try {
      run = await status.track(request<Run>(ROUTES.getRun, { params: { run_id: runId } }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return 'missing';
      const f = friendlyError(e);
      status.error(f.message, f.details);
      return 'error';
    }
    try {
      const [turns, annotation] = await status.track(
        Promise.all([
          this.#turns(run.id),
          request<Annotation>(ROUTES.getAnnotation, { params: { run_id: run.id } }),
        ]),
      );
      if (token !== this.#token) return 'error';
      if (session.current?.id !== run.session_id) session.select(run.session_id);
      this.turns = turns;
      this.turnsFor = run.id;
      this.annotation = annotation;
      for (const event of openRunEvents(run, coachDraft(run))) probes.dispatch(event);
      return 'ok';
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
      return 'error';
    }
  }
}

export const workspace = new Workspace();
