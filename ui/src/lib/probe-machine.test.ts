import { describe, expect, it } from 'vitest';
import {
  PHASES,
  TRANSITIONS,
  accepts,
  initialState,
  needsPushback,
  transition,
  type MachineEvent,
  type MachineRun,
  type MachineState,
  type Phase,
  type TransitionRow,
} from './probe-machine';

function run(over: Partial<MachineRun> = {}): MachineRun {
  return {
    id: 7,
    probe_id: 3,
    initial_classification: 'refused',
    final_classification: null,
    pushback_source: null,
    ...over,
  };
}

const REFUSED = run();
const COMPLIED = run({ initial_classification: 'complied' });

/** A state sitting in `phase`, with what that phase normally holds. */
function at(phase: Phase, over: Partial<MachineState> = {}): MachineState {
  const base = initialState();
  switch (phase) {
    case 'idle':
      return { ...base, ...over };
    case 'selected':
      return { ...base, phase, probeId: 3, ...over };
    case 'custom':
      return { ...base, phase, ...over };
    case 'sending':
      return { ...base, phase, probeId: 3, sentFrom: 'selected', ...over };
    case 'response':
      return { ...base, phase, probeId: 3, run: REFUSED, sentFrom: 'selected', ...over };
    case 'pushback':
      return { ...base, phase, probeId: 3, run: REFUSED, draft: 'Why not?', ...over };
    case 'done':
      return { ...base, phase, probeId: 3, run: COMPLIED, ...over };
  }
}

/** The event (and starting state) that exercises one table row. */
function exercise(row: TransitionRow, from: Phase): { state: MachineState; event: MachineEvent } {
  const state = at(from);
  switch (row.event) {
    case 'PICK_PROBE':
      return { state, event: { type: 'PICK_PROBE', probeId: 9 } };
    case 'PICK_CUSTOM':
      return { state, event: { type: 'PICK_CUSTOM' } };
    case 'SEND':
      return { state, event: { type: 'SEND', text: 'Write the scene.' } };
    case 'RUN_RETURNED':
      return { state, event: { type: 'RUN_RETURNED', run: REFUSED } };
    case 'THREAD_LOADED':
      return row.to === 'pushback'
        ? { state: at(from, { run: REFUSED }), event: { type: 'THREAD_LOADED', draft: 'Why?' } }
        : { state: at(from, { run: COMPLIED }), event: { type: 'THREAD_LOADED' } };
    case 'PUSHBACK_SENT':
      return {
        state,
        event: {
          type: 'PUSHBACK_SENT',
          run: run({ pushback_source: 'coach', final_classification: 'collapsed' }),
        },
      };
    case 'SKIPPED':
      return { state, event: { type: 'SKIPPED', run: run({ pushback_source: 'skipped' }) } };
    case 'CONTINUED':
      return { state, event: { type: 'CONTINUED', run: run({ pushback_source: 'override' }) } };
    case 'NEXT':
      return { state, event: { type: 'NEXT', probeId: row.to === 'idle' ? null : 4 } };
    case 'RUN_AGAIN':
      return { state, event: { type: 'RUN_AGAIN' } };
    case 'SESSION_CHANGED':
      return { state, event: { type: 'SESSION_CHANGED' } };
    case 'REQUEST_FAILED':
      return { state, event: { type: 'REQUEST_FAILED', message: 'boom' } };
    default:
      throw new Error(`no fixture for ${row.event}`);
  }
}

describe('probe machine: every row of the brief 7 table', () => {
  for (const row of TRANSITIONS) {
    const froms: readonly Phase[] = row.from === 'any' ? PHASES : row.from;
    for (const from of froms) {
      it(`${from} --${row.event} (${row.when})--> ${row.to}`, () => {
        const { state, event } = exercise(row, from);
        const next = transition(state, event);
        if (row.to === 'previous') {
          // A failed send goes back to where it started; elsewhere the phase holds.
          const expected: Phase =
            from === 'sending' ? 'selected' : from === 'response' ? 'pushback' : from;
          expect(next.phase).toBe(expected);
          expect(next.error).toBe('boom');
          expect(next.sending).toBe(false);
        } else {
          expect(next.phase).toBe(row.to);
          expect(next).not.toBe(state);
        }
      });
    }
  }
});

