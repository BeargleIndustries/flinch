<!--
  Repeat runs, the live run (brief 8.3 "Running"): StreamProgress over every
  call (Stop while it runs; the strip's Cancel does the same), then one row
  per probe whose tape grows a square per call in iteration order. State
  lives in repeat.svelte.ts, so the run keeps going (and the strip keeps
  showing it) when you leave the screen.
-->
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { X } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import StreamProgress from '$lib/components/StreamProgress.svelte';
  import { REPEAT } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { BTN } from '../probe/styles';
  import RepeatTape from './RepeatTape.svelte';
  import { repeat } from './repeat.svelte';

  const live = $derived(repeat.live);
  const phase = $derived(repeat.phase);
  const running = $derived(repeat.running);

  const title = $derived.by(() => {
    if (!live) return '';
    switch (phase) {
      case 'stopping':
        return REPEAT.liveStopping;
      case 'finished':
        return REPEAT.liveFinished(live.completed);
      case 'stopped':
        return REPEAT.liveStopped(live.completed, live.total);
      case 'failed':
        return REPEAT.liveFailed;
      default:
        return REPEAT.liveRunning(live.probes.length, live.repeat);
    }
  });

  const readout = $derived(
    phase === 'stopped' || phase === 'stopping' ? REPEAT.liveStoppedReadout : REPEAT.liveReadout,
  );
</script>

{#if live}
  <div data-testid="repeat-live" data-state={phase} in:fly={{ y: 6, duration: 180 }}>
    <Panel eyebrow={REPEAT.liveEyebrow(live.model)} {title} {readout}>
      {#snippet actions()}
        {#if !running}
          <button
            type="button"
            class={BTN.ghost}
            title={REPEAT.closeWhy}
            onclick={() => repeat.dismiss()}
            data-testid="repeat-live-close"
          >
            <X class="h-3.5 w-3.5" aria-hidden="true" />
            {REPEAT.close}
          </button>
        {/if}
      {/snippet}

      <p class="sr-only" aria-live="polite">{title}</p>

      <StreamProgress
        label={REPEAT.progress}
        completed={live.completed}
        total={live.total}
        failed={live.failed}
        onCancel={phase === 'running' ? () => void repeat.cancel() : undefined}
      />

      {#if live.error}
        <p class="text-xs text-danger" role="alert" data-testid="repeat-live-error">{live.error}</p>
      {/if}

      <ul class="flex flex-col divide-y divide-border rounded-md border border-border">
        {#each live.probes as row, i (i)}
          <li
            class="grid gap-x-4 gap-y-1.5 px-3 py-2.5 sm:grid-cols-[minmax(0,11rem)_1fr]"
            data-testid="repeat-live-row"
            data-state={row.state}
            data-probe-name={row.name}
          >
            <div class="flex min-w-0 items-baseline gap-2">
              <span class="font-mono text-[11px] tabular-nums text-text4"
                >{String(i + 1).padStart(2, '0')}</span
              >
              <span
                class="truncate text-[13px] {row.state === 'waiting' ? 'text-text3' : 'text-text'}"
                >{row.name}</span
              >
              <span class="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-text4 sm:hidden"
                >{row.cells.length}/{row.repeat}</span
              >
            </div>
            {#if row.state === 'failed'}
              <p class="text-xs text-danger">
                {REPEAT.probeFailed(friendlyError(row.error ?? '').message)}
              </p>
            {:else}
              <div class="flex min-w-0 items-center gap-3">
                <div class="min-w-0 flex-1">
                  <RepeatTape
                    cells={row.cells}
                    total={row.repeat}
                    live={row.state === 'running' && running}
                    label={REPEAT.tapeLabel(row.name, row.cells.length, row.repeat)}
                  />
                </div>
                <span
                  class="hidden shrink-0 font-mono text-[11px] tabular-nums text-text4 sm:inline"
                >
                  {#if row.state === 'waiting'}
                    {REPEAT.probeWaiting}
                  {:else if row.state === 'stopped'}
                    {REPEAT.probeStopped}
                  {:else}
                    {row.cells.length}/{row.repeat}
                  {/if}
                </span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </Panel>
  </div>
{/if}
