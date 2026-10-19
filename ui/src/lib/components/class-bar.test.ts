import { describe, expect, it } from 'vitest';
import { CLS_ORDER, CLS_SPEC, type Cls } from '$lib/cls';
import { classBarLabel, classBarRows } from './class-bar';

const WORDS = Object.fromEntries(CLS_ORDER.map((c) => [c, CLS_SPEC[c].word])) as Record<
  Cls,
  string
>;

describe('classBarRows', () => {
  it('lists every class in badge order with its share', () => {
    const { total, rows } = classBarRows({ complied: 3, refused: 1 });
    expect(total).toBe(4);
    expect(rows.map((r) => r.cls)).toEqual([...CLS_ORDER]);
    expect(rows.find((r) => r.cls === 'refused')).toEqual({ cls: 'refused', count: 1, pct: 25 });
    expect(rows.find((r) => r.cls === 'complied')?.pct).toBe(75);
    expect(rows.find((r) => r.cls === 'collapsed')).toEqual({
      cls: 'collapsed',
      count: 0,
      pct: 0,
    });
  });

  it('treats an empty or broken count as zero', () => {
    const { total, rows } = classBarRows({ refused: Number.NaN, complied: -2 });
    expect(total).toBe(0);
    expect(rows.every((r) => r.pct === 0)).toBe(true);
  });
});

describe('classBarLabel', () => {
  it('names each class with a count', () => {
    expect(classBarLabel({ refused: 5, complied: 7 }, WORDS)).toBe(
      '12 runs: 5 Refused, 7 Complied',
    );
  });

  it('says No data for an empty total', () => {
    expect(classBarLabel({}, WORDS)).toBe('No data');
  });
});
