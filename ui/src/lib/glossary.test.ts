// Glossary checks (brief 13.2, AC16): definitions at most 140 characters, no
// duplicate names, every alias resolves to its own entry, no em dash. The
// "every <Term key> exists" check waits for screens that use <Term>.
import { describe, expect, it } from 'vitest';
import { MAX_DEFINITION_LENGTH, glossary, lookupTerm, resolveTerm } from './glossary';

/** The em dash, built from its code point so this file never holds one (brief 5.7 rule 1). */
const EM_DASH = String.fromCharCode(0x2014);

const GROUPS = ['badges', 'loop', 'studies', 'models'];

describe('glossary', () => {
  const entries = Object.entries(glossary);

  it('has the entries of brief A.1', () => {
    expect(entries.length).toBe(31);
  });

  it.each(entries)('%s: definition is non-empty and at most 140 characters', (_key, e) => {
    expect(e.term.trim()).not.toBe('');
    expect(e.definition.trim()).not.toBe('');
    expect(e.definition.length).toBeLessThanOrEqual(MAX_DEFINITION_LENGTH);
  });

  it.each(entries)('%s: has a known group and no em dash', (_key, e) => {
    expect(GROUPS).toContain(e.group);
    for (const s of [e.term, e.definition, ...e.aliases]) expect(s).not.toContain(EM_DASH);
  });

  it('keys, terms and aliases are unique and each resolves to its own entry', () => {
    const seen = new Map<string, string>();
    for (const [key, e] of entries) {
      const names = new Set([key, e.term, ...e.aliases].map((n) => n.toLowerCase()));
      for (const name of names) {
        expect(name.trim()).not.toBe('');
        const owner = seen.get(name);
        expect(owner === undefined || owner === key, `"${name}" used by ${owner} and ${key}`).toBe(
          true,
        );
        seen.set(name, key);
        expect(resolveTerm(name)).toBe(key);
      }
    }
  });

  it('looks up keys, terms and aliases case-insensitively', () => {
    expect(lookupTerm('Fold')).toBe(glossary.collapsed);
    expect(lookupTerm('System Prompt')).toBe(glossary['system-prompt']);
    expect(lookupTerm('  stat run ')).toBe(glossary['repeat-run']);
    expect(lookupTerm('Hugging Face')).toBeNull();
  });
});
