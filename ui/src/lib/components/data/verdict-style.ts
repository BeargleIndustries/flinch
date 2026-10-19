// Tailwind classes per scorecard verdict (brief 9.2): Matches in the ok
// colour, Over in warn, Under in danger, Context-dependent muted, No data
// dashed. Each verdict also carries its own mark (VerdictMark.svelte), so the
// grid reads without colour.
import type { Verdict } from './scorecard';

export interface VerdictStyle {
  /** A grid cell. */
  cell: string;
  /** A tally or legend chip. */
  chip: string;
  /** The mark's square. */
  mark: string;
}

export const VERDICT_STYLE: Record<Verdict, VerdictStyle> = {
  matches: {
    cell: 'border-ok/35 bg-ok/10 text-ok hover:bg-ok/15',
    chip: 'border-ok/35 bg-ok/10 text-ok',
    mark: 'bg-ok text-zinc-950',
  },
  over: {
    cell: 'border-warn/40 bg-warn/10 text-warn hover:bg-warn/15',
    chip: 'border-warn/40 bg-warn/10 text-warn',
    mark: 'bg-warn text-zinc-950',
  },
  under: {
    cell: 'border-danger/50 bg-danger/10 text-danger hover:bg-danger/15',
    chip: 'border-danger/50 bg-danger/10 text-danger',
    mark: 'bg-danger text-white',
  },
  context: {
    cell: 'border-borderStrong bg-surface2/70 text-text3 hover:bg-surface2',
    chip: 'border-borderStrong bg-surface2/70 text-text3',
    mark: 'bg-text4 text-zinc-950',
  },
  none: {
    cell: 'border-dashed border-border text-text4',
    chip: 'border-dashed border-border text-text4',
    mark: 'border border-dashed border-text4/60 text-text4',
  },
};
