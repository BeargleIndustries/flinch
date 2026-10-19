<!--
  Status strip (brief 5.4, 5.6, 6.4): fixed to the bottom of the window, 36px,
  z-45. Left, the newest running job from the status store: its label, counts,
  a "Show" link back to the screen that started it, and "Cancel" when it can
  stop. Right, the newest error with a "Details" disclosure and "Dismiss".
  Errors dismiss themselves after 8 s unless the pointer is over them or the
  details are open. The strip registers its rect so popups never cover it.
-->
<script lang="ts">
  import { status } from '$lib/stores/status.svelte';
  import { occupied, OCCUPIED } from '$lib/popup/occupied.svelte';
  import { progressLine, progressPct } from './stream-progress';

  const ERROR_MS = 8000;

  let strip: HTMLDivElement | null = $state(null);
  let hovered = $state(false);
  let detailsOpen = $state(false);
  let cancelling = $state(false);

  const job = $derived(status.current);
  const err = $derived(status.lastError);
  const uid = $props.id();

  $effect(() => {
    if (!strip) return;
    return occupied.registerElement(OCCUPIED.statusStrip, strip);
  });

  // A new error starts closed.
  $effect(() => {
    void err?.id;
    detailsOpen = false;
  });

  // Auto-dismiss, paused while hovered or while the details are open.
  $effect(() => {
    if (!err || hovered || detailsOpen) return;
    const id = err.id;
    const t = setTimeout(() => status.dismissError(id), ERROR_MS);
    return () => clearTimeout(t);
  });

  async function cancel() {
    if (!job?.cancel || cancelling) return;
    cancelling = true;
    try {
      await job.cancel();
    } finally {
      cancelling = false;
    }
  }

  const link =
    'text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline';
</script>

<div
  bind:this={strip}
  role="region"
  aria-label="Status"
  data-status-strip
  class="fixed inset-x-0 bottom-0 z-[45] flex h-9 items-center gap-6 border-t border-border bg-surface/95 px-4 text-xs backdrop-blur"
>
  <div class="flex min-w-0 flex-1 items-center gap-3" aria-live="polite">
    {#if job}
      <span class="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60"
        ></span>
        <span class="relative inline-flex h-2 w-2 rounded-full bg-accent"></span>
      </span>
      <span class="truncate text-text2">{job.label}</span>
      <span
        class="hidden h-1 w-24 shrink-0 overflow-hidden rounded-full bg-surface2 sm:block"
        aria-hidden="true"
      >
        <span
          class="block h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style:width="{progressPct(job.completed, job.total)}%"
        ></span>
      </span>
      <span class="shrink-0 font-mono tabular-nums text-text3"
        >{progressLine(job.completed, job.total)}</span
      >
      {#if job.failed > 0}
        <span class="shrink-0 font-mono tabular-nums text-danger">{job.failed} failed</span>
      {/if}
      <a href={job.route} class="shrink-0 {link}">Show</a>
      {#if job.cancel}
        <button
          type="button"
          onclick={cancel}
          disabled={cancelling}
          class="shrink-0 text-text3 hover:text-text focus:outline-none focus-visible:text-text disabled:opacity-50"
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      {/if}
    {/if}
  </div>

  {#if err}
    <div
      class="relative flex min-w-0 max-w-[55%] items-center gap-3"
      role="alert"
      onpointerenter={() => (hovered = true)}
      onpointerleave={() => (hovered = false)}
    >
      <span class="h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden="true"></span>
      <span class="truncate text-text" title={err.message}>{err.message}</span>
      {#if err.details}
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="status-details-{uid}"
          onclick={() => (detailsOpen = !detailsOpen)}
          class="shrink-0 {link}">{detailsOpen ? 'Hide details' : 'Details'}</button
        >
      {/if}
      <button
        type="button"
        onclick={() => status.dismissError(err.id)}
        class="shrink-0 text-text3 hover:text-text focus:outline-none focus-visible:text-text"
        >Dismiss</button
      >
      {#if detailsOpen && err.details}
        <div
          id="status-details-{uid}"
          class="absolute bottom-full right-0 mb-2 max-h-64 w-[28rem] max-w-[80vw] overflow-auto rounded-md border border-borderStrong bg-surface p-3 shadow-xl"
        >
          <p
            class="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-text2"
          >
            {err.details}
          </p>
        </div>
      {/if}
    </div>
  {/if}
</div>
