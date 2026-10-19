import { describe, expect, it } from 'vitest';
import {
  CLAIM_TEXT_LENGTH,
  POLICY_TABS,
  PROVIDERS,
  claimExcerpt,
  expectedIcon,
  expectedTone,
  flattenPolicies,
  hasText,
  isPolicyTab,
  labelFor,
  severityTone,
  toggledId,
  type PolicyRow,
} from './policies';

const row = (id: number, provider: string, over: Partial<PolicyRow> = {}): PolicyRow => ({
  id,
  provider,
  claim_id: `${provider}-${id}`,
  claim_text: 'Claim text',
  category: 'violence',
  expected_behavior: 'should_refuse',
  testable_statement: 'A statement',
  severity: 'hard',
  notes: '',
  ...over,
});

describe('policy reader helpers', () => {
  it('has the five tabs of brief 9.6 in order', () => {
    expect([...POLICY_TABS]).toEqual(['all', 'anthropic', 'openai', 'google', 'xai']);
    expect([...PROVIDERS]).toEqual(['anthropic', 'openai', 'google', 'xai']);
    expect(isPolicyTab('openai')).toBe(true);
    expect(isPolicyTab('meta')).toBe(false);
  });

  it('flattens providers in tab order, then unknown providers by name', () => {
    const rows = flattenPolicies({
      xai: [row(5, 'xai')],
      zeta: [row(7, 'zeta')],
      anthropic: [row(1, 'anthropic'), row(2, 'anthropic')],
      alpha: [row(6, 'alpha')],
      openai: [row(3, 'openai')],
    });
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 5, 6, 7]);
    expect(flattenPolicies({})).toEqual([]);
  });

  it('cuts claim text at 140 characters', () => {
    expect(CLAIM_TEXT_LENGTH).toBe(140);
    expect(claimExcerpt('a'.repeat(141))).toBe(`${'a'.repeat(140)}…`);
    expect(claimExcerpt(' short ')).toBe('short');
    expect(claimExcerpt(null)).toBe('');
  });

  it('colours severity: hard danger, medium warn, soft ok, else muted', () => {
    expect(severityTone('hard')).toBe('danger');
    expect(severityTone('Medium')).toBe('warn');
    expect(severityTone('soft')).toBe('ok');
    expect(severityTone('')).toBe('muted');
    expect(severityTone(null)).toBe('muted');
  });

  it('picks the expected-behaviour icon and colour', () => {
    expect(expectedIcon('should_allow')).toBe('check');
    expect(expectedTone('should_allow')).toBe('ok');
    expect(expectedIcon('should_refuse')).toBe('square');
    expect(expectedTone('should_refuse')).toBe('danger');
    expect(expectedIcon('context_dependent')).toBe('dot');
    expect(expectedTone('should_warn')).toBe('muted');
    expect(expectedIcon(undefined)).toBe('dot');
  });

  it('labels values from a copy map with a readable fallback', () => {
    const map = { should_refuse: 'Should refuse' };
    expect(labelFor(map, 'should_refuse')).toBe('Should refuse');
    expect(labelFor(map, 'needs_review')).toBe('needs review');
    expect(labelFor(map, '  ')).toBe('');
    expect(labelFor(map, null)).toBe('');
  });

  it('shows notes only when set', () => {
    expect(hasText('A note')).toBe(true);
    expect(hasText('  ')).toBe(false);
    expect(hasText(null)).toBe(false);
  });

  it('toggles expanded ids without changing the original set', () => {
    const a = new Set([1]);
    const b = toggledId(a, 2);
    expect([...b].sort()).toEqual([1, 2]);
    expect([...toggledId(b, 1)]).toEqual([2]);
    expect([...a]).toEqual([1]);
  });
});
