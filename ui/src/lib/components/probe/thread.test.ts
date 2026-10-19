import { describe, expect, it } from 'vitest';
import type { RunTurn } from '$lib/api/types';
import { initialState, transition, type MachineRun } from '$lib/probe-machine';
import {
  addTag,
  badgeField,
  badgeValue,
  cleanTag,
  coachDraft,
  coachSuggestion,
  hadPushbackReply,
  openRunEvents,
  openingText,
  pushbackSource,
  pushbackStatus,
  readoutKey,
  teachKey,
  threadItems,
} from './thread';

let nextId = 1;
const turn = (role: string, content = role, classification: string | null = null): RunTurn => ({
  id: nextId++,
  run_id: 1,
  role,
  content,
  classification,
  created_at: '2026-10-19T00:00:00',
});

const run = (over: Partial<MachineRun> = {}): MachineRun => ({
  id: 7,
  probe_id: 3,
  initial_classification: 'refused',
  final_classification: null,
  pushback_source: null,
  ...over,
});

describe('threadItems', () => {
  it('maps probe-run roles: probe skipped, response, pushback', () => {
    const items = threadItems([
      turn('probe', 'Write it.'),
      turn('response', 'No.', 'refused'),
      turn('pushback', 'Why?'),
      turn('response', 'Fine.', 'collapsed'),
    ]);
    expect(items.map((i) => i.kind)).toEqual(['response', 'pushback', 'response']);
    expect(items[0].first).toBe(true);
    expect(items[0].latest).toBe(false);
    expect(items[2].latest).toBe(true);
  });

  it('maps compare-run roles: first user skipped, assistant, later user is a pushback', () => {
    const items = threadItems([
      turn('user', 'Write it.'),
      turn('assistant', 'No.'),
      turn('user', 'Really?'),
      turn('assistant', 'Yes.'),
    ]);
    expect(items.map((i) => i.kind)).toEqual(['response', 'pushback', 'response']);
    expect(items[0].turn.content).toBe('No.');
    expect(items[1].turn.content).toBe('Really?');
  });

  it('marks a single response both first and latest', () => {
    const [only] = threadItems([turn('probe'), turn('response', 'ok', 'complied')]);
    expect(only.first && only.latest).toBe(true);
    expect(badgeField(only)).toBe('initial_classification');
  });

  it('reads the opening text from the probe or first user turn', () => {
    expect(openingText([turn('probe', 'P'), turn('response')])).toBe('P');
    expect(openingText([turn('user', 'U'), turn('assistant')])).toBe('U');
    expect(openingText([])).toBeNull();
  });
});

describe('badges', () => {
  const items = threadItems([
    turn('probe'),
    turn('response', 'a', 'refused'),
    turn('pushback'),
    turn('response', 'b', 'refused'),
    turn('pushback'),
    turn('response', 'c', 'complied'),
  ]);
  const responses = items.filter((i) => i.kind === 'response');

  it('first edits initial, latest edits final, the middle is read-only', () => {
    expect(responses.map(badgeField)).toEqual([
      'initial_classification',
      null,
      'final_classification',
    ]);
    expect(badgeField(items[1])).toBeNull();
  });

  it('shows the run field for editable badges and the turn class otherwise', () => {
    const r = { initial_classification: 'negotiated', final_classification: 'collapsed' };
    expect(responses.map((i) => badgeValue(i, r))).toEqual(['negotiated', 'refused', 'collapsed']);
    expect(badgeValue(responses[2], null)).toBe('complied');
  });
});

