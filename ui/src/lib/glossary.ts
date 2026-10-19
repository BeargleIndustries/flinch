// Plain-language glossary (brief A.1). Each definition is one short sentence or
// two, at most 140 characters. <Term key="..."> looks entries up here, by key or
// by any alias.
//
// T11 ships the shape and the lookup (Pry `glossary.ts`, without `introducedIn`,
// plus `group`); T12 fills `glossary` with the entries of brief A.1.

export type GlossaryGroup = 'badges' | 'loop' | 'studies' | 'models';

export interface GlossaryEntry {
  /** Display name, used when <Term> has no child text. */
  term: string;
  /** At most 140 characters. */
  definition: string;
  /** Other words a newcomer might meet for the same idea (matched case-insensitively). */
  aliases: string[];
  /** Heading the entry sits under on /guide/glossary. */
  group: GlossaryGroup;
}

export const MAX_DEFINITION_LENGTH = 140;

export const glossary: Record<string, GlossaryEntry> = {};

const index: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [key, entry] of Object.entries(glossary)) {
    m.set(key.toLowerCase(), key);
    m.set(entry.term.toLowerCase(), key);
    for (const a of entry.aliases) m.set(a.toLowerCase(), key);
  }
  return m;
})();

/** Canonical key for a key, display term or alias, or null if unknown. */
export function resolveTerm(name: string): string | null {
  return index.get(name.trim().toLowerCase()) ?? null;
}

/** Entry for a key, display term or alias, or null if unknown. */
export function lookupTerm(name: string): GlossaryEntry | null {
  const key = resolveTerm(name);
  return key ? glossary[key] : null;
}
