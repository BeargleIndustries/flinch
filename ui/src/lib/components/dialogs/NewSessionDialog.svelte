<!--
  New session (brief 6.6, D9). Name, target model (ModelPicker, I18 default),
  system prompt, notes, then two disclosures: Coach (backend with the saved
  default, a local model when the backend is Ollama, and the profile select
  of I19 with "New profile name…") and Probes (ProbePicker, every probe
  picked). Enter in a one-line field submits. On success the session becomes
  current and the app goes to /probe; a failure shows its friendly message
  inline (ERROR_COPY through friendlyError).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { ModelProvider, Probe } from '$lib/api/types';
  import Dialog from '$lib/components/Dialog.svelte';
  import ModelPicker from '$lib/components/ModelPicker.svelte';
  import ProbePicker from '$lib/components/ProbePicker.svelte';
  import { NEW_SESSION } from '$lib/copy/rail';
  import { friendlyError } from '$lib/errors';
  import {
    COACH_BACKENDS,
    DEFAULT_COACH_PROFILE,
    NAME_MAX,
    NOTES_MAX,
    SYSTEM_PROMPT_MAX,
    asCoachBackend,
    coachBackendLabel,
    createSessionBody,
    defaultTargetModel,
    newSessionProblems,
    profileOptions,
    type CoachBackend,
    type NewSessionForm,
  } from '$lib/session';
  import { session } from '$lib/stores/session.svelte';
  import { status } from '$lib/stores/status.svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  /** `<select>` value of "New profile name…"; never a real profile name. */
  const NEW_PROFILE = '__new_profile__';
  const uid = $props.id();

  let name = $state('');
  let targetModel = $state('');
  let systemPrompt = $state('');
  let notes = $state('');
  let coachBackend = $state<CoachBackend>('anthropic');
  let coachModel = $state('');
  let profileChoice = $state(DEFAULT_COACH_PROFILE);
  let newProfile = $state('');
  let picked = $state<Set<number>>(new Set());

  let groups = $state<ModelProvider[]>([]);
  let profileNames = $state<{ name: string }[]>([]);
  let allProbes = $state<Probe[]>([]);
  let ollamaModels = $state<{ id: string; name: string }[] | null>(null);

  let loading = $state(false);
  let busy = $state(false);
  let tried = $state(false);
  let error = $state<string | null>(null);

  const allIds = $derived(allProbes.map((p) => p.id));
  const profiles = $derived(profileOptions(profileNames, session.all));
  const form: NewSessionForm = $derived({
    name,
    targetModel,
    systemPrompt,
    coachBackend,
    coachModel,
    coachProfile: profileChoice === NEW_PROFILE ? newProfile : profileChoice,
    notes,
    probeIds: picked,
  });
  const problems = $derived(newSessionProblems(form, allIds));
  const pickedCount = $derived(allIds.filter((id) => picked.has(id)).length);
  const probeSummary = $derived(
    pickedCount === allIds.length
      ? NEW_SESSION.allProbes
      : NEW_SESSION.someProbes(pickedCount, allIds.length),
  );
  const shownProblem = $derived(tried && problems.length > 0 ? problems[0] : null);

  // Every open starts from a clean form and fresh lists.
  $effect(() => {
    if (open) untrack(() => void reset());
  });

  async function reset() {
    name = '';
    systemPrompt = '';
    notes = '';
    coachModel = '';
    profileChoice = DEFAULT_COACH_PROFILE;
    newProfile = '';
    tried = false;
    error = null;
    busy = false;
    ollamaModels = null;
    loading = true;
    try {
      const [models, profileRows, coachDefault, probeRows] = await status.track(
        Promise.all([
          request<ModelProvider[]>(ROUTES.listModels),
          request<{ name: string }[]>(ROUTES.listCoachProfiles).catch(() => []),
          request<{ backend?: string; model?: string | null }>(ROUTES.getCoachDefault).catch(
            () => ({}) as { backend?: string; model?: string | null },
          ),
          request<Probe[]>(ROUTES.listProbes),
        ]),
      );
      groups = models;
      profileNames = profileRows;
      allProbes = probeRows;
      picked = new Set(probeRows.map((p) => p.id));
      targetModel = defaultTargetModel(models);
      coachBackend = asCoachBackend(coachDefault.backend);
      const saved = coachDefault.model?.trim() ?? '';
      coachModel =
        coachBackend === 'local' && saved
          ? saved.startsWith('ollama:')
            ? saved
            : `ollama:${saved}`
          : '';
    } catch (e) {
      error = friendlyError(e).message;
    } finally {
      loading = false;
    }
  }

  // The local model list loads the first time Ollama is picked.
  $effect(() => {
    if (open && coachBackend === 'local' && ollamaModels === null) untrack(() => void loadOllama());
  });

  async function loadOllama() {
    ollamaModels = [];
    try {
      const res = await request<{ models?: { id: string; name: string }[] }>(
        ROUTES.getOllamaStatus,
      );
      ollamaModels = res.models ?? [];
    } catch {
      ollamaModels = [];
    }
  }

  async function submit() {
    if (busy || loading) return;
    tried = true;
    error = null;
    if (problems.length > 0) return;
    busy = true;
    try {
      await session.create(createSessionBody(form, allIds));
      onClose();
      await goto('/probe');
    } catch (e) {
      error = friendlyError(e).message;
    } finally {
      busy = false;
    }
  }

  const label = 'mb-1 block text-xs font-medium text-text2';
  const field =
    'w-full rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-sm text-text placeholder:text-text4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50';
  const disclosure = 'rounded-md border border-border bg-bg/40';
  const summary =
    'cursor-pointer select-none px-3 py-2 text-xs font-medium text-text2 hover:text-text focus:outline-none focus-visible:text-text';
