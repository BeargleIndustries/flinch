// Glossary and methodology page helpers (brief 9.6, A.1, A.4). The pages
// render these with Svelte blocks (I5); the anchors let the glossary's group
// links, the methodology contents and any deep link land on a group, a term
// or a section.
import { glossary, type GlossaryEntry, type GlossaryGroup } from '$lib/glossary';

/** Brief 9.6: the four glossary groups, in page order. */
export const GLOSSARY_GROUPS: readonly GlossaryGroup[] = ['badges', 'loop', 'studies', 'models'];

export interface GlossaryRow extends GlossaryEntry {
  key: string;
}

/** Every entry under its group, groups in page order, entries in glossary.ts order. */
export function groupGlossary(
  entries: Record<string, GlossaryEntry> = glossary,
): { group: GlossaryGroup; rows: GlossaryRow[] }[] {
  return GLOSSARY_GROUPS.map((group) => ({
    group,
    rows: Object.entries(entries)
      .filter(([, e]) => e.group === group)
      .map(([key, e]) => ({ key, ...e })),
  }));
}

/** Anchor id of a glossary group: `glossary-badges`. */
export function groupAnchor(group: GlossaryGroup): string {
  return `glossary-${group}`;
}

/** Anchor id of a glossary entry: `term-{key}` (keys are already URL-safe slugs). */
export function termAnchor(key: string): string {
  return `term-${key}`;
}

/** A heading as an anchor id: "The coach's moves" becomes `the-coachs-moves`. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
