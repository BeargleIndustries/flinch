// The Probe section's state machine (brief 7, 13.2), as a pure module: no
// Svelte, no requests. `stores/probe.svelte.ts` holds one `MachineState` and
// feeds it events; T17's workspace renders the phase and dispatches the
// events its requests produce. Requests themselves stay in the workspace: the
// machine only says where the workspace is and what it may do next.
//
// Phases, in the order a probe moves through them:
//   idle      session set, no probe picked (7.1)
//   selected  a probe from the rail is picked (7.2)
//   custom    the "Custom prompt" row is picked (7.3)
//   sending   POST /run is in flight (7.4)
//   response  the run is back; its turns and annotation are loading (7.4)
//   pushback  the latest answer was Refused or Negotiated, no pushback yet (7.6)
//   done      after a pushback, a skip, or an answer that needs none (7.7)
//
// `response` is the short hop between the run returning and the thread being
// on screen; THREAD_LOADED settles it into `pushback` or `done` with the
// brief's guard (`needsPushback`). Every other row is the brief 7 table.

import { toCls } from './cls';

export const PHASES = [
  'idle',
  'selected',
  'custom',
  'sending',
  'response',
  'pushback',
  'done',
] as const;

export type Phase = (typeof PHASES)[number];

/** The fields of a run (`Run` in api/types.ts) the machine reads. */
export interface MachineRun {
  id: number;
  probe_id: number;
  initial_classification: string | null;
  final_classification: string | null;
  pushback_source: string | null;
}

export interface MachineState {
  phase: Phase;
  /** The picked probe; for a custom prompt, the probe the sidecar made once the run is back. */
  probeId: number | null;
  run: MachineRun | null;
  /** The pushback text being edited (prefilled with the coach's draft). */
  draft: string;
  /** A pushback, skip or follow-up request is in flight. */
  sending: boolean;
  /** The last request error, shown inline; cleared by the next event that succeeds. */
  error: string | null;
  /** Where SEND started (`selected` or `custom`), so a failed send goes back there. */
  sentFrom: 'selected' | 'custom' | null;
}

export type MachineEvent =
  | { type: 'PICK_PROBE'; probeId: number }
  | { type: 'PICK_CUSTOM' }
  /** Send the picked probe, or the custom text (which must not be blank). */
  | { type: 'SEND'; text?: string }
  | { type: 'RUN_RETURNED'; run: MachineRun }
  /** Turns are on screen. `run` replaces the run when given; `draft` is the coach's draft. */
  | { type: 'THREAD_LOADED'; run?: MachineRun; draft?: string }
  | { type: 'DRAFT'; text: string }
  /** A pushback, skip or follow-up was sent; waiting for the answer. */
  | { type: 'REQUEST_START' }
  | { type: 'PUSHBACK_SENT'; run: MachineRun }
  | { type: 'SKIPPED'; run: MachineRun }
  /** "Send another pushback" answered (7.7, the thread grows). */
  | { type: 'CONTINUED'; run: MachineRun }
  /** The run changed without a phase change (a badge correction). */
  | { type: 'RUN_UPDATED'; run: MachineRun }
  /** "Next probe": the next probe in the rail's visible order, or null when none is left. */
  | { type: 'NEXT'; probeId: number | null }
  | { type: 'RUN_AGAIN' }
  | { type: 'SESSION_CHANGED' }
  | { type: 'REQUEST_FAILED'; message: string };

export type EventType = MachineEvent['type'];

export function initialState(): MachineState {
  return {
    phase: 'idle',
    probeId: null,
    run: null,
    draft: '',
    sending: false,
    error: null,
    sentFrom: null,
  };
}

/** The latest answer's class: the final one when there is one, else the first. */
export function latestClass(run: MachineRun): ReturnType<typeof toCls> {
  return toCls(run.final_classification ?? run.initial_classification);
}

/** Brief 7.6: the latest answer is Refused or Negotiated and no pushback was sent or skipped. */
export function needsPushback(run: MachineRun): boolean {
  const cls = latestClass(run);
  return (cls === 'refused' || cls === 'negotiated') && !run.pushback_source;
}

/** Phases where picking from the rail is allowed (not while a send is in flight). */
const PICKABLE: readonly Phase[] = ['idle', 'selected', 'custom', 'pushback', 'done'];

/**
 * The next state, or `state` itself (the same object) when the event does not
 * apply in this phase. Never mutates `state`.
 */
