<!-- Brand (brief 6.1 item 1): the F. mark and the name, linking to Probe. -->
<script lang="ts">
  import { SHELL } from '$lib/copy/shell';
  import FlinchMark from './FlinchMark.svelte';
</script>

<a
  href="/probe"
  aria-label={SHELL.brandLink}
  class="group flex shrink-0 items-center gap-2 rounded-md py-1 pr-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
>
  <FlinchMark class="transition-transform duration-200 group-hover:-rotate-3" />
  <span class="text-sm font-semibold tracking-tight text-text">{SHELL.brand}</span>
</a>
