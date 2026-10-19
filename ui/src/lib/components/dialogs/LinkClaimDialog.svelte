<!--
  Link policy claims (brief 7.2): a search box over the claims of GET
  /api/policies (`{provider: [claim]}`), grouped by provider with a checkbox
  per claim. Claims already linked to the probe show checked and disabled.
  "Link {n} claims" posts the new ids (POST /api/probes/{id}/claims).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import Dialog from '$lib/components/Dialog.svelte';
  import { filterClaims, toLink, type PoliciesByProvider } from '$lib/components/probe/claims';
  import { LINK_CLAIMS } from '$lib/copy/probe';
  import { friendlyError } from '$lib/errors';
  import { status } from '$lib/stores/status.svelte';

  interface Props {
    open: boolean;
    probeId: number;
    /** Database ids of the claims already linked. */
    linked: ReadonlySet<number>;
    onClose: () => void;
    onLinked: () => void;
  }

  let { open, probeId, linked, onClose, onLinked }: Props = $props();

  const uid = $props.id();

  let byProvider = $state<PoliciesByProvider>({});
  let loading = $state(false);
  let query = $state('');
  let checked = $state<Set<number>>(new Set());
  let busy = $state(false);
  let error = $state<string | null>(null);

  const groups = $derived(filterClaims(byProvider, query));
  const total = $derived(Object.values(byProvider).reduce((n, list) => n + list.length, 0));
  const ids = $derived(toLink(checked, linked));

  // Fresh each time it opens. Untracked, so the request's own state
  // (status.track) does not re-run this effect.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      query = '';
      checked = new Set();
      error = null;
      void load();
    });
  });

  async function load() {
    loading = true;
    try {
      byProvider = await status.track(request<PoliciesByProvider>(ROUTES.listPolicies));
    } catch (e) {
      error = friendlyError(e).message;
    } finally {
      loading = false;
    }
  }

  function toggle(id: number) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    checked = next;
  }

  async function submit() {
    if (ids.length === 0 || busy) return;
    busy = true;
    error = null;
    try {
      await status.track(
        request(ROUTES.linkProbeClaims, {
          params: { probe_id: probeId },
          body: { claim_ids: ids },
        }),
      );
      onLinked();
    } catch (e) {
      error = friendlyError(e).message;
    } finally {
      busy = false;
    }
  }
</script>

<Dialog {open} {onClose} title={LINK_CLAIMS.title} lead={LINK_CLAIMS.lead} width="lg">
  <div class="flex flex-col gap-3" data-testid="link-claim-dialog">
    <label for="claim-search-{uid}" class="sr-only">{LINK_CLAIMS.search}</label>
    <input
      id="claim-search-{uid}"
      type="search"
      placeholder={LINK_CLAIMS.search}
      bind:value={query}
      class="w-full rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-sm text-text placeholder:text-text4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
    <div class="max-h-[46vh] overflow-y-auto rounded-md border border-border">
      {#if loading && total === 0}
        <p class="px-3 py-4 text-xs text-text4">{LINK_CLAIMS.loading}</p>
      {:else if total === 0}
        <p class="px-3 py-4 text-xs text-text4">{LINK_CLAIMS.none}</p>
      {:else if groups.length === 0}
        <p class="px-3 py-4 text-xs text-text4">{LINK_CLAIMS.noMatch}</p>
      {:else}
        {#each groups as group (group.provider)}
          <fieldset class="border-b border-border/60 last:border-b-0">
            <legend
              class="sticky top-0 w-full bg-surface2 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-text3"
            >
              {group.provider}
            </legend>
            {#each group.claims as claim (claim.id)}
              {@const isLinked = linked.has(claim.id)}
              <label
                class="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-left hover:bg-surface2/60 {isLinked
                  ? 'cursor-default opacity-60'
                  : ''}"
              >
                <input
                  type="checkbox"
                  class="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                  checked={isLinked || checked.has(claim.id)}
                  disabled={isLinked}
                  onchange={() => toggle(claim.id)}
                />
                <span class="min-w-0">
                  <span class="flex items-center gap-2">
                    <span class="font-mono text-[12px] text-text">{claim.claim_id}</span>
                    <span class="text-[11px] text-text4">{claim.category}</span>
                    {#if isLinked}
                      <span class="text-[11px] text-ok">{LINK_CLAIMS.linked}</span>
                    {/if}
                  </span>
                  <span class="mt-0.5 block text-xs leading-relaxed text-text3">
                    {claim.claim_text}
                  </span>
                </span>
              </label>
            {/each}
          </fieldset>
        {/each}
      {/if}
    </div>
    {#if error}
      <p class="text-xs text-danger" role="alert">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="rounded-md border border-borderStrong px-3 py-1.5 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
    >
      {LINK_CLAIMS.cancel}
    </button>
    <button
      type="button"
      onclick={submit}
      disabled={ids.length === 0 || busy}
      class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accentHover focus:outline-none focus-visible:ring-2 focus-visible:ring-accentHover focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
    >
      {LINK_CLAIMS.submit(ids.length)}
    </button>
  {/snippet}
</Dialog>
