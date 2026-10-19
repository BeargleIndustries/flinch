<!--
  Policy links under the probe card (brief 7.2): a chip "{provider} ·
  {claim_id}" per linked claim (GET /api/probes/{id}/claims), each with an x
  that unlinks it (DELETE /api/probes/{id}/claims/{claim db id}), and "Link a
  claim…" for the Link policy claims dialog. With no links the readout says
  why linking matters: Scorecard reads these links.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { X } from 'lucide-svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import LinkClaimDialog from '$lib/components/dialogs/LinkClaimDialog.svelte';
  import Readout from '$lib/components/Readout.svelte';
  import { PROBE } from '$lib/copy/probe';
  import { SCREENS } from '$lib/copy/screens';
  import { friendlyError } from '$lib/errors';
  import { status } from '$lib/stores/status.svelte';
  import type { PolicyClaim } from './claims';

  let { probeId }: { probeId: number } = $props();

  let claims = $state<PolicyClaim[]>([]);
  let loaded = $state(false);
  let dialogOpen = $state(false);

  const linkedIds = $derived(new Set(claims.map((c) => c.id)));

  function report(e: unknown) {
    const f = friendlyError(e);
    status.error(f.message, f.details);
  }

  async function load() {
    try {
      claims = await status.track(
        request<PolicyClaim[]>(ROUTES.listProbeClaims, { params: { probe_id: probeId } }),
      );
    } catch (e) {
      report(e);
    } finally {
      loaded = true;
    }
  }

  async function unlink(claim: PolicyClaim) {
    try {
      await status.track(
        request(ROUTES.unlinkProbeClaim, { params: { probe_id: probeId, claim_id: claim.id } }),
      );
    } catch (e) {
      report(e);
    }
    await load();
  }

  onMount(() => void load());
</script>

<section
  aria-label={PROBE.policyLabel}
  class="flex flex-col gap-2 rounded-lg border border-border/70 bg-surface/60 px-4 py-3"
  data-testid="policy-links"
>
  <div class="flex flex-wrap items-center gap-2">
    <p class="mr-1 text-[10px] font-medium uppercase tracking-widest text-text4">
      {PROBE.policyEyebrow}
    </p>
    {#each claims as claim (claim.id)}
      <span
        class="inline-flex items-center gap-1 rounded-md border border-borderStrong bg-surface2 py-0.5 pl-2 pr-0.5 font-mono text-[11px] text-text2"
        title={claim.claim_text}
        data-testid="claim-chip"
      >
        {PROBE.claimChip(claim.provider, claim.claim_id)}
        <button
          type="button"
          aria-label={PROBE.unlink}
          onclick={() => unlink(claim)}
          class="rounded p-0.5 text-text4 hover:bg-surface hover:text-danger focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
        >
          <X class="h-3 w-3" aria-hidden="true" />
        </button>
      </span>
    {/each}
    <button
      type="button"
      onclick={() => (dialogOpen = true)}
      class="text-xs text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
    >
      {PROBE.linkClaim}
    </button>
  </div>
  {#if loaded && claims.length === 0}
    <Readout text={SCREENS['probe.policyEmpty']} />
  {/if}
</section>

<LinkClaimDialog
  open={dialogOpen}
  {probeId}
  linked={linkedIds}
  onClose={() => (dialogOpen = false)}
  onLinked={() => {
    dialogOpen = false;
    void load();
  }}
/>
