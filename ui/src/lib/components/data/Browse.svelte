<!--
  Browse (brief 9.1, D16; formerly Dashboard). No rail (D15). Opens with its
  research question, then the overview: four readouts from GET
  /api/dashboard/stats (Sessions, which leaves Model compare sessions out
  after B19; Runs; Comparisons; Sequences), the first-response bar when any
  run exists, "Export everything (JSON)" and "Delete all recorded data…"
  (ClearAllDialog). Below, tabs All, Sessions, Comparisons, Studies and
  Sequences, each grouped Today, This week, This month, Older:
  - Session: name, model, "{n} runs" (run_count from the route), date, the
    first-response bar and counts; Open, Download JSON, Download CSV (the
    row's own session), Make current, Delete.
  - Comparison: name, models, probes, agreement; Open (Studies, Model
    compare), Download JSON, Download CSV, Delete.
  - Study: name, status, models, date; Open (Studies, Conditions).
  - Sequence: probe, strategy, session, warmup setting (no turn count,
    Appendix C item 41), status; Open (the sequence detail), Download JSON,
    Delete.
  Model compare sessions never show (D29, $lib/session isCompareSession).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { ArrowUpRight, Boxes, GitCompareArrows, Layers, Trash2, Workflow } from 'lucide-svelte';
  import type { Experiment } from '$lib/api/types';
  import { pathFor } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ClassBar from '$lib/components/ClassBar.svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import TabbedPanel, { type TabDef } from '$lib/components/TabbedPanel.svelte';
  import ClearAllDialog from '$lib/components/dialogs/ClearAllDialog.svelte';
  import { CLS_ORDER } from '$lib/cls';
  import { BROWSE } from '$lib/copy/data';
  import { SCREENS } from '$lib/copy/screens';
  import { formatDate } from '$lib/format';
  import { session } from '$lib/stores/session.svelte';
  import { BTN } from '../probe/styles';
  import {
    agreementLabel,
    agreementTone,
    displayName,
    exportName,
    modelsLine,
    type ComparisonSummary,
  } from '../studies/compare';
  import { sequenceFileName } from '../studies/sequences';
  import {
    asTab,
    comparisonHref,
    feed,
    groupByDate,
    sequenceHref,
    sessionHref,
    sessionTally,
    studyHref,
    toClsCounts,
    totalOf,
    type BrowseSequence,
    type BrowseSession,
    type BrowseTab,
    type FeedItem,
  } from './browse';
  import { browse } from './browse-store.svelte';
  import SaveButton from './SaveButton.svelte';

  // Each visit reads everything again.
  $effect(() => {
    untrack(() => void browse.load());
  });

  const ready = $derived(browse.loaded);
  const stats = $derived(browse.stats);
  const firstResponses = $derived(toClsCounts(stats?.classification_breakdown));

  let tab = $state<BrowseTab>(asTab(page.url.searchParams.get('tab')));
  let clearOpen = $state(false);

  // "Now" for the date groups, fixed per read so rows do not hop groups mid-visit.
  const now = $derived.by(() => {
    void browse.sessions;
    return new Date();
  });

  const lists = $derived({
    sessions: browse.sessions,
    comparisons: browse.comparisons,
    studies: browse.studies,
    sequences: browse.sequences,
  });
  const all = $derived(feed(lists));

  const counts = $derived<Record<BrowseTab, number>>({
    all: all.length,
    sessions: browse.sessions.length,
    comparisons: browse.comparisons.length,
    studies: browse.studies.length,
    sequences: browse.sequences.length,
  });

  const LABELS: Record<BrowseTab, string> = {
    all: BROWSE.tabAll,
    sessions: BROWSE.tabSessions,
    comparisons: BROWSE.tabComparisons,
    studies: BROWSE.tabStudies,
    sequences: BROWSE.tabSequences,
  };

  const tabs = $derived<TabDef[]>(
    (Object.keys(LABELS) as BrowseTab[]).map((id) => ({
      id,
      label: ready ? BROWSE.tabCount(LABELS[id], counts[id]) : LABELS[id],
    })),
  );

  const TAB_OF: Record<FeedItem['kind'], BrowseTab> = {
    session: 'sessions',
    comparison: 'comparisons',
    study: 'studies',
    sequence: 'sequences',
  };

  /** The rows a tab shows, as feed items so one renderer serves every tab. */
  function itemsFor(id: BrowseTab): FeedItem[] {
    return id === 'all' ? all : all.filter((i) => TAB_OF[i.kind] === id);
  }

  async function makeCurrent(id: number) {
    if (!session.list.some((s) => s.id === id)) await session.load();
    session.select(id);
    await goto('/probe');
  }

  const TILES = $derived([
    {
      key: 'sessions',
      label: BROWSE.tileSessions,
      value: stats?.total_sessions,
      why: BROWSE.tileSessionsWhy,
      icon: Layers,
    },
    {
      key: 'runs',
      label: BROWSE.tileRuns,
      value: stats?.total_runs,
      why: BROWSE.tileRunsWhy,
      icon: Boxes,
    },
    {
      key: 'comparisons',
      label: BROWSE.tileComparisons,
      value: stats?.total_comparisons,
      why: undefined,
      icon: GitCompareArrows,
    },
    {
      key: 'sequences',
      label: BROWSE.tileSequences,
      value: stats?.total_sequences,
      why: undefined,
      icon: Workflow,
    },
  ]);

  const KIND_TAG: Record<FeedItem['kind'], string> = {
    session: 'text-accentText border-accent/40',
    comparison: 'text-text2 border-borderStrong',
    study: 'text-warn border-warn/40',
    sequence: 'text-ok border-ok/40',
  };

  const AGREEMENT_TEXT = { ok: 'text-ok', warn: 'text-warn', danger: 'text-danger' } as const;

  const ROW =
    'grid items-center gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(9rem,13rem)_auto]';
  const NAME =
    'truncate text-sm font-medium text-text decoration-accent/60 underline-offset-4 hover:underline focus:outline-none focus-visible:underline';
  const META =
    'flex flex-wrap items-center gap-x-1.5 font-mono [&>span]:whitespace-nowrap text-[11px] tabular-nums text-text4';
  const OPEN =
    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accentText transition-colors hover:bg-accentSoft focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover';
</script>

{#snippet kindTag(kind: FeedItem['kind'])}
  {#if tab === 'all'}
    <span
      class="shrink-0 rounded border px-1 py-px font-mono text-[9px] font-semibold uppercase tracking-widest {KIND_TAG[
        kind
      ]}">{BROWSE.kinds[kind]}</span
    >
  {/if}
{/snippet}

{#snippet sessionRow(s: BrowseSession)}
  {@const tally = sessionTally(s)}
  <div
    class={ROW}
    data-testid="browse-session-row"
    data-session-id={s.id}
    data-session-name={s.name}
    data-run-count={s.run_count}
  >
    <div class="flex min-w-0 flex-col gap-1">
      <div class="flex min-w-0 items-center gap-2">
        {@render kindTag('session')}
        <a href={sessionHref(s.id)} class={NAME} data-testid="browse-session-name">{s.name}</a>
        {#if session.current?.id === s.id}
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true"></span>
        {/if}
      </div>
      <span class={META}>
        <span class="text-text3">{s.target_model}</span>
        <span
          ><span aria-hidden="true" class="mr-1.5">·</span><span data-testid="browse-session-runs"
            >{BROWSE.runs(s.run_count)}</span
          ></span
        >
        <span><span aria-hidden="true" class="mr-1.5">·</span>{formatDate(s.created_at)}</span>
      </span>
    </div>

    <div
      class="flex min-w-0 flex-col gap-1.5"
      data-testid="browse-session-tally"
      aria-label={BROWSE.tallyLabel(s.name)}
    >
      {#if s.run_count > 0}
        <ClassBar counts={tally} legend={false} />
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          {#each CLS_ORDER as c (c)}
            {#if tally[c]}
              <span class="inline-flex items-center gap-1" data-tally-cls={c}>
                <ClassBadge value={c} size="sm" glyphOnly />
                <span class="font-mono text-[11px] tabular-nums text-text3">{tally[c]}</span>
              </span>
            {/if}
          {/each}
        </div>
      {:else}
        <span class="text-[11px] text-text4">{BROWSE.noRuns}</span>
      {/if}
    </div>

    <div class="flex flex-wrap items-center gap-1 md:justify-end">
      <a href={sessionHref(s.id)} class={OPEN} title={BROWSE.openWhy}>
        {BROWSE.open}
        <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
      </a>
      <SaveButton
        path={pathFor(ROUTES.exportSession, {
          params: { session_id: s.id },
          query: { format: 'json' },
        })}
        label={BROWSE.downloadJson}
        fallbackName="flinch-session-{s.id}.json"
        testid="browse-session-json"
      />
      <SaveButton
        path={pathFor(ROUTES.exportSession, {
          params: { session_id: s.id },
          query: { format: 'csv' },
        })}
        label={BROWSE.downloadCsv}
        fallbackName="flinch-session-{s.id}.csv"
        testid="browse-session-csv"
      />
      <button
        type="button"
        class="{BTN.ghost} px-2 py-1"
        title={BROWSE.makeCurrentWhy}
        onclick={() => makeCurrent(s.id)}
        data-testid="browse-make-current"
      >
        {BROWSE.makeCurrent}
      </button>
      <ConfirmButton
        label={BROWSE.deleteSession}
        confirmLabel={BROWSE.deleteSessionConfirm}
        danger
        disabled={browse.removing.has(`session-${s.id}`)}
        onConfirm={() => browse.removeSession(s.id).then(() => undefined)}
      />
    </div>
  </div>
{/snippet}

{#snippet comparisonRow(c: ComparisonSummary)}
  <div class={ROW} data-testid="browse-comparison-row" data-comparison-id={c.id}>
    <div class="flex min-w-0 flex-col gap-1">
      <div class="flex min-w-0 items-center gap-2">
        {@render kindTag('comparison')}
        <a href={comparisonHref(c.id)} class={NAME} title={BROWSE.comparisonOpenWhy}
          >{displayName(c.name)}</a
        >
      </div>
      <span class={META}>
        <span class="truncate text-text3">{modelsLine(c.models)}</span>
        <span><span aria-hidden="true" class="mr-1.5">·</span>{BROWSE.probes(c.total_probes)}</span>
        <span><span aria-hidden="true" class="mr-1.5">·</span>{formatDate(c.created_at)}</span>
      </span>
    </div>
    <div class="flex items-baseline gap-1.5">
      <span
        class="font-mono text-lg font-semibold tabular-nums {AGREEMENT_TEXT[
          agreementTone(c.agreement_rate)
        ]}">{agreementLabel(c.agreement_rate)}</span
      >
      <span class="text-[11px] text-text4">{BROWSE.agreementWord}</span>
    </div>
    <div class="flex flex-wrap items-center gap-1 md:justify-end">
      <a href={comparisonHref(c.id)} class={OPEN} title={BROWSE.comparisonOpenWhy}>
        {BROWSE.open}
        <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
      </a>
      <SaveButton
        path={pathFor(ROUTES.exportComparison, {
          params: { comparison_id: c.id },
          query: { format: 'json' },
        })}
        label={BROWSE.downloadJson}
        fallbackName={exportName(c.id, 'json')}
      />
      <SaveButton
        path={pathFor(ROUTES.exportComparison, {
          params: { comparison_id: c.id },
          query: { format: 'csv' },
        })}
        label={BROWSE.downloadCsv}
        fallbackName={exportName(c.id, 'csv')}
      />
      <ConfirmButton
        label={BROWSE.deleteComparison}
        confirmLabel={BROWSE.deleteComparisonConfirm}
        danger
        disabled={browse.removing.has(`comparison-${c.id}`)}
        onConfirm={() => browse.removeComparison(c.id).then(() => undefined)}
      />
    </div>
  </div>
{/snippet}

{#snippet studyRow(e: Experiment)}
  <div class={ROW} data-testid="browse-study-row" data-study-id={e.id}>
    <div class="flex min-w-0 flex-col gap-1">
      <div class="flex min-w-0 items-center gap-2">
        {@render kindTag('study')}
        <a href={studyHref(e.id)} class={NAME} title={BROWSE.studyOpenWhy}>{e.name}</a>
      </div>
      <span class={META}>
        <span>{BROWSE.models((e.model_ids ?? []).length)}</span>
        <span><span aria-hidden="true" class="mr-1.5">·</span>{formatDate(e.created_at)}</span>
      </span>
    </div>
    <div><StatusChip status={e.status} /></div>
    <div class="flex flex-wrap items-center gap-1 md:justify-end">
      <a href={studyHref(e.id)} class={OPEN} title={BROWSE.studyOpenWhy}>
        {BROWSE.open}
        <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  </div>
{/snippet}

{#snippet sequenceRow(q: BrowseSequence)}
  {@const probe = browse.probeNames[q.probe_id] ?? BROWSE.unknownProbe(q.probe_id)}
  {@const strategy = browse.strategyNames[q.strategy_id] ?? BROWSE.unknownStrategy(q.strategy_id)}
  <div
    class={ROW}
    data-testid="browse-sequence-row"
    data-sequence-id={q.id}
    data-status={q.status}
    data-warmup={q.max_warmup_turns}
  >
    <div class="flex min-w-0 flex-col gap-1">
      <div class="flex min-w-0 items-center gap-2">
        {@render kindTag('sequence')}
        <a href={sequenceHref(q.id)} class={NAME}>{probe}</a>
      </div>
      <span class={META}>
        <span class="text-text3">{strategy}</span>
        <span class="truncate"
          ><span aria-hidden="true" class="mr-1.5">·</span>{BROWSE.inSession(
            q.session_name ?? BROWSE.unknownSession(q.session_id),
          )}</span
        >
        {#if q.target_model}
          <span><span aria-hidden="true" class="mr-1.5">·</span>{q.target_model}</span>
        {/if}
        <span><span aria-hidden="true" class="mr-1.5">·</span>{formatDate(q.created_at)}</span>
      </span>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <span
        class="inline-flex items-center rounded-md border border-borderStrong bg-surface2 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-text2"
        data-testid="browse-sequence-warmup">{BROWSE.warmup(q.max_warmup_turns)}</span
      >
      <StatusChip status={q.status} />
    </div>
    <div class="flex flex-wrap items-center gap-1 md:justify-end">
      <a href={sequenceHref(q.id)} class={OPEN} title={BROWSE.openWhy}>
        {BROWSE.open}
        <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
      </a>
      <SaveButton
        path={pathFor(ROUTES.exportSequence, {
          params: { sequence_id: q.id },
          query: { format: 'json' },
        })}
        label={BROWSE.downloadJson}
        fallbackName={sequenceFileName(q.id, 'json')}
      />
      <ConfirmButton
        label={BROWSE.deleteSequence}
        confirmLabel={BROWSE.deleteSequenceConfirm}
        danger
        disabled={browse.removing.has(`sequence-${q.id}`)}
        onConfirm={() => browse.removeSequence(q.id).then(() => undefined)}
      />
    </div>
  </div>
{/snippet}

<section class="flex max-w-[1120px] flex-col gap-4 pb-6" data-testid="browse-screen">
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div class="min-w-0">
      <h1 class="text-base font-semibold text-text">{BROWSE.title}</h1>
      <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
        {SCREENS.browse}
      </p>
    </div>
  </header>

  <!-- Overview -->
  <section
    class="overflow-hidden rounded-lg border border-border bg-surface"
    aria-labelledby="browse-overview"
    data-testid="browse-overview"
    aria-busy={!ready}
  >
    <header class="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
      <div>
        <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
          {BROWSE.overviewEyebrow}
        </p>
        <h2 id="browse-overview" class="text-sm font-semibold text-text">
          {BROWSE.overviewTitle}
        </h2>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <SaveButton
          path={pathFor(ROUTES.exportAllData)}
          label={BROWSE.exportAll}
          title={BROWSE.exportAllWhy}
          fallbackName="flinch-export-all.json"
          disabled={!ready}
          tone="outline"
          testid="browse-export-all"
        />
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-dangerSoft focus:outline-none focus-visible:ring-1 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-50"
          title={BROWSE.clearAllWhy}
          disabled={!ready}
          onclick={() => (clearOpen = true)}
          data-testid="browse-clear-all"
        >
          <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
          {BROWSE.clearAll}
        </button>
      </div>
    </header>

    <dl class="mt-4 grid grid-cols-2 border-t border-border md:grid-cols-4">
      {#each TILES as t, i (t.key)}
        {@const Icon = t.icon}
        <div
          class="group relative flex flex-col gap-1 px-4 py-3.5 {i > 0
            ? 'border-l border-border'
            : ''} {i === 2 ? 'max-md:border-l-0 max-md:border-t' : ''} {i === 3
            ? 'max-md:border-t'
            : ''}"
          title={t.why}
          data-testid="browse-tile"
          data-tile={t.key}
        >
          <dt
            class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-text4"
          >
            <Icon class="h-3 w-3 text-text4 transition-colors group-hover:text-accentText" />
            {t.label}
          </dt>
          <dd
            class="font-mono text-2xl font-semibold leading-none tabular-nums {t.value
              ? 'text-text'
              : 'text-text4'}"
            data-testid="browse-tile-value"
          >
            {#if ready && t.value !== undefined}{t.value}{:else}<span
                class="inline-block h-6 w-10 animate-pulse rounded bg-surface2 align-middle"
              ></span>{/if}
          </dd>
        </div>
      {/each}
    </dl>

    {#if ready && totalOf(firstResponses) > 0}
      <div class="border-t border-border px-4 py-3" data-testid="browse-first-responses">
        <p class="mb-2 text-xs text-text3">{BROWSE.firstResponses}</p>
        <ClassBar counts={firstResponses} />
      </div>
    {/if}
  </section>

  <!-- Lists -->
  <div class="rounded-lg border border-border bg-surface pt-2" data-testid="browse-lists">
    <TabbedPanel {tabs} bind:activeTab={tab}>
      {#snippet children(current: string)}
        {@const items = itemsFor(asTab(current))}
        <div class="px-4 pb-2" aria-busy={!ready} data-testid="browse-tab" data-tab={current}>
          {#if !ready && !browse.error}
            <p class="py-4 text-xs text-text4">{BROWSE.listLoading}</p>
          {:else if browse.error && items.length === 0}
            <div class="flex items-center justify-between gap-3 py-4">
              <p class="text-sm text-danger">{browse.error}</p>
              <button type="button" class={BTN.secondary} onclick={() => browse.load()}>
                {BROWSE.loadAgain}
              </button>
            </div>
          {:else if items.length === 0}
            <div class="py-2" data-testid="browse-empty">
              <EmptyState title={BROWSE.empty} body={BROWSE.emptyBody} />
            </div>
          {:else}
            {#each groupByDate(items, (i) => i.created_at, now) as g (g.group)}
              <section aria-label={BROWSE.groups[g.group]} data-testid="browse-group">
                <h3
                  class="sticky top-0 z-10 -mx-4 flex items-center gap-3 bg-surface/95 px-4 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-text4 backdrop-blur"
                >
                  {BROWSE.groups[g.group]}
                  <span class="h-px flex-1 bg-border" aria-hidden="true"></span>
                  <span class="font-mono font-normal tabular-nums">{g.items.length}</span>
                </h3>
                <ul class="flex flex-col divide-y divide-border/70">
                  {#each g.items as item, i (item.key)}
                    <li in:fly={{ y: 6, duration: 180, delay: Math.min(i, 8) * 25 }}>
                      {#if item.kind === 'session'}
                        {@render sessionRow(item.row)}
                      {:else if item.kind === 'comparison'}
                        {@render comparisonRow(item.row)}
                      {:else if item.kind === 'study'}
                        {@render studyRow(item.row)}
                      {:else}
                        {@render sequenceRow(item.row)}
                      {/if}
                    </li>
                  {/each}
                </ul>
              </section>
            {/each}
          {/if}
        </div>
      {/snippet}
    </TabbedPanel>
  </div>

  <ClearAllDialog open={clearOpen} onClose={() => (clearOpen = false)} />
</section>
