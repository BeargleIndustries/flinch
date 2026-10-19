<!--
  First run, step 3: Add a key (brief 9.8). The Anthropic KeyRow opens
  expanded; the other four providers sit under "Other providers". Keys are
  saved exactly as Settings saves them (key-store.ts: validated, then Windows
  Credential Manager plus the running sidecar on the desktop, the sidecar's
  .env file in dev). Continue is enabled once any key is set. "Skip for now"
  shows what a missing key costs (Appendix C 60), and a second press goes on.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { request, type RequestOptions } from '$lib/api/client';
  import { ROUTES, type RouteDef } from '$lib/api/endpoints';
  import type { SettingsKey } from '$lib/api/types';
  import KeyRow from '$lib/components/settings/KeyRow.svelte';
  import { sortKeys, type KeyEntry, type KeyResult } from '$lib/components/settings/key-row';
  import { keyStore } from '$lib/components/settings/key-store';
  import StepShell from '$lib/components/welcome/StepShell.svelte';
  import { GHOST, PRIMARY } from '$lib/components/welcome/styles';
  import { WELCOME } from '$lib/copy/onboarding';
  import { SCREENS } from '$lib/copy/screens';
  import { SETTINGS } from '$lib/copy/settings';
  import { friendlyError } from '$lib/errors';
  import { isTauri } from '$lib/is-tauri';
  import { nextPath } from '$lib/onboarding';
  import { write } from '$lib/prefs';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { status } from '$lib/stores/status.svelte';
  import { deleteApiKey, setApiKey } from '$lib/tauri';

  const store = keyStore(isTauri(), {
    request: <T,>(route: RouteDef, opts?: RequestOptions) => status.track(request<T>(route, opts)),
    setApiKey,
    deleteApiKey,
  });

  let keys = $state<SettingsKey[] | null>(null);
  let failed = $state<string | null>(null);
  let skipping = $state(false);

  const anthropic = $derived(keys?.find((k) => k.provider === 'anthropic') ?? null);
  const others = $derived(keys?.filter((k) => k.provider !== 'anthropic') ?? []);
  const anySet = $derived(keys?.some((k) => k.is_set) ?? false);

  async function load(): Promise<void> {
    try {
      keys = sortKeys(await status.track(request<SettingsKey[]>(ROUTES.listKeys)));
      failed = null;
    } catch (e) {
      failed = friendlyError(e).message;
    }
  }

  async function refresh(): Promise<void> {
    await Promise.all([load(), capabilities.checkHealth()]);
  }

  async function save(entry: KeyEntry, key: string): Promise<KeyResult> {
    const r = await store.save(entry, key);
    if (r.ok) await refresh();
    return r;
  }

  async function remove(entry: KeyEntry): Promise<void> {
    try {
      await store.remove(entry);
    } finally {
      await refresh();
    }
  }

  function goOn(): void {
    write('onboarding_step', 'key');
    void goto(nextPath('key'));
  }

  function skip(): void {
    if (!skipping) {
      skipping = true;
      return;
    }
    goOn();
  }

  onMount(() => {
    void load();
  });
</script>

<StepShell copy={SCREENS['welcome.3']}>
  <p class="mb-3 text-xs leading-relaxed text-text4" data-testid="welcome-key-store">
    {store.kind === 'credential-manager' ? SETTINGS.keysLeadDesktop : SETTINGS.keysLeadDev}
  </p>

  <div class="rounded-xl border border-border bg-bg/60 px-4 py-1" data-testid="welcome-keys">
    {#if keys}
      {#if anthropic}
        <KeyRow
          entry={anthropic}
          expanded
          onSave={(key) => save(anthropic, key)}
          onTest={() => store.test(anthropic)}
          onRemove={() => remove(anthropic)}
        />
      {/if}
      {#if others.length}
        <details class="border-t border-border py-3" data-testid="welcome-other-keys">
          <summary class="cursor-pointer text-xs text-text3 hover:text-text2">
            {WELCOME.otherProviders}
          </summary>
          <div class="mt-1">
            {#each others as entry (entry.provider)}
              <KeyRow
                {entry}
                onSave={(key) => save(entry, key)}
                onTest={() => store.test(entry)}
                onRemove={() => remove(entry)}
              />
            {/each}
          </div>
        </details>
      {/if}
    {:else if failed}
      <p class="py-3 text-xs text-danger" role="alert">
        {WELCOME.keysFailed}
        {failed}
        <button
          type="button"
          class="ml-1 text-accentText underline-offset-2 hover:underline"
          onclick={() => void load()}>{SETTINGS.retry}</button
        >
      </p>
    {:else}
      <p class="py-3 text-xs text-text4">{SETTINGS.keysLoading}</p>
    {/if}
  </div>

  {#if skipping}
    <p
      id="welcome-skip-hint"
      class="mt-4 rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm leading-relaxed text-text2"
      role="status"
      data-testid="welcome-skip-hint"
    >
      {WELCOME.skipHint}
    </p>
  {/if}

  {#snippet actions()}
    <button type="button" class={PRIMARY} disabled={!anySet} onclick={goOn}>
      {WELCOME.continue}
    </button>
    <button
      type="button"
      class={GHOST}
      onclick={skip}
      aria-describedby={skipping ? 'welcome-skip-hint' : undefined}
    >
      {WELCOME.skipForNow}
    </button>
  {/snippet}
</StepShell>
