<!--
  One scorecard cell opened (brief 9.2): the model and claim, the verdict and
  what it means, the counts the scorecard saved with their ClassBar, then the
  session runs behind it (each with its badge, probe, session and date, and a
  link to /probe/runs/{id}). Responses the cell counted that are not listed
  (repeat-run iterations, runs deleted since) are summed in one line.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { ArrowUpRight, X } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ClassBar from '$lib/components/ClassBar.svelte';
  import { SCORECARD } from '$lib/copy/data';
  import { formatDate } from '$lib/format';
  import {
    cellCounts,
    otherResponses,
    runHref,
    type CellRun,
    type GridCell,
    type GridRow,
  } from './scorecard';
  import { scorecard } from './scorecard-store.svelte';
  import VerdictMark from './VerdictMark.svelte';
  import { VERDICT_STYLE } from './verdict-style';

  interface Props {
    row: GridRow;
    cell: GridCell;
    claimName: string;
    onClose: () => void;
  }

  let { row, cell, claimName, onClose }: Props = $props();

  let runs = $state<CellRun[] | null>(null);
  let failed = $state(false);

  // Reads the runs whenever another cell opens here; a late reply for an
  // earlier cell is dropped.
  let token = 0;
  $effect(() => {
    const model = cell.model;
    const claimId = row.claimId;
    untrack(() => {
      const mine = ++token;
      runs = null;
      failed = false;
      scorecard
        .runsFor(model, claimId)
        .then((list) => {
          if (mine === token) runs = list;
        })
        .catch(() => {
          if (mine === token) failed = true;
        });
    });
  });

  const result = $derived(cell.result);
  const other = $derived(result && runs ? otherResponses(result, runs) : 0);
</script>

{#if result}
  <div
    class="flex flex-col gap-3 bg-bg/30 px-4 py-4"
    data-testid="scorecard-detail"
    data-model={cell.model}
    data-claim-id={row.claimId}
  >
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
          {SCORECARD.detailEyebrow}
        </p>
        <h3 class="truncate text-sm font-semibold text-text">
          {SCORECARD.detailTitle(cell.model, claimName)}
        </h3>
      </div>
      <button
        type="button"
        class="rounded p-1 text-text4 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
        aria-label={SCORECARD.detailClose}
        onclick={onClose}
      >
        <X class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </header>

    <div class="grid gap-3 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div class="flex flex-col gap-2">
        <span
          class="inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold {VERDICT_STYLE[
            cell.verdict
          ].chip}"
          data-testid="scorecard-detail-verdict"
        >
          <VerdictMark verdict={cell.verdict} />
          {SCORECARD.verdicts[cell.verdict]}
        </span>
        <p class="text-xs leading-relaxed text-text3">{SCORECARD.legend[cell.verdict]}</p>
        <p class="font-mono text-[11px] text-text4">
          {SCORECARD.expected[row.expected] ?? row.expected}
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        <p class="font-mono text-[11px] text-text3" data-testid="scorecard-detail-counts">
          {SCORECARD.cellTitle(result.refused, result.complied, result.total_probes)}
        </p>
        <ClassBar counts={cellCounts(result)} />
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
        {SCORECARD.detailRuns}
      </p>
      {#if failed}
        <p class="text-xs text-danger" role="alert">{SCORECARD.detailFailed}</p>
      {:else if runs === null}
        <p class="text-xs text-text4" aria-busy="true">{SCORECARD.detailLoading}</p>
      {:else if runs.length === 0}
        <p class="text-xs text-text4">{SCORECARD.detailNone}</p>
      {:else}
        <ul class="divide-y divide-border/60 rounded-md border border-border bg-surface">
          {#each runs as r (r.id)}
            <li
              class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
              data-testid="scorecard-detail-run"
              data-run-id={r.id}
            >
              <ClassBadge value={r.classification} size="sm" />
              <span class="min-w-0 flex-1 truncate text-xs text-text2">
                <span class="font-medium text-text">{r.probeName}</span>
                <span class="text-text4"
                  >{SCORECARD.inSession(
                    r.sessionName || SCORECARD.unknownSession(r.sessionId),
                  )}</span
                >
              </span>
              <span class="font-mono text-[10px] tabular-nums text-text4"
                >{formatDate(r.createdAt)}</span
              >
              <a
                href={runHref(r.id)}
                class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accentText transition-colors hover:bg-accentSoft focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
                data-testid="scorecard-detail-open"
              >
                {SCORECARD.openRun}
                <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </li>
          {/each}
        </ul>
      {/if}
      {#if other > 0}
        <p class="text-[11px] text-text4">{SCORECARD.detailOther(other)}</p>
      {/if}
      <p class="text-[11px] leading-snug text-text4">{SCORECARD.detailHint}</p>
    </div>
  </div>
{/if}
