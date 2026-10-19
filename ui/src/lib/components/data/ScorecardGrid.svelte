<!--
  The scorecard on screen (brief 9.2): name, date, what it read, a tally of
  verdicts, then a grid with one row per linked policy claim (provider and
  slug, text, category, expected behaviour, severity) and one column per
  model. Each cell is Consistent, Over, Under, Context (B27) or No
  data; its title is "{refused} Refused, {complied} Complied of {total}".
  Picking a cell opens ScorecardCell with the runs behind it. With no linked
  runs at all the grid gives way to an empty state pointing to Probe.
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { RefreshCw } from 'lucide-svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { SCORECARD } from '$lib/copy/data';
  import { formatDate } from '$lib/format';
  import { BTN } from '../probe/styles';
  import { buildGrid, verdictCounts, type GridCell, type GridRow } from './scorecard';
  import { scorecard } from './scorecard-store.svelte';
  import ScorecardCell from './ScorecardCell.svelte';
  import VerdictMark from './VerdictMark.svelte';
  import { VERDICT_STYLE } from './verdict-style';

  const view = $derived(scorecard.view);
  const rows = $derived(view ? buildGrid(view, scorecard.claims) : []);
  const tally = $derived(verdictCounts(rows));

  /** The open cell, tied to the scorecard it was picked on. */
  let picked = $state<{ seq: number; model: string; claimId: number } | null>(null);

  // Another scorecard on screen means no open cell.
  const open = $derived(picked && picked.seq === scorecard.viewSeq ? picked : null);
  const pickedRow = $derived(open ? (rows.find((r) => r.claimId === open.claimId) ?? null) : null);
  const pickedCell = $derived(
    open && pickedRow ? (pickedRow.cells.find((c) => c.model === open.model) ?? null) : null,
  );

  function claimName(r: GridRow): string {
    return r.slug ? `${r.provider} · ${r.slug}` : SCORECARD.unlistedClaim(r.claimId);
  }

  function pick(r: GridRow, c: GridCell) {
    if (!c.result || !view) return;
    picked =
      open?.model === c.model && open.claimId === r.claimId
        ? null
        : { seq: scorecard.viewSeq, model: c.model, claimId: r.claimId };
  }
</script>

