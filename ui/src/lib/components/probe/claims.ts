// Policy claims for the probe card's links and the Link policy claims dialog
// (brief 7.2). Rows of `policy_claims` (flinch/db.py) as GET /api/policies
// (`{provider: [claim]}`) and GET /api/probes/{id}/claims return them; the
// shape is not in tests/shapes.py, so it is declared here with the columns
// the screens read.

export interface PolicyClaim {
  /** Database id: the value POST /claims takes and DELETE /claims/{claim_id} names. */
  id: number;
  provider: string;
  /** The claim's slug within its provider. */
  claim_id: string;
  claim_text: string;
  category: string;
  expected_behavior?: string;
}

export type PoliciesByProvider = Record<string, PolicyClaim[]>;

/** Case-insensitive match on the slug, text, category or provider; blank matches all. */
export function matchesClaim(c: PolicyClaim, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return [c.claim_id, c.claim_text, c.category, c.provider].some((s) =>
    (s ?? '').toLowerCase().includes(q),
  );
}

/** Providers in name order, each with its matching claims; providers with none are dropped. */
export function filterClaims(
  byProvider: PoliciesByProvider,
  query: string,
): { provider: string; claims: PolicyClaim[] }[] {
  return Object.keys(byProvider)
    .sort((a, b) => a.localeCompare(b))
    .map((provider) => ({
      provider,
      claims: (byProvider[provider] ?? []).filter((c) => matchesClaim(c, query)),
    }))
    .filter((g) => g.claims.length > 0);
}

/** The checked ids that are not linked yet, in order (what "Link {n} claims" sends). */
export function toLink(checked: ReadonlySet<number>, linked: ReadonlySet<number>): number[] {
  return [...checked].filter((id) => !linked.has(id)).sort((a, b) => a - b);
}
