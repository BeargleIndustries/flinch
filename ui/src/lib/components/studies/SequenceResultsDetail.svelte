<!--
  Sequences Results, the picked sequence (brief 8.4): three panels.
  - Threshold: one bar per run (height the warmup turns, colour the probe
    class, the threshold run outlined in accentHover, a dashed line at its
    height) and the readout by case.
  - Turn by turn: a row per run "N={warmup}", one square per model reply
    coloured by its badge with W, S or P, and the probe badge at the end.
  - Runs: a row per run that opens its transcript (GET
    /api/sequence-runs/{id}/turns) in the same thread the Run tab draws.
-->
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { ChevronRight, RotateCw } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import { CLS_SPEC } from '$lib/cls';
  import { SEQUENCE_RESULTS as R, SEQUENCES as S } from '$lib/copy/studies';
  import { BTN } from '../probe/styles';
  import {
    isFound,
    orderedRuns,
    thresholdBars,
    thresholdCase,
    turnStrip,
    type StripCell,
  } from './sequence-results';
  import { sequenceResults } from './sequence-results.svelte';
  import SequenceThread from './SequenceThread.svelte';
  import type { Sequence } from './sequences';
  import { sequences } from './sequences.svelte';

  interface Props {
    seq: Sequence;
  }

  let { seq }: Props = $props();

  const detail = $derived(sequenceResults.details[seq.id] ?? null);
  const loading = $derived(!detail || (detail.loading && detail.whittling.length === 0));
  const summary = $derived(sequences.summaries[seq.id] ?? null);
  const whittled = $derived(sequences.whittles[seq.id]?.result ?? null);
  const refusedAtMax = $derived(
    !!whittled && whittled.threshold_found && whittled.threshold_at === null,
  );
  const tcase = $derived(
    thresholdCase(detail?.whittling ?? [], seq.max_warmup_turns, refusedAtMax),
  );
  const bars = $derived(thresholdBars(detail?.whittling ?? [], seq.max_warmup_turns));
  const foundBar = $derived(bars.find((b) => b.found) ?? null);
  const strips = $derived(detail?.strips ?? []);
  const runs = $derived(orderedRuns(summary?.runs ?? []));

  const readout = $derived.by(() => {
    switch (tcase.kind) {
      case 'found':
        return R.found(tcase.n);
      case 'zero':
        return S.whittleZero;
      case 'none':
        return S.whittleNone(tcase.max);
      case 'failed':
        return S.whittleFailed;
      case 'single':
        return R.single(tcase.warmup);
      case 'unwhittled':
        return R.unwhittled(tcase.runs);
      default:
        return R.noRuns;
    }
  });
  const headline = $derived(
    tcase.kind === 'found' ? String(tcase.n) : tcase.kind === 'zero' ? '0' : null,
  );

  let open = $state<Record<number, boolean>>({});

  function toggle(runId: number) {
    const next = !open[runId];
    open = { ...open, [runId]: next };
    if (next) void sequenceResults.loadRunTurns(runId);
  }

  function cellTitle(c: StripCell): string {
    const word = CLS_SPEC[c.cls].word;
    if (c.type === 'setup') return R.cellSetup(word);
    if (c.type === 'probe') return R.cellProbe(word);
    return R.cellWarmup(c.warmup ?? 1, word);
  }

  const chip = 'rounded border px-1.5 py-px font-mono text-[10px]';
</script>