export function transition(state: MachineState, event: MachineEvent): MachineState {
  const s = state;
  switch (event.type) {
    case 'SESSION_CHANGED':
      return initialState();

    case 'PICK_PROBE':
      if (!PICKABLE.includes(s.phase)) return s;
      return { ...initialState(), phase: 'selected', probeId: event.probeId };

    case 'PICK_CUSTOM':
      if (!PICKABLE.includes(s.phase)) return s;
      return { ...initialState(), phase: 'custom' };

    case 'SEND':
      if (s.phase === 'selected' && s.probeId !== null) {
        return { ...s, phase: 'sending', sentFrom: 'selected', error: null };
      }
      if (s.phase === 'custom' && (event.text ?? '').trim() !== '') {
        return { ...s, phase: 'sending', sentFrom: 'custom', error: null };
      }
      return s;

    case 'RUN_RETURNED':
      if (s.phase !== 'sending') return s;
      return { ...s, phase: 'response', run: event.run, probeId: event.run.probe_id, error: null };

    case 'THREAD_LOADED': {
      if (s.phase !== 'response' || !s.run) return s;
      const run = event.run ?? s.run;
      return needsPushback(run)
        ? { ...s, run, phase: 'pushback', draft: event.draft ?? '', error: null }
        : { ...s, run, phase: 'done', draft: '', error: null };
    }

    case 'DRAFT':
      if (s.phase !== 'pushback' && s.phase !== 'done') return s;
      return { ...s, draft: event.text };

    case 'REQUEST_START':
      if (s.phase !== 'pushback' && s.phase !== 'done') return s;
      return { ...s, sending: true, error: null };

    case 'PUSHBACK_SENT':
    case 'SKIPPED':
      if (s.phase !== 'pushback') return s;
      return { ...s, phase: 'done', run: event.run, draft: '', sending: false, error: null };

    case 'CONTINUED':
      if (s.phase !== 'done') return s;
      return { ...s, run: event.run, draft: '', sending: false, error: null };

    case 'RUN_UPDATED':
      if (!s.run || s.run.id !== event.run.id) return s;
      return { ...s, run: event.run };

    case 'NEXT':
      if (s.phase !== 'done') return s;
      return event.probeId === null
        ? initialState()
        : { ...initialState(), phase: 'selected', probeId: event.probeId };

    case 'RUN_AGAIN':
      if (s.phase !== 'done' || s.probeId === null) return s;
      return { ...initialState(), phase: 'selected', probeId: s.probeId };

    case 'REQUEST_FAILED':
      // Brief 7: a request error returns to the previous phase.
      if (s.phase === 'sending') {
        return { ...s, phase: s.sentFrom ?? 'idle', sending: false, error: event.message };
      }
      if (s.phase === 'response') {
        // The run is saved; only its thread failed to load. Show what we have.
        const run = s.run;
        const phase: Phase = run && needsPushback(run) ? 'pushback' : 'done';
        return { ...s, phase, sending: false, error: event.message };
      }
      return { ...s, sending: false, error: event.message };
  }
}

/** Whether `type` would change `state` (a representative payload is assumed valid). */
export function accepts(state: MachineState, type: EventType): boolean {
  switch (type) {
    case 'SESSION_CHANGED':
    case 'REQUEST_FAILED':
      return true;
    case 'PICK_PROBE':
    case 'PICK_CUSTOM':
      return PICKABLE.includes(state.phase);
    case 'SEND':
      return state.phase === 'custom' || (state.phase === 'selected' && state.probeId !== null);
    case 'RUN_RETURNED':
      return state.phase === 'sending';
    case 'THREAD_LOADED':
      return state.phase === 'response' && state.run !== null;
    case 'DRAFT':
    case 'REQUEST_START':
      return state.phase === 'pushback' || state.phase === 'done';
    case 'PUSHBACK_SENT':
    case 'SKIPPED':
      return state.phase === 'pushback';
    case 'CONTINUED':
    case 'NEXT':
      return state.phase === 'done';
    case 'RUN_AGAIN':
      return state.phase === 'done' && state.probeId !== null;
    case 'RUN_UPDATED':
      return state.run !== null;
  }
}

/** One row of the brief 7 table, as data (probe-machine.test.ts walks every row). */
export interface TransitionRow {
  from: readonly Phase[] | 'any';
  event: EventType;
  /** Brief wording of the condition. */
  when: string;
  to: Phase | 'previous';
}

export const TRANSITIONS: readonly TransitionRow[] = [
  { from: ['idle'], event: 'PICK_PROBE', when: 'pick probe', to: 'selected' },
  { from: ['idle'], event: 'PICK_CUSTOM', when: 'pick Custom prompt', to: 'custom' },
  { from: ['selected', 'custom'], event: 'SEND', when: 'send', to: 'sending' },
  { from: ['sending'], event: 'RUN_RETURNED', when: 'run returned', to: 'response' },
  {
    from: ['response'],
    event: 'THREAD_LOADED',
    when: 'latest response Refused or Negotiated, no pushback yet',
    to: 'pushback',
  },
  {
    from: ['response'],
    event: 'THREAD_LOADED',
    when: 'Complied or Collapsed or unknown',
    to: 'done',
  },
  { from: ['pushback'], event: 'PUSHBACK_SENT', when: 'send pushback', to: 'done' },
  { from: ['pushback'], event: 'SKIPPED', when: 'skip', to: 'done' },
  { from: ['done'], event: 'CONTINUED', when: 'send another pushback (thread grows)', to: 'done' },
  { from: ['done'], event: 'NEXT', when: 'next probe', to: 'selected' },
  { from: ['done'], event: 'NEXT', when: 'next probe, none left', to: 'idle' },
  { from: ['done'], event: 'RUN_AGAIN', when: 'run again (same probe)', to: 'selected' },
  { from: 'any', event: 'SESSION_CHANGED', when: 'change session', to: 'idle' },
  { from: 'any', event: 'REQUEST_FAILED', when: 'request error', to: 'previous' },
];
