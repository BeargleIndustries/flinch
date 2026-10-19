import { describe, expect, it } from 'vitest';
import { PHASES, type Phase } from './probe-machine';
import {
  ACTION_PHASES,
  KEY_ACTIONS,
  blockedBy,
  isProbePath,
  isTypingTarget,
  keyAction,
  shortcutFor,
  type ShortcutContext,
} from './shortcuts';

const ctx = (over: Partial<ShortcutContext> = {}): ShortcutContext => ({
  path: '/probe',
  phase: 'selected',
  target: { tagName: 'BODY' },
  overlayOpen: false,
  settingsOpen: false,
  dialogOpen: false,
  tourOpen: false,
  busy: false,
  ...over,
});

describe('keyAction', () => {
  it('maps S, P, K, N and R in either case', () => {
    expect(keyAction({ key: 's' })).toBe('send');
    expect(keyAction({ key: 'S' })).toBe('send');
    expect(keyAction({ key: 'p' })).toBe('pushback');
    expect(keyAction({ key: 'k' })).toBe('skip');
    expect(keyAction({ key: 'n' })).toBe('next');
    expect(keyAction({ key: 'R' })).toBe('runAgain');
  });

  it('leaves Up, Down, ?, Escape and Enter alone (the rail and the shell own them)', () => {
    for (const key of ['ArrowUp', 'ArrowDown', '?', 'Escape', 'Enter', 'x', ' ']) {
      expect(keyAction({ key }), key).toBeNull();
    }
    expect(Object.keys(KEY_ACTIONS).sort()).toEqual(['k', 'n', 'p', 'r', 's']);
  });

  it('ignores modified, repeated and composing presses', () => {
    expect(keyAction({ key: 's', ctrlKey: true })).toBeNull();
    expect(keyAction({ key: 's', metaKey: true })).toBeNull();
    expect(keyAction({ key: 's', altKey: true })).toBeNull();
    expect(keyAction({ key: 's', repeat: true })).toBeNull();
    expect(keyAction({ key: 's', isComposing: true })).toBeNull();
  });
});

describe('guards', () => {
  it('scopes to /probe and the routes under it', () => {
    expect(isProbePath('/probe')).toBe(true);
    expect(isProbePath('/probe/runs/12')).toBe(true);
    expect(isProbePath('/probes')).toBe(false);
    expect(isProbePath('/studies/conditions')).toBe(false);
    expect(blockedBy(ctx({ path: '/studies/conditions' }))).toBe('route');
  });

  it('treats inputs, textareas, selects and contenteditable as typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('blocks while the overlay, the drawer, a dialog or the tour is open, or a request runs', () => {
    expect(blockedBy(ctx())).toBeNull();
    expect(blockedBy(ctx({ target: { tagName: 'TEXTAREA' } }))).toBe('typing');
    expect(blockedBy(ctx({ overlayOpen: true }))).toBe('overlay');
    expect(blockedBy(ctx({ settingsOpen: true }))).toBe('settings');
    expect(blockedBy(ctx({ dialogOpen: true }))).toBe('dialog');
    expect(blockedBy(ctx({ tourOpen: true }))).toBe('tour');
    expect(blockedBy(ctx({ busy: true }))).toBe('busy');
  });
});

describe('shortcutFor', () => {
  it('fires each action only in its phases (brief 7.10 table)', () => {
    const keys: Record<string, string> = {
      send: 's',
      pushback: 'p',
      skip: 'k',
      next: 'n',
      runAgain: 'r',
    };
    for (const [action, phases] of Object.entries(ACTION_PHASES)) {
      for (const phase of PHASES as readonly Phase[]) {
        const got = shortcutFor({ key: keys[action] }, ctx({ phase }));
        expect(got, `${action} in ${phase}`).toBe(phases.includes(phase) ? action : null);
      }
    }
  });

  it('S sends from selected and custom only', () => {
    expect(shortcutFor({ key: 's' }, ctx({ phase: 'selected' }))).toBe('send');
    expect(shortcutFor({ key: 's' }, ctx({ phase: 'custom' }))).toBe('send');
    expect(shortcutFor({ key: 's' }, ctx({ phase: 'idle' }))).toBeNull();
    expect(shortcutFor({ key: 's' }, ctx({ phase: 'sending' }))).toBeNull();
  });

  it('runs nothing when blocked or already handled', () => {
    expect(shortcutFor({ key: 's' }, ctx({ path: '/studies/conditions' }))).toBeNull();
    expect(shortcutFor({ key: 's' }, ctx({ target: { tagName: 'TEXTAREA' } }))).toBeNull();
    expect(shortcutFor({ key: 's' }, ctx({ settingsOpen: true }))).toBeNull();
    expect(shortcutFor({ key: 's', defaultPrevented: true }, ctx())).toBeNull();
    expect(shortcutFor({ key: 'p' }, ctx({ phase: 'pushback', busy: true }))).toBeNull();
  });
});
