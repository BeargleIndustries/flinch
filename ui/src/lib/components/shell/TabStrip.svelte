<!--
  A strip of route links styled as tabs (brief 6.1 item 4, 6.3): the header's
  sections and the Studies and Data sub-tabs. The active tab is the one whose
  path the URL starts with. Left and Right move focus between tabs; Home and
  End jump to the ends. Styled as Pry's TabbedPanel strip.
-->
<script lang="ts">
  import { page } from '$app/state';

  export interface LinkTab {
    href: string;
    label: string;
    /** Path prefix that marks the tab active; defaults to `href`. */
    base?: string;
  }

  interface Props {
    tabs: readonly LinkTab[];
    label: string;
    /** `data-tour` on the strip. */
    anchor?: string;
    /** `header`: the 44px section tabs; `sub`: the strip above a section's screens. */
    variant?: 'header' | 'sub';
  }

  let { tabs, label, anchor, variant = 'sub' }: Props = $props();

  let strip: HTMLElement | null = $state(null);

  const path: string = $derived(page.url.pathname);
  const isActive = (t: LinkTab) => {
    const base = t.base ?? t.href;
    return path === base || path.startsWith(`${base}/`);
  };

  function onKey(e: KeyboardEvent) {
    if (!strip) return;
    const links = [...strip.querySelectorAll<HTMLAnchorElement>('[role="tab"]')];
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % links.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + links.length) % links.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = links.length - 1;
    if (next < 0) return;
    e.preventDefault();
    links[next].focus();
  }
</script>

<div
  bind:this={strip}
  role="tablist"
  aria-label={label}
  data-tour={anchor}
  tabindex="-1"
  onkeydown={onKey}
  class={variant === 'header'
    ? 'flex h-full items-stretch gap-1'
    : 'flex shrink-0 items-stretch gap-5 border-b border-border'}
>
  {#each tabs as tab (tab.href)}
    {@const active = isActive(tab)}
    <a
      href={tab.href}
      role="tab"
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      tabindex={active ? 0 : -1}
      class="relative -mb-px flex items-center border-b-2 transition-colors focus:outline-none focus-visible:text-text {variant ===
      'header'
        ? 'px-3 text-[13px] font-medium'
        : 'px-0.5 pb-2 pt-0.5 text-xs'} {active
        ? 'border-accentHover text-accentText'
        : 'border-transparent text-text3 hover:text-text'}"
    >
      {tab.label}
    </a>
  {/each}
</div>
