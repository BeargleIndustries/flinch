<!--
  The probe rail (brief 6.2, D15), rendered in RailFrame by the root layout in
  Probe and Studies. Header: "{visible} / {total}" and the Select toggle.
  Body: search (Escape clears), the domain filter (kept in
  `flinch:probe_filter_domain`), Add probe / Load defaults / Import a file,
  the fixed "Custom prompt" row, then the session's probes grouped by domain.
  Select mode adds a checkbox per row and a sticky footer for bulk delete.
  Footer: session stats and run history. Up and Down move the active probe
  through the visible list when no field, dialog or overlay has focus.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { FileUp, Plus, RotateCcw, Search } from 'lucide-svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import AddProbeDialog from '$lib/components/dialogs/AddProbeDialog.svelte';
  import ImportProbesDialog from '$lib/components/dialogs/ImportProbesDialog.svelte';
  import RailFrame from '$lib/components/shell/RailFrame.svelte';
  import { shell } from '$lib/components/shell/shell.svelte';
  import { RAIL } from '$lib/copy/rail';
  import { SHELL } from '$lib/copy/shell';
  import { probes } from '$lib/stores/probe.svelte';
  import { session } from '$lib/stores/session.svelte';
  import ProbeRow from './ProbeRow.svelte';
  import RunHistory from './RunHistory.svelte';
  import SessionStats from './SessionStats.svelte';

  let addOpen = $state(false);
  let importOpen = $state(false);
  let list: HTMLDivElement | null = $state(null);

  const hasSession = $derived(session.current !== null);
  const total = $derived(probes.list.length);
  const firstId = $derived(probes.visible[0]?.id ?? null);
  const checkedCount = $derived(probes.checked.size);
  const customActive = $derived(probes.machine.phase === 'custom');

  // Keep the active row in view when Up/Down (or the workspace) moves it.
  $effect(() => {
    const id = probes.activeId;
    if (id === null || !list) return;
    void tick().then(() =>
      list
        ?.querySelector<HTMLElement>(`[data-probe-id="${id}"]`)
        ?.scrollIntoView({ block: 'nearest' }),
    );
  });

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && probes.query) {
      e.preventDefault();
      e.stopPropagation();
      probes.query = '';
    }
  }

  function inField(t: EventTarget | null): boolean {
    if (!(t instanceof HTMLElement)) return false;
    return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
  }

  /** Brief 6.2 Keyboard: Up and Down move the active probe, wrapping. */
  function onWindowKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!hasSession || !shell.railOpen || probes.selecting) return;
    if (shell.shortcutsOpen || shell.settingsOpen || addOpen || importOpen) return;
    if (inField(e.target) || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    e.preventDefault();
    probes.move(e.key === 'ArrowDown' ? 1 : -1);
    void tick().then(() =>
      list?.querySelector<HTMLElement>(`[data-probe-id="${probes.activeId}"]`)?.focus(),
    );
  }

  const link =
    'inline-flex items-center gap-1 text-xs text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:text-text4 disabled:no-underline';
  const field =
    'w-full rounded-md border border-borderStrong bg-bg py-1 text-xs text-text placeholder:text-text4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
  const ghost =
    'rounded-md px-1.5 py-0.5 text-xs text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover';
</script>

<svelte:window onkeydown={onWindowKey} />

