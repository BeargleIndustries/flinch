import { describe, expect, it } from 'vitest';
import { isSubmitKey } from './dialog';

const input = (type = 'text') => ({ tagName: 'INPUT', type });

describe('isSubmitKey', () => {
  it('submits on Enter in a single-line field', () => {
    expect(isSubmitKey({ key: 'Enter', target: input() })).toBe(true);
    expect(isSubmitKey({ key: 'Enter', target: input('search') })).toBe(true);
    expect(isSubmitKey({ key: 'Enter', target: input('') })).toBe(true);
  });

  it('leaves Enter alone in a textarea, a checkbox, a button or a select', () => {
    expect(isSubmitKey({ key: 'Enter', target: { tagName: 'TEXTAREA' } })).toBe(false);
    expect(isSubmitKey({ key: 'Enter', target: input('checkbox') })).toBe(false);
    expect(isSubmitKey({ key: 'Enter', target: { tagName: 'BUTTON', type: 'button' } })).toBe(
      false,
    );
    expect(isSubmitKey({ key: 'Enter', target: { tagName: 'SELECT' } })).toBe(false);
  });

  it('ignores other keys, modifiers and IME composition', () => {
    expect(isSubmitKey({ key: 'a', target: input() })).toBe(false);
    expect(isSubmitKey({ key: 'Enter', shiftKey: true, target: input() })).toBe(false);
    expect(isSubmitKey({ key: 'Enter', isComposing: true, target: input() })).toBe(false);
    expect(isSubmitKey({ key: 'Enter', target: null })).toBe(false);
  });
});
