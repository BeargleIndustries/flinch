<!--
  Policy reader (brief 9.6, 9.9; Appendix C 62). The readout, then provider
  tabs All, Anthropic, OpenAI, Google, xAI: All reads GET /api/policies,
  each provider tab GET /api/policies/{provider}. Each claim row shows a
  severity dot (hard danger, medium warn, soft ok), the provider, the
  claim_id, the claim text cut at 140, a category chip and an
  expected-behaviour icon (should_allow a check in ok, should_refuse a
  square in danger, anything else a dot in muted). Expanding a row shows the
  columns that exist: Testable statement, Expected behaviour, Severity, and
  Notes when set.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Check, ChevronRight, Dot, Square } from 'lucide-svelte';
  import TabbedPanel from '$lib/components/TabbedPanel.svelte';
  import Readout from '$lib/components/Readout.svelte';
  import Term from '$lib/components/Term.svelte';
  import { POLICY_READER } from '$lib/copy/guide';
  import { SCREENS } from '$lib/copy/screens';
  import { BTN } from '../probe/styles';
  import {
    POLICY_TABS,
    claimExcerpt,
    expectedIcon,
    expectedTone,
    hasText,
    isPolicyTab,
    labelFor,
    severityTone,
    toggledId,
    type PolicyTab,
    type Tone,
  } from './policies';
  import { policies } from './policy-store.svelte';

  let tab = $state<PolicyTab>('all');
  let expanded = $state<Set<number>>(new Set());

  const tabs = POLICY_TABS.map((id) => ({ id, label: POLICY_READER.tabs[id] }));
  const current = $derived(policies.tabs[tab]);

  // Each visit reads the All tab afresh; provider tabs are read when opened.
  $effect(() => {
    untrack(() => {
      policies.reset();
      void policies.open('all');
    });
  });

  function onTab(id: string) {
    if (!isPolicyTab(id)) return;
    tab = id;
    void policies.open(id);
  }

  const DOT_TONE: Record<Tone, string> = {
    danger: 'bg-danger',
    warn: 'bg-warn',
    ok: 'bg-ok',
    muted: 'bg-text4',
  };
  const TEXT_TONE: Record<Tone, string> = {
    danger: 'text-danger',
    warn: 'text-warn',
    ok: 'text-ok',
    muted: 'text-text4',
  };
</script>

