<!--
  Sequences (brief 8.4, D16, D30; formerly Narrative Momentum): opens with its
  research question, "No session yet" while none is picked, then two tabs.
  Run builds and runs sequences (T25); Results reads completed ones (T26).
  "Show results" on a card switches to Results with that sequence picked.
-->
<script lang="ts">
  import EmptyState from '$lib/components/EmptyState.svelte';
  import TabbedPanel from '$lib/components/TabbedPanel.svelte';
  import NoSession from '$lib/components/shell/NoSession.svelte';
  import SequenceRun from '$lib/components/studies/SequenceRun.svelte';
  import { sequences } from '$lib/components/studies/sequences.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import { SEQUENCES as S } from '$lib/copy/studies';
  import { probes } from '$lib/stores/probe.svelte';
  import { session } from '$lib/stores/session.svelte';

  const sessionId = $derived(session.current?.id ?? null);
  const noSession = $derived(session.loaded && !session.current);

  const tabs = [
    { id: 'run', label: S.tabRun, title: S.tabRunWhy },
    { id: 'results', label: S.tabResults, title: S.tabResultsWhy },
  ];

  const picked = $derived(
    sequences.resultsFor === null ? null : sequences.sequenceById(sequences.resultsFor),
  );
  const pickedName = $derived(
    picked
      ? (probes.list.find((p) => p.id === picked.probe_id)?.name ??
          S.probeFallback(picked.probe_id))
      : '',
  );
</script>

<section class="flex max-w-[1120px] flex-col gap-4 pb-6" data-testid="sequences-screen">
  <header>
    <h1 class="text-base font-semibold text-text">{S.title}</h1>
    <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS.sequences}
    </p>
  </header>

  {#if noSession}
    <div class="rounded-xl border border-dashed border-border"><NoSession /></div>
  {:else if sessionId !== null}
    {#key sessionId}
      <TabbedPanel {tabs} bind:activeTab={sequences.tab}>
        {#snippet children(current)}
          <div class="pt-4">
            {#if current === 'results'}
              <div
                class="rounded-xl border border-dashed border-border"
                data-testid="sequence-results"
                data-sequence-id={picked?.id ?? ''}
              >
                <EmptyState title={S.resultsSoonTitle} body={S.resultsSoonBody} />
                {#if picked}
                  <p class="-mt-6 pb-6 text-center font-mono text-[11px] text-text4">
                    {S.resultsPicked(pickedName)}
                  </p>
                {/if}
              </div>
            {:else}
              <SequenceRun {sessionId} />
            {/if}
          </div>
        {/snippet}
      </TabbedPanel>
    {/key}
  {/if}
</section>
