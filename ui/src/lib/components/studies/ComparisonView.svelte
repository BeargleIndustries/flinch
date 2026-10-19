<!--
  One saved comparison (brief 8.5 `/studies/compare/[id]`): GET
  /api/comparisons/{id}. Header with the name, back link, delete and the two
  downloads; the agreement figure large with "{aligned} of {total} probes got
  the same badge from every model" and each model's badge tally; then the
  grid, one column per model and one row per probe (a disagreement row is
  marked). Picking a badge opens that model's conversation below the grid
  (GET /api/runs/{id}/turns, roles `user`/`assistant`, Appendix C item 42)
  with a link to the saved run.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { ArrowLeft, ArrowUpRight, X } from 'lucide-svelte';
  import { pathFor } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { RunTurn } from '$lib/api/types';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import DownloadLink from '$lib/components/DownloadLink.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { saveDownload } from '$lib/components/save-download';
  import { CLS_SPEC } from '$lib/cls';
  import { COMPARE } from '$lib/copy/studies';
  import { formatDate, truncate } from '$lib/format';
  import TurnCard from '../probe/TurnCard.svelte';
  import { BTN } from '../probe/styles';
  import { threadItems } from '../probe/thread';
  import {
    COMPARE_ROUTE,
    PROMPT_PREVIEW,
    agreementLabel,
    agreementTone,
    alignedCount,
    cellClass,
    displayName,
    exportName,
    modelTally,
    runRoute,
    tallyRows,
    type CompareResult,
    type Tone,
  } from './compare';
  import { compare } from './compare.svelte';

  interface Props {
    id: number;
  }

  let { id }: Props = $props();

  $effect(() => {
    const cid = id;
    untrack(() => void compare.open(cid));
  });

  const detail = $derived(compare.detailId === id ? compare.detail : null);
  const results = $derived(detail?.results ?? []);
  const models = $derived(detail?.models ?? []);
  const aligned = $derived(alignedCount(results));
  const tone = $derived<Tone>(agreementTone(detail?.agreement_rate ?? 0));

  // The picked cell: one probe row and one model column.
  let selected = $state<{ probe: number; model: string } | null>(null);
  const selectedResult = $derived(
    selected ? (results.find((r) => r.probe_id === selected?.probe) ?? null) : null,
  );
  const selectedAnswer = $derived(
    selected && selectedResult ? (selectedResult.models[selected.model] ?? null) : null,
  );
  const turnsState = $derived(
    selectedAnswer?.run_id != null ? (compare.turns[selectedAnswer.run_id] ?? null) : null,
  );

  function pickCell(r: CompareResult, model: string) {
    if (selected?.probe === r.probe_id && selected.model === model) {
      selected = null;
      return;
    }
    selected = { probe: r.probe_id, model };
    const runId = r.models[model]?.run_id;
    if (runId != null) void compare.loadTurns(runId);
  }

  /** The saved turns, or the answer itself when the run kept none. */
  function turnsOf(r: CompareResult, model: string, saved: RunTurn[]): RunTurn[] {
    if (saved.length > 0) return saved;
    const a = r.models[model];
    if (!a?.response) return [];
    const runId = a.run_id ?? 0;
    return [
      {
        id: -2,
        run_id: runId,
        role: 'user',
        content: r.prompt_text,
        classification: null,
        created_at: '',
      },
      {
        id: -1,
        run_id: runId,
        role: 'assistant',
        content: a.response,
        classification: a.classification,
        created_at: '',
      },
    ];
  }

  async function remove() {
    if (await compare.remove(id)) await goto(COMPARE_ROUTE);
  }

  const TONE_TEXT: Record<Tone, string> = {
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
  };
  const TONE_BAR: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' };

  const params = $derived({ comparison_id: id });
</script>

