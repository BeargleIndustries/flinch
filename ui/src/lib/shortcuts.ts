// The Probe section's keyboard shortcuts (brief 7.10, D22). The Probe routes
// attach them on mount and detach on destroy; the root layout owns `?` and
// Escape, and the rail owns Up and Down (ProbeRail.svelte), so neither is
// bound here.
//
// The mapping and the guards are pure functions over plain values, so
// shortcuts.test.ts runs them in Node; `attachShortcuts` is the thin DOM part.
import type { Phase } from './probe-machine';

export type ShortcutAction = 'send' | 'pushback' | 'skip' | 'next' | 'runAgain';

/** Lower-case key to action. */
export const KEY_ACTIONS: Readonly<Record<string, ShortcutAction>> = {
  s: 'send',
  p: 'pushback',
  k: 'skip',
  n: 'next',
  r: 'runAgain',
};

/** The phases in which each action applies (brief 7.10 table). */
export const ACTION_PHASES: Readonly<Record<ShortcutAction, readonly Phase[]>> = {
  send: ['selected', 'custom'],
  pushback: ['pushback'],
  skip: ['pushback'],
  next: ['done'],
  runAgain: ['done'],
};

/** The parts of a KeyboardEvent the mapping reads. */
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}

/** The parts of an event target the typing guard reads. */
export interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

/** Everything outside the key that decides whether a shortcut may fire. */
export interface ShortcutContext {
  /** `location.pathname`. */
  path: string;
  phase: Phase;
  target: TargetLike | null;
  /** The shortcuts overlay (shell.shortcutsOpen). */
  overlayOpen: boolean;
  /** The settings drawer (shell.settingsOpen). */
  settingsOpen: boolean;
  /** A modal dialog is in the document. */
  dialogOpen: boolean;
  /** The quick tour is showing. */
  tourOpen: boolean;
  /** A request of the workspace is in flight (a pushback, skip or follow-up). */
  busy?: boolean;
}

/** The Probe section: `/probe` and every route under it. */
export function isProbePath(path: string): boolean {
  return path === '/probe' || path.startsWith('/probe/');
}

/** Focus is in a text field, where letters type (brief 7.10). */
export function isTypingTarget(t: TargetLike | null): boolean {
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = (t.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** The key's action, ignoring phase and guards; null for any other key or a modified key. */
export function keyAction(e: KeyLike): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.isComposing) return null;
  if (e.key.length !== 1) return null;
  return KEY_ACTIONS[e.key.toLowerCase()] ?? null;
}

/** Why a shortcut is ignored right now, or null when it may fire. */
export function blockedBy(ctx: ShortcutContext): string | null {
  if (!isProbePath(ctx.path)) return 'route';
  if (isTypingTarget(ctx.target)) return 'typing';
  if (ctx.overlayOpen) return 'overlay';
  if (ctx.settingsOpen) return 'settings';
  if (ctx.dialogOpen) return 'dialog';
  if (ctx.tourOpen) return 'tour';
  if (ctx.busy) return 'busy';
  return null;
}

/** The action a key press runs, or null when it runs nothing. */
export function shortcutFor(e: KeyLike, ctx: ShortcutContext): ShortcutAction | null {
  if (e.defaultPrevented) return null;
  const action = keyAction(e);
  if (action === null) return null;
  if (blockedBy(ctx) !== null) return null;
  return ACTION_PHASES[action].includes(ctx.phase) ? action : null;
}

export type ShortcutHandlers = Record<ShortcutAction, () => void>;

/**
 * Listens on `window` for the Probe keys and calls the matching handler.
 * `context` is read on every key press. Returns the detach function.
 */
export function attachShortcuts(
  handlers: ShortcutHandlers,
  context: () => Omit<ShortcutContext, 'target' | 'path' | 'dialogOpen'>,
): () => void {
  const onKey = (e: KeyboardEvent) => {
    const action = shortcutFor(e, {
      ...context(),
      path: window.location.pathname,
      target: e.target instanceof HTMLElement ? e.target : null,
      dialogOpen: document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
    });
    if (action === null) return;
    e.preventDefault();
    handlers[action]();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
