<!--
  Probe picker (brief 5.6): choose which probes a study runs. Search by name
  or prompt text, domain headers with tri-state checkboxes, one checkbox per
  probe, "All" and "None" for what is visible, and "{n} of {total} selected".
-->
<script lang="ts">
  import {
    clearVisible,
    countLine,
    filterProbes,
    groupByDomain,
    selectVisible,
    toggleGroup,
    toggleOne,
    triState,
    type PickerProbe,
  } from './probe-picker';

  interface Props {
    probes: PickerProbe[];
    selected: Set<number>;
    onChange: (next: Set<number>) => void;
    height?: string;
  }

  let { probes, selected, onChange, height = '16rem' }: Props = $props();

  let query = $state('');

  const visible = $derived(filterProbes(probes, query));
  const groups = $derived(groupByDomain(visible));
  const visibleIds = $derived(visible.map((p) => p.id));

  /** Sets a checkbox's indeterminate flag, which has no attribute form. */
  function indeterminate(el: HTMLInputElement, on: boolean) {
    el.indeterminate = on;
    return {
      update(next: boolean) {
        el.indeterminate = next;
      },
    };
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && query) {
      e.preventDefault();
      e.stopPropagation();
      query = '';
    }
  }

  const link =
    'text-xs text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:text-text4 disabled:no-underline';
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-3">
    <input
      type="search"
      bind:value={query}
      onkeydown={onSearchKey}
      placeholder="Search probes"
      aria-label="Search probes"
      class="min-w-0 flex-1 rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-sm text-text placeholder:text-text4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
    <button
      type="button"
      class={link}
      disabled={visibleIds.length === 0}
      onclick={() => onChange(selectVisible(visibleIds, selected))}>All</button
    >
    <button
      type="button"
      class={link}
      disabled={visibleIds.length === 0}
      onclick={() => onChange(clearVisible(visibleIds, selected))}>None</button
    >
  </div>

  <div
    class="overflow-y-auto rounded-md border border-border bg-bg/60"
    style:height
    role="group"
    aria-label="Probes"
  >
    {#if probes.length === 0}
      <p class="px-3 py-6 text-center text-xs text-text4">No probes yet. Load or add some first.</p>
    {:else if visible.length === 0}
      <p class="px-3 py-6 text-center text-xs text-text4">No probe matches that search.</p>
    {:else}
      {#each groups as group (group.domain)}
        {@const ids = group.probes.map((p) => p.id)}
        {@const tri = triState(ids, selected)}
        <div>
          <label
            class="sticky top-0 z-[1] flex cursor-pointer items-center gap-2 border-b border-border bg-surface px-3 py-1.5"
          >
            <input
              type="checkbox"
              checked={tri === 'all'}
              use:indeterminate={tri === 'some'}
              onchange={() => onChange(toggleGroup(ids, selected))}
              class="h-3.5 w-3.5 accent-accent"
            />
            <span class="text-[10px] font-medium uppercase tracking-widest text-text3"
              >{group.domain}</span
            >
            <span class="ml-auto font-mono text-[11px] tabular-nums text-text4">
              {ids.filter((id) => selected.has(id)).length}/{ids.length}
            </span>
          </label>
          <ul>
            {#each group.probes as probe (probe.id)}
              <li>
                <label
                  class="flex cursor-pointer items-start gap-2 px-3 py-1.5 hover:bg-surface2/60 {selected.has(
                    probe.id,
                  )
                    ? 'bg-accentSoft/20'
                    : ''}"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(probe.id)}
                    onchange={() => onChange(toggleOne(probe.id, selected))}
                    class="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                  />
                  <span class="min-w-0">
                    <span class="block truncate text-[13px] text-text2">{probe.name}</span>
                    <span class="block truncate font-mono text-[11px] text-text4"
                      >{probe.prompt_text.slice(0, 80)}</span
                    >
                  </span>
                </label>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    {/if}
  </div>

  <p class="font-mono text-xs tabular-nums text-text4" aria-live="polite">
    {countLine(probes, selected)}
  </p>
</div>