</script>

<Dialog
  {open}
  {onClose}
  title={NEW_SESSION.title}
  lead={NEW_SESSION.lead}
  width="lg"
  onSubmit={submit}
>
  <div class="flex flex-col gap-4" data-testid="new-session-dialog">
    <div>
      <label for="ns-name-{uid}" class={label}>{NEW_SESSION.name}</label>
      <input
        id="ns-name-{uid}"
        type="text"
        bind:value={name}
        maxlength={NAME_MAX}
        placeholder={NEW_SESSION.namePlaceholder}
        aria-invalid={shownProblem === 'name'}
        class={field}
      />
    </div>

    <div>
      <label for="ns-model-{uid}" class={label}>{NEW_SESSION.targetModel}</label>
      <ModelPicker
        id="ns-model-{uid}"
        value={targetModel}
        onChange={(m) => (targetModel = m)}
        {groups}
        allowCustom
        disabled={loading}
      />
    </div>

    <div>
      <label for="ns-system-{uid}" class={label}
        >{NEW_SESSION.systemPrompt}
        <span class="font-normal text-text4">({NEW_SESSION.optional})</span></label
      >
      <textarea
        id="ns-system-{uid}"
        bind:value={systemPrompt}
        rows="3"
        maxlength={SYSTEM_PROMPT_MAX}
        placeholder={NEW_SESSION.systemPromptPlaceholder}
        class="{field} resize-y font-mono text-[13px]"
      ></textarea>
    </div>

    <details class={disclosure}>
      <summary class={summary}>{NEW_SESSION.coach(coachBackendLabel(coachBackend))}</summary>
      <div class="grid grid-cols-1 gap-3 border-t border-border px-3 py-3 sm:grid-cols-2">
        <div>
          <label for="ns-backend-{uid}" class={label}>{NEW_SESSION.backend}</label>
          <select id="ns-backend-{uid}" bind:value={coachBackend} class={field}>
            {#each COACH_BACKENDS as b (b.value)}
              <option value={b.value}>{b.label}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="ns-profile-{uid}" class={label}>{NEW_SESSION.profile}</label>
          <select id="ns-profile-{uid}" bind:value={profileChoice} class={field}>
            {#each profiles as p (p)}
              <option value={p}>{p}</option>
            {/each}
            <option value={NEW_PROFILE}>{NEW_SESSION.newProfile}</option>
          </select>
          {#if profileChoice === NEW_PROFILE}
            <input
              type="text"
              bind:value={newProfile}
              maxlength={NAME_MAX}
              aria-label={NEW_SESSION.newProfileLabel}
              placeholder={NEW_SESSION.newProfilePlaceholder}
              aria-invalid={shownProblem === 'profile'}
              class="{field} mt-1.5"
            />
          {/if}
        </div>
        {#if coachBackend === 'local'}
          <div class="sm:col-span-2">
            <label for="ns-local-{uid}" class={label}>{NEW_SESSION.localModel}</label>
            {#if ollamaModels && ollamaModels.length > 0}
              <select
                id="ns-local-{uid}"
                bind:value={coachModel}
                aria-invalid={shownProblem === 'localModel'}
                class={field}
              >
                <option value="" disabled>{NEW_SESSION.chooseLocalModel}</option>
                {#each ollamaModels as m (m.id)}
                  <option value={m.id}>{m.name}</option>
                {/each}
              </select>
            {:else if ollamaModels}
              <p class="text-xs text-warn">{NEW_SESSION.noLocalModels}</p>
            {/if}
            <p class="mt-1 text-xs text-text4">{NEW_SESSION.localHint}</p>
          </div>
        {/if}
      </div>
    </details>

    <details class={disclosure}>
      <summary class={summary} data-testid="ns-probes-summary">
        {NEW_SESSION.probes}: {probeSummary}
      </summary>
      <div class="border-t border-border px-3 py-3">
        <ProbePicker probes={allProbes} selected={picked} onChange={(n) => (picked = n)} />
        {#if allIds.length > 0 && pickedCount === 0}
          <p class="mt-2 text-xs text-danger">{NEW_SESSION.problems.probes}</p>
        {/if}
      </div>
    </details>

    <div>
      <label for="ns-notes-{uid}" class={label}
        >{NEW_SESSION.notes}
        <span class="font-normal text-text4">({NEW_SESSION.optional})</span></label
      >
      <textarea
        id="ns-notes-{uid}"
        bind:value={notes}
        rows="2"
        maxlength={NOTES_MAX}
        placeholder={NEW_SESSION.notesPlaceholder}
        class="{field} resize-y"
      ></textarea>
    </div>

    {#if loading}
      <p class="text-xs text-text4" aria-live="polite">{NEW_SESSION.loading}</p>
    {/if}
    {#if shownProblem}
      <p class="text-xs text-danger" role="alert">{NEW_SESSION.problems[shownProblem]}</p>
    {:else if error}
      <p class="text-xs text-danger" role="alert" data-testid="ns-error">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="rounded-md border border-borderStrong px-3 py-1.5 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
      >{NEW_SESSION.cancel}</button
    >
    <button
      type="button"
      onclick={submit}
      disabled={loading}
      aria-disabled={busy}
      class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accentHover focus:outline-none focus-visible:ring-2 focus-visible:ring-accentHover focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-60"
      >{busy ? NEW_SESSION.creating : NEW_SESSION.create}</button
    >
  {/snippet}
</Dialog>
