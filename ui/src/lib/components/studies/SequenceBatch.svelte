<!--
  Sequences, "Batch" (brief 8.4): one sequence per probe with the same
  strategy. Fields: Strategy; Probes (ProbePicker over the session's probes);
  Mode "Whittle each probe" (`whittle`) or "Run each probe at one depth"
  (`fixed_n`); Warmup turns (`max_warmup_turns`); Depth when fixed (0 to 20,
  sent as `fixed_n`, 0 kept). "Estimate the cost" creates the batch and asks
  for its estimate; changing any field afterwards drops the estimate (the next
  estimate makes a new batch row). "Start the batch" streams `seqbatch:{id}`;
  each finished probe adds a row: "{probe}: threshold {n} turns" or
  "{probe}: {badge}".
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Calculator, Play, RotateCcw } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import ProbePicker from '$lib/components/ProbePicker.svelte';
  import StreamProgress from '$lib/components/StreamProgress.svelte';
  import type { PickerProbe } from '$lib/components/probe-picker';
  import { SCREENS } from '$lib/copy/screens';
  import { SEQUENCES as S } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { probes } from '$lib/stores/probe.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import {
    DEPTH_DEFAULT,
    DEPTH_MAX,
    DEPTH_MIN,
    WARMUP_DEFAULT,
    WARMUP_MAX,
    WARMUP_MIN,
    batchKey,
    clampDepth,
    formatCost,
    pickStrategy,
    strategyOption,
    type BatchForm,
    type BatchMode,
  } from './sequences';
  import { sequences } from './sequences.svelte';

  interface Props {
    sessionId: number;
  }

  let { sessionId }: Props = $props();

  const uid = $props.id();

  const list = $derived<PickerProbe[]>(probes.sessionId === sessionId ? probes.list : []);
  const strategies = $derived(sequences.strategies);

  let strategyId = $state<number | null>(null);
  let picked = $state<Set<number>>(new Set());
  let mode = $state<BatchMode>('whittle');
  let warmup = $state(WARMUP_DEFAULT);
  let depth = $state<number | string>(DEPTH_DEFAULT);

  $effect(() => {
    const listed = strategies;
    untrack(() => (strategyId = pickStrategy(listed, strategyId)));
  });

  // Drop picks that left the session's list.
  $effect(() => {
    const ids = new Set(list.map((p) => p.id));
    untrack(() => {
      const kept = new Set([...picked].filter((id) => ids.has(id)));
      if (kept.size !== picked.size) picked = kept;
    });
  });

  const form = $derived<BatchForm>({
    strategyId,
    probeIds: [...picked],
    mode,
    maxWarmup: warmup,
    depth: clampDepth(depth),
  });

  const live = $derived(sequences.batchLive);
  const running = $derived(sequences.batchRunning);
  const estimate = $derived(sequences.estimate);
  const fits = $derived(sequences.estimateFits(form));
  const stale = $derived(estimate !== null && !fits && !live);
  const cost = $derived(estimate ? formatCost(estimate.estimated_cost_usd, S.costUnder) : null);
  const locked = $derived(running);
  const canEstimate = $derived(
    !locked && !sequences.estimating && strategyId !== null && picked.size > 0 && !!batchKey(form),
  );

  const title = $derived.by(() => {
    if (!live) return '';
    switch (live.phase) {
      case 'finished':
        return S.batchFinished(live.completed);
      case 'stopped':
        return S.batchStopped(live.completed, live.total);
      case 'failed':
        return S.batchFailed;
      default:
        return S.batchRunning(live.completed, live.total);
    }
  });

  function nameOf(sequenceId: number | null): string {
    const seq = sequenceId === null ? null : sequences.sequenceById(sequenceId);
    if (!seq) return S.probeFallback(sequenceId ?? 0);
    return probes.list.find((p) => p.id === seq.probe_id)?.name ?? S.probeFallback(seq.probe_id);
  }

  function rowText(r: NonNullable<typeof live>['rows'][number]): string {
    if (r.error) return S.rowFailed(r.name, friendlyError(r.error).message);
    if (r.mode === 'whittle')
      return r.thresholdAt === null
        ? S.rowNoThreshold(r.name)
        : S.rowThreshold(r.name, r.thresholdAt);
    return `${r.name}:`;
  }
</script>