describe('probe machine: payloads and guards', () => {
  it('picking a probe from the rail works in every settled phase, not while sending', () => {
    for (const p of ['idle', 'selected', 'custom', 'pushback', 'done'] as const) {
      const next = transition(at(p), { type: 'PICK_PROBE', probeId: 11 });
      expect(next.phase).toBe('selected');
      expect(next.probeId).toBe(11);
      expect(next.run).toBeNull();
    }
    for (const p of ['sending', 'response'] as const) {
      const s = at(p);
      expect(transition(s, { type: 'PICK_PROBE', probeId: 11 })).toBe(s);
      expect(transition(s, { type: 'PICK_CUSTOM' })).toBe(s);
      expect(accepts(s, 'PICK_PROBE')).toBe(false);
    }
  });

  it('custom needs text to send; selected needs a probe', () => {
    const custom = at('custom');
    expect(transition(custom, { type: 'SEND', text: '   ' })).toBe(custom);
    expect(transition(custom, { type: 'SEND' })).toBe(custom);
    const sent = transition(custom, { type: 'SEND', text: 'hi' });
    expect(sent.phase).toBe('sending');
    expect(sent.sentFrom).toBe('custom');
    const noProbe = at('selected', { probeId: null });
    expect(transition(noProbe, { type: 'SEND' })).toBe(noProbe);
    expect(accepts(noProbe, 'SEND')).toBe(false);
  });

  it('a failed custom send returns to custom with the error', () => {
    const sending = transition(at('custom'), { type: 'SEND', text: 'hi' });
    const failed = transition(sending, { type: 'REQUEST_FAILED', message: 'No key' });
    expect(failed.phase).toBe('custom');
    expect(failed.error).toBe('No key');
  });

  it("the returned run's probe becomes the picked probe (custom prompts make one)", () => {
    const sending = transition(at('custom'), { type: 'SEND', text: 'hi' });
    const back = transition(sending, { type: 'RUN_RETURNED', run: run({ probe_id: 42 }) });
    expect(back.phase).toBe('response');
    expect(back.probeId).toBe(42);
    const done = transition(back, {
      type: 'THREAD_LOADED',
      run: run({ probe_id: 42, initial_classification: 'complied' }),
    });
    expect(transition(done, { type: 'RUN_AGAIN' })).toMatchObject({
      phase: 'selected',
      probeId: 42,
    });
  });

  it('THREAD_LOADED into pushback keeps the coach draft; DRAFT edits it', () => {
    const p = transition(at('response'), { type: 'THREAD_LOADED', draft: 'Be specific.' });
    expect(p.phase).toBe('pushback');
    expect(p.draft).toBe('Be specific.');
    expect(transition(p, { type: 'DRAFT', text: 'Edited' }).draft).toBe('Edited');
    expect(transition(at('idle'), { type: 'DRAFT', text: 'x' }).draft).toBe('');
  });

  it('needsPushback follows the latest class and pushback_source', () => {
    expect(needsPushback(run())).toBe(true);
    expect(needsPushback(run({ initial_classification: 'negotiated' }))).toBe(true);
    expect(needsPushback(run({ initial_classification: 'complied' }))).toBe(false);
    expect(needsPushback(run({ initial_classification: null }))).toBe(false);
    expect(needsPushback(run({ pushback_source: 'coach' }))).toBe(false);
    expect(needsPushback(run({ final_classification: 'collapsed' }))).toBe(false);
    expect(needsPushback(run({ final_classification: 'refused', pushback_source: null }))).toBe(
      true,
    );
  });

  it('REQUEST_START marks a pushback in flight; the answer clears it', () => {
    const p = transition(at('pushback'), { type: 'REQUEST_START' });
    expect(p.sending).toBe(true);
    const d = transition(p, { type: 'PUSHBACK_SENT', run: run({ pushback_source: 'coach' }) });
    expect(d).toMatchObject({ phase: 'done', sending: false, draft: '' });
    const again = transition(transition(d, { type: 'REQUEST_START' }), {
      type: 'REQUEST_FAILED',
      message: 'x',
    });
    expect(again).toMatchObject({ phase: 'done', sending: false, error: 'x' });
  });

  it('RUN_UPDATED replaces the same run only', () => {
    const d = at('done');
    const fixed = run({ id: d.run!.id, final_classification: 'refused' });
    expect(transition(d, { type: 'RUN_UPDATED', run: fixed }).run).toEqual(fixed);
    expect(transition(d, { type: 'RUN_UPDATED', run: run({ id: 999 }) })).toBe(d);
  });

  it('events outside their phase leave the state untouched', () => {
    const idle = at('idle');
    for (const e of [
      { type: 'RUN_RETURNED', run: REFUSED },
      { type: 'THREAD_LOADED' },
      { type: 'PUSHBACK_SENT', run: REFUSED },
      { type: 'SKIPPED', run: REFUSED },
      { type: 'CONTINUED', run: REFUSED },
      { type: 'NEXT', probeId: 1 },
      { type: 'RUN_AGAIN' },
      { type: 'SEND' },
    ] as MachineEvent[]) {
      expect(transition(idle, e), e.type).toBe(idle);
      expect(accepts(idle, e.type), e.type).toBe(false);
    }
  });

  it('accepts agrees with transition for every phase and event in the table', () => {
    for (const row of TRANSITIONS) {
      for (const from of PHASES) {
        const { state, event } = exercise(row, from);
        const moved = transition(state, event) !== state;
        expect(accepts(state, row.event), `${from} ${row.event}`).toBe(moved);
      }
    }
  });
});
