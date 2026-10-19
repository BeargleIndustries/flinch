<!--
  Conditions studies (brief 8.2.1, D28): global, not tied to a session. Opens
  with the research question; "New study" top right; one row per study,
  newest first, with its status, models, created date and cell counts
  (GET /api/experiments, then GET /progress per study).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { ArrowRight, Plus } from 'lucide-svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { Experiment, ExperimentList, StudyProgress } from '$lib/api/types';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import { CONDITIONS } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { formatDate } from '$lib/format';
  import { status } from '$lib/stores/status.svelte';
  import { BTN } from '../probe/styles';
  import { studyRoute } from './conditions';

  let studies = $state<Experiment[]>([]);
  let counts = $state<Record<number, StudyProgress>>({});
  let loaded = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    untrack(() => void load());
  });

  async function load() {
    try {
      const list = await status.track(request<ExperimentList>(ROUTES.listExperiments));
      studies = list.experiments;
      const progress = await status.track(
        Promise.all(
          list.experiments.map((s) =>
            request<StudyProgress>(ROUTES.getExperimentProgress, {
              params: { experiment_id: s.id },
            }).catch(() => null),
          ),
        ),
      );
      const next: Record<number, StudyProgress> = {};
      progress.forEach((p, i) => {
        if (p) next[list.experiments[i].id] = p;
      });
      counts = next;
    } catch (e) {
      const f = friendlyError(e);
      error = f.message;
      status.error(f.message, f.details);
    } finally {
      loaded = true;
    }
  }
</script>

<section class="flex max-w-[960px] flex-col gap-4 pb-6" data-testid="conditions-list">
  <header class="flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-base font-semibold text-text">{CONDITIONS.title}</h1>
      <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
        {SCREENS['conditions.list']}
      </p>
    </div>
    <a href="/studies/conditions/new" class={BTN.primary} data-testid="new-study">
      <Plus class="h-3.5 w-3.5" aria-hidden="true" />
      {CONDITIONS.newStudy}
    </a>
  </header>

  {#if loaded && error}
    <p class="text-sm text-danger">{error}</p>
  {:else if loaded && studies.length === 0}
    <div class="rounded-xl border border-dashed border-border" data-testid="conditions-empty">
      <EmptyState title={CONDITIONS.emptyTitle} body={CONDITIONS.emptyBody} />
    </div>
  {:else if studies.length > 0}
    <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
      {CONDITIONS.listEyebrow}
      <span class="ml-1 font-mono tabular-nums text-text3"
        >{CONDITIONS.listCount(studies.length)}</span
      >
    </p>
    <ul class="flex flex-col gap-2">
      {#each studies as s, i (s.id)}
        {@const p = counts[s.id]}
        <li in:fly={{ y: 6, duration: 180, delay: Math.min(i, 8) * 25 }}>
          <a
            href={studyRoute(s.id)}
            aria-label={CONDITIONS.openStudy(s.name)}
            class="group grid gap-x-4 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-borderStrong hover:bg-surface2/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover sm:grid-cols-[1fr_auto]"
            data-testid="study-row"
            data-study-id={s.id}
          >
            <div class="flex min-w-0 flex-col gap-1.5">
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate text-sm font-medium text-text">{s.name}</span>
                <StatusChip status={s.status} />
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                {#each s.model_ids ?? [] as m (m)}
                  <span
                    class="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text3"
                    >{m}</span
                  >
                {/each}
                <span class="text-[11px] text-text4"
                  >{CONDITIONS.createdOn(formatDate(s.created_at))}</span
                >
              </div>
            </div>
            <div class="flex items-center gap-4 sm:justify-end">
              {#if p && p.total > 0}
                <div class="flex w-40 flex-col gap-1">
                  <span class="font-mono text-[11px] tabular-nums text-text3"
                    >{CONDITIONS.cellsDone(p.completed, p.total)}</span
                  >
                  <span class="h-1 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                    <span
                      class="block h-full rounded-full bg-accent"
                      style:width="{(p.completed / p.total) * 100}%"
                    ></span>
                  </span>
                </div>
              {:else}
                <span class="text-[11px] text-text4">{CONDITIONS.noCellsYet}</span>
              {/if}
              <span
                class="inline-flex items-center gap-1 text-xs text-text3 transition-colors group-hover:text-accentText"
              >
                {CONDITIONS.open}
                <ArrowRight
                  class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
