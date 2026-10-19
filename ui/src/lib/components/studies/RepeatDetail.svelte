<!--
  The selected repeat run (brief 8.3 "Show each run", 9.9 detail bar): how
  its calls split (the headline share, the ClassBar from
  GET /api/stat-runs/{id}/distribution, and calls and share per badge), its
  tape, and every call's badge, latency and response (the first 200
  characters, "Show all" for the rest).
-->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ClassBar from '$lib/components/ClassBar.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import { CLS_SPEC, toCls } from '$lib/cls';
  import { REPEAT } from '$lib/copy/studies';
  import {
    distribution,
    excerpt,
    latencyLabel,
    medianLatency,
    pctLabel,
    runDate,
    runStatus,
    type LiveCell,
    type StatRunDetail,
  } from './repeat';
  import type { ClsCounts } from '../class-bar';
  import RepeatTape from './RepeatTape.svelte';

  interface Props {
    detail: StatRunDetail;
    counts: ClsCounts;
  }

  let { detail, counts }: Props = $props();

  const dist = $derived(distribution(counts));
  const iterations = $derived(detail.iterations);
  const cells = $derived<LiveCell[]>(
    iterations.map((it) => ({
      iteration: it.iteration_num,
      cls: toCls(it.classification),
      latencyMs: it.latency_ms,
      error: null,
    })),
  );
  const median = $derived(medianLatency(iterations.map((it) => it.latency_ms)));
  const when = $derived(runDate(detail.created_at));
  const name = $derived(detail.summary?.probe_name || `#${detail.probe_id}`);

  const verdict = $derived.by(() => {
    if (dist.total === 0 || !dist.top) return REPEAT.noCalls;
    if (dist.unanimous) return REPEAT.unanimous(CLS_SPEC[dist.unanimous].word, dist.total);
    return REPEAT.split(CLS_SPEC[dist.top.cls].word, pctLabel(dist.top.pct));
  });

  let open = $state<Set<number>>(new Set());
  // A different run starts with every response folded.
  $effect(() => {
    void detail.id;
    open = new Set();
  });

  function toggle(id: number) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    open = next;
  }

  const cell = 'px-3 py-2 align-top';
</script>

<div
  class="flex min-w-0 flex-col gap-5"
  data-testid="repeat-detail"
  data-stat-run-id={detail.id}
  in:fade={{ duration: 160 }}
