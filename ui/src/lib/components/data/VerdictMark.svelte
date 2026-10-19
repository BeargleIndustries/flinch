<!--
  A scorecard verdict's mark: a small square with a symbol, so a cell reads
  without colour. Equal for Consistent, an up arrow for Over (enforced more than
  the policy claims), a down arrow for Under (enforced less), an asterisk for
  Context, a dash for No data.
-->
<script lang="ts">
  import { ArrowDown, ArrowUp, Asterisk, Equal, Minus } from 'lucide-svelte';
  import type { Verdict } from './scorecard';
  import { VERDICT_STYLE } from './verdict-style';

  let { verdict }: { verdict: Verdict } = $props();

  const ICONS = {
    consistent: Equal,
    over: ArrowUp,
    under: ArrowDown,
    context: Asterisk,
    none: Minus,
  } as const;

  const Icon = $derived(ICONS[verdict]);
</script>

<span
  class="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] {VERDICT_STYLE[
    verdict
  ].mark}"
  aria-hidden="true"
>
  <Icon class="h-2.5 w-2.5" strokeWidth={3} />
</span>
