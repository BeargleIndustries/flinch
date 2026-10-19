<!-- A saved run (brief 7.9): the run's thread in the Probe workspace. -->
<script lang="ts">
  import { page } from '$app/state';
  import SavedRun from '$lib/components/probe/SavedRun.svelte';

  const runId = $derived(Number(page.params.runId));
</script>

{#key runId}
  <SavedRun {runId} />
{/key}
