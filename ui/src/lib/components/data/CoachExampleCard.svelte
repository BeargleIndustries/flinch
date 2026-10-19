<!--
  One coach example (brief 9.4): the move name with its detected pattern,
  the outcome badge, the refusal and pushback excerpts (300 characters), an
  Effectiveness select 1 to 5 (PATCH {effectiveness}), "Edit the pushback"
  (the excerpt becomes a textarea with Save and Cancel; PATCH
  {pushback_text}), the run it came from when it still exists (B20 sets
  run_id to null when the run is deleted), and "Delete this example".
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { CoachExample } from '$lib/api/types';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Term from '$lib/components/Term.svelte';
  import { COACH } from '$lib/copy/data';
  import { moveCopy } from '$lib/copy/moves';
  import { formatDate } from '$lib/format';
  import { BTN, FIELD, LABEL } from '../probe/styles';
  import { EFFECTIVENESS, clampEffectiveness, excerpt, patternLabel, pushbackPatch } from './coach';
  import { coach } from './coach-store.svelte';

  interface Props {
    ex: CoachExample;
    /** A PATCH or DELETE for this example is in flight. */
    busy: boolean;
  }

  let { ex, busy }: Props = $props();

  const uid = $props.id();

  let editing = $state(false);
  let draft = $state('');
  let problem = $state<string | null>(null);
  let area: HTMLTextAreaElement | null = $state(null);

  const move = $derived(moveCopy(ex.move));
  const pattern = $derived(patternLabel(ex.pattern));
  const rating = $derived(clampEffectiveness(ex.effectiveness));
  const pushback = $derived(excerpt(ex.pushback_text));

  async function startEdit() {
    draft = ex.pushback_text ?? '';
    problem = null;
    editing = true;
    await tick();
    area?.focus();
  }

  function cancel() {
    editing = false;
    problem = null;
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    const patch = pushbackPatch(ex.pushback_text ?? '', draft);
    if (patch === 'empty') {
      problem = COACH.pushbackEmpty;
      return;
    }
    if (patch === null) {
      editing = false;
      return;
    }
    if (await coach.update(ex.id, patch, COACH.saved)) editing = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancel();
    }
  }

  function rate(v: string) {
    const n = clampEffectiveness(Number(v));
    if (n !== ex.effectiveness) void coach.update(ex.id, { effectiveness: n }, COACH.rated(n));
  }

  const PROSE = 'whitespace-pre-wrap break-words text-sm leading-relaxed';
</script>

<div data-testid="coach-example" data-example-id={ex.id}>
  <Panel eyebrow={COACH.taught(formatDate(ex.promoted_at))} title={move?.name ?? COACH.unknownMove}>
    {#snippet actions()}
      <span class="sr-only">{COACH.outcome(ex.outcome)}</span>
      <ClassBadge value={ex.outcome} size="sm" />
    {/snippet}

    {#if move || pattern}
      <p class="-mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-text3">
        {#if move}
          <span
            ><span class="text-text4"><Term key="move">{COACH.move}</Term>:</span>
            {move.description}</span
          >
        {/if}
        {#if pattern}
          <span data-testid="coach-pattern"
            ><span class="text-text4">{COACH.pattern}:</span> {pattern}</span
          >
        {/if}
      </p>
    {/if}

    <div class="grid gap-3 md:grid-cols-2">
      <div class="min-w-0 rounded-md border border-border bg-bg/60 p-3">
        <h3 class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text4">
          <Term key="refusal">{COACH.refusal}</Term>
        </h3>
        <p class="{PROSE} text-text2" data-testid="coach-refusal">{excerpt(ex.refusal_text)}</p>
      </div>

      <div class="min-w-0 rounded-md border border-accent/30 bg-accentSoft/20 p-3">
        <h3 class="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-accentText">
          <Term key="pushback">{COACH.pushback}</Term>
        </h3>
        {#if editing}
          <form class="flex flex-col gap-2" onsubmit={save}>
            <label for="coach-edit-{uid}" class="sr-only">{COACH.editLabel}</label>
            <textarea
              id="coach-edit-{uid}"
              bind:this={area}
              bind:value={draft}
              onkeydown={onKey}
              rows="5"
              class="{FIELD} resize-y font-sans"
              aria-invalid={problem !== null}
              aria-describedby={problem ? `coach-edit-problem-${uid}` : undefined}
              disabled={busy}
              data-testid="coach-edit-text"
            ></textarea>
            {#if problem}
              <p id="coach-edit-problem-{uid}" class="text-xs text-danger" role="alert">
                {problem}
              </p>
            {/if}
            <div class="flex gap-2">
              <button type="submit" class={BTN.primary} disabled={busy}
                >{busy ? COACH.saving : COACH.save}</button
              >
              <button type="button" class={BTN.ghost} onclick={cancel} disabled={busy}
                >{COACH.cancel}</button
              >
            </div>
          </form>
        {:else if pushback}
          <p class="{PROSE} text-text" data-testid="coach-pushback">{pushback}</p>
        {:else}
          <p class="text-sm italic text-text4" data-testid="coach-pushback">{COACH.noPushback}</p>
        {/if}
      </div>
    </div>

    <footer class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
      <div class="flex items-center gap-2">
        <label for="coach-rate-{uid}" class="{LABEL} mb-0">{COACH.effectiveness}</label>
        <select
          id="coach-rate-{uid}"
          class="{FIELD} w-auto py-1 font-mono text-xs"
          value={String(rating)}
          disabled={busy}
          onchange={(e) => rate(e.currentTarget.value)}
          data-testid="coach-rating"
        >
          {#each EFFECTIVENESS as n (n)}
            <option value={String(n)}>{COACH.effectivenessOf(n)}</option>
          {/each}
        </select>
      </div>
      {#if !editing}
        <button type="button" class={BTN.secondary} onclick={startEdit} disabled={busy}
          >{COACH.edit}</button
        >
      {/if}
      {#if ex.run_id !== null}
        <a
          href="/probe/runs/{ex.run_id}"
          class="text-xs font-medium text-accentText underline-offset-2 hover:underline"
          data-testid="coach-run-link">{COACH.openRun}</a
        >
      {/if}
      <span class="ml-auto">
        <ConfirmButton
          label={COACH.delete}
          confirmLabel={COACH.deleteConfirm}
          danger
          disabled={busy || editing}
          onConfirm={async () => {
            await coach.remove(ex.id, COACH.deleted);
          }}
        />
      </span>
    </footer>
  </Panel>
</div>
