// Policy reader helpers (brief 9.6, 9.9; Appendix C 62). Rows of
// `policy_claims` (flinch/db.py): id, provider, claim_id, claim_text,
// category, testable_statement, expected_behavior, severity, notes,
// created_at. The All tab reads GET /api/policies ({provider: [claim]});
// each provider tab reads GET /api/policies/{provider} ([claim]).
import { truncate } from '$lib/format';
import type { PoliciesByProvider, PolicyClaim } from '../probe/claims';

/** A claim row with the columns the reader shows when expanded. */
export interface PolicyRow extends PolicyClaim {
  testable_statement?: string | null;
  severity?: string | null;
  notes?: string | null;
}

/** Brief 9.6: the tabs, in order; providers seeded by flinch/seeds/policies.py. */
export const POLICY_TABS = ['all', 'anthropic', 'openai', 'google', 'xai'] as const;
export type PolicyTab = (typeof POLICY_TABS)[number];
export type PolicyProvider = Exclude<PolicyTab, 'all'>;
export const PROVIDERS: readonly PolicyProvider[] = ['anthropic', 'openai', 'google', 'xai'];

/** Brief 9.6: claim text is cut at 140 characters in the row. */
export const CLAIM_TEXT_LENGTH = 140;

export function isPolicyTab(v: string): v is PolicyTab {
  return (POLICY_TABS as readonly string[]).includes(v);
}

/** The All tab's rows: seeded providers first in tab order, then any others by name. */
export function flattenPolicies(byProvider: PoliciesByProvider): PolicyRow[] {
  const known = PROVIDERS.filter((p) => p in byProvider);
  const others = Object.keys(byProvider)
    .filter((p) => !(PROVIDERS as readonly string[]).includes(p))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...others].flatMap((p) => (byProvider[p] ?? []) as PolicyRow[]);
}

/** The row's claim text, cut at CLAIM_TEXT_LENGTH. */
export function claimExcerpt(text: string | null | undefined): string {
  return truncate((text ?? '').trim(), CLAIM_TEXT_LENGTH);
}

export type Tone = 'danger' | 'warn' | 'ok' | 'muted';

/** Severity dot colour (brief 9.6): hard danger, medium warn, soft ok; anything else muted. */
export function severityTone(severity: string | null | undefined): Tone {
  switch ((severity ?? '').toLowerCase()) {
    case 'hard':
      return 'danger';
    case 'medium':
      return 'warn';
    case 'soft':
      return 'ok';
    default:
      return 'muted';
  }
}

export type ExpectedIcon = 'check' | 'square' | 'dot';

/** Expected-behaviour icon (brief 9.6): should_allow a check, should_refuse a square, else a dot. */
export function expectedIcon(expected: string | null | undefined): ExpectedIcon {
  if (expected === 'should_allow') return 'check';
  if (expected === 'should_refuse') return 'square';
  return 'dot';
}

/** The icon's colour: check ok, square danger, dot muted. */
export function expectedTone(expected: string | null | undefined): Tone {
  const icon = expectedIcon(expected);
  return icon === 'check' ? 'ok' : icon === 'square' ? 'danger' : 'muted';
}

/** A label from a copy map, falling back to the raw value with underscores as spaces. */
export function labelFor(map: Record<string, string>, value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (v === '') return '';
  return map[v] ?? v.replace(/_/g, ' ');
}

/** Whether a free-text column has something to show (Notes only when set). */
export function hasText(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** A set with `id` added or removed. */
export function toggledId(set: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
