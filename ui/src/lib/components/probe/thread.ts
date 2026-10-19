// Pure helpers for the Probe workspace (brief 7.5 to 7.9): the thread's role
// mapping, which badge is editable, the coach's draft and the pushback source
// rule (D13), the readout and teach-hint keys, and the events that open a
// saved run in the machine. No Svelte, no requests; thread.test.ts covers it.
import type { Run, RunCoachSuggestion, RunTurn, UpdateClassificationBody } from '$lib/api/types';
import { latestClass, type MachineEvent, type MachineRun } from '$lib/probe-machine';

export interface ThreadItem {
  kind: 'response' | 'pushback';
  turn: RunTurn;
  /** The first response (its badge edits `initial_classification`). */
  first: boolean;
  /** The newest response (its badge edits `final_classification` when it is not the first). */
  latest: boolean;
}

const RESPONSE_ROLES = new Set(['response', 'assistant']);

/**
 * Brief 7.5 roles: `probe` and the first `user` turn are skipped (the card
 * shows the probe); `response` and `assistant` are responses; `pushback` and
 * any later `user` turn are pushbacks. Probe runs write the first set, Model
 * compare runs the second. Other roles are skipped.
 */
export function threadItems(turns: readonly RunTurn[]): ThreadItem[] {
  const items: ThreadItem[] = [];
  let sawUser = false;
  for (const turn of turns) {
    if (turn.role === 'probe') continue;
    if (turn.role === 'user') {
      if (!sawUser) {
        sawUser = true;
        continue;
      }
      items.push({ kind: 'pushback', turn, first: false, latest: false });
      continue;
    }
    if (turn.role === 'pushback') {
      items.push({ kind: 'pushback', turn, first: false, latest: false });
      continue;
    }
    if (RESPONSE_ROLES.has(turn.role)) {
      items.push({ kind: 'response', turn, first: false, latest: false });
    }
  }
  const responses = items.filter((i) => i.kind === 'response');
  if (responses.length > 0) {
    responses[0].first = true;
    responses[responses.length - 1].latest = true;
  }
  return items;
}

/** The probe text a thread was opened with (its `probe` or first `user` turn), or null. */
export function openingText(turns: readonly RunTurn[]): string | null {
  return turns.find((t) => t.role === 'probe' || t.role === 'user')?.content ?? null;
}

/** Which run field a response's badge corrects; null for an earlier response after pushback (read-only). */
export function badgeField(item: ThreadItem): UpdateClassificationBody['field'] | null {
  if (item.kind !== 'response') return null;
  if (item.first) return 'initial_classification';
  if (item.latest) return 'final_classification';
  return null;
}

/** The class a response's badge shows: the run's field when the badge edits one, else the turn's. */
export function badgeValue(
  item: ThreadItem,
  run: Pick<Run, 'initial_classification' | 'final_classification'> | null,
): string | null {
  const field = badgeField(item);
  if (field && run && run[field]) return run[field];
  return item.turn.classification;
}

export interface CoachSuggestion {
  pattern_detected: string | null;
  move_suggested: string | null;
  pushback_draft: string;
}

/**
 * The coach's suggestion on a run. GET /api/runs/{id} and the run routes
 * return it decoded (an object, `flinch/db.py` get_run). Null when absent or
 * without a draft.
 */
export function coachSuggestion(
  run: { coach_suggestion?: Partial<RunCoachSuggestion> | null } | null,
): CoachSuggestion | null {
  const o = run?.coach_suggestion;
  if (!o || typeof o !== 'object') return null;
  const draft = typeof o.pushback_draft === 'string' ? o.pushback_draft : '';
  if (draft.trim() === '') return null;
  return {
    pattern_detected: typeof o.pattern_detected === 'string' ? o.pattern_detected : null,
    move_suggested: typeof o.move_suggested === 'string' ? o.move_suggested : null,
    pushback_draft: draft,
  };
}

/** The coach's draft text, or '' with no suggestion. */
export function coachDraft(run: Parameters<typeof coachSuggestion>[0]): string {
  return coachSuggestion(run)?.pushback_draft ?? '';
}

/** D13: the coach's draft sent unchanged is `coach`; anything else is your `override`. */
export function pushbackSource(text: string, draft: string): 'coach' | 'override' {
  return draft !== '' && text === draft ? 'coach' : 'override';
}

export type PushbackStatus = 'empty' | 'unedited' | 'edited';

/** The status line under the pushback box (brief 7.6). */
export function pushbackStatus(text: string, draft: string): PushbackStatus {
  if (text.trim() === '') return 'empty';
  return pushbackSource(text, draft) === 'coach' ? 'unedited' : 'edited';
}

/** The readout key for the latest response (brief 7.5). */
export function readoutKey(run: MachineRun): `response.${ReturnType<typeof latestClass>}` {
  return `response.${latestClass(run)}`;
}

/** The teach hint key for the run's outcome, or null when it is not classified (brief 7.7). */
export function teachKey(
  run: MachineRun,
): 'teach.collapsed' | 'teach.refused' | 'teach.negotiated' | 'teach.complied' | null {
  const cls = latestClass(run);
  return cls === 'unknown' ? null : `teach.${cls}`;
}

/** "Keep pushing" shows only after a pushback that got a response (brief 7.7 item 1). */
export function hadPushbackReply(
  run: Pick<Run, 'pushback_source' | 'final_response'> | null,
): boolean {
  if (!run) return false;
  return (
    (run.pushback_source === 'coach' || run.pushback_source === 'override') &&
    run.final_response !== null
  );
}

/**
 * The machine events that open a saved run (brief 7.9): pick its probe, mark
 * it sent, the run returned, the thread loaded. The machine lands in
 * `pushback` when the latest answer is Refused or Negotiated with no pushback
 * yet, else `done`; no request is made by the events themselves.
 */
export function openRunEvents(run: MachineRun, draft: string): MachineEvent[] {
  return [
    { type: 'SESSION_CHANGED' },
    { type: 'PICK_PROBE', probeId: run.probe_id },
    { type: 'SEND' },
    { type: 'RUN_RETURNED', run },
    { type: 'THREAD_LOADED', run, draft },
  ];
}

/** Long responses collapse after this many characters (brief 7.5). */
export const COLLAPSE_AT = 800;

/** A tag typed into the tag box: trimmed, without commas; '' when nothing is left. */
export function cleanTag(raw: string): string {
  return raw.replace(/,/g, ' ').trim().replace(/\s+/g, ' ');
}

/** Adds a tag once, keeping order. */
export function addTag(tags: readonly string[], raw: string): string[] {
  const t = cleanTag(raw);
  return t === '' || tags.includes(t) ? [...tags] : [...tags, t];
}
