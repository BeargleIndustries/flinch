<!--
  New or edit a sequence strategy (brief 9.9). Fields Name, Description, Goal,
  Opening pattern, Escalation pattern, Setup hint and Category; Name, Goal,
  Opening pattern, Escalation pattern and Setup hint are required, matching
  `flinch/app.py` create_strategy. New saves with POST /api/strategies; Edit
  reads GET /api/strategies/{id} first and saves with PUT. A name already in
  the list is refused here (the table's name is unique, and the sidecar would
  answer a duplicate with a server error).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Dialog from '$lib/components/Dialog.svelte';
  import {
    duplicateStrategyName,
    missingStrategyFields,
    strategyBody,
    strategyForm,
    type Strategy,
    type StrategyForm,
  } from '$lib/components/studies/sequences';
  import { sequences } from '$lib/components/studies/sequences.svelte';
  import { SEQUENCES, STRATEGY_DIALOG as D } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { status } from '$lib/stores/status.svelte';

  interface Props {
    open: boolean;
    /** The strategy to edit; null makes a new one. */
    strategy: Strategy | null;
    onClose: () => void;
  }

  let { open, strategy, onClose }: Props = $props();

  const uid = $props.id();

  let form = $state<StrategyForm>(strategyForm(null));
  let tried = $state(false);
  let busy = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let seq = 0;

  const editId = $derived(strategy?.id ?? null);
  const missing = $derived(missingStrategyFields(form));
  const duplicate = $derived(duplicateStrategyName(form.name, sequences.strategies, editId));
  const problem = $derived(
    !tried ? null : missing.length ? D.required : duplicate ? D.duplicate : null,
  );

  // Every open starts from the strategy (read fresh for Edit) or empty.
  $effect(() => {
    if (!open) return;
    const s = strategy;
    untrack(() => {
      const mine = ++seq;
      const opened = strategyForm(s);
      form = { ...opened };
      tried = false;
      busy = false;
      error = null;
      loading = false;
      if (!s) return;
      loading = true;
      sequences
        .getStrategy(s.id)
        .then((fresh) => {
          // The fields are disabled while this read is in flight; still, never
          // overwrite anything typed since the dialog opened.
          if (mine === seq && sameForm(form, opened)) form = strategyForm(fresh);
        })
        .catch((e) => {
          if (mine === seq) error = friendlyError(e).message;
        })
        .finally(() => {
          if (mine === seq) loading = false;
        });
    });
  });

  const sameForm = (a: StrategyForm, b: StrategyForm) =>
    (Object.keys(b) as (keyof StrategyForm)[]).every((k) => a[k] === b[k]);

  async function submit() {
    if (busy || loading) return;
    tried = true;
    error = null;
    if (missing.length || duplicate) return;
    busy = true;
    try {
      const saved = await sequences.saveStrategy(strategyBody(form), editId);
      status.note(SEQUENCES.strategySaved(saved?.name ?? form.name.trim()));
      onClose();
    } catch (e) {
      error = friendlyError(e).message;
    } finally {
      busy = false;
    }
  }

  const label = 'mb-1 block text-xs font-medium text-text2';
  const hint = 'mt-1 text-xs leading-relaxed text-text4';
  const field =
    'w-full rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-sm text-text placeholder:text-text4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60';
  const req = (k: keyof StrategyForm) => tried && missing.includes(k as (typeof missing)[number]);
  const AREAS = [
    ['goal', D.goal, D.goalHint, 2],
    ['opening_pattern', D.opening, D.openingHint, 3],
    ['escalation_pattern', D.escalation, D.escalationHint, 3],
    ['setup_hint', D.setup, D.setupHint, 2],
  ] as const;
</script>

<Dialog
  {open}
  {onClose}
  title={strategy ? D.titleEdit : D.titleNew}
  lead={D.lead}
  width="lg"
  onSubmit={submit}
>
  <div class="flex flex-col gap-4" data-testid="strategy-dialog" aria-busy={loading}>
    <!-- Edit reads the stored strategy first; the fields wait for it so the
         fresh copy never lands on top of what you type. -->
    <fieldset class="m-0 flex min-w-0 flex-col gap-4 border-0 p-0" disabled={loading}>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <label for="sd-name-{uid}" class={label}>{D.name}</label>
          <input
            id="sd-name-{uid}"
            type="text"
            bind:value={form.name}
            maxlength="120"
            spellcheck="false"
            autocomplete="off"
            aria-invalid={req('name') || (tried && duplicate)}
            aria-describedby="sd-name-hint-{uid}"
            class="{field} font-mono text-[13px]"
            data-testid="strategy-field-name"
          />
          <p id="sd-name-hint-{uid}" class={hint}>{D.nameHint}</p>
        </div>
        <div>
          <label for="sd-category-{uid}" class={label}>{D.category}</label>
          <input
            id="sd-category-{uid}"
            type="text"
            bind:value={form.category}
            maxlength="60"
            autocomplete="off"
            aria-describedby="sd-category-hint-{uid}"
            class={field}
            data-testid="strategy-field-category"
          />
          <p id="sd-category-hint-{uid}" class={hint}>{D.categoryHint}</p>
        </div>
      </div>

      <div>
        <label for="sd-description-{uid}" class={label}>{D.description}</label>
        <input
          id="sd-description-{uid}"
          type="text"
          bind:value={form.description}
          maxlength="300"
          autocomplete="off"
          aria-describedby="sd-description-hint-{uid}"
          class={field}
          data-testid="strategy-field-description"
        />
        <p id="sd-description-hint-{uid}" class={hint}>{D.descriptionHint}</p>
      </div>

      {#each AREAS as [key, text, help, rows] (key)}
        <div>
          <label for="sd-{key}-{uid}" class={label}>{text}</label>
          <textarea
            id="sd-{key}-{uid}"
            bind:value={form[key]}
            {rows}
            maxlength="4000"
            aria-invalid={req(key)}
            aria-describedby="sd-{key}-hint-{uid}"
            class="{field} resize-y text-[13px] {req(key) ? 'border-danger/70' : ''}"
            data-testid="strategy-field-{key}"
          ></textarea>
          <p id="sd-{key}-hint-{uid}" class={hint}>{help}</p>
        </div>
      {/each}
    </fieldset>

    {#if loading}
      <p class="text-xs text-text4" role="status">{D.loading}</p>
    {/if}
    {#if problem}
      <p class="text-xs text-danger" role="alert" data-testid="strategy-problem">{problem}</p>
    {:else if error}
      <p class="text-xs text-danger" role="alert">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="rounded-md border border-borderStrong px-3 py-1.5 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
      >{D.cancel}</button
    >
    <button
      type="button"
      onclick={submit}
      aria-disabled={busy || loading}
      class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accentHover focus:outline-none focus-visible:ring-2 focus-visible:ring-accentHover focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-disabled:cursor-wait aria-disabled:opacity-60"
      data-testid="strategy-save">{busy ? D.saving : D.save}</button
    >
  {/snippet}
</Dialog>
