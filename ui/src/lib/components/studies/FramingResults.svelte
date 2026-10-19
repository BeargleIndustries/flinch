<!--
  Results tab (brief 8.1): GET /api/sessions/{id}/consistency. The score as
  "{score}%" with "{consistent} of {total} groups that ran got the same badge
  on every framing" and a strip that splits every group into consistent,
  inconsistent and not run; then one card per group with its verdict and a
  tile per framing (label, probe name, ClassBadge or "Not run"), each tile
  linking to its run. Reloads when it opens and when a batch in this session
  ends.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { RotateCw } from 'lucide-svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { FRAMINGS } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { session } from '$lib/stores/session.svelte';
  import { status } from '$lib/stores/status.svelte';
  import { batch } from '../probe/batch.svelte';
  import { BTN } from '../probe/styles';
  import { orderResults, verdict, type Consistency, type Verdict } from './framings';

  const sessionId = $derived(session.current?.id ?? null);
  let data = $state<Consistency | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  /** Bumped per load, so an older answer never replaces a newer one. */
  let epoch = 0;

  async function load(id: number) {
    const mine = ++epoch;
    loading = true;
    error = null;
    try {
      const res = await status.track(
        request<Consistency>(ROUTES.getSessionConsistency, { params: { session_id: id } }),
      );
      if (mine === epoch) data = res;
    } catch (e) {
      if (mine !== epoch) return;
      const f = friendlyError(e);
      error = f.message;
      status.error(f.message, f.details);
    } finally {
      if (mine === epoch) loading = false;
    }
  }

  // On open, on a session change, and when a batch in this session ends.
  const ended = $derived(
    batch.sessionId === sessionId && (batch.phase === 'finished' || batch.phase === 'stopped'),
  );
  $effect(() => {
    const id = sessionId;
    void ended;
    if (id === null) return;
    untrack(() => void load(id));
  });

  const groups = $derived(data ? orderResults(data.groups) : []);
  const counts = $derived.by(() => {
    const c: Record<Verdict, number> = { consistent: 0, inconsistent: 0, 'not-run': 0 };
    for (const g of groups) c[verdict(g)] += 1;
    return c;
  });
  const score = $derived(data?.consistency_score ?? null);
  const readout = $derived(
    data === null
      ? null
      : score === null
        ? FRAMINGS.resultsNone
        : FRAMINGS.resultsReadout(data.consistent_count, data.total_groups),
  );

  const VERDICT: Record<Verdict, { label: string; tone: string; rule: string }> = {
    consistent: {
      label: FRAMINGS.consistent,
      tone: 'border-ok/40 bg-ok/10 text-ok',
      rule: 'bg-ok',
    },
    inconsistent: {
      label: FRAMINGS.inconsistent,
      tone: 'border-warn/40 bg-warn/10 text-warn',
      rule: 'bg-warn',
    },
    'not-run': {
      label: FRAMINGS.notRun,
      tone: 'border-borderStrong bg-surface2/50 text-text4',
      rule: 'bg-borderStrong',
    },
  };

  const pct = (n: number) => (groups.length ? (n / groups.length) * 100 : 0);
</script>

