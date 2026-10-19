// The batch table's rows (brief 7.8) as pure functions, so the stream handler
// in batch.svelte.ts stays small and the rules are unit-tested.
//
// With `probe_ids: null` the server runs the session's probe set in id order
// (`db.list_probes` ORDER BY id), the same list and order the rail shows. When
// the rail's list has as many probes as the `start` event's total, the table is
// planned up front: every probe waits, the next one is "in flight", and rows
// fill in as `progress` and `error` events land. Otherwise rows are appended as
// they land.
import { CLS_ORDER, toCls, type Cls } from '$lib/cls';

export type RowState = 'waiting' | 'next' | 'done' | 'failed' | 'cancelled' | 'skipped';

export interface BatchRow {
  probeId: number;
  name: string;
  domain: string | null;
  state: RowState;
  runId: number | null;
  cls: string | null;
  error: string | null;
}

export interface PlannedProbe {
  id: number;
  name: string;
  domain: string | null;
}

/** One `progress` (run saved) or per-probe `error` event. */
export interface Landed {
  probeId: number;
  name: string;
  runId?: number | null;
  cls?: string | null;
  error?: string | null;
}

/** Every probe waiting, the first in flight; empty when the plan does not match `total`. */
export function planRows(plan: readonly PlannedProbe[], total: number): BatchRow[] {
  if (plan.length === 0 || plan.length !== total) return [];
  return plan.map((p, i) => ({
    probeId: p.id,
    name: p.name,
    domain: p.domain,
    state: i === 0 ? 'next' : 'waiting',
    runId: null,
    cls: null,
    error: null,
  }));
}

const open = (r: BatchRow) => r.state === 'next' || r.state === 'waiting';

/** Fills the landed probe's row (or appends one) and moves "in flight" to the next waiting row. */
export function landRow(
  rows: readonly BatchRow[],
  landed: Landed,
  domainOf: (probeId: number) => string | null = () => null,
): BatchRow[] {
  const filled: BatchRow = {
    probeId: landed.probeId,
    name: landed.name,
    domain: domainOf(landed.probeId),
    state: landed.error ? 'failed' : 'done',
    runId: landed.runId ?? null,
    cls: landed.error ? null : (landed.cls ?? null),
    error: landed.error ?? null,
  };
  const at = rows.findIndex((r) => r.probeId === landed.probeId && open(r));
  let next: BatchRow[];
  if (at === -1) {
    next = [...rows, filled];
  } else {
    next = rows.map((r, i) =>
      i === at ? { ...filled, name: r.name || filled.name, domain: r.domain ?? filled.domain } : r,
    );
  }
  if (next.some((r) => r.state === 'next')) {
    next = next.map((r) => (r.state === 'next' ? { ...r, state: 'waiting' } : r));
  }
  const first = next.findIndex((r) => r.state === 'waiting');
  return first === -1 ? next : next.map((r, i) => (i === first ? { ...r, state: 'next' } : r));
}

/** The batch ended: the probe in flight is cancelled and the rest were never sent. */
export function settleRows(rows: readonly BatchRow[]): BatchRow[] {
  return rows.map((r) =>
    r.state === 'next'
      ? { ...r, state: 'cancelled' }
      : r.state === 'waiting'
        ? { ...r, state: 'skipped' }
        : r,
  );
}

/** How many landed rows have each classification, in the badge order. */
export function tally(rows: readonly BatchRow[]): { cls: Cls; count: number }[] {
  const counts = new Map<Cls, number>();
  for (const r of rows) {
    if (r.state !== 'done') continue;
    const cls = toCls(r.cls);
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }
  return CLS_ORDER.filter((c) => counts.has(c)).map((cls) => ({
    cls,
    count: counts.get(cls) ?? 0,
  }));
}
