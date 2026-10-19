<!--
  One titled block of the settings drawer (brief 9.7): a small caps label with
  a hairline running to the edge, then the section's rows.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    title: string;
    /** `data-tour` anchor for the tips and the tour. */
    tour?: string;
    children: Snippet;
  }

  let { id, title, tour, children }: Props = $props();
</script>

<section aria-labelledby="settings-{id}" data-tour={tour} data-testid="settings-{id}">
  <h3
    id="settings-{id}"
    class="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-text4"
  >
    <span class="shrink-0">{title}</span>
    <span class="h-px flex-1 bg-border" aria-hidden="true"></span>
  </h3>
  {@render children()}
</section>
