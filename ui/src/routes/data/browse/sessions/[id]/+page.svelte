<!-- Browse, one session (brief 9.1): its runs, findings, exports and delete. -->
<script lang="ts">
  import { page } from '$app/state';
  import SessionDetail from '$lib/components/data/SessionDetail.svelte';

  const sessionId = $derived(Number(page.params.id));
</script>

{#key sessionId}
  <SessionDetail {sessionId} />
{/key}