<section class="flex max-w-[1180px] flex-col gap-4 pb-6" data-testid="comparison-view">
  <a
    href={COMPARE_ROUTE}
    class="inline-flex w-fit items-center gap-1.5 text-xs text-text3 transition-colors hover:text-accentText focus:outline-none focus-visible:underline"
    data-testid="comparison-back"
  >
    <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
    {COMPARE.back}
  </a>

  {#if compare.notFound && compare.detailId === id}
    <div class="rounded-xl border border-dashed border-border" data-testid="comparison-missing">
      <EmptyState
        title={COMPARE.notFound}
        body={COMPARE.emptyBody}
        action={{ label: COMPARE.back, onClick: () => void goto(COMPARE_ROUTE) }}
      />
    </div>
  {:else if !detail}
    <p class="text-sm {compare.detailError ? 'text-danger' : 'text-text4'}" aria-busy="true">
      {compare.detailError ?? COMPARE.loading}
    </p>
  {:else}
    <header class="flex flex-wrap items-start justify-between gap-4" in:fade={{ duration: 160 }}>
      <div class="min-w-0">
        <h1 class="text-base font-semibold text-text" data-testid="comparison-title">
          {displayName(detail.name)}
        </h1>
        <p class="mt-1 text-xs text-text4">{COMPARE.savedOn(formatDate(detail.created_at))}</p>
      </div>
      <ConfirmButton
        label={COMPARE.remove}
        confirmLabel={COMPARE.removeConfirm}
        danger
        disabled={compare.removing.has(id)}
        onConfirm={remove}
      />
    </header>

    <!-- The agreement figure and each model's tally -->
    <div
      class="grid gap-4 rounded-lg border border-border bg-surface p-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
      data-testid="comparison-stats"
    >
      <div class="flex flex-col gap-2 md:border-r md:border-border md:pr-4">
        <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
          {COMPARE.agreementEyebrow}
        </p>
        <p
          class="font-mono text-4xl font-semibold leading-none tabular-nums {TONE_TEXT[tone]}"
          data-testid="comparison-agreement"
        >
          {agreementLabel(detail.agreement_rate)}
        </p>
        <span class="h-1.5 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
          <span
            class="block h-full rounded-full {TONE_BAR[tone]} transition-[width] duration-500"
            style:width="{Math.max(0, Math.min(100, detail.agreement_rate))}%"
          ></span>
        </span>
        <p class="text-xs leading-snug text-text3" data-testid="comparison-aligned">
          {COMPARE.aligned(aligned, detail.total_probes)}
        </p>
      </div>
      <ul class="grid content-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {#each models as m (m)}
          {@const tally = tallyRows(modelTally(results, m))}
          <li
            class="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-bg/50 px-3 py-2"
            aria-label={COMPARE.tallyLabel(m)}
          >
            <span class="truncate font-mono text-[12px] text-text2" title={m}>{m}</span>
            <span class="flex flex-wrap items-center gap-2">
              {#each tally as t (t.cls)}
                <span class="inline-flex items-center gap-1" title={CLS_SPEC[t.cls].word}>
                  <ClassBadge value={t.cls} size="sm" glyphOnly />
                  <span class="font-mono text-[11px] tabular-nums text-text3"
                    >{COMPARE.tallyCount(t.count)}</span
                  >
                </span>
              {/each}
            </span>
          </li>
        {/each}
      </ul>
    </div>

    <!-- The grid: one row per probe, one column per model -->
    <Panel title={COMPARE.gridTitle} eyebrow={COMPARE.gridEyebrow} readout={COMPARE.gridReadout}>
      <div class="-mx-4 overflow-x-auto px-4">
        <table
          class="w-full min-w-[32rem] border-separate border-spacing-0 text-left"
          aria-label={COMPARE.gridLabel}
          data-testid="comparison-grid"
        >
          <thead>
            <tr>
              <th
                scope="col"
                class="border-b border-border pb-2 pl-3 pr-4 text-[10px] font-medium uppercase tracking-widest text-text4"
                >{COMPARE.probeColumn}</th
              >
              {#each models as m (m)}
                <th
                  scope="col"
                  class="border-b border-border px-2 pb-2 text-center font-mono text-[11px] font-normal text-text2"
                  data-testid="comparison-column"
                >
                  <span class="block max-w-[12rem] truncate" title={m}>{m}</span>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each results as r (r.probe_id)}
              <tr
                class={r.disagreement ? 'bg-warn/[0.04]' : ''}
                data-testid="comparison-row-probe"
                data-disagreement={r.disagreement}
              >
                <th
                  scope="row"
                  class="border-b border-l-2 border-b-border py-2.5 pl-3 pr-4 align-middle font-normal {r.disagreement
                    ? 'border-l-warn'
                    : 'border-l-transparent'}"
                >
                  <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="truncate text-[13px] text-text">{r.probe_name}</span>
                    {#if r.probe_domain}
                      <span class="font-mono text-[10px] text-text4">{r.probe_domain}</span>
                    {/if}
                    {#if r.disagreement}
                      <span
                        class="rounded border border-warn/40 bg-warn/10 px-1.5 py-px text-[10px] font-medium text-warn"
                        data-testid="comparison-disagreement">{COMPARE.disagreement}</span
                      >
                    {/if}
                  </span>
                </th>
                {#each models as m (m)}
                  {@const a = r.models[m]}
                  {@const cls = cellClass(a)}
                  {@const on = selected?.probe === r.probe_id && selected.model === m}
                  <td class="border-b border-border px-2 py-2 text-center align-middle">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded-md border px-2 py-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover {on
                        ? 'border-accent bg-accentSoft/20'
                        : 'border-transparent hover:border-borderStrong hover:bg-surface2/60'}"
                      aria-pressed={on}
                      aria-label={COMPARE.cellLabel(
                        m,
                        r.probe_name,
                        a?.error ? COMPARE.failedCell : CLS_SPEC[cls].word,
                      )}
                      onclick={() => pickCell(r, m)}
                      data-testid="comparison-cell"
                      data-cls={cls}
                    >
                      {#if a?.error}
                        <span
                          class="rounded border border-danger/40 bg-dangerSoft/40 px-1.5 py-0.5 text-[11px] text-danger"
                          >{COMPARE.failedCell}</span
                        >
                      {:else}
                        <ClassBadge value={a?.classification ?? null} size="sm" />
                      {/if}
                    </button>
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if selected && selectedResult}
        {@const r = selectedResult}
        {@const model = selected.model}
        {@const a = selectedAnswer}
        <div
          class="mt-1 flex flex-col gap-3 rounded-lg border border-border bg-bg/40 p-4"
          data-testid="comparison-turns"
          transition:slide={{ duration: 180 }}
        >
          <header class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
                {COMPARE.turnsEyebrow(model)}
              </p>
              <p class="truncate text-sm font-medium text-text">{r.probe_name}</p>
            </div>
            <div class="flex items-center gap-2">
              {#if a?.run_id != null}
                <a
                  href={runRoute(a.run_id)}
                  class={BTN.secondary}
                  title={COMPARE.openRunWhy}
                  data-testid="comparison-open-run"
                >
                  {COMPARE.openRun}
                  <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              {/if}
              <button
                type="button"
                class={BTN.ghost}
                aria-label={COMPARE.closeTurns}
                onclick={() => (selected = null)}
              >
                <X class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div>
            <p class="mb-1 text-[10px] font-medium uppercase tracking-widest text-text4">
              {COMPARE.prompt}
            </p>
            <p
              class="whitespace-pre-wrap rounded-md border border-border bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-text2"
            >
              {truncate(r.prompt_text, PROMPT_PREVIEW)}
            </p>
          </div>

          {#if a?.error}
            <p
              class="rounded-md border border-danger/40 bg-dangerSoft/30 px-3 py-2 text-xs text-danger"
            >
              {COMPARE.failedAnswer(a.error)}
            </p>
          {:else if turnsState?.loading}
            <p class="text-xs text-text4" aria-busy="true">{COMPARE.turnsLoading}</p>
          {:else}
            {@const items = threadItems(turnsOf(r, model, turnsState?.turns ?? []))}
            {#if items.length === 0}
              <p class="text-xs text-text4">{COMPARE.turnsEmpty}</p>
            {:else}
              <ol class="flex flex-col" aria-label={COMPARE.turnsEyebrow(model)}>
                {#each items as item (item.turn.id)}
                  <TurnCard {item} run={null} />
                {/each}
              </ol>
            {/if}
          {/if}
        </div>
      {/if}
    </Panel>

    <Panel title={COMPARE.downloadsEyebrow}>
      <div class="divide-y divide-border rounded-lg border border-border bg-bg/40 px-3">
        <DownloadLink
          label={COMPARE.json}
          description={COMPARE.jsonWhy}
          path={pathFor(ROUTES.exportComparison, { params, query: { format: 'json' } })}
          fallbackName={exportName(id, 'json')}
          onDownload={saveDownload}
        />
        <DownloadLink
          label={COMPARE.csv}
          description={COMPARE.csvWhy}
          path={pathFor(ROUTES.exportComparison, { params, query: { format: 'csv' } })}
          fallbackName={exportName(id, 'csv')}
          onDownload={saveDownload}
        />
      </div>
    </Panel>
  {/if}
</section>
