<!-- One conditions study (brief 8.2.3): Run, Results, Raters and Export. -->
<script lang="ts">
  import { page } from '$app/state';
  import ConditionStudy from '$lib/components/studies/ConditionStudy.svelte';

  const id = $derived(Number(page.params.id));
</script>

{#key id}
  <ConditionStudy {id} />
{/key}
