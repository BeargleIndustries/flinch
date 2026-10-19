<!--
  The tape (brief 8.3 "a strip of glyph-only badges in iteration order"): one
  square per call, in order. Answered calls show their badge's colour and
  letter; the call in flight pulses; calls not made yet are dashed outlines;
  a failed call is a danger outline with "!". One colour all the way along
  reads as a rule, a mix as a coin flip.
-->
<script lang="ts">
  import { scale } from 'svelte/transition';
  import { CLS_SPEC } from '$lib/cls';
  import { REPEAT } from '$lib/copy/studies';
  import { latencyLabel, type LiveCell } from './repeat';

  interface Props {
    cells: LiveCell[];
    /** Calls the tape stands for; slots past the cells are drawn empty. */
    total: number;
    /** The next empty slot pulses (the call in flight). */
    live?: boolean;
    /** Accessible name for the whole strip. */
    label: string;
    size?: 'sm' | 'md';
  }

  let { cells, total, live = false, label, size = 'md' }: Props = $props();

  const byIteration = $derived(new Map(cells.map((c) => [c.iteration, c])));
  const slots = $derived(Array.from({ length: Math.max(total, cells.length) }, (_, i) => i + 1));
  const box = $derived(size === 'sm' ? 'h-3 w-3 text-[8px]' : 'h-4 w-4 text-[9px]');
  /** The first slot without a cell is the call in flight. */
  const nextSlot = $derived(slots.find((i) => !byIteration.has(i)) ?? null);
</script>

<ol class="flex flex-wrap gap-[3px]" aria-label={label} data-testid="repeat-tape">
  {#each slots as i (i)}
    {@const cell = byIteration.get(i)}
    {#if cell && cell.cls}
      {@const spec = CLS_SPEC[cell.cls]}
      <li
        class="inline-flex shrink-0 items-center justify-center rounded-[3px] font-mono font-bold leading-none {box} {spec.glyphBg} {spec.glyphText}"
        title={REPEAT.slotTitle(i, spec.word, latencyLabel(cell.latencyMs))}
        data-testid="tape-slot"
        data-cls={cell.cls}
        in:scale={{ start: 0.4, duration: 200 }}
      >
        <span aria-hidden="true">{spec.glyph}</span>
        <span class="sr-only">{spec.word}</span>
      </li>
    {:else if cell}
      <li
        class="inline-flex shrink-0 items-center justify-center rounded-[3px] border border-danger/70 bg-danger/10 font-mono font-bold leading-none text-danger {box}"
        title={REPEAT.slotFailed(i, cell.error ?? '')}
        data-testid="tape-slot"
        data-cls="failed"
        in:scale={{ start: 0.4, duration: 200 }}
      >
        <span aria-hidden="true">!</span>
        <span class="sr-only">{REPEAT.slotFailed(i, cell.error ?? '')}</span>
      </li>
    {:else}
      <li
        class="shrink-0 rounded-[3px] border {box} {live && i === nextSlot
          ? 'animate-pulse border-accent bg-accent/20'
          : 'border-dashed border-borderStrong/70'}"
        title={REPEAT.slotPending(i)}
        data-testid="tape-slot"
        data-cls="pending"
      >
        <span class="sr-only">{REPEAT.slotPending(i)}</span>
      </li>
    {/if}
  {/each}
</ol>
