// Stacked classification bar logic (brief 5.3, 5.6 `ClassBar`). The bar and
// the legend use CLS_ORDER: refused, collapsed, negotiated, complied, unknown.

import { CLS_ORDER, type Cls } from '$lib/cls';

export type ClsCounts = Partial<Record<Cls, number>>;

export interface ClassBarRow {
  cls: Cls;
  count: number;
  /** Share of the total, 0 to 100; 0 when the total is 0. */
  pct: number;
}

/** A count that is not a positive finite number counts as 0. */
function clean(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Every class in CLS_ORDER with its count and share, and the total (the sum of counts). */
export function classBarRows(counts: ClsCounts): { total: number; rows: ClassBarRow[] } {
  const total = CLS_ORDER.reduce((sum, c) => sum + clean(counts[c]), 0);
  const rows = CLS_ORDER.map((cls) => {
    const count = clean(counts[cls]);
    return { cls, count, pct: total > 0 ? (count / total) * 100 : 0 };
  });
  return { total, rows };
}

/** Screen-reader sentence for the bar, e.g. "12 runs: 5 Refused, 7 Complied". */
export function classBarLabel(
  counts: ClsCounts,
  words: Record<Cls, string>,
  noun = 'runs',
): string {
  const { total, rows } = classBarRows(counts);
  if (total === 0) return 'No data';
  const parts = rows.filter((r) => r.count > 0).map((r) => `${r.count} ${words[r.cls]}`);
  return `${total} ${noun}: ${parts.join(', ')}`;
}
