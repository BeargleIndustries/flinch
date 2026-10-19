<script lang="ts">
  // Plain-language summary shown at the top of a panel (T21). The live region
  // stays mounted even when empty, so screen readers announce new text politely.
  // `contents` keeps the empty wrapper out of the parent's flex gap.
  //
  // T29: pass `id` and point the panel's chart at it with aria-describedby, so
  // a screen reader reads the summary when focus lands on the chart or grid.
  interface Props {
    text: string | null;
    id?: string;
    /** A lesson hides what this summary gives away until the learner answers (hide-until-predict). */
    hidden?: boolean;
  }

  let { text, id, hidden = false }: Props = $props();
</script>

<div class="contents" role="status" aria-live="polite" aria-atomic="true">
  {#if text}
    <p
      {id}
      data-lesson-hidden={hidden || undefined}
      class="rounded-md border border-accentSoft/50 bg-accentSoft/30 px-3 py-2 text-xs leading-relaxed text-text2"
    >
      <span class="sr-only">In plain words: </span>{text}
    </p>
  {/if}
</div>
