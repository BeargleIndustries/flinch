// Progress bar arithmetic (brief 5.6 `StreamProgress`).

/** Percentage done, 0 to 100, from `completed` of `total`; 0 when the total is unknown. */
export function progressPct(completed: number, total: number): number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, (completed / total) * 100));
}

/** "{completed} of {total}". */
export function progressLine(completed: number, total: number): string {
  return `${Math.max(0, completed)} of ${Math.max(0, total)}`;
}
