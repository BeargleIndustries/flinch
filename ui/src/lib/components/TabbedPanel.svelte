<script lang="ts">
  export interface TabDef {
    id: string;
    label: string;
    icon?: string;
    /** Tooltip shown on hover; use for expanded plain-language descriptions. */
    title?: string;
    /** `data-tour` name on the tab button, for the tour and tips. */
    anchor?: string;
  }

  interface Props {
    tabs: TabDef[];
    activeTab?: string;
    onTabChange?: (id: string) => void;
    /** `data-tour` name on the tab row, for the tour and tips. */
    stripAnchor?: string;
    children: import('svelte').Snippet<[string]>;
  }

  let { tabs, activeTab = $bindable(), onTabChange, stripAnchor, children }: Props = $props();

  // Default to first tab if none set (and follow `tabs` if it changes).
  let internal = $state<string | null>(null);
  const current = $derived(activeTab ?? internal ?? tabs[0]?.id ?? '');

  function select(id: string) {
    internal = id;
    activeTab = id;
    onTabChange?.(id);
  }

  function onTabKey(e: KeyboardEvent) {
    const idx = tabs.findIndex((t) => t.id === current);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % tabs.length;
      select(tabs[next].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + tabs.length) % tabs.length;
      select(tabs[prev].id);
    }
  }
</script>

<div class="flex h-full flex-col">
  {#if tabs.length > 1}
    <div
      role="tablist"
      tabindex="-1"
      aria-label="Panel tabs"
      data-tour={stripAnchor}
      onkeydown={onTabKey}
      class="flex flex-shrink-0 gap-4 border-b border-border px-3"
    >
      {#each tabs as tab (tab.id)}
        {@const isActive = current === tab.id}
        <button
          type="button"
          role="tab"
          aria-selected={isActive}
          tabindex={isActive ? 0 : -1}
          onclick={() => select(tab.id)}
          title={tab.title}
          data-tour={tab.anchor}
          class="relative -mb-px border-b-2 px-1 py-1.5 text-xs transition-colors"
          class:border-accentHover={isActive}
          class:text-accentText={isActive}
          class:border-transparent={!isActive}
          class:text-text4={!isActive}
          class:hover:text-text2={!isActive}
        >
          {tab.label}
        </button>
      {/each}
    </div>
  {/if}
  <div class="flex-1 overflow-y-auto">
    {@render children(current)}
  </div>
</div>
