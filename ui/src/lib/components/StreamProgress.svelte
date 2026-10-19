<!--
  Progress of a long job (brief 5.6): a bar, "{completed} of {total}",
  "{failed} failed" in danger when any failed, and "Cancel" when it can stop.
-->
<script lang="ts">
  import { PROGRESS } from '$lib/copy/shell';
  import { progressLine, progressPct } from './stream-progress';

  interface Props {
    label: string;
    completed: number;
    total: number;
    failed?: number;
    onCancel?: () => void;
  }

  let { label, completed, total, failed = 0, onCancel }: Props = $props();

  const pct = $derived(progressPct(completed, total));
</script>

<div class="flex flex-col gap-1.5">
  <div class="flex items-baseline justify-between gap-3 text-xs">
    <span class="truncate text-text2">{label}</span>
    <span class="flex shrink-0 items-baseline gap-2 font-mono tabular-nums">
      <span class="text-text3">{progressLine(completed, total)}</span>
      {#if failed > 0}<span class="text-danger">{PROGRESS.failed(failed)}</span>{/if}
      {#if onCancel}
        <button
          type="button"
          onclick={onCancel}
          class="font-sans text-text3 underline-offset-2 hover:text-text hover:underline focus:outline-none focus-visible:text-text focus-visible:underline"
          >{PROGRESS.cancel}</button
        >
      {/if}
    </span>
  </div>
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={completed}
    class="h-1 w-full overflow-hidden rounded-full bg-surface2"
  >
    <div
      class="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
      style:width="{pct}%"
    ></div>
  </div>
</div>
