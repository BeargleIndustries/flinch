<!--
  Save a baseline (brief 8.6, 7.1): Name (required, max 200, focused on
  open) and Description (optional). "Save baseline" posts
  POST /api/sessions/{id}/snapshots {name, description}; its 400 "No runs in
  session to snapshot" shows inline as "Run at least one probe before saving
  a baseline." (errors.ts). Opened from Baselines and from the Probe idle
  panel's "Save a baseline…".
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Dialog from '$lib/components/Dialog.svelte';
  import { BTN, FIELD, HINT, LABEL } from '$lib/components/probe/styles';
  import { NAME_MAX, DESCRIPTION_MAX, nameProblem } from '$lib/components/studies/baselines';
  import type { BaselineSummary } from '$lib/components/studies/baselines';
  import { baselines } from '$lib/components/studies/baseline-store.svelte';
  import { SAVE_BASELINE } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';

  interface Props {
    open: boolean;
    sessionId: number;
    onClose: () => void;
    onSaved?: (saved: BaselineSummary) => void;
  }

  let { open, sessionId, onClose, onSaved }: Props = $props();

  const uid = $props.id();

  let name = $state('');
  let description = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let nameEl: HTMLInputElement | null = $state(null);

  const problem = $derived(nameProblem(name));

  // Fresh each time it opens.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      name = '';
      description = '';
      error = null;
      busy = false;
    });
  });

  async function submit() {
    if (problem || busy) return;
    busy = true;
    error = null;
    try {
      const saved = await baselines.save(sessionId, name, description);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      error = friendlyError(e).message;
      // Back to the name, so Escape and Tab still work inside the dialog.
      nameEl?.focus();
    } finally {
      busy = false;
    }
  }
</script>

<Dialog {open} {onClose} title={SAVE_BASELINE.title} lead={SAVE_BASELINE.lead} onSubmit={submit}>
  <div class="flex flex-col gap-4" data-testid="save-baseline-dialog">
    <div>
      <label for="sb-name-{uid}" class={LABEL}>{SAVE_BASELINE.name}</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="sb-name-{uid}"
        type="text"
        bind:value={name}
        bind:this={nameEl}
        maxlength={NAME_MAX}
        placeholder={SAVE_BASELINE.namePlaceholder}
        autofocus
        required
        aria-describedby="sb-name-hint-{uid}"
        readonly={busy}
        class={FIELD}
        data-testid="baseline-name"
      />
      <p id="sb-name-hint-{uid}" class="{HINT} mt-1 tabular-nums">
        {SAVE_BASELINE.nameHint(name.trim().length, NAME_MAX)}
      </p>
    </div>
    <div>
      <label for="sb-desc-{uid}" class={LABEL}
        >{SAVE_BASELINE.description}
        <span class="font-normal text-text4">({SAVE_BASELINE.optional})</span></label
      >
      <textarea
        id="sb-desc-{uid}"
        bind:value={description}
        rows="3"
        maxlength={DESCRIPTION_MAX}
        placeholder={SAVE_BASELINE.descriptionPlaceholder}
        readonly={busy}
        class="{FIELD} resize-y"
        data-testid="baseline-description"
      ></textarea>
    </div>
    {#if error}
      <p class="text-xs text-danger" role="alert" data-testid="save-baseline-error">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <button type="button" onclick={onClose} class={BTN.secondary}>{SAVE_BASELINE.cancel}</button>
    <button
      type="button"
      onclick={submit}
      disabled={problem !== null}
      aria-busy={busy}
      class={BTN.primary}
      data-testid="save-baseline-submit"
    >
      {busy ? SAVE_BASELINE.saving : SAVE_BASELINE.submit}
    </button>
  {/snippet}
</Dialog>
