<!--
  One workspace control with its one-line reason under it (principle 1:
  every control says why you would press it). The shortcut letter sits in a
  kbd chip inside the button, hidden from the accessible name.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { BTN, HINT, KBD } from './styles';

  interface Props {
    label: string;
    why: string;
    onclick: () => void;
    variant?: keyof typeof BTN;
    /** The shortcut key shown in the button, e.g. "S". */
    kbd?: string;
    disabled?: boolean;
    /** `data-tour` name for tips and the tour. */
    anchor?: string;
    testid?: string;
    icon?: Snippet;
  }

  let {
    label,
    why,
    onclick,
    variant = 'secondary',
    kbd,
    disabled = false,
    anchor,
    testid,
    icon,
  }: Props = $props();

  const uid = $props.id();
</script>

<div class="flex max-w-[15rem] flex-col items-start gap-1">
  <button
    type="button"
    class={BTN[variant]}
    {onclick}
    {disabled}
    data-tour={anchor}
    data-testid={testid}
    aria-describedby="why-{uid}"
  >
    {#if icon}{@render icon()}{/if}
    <span>{label}</span>
    {#if kbd}<kbd class={KBD} aria-hidden="true">{kbd}</kbd>{/if}
  </button>
  <p id="why-{uid}" class={HINT}>{why}</p>
</div>
