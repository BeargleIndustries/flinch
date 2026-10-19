<!--
  Publish preview (brief 9.3, I10). Markdown and CSV show as text in a
  monospace block; HTML and PDF show the returned page in
  <iframe sandbox="" src={blobUrl}>, so the page cannot run script or reach
  the sidecar and nothing is put into the app's own DOM. The blob URL is
  revoked when the document changes or the screen closes. Download goes
  through DownloadLink and saveDownload (disabled with the B24 sentence for
  a PDF when capabilities.pdf is false); Copy is not offered for a PDF.
-->
<script lang="ts">
  import CopyButton from '$lib/components/CopyButton.svelte';
  import DownloadLink from '$lib/components/DownloadLink.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { saveDownload } from '$lib/components/save-download';
  import { PUBLISH } from '$lib/copy/data';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { downloadPath, fileName, previewsAsPage, templateLabel } from './publish';
  import { publish } from './publish-store.svelte';

  const doc = $derived(publish.doc);
  const asPage = $derived(doc ? previewsAsPage(doc.format) : false);
  const pdfBlocked = $derived(doc?.format === 'pdf' && capabilities.caps?.pdf !== true);

  let frameUrl = $state<string | null>(null);
  $effect(() => {
    const d = doc;
    if (!d || !previewsAsPage(d.format)) {
      frameUrl = null;
      return;
    }
    const url = URL.createObjectURL(new Blob([d.content], { type: 'text/html;charset=utf-8' }));
    frameUrl = url;
    return () => URL.revokeObjectURL(url);
  });
</script>

<Panel eyebrow={PUBLISH.previewEyebrow} title={PUBLISH.previewTitle}>
  <div
    class="flex flex-col gap-3"
    data-testid="publish-preview"
    data-export-id={doc?.id}
    data-format={doc?.format}
    aria-busy={publish.opening !== null || publish.making}
  >
    {#if !doc}
      <p
        class="rounded-md border border-dashed border-borderStrong px-4 py-8 text-center text-xs text-text4"
      >
        {publish.opening !== null ? PUBLISH.previewLoading : PUBLISH.previewEmpty}
      </p>
    {:else}
      <div class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p class="truncate font-mono text-xs text-text" data-testid="publish-preview-name">
          {doc.name}
        </p>
        <p class="font-mono text-[10px] uppercase tracking-wider text-text4">
          {PUBLISH.docMeta(
            templateLabel(doc.template, PUBLISH.templates),
            PUBLISH.formats[doc.format],
          )}
        </p>
      </div>

      {#if asPage}
        <div class="overflow-hidden rounded-md border border-borderStrong bg-white">
          {#if frameUrl}
            <iframe
              sandbox=""
              src={frameUrl}
              title={PUBLISH.frameTitle(doc.name)}
              class="block h-[32rem] w-full border-0"
              data-testid="publish-preview-frame"
            ></iframe>
          {/if}
        </div>
        {#if doc.format === 'pdf'}
          <p class="text-xs text-text3" data-testid="publish-pdf-note">{PUBLISH.pdfNote}</p>
        {/if}
      {:else}
        <pre
          class="max-h-[32rem] overflow-auto whitespace-pre rounded-md border border-border bg-bg px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-text2"
          data-testid="publish-preview-text">{doc.content}</pre>
      {/if}

      <div class="flex items-center gap-3 border-t border-border">
        <div class="min-w-0 flex-1">
          <DownloadLink
            path={downloadPath(doc.id)}
            label={fileName(doc.name, doc.format)}
            description={PUBLISH.downloadWhy[doc.format]}
            fallbackName={fileName(doc.name, doc.format)}
            onDownload={saveDownload}
            disabled={pdfBlocked}
            disabledReason={PUBLISH.pdfUnavailable}
          />
        </div>
        {#if doc.format !== 'pdf'}
          <CopyButton text={doc.content} label={PUBLISH.copy} />
        {/if}
      </div>
    {/if}
  </div>
</Panel>
