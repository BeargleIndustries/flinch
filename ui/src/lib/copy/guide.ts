// Guide pages copy (brief 9.6, D12): the glossary, methodology and policy
// reader pages. The glossary entries are glossary.ts, the methodology text is
// guide/methodology.ts and the policy reader's readout is SCREENS.policies;
// everything else these pages say lives here (brief 5.7 rule 9).
import type { GlossaryGroup } from '../glossary';

export const GLOSSARY_PAGE = {
  title: 'Glossary',
  eyebrow: 'Guide',
  groupsLabel: 'Glossary groups',
  /** Brief 9.6: the four headings, in this order. */
  groups: {
    badges: 'Badges',
    loop: 'The core loop',
    studies: 'Studies',
    models: 'Models and keys',
  } satisfies Record<GlossaryGroup, string>,
  termCount: (n: number) => (n === 1 ? '1 term' : `${n} terms`),
} as const;

export const METHODOLOGY_PAGE = {
  eyebrow: 'Guide',
  contentsLabel: 'Sections',
} as const;

export const POLICY_READER = {
  title: 'Policies',
  eyebrow: 'Guide',
  tabs: {
    all: 'All',
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    xai: 'xAI',
  },
  loading: 'Reading the policy claims…',
  failed: 'The policy claims did not load.',
  loadAgain: 'Read again',
  empty: 'No claims for this provider.',
  /** "17" then a dotted "claims" word (brief A.1 policy-claim). */
  claimsWord: (n: number) => (n === 1 ? 'claim' : 'claims'),
  severityDot: (label: string) => `Severity: ${label}`,
  expectedIcon: (label: string) => `Expected: ${label}`,

  // Expanded row (brief 9.6; Appendix C 62: only the columns that exist)
  testable: 'Testable statement',
  expected: 'Expected behaviour',
  severity: 'Severity',
  notes: 'Notes',
  behaviours: {
    should_refuse: 'Should refuse',
    should_allow: 'Should allow',
    should_warn: 'Should warn',
    context_dependent: 'Depends on context',
  } as Record<string, string>,
  severities: {
    hard: 'Hard',
    medium: 'Medium',
    soft: 'Soft',
  } as Record<string, string>,
} as const;
