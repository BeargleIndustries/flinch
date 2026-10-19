<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // "/" has no screen of its own; the app opens on the Probe section.
  onMount(() => {
    void goto('/probe', { replaceState: true });
  });
</script>