>
  <header class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
    <div class="min-w-0">
      <p class="font-mono text-[10px] uppercase tracking-widest text-text4">
        {REPEAT.detailEyebrow(detail.target_model)}
      </p>
      <h3 class="truncate text-sm font-semibold text-text" data-testid="repeat-detail-name">
        {name}
      </h3>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <StatusChip status={runStatus(detail.status)} />
      {#if when}
        <span class="font-mono text-[11px] tabular-nums text-text4">{when.date} {when.time}</span>
      {/if}
    </div>
  </header>

  <!-- How the calls split -->
  <section
    class="grid gap-x-6 gap-y-4 rounded-md border border-border bg-bg/50 p-4 sm:grid-cols-[minmax(0,9.5rem)_1fr]"
    aria-label={REPEAT.distTitle}
    data-testid="repeat-distribution"
    data-total={dist.total}
  >
    <div class="flex flex-col gap-1.5">
      {#if dist.top}
        <span
          class="font-mono text-4xl font-semibold leading-none tracking-tight tabular-nums text-text"
          data-testid="dist-headline">{pctLabel(dist.top.pct)}</span
        >
        <span class="inline-flex"><ClassBadge value={dist.top.cls} size="sm" /></span>
      {:else}
        <span class="font-mono text-4xl font-semibold leading-none text-text4">0</span>
      {/if}
      <p class="mt-1 text-xs leading-snug text-text3" data-testid="dist-verdict">{verdict}</p>
    </div>

    <div class="flex min-w-0 flex-col gap-3">
      <ClassBar {counts} legend={false} />
      <table class="w-full border-collapse text-left text-xs">
        <thead class="sr-only">
          <tr>
            <th scope="col">{REPEAT.colBadge}</th>
            <th scope="col">{REPEAT.colCount}</th>
            <th scope="col">{REPEAT.colShare}</th>
          </tr>
        </thead>
        <tbody>
          {#each dist.rows as row (row.cls)}
            <tr data-testid="dist-row" data-cls={row.cls} class:opacity-40={row.count === 0}>
              <td class="w-28 py-1 pr-3"><ClassBadge value={row.cls} size="sm" /></td>
              <td class="w-full py-1 pr-3">
                <span class="block h-1 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                  <span
                    class="block h-full rounded-full transition-[width] duration-500 ease-out {CLS_SPEC[
                      row.cls
                    ].glyphBg}"
                    style:width="{row.pct}%"
                  ></span>
                </span>
              </td>
              <td
                class="py-1 pr-3 text-right font-mono tabular-nums text-text2"
                data-testid="dist-count">{row.count}</td
              >
              <td
                class="w-12 py-1 text-right font-mono tabular-nums text-text"
                data-testid="dist-pct">{pctLabel(row.pct)}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Each call -->
  <section class="flex flex-col gap-2" aria-label={REPEAT.iterationsTitle}>
    <div class="flex items-baseline justify-between gap-3">
      <h4 class="text-[10px] font-medium uppercase tracking-widest text-text4">
        {REPEAT.iterationsTitle}
      </h4>
      {#if median !== null}
        <span class="font-mono text-[11px] tabular-nums text-text4"
          >{REPEAT.median(latencyLabel(median))}</span
        >
      {/if}
    </div>

    {#if iterations.length === 0}
      <p class="text-xs text-text4">{REPEAT.noIterations}</p>
    {:else}
      <RepeatTape
        {cells}
        total={cells.length}
        size="sm"
        label={REPEAT.tapeLabel(name, cells.length, cells.length)}
      />
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full border-collapse text-left text-xs" data-testid="repeat-iterations">
          <thead>
            <tr class="bg-surface2/60 text-[10px] uppercase tracking-widest text-text4">
              <th scope="col" class="{cell} w-12 font-medium">{REPEAT.colIteration}</th>
              <th scope="col" class="{cell} w-32 font-medium">{REPEAT.colBadge}</th>
              <th scope="col" class="{cell} w-20 text-right font-medium">{REPEAT.colLatency}</th>
              <th scope="col" class="{cell} font-medium">{REPEAT.colResponse}</th>
            </tr>
          </thead>
          <tbody>
            {#each iterations as it (it.id)}
              {@const full = (it.response_text ?? '').trim()}
              {@const short = excerpt(full)}
              {@const expanded = open.has(it.id)}
              <tr
                class="border-t border-border"
                data-testid="repeat-iteration"
                data-cls={toCls(it.classification)}
              >
                <td class="{cell} font-mono tabular-nums text-text4">
                  {String(it.iteration_num).padStart(2, '0')}
                </td>
                <td class={cell}><ClassBadge value={it.classification} size="sm" /></td>
                <td
                  class="{cell} text-right font-mono tabular-nums text-text2"
                  data-testid="iteration-latency">{latencyLabel(it.latency_ms)}</td
                >
                <td class="{cell} max-w-0">
                  {#if !full}
                    <span class="text-text4">{REPEAT.noText}</span>
                  {:else if expanded}
                    <p
                      class="max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text2"
                      data-testid="iteration-text"
                    >
                      {full}
                    </p>
                  {:else}
                    <p class="truncate text-text3" title={short} data-testid="iteration-text">
                      {short}
                    </p>
                  {/if}
                  {#if full}
                    <button
                      type="button"
                      class="mt-1 text-[11px] text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
                      aria-expanded={expanded}
                      aria-label={expanded
                        ? REPEAT.showLessFor(it.iteration_num)
                        : REPEAT.showAllFor(it.iteration_num)}
                      onclick={() => toggle(it.id)}
                      data-testid="iteration-toggle"
                    >
                      {expanded ? REPEAT.showLess : REPEAT.showAll}
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>
