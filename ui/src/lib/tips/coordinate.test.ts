import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tipsRegistry, type TipDef } from './tips-registry';
import { isTipSeen, markTipSeen, markTipsSeenForStep, resetAllTips } from './coordinate';

/** A Storage stand-in with the parts coordinate.ts and prefs.ts use. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    m,
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const TIPS: TipDef[] = [
  {
    id: 'send-button',
    title: 'Send',
    target: '[data-tour="send-button"]',
    blurb: 'b',
    why: null,
    placement: 'bottom',
    tutorialStepId: 'step-3',
  },
  {
    id: 'export-button',
    title: 'Export',
    target: '[data-tip="export-button"]',
    blurb: 'b',
    why: null,
    placement: 'bottom',
  },
];

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  vi.stubGlobal('localStorage', store);
  tipsRegistry.push(...TIPS);
});

afterEach(() => {
  tipsRegistry.length = 0;
  vi.unstubAllGlobals();
});

describe('tips coordination', () => {
  it('stores seen flags under flinch:tip_seen:', () => {
    expect(isTipSeen('send-button')).toBe(false);
    markTipSeen('send-button');
    expect(store.m.get('flinch:tip_seen:send-button')).toBe('true');
    expect(isTipSeen('send-button')).toBe(true);
  });

  it('marks a tip seen when the tour shows its step', () => {
    markTipsSeenForStep('step-3');
    expect(isTipSeen('send-button')).toBe(true);
    expect(isTipSeen('export-button')).toBe(false);
  });

  it('marks a tip seen when the step points at its data-tip anchor', () => {
    markTipsSeenForStep('step-9', ['export-button']);
    expect(isTipSeen('export-button')).toBe(true);
    expect(isTipSeen('send-button')).toBe(false);
  });

  it('resets every flag, including tips no longer in the registry', () => {
    markTipSeen('send-button');
    store.setItem('flinch:tip_seen:retired-tip', 'true');
    store.setItem('flinch:tour_seen', 'true');
    resetAllTips();
    expect(isTipSeen('send-button')).toBe(false);
    expect(store.m.has('flinch:tip_seen:retired-tip')).toBe(false);
    expect(store.m.get('flinch:tour_seen')).toBe('true');
  });

  it('treats missing storage as "not seen" and never throws', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(isTipSeen('send-button')).toBe(false);
    expect(() => markTipSeen('send-button')).not.toThrow();
    expect(() => resetAllTips()).not.toThrow();
  });
});