<div class="flex flex-col gap-4" data-testid="framing-results">
  <Panel eyebrow={FRAMINGS.resultsEyebrow} title={FRAMINGS.resultsTitle} {readout}>
    {#snippet actions()}
      <button
        type="button"
        class={BTN.ghost}
        disabled={loading || sessionId === null}
        onclick={() => sessionId !== null && load(sessionId)}
      >
        <RotateCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" aria-hidden="true" />
        {FRAMINGS.reload}
      </button>
    {/snippet}

    <div class="flex flex-wrap items-end gap-x-8 gap-y-3" data-testid="consistency-summary">
      <p
        class="font-mono text-4xl font-semibold leading-none tabular-nums {score === null
          ? 'text-text4'
          : 'text-text'}"
        data-testid="consistency-score"
      >
        {#key score}
          <span class="inline-block" in:fly={{ y: 6, duration: 220 }}
            >{score === null ? '--' : FRAMINGS.resultsScore(score)}</span
          >
        {/key}
      </p>
      {#if groups.length > 0}
        <div class="flex min-w-[12rem] flex-1 flex-col gap-1.5">
          <div
            class="flex h-1.5 w-full overflow-hidden rounded-full bg-surface2"
            role="img"
            aria-label={`${FRAMINGS.consistent} ${counts.consistent}, ${FRAMINGS.inconsistent} ${counts.inconsistent}, ${FRAMINGS.notRun} ${counts['not-run']}`}
          >
            {#each ['consistent', 'inconsistent', 'not-run'] as const as v (v)}
              {#if counts[v] > 0}
                <span
                  class="h-full transition-[width] duration-500 ease-out {VERDICT[v].rule}"
                  style:width="{pct(counts[v])}%"
                ></span>
              {/if}
            {/each}
          </div>
          <p class="flex flex-wrap gap-x-4 text-[11px] text-text3">
            {#each ['consistent', 'inconsistent', 'not-run'] as const as v (v)}
              <span class="inline-flex items-center gap-1.5">
                <span class="h-1.5 w-1.5 rounded-full {VERDICT[v].rule}" aria-hidden="true"></span>
                {VERDICT[v].label}
                <span class="font-mono tabular-nums text-text2">{counts[v]}</span>
              </span>
            {/each}
          </p>
        </div>
      {/if}
    </div>
    {#if error}
      <p class="text-xs text-danger" role="alert">{error}</p>
    {/if}
  </Panel>

  {#if data && groups.length === 0}
    <div class="rounded-xl border border-dashed border-border">
      <EmptyState title={FRAMINGS.emptyTitle} body={FRAMINGS.resultsEmpty} />
    </div>
  {/if}

  {#each groups as g (g.group_id)}
    {@const v = verdict(g)}
    <section
      class="relative overflow-hidden rounded-lg border border-border bg-surface p-4 pl-5"
      data-testid="consistency-group"
      data-group-id={g.group_id}
      data-verdict={v}
      aria-labelledby="cg-{g.group_id}"
      in:fly={{ y: 6, duration: 180 }}
    >
      <span class="absolute inset-y-0 left-0 w-[3px] {VERDICT[v].rule}" aria-hidden="true"></span>
      <header class="mb-3 flex items-center justify-between gap-3">
        <h3 id="cg-{g.group_id}" class="truncate font-mono text-sm font-semibold text-text">
          {g.group_id}
        </h3>
        <span
          class="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium {VERDICT[v].tone}"
          data-testid="consistency-verdict">{VERDICT[v].label}</span
        >
      </header>
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
        {#each g.variants as t, i (t.probe_id)}
          <li data-testid="consistency-tile" data-run-id={t.run_id ?? ''}>
            {#if t.run_id !== null}
              <a
                href="/probe/runs/{t.run_id}"
                aria-label={FRAMINGS.openRun(t.variant_label)}
                class="flex h-full flex-col gap-2 rounded-md border border-border bg-bg/40 p-2.5 transition-colors hover:border-accent/50 hover:bg-surface2/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
              >
                {@render tile(t.variant_label, t.probe_name, t.classification, i)}
              </a>
            {:else}
              <div
                class="flex h-full flex-col gap-2 rounded-md border border-dashed border-border p-2.5"
              >
                {@render tile(t.variant_label, t.probe_name, null, i)}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

{#snippet tile(label: string, probe: string, cls: string | null, i: number)}
  <span class="flex items-baseline gap-1.5 text-xs font-medium text-text2">
    <span class="font-mono text-[10px] tabular-nums text-accentText"
      >{String(i + 1).padStart(2, '0')}</span
    >
    <span class="truncate">{label}</span>
  </span>
  <span class="truncate font-mono text-[11px] text-text4" title={probe}>{probe}</span>
  <span class="mt-auto" data-testid="consistency-result">
    {#if cls !== null}
      <span class="inline-flex" in:scale={{ start: 0.8, duration: 200 }}>
        <ClassBadge value={cls} size="sm" />
      </span>
    {:else}
      <span class="text-[11px] text-text4">{FRAMINGS.notRun}</span>
    {/if}
  </span>
{/snippet}