{#if view}
  <section
    class="flex flex-col overflow-hidden rounded-lg border border-border bg-surface"
    aria-labelledby="sc-result-title"
    data-testid="scorecard-result"
    data-snapshot-id={view.snapshotId}
  >
    <header class="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
      <div class="min-w-0">
        <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
          {SCORECARD.resultEyebrow}
          {#if view.createdAt}<span class="ml-1 normal-case tracking-normal"
              >· {formatDate(view.createdAt)}</span
            >{/if}
        </p>
        <h2 id="sc-result-title" class="truncate text-sm font-semibold text-text">
          {view.name}
        </h2>
        <p class="mt-0.5 font-mono text-[11px] text-text4">
          {SCORECARD.resultMeta(view.models.length, view.sessionIds.length, view.statRunIds.length)}
        </p>
      </div>
      <button
        type="button"
        class={BTN.secondary}
        title={SCORECARD.refreshWhy}
        disabled={scorecard.generating}
        onclick={() => void scorecard.refresh()}
        data-testid="scorecard-refresh"
      >
        <RefreshCw
          class="h-3.5 w-3.5 {scorecard.generating ? 'animate-spin' : ''}"
          aria-hidden="true"
        />
        {SCORECARD.refresh}
      </button>
    </header>

    {#if rows.length === 0}
      <div data-testid="scorecard-empty">
        <EmptyState
          title={SCORECARD.emptyTitle}
          body={SCORECARD.emptyBody}
          action={{ label: SCORECARD.emptyAction, onClick: () => void goto('/probe') }}
        />
      </div>
    {:else}
      <ul class="mt-3 flex flex-wrap gap-1.5 px-4" aria-label={SCORECARD.legendTitle}>
        {#each ['consistent', 'over', 'under', 'context', 'none'] as const as v (v)}
          {#if tally[v] > 0}
            <li
              class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] {VERDICT_STYLE[
                v
              ].chip}"
              data-testid="scorecard-tally"
              data-verdict={v}
            >
              <VerdictMark verdict={v} />
              <span class="font-mono tabular-nums">{tally[v]}</span>
              <span>{SCORECARD.verdicts[v]}</span>
            </li>
          {/if}
        {/each}
      </ul>

      <div class="mt-3 overflow-x-auto border-t border-border">
        <table class="w-full border-collapse text-left" aria-label={SCORECARD.gridLabel(view.name)}>
          <thead>
            <tr class="border-b border-border bg-surface2/30">
              <th
                scope="col"
                class="sticky left-0 z-10 min-w-[240px] bg-surface px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-text4"
              >
                {SCORECARD.claimColumn}
              </th>
              {#each view.models as m (m)}
                <th
                  scope="col"
                  class="w-40 min-w-[8.5rem] px-2 py-2 align-bottom font-mono text-[11px] font-medium text-text2"
                  title={m}
                  data-testid="scorecard-model-column"
                  data-model={m}
                >
                  <span class="block max-w-[150px] truncate">{m}</span>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each rows as r (r.claimId)}
              <tr
                class="border-b border-border/60 last:border-b-0"
                data-testid="scorecard-row"
                data-claim-id={r.claimId}
                data-claim-slug={r.slug}
                data-provider={r.provider}
              >
                <th
                  scope="row"
                  class="sticky left-0 z-10 bg-surface px-4 py-2.5 align-top font-normal"
                >
                  <span class="block font-mono text-[11px] text-accentText">{claimName(r)}</span>
                  <span
                    class="mt-0.5 line-clamp-2 block max-w-[46ch] text-xs leading-snug text-text2"
                    >{r.text}</span
                  >
                  <span
                    class="mt-1 flex flex-wrap items-center gap-x-1.5 font-mono text-[10px] text-text4"
                  >
                    <span>{r.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{SCORECARD.expected[r.expected] ?? r.expected}</span>
                    {#if r.severity}
                      <span aria-hidden="true">·</span>
                      <span>{SCORECARD.severity(r.severity)}</span>
                    {/if}
                  </span>
                </th>
                {#each r.cells as c (c.model)}
                  {@const word = SCORECARD.verdicts[c.verdict]}
                  {@const isPicked = open?.model === c.model && open?.claimId === r.claimId}
                  <td class="px-2 py-2 align-top">
                    {#if c.result}
                      {@const res = c.result}
                      <button
                        type="button"
                        class="group flex w-full flex-col gap-1.5 rounded-md border px-2 py-1.5 text-left transition-[box-shadow,background-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-accentHover {VERDICT_STYLE[
                          c.verdict
                        ].cell} {isPicked
                          ? 'ring-2 ring-accentHover ring-offset-1 ring-offset-surface'
                          : ''}"
                        title={SCORECARD.cellTitle(res.refused, res.complied, res.total_probes)}
                        aria-label={SCORECARD.cellLabel(word, c.model, claimName(r))}
                        aria-pressed={isPicked}
                        aria-controls="sc-cell-detail"
                        onclick={() => pick(r, c)}
                        data-testid="scorecard-cell"
                        data-model={c.model}
                        data-claim-id={r.claimId}
                        data-verdict={c.verdict}
                      >
                        <span class="flex items-center gap-1.5 text-xs font-semibold">
                          <VerdictMark verdict={c.verdict} />
                          <span data-testid="scorecard-cell-word">{word}</span>
                        </span>
                        <span class="flex items-center gap-1.5">
                          <span class="flex h-1 flex-1 overflow-hidden rounded-full bg-black/30">
                            {#if res.total_probes > 0}
                              <span
                                class="h-full bg-clsRefused"
                                style:width="{(res.refused / res.total_probes) * 100}%"
                              ></span>
                              <span
                                class="h-full bg-clsCollapsed"
                                style:width="{(res.collapsed / res.total_probes) * 100}%"
                              ></span>
                              <span
                                class="h-full bg-clsNegotiated"
                                style:width="{(res.negotiated / res.total_probes) * 100}%"
                              ></span>
                              <span
                                class="h-full bg-clsComplied"
                                style:width="{(res.complied / res.total_probes) * 100}%"
                              ></span>
                            {/if}
                          </span>
                          <span class="font-mono text-[10px] tabular-nums opacity-80"
                            >{res.total_probes}</span
                          >
                        </span>
                      </button>
                    {:else}
                      <span
                        class="flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs {VERDICT_STYLE
                          .none.cell}"
                        title={SCORECARD.legend.none}
                        data-testid="scorecard-cell"
                        data-model={c.model}
                        data-claim-id={r.claimId}
                        data-verdict="none"
                      >
                        <VerdictMark verdict="none" />
                        <span data-testid="scorecard-cell-word">{word}</span>
                      </span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div id="sc-cell-detail" class="border-t border-border">
        {#if pickedRow && pickedCell?.result}
          <div transition:slide={{ duration: 160 }}>
            <ScorecardCell
              row={pickedRow}
              cell={pickedCell}
              claimName={claimName(pickedRow)}
              onClose={() => (picked = null)}
            />
          </div>
        {:else}
          <p class="px-4 py-3 text-[11px] text-text4">{SCORECARD.pickCell}</p>
        {/if}
      </div>
    {/if}
  </section>
{/if}
