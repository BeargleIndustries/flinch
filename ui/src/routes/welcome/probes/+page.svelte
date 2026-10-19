<!--
  First run, step 4: Load probes (brief 9.8). "Load the default set" calls
  POST /api/probes/load-defaults and says "Loaded {loaded} probes"; "Import my
  own files" opens the import dialog (6.8). Continue is enabled once
  GET /api/probes is not empty; until then the step offers Skip.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { CheckCircle2, FolderOpen, LoaderCircle } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { Probe } from '$lib/api/types';
  import ImportProbesDialog from '$lib/components/dialogs/ImportProbesDialog.svelte';
  import StepShell from '$lib/components/welcome/StepShell.svelte';
  import { GHOST, PRIMARY, SECONDARY } from '$lib/components/welcome/styles';
  import { WELCOME } from '$lib/copy/onboarding';
  import { RAIL } from '$lib/copy/rail';
  import { SCREENS } from '$lib/copy/screens';
  import { friendlyError } from '$lib/errors';
  import { nextPath } from '$lib/onboarding';
  import { write } from '$lib/prefs';
  import { status } from '$lib/stores/status.svelte';

  /** Probes in the library; null until the first read lands. */
  let count = $state<number | null>(null);
  let loading = $state(false);
  let result = $state<string | null>(null);
  let failed = $state<string | null>(null);
  let importOpen = $state(false);

  async function readCount(): Promise<void> {
    try {
      count = (await status.track(request<Probe[]>(ROUTES.listProbes))).length;
    } catch (e) {
      failed = friendlyError(e).message;
    }
  }

  async function loadDefaults(): Promise<void> {
    if (loading) return;
    loading = true;
    failed = null;
    result = null;
    try {
      const res = await status.track(request<{ loaded: number }>(ROUTES.loadDefaultProbes));
      result = RAIL.loaded(res.loaded);
      await readCount();
    } catch (e) {
      failed = friendlyError(e).message;
    } finally {
      loading = false;
    }
  }

  function closeImport(): void {
    importOpen = false;
    void readCount();
  }

  function goOn(): void {
    write('onboarding_step', 'probes');
    void goto(nextPath('probes'));
  }

  onMount(() => {
    void readCount();
  });
</script>

<StepShell copy={SCREENS['welcome.4']}>
  <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <button
      type="button"
      class={SECONDARY}
      onclick={() => void loadDefaults()}
      disabled={loading}
      aria-busy={loading}
    >
      {#if loading}
        <LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
        {WELCOME.loadingDefaults}
      {:else}
        {WELCOME.loadDefaults}
      {/if}
    </button>
    <button type="button" class={SECONDARY} onclick={() => (importOpen = true)}>
      <FolderOpen class="h-4 w-4" aria-hidden="true" />
      {WELCOME.importOwn}
    </button>
  </div>

  {#if result}
    <p class="mt-4 flex items-center gap-2 text-sm text-ok" role="status">
      <CheckCircle2 class="h-4 w-4" aria-hidden="true" />
      <span data-testid="welcome-loaded">{result}</span>
    </p>
  {/if}
  {#if failed}
    <p class="mt-4 text-sm text-danger" role="alert">{failed}</p>
  {/if}

  {#snippet actions()}
    {#if count !== null && count > 0}
      <button type="button" class={PRIMARY} onclick={goOn}>{WELCOME.continue}</button>
    {:else}
      <button type="button" class={GHOST} onclick={goOn} disabled={count === null}>
        {WELCOME.skip}
      </button>
    {/if}
  {/snippet}
</StepShell>

<ImportProbesDialog open={importOpen} onClose={closeImport} />
