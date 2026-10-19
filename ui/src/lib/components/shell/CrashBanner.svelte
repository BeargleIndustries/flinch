<!--
  Sidecar crash banner (brief 6.1, after Pry's EngineCrashBanner). Desktop:
  on `sidecar:crashed` it says the sidecar stopped, offers "Restart sidecar"
  and a "Details" disclosure with the stderr tail. Dev: after three failed
  /health checks in a row it says how to start the sidecar. It hides on
  `sidecar:restarted` or the next 200 from /health (the capabilities store
  clears both states).
-->
<script lang="ts">
  import { LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-svelte';
  import { SHELL } from '$lib/copy/shell';
  import { friendlyError } from '$lib/errors';
  import { isTauri } from '$lib/is-tauri';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { restartSidecar } from '$lib/tauri';

  const desktop = isTauri();
  let restarting = $state(false);
  let error = $state<string | null>(null);
  let detailsOpen = $state(false);
  const uid = $props.id();

  const crash = $derived(capabilities.crash);
  const shown = $derived(crash !== null || (!desktop && capabilities.unreachable));

  async function restart() {
    if (restarting) return;
    restarting = true;
    error = null;
    try {
      await restartSidecar();
      // sidecar:restarted clears the banner; this covers a missed event.
      await capabilities.restarted();
    } catch (e) {
      error = friendlyError(e).message;
    } finally {
      restarting = false;
    }
  }
</script>

{#if shown}
  <div
    role="alert"
    data-testid="crash-banner"
    class="shrink-0 border-b border-danger/40 bg-dangerSoft/70 px-4 py-2 text-sm text-text"
  >
    <div class="mx-auto flex max-w-4xl items-start gap-3">
      <TriangleAlert class="mt-0.5 h-4 w-4 flex-none text-danger" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="font-medium">{crash ? SHELL.crashed : SHELL.unreachable}</p>
        {#if error}
          <p class="mt-0.5 text-xs text-danger">{error}</p>
        {/if}
        {#if crash && crash.stderr_tail.length > 0}
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="crash-details-{uid}"
            onclick={() => (detailsOpen = !detailsOpen)}
            class="mt-1 text-xs text-text3 underline-offset-2 hover:text-text hover:underline focus:outline-none focus-visible:underline"
          >
            {detailsOpen ? SHELL.hideCrashDetails : SHELL.crashDetails}
          </button>
          {#if detailsOpen}
            <pre
              id="crash-details-{uid}"
              class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-bg/80 p-2 font-mono text-[11px] leading-relaxed text-text2">{crash.stderr_tail.join(
                '\n',
              )}</pre>
          {/if}
        {/if}
      </div>
      {#if desktop}
        <button
          type="button"
          onclick={restart}
          disabled={restarting}
          class="inline-flex flex-none items-center gap-1.5 rounded-md bg-danger/80 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-danger disabled:cursor-wait disabled:opacity-70"
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
  </div>
{/if}
