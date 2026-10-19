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
