<!--
  Settings, Local models (brief 9.7). The base URL comes from
  GET /api/settings/ollama; "Test the connection" posts it to
  POST /api/settings/ollama, which saves it (B22, I9: it survives a sidecar
  restart) and answers whether Ollama is reachable and which models it has.
  On open, a reachable server's models are read from GET /api/ollama/status.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { OllamaModel, OllamaSettings, OllamaSettingsSaved } from '$lib/api/types';
  import { SETTINGS } from '$lib/copy/settings';
  import { friendlyError } from '$lib/errors';
  import { status } from '$lib/stores/status.svelte';
  import SettingsSection from './SettingsSection.svelte';

  let url = $state('');
  /** null until the first answer. */
  let available = $state<boolean | null>(null);
  let models = $state<OllamaModel[]>([]);
  let busy = $state(false);
  let note = $state<{ ok: boolean; text: string } | null>(null);
  const uid = $props.id();

  onMount(() => {
    void (async () => {
      try {
        const s = await status.track(request<OllamaSettings>(ROUTES.getOllamaSettings));
        url = s.base_url;
        available = s.available;
        if (s.available) {
          const st = await status.track(
            request<{ models?: OllamaModel[] }>(ROUTES.getOllamaStatus),
          );
          models = st.models ?? [];
        }
      } catch (e) {
        note = { ok: false, text: friendlyError(e).message };
      }
    })();
  });

  async function test(): Promise<void> {
    const base_url = url.trim();
    if (busy) return;
    if (!base_url) {
      note = { ok: false, text: SETTINGS.ollamaEmpty };
      return;
    }
    busy = true;
    note = null;
    try {
      const r = await status.track(
        request<OllamaSettingsSaved>(ROUTES.setOllamaSettings, { body: { base_url } }),
      );
      url = r.base_url;
      available = r.available;
      models = r.models ?? [];
      note = { ok: true, text: SETTINGS.ollamaSaved };
    } catch (e) {
      note = { ok: false, text: friendlyError(e).message };
    } finally {
      busy = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void test();
    }
  }
</script>

<SettingsSection id="ollama" title={SETTINGS.ollamaHeading}>
  <label for="ollama-url-{uid}" class="mb-1 block text-xs text-text3">{SETTINGS.ollamaUrl}</label>
  <div class="flex items-center gap-2">
    <input
      id="ollama-url-{uid}"
      type="url"
      bind:value={url}
      onkeydown={onKey}
      autocomplete="off"
      spellcheck="false"
      class="min-w-0 flex-1 rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 font-mono text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
    <button
      type="button"
      onclick={test}
      disabled={busy}
      class="shrink-0 rounded-md border border-borderStrong px-3 py-1.5 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? SETTINGS.ollamaTesting : SETTINGS.ollamaTest}
    </button>
  </div>

  <div class="mt-2 flex min-h-5 flex-wrap items-center gap-2">
    {#if available !== null}
      <span
        class="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none {available
          ? 'border-ok/40 text-ok'
          : 'border-border text-text3'}"
        data-testid="ollama-status"
      >
        <span
          class="h-1.5 w-1.5 rounded-full {available ? 'bg-ok' : 'bg-text4/60'}"
          aria-hidden="true"
        ></span>
        {available ? SETTINGS.ollamaConnected(models.length) : SETTINGS.ollamaNotRunning}
      </span>
    {/if}
    {#if note}
      <span class="text-xs {note.ok ? 'text-ok' : 'text-danger'}" role="status">{note.text}</span>
    {/if}
  </div>

  {#if available && models.length > 0}
    <ul class="mt-2 flex flex-wrap gap-1.5" aria-label={SETTINGS.ollamaHeading}>
      {#each models as m (m.id)}
        <li class="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-text2">
          {m.name}
        </li>
      {/each}
    </ul>
  {/if}

  <p class="mt-2 text-[11px] leading-relaxed text-text4">{SETTINGS.ollamaHint}</p>
</SettingsSection>
