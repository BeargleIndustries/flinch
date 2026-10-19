<!--
  Sequences, Results tab (brief 8.4, D21, D30, I20, plan T26). A picker over
  the session's completed (and failed) sequences, defaulting to the one
  "Show results" picked, else the newest; the picked sequence's Threshold,
  Turn by turn and Runs panels; then two panels over the session's completed
  sequences only: "Thresholds across probes" with a strategy filter, and
  "Strategy effectiveness". A note names the sequences left out.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Info, RotateCw } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import { statusWord } from '$lib/components/status-chip';
  import { SCREENS } from '$lib/copy/screens';
  import { SEQUENCE_RESULTS as R, SEQUENCES as S } from '$lib/copy/studies';
  import { probes } from '$lib/stores/probe.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import {
    completedEffectiveness,
    defaultPick,
    excludedCounts,
    resultChoices,
    strategyChoices,
    successShare,
    thresholdWidth,
  } from './sequence-results';
  import { sequenceResults } from './sequence-results.svelte';
  import SequenceResultsDetail from './SequenceResultsDetail.svelte';
  import { latestRun, strategyTitle, type Sequence } from './sequences';
  import { sequences } from './sequences.svelte';

  interface Props {
    sessionId: number;
  }

  let { sessionId }: Props = $props();

  let detailEl: HTMLElement | null = $state(null);

  $effect(() => {
    untrack(() => {
      if (!sequences.strategiesLoaded) void sequences.loadStrategies();
    });
  });

  $effect(() => {
    const id = sessionId;
    untrack(() => void sequenceResults.loadSession(id));
  });

  const listReady = $derived(sequences.sessionId === sessionId && sequences.loaded);
  const choices = $derived(listReady ? resultChoices(sequences.list) : []);
  const pickedId = $derived(defaultPick(choices, sequences.resultsFor));
  const picked = $derived(pickedId === null ? null : sequences.sequenceById(pickedId));

  // The picked sequence's reads.
  $effect(() => {
    const id = pickedId;
    if (id === null) return;
    untrack(() => void sequenceResults.loadSequence(id));
  });

  const probeName = (id: number) =>
    probes.list.find((p) => p.id === id)?.name ?? S.probeFallback(id);
  const strategyName = (id: number) => {
    const s = sequences.strategyById(id);
    return s ? strategyTitle(s.name) : S.strategyFallback(id);
  };
  const optionText = (s: Sequence) =>
    s.status === 'completed'
      ? R.pickOption(probeName(s.probe_id), strategyName(s.strategy_id), s.id)
      : R.pickOptionStatus(
          probeName(s.probe_id),
          strategyName(s.strategy_id),
          s.id,
          statusWord(s.status).toLowerCase(),
        );

  function pick(id: number) {
    sequences.resultsFor = id;
  }

  function showAbove(id: number) {
    pick(id);
    detailEl?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ── Session level (completed sequences only, I20) ──────────────

  const ready = $derived(sequenceResults.sessionLoaded && sequenceResults.sessionId === sessionId);
  const filterChoices = $derived(strategyChoices(sequenceResults.thresholds));
  const rows = $derived(
    sequenceResults.filterId === null
      ? sequenceResults.thresholds
      : (sequenceResults.filtered ?? []),
  );
  const effectRows = $derived(
    completedEffectiveness(
      sequenceResults.effectiveness,
      sequenceResults.leftOut,
      sequenceResults.thresholds,
    ),
  );
  const leftOutParts = $derived(
    excludedCounts(sequenceResults.excluded)
      .map((c) => R.excludedPart(c.count, statusWord(c.status).toLowerCase()))
      .join(', '),
  );

  function onFilter(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    void sequenceResults.setFilter(v === '' ? null : Number(v));
  }

  function runsOf(id: number): number | null {
    return sequences.summaries[id]?.summary?.total_runs ?? null;
  }

  /** The threshold run's class when there is one, else the newest run's. */
  function resultOf(id: number, thresholdCls: string | null): string | null {
    if (thresholdCls) return thresholdCls;
    const runs = sequences.summaries[id]?.runs;
    return (runs && latestRun(runs)?.probe_classification) ?? null;
  }

  const th = 'px-3 py-2 text-left font-medium';
  const td = 'px-3 py-2 align-middle';
</script>

<div
  class="flex flex-col gap-4"
  data-testid="sequence-results"
  data-sequence-id={pickedId ?? ''}
  aria-busy={!listReady || !ready}
>
  <!-- The picker -->
  <div
    class="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3"
  >
    <div class="min-w-[16rem] max-w-md flex-1">
      <label class={LABEL} for="sequence-results-pick">{R.pickLabel}</label>
      <select
        id="sequence-results-pick"
        class={FIELD}
        disabled={!listReady || choices.length === 0}
        value={pickedId === null ? '' : String(pickedId)}
        onchange={(e) => pick(Number((e.currentTarget as HTMLSelectElement).value))}
        data-testid="results-pick"
      >
        {#if !listReady}
          <option value="">{R.reading}</option>
        {/if}
        {#each choices as s (s.id)}
          <option value={String(s.id)}>{optionText(s)}</option>
        {/each}
      </select>
      <p class="mt-1 {HINT}">{R.pickHint}</p>
    </div>
    {#if picked}
      <div class="flex flex-wrap items-center gap-2 pb-5" data-testid="results-picked">
        <StatusChip status={picked.status} />
        <span class="rounded border border-border px-1.5 py-px font-mono text-[10px] text-text3"
          >{S.modes[picked.mode] ?? picked.mode}</span
        >
        <span class="rounded border border-border px-1.5 py-px font-mono text-[10px] text-text3"
          >{S.warmupChip(picked.max_warmup_turns)}</span
        >
      </div>
    {/if}
  </div>

  {#if listReady && choices.length === 0}
    <div class="rounded-xl border border-dashed border-border" data-testid="results-none">
      <EmptyState
        title={R.noneTitle}
        body={R.noneBody}
        action={{ label: R.openRun, onClick: () => (sequences.tab = 'run') }}
      />
    </div>
  {:else if picked}
    <div bind:this={detailEl} class="scroll-mt-4">
      {#key picked.id}
        <SequenceResultsDetail seq={picked} />
      {/key}
    </div>
  {/if}

  <!-- Session level -->
  {#if sequenceResults.sessionError && !ready}
    <div class="flex items-center gap-3">
      <p class="text-xs text-danger" role="alert">{sequenceResults.sessionError}</p>
      <button
        type="button"
        class={BTN.secondary}
        onclick={() => void sequenceResults.loadSession(sessionId)}
      >
        <RotateCw class="h-3.5 w-3.5" aria-hidden="true" />
        {R.loadAgain}
      </button>
    </div>
  {/if}

  {#if ready && sequenceResults.excluded.length > 0}
    <p
      class="flex items-start gap-2 rounded-md border border-border bg-surface2/40 px-3 py-2 text-xs leading-snug text-text3"
      data-testid="results-excluded"
    >
      <Info class="mt-px h-3.5 w-3.5 shrink-0 text-text4" aria-hidden="true" />
      <span>{R.excluded(leftOutParts)}</span>
    </p>
  {/if}

  <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
    <Panel eyebrow={R.sessionEyebrow} title={R.acrossTitle} readout={R.acrossReadout}>
      {#snippet actions()}
        <label class="sr-only" for="threshold-filter">{R.filterLabel}</label>
        <select
          id="threshold-filter"
          class="{FIELD} w-auto py-1 text-xs"
          disabled={!ready || sequenceResults.filtering || filterChoices.length === 0}
          value={sequenceResults.filterId === null ? '' : String(sequenceResults.filterId)}
          onchange={onFilter}
          data-testid="threshold-filter"
        >
          <option value="">{R.filterAll}</option>
          {#each filterChoices as c (c.id)}
            <option value={String(c.id)}>{strategyTitle(c.name)}</option>
          {/each}
        </select>
      {/snippet}

      {#if !ready}
        <p class="text-xs text-text4">{R.reading}</p>
      {:else if rows.length === 0 && !sequenceResults.filtering}
        <p class="text-xs text-text4" data-testid="thresholds-empty">
          {sequenceResults.filterId === null ? R.acrossEmpty : R.filterEmpty}
        </p>
      {:else}
        <div
          class="overflow-x-auto rounded-md border border-border transition-opacity {sequenceResults.filtering
            ? 'opacity-50'
            : ''}"
          aria-busy={sequenceResults.filtering}
        >
          <table
            class="w-full border-collapse text-left text-xs"
            data-testid="thresholds-table"
            data-filter={sequenceResults.filterId ?? ''}
          >
            <thead>
              <tr class="bg-surface2/60 text-[10px] uppercase tracking-widest text-text4">
                <th scope="col" class={th}>{R.colProbe}</th>
                <th scope="col" class={th}>{R.colDomain}</th>
                <th scope="col" class={th}>{R.colStrategy}</th>
                <th scope="col" class="{th} min-w-[9rem]">{R.colThreshold}</th>
                <th scope="col" class="{th} text-right">{R.colRuns}</th>
                <th scope="col" class={th}>{R.colResult}</th>
              </tr>
            </thead>
            <tbody>
              {#each rows as row (row.sequence_id)}
                {@const runs = runsOf(row.sequence_id)}
                {@const isPicked = row.sequence_id === pickedId}
                <tr
                  class="border-t border-border transition-colors {isPicked
                    ? 'bg-accent/5'
                    : 'hover:bg-surface2/40'}"
                  data-testid="threshold-row"
                  data-sequence-id={row.sequence_id}
                  data-strategy-id={row.strategy_id}
                >
                  <td class={td}>
                    <button
                      type="button"
                      class="text-left font-medium text-text underline-offset-2 hover:text-accentText hover:underline focus:outline-none focus-visible:underline"
                      aria-label={R.showSequence(row.probe_name, row.sequence_id)}
                      aria-current={isPicked ? 'true' : undefined}
                      onclick={() => showAbove(row.sequence_id)}
                      data-testid="threshold-cell-probe">{row.probe_name}</button
                    >
                  </td>
                  <td class="{td} text-text3">{row.domain || R.noDomain}</td>
                  <td class="{td} text-text2" data-testid="threshold-cell-strategy"
                    >{strategyTitle(row.strategy_name)}</td
                  >
                  <td class={td}>
                    <div class="flex items-center gap-2">
                      <span
                        class="w-14 shrink-0 font-mono tabular-nums {row.threshold_turns === null
                          ? 'text-text4'
                          : 'text-text'}"
                        data-testid="threshold-cell-turns"
                        >{row.threshold_turns === null
                          ? R.noThreshold
                          : R.turns(row.threshold_turns)}</span
                      >
                      <span
                        class="block h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-surface2"
                        aria-hidden="true"
                      >
                        <span
                          class="block h-full rounded-full bg-accentHover transition-[width] duration-500 ease-out"
                          style:width="{thresholdWidth(row.threshold_turns, rows)}%"
                        ></span>
                      </span>
                    </div>
                  </td>
                  <td
                    class="{td} text-right font-mono tabular-nums text-text2"
                    data-testid="threshold-cell-runs">{runs ?? ''}</td
                  >
                  <td class={td}>
                    <ClassBadge
                      value={resultOf(row.sequence_id, row.probe_classification)}
                      size="sm"
                    />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Panel>

    <Panel eyebrow={R.sessionEyebrow} title={R.effectTitle} readout={R.effectReadout}>
      {#if !ready}
        <p class="text-xs text-text4">{R.reading}</p>
      {:else if effectRows.length === 0}
        <p class="text-xs text-text4" data-testid="effectiveness-empty">{R.effectEmpty}</p>
      {:else}
        <ul class="flex flex-col gap-3" data-testid="effectiveness">
          {#each effectRows as row (row.id)}
            {@const share = successShare(row)}
            <li
              class="flex flex-col gap-1.5"
              data-testid="effectiveness-row"
              data-strategy-id={row.id}
              data-count={row.sequence_count}
              data-success={row.success_count}
            >
              <div class="flex items-baseline justify-between gap-3">
                <span class="min-w-0 truncate text-[13px] font-medium text-text"
                  >{strategyTitle(row.name)}</span
                >
                {#if row.category}
                  <span
                    class="shrink-0 rounded border border-border px-1.5 py-px font-mono text-[10px] text-text3"
                    >{row.category}</span
                  >
                {/if}
              </div>
              <span
                class="flex h-2 overflow-hidden rounded-full bg-surface2"
                role="img"
                aria-label={SCREENS['sequences.strategies'](
                  row.success_count,
                  row.sequence_count,
                  row.avg_threshold,
                )}
              >
                <span
                  class="block h-full rounded-full bg-clsComplied transition-[width] duration-500 ease-out"
                  style:width="{share}%"
                ></span>
              </span>
              <p class="text-xs text-text3" data-testid="effectiveness-line">
                {SCREENS['sequences.strategies'](
                  row.success_count,
                  row.sequence_count,
                  row.avg_threshold,
                )}
              </p>
            </li>
          {/each}
        </ul>
      {/if}
    </Panel>
  </div>
</div>
