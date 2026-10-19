<!--
  A framing group running in this session (brief 8.1): the batch panel from
  brief 7.8 (same stream id `batch:{sessionId}`, so the strip shows it and it
  keeps running when you leave), and once it ends, a way to the Results tab.
-->
<script lang="ts">
  import { ArrowRight } from 'lucide-svelte';
  import { FRAMINGS } from '$lib/copy/studies';
  import BatchRun from '../probe/BatchRun.svelte';
  import { batch } from '../probe/batch.svelte';
  import { BTN } from '../probe/styles';

  interface Props {
    onResults: () => void;
  }

  let { onResults }: Props = $props();

  const ended = $derived(batch.phase === 'finished' || batch.phase === 'stopped');
</script>

<div class="flex flex-col gap-2" data-testid="framing-run">
  <BatchRun />
  {#if ended}
    <button
      type="button"
      class="self-end {BTN.secondary}"
      data-testid="framing-see-results"
      onclick={onResults}
    >
      {FRAMINGS.seeResults}
      <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  {/if}
</div>
