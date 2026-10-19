<!--
  The header's ? button (brief 9.6, D12), ported from Pry's TourMenu: take the
  tour, read the glossary, the methodology or the policies, or open the
  keyboard shortcuts. Pry's `onLessons` item is gone; `data-tour="header-help"`
  is kept for tour step 9.
-->
<script module lang="ts">
  import { GUIDE_MENU } from '$lib/copy/shell';

  /** The menu's strings (copy/shell.ts, shared with shell.spec.ts). */
  export const guideMenuUi = GUIDE_MENU;
</script>

<script lang="ts">
  import { CircleHelp } from 'lucide-svelte';

  interface Props {
    /** Starts the tour from step 1. */
    onTour: () => void;
    /** Opens the keyboard shortcuts overlay. */
    onShortcuts: () => void;
  }

  let { onTour, onShortcuts }: Props = $props();

  let open = $state(false);

  const links = [
    { href: '/guide/glossary', label: guideMenuUi.glossary },
    { href: '/guide/methodology', label: guideMenuUi.methodology },
    { href: '/guide/policies', label: guideMenuUi.policies },
  ];

  function pick(go: () => void) {
    open = false;
    go();
  }

  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') open = false;
  }

  const item = 'block w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface2';
</script>

<svelte:window onkeydown={onKey} />

<div class="relative">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-label={guideMenuUi.menuButton}
    data-tour="header-help"
    aria-expanded={open}
    aria-haspopup="menu"
    class="rounded-md p-1.5 text-text3 hover:bg-surface2 hover:text-text"
  >
    <CircleHelp class="h-4 w-4" />
  </button>
  {#if open}
    <!-- Click-outside catcher; Escape closes the menu too. -->
    <div role="presentation" class="fixed inset-0 z-40" onclick={() => (open = false)}></div>
    <div
      class="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-borderStrong bg-surface py-1 shadow-xl"
      role="menu"
      data-testid="guide-menu"
    >
      <button type="button" role="menuitem" onclick={() => pick(onTour)} class={item}>
        {guideMenuUi.takeTour}
      </button>
      {#each links as link (link.href)}
        <a href={link.href} role="menuitem" onclick={() => (open = false)} class={item}>
          {link.label}
        </a>
      {/each}
      <button type="button" role="menuitem" onclick={() => pick(onShortcuts)} class={item}>
        {guideMenuUi.shortcuts}
      </button>
    </div>
  {/if}
</div>
