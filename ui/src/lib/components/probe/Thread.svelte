<!--
  The response thread (brief 7.5): the run's turns as a vertical timeline of
  TurnCards, with the readout under the first response.
-->
<script lang="ts">
  import type { Run } from '$lib/api/types';
  import { PROBE } from '$lib/copy/probe';
  import ResponseReadout from './ResponseReadout.svelte';
  import TurnCard from './TurnCard.svelte';
  import type { ThreadItem } from './thread';

  interface Props {
    items: ThreadItem[];
    run: Run;
    onCorrect: (item: ThreadItem, value: string) => void;
  }

  let { items, run, onCorrect }: Props = $props();
</script>

{#snippet readout()}
  <ResponseReadout {run} />
{/snippet}

<ol aria-label={PROBE.threadLabel} class="flex flex-col" data-testid="thread">
  {#each items as item (item.turn.id)}
    <TurnCard
      {item}
      {run}
      onCorrect={(v) => onCorrect(item, v)}
      after={item.first ? readout : undefined}
    />
  {/each}
</ol>