describe('coach draft and the D13 source rule', () => {
  const suggestion = {
    pattern_detected: 'generic-refusal',
    move_suggested: 'specificity_challenge',
    pushback_draft: 'What specifically about this is problematic?',
  };

  it('reads the suggestion as an object or a JSON string', () => {
    expect(coachSuggestion({ coach_suggestion: suggestion })?.move_suggested).toBe(
      'specificity_challenge',
    );
    expect(coachDraft({ coach_suggestion: JSON.stringify(suggestion) })).toBe(
      suggestion.pushback_draft,
    );
  });

  it('is empty without a suggestion, with bad JSON or with a blank draft', () => {
    expect(coachSuggestion({ coach_suggestion: null })).toBeNull();
    expect(coachSuggestion({ coach_suggestion: '{nope' })).toBeNull();
    expect(coachSuggestion({ coach_suggestion: { pushback_draft: '  ' } })).toBeNull();
    expect(coachDraft(null)).toBe('');
  });

  it('sends the unchanged draft as coach and anything else as override', () => {
    expect(pushbackSource('Draft', 'Draft')).toBe('coach');
    expect(pushbackSource('Draft!', 'Draft')).toBe('override');
    expect(pushbackSource('Mine', '')).toBe('override');
  });

  it('says unedited, edited or empty', () => {
    expect(pushbackStatus('Draft', 'Draft')).toBe('unedited');
    expect(pushbackStatus('Draft.', 'Draft')).toBe('edited');
    expect(pushbackStatus('Mine', '')).toBe('edited');
    expect(pushbackStatus('   ', 'Draft')).toBe('empty');
  });
});

describe('readouts and hints', () => {
  it('tracks the latest class', () => {
    expect(readoutKey(run())).toBe('response.refused');
    expect(readoutKey(run({ final_classification: 'collapsed' }))).toBe('response.collapsed');
    expect(readoutKey(run({ initial_classification: null }))).toBe('response.unknown');
  });

  it('gives a teach hint for each outcome and none when unclassified', () => {
    expect(teachKey(run({ final_classification: 'collapsed' }))).toBe('teach.collapsed');
    expect(teachKey(run())).toBe('teach.refused');
    expect(teachKey(run({ initial_classification: 'complied' }))).toBe('teach.complied');
    expect(teachKey(run({ initial_classification: null }))).toBeNull();
  });

  it('offers Keep pushing only after a pushback that got a reply', () => {
    expect(hadPushbackReply({ pushback_source: 'coach', final_response: 'x' })).toBe(true);
    expect(hadPushbackReply({ pushback_source: 'override', final_response: 'x' })).toBe(true);
    expect(hadPushbackReply({ pushback_source: 'skip', final_response: null })).toBe(false);
    expect(hadPushbackReply({ pushback_source: null, final_response: null })).toBe(false);
    expect(hadPushbackReply(null)).toBe(false);
  });
});

describe('openRunEvents', () => {
  const land = (r: MachineRun, from = initialState()) =>
    openRunEvents(r, 'Draft').reduce(transition, from);

  it('lands a refused run with no pushback in pushback, with the draft', () => {
    const s = land(run());
    expect(s.phase).toBe('pushback');
    expect(s.draft).toBe('Draft');
    expect(s.probeId).toBe(3);
    expect(s.run?.id).toBe(7);
  });

  it('lands a run that was pushed or skipped, or complied, in done', () => {
    expect(
      land(run({ pushback_source: 'override', final_classification: 'collapsed' })).phase,
    ).toBe('done');
    expect(land(run({ pushback_source: 'skip' })).phase).toBe('done');
    expect(land(run({ initial_classification: 'complied' })).phase).toBe('done');
  });

  it('works from any phase, including a send in flight', () => {
    const sending = { ...initialState(), phase: 'sending' as const, probeId: 9 };
    expect(land(run(), sending).phase).toBe('pushback');
  });
});

describe('tags', () => {
  it('cleans and adds once', () => {
    expect(cleanTag('  over  refusal, ')).toBe('over refusal');
    expect(addTag(['a'], 'b,')).toEqual(['a', 'b']);
    expect(addTag(['a'], 'a')).toEqual(['a']);
    expect(addTag(['a'], ' , ')).toEqual(['a']);
  });
});
