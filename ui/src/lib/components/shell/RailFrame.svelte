<!--
  Probe rail frame (brief 5.4, 6.2, D15): 288px open, 44px collapsed, open by
  default, the state kept in `flinch:rail_open`. The root layout renders it in
  Probe and Studies only. The rail's content (search, filter, list, stats,
  history) is T16's ProbeRail, passed in through the snippets:
  `meta` beside the eyebrow ("{visible} / {total}"), `actions` before the
  collapse toggle ("Select"), `children` for the scrolling body and `footer`
  for the fixed bottom (session stats, run history).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { PanelLeftClose, PanelLeftOpen } from 'lucide-svelte';
  import { SHELL } from '$lib/copy/shell';
  import { shell } from './shell.svelte';

  interface Props {
    /** Probe count shown on the collapsed strip; hidden when null. */
    count?: number | null;
    meta?: Snippet;
    actions?: Snippet;
    children?: Snippet;
    footer?: Snippet;
  }

  let { count = null, meta, actions, children, footer }: Props = $props();

  const open = $derived(shell.railOpen);
  const toggle =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover';
</script>

<aside
  aria-label={SHELL.railLabel}
  data-testid="probe-rail"
  data-open={open}
  data-tour="probe-rail"
  class="flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ease-out {open
    ? 'w-[288px]'
    : 'w-11'}"
>
  {#if open}
    <div class="flex h-10 shrink-0 items-center gap-2 border-b border-border pl-3 pr-1.5">
      <span class="text-[10px] font-semibold uppercase tracking-[0.12em] text-text4"
        >{SHELL.railEyebrow}</span
      >
      {#if meta}
        <span class="font-mono text-xs text-text4">{@render meta()}</span>
      {/if}
      <span class="flex-1"></span>
      {@render actions?.()}
      <button
        type="button"
        onclick={() => shell.setRail(false)}
        aria-label={SHELL.railHide}
        aria-expanded="true"
        class={toggle}
      >
        <PanelLeftClose class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      {@render children?.()}
    </div>
    {#if footer}
      <div class="shrink-0 border-t border-border">{@render footer()}</div>
    {/if}
  {:else}
    <div class="flex flex-col items-center gap-4 py-1.5">
      <button
        type="button"
        onclick={() => shell.setRail(true)}
        aria-label={SHELL.railShow}
        aria-expanded="false"
        class={toggle}
      >
        <PanelLeftOpen class="h-4 w-4" aria-hidden="true" />
      </button>
      {#if count !== null}
        <span
          class="whitespace-nowrap font-mono text-xs text-text4 [writing-mode:vertical-rl]"
          aria-hidden="true">{count}</span
        >
      {/if}
    </div>
  {/if}
</aside>
