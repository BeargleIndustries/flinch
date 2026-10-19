import { describe, expect, it } from 'vitest';
import { filterClaims, matchesClaim, toLink, type PolicyClaim } from './claims';

const claim = (id: number, provider: string, slug: string, text = 'text'): PolicyClaim => ({
  id,
  provider,
  claim_id: slug,
  claim_text: text,
  category: 'violence',
});

const byProvider = {
  openai: [claim(3, 'openai', 'oa-1', 'No graphic violence')],
  anthropic: [claim(1, 'anthropic', 'an-1', 'Fiction is allowed'), claim(2, 'anthropic', 'an-2')],
};

describe('claims', () => {
  it('matches slug, text, category and provider, ignoring case', () => {
    const c = byProvider.openai[0];
    expect(matchesClaim(c, '')).toBe(true);
    expect(matchesClaim(c, 'OA-1')).toBe(true);
    expect(matchesClaim(c, 'graphic')).toBe(true);
    expect(matchesClaim(c, 'VIOL')).toBe(true);
    expect(matchesClaim(c, 'openai')).toBe(true);
    expect(matchesClaim(c, 'fiction')).toBe(false);
  });

  it('groups by provider in name order and drops empty groups', () => {
    expect(filterClaims(byProvider, '').map((g) => g.provider)).toEqual(['anthropic', 'openai']);
    const fiction = filterClaims(byProvider, 'fiction');
    expect(fiction).toHaveLength(1);
    expect(fiction[0].claims.map((c) => c.id)).toEqual([1]);
  });

  it('links only checked claims that are not linked yet', () => {
    expect(toLink(new Set([3, 1, 2]), new Set([2]))).toEqual([1, 3]);
    expect(toLink(new Set(), new Set([2]))).toEqual([]);
  });
});
