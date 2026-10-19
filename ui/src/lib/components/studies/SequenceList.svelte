<!--
  Sequences, "Sequences in this session" (brief 8.4): GET
  /api/sessions/{id}/sequences, newest first, one SequenceCard each.
-->
<script lang="ts">
  import { RotateCw } from 'lucide-svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { SEQUENCES as S } from '$lib/copy/studies';
  import { BTN } from '../probe/styles';
  import SequenceCard from './SequenceCard.svelte';
  import { sequences } from './sequences.svelte';

  interface Props {
    sessionId: number;
  }

  let { sessionId }: Props = $props();

  const rows = $derived(sequences.sessionId === sessionId ? sequences.list : []);
</script>

<Panel eyebrow={S.listEyebrow} title={S.listTitle} readout={rows.length ? S.listReadout : null}>
  {#snippet actions()}
    {#if rows.length}
      <span class="font-mono text-[11px] tabular-nums text-text4" data-testid="sequence-count"
        >{S.listCount(rows.length)}</span
      >
    {/if}
  {/snippet}

  {#if sequences.listError && rows.length === 0}
    <div class="flex items-center gap-3">
      <p class="text-xs text-danger" role="alert">{sequences.listError}</p>
      <button type="button" class={BTN.secondary} onclick={() => void sequences.load(sessionId)}>
        <RotateCw class="h-3.5 w-3.5" aria-hidden="true" />
        {S.loadAgain}
      </button>
    </div>
  {:else if sequences.loaded && rows.length === 0}
    <div class="rounded-lg border border-dashed border-border" data-testid="sequence-empty">
      <EmptyState title={S.empty} body={S.emptyBody} />
    </div>
  {:else}
    <ul class="grid gap-3 lg:grid-cols-2" data-testid="sequence-list">
      {#each rows as seq (seq.id)}
        <SequenceCard {seq} />
      {/each}
    </ul>
  {/if}
</Panel>
