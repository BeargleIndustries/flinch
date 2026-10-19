<!--
  Card (brief 5.6): eyebrow, title row with actions on the right, the
  plain-words Readout when set (principle 1: say what the panel answers
  before how it works), then the content.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Readout from './Readout.svelte';

  interface Props {
    title: string;
    eyebrow?: string;
    readout?: string | null;
    actions?: Snippet;
    children: Snippet;
    /** `data-tour` name on the card, for tips and the tour. */
    anchor?: string;
  }

  let { title, eyebrow, readout = null, actions, children, anchor }: Props = $props();

  const uid = $props.id();
</script>

<section
  aria-labelledby="panel-{uid}"
  data-tour={anchor}
  class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
>
  <header class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      {#if eyebrow}
        <p class="text-[10px] font-medium uppercase tracking-widest text-text4">{eyebrow}</p>
      {/if}
      <h2 id="panel-{uid}" class="truncate text-sm font-semibold text-text">{title}</h2>
    </div>
    {#if actions}
      <div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
    {/if}
  </header>
  <Readout text={readout} />
  {@render children()}
</section>