{#snippet meta()}
  {#if hasSession && probes.loaded}
    <span data-testid="rail-count">{RAIL.count(probes.visible.length, total)}</span>
  {/if}
{/snippet}

{#snippet actions()}
  {#if hasSession && total > 0}
    <button
      type="button"
      onclick={() => probes.setSelecting(!probes.selecting)}
      aria-pressed={probes.selecting}
      class="{ghost} {probes.selecting ? 'bg-surface2 text-text' : ''}"
    >
      {probes.selecting ? RAIL.selectDone : RAIL.select}
    </button>
  {/if}
{/snippet}

{#snippet footer()}
  <SessionStats />
  <RunHistory />
{/snippet}

<RailFrame
  count={hasSession ? total : null}
  {meta}
  {actions}
  footer={hasSession ? footer : undefined}
>
  {#if !hasSession}
    {#if session.loaded}
      <p class="px-3 py-4 text-xs leading-relaxed text-text4">{SHELL.railNoSession}</p>
    {/if}
  {:else}
    <div bind:this={list} class="flex min-h-full flex-col">
      <div class="flex flex-col gap-2 border-b border-border px-3 py-2.5">
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text4"
            aria-hidden="true"
          />
          <input
            type="search"
            bind:value={probes.query}
            onkeydown={onSearchKey}
            placeholder={RAIL.search}
            aria-label={RAIL.search}
            data-tour="probe-search"
            class="{field} pl-7 pr-2"
          />
        </div>
        {#if probes.domains.length > 0}
          <select
            value={probes.domain}
            onchange={(e) => probes.setDomain((e.currentTarget as HTMLSelectElement).value)}
            aria-label={RAIL.domainLabel}
            class="{field} px-2"
          >
            <option value="">{RAIL.allDomains}</option>
            {#each probes.domains as d (d)}
              <option value={d}>{d}</option>
            {/each}
          </select>
        {/if}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" class={link} onclick={() => (addOpen = true)}>
            <Plus class="h-3 w-3" aria-hidden="true" />{RAIL.addProbe}
          </button>
          <button type="button" class={link} onclick={() => probes.loadDefaults()}>
            <RotateCcw class="h-3 w-3" aria-hidden="true" />{RAIL.loadDefaults}
          </button>
          <button type="button" class={link} onclick={() => (importOpen = true)}>
            <FileUp class="h-3 w-3" aria-hidden="true" />{RAIL.importFile}
          </button>
        </div>
      </div>

      <button
        type="button"
        onclick={() => probes.pickCustom()}
        aria-current={customActive ? 'true' : undefined}
        data-testid="custom-row"
        class="flex flex-col border-b border-l-2 border-b-border/60 px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:bg-surface2 {customActive
          ? 'border-l-accent bg-accentSoft/15'
          : 'border-l-transparent hover:bg-surface2/60'}"
      >
        <span class="text-[13px] {customActive ? 'text-accentText' : 'text-text2'}"
          >{RAIL.custom}</span
        >
        <span class="text-[11px] text-text4">{RAIL.customHint}</span>
      </button>

      <div class="flex-1" aria-label={RAIL.listLabel} role="group">
        {#if !probes.loaded}
          <p class="px-3 py-4 text-xs text-text4">{RAIL.loading}</p>
        {:else if total === 0}
          <p class="px-3 py-4 text-xs leading-relaxed text-text4">{RAIL.empty}</p>
        {:else if probes.visible.length === 0}
          <p class="px-3 py-4 text-xs text-text4">{RAIL.noMatch}</p>
        {:else}
          {#each probes.grouped as group (group.domain)}
            <div>
              <p
                class="sticky top-0 z-[1] border-b border-border/60 bg-surface/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text4 backdrop-blur"
              >
                {group.domain}
              </p>
              <ul>
                {#each group.probes as p (p.id)}
                  <ProbeRow
                    probe={p}
                    active={probes.activeId === p.id}
                    chip={probes.chips.get(p.id)}
                    stat={probes.perProbe.get(p.id)}
                    selecting={probes.selecting}
                    checked={probes.checked.has(p.id)}
                    first={p.id === firstId}
                    onPick={() => probes.pick(p.id)}
                    onToggle={() => probes.toggleChecked(p.id)}
                    onDelete={() => probes.remove(p.id)}
                  />
                {/each}
              </ul>
            </div>
          {/each}
        {/if}
      </div>

      {#if probes.selecting}
        <div
          class="sticky bottom-0 z-[2] flex flex-col gap-2 border-t border-border bg-surface px-3 py-2"
          data-testid="select-footer"
        >
          <div class="flex items-center gap-3">
            <button type="button" class={link} onclick={() => probes.checkAllVisible()}
              >{RAIL.selectAll}</button
            >
            <button
              type="button"
              class={link}
              disabled={checkedCount === 0}
              onclick={() => probes.clearChecked()}>{RAIL.clearSelection}</button
            >
            <span class="flex-1"></span>
            <button type="button" class={ghost} onclick={() => probes.setSelecting(false)}
              >{RAIL.cancel}</button
            >
          </div>
          <ConfirmButton
            label={RAIL.bulkDelete(checkedCount)}
            confirmLabel={RAIL.bulkDeleteConfirm(checkedCount)}
            onConfirm={async () => {
              await probes.removeChecked();
            }}
            disabled={checkedCount === 0}
            danger
            class="w-full"
          />
        </div>
      {/if}
    </div>
  {/if}
</RailFrame>

<AddProbeDialog open={addOpen} onClose={() => (addOpen = false)} />
<ImportProbesDialog open={importOpen} onClose={() => (importOpen = false)} />
