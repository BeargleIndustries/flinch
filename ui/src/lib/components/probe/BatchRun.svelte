<!--
  Batch run (brief 7.8): "Running all probes" with StreamProgress ("{completed}
  of {total}", failed count, Cancel) and a table of Probe, Domain, Result that
  fills as `progress` and `error` events land. Rows link to the saved run.
  On `complete` the title becomes "Finished: {completed} of {total}" or
  "Stopped after {completed} of {total}", a tally of the results shows, and
  Back returns to the idle view. State lives in batch.svelte.ts, so the batch
  keeps running (and the strip keeps showing it) when you leave /probe.
-->
<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import { ArrowLeft, Ban } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import StreamProgress from '$lib/components/StreamProgress.svelte';
  import { PROBE } from '$lib/copy/probe';
  import { batch } from './batch.svelte';
  import { tally } from './batch-rows';
  import { BTN } from './styles';

  const phase = $derived(batch.phase);
  const live = $derived(batch.live);
  const rows = $derived(batch.rows);
  const results = $derived(tally(rows));

  const title = $derived.by(() => {
    switch (phase) {
      case 'finished':
        return PROBE.batchFinished(batch.completed, batch.total);
      case 'stopped':
        return PROBE.batchStopped(batch.completed, batch.total);
      case 'failed':
        return PROBE.batchFailedTitle;
      case 'stopping':
        return PROBE.batchStopping;
      default:
        return batch.label ?? PROBE.batchTitle;
    }
  });

  const readout = $derived(
    phase === 'stopped'
      ? PROBE.batchStoppedReadout
      : phase === 'finished'
        ? PROBE.batchFinishedReadout
        : live
          ? PROBE.batchReadout
          : null,
  );

  /**
   * Without a planned table (the rail's list did not match the batch), one
   * unnamed row stands for the probe in flight, and for the cancelled one.
   */
  const placeholder = $derived.by(() => {
    if (rows.length >= batch.total) return null;
    if (rows.some((r) => r.state === 'next' || r.state === 'cancelled')) return null;
    if (live) return 'next' as const;
    if (phase === 'stopped') return 'cancelled' as const;
    return null;
  });

  const cell = 'px-3 py-2 align-middle';
  /** The probe in flight: a faint accent wash and a 2px accent rule on the left edge. */
  const NEXT_ROW = 'bg-accent/5 shadow-[inset_2px_0_0_0_rgb(var(--accent))]';
</script>

<div
  data-testid="batch-run"
  data-state={phase}
  data-batch-id={batch.batchId ?? ''}
  in:fly={{ y: 6, duration: 180 }}
>
  <Panel eyebrow={PROBE.batchEyebrow(batch.delayMs)} {title} {readout}>
    {#snippet actions()}
      {#if !live}
        <button
          type="button"
          class={BTN.secondary}
          title={PROBE.batchBackWhy}
          data-testid="batch-back"
          onclick={() => batch.dismiss()}
        >
          <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
          {PROBE.batchBack}
        </button>
      {/if}
    {/snippet}

    <p class="sr-only" aria-live="polite">{title}</p>

    <StreamProgress
      label={PROBE.batchProgress}
      completed={batch.completed}
      total={batch.total}
      failed={batch.failed}
      onCancel={phase === 'starting' || phase === 'running' ? () => void batch.cancel() : undefined}
    />

    {#if batch.error}
      <p class="text-xs text-danger" role="alert" data-testid="batch-error">{batch.error}</p>
    {/if}

    {#if !live && (results.length > 0 || batch.failed > 0)}
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-2"
        data-testid="batch-tally"
        in:fly={{ y: 4, duration: 200 }}
      >
        <span class="text-[10px] font-medium uppercase tracking-widest text-text4"
          >{PROBE.batchTally}</span
        >
        {#each results as r (r.cls)}
          <span class="inline-flex items-center gap-1.5">
            <ClassBadge value={r.cls} size="sm" />
            <span class="font-mono text-xs tabular-nums text-text2">×{r.count}</span>
          </span>
        {/each}
        {#if batch.failed > 0}
          <span class="font-mono text-xs tabular-nums text-danger"
            >{PROBE.batchFailedCount(batch.failed)}</span
          >
        {/if}
      </div>
    {/if}

    {#if rows.length > 0 || placeholder}
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr class="bg-surface2/60 text-[10px] uppercase tracking-widest text-text4">
              <th scope="col" class="{cell} w-8 font-medium"><span class="sr-only">#</span></th>
              <th scope="col" class="{cell} font-medium">{PROBE.batchColProbe}</th>
              <th scope="col" class="{cell} font-medium">{PROBE.batchColDomain}</th>
              <th scope="col" class="{cell} w-40 font-medium">{PROBE.batchColResult}</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row, i (row.probeId)}
              <tr
                data-testid="batch-row"
                data-state={row.state}
                data-probe-name={row.name}
                class="border-t border-border transition-colors duration-300 {row.state === 'next'
                  ? NEXT_ROW
                  : ''}"
                class:opacity-60={row.state === 'skipped'}
                in:fly={{ y: 4, duration: 160 }}
              >
                <td class="{cell} font-mono tabular-nums text-text4">
                  {String(i + 1).padStart(2, '0')}
                </td>
                <td class="{cell} max-w-0 truncate">
                  {#if row.runId !== null}
                    <a
                      href="/probe/runs/{row.runId}"
                      class="text-text underline-offset-2 hover:text-accentText hover:underline focus:outline-none focus-visible:underline"
                      aria-label={PROBE.batchOpenRun(row.name)}>{row.name}</a
                    >
                  {:else}
                    <span
                      class={row.state === 'cancelled'
                        ? 'text-text3 line-through decoration-text4'
                        : 'text-text2'}>{row.name}</span
                    >
                  {/if}
                </td>
                <td class="{cell} font-mono text-[11px] text-text3">{row.domain ?? ''}</td>
                <td class={cell} data-testid="batch-result">
                  {#if row.state === 'done'}
                    <span class="inline-flex" in:scale={{ start: 0.7, duration: 220 }}>
                      <ClassBadge value={row.cls} size="sm" />
                    </span>
                  {:else if row.state === 'failed'}
                    <span class="text-danger" title={row.error ?? ''}
                      >{PROBE.batchFailed(row.error ?? '')}</span
                    >
                  {:else if row.state === 'next'}
                    <span class="inline-flex items-center gap-2 text-accentText">
                      <span class="relative flex h-2 w-2" aria-hidden="true">
                        <span
                          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60"
                        ></span>
                        <span class="relative inline-flex h-2 w-2 rounded-full bg-accent"></span>
                      </span>
                      {PROBE.batchNext}
                    </span>
                  {:else if row.state === 'cancelled'}
                    <span class="inline-flex items-center gap-1.5 text-text3">
                      <Ban class="h-3.5 w-3.5" aria-hidden="true" />
                      {PROBE.batchCancelled}
                    </span>
                  {:else if row.state === 'skipped'}
                    <span class="text-text4">{PROBE.batchNotRun}</span>
                  {:else}
                    <span class="text-text4">{PROBE.batchWaiting}</span>
                  {/if}
                </td>
              </tr>
            {/each}
            {#if placeholder}
              <tr
                data-testid="batch-row"
                data-state={placeholder}
                data-probe-name=""
                class="border-t border-border {placeholder === 'next' ? NEXT_ROW : ''}"
              >
                <td class="{cell} font-mono tabular-nums text-text4">
                  {String(rows.length + 1).padStart(2, '0')}
                </td>
                <td class="{cell} text-text3">
                  {PROBE.batchPlaceholder(rows.length + 1, batch.total)}
                </td>
                <td class={cell}></td>
                <td class={cell} data-testid="batch-result">
                  {#if placeholder === 'next'}
                    <span class="text-accentText">{PROBE.batchNext}</span>
                  {:else}
                    <span class="inline-flex items-center gap-1.5 text-text3">
                      <Ban class="h-3.5 w-3.5" aria-hidden="true" />
                      {PROBE.batchCancelled}
                    </span>
                  {/if}
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </Panel>
</div>
