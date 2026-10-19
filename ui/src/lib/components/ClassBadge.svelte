<!--
  Classification badge (brief 5.3, D6). Orange pair for "pushed against"
  (Refused, Collapsed), blue pair for "went along" (Negotiated, Complied),
  each with a letter glyph so it reads without colour. The title is the
  glossary definition, so hovering a badge says what the word means.
  With `onChange` the badge is a button that opens a four-row menu for
  correcting the classifier.
-->
<script lang="ts">
  import { Check } from 'lucide-svelte';
  import { CLASSES, CLS_SPEC, toCls } from '$lib/cls';
  import { lookupTerm } from '$lib/glossary';

  type Correctable = (typeof CLASSES)[number];

  interface Props {
    value: string | null;
    size?: 'sm' | 'md';
    glyphOnly?: boolean;
    onChange?: (next: Correctable) => void;
  }

  let { value, size = 'md', glyphOnly = false, onChange }: Props = $props();

  const cls = $derived(toCls(value));
  const spec = $derived(CLS_SPEC[cls]);
  const title = $derived(lookupTerm(cls)?.definition ?? spec.word);

  let open = $state(false);
  let root: HTMLSpanElement | null = $state(null);
  let trigger: HTMLButtonElement | null = $state(null);
  let menu: HTMLDivElement | null = $state(null);

  function choose(next: Correctable) {
    open = false;
    trigger?.focus();
    if (next !== cls) onChange?.(next);
  }

  /** Escape closes the menu only; a surrounding dialog stays open. */
  function onEscape(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      open = false;
      trigger?.focus();
    }
  }

  function onWindowPointer(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }

  function onMenuKey(e: KeyboardEvent) {
    onEscape(e);
    if (!menu || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    items[(i + step + items.length) % items.length]?.focus();
  }

  // Focus the current row when the menu opens.
  $effect(() => {
    if (!open || !menu) return;
    const current = menu.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    (current ?? menu.querySelector<HTMLButtonElement>('[role="menuitemradio"]'))?.focus();
  });

  const glyphBox = $derived(size === 'sm' ? 'h-3 w-3 text-[9px]' : 'h-3.5 w-3.5 text-[10px]');
  const pillBox = $derived(
    glyphOnly
      ? 'p-0.5'
      : size === 'sm'
        ? 'gap-1 px-1 py-px text-[11px]'
        : 'gap-1 px-1.5 py-0.5 text-xs',
  );
</script>

<svelte:window onpointerdown={onWindowPointer} />

{#snippet face()}
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-[3px] font-mono font-bold leading-none {glyphBox} {spec.glyphBg} {spec.glyphText}"
    aria-hidden="true">{spec.glyph}</span
  >{#if glyphOnly}<span class="sr-only">{spec.word}</span>{:else}<span>{spec.word}</span>{/if}
{/snippet}

{#if onChange}
  <span class="relative inline-flex" bind:this={root}>
    <button
      type="button"
      bind:this={trigger}
      {title}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`${spec.word}. Change the classification`}
      onclick={() => (open = !open)}
      onkeydown={onEscape}
      class="inline-flex items-center rounded-md border font-medium transition-colors hover:brightness-125 focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover {pillBox} {spec.pill}"
    >
      {@render face()}
    </button>
    {#if open}
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        bind:this={menu}
        role="menu"
        tabindex="-1"
        aria-label="Change the classification"
        onkeydown={onMenuKey}
        class="absolute left-0 top-full z-50 mt-1 w-44 rounded-md border border-borderStrong bg-surface py-1 shadow-xl"
      >
        {#each CLASSES as c (c)}
          {@const s = CLS_SPEC[c]}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={c === cls}
            onclick={() => choose(c)}
            class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-text2 hover:bg-surface2 focus:bg-surface2 focus:outline-none"
          >
            <span
              class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] font-mono text-[10px] font-bold leading-none {s.glyphBg} {s.glyphText}"
              aria-hidden="true">{s.glyph}</span
            >
            <span class="flex-1">{s.word}</span>
            {#if c === cls}<Check class="h-3.5 w-3.5 text-accentText" aria-hidden="true" />{/if}
          </button>
        {/each}
      </div>
    {/if}
  </span>
{:else}
  <span
    {title}
    class="inline-flex items-center rounded-md border font-medium {pillBox} {spec.pill}"
    data-cls={cls}
  >
    {@render face()}
  </span>
{/if}