<div class="flex flex-col gap-4" data-testid="sequence-detail" aria-busy={loading}>
  {#if detail?.error && !detail.loading}
    <div class="flex items-center gap-3">
      <p class="text-xs text-danger" role="alert">{detail.error}</p>
      <button
        type="button"
        class={BTN.secondary}
        onclick={() => void sequenceResults.loadSequence(seq.id)}
      >
        <RotateCw class="h-3.5 w-3.5" aria-hidden="true" />
        {R.loadAgain}
      </button>
    </div>
  {/if}

  <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    <!-- Threshold -->
    <Panel eyebrow={R.sequenceEyebrow} title={R.thresholdTitle} readout={R.thresholdReadout}>
      <div
        class="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-5"
        data-testid="threshold-panel"
        data-kind={tcase.kind}
      >
        <div class="flex min-w-[5.5rem] flex-col gap-1 pb-6">
          {#if loading}
            <span class="block h-12 w-12 animate-pulse rounded-md bg-surface2" aria-hidden="true"
            ></span>
          {:else if headline !== null}
            <span
              class="font-mono text-5xl font-semibold leading-none tracking-tight tabular-nums text-text"
              data-testid="threshold-headline">{headline}</span
            >
            <span class="text-[10px] uppercase tracking-widest text-text4"
              >{R.headlineCaption(Number(headline))}</span
            >
          {:else}
            <span
              class="font-mono text-2xl font-semibold leading-none text-text3"
              data-testid="threshold-headline">{R.noThreshold}</span
            >
          {/if}
        </div>

        <figure class="min-w-0" aria-label={R.barsLabel}>
          <div class="relative flex h-32 items-end gap-2 border-b border-borderStrong px-1">
            {#if foundBar}
              <span
                class="pointer-events-none absolute inset-x-0 border-t border-dashed border-accentHover/70"
                style:bottom="{foundBar.height}%"
                aria-hidden="true"
              ></span>
            {/if}
            {#each bars as b (b.key)}
              <div
                class="relative flex h-full max-w-14 flex-1 items-end"
                data-testid="threshold-bar"
                data-warmup={b.warmup}
                data-cls={b.cls}
                data-threshold={b.found}
                title={R.barTitle(b.warmup, CLS_SPEC[b.cls].word)}
                in:fly={{ y: 8, duration: 220 }}
              >
                <span
                  class="block w-full rounded-t-[3px] transition-[height] duration-500 ease-out {CLS_SPEC[
                    b.cls
                  ].glyphBg} {b.found
                    ? 'ring-2 ring-accentHover ring-offset-2 ring-offset-surface'
                    : ''} {b.failed ? 'opacity-40' : ''}"
                  style:height="{b.height}%"
                ></span>
                <span class="sr-only">{R.barTitle(b.warmup, CLS_SPEC[b.cls].word)}</span>
              </div>
            {/each}
          </div>
          <div class="flex gap-2 px-1 pt-1.5" aria-hidden="true">
            {#each bars as b (b.key)}
              <span
                class="max-w-14 flex-1 text-center font-mono text-[10px] tabular-nums {b.found
                  ? 'font-semibold text-accentText'
                  : 'text-text4'}">{R.barLabel(b.warmup)}</span
              >
            {/each}
          </div>
        </figure>
      </div>
      <p
        class="text-[13px] leading-relaxed {tcase.kind === 'found' || tcase.kind === 'zero'
          ? 'text-text'
          : 'text-text2'}"
        data-testid="threshold-readout"
      >
        {loading ? R.reading : readout}
      </p>
    </Panel>

    <!-- Turn by turn -->
    <Panel eyebrow={R.sequenceEyebrow} title={R.turnsTitle} readout={R.turnsReadout}>
      {#if loading}
        <p class="text-xs text-text4">{R.reading}</p>
      {:else if strips.length === 0}
        <p class="text-xs text-text4">{R.runsEmpty}</p>
      {:else}
        <ol class="flex flex-col divide-y divide-border" data-testid="turn-table">
          {#each strips as run (run.sequence_run_id)}
            {@const cells = turnStrip(run.turns)}
            <li
              class="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2"
              data-testid="turn-row"
              data-run-id={run.sequence_run_id}
              data-warmup={run.warmup_count}
            >
              <span class="font-mono text-[11px] tabular-nums text-text3"
                >{R.runLabel(run.warmup_count)}</span
              >
              {#if cells.length === 0}
                <span class="text-xs text-text4">{R.noReplies}</span>
              {:else}
                <ol class="flex flex-wrap gap-1" aria-label={R.stripLabel(run.warmup_count)}>
                  {#each cells as c (c.key)}
                    <li
                      class="flex h-6 w-6 items-center justify-center rounded-[4px] font-mono text-[10px] font-bold leading-none {CLS_SPEC[
                        c.cls
                      ].glyphBg} {CLS_SPEC[c.cls].glyphText} {c.type === 'probe'
                        ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface'
                        : c.type === 'setup'
                          ? 'ring-1 ring-warn/70 ring-offset-1 ring-offset-surface'
                          : ''}"
                      title={cellTitle(c)}
                      data-testid="turn-cell"
                      data-type={c.type}
                      data-cls={c.cls}
                    >
                      <span aria-hidden="true">{c.letter}</span>
                      <span class="sr-only">{cellTitle(c)}</span>
                    </li>
                  {/each}
                </ol>
              {/if}
              <span class="flex items-center gap-1.5" data-testid="turn-row-probe">
                <span class="text-[10px] uppercase tracking-widest text-text4">{R.probeAt}</span>
                <ClassBadge value={run.probe_classification} size="sm" />
              </span>
            </li>
          {/each}
        </ol>
      {/if}
    </Panel>
  </div>

  <!-- Runs -->
  <Panel eyebrow={R.sequenceEyebrow} title={R.runsTitle} readout={R.runsReadout}>
    {#if !summary}
      <p class="text-xs text-text4">{R.reading}</p>
    {:else if runs.length === 0}
      <p class="text-xs text-text4">{R.runsEmpty}</p>
    {:else}
      <ul class="flex flex-col gap-2" data-testid="run-list">
        {#each runs as run (run.id)}
          {@const isOpen = !!open[run.id]}
          {@const rt = sequenceResults.runTurns[run.id] ?? null}
          <li
            class="rounded-md border bg-bg/40 transition-colors {isOpen
              ? 'border-borderStrong'
              : 'border-border'}"
            data-testid="run-row"
            data-run-id={run.id}
            data-warmup={run.warmup_count}
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-surface2/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
              aria-expanded={isOpen}
              aria-controls="run-turns-{run.id}"
              aria-label={isOpen ? R.runHide(run.warmup_count) : R.runShow(run.warmup_count)}
              onclick={() => toggle(run.id)}
              data-testid="run-toggle"
            >
              <ChevronRight
                class="h-3.5 w-3.5 shrink-0 text-text4 transition-transform duration-150 {isOpen
                  ? 'rotate-90'
                  : ''}"
                aria-hidden="true"
              />
              <span class="w-12 font-mono text-[11px] tabular-nums text-text2"
                >{R.runLabel(run.warmup_count)}</span
              >
              <ClassBadge value={run.probe_classification} size="sm" />
              {#if isFound(run.threshold_found)}
                <span
                  class="{chip} border-accentHover/60 bg-accent/10 text-accentText"
                  title={R.thresholdChipWhy}
                  data-testid="run-threshold-chip">{R.thresholdChip}</span
                >
              {/if}
              {#if run.status !== 'completed'}
                <span class="ml-auto"><StatusChip status={run.status} /></span>
              {/if}
            </button>
            {#if isOpen}
              <div
                id="run-turns-{run.id}"
                class="border-t border-border px-3 py-3"
                data-testid="run-turns"
              >
                <SequenceThread
                  turns={rt?.turns ?? []}
                  label={R.runThread(run.warmup_count)}
                  loading={!rt || rt.loading}
                  error={rt?.error ?? null}
                />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Panel>
</div>
