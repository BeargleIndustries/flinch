<!--
  Settings, Coach (brief 9.7). The default coach backend for new sessions,
  with the local model when the backend is Ollama. Read from and saved on
  change with /api/settings/coach-default (B22, I9: stored in app_settings).
  The New session dialog starts from this default (I18).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { CoachDefault, OllamaModel } from '$lib/api/types';
  import { SETTINGS } from '$lib/copy/settings';
  import { friendlyError } from '$lib/errors';
  import { COACH_BACKENDS, asCoachBackend, bareOllamaName, type CoachBackend } from '$lib/session';
  import { status } from '$lib/stores/status.svelte';
  import SettingsSection from './SettingsSection.svelte';

  let backend = $state<CoachBackend>('anthropic');
  let model = $state('');
  let loaded = $state(false);
  /** Local models from Ollama; null until the first time Local is shown. */
  let localModels = $state<OllamaModel[] | null>(null);
  let note = $state<{ ok: boolean; text: string } | null>(null);
  const uid = $props.id();

  onMount(() => {
    void (async () => {
      try {
        const d = await status.track(request<CoachDefault>(ROUTES.getCoachDefault));
        backend = asCoachBackend(d.backend);
        model = backend === 'local' && d.model ? bareOllamaName(d.model) : '';
        loaded = true;
        if (backend === 'local') await loadLocal();
      } catch (e) {
        note = { ok: false, text: friendlyError(e).message };
      }
    })();
  });

  async function loadLocal(): Promise<void> {
    if (localModels !== null) return;
    localModels = [];
    try {
      const st = await status.track(request<{ models?: OllamaModel[] }>(ROUTES.getOllamaStatus));
      localModels = st.models ?? [];
    } catch {
      localModels = [];
    }
  }

  async function save(): Promise<void> {
    note = null;
    try {
      const body = { backend, model: backend === 'local' ? model.trim() : '' };
      const saved = await status.track(request<CoachDefault>(ROUTES.setCoachDefault, { body }));
      backend = asCoachBackend(saved.backend);
      note = { ok: true, text: SETTINGS.coachSaved };
    } catch (e) {
      note = { ok: false, text: friendlyError(e).message };
    }
  }

  async function onBackend(): Promise<void> {
    if (backend === 'local') {
      await loadLocal();
      if (!model && localModels && localModels.length > 0) model = localModels[0].name;
    }
    await save();
  }

  const field =
    'w-full rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50';
</script>

<SettingsSection id="coach" title={SETTINGS.coachHeading}>
  <div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
    <label for="coach-backend-{uid}" class="text-xs text-text3">{SETTINGS.coachBackend}</label>
    <select
      id="coach-backend-{uid}"
      bind:value={backend}
      onchange={onBackend}
      disabled={!loaded}
      class={field}
    >
      {#each COACH_BACKENDS as b (b.value)}
        <option value={b.value}>{b.label}</option>
      {/each}
    </select>

    {#if backend === 'local'}
      <label for="coach-model-{uid}" class="text-xs text-text3">{SETTINGS.coachModel}</label>
      {#if localModels && localModels.length > 0}
        <select id="coach-model-{uid}" bind:value={model} onchange={save} class={field}>
          {#each localModels as m (m.id)}
            <option value={m.name}>{m.name}</option>
          {/each}
        </select>
      {:else}
        <input
          id="coach-model-{uid}"
          type="text"
          bind:value={model}
          onchange={save}
          placeholder={SETTINGS.coachModelPlaceholder}
          autocomplete="off"
          spellcheck="false"
          class="{field} font-mono"
        />
      {/if}
    {/if}
  </div>

  <div class="mt-2 flex items-baseline justify-between gap-3">
    <p class="text-[11px] leading-relaxed text-text4">{SETTINGS.coachHint}</p>
    {#if note}
      <span class="shrink-0 text-xs {note.ok ? 'text-ok' : 'text-danger'}" role="status"
        >{note.text}</span
      >
    {/if}
  </div>
</SettingsSection>
