<!--
  Session switcher (brief 6.1 item 2, D9). The button names the current
  session and, after a middle dot, its model. The menu starts with "New
  session…" (D9), then every session newest first with the current one
  checked, then "Delete this session…" as a two-step ConfirmButton. Model
  compare sessions are not listed (D29, $lib/session). Escape or a click
  outside closes the menu.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, ChevronDown, Plus } from 'lucide-svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import { SHELL } from '$lib/copy/shell';
  import { friendlyError } from '$lib/errors';
  import { truncate } from '$lib/session';
  import { status } from '$lib/stores/status.svelte';
  import { session } from '$lib/stores/session.svelte';
  import { shell } from './shell.svelte';

  const MAX = 28;

  let open = $state(false);
  let root: HTMLDivElement | null = $state(null);
  const uid = $props.id();

  const current = $derived(session.current);

  onMount(() => {
    if (!session.loaded) void session.load();
  });

  function toggle() {
    open = !open;
    // Run counts move while you work; read them again each time the menu opens.
    if (open) void session.load();
  }

  function pick(id: number) {
    session.select(id);
    open = false;
  }

  function newSession() {
    open = false;
    shell.openNewSession();
  }

  async function deleteCurrent() {
    if (!current) return;
    try {
      await session.remove(current.id);
      open = false;
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
    }
  }

  function onWindowKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }

  function onWindowPointer(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }

  const item =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text2 hover:bg-surface2 hover:text-text focus:bg-surface2 focus:outline-none';
</script>

<svelte:window onkeydown={onWindowKey} onpointerdown={onWindowPointer} />

<div bind:this={root} class="relative min-w-0">
  <button
    type="button"
    onclick={toggle}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls="session-menu-{uid}"
    aria-label={SHELL.switcherLabel}
    data-tour="session-switcher"
    data-testid="session-switcher"
    class="flex h-7 min-w-0 max-w-[22rem] items-center gap-1.5 rounded-md border border-transparent px-2 text-left transition-colors hover:border-border hover:bg-surface2 focus:outline-none focus-visible:border-accentHover"
  >
    {#if current}
      <span class="truncate text-[13px] text-text">{truncate(current.name, MAX)}</span>
      <span class="hidden truncate text-xs text-text3 md:inline"
        >· {truncate(current.target_model, MAX)}</span
      >
    {:else}
      <span class="text-[13px] text-text4">{SHELL.noSession}</span>
    {/if}
    <ChevronDown class="h-3.5 w-3.5 shrink-0 text-text4" aria-hidden="true" />
  </button>

  {#if open}
    <div
      id="session-menu-{uid}"
      role="menu"
      aria-label={SHELL.switcherLabel}
      class="absolute left-0 top-full z-50 mt-1 w-[26rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-borderStrong bg-surface py-1 shadow-xl shadow-black/40"
    >
      <button type="button" role="menuitem" onclick={newSession} class="{item} text-accentText">
        <Plus class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {SHELL.newSession}
      </button>
      <div class="my-1 border-t border-border" role="separator"></div>
      <div class="max-h-72 overflow-y-auto">
        {#each session.list as s (s.id)}
          {@const on = s.id === current?.id}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={on}
            onclick={() => pick(s.id)}
            class={item}
          >
            <span class="flex w-3.5 shrink-0 justify-center" aria-hidden="true">
              {#if on}<Check class="h-3.5 w-3.5 text-accentText" />{/if}
            </span>
            <span class="min-w-0 flex-1 truncate" class:text-text={on}>
              {SHELL.sessionRow(s.name, s.target_model, s.run_count)}
            </span>
          </button>
        {:else}
          <p class="px-3 py-1.5 text-xs text-text4">
            {session.loaded ? SHELL.sessionsEmpty : SHELL.sessionsLoading}
          </p>
        {/each}
      </div>
      {#if current}
        <div class="my-1 border-t border-border" role="separator"></div>
        <div class="px-3 py-1.5">
          <ConfirmButton
            label={SHELL.deleteSession}
            confirmLabel={SHELL.deleteSessionConfirm(truncate(current.name, MAX))}
            onConfirm={deleteCurrent}
            danger
            class="w-full"
          />
        </div>
      {/if}
    </div>
  {/if}
</div>
