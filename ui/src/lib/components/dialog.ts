// Dialog keyboard logic (brief 5.6 `Dialog`, D22): Enter in a single-line
// field submits the dialog; Enter anywhere else keeps its normal meaning.

/** Input types that hold one line of text. */
const SINGLE_LINE = new Set(['', 'text', 'search', 'email', 'number', 'password', 'url', 'tel']);

/** The part of a KeyboardEvent this check reads; tests pass a plain object. */
export interface SubmitKeyEvent {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  target: EventTarget | null | { tagName?: string; type?: string };
}

/** Whether this keydown should run the dialog's primary action. */
export function isSubmitKey(e: SubmitKeyEvent): boolean {
  if (e.key !== 'Enter' || e.isComposing) return false;
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return false;
  const t = e.target as { tagName?: string; type?: string } | null;
  if (!t || typeof t.tagName !== 'string' || t.tagName.toUpperCase() !== 'INPUT') return false;
  return SINGLE_LINE.has((t.type ?? '').toLowerCase());
}
