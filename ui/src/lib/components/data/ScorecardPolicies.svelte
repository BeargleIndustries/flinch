<!--
  Across models (brief 9.2): the build panel and the scorecard on screen
  on the left; the saved scorecards (GET /api/scorecards, "Open" loads GET
  /api/scorecard/{id}) and the legend, one sentence per cell word, on the
  right.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { FolderOpen } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { SCORECARD } from '$lib/copy/data';
  import { formatDate } from '$lib/format';
  import { VERDICTS } from './scorecard';
  import { scorecard } from './scorecard-store.svelte';
  import ScorecardBuild from './ScorecardBuild.svelte';
  import ScorecardGrid from './ScorecardGrid.svelte';
  import VerdictMark from './VerdictMark.svelte';

  $effect(() => {
    untrack(() => void scorecard.loadSaved());
  });

  const shownId = $derived(scorecard.view?.snapshotId ?? null);
</script>

<div
  class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_288px]"
  data-testid="scorecard-policies"
>
  <div class="flex min-w-0 flex-col gap-4">
    <ScorecardBuild />
    <ScorecardGrid />
  </div>

  <aside class="flex flex-col gap-4 lg:sticky lg:top-0">
    <Panel eyebrow={SCORECARD.savedEyebrow} title={SCORECARD.savedTitle}>
      <div data-testid="scorecard-saved" aria-busy={!scorecard.savedLoaded}>
        {#if !scorecard.savedLoaded}
          <p class="text-xs text-text4">{SCORECARD.savedLoading}</p>
        {:else if scorecard.savedError && scorecard.saved.length === 0}
          <button
            type="button"
            class="text-xs text-accentText underline-offset-2 hover:underline"
            onclick={() => void scorecard.loadSaved()}>{SCORECARD.loadAgain}</button
          >
        {:else if scorecard.saved.length === 0}
          <p class="text-xs text-text4">{SCORECARD.savedEmpty}</p>
        {:else}
          <ul class="-mx-1 flex max-h-80 flex-col overflow-y-auto">
            {#each scorecard.saved as s (s.id)}
              {@const current = shownId === s.id}
              <li
                class="flex items-center gap-2 rounded-md px-1 py-1.5 {current
                  ? 'bg-accentSoft/30'
                  : ''}"
                data-testid="scorecard-saved-row"
                data-snapshot-id={s.id}
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-medium text-text">{s.name}</p>
                  <p class="font-mono text-[10px] text-text4">
                    {formatDate(s.created_at)} · {SCORECARD.savedModels(s.models.length)}
                  </p>
                </div>
                {#if current}
                  <span class="shrink-0 px-2 text-[11px] text-accentText">{SCORECARD.opened}</span>
                {:else}
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-50"
                    disabled={scorecard.opening !== null || scorecard.generating}
                    onclick={() => void scorecard.open(s.id)}
                    data-testid="scorecard-open"
                  >
                    <FolderOpen class="h-3 w-3" aria-hidden="true" />
                    {SCORECARD.open}
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </Panel>

    <Panel title={SCORECARD.legendTitle}>
      <dl class="flex flex-col gap-2.5" data-testid="scorecard-legend">
        {#each VERDICTS as v (v)}
          <div class="flex flex-col gap-0.5" data-verdict={v}>
            <dt class="flex items-center gap-1.5 text-xs font-semibold text-text2">
              <VerdictMark verdict={v} />
              {SCORECARD.verdicts[v]}
            </dt>
            <dd class="pl-5 text-[11px] leading-snug text-text3">{SCORECARD.legend[v]}</dd>
          </div>
        {/each}
      </dl>
    </Panel>
  </aside>
</div>
