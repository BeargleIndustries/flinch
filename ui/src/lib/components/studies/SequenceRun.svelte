<!--
  Sequences, Run tab (brief 8.4, D30): "New sequence" and "Batch" side by
  side, then "Sequences in this session" and "Strategies". The list follows
  the session; strategies load once per visit.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import SequenceBatch from './SequenceBatch.svelte';
  import SequenceList from './SequenceList.svelte';
  import SequenceNew from './SequenceNew.svelte';
  import StrategiesPanel from './StrategiesPanel.svelte';
  import { sequences } from './sequences.svelte';

  interface Props {
    sessionId: number;
  }

  let { sessionId }: Props = $props();

  $effect(() => {
    untrack(() => void sequences.loadStrategies());
  });

  $effect(() => {
    const id = sessionId;
    untrack(() => void sequences.load(id));
  });
</script>

<div class="flex flex-col gap-4" data-testid="sequence-run">
  <div class="grid items-start gap-4 xl:grid-cols-2">
    <SequenceNew {sessionId} />
    <SequenceBatch {sessionId} />
  </div>
  <SequenceList {sessionId} />
  <StrategiesPanel />
</div>
