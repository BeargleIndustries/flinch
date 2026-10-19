<!--
  Sidecar chip (brief 6.1 item 3), after Pry's EngineStatusChip. "Sidecar
  ready" (ok dot) after a 200 from /health, "Sidecar starting" (warn dot)
  before the first answer, "Sidecar offline" (danger dot) after a failed one.
  The popover lists the version, the database path and how many keys are set,
  and in the desktop app offers "Restart sidecar". The capabilities store polls
  /health every 15 s.
-->
<script lang="ts">
  import { LoaderCircle, RotateCcw } from 'lucide-svelte';
  import { SHELL } from '$lib/copy/shell';
  import { friendlyError } from '$lib/errors';
  import { isTauri } from '$lib/is-tauri';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { restartSidecar } from '$lib/tauri';

  let open = $state(false);
  let restarting = $state(false);
  let restartError = $state<string | null>(null);
  let root: HTMLDivElement | null = $state(null);
  const uid = $props.id();
  const desktop = isTauri();

  const phase = $derived(capabilities.sidecar);
  const h = $derived(capabilities.health);
  const label = $derived(
    phase === 'ready'
      ? SHELL.sidecarReady
      : phase === 'connecting'
        ? SHELL.sidecarStarting
        : SHELL.sidecarOffline,
  );
  const dot = $derived(
    phase === 'ready' ? 'bg-ok' : phase === 'connecting' ? 'bg-warn' : 'bg-danger',
  );

  async function restart() {
    if (restarting) return;
    restarting = true;
    restartError = null;
    try {
      await restartSidecar();
      await capabilities.restarted();
    } catch (e) {
      restartError = friendlyError(e).message;
    } finally {
      restarting = false;
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
</script>

<svelte:window onkeydown={onWindowKey} onpointerdown={onWindowPointer} />

<div bind:this={root} class="relative shrink-0">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-controls="sidecar-pop-{uid}"
    data-testid="sidecar-chip"
    data-state={phase}
    class="flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover {phase ===
    'crashed'
      ? 'border-danger/40 bg-dangerSoft/40 text-danger'
      : 'border-border bg-bg/60 text-text3 hover:border-borderStrong hover:text-text2'}"
  >
    <span class="relative flex h-1.5 w-1.5" aria-hidden="true">
      {#if phase === 'connecting'}
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn/70"
        ></span>
      {/if}
      <span class="relative inline-flex h-1.5 w-1.5 rounded-full {dot}"></span>
    </span>
    {label}
  </button>

  {#if open}
    <div
      id="sidecar-pop-{uid}"
      role="dialog"
      aria-label={SHELL.sidecarDetails}
      class="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border border-borderStrong bg-surface p-3 text-xs shadow-xl shadow-black/40"
    >
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt class="text-text4">{SHELL.version}</dt>
        <dd class="font-mono text-text2" data-testid="sidecar-version">{h?.version ?? '-'}</dd>
        <dt class="text-text4">{SHELL.database}</dt>
        <dd class="break-all font-mono text-[11px] text-text2">{h?.db_path ?? '-'}</dd>
        <dt class="text-text4">{SHELL.keys}</dt>
        <dd class="text-text2">{h ? SHELL.keysSet(h.keys_set) : '-'}</dd>
      </dl>
      {#if restartError}
        <p class="mt-2 text-danger">{restartError}</p>
      {/if}
      {#if desktop}
        <button
          type="button"
          onclick={restart}
          disabled={restarting}
          class="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-borderStrong bg-surface2 px-3 py-1.5 text-text2 transition-colors hover:border-accent hover:text-accentText disabled:cursor-wait disabled:opacity-60"
        >
          {#if restarting}
            <LoaderCircle class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {SHELL.restarting}
          {:else}
            <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
            {SHELL.restartSidecar}
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</div>
