// Session list rules shared by the header's session switcher (T15) and the
// session store (brief 4.4, T16). Model compare creates one session per model
// (D29); those sessions are hidden from the switcher and from Browse.

/** The prefix `flinch/app.py` writes into a Model compare session's notes. */
export const COMPARE_SESSION_PREFIX = 'Auto-created by multi-model comparison';

/** Whether a session was created by Model compare, from its `notes`. */
export function isCompareSession(notes: string | null | undefined): boolean {
  return typeof notes === 'string' && notes.trimStart().startsWith(COMPARE_SESSION_PREFIX);
}

interface SessionLike {
  id: number;
  notes: string | null;
}

/** The sessions the switcher lists: compare sessions dropped, newest (highest id) first. */
export function visibleSessions<S extends SessionLike>(list: readonly S[]): S[] {
  return list.filter((s) => !isCompareSession(s.notes)).sort((a, b) => b.id - a.id);
}

/**
 * The session to open: the stored id when it is in the list, else the newest,
 * else null. `list` is what `visibleSessions` returns.
 */
export function pickSession<S extends SessionLike>(
  list: readonly S[],
  storedId: number | null,
): S | null {
  if (storedId !== null) {
    const stored = list.find((s) => s.id === storedId);
    if (stored) return stored;
  }
  let newest: S | null = null;
  for (const s of list) if (!newest || s.id > newest.id) newest = s;
  return newest;
}

/** Truncates to `max` characters with an ellipsis (the switcher button, brief 6.1). */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

// ---------------------------------------------------------------------------
// New session dialog rules (brief 6.6, I18, I19). Pure, so session.test.ts
// covers them; NewSessionDialog.svelte only wires them to fields.
// ---------------------------------------------------------------------------

/** I18: the model the dialog preselects when GET /api/models lists it. */
export const DEFAULT_TARGET_MODEL = 'claude-sonnet-4-6';

interface ModelGroupLike {
  provider: string;
  available: boolean;
  models: readonly { id: string }[];
}

/**
 * I18: `claude-sonnet-4-6` when an available provider lists it, else the
 * first model of the first available provider, else the first listed model,
 * else ''.
 */
export function defaultTargetModel(groups: readonly ModelGroupLike[]): string {
  const available = groups.filter((g) => g.available && g.models.length > 0);
  for (const g of available) {
    if (g.models.some((m) => m.id === DEFAULT_TARGET_MODEL)) return DEFAULT_TARGET_MODEL;
  }
  if (available.length > 0) return available[0].models[0].id;
  return groups.find((g) => g.models.length > 0)?.models[0].id ?? '';
}

/** The coach profile every session starts with (brief 6.6 item 4). */
export const DEFAULT_COACH_PROFILE = 'standard';

/**
 * I19: the profile names the select offers: every name from GET
 * /api/coach-profiles plus every session's `coach_profile`, trimmed, without
 * duplicates, `standard` first and the rest sorted.
 */
export function profileOptions(
  profiles: readonly { name: string }[],
  sessions: readonly { coach_profile: string | null }[],
): string[] {
  const names = new Set<string>([DEFAULT_COACH_PROFILE]);
  for (const p of profiles) if (p.name?.trim()) names.add(p.name.trim());
  for (const s of sessions) if (s.coach_profile?.trim()) names.add(s.coach_profile.trim());
  const rest = [...names]
    .filter((n) => n !== DEFAULT_COACH_PROFILE)
    .sort((a, b) => a.localeCompare(b));
  return [DEFAULT_COACH_PROFILE, ...rest];
}

/** Coach backends the sidecar accepts (brief 6.6 item 4), with their labels. */
export const COACH_BACKENDS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'xai', label: 'xAI' },
  { value: 'together', label: 'Together' },
  { value: 'local', label: 'Local (Ollama)' },
] as const;

export type CoachBackend = (typeof COACH_BACKENDS)[number]['value'];

/** A known backend value, else `anthropic` (the sidecar's own default). */
export function asCoachBackend(value: string | null | undefined): CoachBackend {
  return COACH_BACKENDS.some((b) => b.value === value) ? (value as CoachBackend) : 'anthropic';
}

export function coachBackendLabel(value: string): string {
  return COACH_BACKENDS.find((b) => b.value === value)?.label ?? value;
}

/** An Ollama model id from GET /api/ollama/status (`ollama:{name}`) as the bare name the session stores. */
export function bareOllamaName(id: string): string {
  return id.startsWith('ollama:') ? id.slice('ollama:'.length) : id;
}

export const NAME_MAX = 200;
export const SYSTEM_PROMPT_MAX = 10000;
export const NOTES_MAX = 2000;

export interface NewSessionForm {
  name: string;
  targetModel: string;
  systemPrompt: string;
  coachBackend: CoachBackend;
  /** Bare Ollama model name; read only when the backend is `local`. */
  coachModel: string;
  coachProfile: string;
  notes: string;
  /** Picked probe ids. */
  probeIds: ReadonlySet<number>;
}

export type NewSessionProblem = 'name' | 'model' | 'probes' | 'profile' | 'localModel';

/** What blocks submitting, in field order; empty when the form can be sent. */
export function newSessionProblems(
  form: NewSessionForm,
  allProbeIds: readonly number[],
): NewSessionProblem[] {
  const out: NewSessionProblem[] = [];
  if (!form.name.trim()) out.push('name');
  if (!form.targetModel.trim()) out.push('model');
  if (!form.coachProfile.trim()) out.push('profile');
  if (form.coachBackend === 'local' && !form.coachModel.trim()) out.push('localModel');
  if (allProbeIds.length > 0 && !allProbeIds.some((id) => form.probeIds.has(id)))
    out.push('probes');
  return out;
}

export interface CreateSessionPayload {
  name: string;
  target_model: string;
  coach_profile: string;
  system_prompt: string;
  coach_backend: CoachBackend;
  coach_model: string | null;
  notes?: string;
  probe_ids?: number[];
}

/**
 * The POST /api/sessions body (brief 6.6 Submit): `probe_ids` left out when
 * every probe is picked (the session then follows the whole library),
 * `coach_model` null unless the backend is Local, `notes` only when written.
 */
export function createSessionBody(
  form: NewSessionForm,
  allProbeIds: readonly number[],
): CreateSessionPayload {
  const picked = allProbeIds.filter((id) => form.probeIds.has(id));
  const body: CreateSessionPayload = {
    name: form.name.trim(),
    target_model: form.targetModel.trim(),
    coach_profile: form.coachProfile.trim() || DEFAULT_COACH_PROFILE,
    system_prompt: form.systemPrompt,
    coach_backend: form.coachBackend,
    coach_model: form.coachBackend === 'local' ? bareOllamaName(form.coachModel.trim()) : null,
  };
  if (form.notes.trim()) body.notes = form.notes.trim();
  if (picked.length < allProbeIds.length) body.probe_ids = picked;
  return body;
}