<Panel eyebrow={S.batchEyebrow} title={S.batchTitle} readout={SCREENS['sequences.batch']}>
  <div
    class="flex flex-col gap-4"
    data-testid="sequence-batch"
    data-batch-id={sequences.batch?.id ?? ''}
    data-state={live?.phase ?? (fits ? 'estimated' : 'idle')}
  >
    <fieldset class="flex flex-col gap-4" disabled={locked}>
      <div>
        <label for="batch-strategy-{uid}" class={LABEL}>{S.strategy}</label>
        <select
          id="batch-strategy-{uid}"
          class={FIELD}
          bind:value={strategyId}
          data-testid="batch-strategy"
        >
          {#each strategies as s (s.id)}
            <option value={s.id}>{strategyOption(s)}</option>
          {/each}
        </select>
      </div>

      <div>
        <p class={LABEL}>{S.batchProbes}</p>
        {#if list.length === 0 && probes.loaded}
          <p
            class="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-text4"
          >
            {S.noProbes}
          </p>
        {:else}
          <div data-testid="batch-probes">
            <ProbePicker
              probes={list}
              selected={picked}
              onChange={(next) => (picked = next)}
              height="10rem"
            />
          </div>
        {/if}
      </div>

      <fieldset>
        <legend class={LABEL}>{S.mode}</legend>
        <div class="grid gap-1.5 sm:grid-cols-2">
          {#each [['whittle', S.batchModeWhittle], ['fixed_n', S.batchModeFixed]] as [value, text] (value)}
            <label
              class="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs text-text transition-colors {mode ===
              value
                ? 'border-accent/60 bg-accent/5'
                : 'border-border hover:border-borderStrong'}"
            >
              <input
                type="radio"
                name="batch-mode-{uid}"
                {value}
                bind:group={mode}
                class="h-3.5 w-3.5 accent-accent"
                data-testid="batch-mode-{value}"
              />
              {text}
            </label>
          {/each}
        </div>
      </fieldset>

      <div class="grid gap-3 {mode === 'fixed_n' ? 'sm:grid-cols-[1fr_7rem]' : ''}">
        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label for="batch-warmup-{uid}" class={LABEL}>{S.batchWarmup}</label>
            <output
              for="batch-warmup-{uid}"
              class="font-mono text-xs tabular-nums text-accentText"
              data-testid="batch-warmup-value">{S.warmupValue(warmup)}</output
            >
          </div>
          <input
            id="batch-warmup-{uid}"
            type="range"
            min={WARMUP_MIN}
            max={WARMUP_MAX}
            step="1"
            bind:value={warmup}
            class="w-full accent-accent"
            data-testid="batch-warmup"
          />
          <p class={HINT}>{S.batchWarmupHint}</p>
        </div>
        {#if mode === 'fixed_n'}
          <div in:fly={{ x: 6, duration: 140 }}>
            <label for="batch-depth-{uid}" class={LABEL}>{S.depth}</label>
            <input
              id="batch-depth-{uid}"
              type="number"
              min={DEPTH_MIN}
              max={DEPTH_MAX}
              step="1"
              class="{FIELD} font-mono tabular-nums"
              bind:value={depth}
              onblur={() => (depth = clampDepth(depth))}
              aria-describedby="batch-depth-hint-{uid}"
              data-testid="batch-depth"
            />
          </div>
          <p id="batch-depth-hint-{uid}" class="-mt-1 {HINT} sm:col-span-2">{S.depthHint}</p>
        {/if}
      </div>
    </fieldset>

    {#if estimate && (fits || live)}
      <div
        class="rounded-md border border-accent/30 bg-accent/5 px-3 py-2.5"
        in:fly={{ y: 4, duration: 160 }}
        data-testid="batch-estimate"
      >
        <p class="text-sm text-text">
          {S.estimateLine(estimate.estimated_runs, estimate.estimated_total_turns)}
          <span
            class="font-mono font-semibold tabular-nums text-accentText"
            data-testid="estimate-cost">{cost}</span
          >.
        </p>
        <p
          class="mt-0.5 font-mono text-[11px] tabular-nums text-text3"
          data-testid="estimate-warmup"
        >
          {sequences.batchMode === 'fixed_n'
            ? S.estimateDepth(estimate.max_turns)
            : S.estimateWhittle(estimate.max_turns)}
        </p>
      </div>
    {:else if stale}
      <p class="text-xs text-warn" role="status" data-testid="batch-estimate-stale">
        {S.estimateStale}
      </p>
    {/if}

    {#if live}
      <div class="flex flex-col gap-3" data-testid="batch-live" data-state={live.phase}>
        <p class="sr-only" aria-live="polite">{title}</p>
        <StreamProgress
          label={title}
          completed={live.completed}
          total={live.total}
          failed={live.failed}
          onCancel={running ? () => void sequences.stopBatch() : undefined}
        />
        {#if live.phase === 'stopped'}
          <p class={HINT}>{S.batchStoppedNote}</p>
        {/if}
        {#if live.rows.length}
          <ul class="flex flex-col divide-y divide-border rounded-md border border-border">
            {#each live.rows as r, i (i)}
              <li
                class="flex items-center gap-2 px-3 py-2 text-[13px]"
                in:fly={{ y: 4, duration: 160 }}
                data-testid="batch-row"
                data-sequence-id={r.sequenceId ?? ''}
              >
                <span class="font-mono text-[11px] tabular-nums text-text4"
                  >{String(i + 1).padStart(2, '0')}</span
                >
                <span class="min-w-0 truncate {r.error ? 'text-danger' : 'text-text'}"
                  >{rowText(r)}</span
                >
                {#if !r.error && r.mode === 'fixed_n'}
                  <ClassBadge value={r.cls} size="sm" />
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <p class="text-xs {picked.size ? 'text-text3' : 'text-text4'}" aria-live="polite">
        {picked.size ? '' : S.pickProbes}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        {#if live && !running}
          <button
            type="button"
            class={BTN.ghost}
            onclick={() => sequences.resetBatch()}
            data-testid="batch-new"
          >
            <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
            {S.newBatch}
          </button>
        {/if}
        <button
          type="button"
          class={BTN.secondary}
          title={S.estimateWhy}
          disabled={!canEstimate}
          onclick={() => void sequences.estimateBatch(sessionId, form)}
          data-testid="batch-estimate-button"
        >
          <Calculator class="h-3.5 w-3.5" aria-hidden="true" />
          {sequences.estimating ? S.estimating : S.estimate}
        </button>
        <button
          type="button"
          class={BTN.primary}
          title={S.startWhy}
          disabled={!fits || !!live || sequences.estimating}
          onclick={() => void sequences.startBatch(nameOf)}
          data-testid="batch-start"
        >
          <Play class="h-3.5 w-3.5" aria-hidden="true" />
          {S.start}
        </button>
      </div>
    </div>
  </div>
</Panel>
