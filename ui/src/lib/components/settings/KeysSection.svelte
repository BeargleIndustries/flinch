<!--
  Settings, Keys (brief 9.7, D11). One KeyRow per entry of
  GET /api/settings/keys, in the anthropic, openai, google, xai, meta order.
  The store follows the runtime: Windows Credential Manager plus the running
  sidecar in the desktop app, the sidecar's .env file in dev (key-store.ts).
  The lead line names the store in use. After every change the list and
  /health are read again, so the Settings dot and the sidecar chip follow.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { request, type RequestOptions } from '$lib/api/client';
  import { ROUTES, type RouteDef } from '$lib/api/endpoints';
  import type { SettingsKey } from '$lib/api/types';
  import { SETTINGS } from '$lib/copy/settings';
  import { friendlyError } from '$lib/errors';
  import { isTauri } from '$lib/is-tauri';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { status } from '$lib/stores/status.svelte';
  import { deleteApiKey, setApiKey } from '$lib/tauri';
  import KeyRow from './KeyRow.svelte';
  import SettingsSection from './SettingsSection.svelte';
  import { sortKeys, type KeyResult } from './key-row';
  import { keyStore } from './key-store';

  const store = keyStore(isTauri(), {
    request: <T,>(route: RouteDef, opts?: RequestOptions) => status.track(request<T>(route, opts)),
    setApiKey,
    deleteApiKey,
  });

  let keys = $state<SettingsKey[] | null>(null);
  let failed = $state<string | null>(null);

  async function load(): Promise<void> {
    try {
      keys = sortKeys(await status.track(request<SettingsKey[]>(ROUTES.listKeys)));
      failed = null;
    } catch (e) {
      failed = friendlyError(e).message;
    }
  }

  /** The list and the shell's /health facts, after a key changed. */
  async function refresh(): Promise<void> {
    await Promise.all([load(), capabilities.checkHealth()]);
  }

  async function save(entry: SettingsKey, key: string): Promise<KeyResult> {
    const r = await store.save(entry, key);
    if (r.ok) await refresh();
    return r;
  }

  async function remove(entry: SettingsKey): Promise<void> {
    try {
      await store.remove(entry);
    } finally {
      await refresh();
    }
  }

  onMount(() => {
    void load();
  });
</script>

<SettingsSection id="keys" title={SETTINGS.keysHeading} tour="settings-keys">
  <p class="text-xs leading-relaxed text-text3" data-testid="settings-key-store">
    {store.kind === 'credential-manager' ? SETTINGS.keysLeadDesktop : SETTINGS.keysLeadDev}
  </p>

  <div class="mt-2" data-testid="settings-key-rows">
    {#if keys}
      {#each keys as entry (entry.provider)}
        <KeyRow
          {entry}
          onSave={(key) => save(entry, key)}
          onTest={() => store.test(entry)}
          onRemove={() => remove(entry)}
        />
      {/each}
    {:else if failed}
      <p class="py-3 text-xs text-danger" role="alert">
        {SETTINGS.keysFailed}
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

  <p class="mt-2 text-[11px] leading-relaxed text-text4">{SETTINGS.keysFoot}</p>
</SettingsSection>