<section class="flex max-w-[1080px] flex-col gap-4 pb-10" data-testid="policy-reader">
  <header class="flex min-w-0 flex-col gap-2">
    <div>
      <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
        {POLICY_READER.eyebrow}
      </p>
      <h1 class="mt-0.5 text-base font-semibold text-text">{POLICY_READER.title}</h1>
    </div>
    <div data-testid="screen-question"><Readout text={SCREENS.policies} /></div>
  </header>

  <div class="rounded-lg border border-border bg-surface">
    <TabbedPanel {tabs} activeTab={tab} onTabChange={onTab}>
      {#snippet children(active: string)}
        <div
          class="flex flex-col"
          data-testid="policy-list"
          data-tab={active}
          aria-busy={!current.loaded}
        >
          {#if !current.loaded}
            <p class="px-4 py-6 text-xs text-text4">{POLICY_READER.loading}</p>
          {:else if current.error}
            <div class="flex items-center gap-3 px-4 py-4">
              <p class="text-sm text-text2">{POLICY_READER.failed}</p>
              <button
                type="button"
                class={BTN.secondary}
                onclick={() => void policies.open(tab, true)}>{POLICY_READER.loadAgain}</button
              >
            </div>
          {:else if current.rows.length === 0}
            <p class="px-4 py-6 text-sm text-text3">{POLICY_READER.empty}</p>
          {:else}
            <p
              class="px-4 pb-1 pt-3 font-mono text-[11px] tabular-nums text-text4"
              data-testid="policy-count"
            >
              {current.rows.length}
              <Term key="claims">{POLICY_READER.claimsWord(current.rows.length)}</Term>
            </p>
            <ul class="divide-y divide-border">
              {#each current.rows as c (c.id)}
                {@const open = expanded.has(c.id)}
                {@const sev = severityTone(c.severity)}
                {@const sevLabel = labelFor(POLICY_READER.severities, c.severity)}
                {@const icon = expectedIcon(c.expected_behavior)}
                {@const expLabel = labelFor(POLICY_READER.behaviours, c.expected_behavior)}
                <li data-testid="policy-claim" data-id={c.id} data-claim-id={c.claim_id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls="claim-detail-{c.id}"
                    onclick={() => (expanded = toggledId(expanded, c.id))}
                    class="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface2 focus:outline-none focus-visible:bg-surface2 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accentHover"
                  >
                    <span
                      class="mt-1.5 flex h-2 w-2 shrink-0"
                      title={POLICY_READER.severityDot(sevLabel)}
                    >
                      <span class="h-2 w-2 rounded-full {DOT_TONE[sev]}" aria-hidden="true"></span>
                      <span class="sr-only">{POLICY_READER.severityDot(sevLabel)}</span>
                    </span>
                    <span class="min-w-0">
                      <span class="flex flex-wrap items-baseline gap-x-2">
                        <span class="text-[10px] font-medium uppercase tracking-wider text-text4"
                          >{c.provider}</span
                        >
                        <span class="font-mono text-[11px] text-text3">{c.claim_id}</span>
                      </span>
                      <span class="mt-0.5 block text-sm leading-snug text-text">
                        {claimExcerpt(c.claim_text)}
                      </span>
                    </span>
                    <span class="flex items-center gap-2 pt-0.5">
                      <span
                        class="rounded border border-borderStrong px-1.5 py-0.5 font-mono text-[10px] text-text3"
                        >{c.category}</span
                      >
                      <span
                        class="inline-flex h-4 w-4 items-center justify-center {TEXT_TONE[
                          expectedTone(c.expected_behavior)
                        ]}"
                        title={POLICY_READER.expectedIcon(expLabel)}
                      >
                        {#if icon === 'check'}
                          <Check class="h-3.5 w-3.5" aria-hidden="true" />
                        {:else if icon === 'square'}
                          <Square class="h-3 w-3" aria-hidden="true" />
                        {:else}
                          <Dot class="h-4 w-4" aria-hidden="true" />
                        {/if}
                        <span class="sr-only">{POLICY_READER.expectedIcon(expLabel)}</span>
                      </span>
                      <ChevronRight
                        class="h-3.5 w-3.5 text-text4 transition-transform {open
                          ? 'rotate-90'
                          : ''}"
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  {#if open}
                    <dl
                      id="claim-detail-{c.id}"
                      class="mx-4 mb-3 ml-9 grid gap-x-6 gap-y-2 rounded-md border border-border bg-bg/60 px-3 py-2.5 text-sm sm:grid-cols-[160px_minmax(0,1fr)]"
                      data-testid="policy-claim-detail"
                    >
                      <dt class="text-xs font-medium text-text3">{POLICY_READER.testable}</dt>
                      <dd class="leading-relaxed text-text">{c.testable_statement ?? ''}</dd>
                      <dt class="text-xs font-medium text-text3">{POLICY_READER.expected}</dt>
                      <dd class="text-text2">{expLabel}</dd>
                      <dt class="text-xs font-medium text-text3">{POLICY_READER.severity}</dt>
                      <dd class="flex items-center gap-2 text-text2">
                        <span class="h-2 w-2 rounded-full {DOT_TONE[sev]}" aria-hidden="true"
                        ></span>
                        {sevLabel}
                      </dd>
                      {#if hasText(c.notes)}
                        <dt class="text-xs font-medium text-text3">{POLICY_READER.notes}</dt>
                        <dd class="whitespace-pre-wrap leading-relaxed text-text2">{c.notes}</dd>
                      {/if}
                    </dl>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/snippet}
    </TabbedPanel>
  </div>
</section>
