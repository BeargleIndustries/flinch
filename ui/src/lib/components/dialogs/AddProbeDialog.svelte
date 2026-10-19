<!--
  Add probe (brief 6.7). Name, domain (with the rail's domains as
  suggestions), prompt text, tags, and a checkbox that reveals the narrative
  opening and target used by Sequences (both required when ticked). Saves
  with the current session's id (B18), so a scoped session gains the probe;
  the rail reloads and the new probe becomes active. A duplicate name (409)
  reads "A probe with that name exists. Choose another name."
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { ApiError } from '$lib/api/client';
  import Dialog from '$lib/components/Dialog.svelte';
  import { NO_DOMAIN } from '$lib/components/probe-picker';
  import { ADD_PROBE } from '$lib/copy/rail';
  import { friendlyError } from '$lib/errors';
  import { NAME_MAX, SYSTEM_PROMPT_MAX } from '$lib/session';
  import { parseTags } from '$lib/stores/probe-list';
  import { probes } from '$lib/stores/probe.svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  const uid = $props.id();
  const PROMPT_MAX = SYSTEM_PROMPT_MAX;

  let name = $state('');
  let domain = $state('');
  let promptText = $state('');
  let tags = $state('');
  let narrative = $state(false);
  let opening = $state('');
  let target = $state('');
  let tried = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const domains = $derived(probes.domains.filter((d) => d !== NO_DOMAIN));
  const missingRequired = $derived(!name.trim() || !domain.trim() || !promptText.trim());
  const missingNarrative = $derived(narrative && (!opening.trim() || !target.trim()));
  const problem = $derived(
    !tried
      ? null
      : missingRequired
        ? ADD_PROBE.problems.required
        : missingNarrative
          ? ADD_PROBE.problems.narrative
          : null,
  );

  $effect(() => {
    if (!open) return;
    untrack(() => {
      name = '';
      domain = probes.domain && probes.domain !== NO_DOMAIN ? probes.domain : '';
      promptText = '';
      tags = '';
      narrative = false;
      opening = '';
      target = '';
      tried = false;
      busy = false;
      error = null;
    });
  });

  async function submit() {
    if (busy) return;
    tried = true;
    error = null;
    if (missingRequired || missingNarrative) return;
    busy = true;
    try {
      await probes.add({
        name: name.trim(),
        domain: domain.trim(),
        prompt_text: promptText,
        tags: parseTags(tags),
        narrative_opening: narrative ? opening : null,
        narrative_target: narrative ? target : null,
      });
      onClose();
    } catch (e) {
      error =
        e instanceof ApiError && e.status === 409 ? ADD_PROBE.duplicate : friendlyError(e).message;
    } finally {
      busy = false;
    }
  }

  const label = 'mb-1 block text-xs font-medium text-text2';
  const hint = 'mt-1 text-xs leading-relaxed text-text4';
  const field =
    'w-full rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-sm text-text placeholder:text-text4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
</script>

<Dialog {open} {onClose} title={ADD_PROBE.title} lead={ADD_PROBE.lead} width="lg" onSubmit={submit}>
  <div class="flex flex-col gap-4" data-testid="add-probe-dialog">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label for="ap-name-{uid}" class={label}>{ADD_PROBE.name}</label>
        <input
          id="ap-name-{uid}"
          type="text"
          bind:value={name}
          maxlength={NAME_MAX}
          spellcheck="false"
          autocomplete="off"
          class="{field} font-mono text-[13px]"
        />
      </div>
      <div>
        <label for="ap-domain-{uid}" class={label}>{ADD_PROBE.domain}</label>
        <input
          id="ap-domain-{uid}"
          type="text"
          bind:value={domain}
          list="ap-domains-{uid}"
          maxlength={NAME_MAX}
          autocomplete="off"
          class={field}
        />
        <datalist id="ap-domains-{uid}">
          {#each domains as d (d)}
            <option value={d}></option>
          {/each}
        </datalist>
      </div>
    </div>

    <div>
      <label for="ap-prompt-{uid}" class={label}>{ADD_PROBE.promptText}</label>
      <textarea
        id="ap-prompt-{uid}"
        bind:value={promptText}
        rows="5"
        maxlength={PROMPT_MAX}
        class="{field} resize-y font-mono text-[13px]"
      ></textarea>
    </div>

    <div>
      <label for="ap-tags-{uid}" class={label}>{ADD_PROBE.tags}</label>
      <input
        id="ap-tags-{uid}"
        type="text"
        bind:value={tags}
        autocomplete="off"
        aria-describedby="ap-tags-hint-{uid}"
        class={field}
      />
      <p id="ap-tags-hint-{uid}" class={hint}>{ADD_PROBE.tagsHint}</p>
    </div>

    <label class="flex cursor-pointer items-start gap-2 text-sm text-text2">
      <input type="checkbox" bind:checked={narrative} class="mt-0.5 h-3.5 w-3.5 accent-accent" />
      <span>{ADD_PROBE.narrative}</span>
    </label>

    {#if narrative}
      <div class="flex flex-col gap-3 border-l-2 border-accent/50 pl-3">
        <div>
          <label for="ap-opening-{uid}" class={label}>{ADD_PROBE.narrativeOpening}</label>
          <textarea
            id="ap-opening-{uid}"
            bind:value={opening}
            rows="4"
            maxlength={PROMPT_MAX}
            aria-describedby="ap-opening-hint-{uid}"
            class="{field} resize-y font-mono text-[13px]"
          ></textarea>
          <p id="ap-opening-hint-{uid}" class={hint}>{ADD_PROBE.narrativeOpeningHint}</p>
        </div>
        <div>
          <label for="ap-target-{uid}" class={label}>{ADD_PROBE.narrativeTarget}</label>
          <textarea
            id="ap-target-{uid}"
            bind:value={target}
            rows="2"
            maxlength={PROMPT_MAX}
            aria-describedby="ap-target-hint-{uid}"
            class="{field} resize-y font-mono text-[13px]"
          ></textarea>
          <p id="ap-target-hint-{uid}" class={hint}>{ADD_PROBE.narrativeTargetHint}</p>
        </div>
      </div>
    {/if}

    {#if problem}
      <p class="text-xs text-danger" role="alert">{problem}</p>
    {:else if error}
      <p class="text-xs text-danger" role="alert" data-testid="ap-error">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="rounded-md border border-borderStrong px-3 py-1.5 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
      >{ADD_PROBE.cancel}</button
    >
    <button
      type="button"
      onclick={submit}
      aria-disabled={busy}
      class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accentHover focus:outline-none focus-visible:ring-2 focus-visible:ring-accentHover focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-60"
      >{busy ? ADD_PROBE.saving : ADD_PROBE.save}</button
    >
  {/snippet}
</Dialog>
