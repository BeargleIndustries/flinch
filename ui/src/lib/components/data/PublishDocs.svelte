<!--
  Past documents (brief 9.3, 9.9): GET /api/publication/exports, newest
  first. Each row: name, template, format, date; "Preview" reopens it into
  the preview panel (GET /api/publication/exports/{id}) and DownloadLink
  saves it. The sidecar has no route to delete a saved document.
-->
<script lang="ts">
  import { Eye } from 'lucide-svelte';
  import DownloadLink from '$lib/components/DownloadLink.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { saveDownload } from '$lib/components/save-download';
  import { PUBLISH } from '$lib/copy/data';
  import { formatDate } from '$lib/format';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { downloadPath, fileName, templateLabel } from './publish';
  import { publish } from './publish-store.svelte';

  const shownId = $derived(publish.doc?.id ?? null);
  const pdfReady = $derived(capabilities.caps?.pdf === true);
</script>

<Panel eyebrow={PUBLISH.pastEyebrow} title={PUBLISH.pastTitle}>
  <div data-testid="publish-docs" aria-busy={!publish.docsLoaded}>
    {#if !publish.docsLoaded}
      <p class="text-xs text-text4">{PUBLISH.pastLoading}</p>
    {:else if publish.docsError && publish.docs.length === 0}
      <button
        type="button"
        class="text-xs text-accentText underline-offset-2 hover:underline"
        onclick={() => void publish.loadDocs()}>{PUBLISH.loadAgain}</button
      >
    {:else if publish.docs.length === 0}
      <p class="text-xs text-text4">{PUBLISH.pastEmpty}</p>
    {:else}
      <ul class="-mx-1 flex max-h-[34rem] flex-col overflow-y-auto">
        {#each publish.docs as d (d.id)}
          {@const current = shownId === d.id}
          {@const blocked = d.format === 'pdf' && !pdfReady}
          {@const meta = PUBLISH.pastRow(
            templateLabel(d.template, PUBLISH.templates),
            PUBLISH.formats[d.format],
            formatDate(d.created_at),
          )}
          <li
            class="flex flex-col rounded-md border-l-2 px-2 {current
              ? 'border-accent bg-accentSoft/30'
              : 'border-transparent'}"
            data-testid="publish-doc-row"
            data-export-id={d.id}
          >
            <DownloadLink
              path={downloadPath(d.id)}
              label={fileName(d.name, d.format)}
              description={meta}
              fallbackName={fileName(d.name, d.format)}
              onDownload={saveDownload}
              disabled={blocked}
              disabledReason={PUBLISH.pdfUnavailable}
            />
            <div class="-mt-1 flex min-w-0 items-center gap-2 pb-2">
              {#if current}
                <span class="py-0.5 text-[11px] font-medium text-accentText">{PUBLISH.showing}</span
                >
              {:else}
                <button
                  type="button"
                  class="-ml-1.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-50"
                  disabled={publish.opening !== null || publish.making}
                  onclick={() => void publish.open(d.id)}
                  aria-label={PUBLISH.previewOf(d.name)}
                  data-testid="publish-doc-preview"
                >
                  <Eye class="h-3 w-3" aria-hidden="true" />
                  {PUBLISH.preview}
                </button>
              {/if}
              {#if blocked}
                <span class="min-w-0 truncate text-[11px] text-text4">{meta}</span>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</Panel>
