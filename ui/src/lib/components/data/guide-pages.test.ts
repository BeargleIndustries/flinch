import { describe, expect, it } from 'vitest';
import { glossary } from '$lib/glossary';
import { methodology } from '$lib/guide/methodology';
import { GLOSSARY_GROUPS, groupAnchor, groupGlossary, slug, termAnchor } from './guide-pages';

describe('glossary page grouping', () => {
  const groups = groupGlossary();

  it('has the four groups of brief 9.6 in order', () => {
    expect(groups.map((g) => g.group)).toEqual([...GLOSSARY_GROUPS]);
    expect([...GLOSSARY_GROUPS]).toEqual(['badges', 'loop', 'studies', 'models']);
  });

  it('places every entry exactly once, under its own group', () => {
    const keys = groups.flatMap((g) => g.rows.map((r) => r.key));
    expect(keys.sort()).toEqual(Object.keys(glossary).sort());
    for (const g of groups) for (const r of g.rows) expect(r.group).toBe(g.group);
    for (const g of groups) expect(g.rows.length).toBeGreaterThan(0);
  });

  it('keeps glossary.ts order within a group', () => {
    expect(groups[0].rows.map((r) => r.key).slice(0, 4)).toEqual([
      'refused',
      'collapsed',
      'negotiated',
      'complied',
    ]);
  });

  it('builds anchors that are unique and URL-safe', () => {
    expect(groupAnchor('loop')).toBe('glossary-loop');
    expect(termAnchor('system-prompt')).toBe('term-system-prompt');
    const ids = Object.keys(glossary).map(termAnchor);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('methodology anchors', () => {
  it('slugs headings', () => {
    expect(slug("The coach's moves")).toBe('the-coachs-moves');
    expect(slug('From one run to a study')).toBe('from-one-run-to-a-study');
    expect(slug('  Honesty! ')).toBe('honesty');
  });

  it('gives every methodology section a unique anchor', () => {
    const ids = methodology.sections.map((s) => slug(s.heading));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).not.toBe('');
  });
});
