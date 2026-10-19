<!-- One saved comparison (brief 8.5): agreement, the grid and each answer. -->
<script lang="ts">
  import { page } from '$app/state';
  import ComparisonView from '$lib/components/studies/ComparisonView.svelte';

  const id = $derived(Number(page.params.id));
</script>

{#key id}
  <ComparisonView {id} />
{/key}
