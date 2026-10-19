<!-- Browse, one sequence (brief 9.1): its header, runs and thread. -->
<script lang="ts">
  import { page } from '$app/state';
  import SequenceDetail from '$lib/components/data/SequenceDetail.svelte';

  const sequenceId = $derived(Number(page.params.id));
</script>

{#key sequenceId}
  <SequenceDetail {sequenceId} />
{/key}
