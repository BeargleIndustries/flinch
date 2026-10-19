<!--
  A compact download button for list rows and headers (brief 9.1 "Download
  JSON", "Download CSV", "Export everything"). Same behaviour as DownloadLink
  (brief 5.6): the sidecar's file name, "Downloaded" or "Saved to {path}" for
  3 s, nothing on a cancelled save dialog, the error inline otherwise.
-->
<script lang="ts">
  import { Download } from 'lucide-svelte';
  import { BROWSE } from '$lib/copy/data';
  import { friendlyError } from '$lib/errors';
  import { DOWNLOAD_MESSAGE_MS, savedMessage } from '../download-link';
  import { isSaveCancelled, saveDownload } from '../save-download';

  interface Props {
    path: string;
    label: string;
    fallbackName: string;
    title?: string;
    disabled?: boolean;
    testid?: string;
    /** `quiet` for row actions, `outline` for header actions. */
    tone?: 'quiet' | 'outline';
  }

  let {
    path,
    label,
    fallbackName,
    title,
    disabled = false,
    testid,
    tone = 'quiet',
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
      done = savedMessage(await saveDownload(path, fallbackName));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (done = null), DOWNLOAD_MESSAGE_MS);
    } catch (e) {
      if (!isSaveCancelled(e)) error = friendlyError(e).message;
    } finally {
      busy = false;
    }
  }

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });

  const look = $derived(
    tone === 'outline'
      ? 'border border-borderStrong px-3 py-1.5 text-text2 hover:border-accent hover:text-text'
      : 'px-2 py-1 text-text3 hover:bg-surface2 hover:text-text',
  );
</script>

<span class="inline-flex items-center gap-1.5">
  <button
    type="button"
    onclick={run}
    disabled={disabled || busy}
    {title}
    data-testid={testid}
    class="inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-50 {look}"
  >
    <Download class="h-3.5 w-3.5" aria-hidden="true" />
    {busy ? BROWSE.saving : label}
  </button>
  {#if done}
    <span class="max-w-[12rem] truncate text-[11px] text-ok" title={done} aria-live="polite"
      >{done}</span
    >
  {/if}
  {#if error}
    <span class="max-w-[16rem] truncate text-[11px] text-danger" title={error} role="alert"
      >{error}</span
    >
  {/if}
</span>
