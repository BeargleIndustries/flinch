<!--
  Add prompts to a draft study (brief 8.2.3 Setup panel): the same three
  sources as the New study page, added in the I12 order (HH-RLHF, picked
  probes, pasted CSV). HH-RLHF is offered only while the study has no
  prompts, since the importer skips a study that has some.
-->
<script lang="ts">
  import Dialog from '$lib/components/Dialog.svelte';
  import { CONDITIONS } from '$lib/copy/studies';
  import { emptySources, sourcesError } from '$lib/components/studies/conditions';
  import { addPromptSources } from '$lib/components/studies/conditions.svelte';
  import PromptSourcesFields from '$lib/components/studies/PromptSourcesFields.svelte';
  import { BTN } from '$lib/components/probe/styles';

  interface Props {
    open: boolean;
    studyId: number;
    /** Prompts the study has now. */
    existing: number;
    onClose: () => void;
    /** After the prompts landed (or some did); the study page reloads. */
    onAdded: () => void;
  }

  let { open, studyId, existing, onClose, onAdded }: Props = $props();

  let sources = $state(emptySources());
  let tried = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  // A fresh form each time it opens.
  $effect(() => {
    if (!open) return;
    sources = emptySources();
    tried = false;
    busy = false;
    error = null;
  });

  const problem = $derived(sourcesError(sources, CONDITIONS.sourcesNeed));

  async function add() {
    tried = true;
    error = null;
    if (problem || busy) return;
    busy = true;
    try {
      await addPromptSources(studyId, sources);
      onAdded();
      onClose();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      onAdded();
    } finally {
      busy = false;
    }
  }
</script>

<Dialog
  {open}
  title={CONDITIONS.sourcesTitle}
  lead={CONDITIONS.sourcesLead}
  width="lg"
  onClose={() => {
    if (!busy) onClose();
  }}
>
  <div data-testid="prompt-sources-dialog">
    <PromptSourcesFields bind:sources hhAllowed={existing === 0} showErrors={tried} />
    {#if tried && (problem || error)}
      <p class="mt-3 text-xs text-danger" role="alert">{problem ?? error}</p>
    {/if}
  </div>
  {#snippet footer()}
    <button type="button" class={BTN.ghost} disabled={busy} onclick={onClose}
      >{CONDITIONS.cancel}</button
    >
    <button
      type="button"
      class={BTN.primary}
      disabled={busy}
      onclick={add}
      data-testid="add-prompts-submit"
    >
      {busy ? CONDITIONS.sourcesAdding : CONDITIONS.sourcesAdd}
    </button>
  {/snippet}
</Dialog>
