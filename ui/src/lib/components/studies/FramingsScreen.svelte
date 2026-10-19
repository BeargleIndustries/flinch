<!--
  Framings (brief 8.1, D16): opens with its research question; "No session
  yet" while none is picked (brief 8: Framings needs a session). Tabs Groups
  (the group list, the run panel, New framing group) and Results (the
  consistency view).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import TabbedPanel from '$lib/components/TabbedPanel.svelte';
  import NoSession from '$lib/components/shell/NoSession.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import { FRAMINGS } from '$lib/copy/studies';
  import { session } from '$lib/stores/session.svelte';
  import FramingEditor from './FramingEditor.svelte';
  import FramingGroupList from './FramingGroupList.svelte';
  import FramingResults from './FramingResults.svelte';
  import { framings } from './framings.svelte';

  const tabs = [
    {
      id: 'groups',
      label: FRAMINGS.tabGroups,
      title: FRAMINGS.tabGroupsWhy,
      anchor: 'framings-groups',
    },
    {
      id: 'results',
      label: FRAMINGS.tabResults,
      title: FRAMINGS.tabResultsWhy,
      anchor: 'framings-results',
    },
  ];
  let tab = $state('groups');

  const noSession = $derived(session.loaded && !session.current);

  // Groups and files are global; load once per visit.
  $effect(() => {
    untrack(() => void framings.load());
  });
</script>

<section class="flex max-w-[960px] flex-col gap-4 pb-6" data-testid="framings-screen">
  <header>
    <h1 class="text-base font-semibold text-text">{FRAMINGS.title}</h1>
    <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS.framings}
    </p>
  </header>

  {#if noSession}
    <div class="rounded-xl border border-dashed border-border"><NoSession /></div>
  {:else}
    <TabbedPanel {tabs} bind:activeTab={tab}>
      {#snippet children(current)}
        <div class="pt-4">
          {#if current === 'results'}
            <FramingResults />
          {:else}
            <div class="flex flex-col gap-6">
              <FramingGroupList onResults={() => (tab = 'results')} />
              <FramingEditor />
            </div>
          {/if}
        </div>
      {/snippet}
    </TabbedPanel>
  {/if}
</section>
