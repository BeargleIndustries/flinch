<!--
  One export row (brief 5.6, D24): a download button with the sentence that
  says what the file is for under it. Shows "Saving…" while busy, then
  "Saved to {path}" (desktop) or "Downloaded" (dev) for 3 s. Errors show
  inline under the row.

  `onDownload` fetches `path` and saves it: T13's `download(path)` (10.3)
  followed by `saveFile(blob, name)` (10.6). It resolves to the path the
  desktop app wrote, or null when the browser downloaded the file.
-->
<script lang="ts">
  import { Download } from 'lucide-svelte';
  import { friendlyError } from '$lib/errors';
  import { DOWNLOAD_MESSAGE_MS, savedMessage } from './download-link';

  interface Props {
    path: string;
    label: string;
    description: string;
    fallbackName: string;
    onDownload: (path: string, fallbackName: string) => Promise<string | null>;
    disabled?: boolean;
    disabledReason?: string;
  }

  let {
    path,
    label,
    description,
    fallbackName,
    onDownload,
    disabled = false,
    disabledReason,
  }: Props = $props();

  let busy = $state(false);
  let done = $state<string | null>(null);
  let error = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function run() {
    if (busy || disabled) return;
    busy = true;
    done = null;
    error = null;
    try {
      const savedTo = await onDownload(path, fallbackName);
      done = savedMessage(savedTo);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (done = null), DOWNLOAD_MESSAGE_MS);
    } catch (e) {
      error = friendlyError(e).message;
    } finally {
      busy = false;
    }
  }

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });
</script>

<div class="flex items-start justify-between gap-4 py-2">
  <div class="min-w-0">
    <p class="text-sm text-text">{label}</p>
    <p class="text-xs text-text4">{disabled && disabledReason ? disabledReason : description}</p>
    {#if error}
      <p class="mt-1 text-xs text-danger" role="alert">{error}</p>
    {/if}
  </div>
  <div class="flex shrink-0 items-center gap-2">
    {#if done}
      <span class="max-w-[16rem] truncate text-xs text-ok" title={done} aria-live="polite"
        >{done}</span
      >
    {/if}
    <button
      type="button"
      onclick={run}
      disabled={disabled || busy}
      title={disabled ? disabledReason : undefined}
      aria-label={`Download ${label}`}
      class="inline-flex items-center gap-1.5 rounded-md border border-borderStrong px-2.5 py-1 text-xs font-medium text-text2 transition-colors hover:border-accent hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download class="h-3.5 w-3.5" aria-hidden="true" />
      {busy ? 'Saving…' : 'Download'}
    </button>
  </div>
</div>
