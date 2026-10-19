<!--
  Scorecard (brief 9.2, D16, D21; formerly Policy Scorecard and Compliance
  Scorecard). No rail (D15). Opens with its research question, then two tabs:
  - Against policies: build a scorecard from sessions and repeat runs, the grid
    of models against linked policy claims (Matches, Over, Under,
    Context-dependent, No data; B27 direction), the legend, a cell's runs, and
    the saved scorecards.
  - This session: the current session's compliance, grouped by provider then
    category (Appendix C item 40), with a ClassBar and counts per group.
  `?tab=session` opens the second tab.
-->
<script lang="ts">
  import { page } from '$app/state';
  import TabbedPanel, { type TabDef } from '$lib/components/TabbedPanel.svelte';
  import { SCORECARD } from '$lib/copy/data';
  import { SCREENS } from '$lib/copy/screens';
  import { asScorecardTab, type ScorecardTab } from './scorecard';
  import ScorecardPolicies from './ScorecardPolicies.svelte';
  import ScorecardSession from './ScorecardSession.svelte';

  let tab = $state<ScorecardTab>(asScorecardTab(page.url.searchParams.get('tab')));

  const tabs: TabDef[] = [
    { id: 'policies', label: SCORECARD.tabPolicies, title: SCORECARD.tabPoliciesWhy },
    { id: 'session', label: SCORECARD.tabSession, title: SCORECARD.tabSessionWhy },
  ];
</script>

<section class="flex max-w-[1180px] flex-col gap-4 pb-6" data-testid="scorecard-screen">
  <header class="min-w-0">
    <h1 class="text-base font-semibold text-text">{SCORECARD.title}</h1>
    <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS.scorecard}
    </p>
  </header>

  <div data-testid="scorecard-tabs">
    <TabbedPanel {tabs} bind:activeTab={tab}>
      {#snippet children(current: string)}
        <div class="pt-4">
          {#if current === 'session'}
            <ScorecardSession />
          {:else}
            <ScorecardPolicies />
          {/if}
        </div>
      {/snippet}
    </TabbedPanel>
  </div>
</section>
