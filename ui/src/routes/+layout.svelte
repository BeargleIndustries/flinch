<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';

  // Minimal root layout: loads the tokens and Tailwind. The shell is T15.
  let { children }: { children: Snippet } = $props();
</script>

{@render children()}
