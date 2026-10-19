import { describe, expect, it } from 'vitest';
import { CLASSES, CLS_ORDER, CLS_SPEC, toCls, type Cls } from './cls';

describe('toCls', () => {
  it('keeps each known class', () => {
    for (const c of CLASSES) expect(toCls(c)).toBe(c);
  });

  it('ignores case and surrounding space', () => {
    expect(toCls('REFUSED')).toBe('refused');
    expect(toCls(' Complied ')).toBe('complied');
  });

  it('maps null, undefined, empty and unexpected strings to unknown', () => {
    expect(toCls(null)).toBe('unknown');
    expect(toCls(undefined)).toBe('unknown');
    expect(toCls('')).toBe('unknown');
    expect(toCls('partial')).toBe('unknown');
    expect(toCls('unknown')).toBe('unknown');
  });
});

describe('CLS_SPEC', () => {
  const all: Cls[] = [...CLASSES, 'unknown'];

  it('has a row for every class', () => {
    expect(Object.keys(CLS_SPEC).sort()).toEqual([...all].sort());
    for (const c of all) {
      const spec = CLS_SPEC[c];
      expect(spec.glyph).toHaveLength(1);
      expect(spec.word.length).toBeGreaterThan(0);
      expect(spec.pill).toMatch(/border-/);
      expect(spec.glyphText).toMatch(/^text-/);
      expect(spec.glyphBg).toMatch(/^bg-/);
    }
  });

  it('uses the R, X, N, C glyphs and readable words', () => {
    expect(all.map((c) => CLS_SPEC[c].glyph)).toEqual(['R', 'X', 'N', 'C', '?']);
    expect(all.map((c) => CLS_SPEC[c].word)).toEqual([
      'Refused',
      'Collapsed',
      'Negotiated',
      'Complied',
      'Not classified',
    ]);
  });

  it('puts Refused and Collapsed on orange, Negotiated and Complied on blue', () => {
    expect(CLS_SPEC.refused.pill).toContain('text-orange-');
    expect(CLS_SPEC.collapsed.pill).toContain('text-orange-');
    expect(CLS_SPEC.negotiated.pill).toContain('text-sky-');
    expect(CLS_SPEC.complied.pill).toContain('text-blue-');
  });

  it('orders bars refused, collapsed, negotiated, complied, unknown', () => {
    expect(CLS_ORDER).toEqual(['refused', 'collapsed', 'negotiated', 'complied', 'unknown']);
  });
});
