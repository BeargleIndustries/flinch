<!--
  Repeat runs, Results (brief 8.3, `data-tour="repeat-results"`): this
  session's runs from GET /api/sessions/{id}/stat-runs, newest first; each
  row has the probe, the model, the status (`failed` for a run the startup
  sweep closed, B23), the date, N, "Refused {refused} of {total} ({rate})"
  and a ClassBar. Picking a row reads that run again and shows it beside the
  list (RepeatDetail).
-->
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { RotateCw } from 'lucide-svelte';
  import ClassBar from '$lib/components/ClassBar.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import { REPEAT } from '$lib/copy/studies';
  import { BTN } from '../probe/styles';
  import RepeatDetail from './RepeatDetail.svelte';
  import { rateLabel, runDate, runStatus, summaryCounts } from './repeat';
  import { repeat } from './repeat.svelte';

  interface Props {
    sessionId: number;
  }

  let { sessionId }: Props = $props();

  const rows = $derived(repeat.sessionId === sessionId ? repeat.summaries : []);
  const selected = $derived(repeat.selectedId);
</script>

<Panel
  eyebrow={REPEAT.resultsEyebrow}
  title={REPEAT.resultsTitle}
  readout={rows.length ? REPEAT.resultsReadout : null}
  anchor="repeat-results"
>
  {#snippet actions()}
    {#if rows.length}
      <span class="font-mono text-[11px] tabular-nums text-text4" data-testid="repeat-count"
        >{REPEAT.resultsCount(rows.length)}</span
      >
    {/if}
  {/snippet}

  {#if repeat.listError && rows.length === 0}
    <div class="flex items-center gap-3">
      <p class="text-xs text-danger" role="alert">{repeat.listError}</p>
      <button type="button" class={BTN.secondary} onclick={() => void repeat.load(sessionId)}>
        <RotateCw class="h-3.5 w-3.5" aria-hidden="true" />
        {REPEAT.loadAgain}
      </button>
    </div>
  {:else if repeat.loaded && rows.length === 0}
    <div class="rounded-lg border border-dashed border-border" data-testid="repeat-empty">
      <EmptyState title={REPEAT.empty} body={REPEAT.emptyBody} />
    </div>
  {:else if rows.length > 0}
    <div class="grid gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <ul
        class="flex max-h-[44rem] flex-col gap-1.5 overflow-y-auto pr-0.5"
        data-testid="repeat-summaries"
      >
        {#each rows as s (s.stat_run_id)}
          {@const when = runDate(s.created_at)}
          {@const on = s.stat_run_id === selected}
          <li in:fly={{ y: 4, duration: 160 }}>
            <button
              type="button"
              aria-pressed={on}
              aria-label={REPEAT.openRun(s.probe_name, when ? `${when.date} ${when.time}` : '')}
              class="flex w-full flex-col gap-2 rounded-md border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover {on
                ? 'border-accent/60 bg-accent/5 shadow-[inset_2px_0_0_0_rgb(var(--accent))]'
                : 'border-border bg-bg/40 hover:border-borderStrong hover:bg-surface2/50'}"
              onclick={() => void repeat.select(s.stat_run_id)}
              data-testid="repeat-summary"
              data-stat-run-id={s.stat_run_id}
              data-status={runStatus(s.status)}
            >
              <span class="flex min-w-0 items-center gap-2">
                <span class="truncate text-[13px] font-medium text-text">{s.probe_name}</span>
                <span class="ml-auto shrink-0"><StatusChip status={runStatus(s.status)} /></span>
              </span>
              <span
                class="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] tabular-nums"
              >
                {#if when}
                  <span class="text-text3" data-testid="summary-date">{when.date}</span>
                  <span class="text-text4">{when.time}</span>
                {/if}
                <span class="text-text3" data-testid="summary-n">{REPEAT.nCalls(s.total)}</span>
                <span class="truncate text-text4">{s.model}</span>
              </span>
              <ClassBar counts={summaryCounts(s)} legend={false} />
              <span class="text-[11px] text-text3" data-testid="summary-refused"
                >{REPEAT.refusedOf(s.refused, s.total, rateLabel(s.consistency_rate))}</span
              >
            </button>
          </li>
        {/each}
      </ul>

      <div class="min-w-0 rounded-md border border-border p-4" aria-live="polite">
        {#if repeat.detail && repeat.counts && repeat.detail.id === selected}
          <div class:opacity-60={repeat.detailLoading} class="transition-opacity">
            <RepeatDetail detail={repeat.detail} counts={repeat.counts} />
          </div>
        {:else if repeat.detailError}
          <p class="text-xs text-danger" role="alert">{repeat.detailError}</p>
        {:else if repeat.detailLoading}
          <p class="text-xs text-text4">{REPEAT.reading}</p>
        {:else}
          <p class="text-xs text-text4">{REPEAT.pickOne}</p>
        {/if}
      </div>
    </div>
  {/if}
</Panel>
