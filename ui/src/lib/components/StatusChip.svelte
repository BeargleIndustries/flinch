<!--
  Study and sequence status pill (brief 5.6): the colour says whether the run
  needs attention (running, paused, failed) or is settled.
-->
<script lang="ts">
  import { TONE_CLASS, statusTone, statusWord } from './status-chip';

  interface Props {
    status: string;
  }

  let { status }: Props = $props();

  const tone = $derived(statusTone(status));
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none {TONE_CLASS[
    tone
  ]}"
  data-status={status}
>
  <span
    class="h-1.5 w-1.5 rounded-full bg-current {tone === 'accent' ? 'animate-pulse' : ''}"
    aria-hidden="true"
  ></span>
  {statusWord(status)}
</span>
