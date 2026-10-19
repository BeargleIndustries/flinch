<!--
  This session (brief 9.2, D21; formerly Compliance Scorecard): GET
  /api/sessions/{id}/compliance for the current session, "No session yet"
  while none is picked. Three readouts (Average compliance, Claims tested,
  Compliant at 80% or more), then providers, then categories (Appendix C item
  40), each with a ClassBar of its first responses and the counts; under each
  category one row per claim: slug, text, a bar of its compliance rate, and
  "{n} runs:" with the four badge counts.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ClassBar from '$lib/components/ClassBar.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Readout from '$lib/components/Readout.svelte';
  import NoSession from '$lib/components/shell/NoSession.svelte';
  import { SCORECARD } from '$lib/copy/data';
  import { SCREENS } from '$lib/copy/screens';
  import { pct } from '$lib/format';
  import { session } from '$lib/stores/session.svelte';
  import { barWidth, isCompliant } from './scorecard';
  import { scorecard } from './scorecard-store.svelte';

  const sessionId = $derived(session.current?.id ?? null);
  const noSession = $derived(session.loaded && !session.current);
  const ready = $derived(sessionId !== null && scorecard.complianceReadyFor(sessionId));
  const view = $derived(ready ? scorecard.compliance : null);

  // Follows the current session; each visit reads it again.
  $effect(() => {
    const id = sessionId;
    if (id === null) return;
    untrack(() => void scorecard.loadCompliance(id));
  });

  const providerName = (p: string) => SCORECARD.providerNames[p] ?? p;

  const COUNT_CLS = ['refused', 'collapsed', 'negotiated', 'complied'] as const;

  const TILES = $derived([
    {
      key: 'average',
      label: SCORECARD.tileAverage,
      value: view ? pct(view.summary.average_compliance_rate) : null,
    },
    {
      key: 'tested',
      label: SCORECARD.tileTested,
      value: view ? String(view.summary.total_claims_tested) : null,
    },
    {
      key: 'compliant',
      label: SCORECARD.tileCompliant,
      value: view ? String(view.summary.compliant_claims) : null,
    },
  ]);
</script>

