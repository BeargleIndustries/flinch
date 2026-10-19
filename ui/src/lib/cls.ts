/**
 * Classification badge logic (brief 5.3, D6). Refused and Collapsed share the
 * orange pair ("pushed against"), Negotiated and Complied the blue pair ("went
 * along"); each carries a letter glyph so it survives colour-blindness and
 * small sizes.
 */

export const CLASSES = ['refused', 'collapsed', 'negotiated', 'complied'] as const;

export type Cls = (typeof CLASSES)[number] | 'unknown';

/** Display order for stacked bars and legends (ClassBar). */
export const CLS_ORDER: readonly Cls[] = [...CLASSES, 'unknown'];

export interface ClsSpec {
  glyph: string;
  word: string;
  /** Tailwind classes for the pill: border, background, text. */
  pill: string;
  /** Tailwind text class for the glyph on its full-colour square. */
  glyphText: string;
  /** Tailwind background class for the glyph square. */
  glyphBg: string;
}

export const CLS_SPEC: Record<Cls, ClsSpec> = {
  refused: {
    glyph: 'R',
    word: 'Refused',
    pill: 'border-clsRefused/50 bg-clsRefused/15 text-orange-200',
    glyphText: 'text-white',
    glyphBg: 'bg-clsRefused',
  },
  collapsed: {
    glyph: 'X',
    word: 'Collapsed',
    pill: 'border-clsCollapsed/50 bg-clsCollapsed/15 text-orange-100',
    glyphText: 'text-zinc-950',
    glyphBg: 'bg-clsCollapsed',
  },
  negotiated: {
    glyph: 'N',
    word: 'Negotiated',
    pill: 'border-clsNegotiated/50 bg-clsNegotiated/15 text-sky-100',
    glyphText: 'text-zinc-950',
    glyphBg: 'bg-clsNegotiated',
  },
  complied: {
    glyph: 'C',
    word: 'Complied',
    pill: 'border-clsComplied/50 bg-clsComplied/15 text-blue-200',
    glyphText: 'text-white',
    glyphBg: 'bg-clsComplied',
  },
  unknown: {
    glyph: '?',
    word: 'Not classified',
    pill: 'border-border bg-surface2 text-text3',
    glyphText: 'text-zinc-100',
    glyphBg: 'bg-clsUnknown',
  },
};

/** Any value outside CLASSES (null, empty, unexpected) becomes `unknown`. */
export function toCls(v: string | null | undefined): Cls {
  const s = (v ?? '').trim().toLowerCase();
  return (CLASSES as readonly string[]).includes(s) ? (s as Cls) : 'unknown';
}
