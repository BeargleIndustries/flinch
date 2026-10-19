<!--
  A sequence's export menu (brief 8.4, Appendix C item 43): "Download JSON",
  "Download CSV", "Download HTML", "Download PDF" from
  GET /api/sequences/{id}/export?format=…&theme={flinch:export_theme}. PDF is
  disabled with its reason when the sidecar has no PDF support
  (`capabilities.pdf`). Saving goes through saveDownload: a browser download
  in dev, the save dialog in the desktop app; closing the dialog shows nothing.
-->
<script lang="ts">
  import { ChevronDown, Download } from 'lucide-svelte';
  import { pathFor } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import { savedMessage } from '$lib/components/download-link';
  import { DEFAULT_THEME } from '$lib/components/dialogs/export-paths';
  import { isSaveCancelled, saveDownload } from '$lib/components/save-download';
  import { SEQUENCES as S } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { read } from '$lib/prefs';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import {
    EXPORT_FORMATS,
    exportQuery,
    sequenceFileName,
    type SequenceExportFormat,
  } from './sequences';

  interface Props {
    sequenceId: number;
  }

  let { sequenceId }: Props = $props();

  const uid = $props.id();

  let open = $state(false);
  let busy = $state<SequenceExportFormat | null>(null);
  let done = $state<string | null>(null);
  let error = $state<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const pdf = $derived(capabilities.caps?.pdf);

  function toggle() {
    open = !open;
    if (open) void capabilities.loadCapabilities();
  }

  async function save(format: SequenceExportFormat) {
    if (busy) return;
    busy = format;
    done = null;
    error = null;
    try {
      const theme = read('export_theme') ?? DEFAULT_THEME;
      const path = pathFor(ROUTES.exportSequence, {
        params: { sequence_id: sequenceId },
        query: exportQuery(format, theme),
      });
      done = savedMessage(await saveDownload(path, sequenceFileName(sequenceId, format)));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (done = null), 3000);
    } catch (e) {
      if (!isSaveCancelled(e)) error = friendlyError(e).message;
    } finally {
      busy = null;
    }
  }

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });
</script>

<div class="flex flex-col gap-1.5" data-testid="sequence-export">
  <button
    type="button"
    class="inline-flex w-fit items-center gap-1.5 rounded-md border border-borderStrong px-2.5 py-1 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
    aria-expanded={open}
    aria-controls="seq-export-{uid}"
    title={S.exportWhy}
    onclick={toggle}
    data-testid="sequence-export-toggle"
  >
    <Download class="h-3.5 w-3.5" aria-hidden="true" />
    {S.exportLabel}
    <ChevronDown
      class="h-3 w-3 transition-transform {open ? 'rotate-180' : ''}"
      aria-hidden="true"
    />
  </button>
  {#if open}
    <div id="seq-export-{uid}" class="flex flex-wrap items-center gap-1.5">
      {#each EXPORT_FORMATS as f (f)}
        {@const off = f === 'pdf' && pdf !== true}
        <button
          type="button"
          class="rounded-md border border-border bg-bg/40 px-2 py-1 text-[11px] font-medium text-text2 transition-colors hover:border-accent hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-50"
          disabled={off || busy !== null}
          title={off && pdf === false ? S.pdfUnavailable : undefined}
          onclick={() => void save(f)}
          data-testid="sequence-export-{f}"
        >
          {busy === f ? S.exportSaving : S.exportFormats[f]}
        </button>
      {/each}
    </div>
    {#if pdf === false}
      <p class="text-[11px] text-text4">{S.pdfUnavailable}</p>
    {/if}
  {/if}
  {#if done}
    <p class="text-[11px] text-ok" aria-live="polite">{done}</p>
  {/if}
  {#if error}
    <p class="text-[11px] text-danger" role="alert">{error}</p>
  {/if}
</div>