{#if noSession}
  <NoSession />
{:else}
  <section class="flex flex-col gap-4" data-testid="scorecard-session" aria-busy={!ready}>
    <div class="overflow-hidden rounded-lg border border-border bg-surface">
      <header class="flex flex-col gap-3 px-4 pt-4">
        <div class="min-w-0">
          <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
            {SCORECARD.sessionEyebrow}
          </p>
          <h2 class="truncate text-sm font-semibold text-text">
            {SCORECARD.sessionTitle(session.current?.name ?? '')}
          </h2>
        </div>
        <Readout text={SCREENS['scorecard.session']} />
      </header>

      <dl class="mt-4 grid grid-cols-3 border-t border-border">
        {#each TILES as t, i (t.key)}
          <div
            class="flex flex-col gap-1 px-4 py-3.5 {i > 0 ? 'border-l border-border' : ''}"
            data-testid="scorecard-session-tile"
            data-tile={t.key}
          >
            <dt class="text-[10px] font-medium uppercase tracking-widest text-text4">{t.label}</dt>
            <dd
              class="font-mono text-2xl font-semibold leading-none tabular-nums text-text"
              data-testid="scorecard-session-tile-value"
            >
              {#if t.value !== null}{t.value}{:else}<span
                  class="inline-block h-6 w-10 animate-pulse rounded bg-surface2 align-middle"
                ></span>{/if}
            </dd>
          </div>
        {/each}
      </dl>
    </div>

    {#if !view}
      {#if ready && scorecard.complianceError}
        <button
          type="button"
          class="w-fit text-xs text-accentText underline-offset-2 hover:underline"
          onclick={() => sessionId !== null && void scorecard.loadCompliance(sessionId)}
          >{SCORECARD.loadAgain}</button
        >
      {:else}
        <p class="text-xs text-text4">{SCORECARD.sessionLoading}</p>
      {/if}
    {:else if view.providers.length === 0}
      <div class="rounded-lg border border-border bg-surface" data-testid="scorecard-session-empty">
        <EmptyState
          title={SCORECARD.sessionEmptyTitle}
          body={SCORECARD.sessionEmpty}
          action={{ label: SCORECARD.sessionEmptyAction, onClick: () => void goto('/probe') }}
        />
      </div>
    {:else}
      {#each view.providers as p (p.provider)}
        <section
          class="overflow-hidden rounded-lg border border-border bg-surface"
          aria-labelledby="sc-provider-{p.provider}"
          data-testid="compliance-provider"
          data-provider={p.provider}
        >
          <header
            class="grid items-center gap-3 border-b border-border px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)]"
          >
            <div class="flex min-w-0 items-baseline gap-2">
              <h3 id="sc-provider-{p.provider}" class="text-sm font-semibold text-text">
                {providerName(p.provider)}
              </h3>
              <span class="font-mono text-[11px] text-text4"
                >{SCORECARD.providerRuns(p.runs)} · {SCORECARD.claims(
                  p.categories.reduce((n, c) => n + c.claims.length, 0),
                )}</span
              >
            </div>
            <ClassBar counts={p.counts} legend={false} />
          </header>

          {#each p.categories as c (c.category)}
            <div
              class="border-b border-border/60 px-4 py-3 last:border-b-0"
              data-testid="compliance-category"
              data-provider={p.provider}
              data-category={c.category}
              data-runs={c.runs}
              data-refused={c.counts.refused ?? 0}
              data-collapsed={c.counts.collapsed ?? 0}
              data-negotiated={c.counts.negotiated ?? 0}
              data-complied={c.counts.complied ?? 0}
            >
              <div class="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)]">
                <div class="min-w-0">
                  <h4 class="text-xs font-semibold uppercase tracking-wider text-text2">
                    {c.category}
                  </h4>
                  <p class="font-mono text-[11px] text-text4">{SCORECARD.categoryRuns(c.runs)}</p>
                </div>
                <div
                  aria-label={SCORECARD.groupBarLabel(providerName(p.provider), c.category)}
                  role="group"
                >
                  <ClassBar counts={c.counts} />
                </div>
              </div>

              <ul class="mt-2.5 flex flex-col gap-2">
                {#each c.claims as claim (claim.claim_id)}
                  {@const ok = isCompliant(claim.compliance_rate)}
                  <li
                    class="grid gap-x-4 gap-y-1.5 rounded-md bg-bg/40 px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)]"
                    data-testid="compliance-claim"
                    data-claim-slug={claim.claim_slug}
                  >
                    <div class="min-w-0">
                      <p class="font-mono text-[11px] text-accentText">{claim.claim_slug}</p>
                      <p class="line-clamp-2 text-xs leading-snug text-text2">{claim.claim_text}</p>
                    </div>
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <div
                          class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface2"
                          role="img"
                          aria-label={SCORECARD.rateLabel(
                            claim.claim_slug,
                            pct(claim.compliance_rate),
                          )}
                        >
                          <span
                            class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 {ok
                              ? 'bg-ok'
                              : 'bg-danger'}"
                            style:width="{barWidth(claim.compliance_rate)}%"
                          ></span>
                          <span
                            class="absolute inset-y-0 left-[80%] w-px bg-text4/60"
                            aria-hidden="true"
                          ></span>
                        </div>
                        <span
                          class="w-10 text-right font-mono text-xs font-semibold tabular-nums {ok
                            ? 'text-ok'
                            : 'text-danger'}"
                          data-testid="compliance-rate">{pct(claim.compliance_rate)}</span
                        >
                      </div>
                      <p
                        class="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-text3"
                      >
                        <span>{SCORECARD.claimCounts(claim.probe_count)}</span>
                        {#each COUNT_CLS as k (k)}
                          {@const n =
                            k === 'refused'
                              ? claim.refused_count
                              : k === 'collapsed'
                                ? claim.collapsed_count
                                : k === 'negotiated'
                                  ? claim.negotiated_count
                                  : claim.complied_count}
                          <span class="inline-flex items-center gap-1 {n ? '' : 'opacity-50'}">
                            <ClassBadge value={k} size="sm" glyphOnly />
                            <span class="tabular-nums">{n}</span>
                          </span>
                        {/each}
                      </p>
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </section>
      {/each}
    {/if}
  </section>
{/if}
