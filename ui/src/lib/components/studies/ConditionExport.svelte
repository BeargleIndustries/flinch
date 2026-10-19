<!--
  A study's Export tab (brief 8.2.3, D20): exactly five files, each a
  DownloadLink with one sentence.

    Responses (CSV)              GET /condition-export (model_id, repetition: B11)
    Responses (JSONL)            GET /export?format=jsonl (B06)
    Everything (JSON)            GET /export
    Preregistration (Markdown)   GET /preregistration, its `preregistration` field
    Report (Markdown)            POST /report, its `report` field; needs a
                                 completed study with statistics

  The first three are files the sidecar names; the two Markdown documents
  arrive as JSON fields, so they are saved under `study-{id}-….md`. The
  Prolific task CSV lives on the Raters tab and the statistics table on the
  Results tab (D20, I22).
-->
<script lang="ts">
  import { FileJson, FileText } from 'lucide-svelte';
  import { pathFor, request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { Experiment } from '$lib/api/types';
  import DownloadLink from '$lib/components/DownloadLink.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { saveDownload, saveText } from '$lib/components/save-download';
  import { CONDITIONS_RESULTS as R } from '$lib/copy/studies';
  import { status } from '$lib/stores/status.svelte';
  import { preregName, reportName, reportReady, textField } from './condition-results';

  interface Props {
    experiment: Experiment;
    /** From the condition comparison; false while it loads or when it failed. */
    hasAnalysis: boolean;
  }

  let { experiment, hasAnalysis }: Props = $props();

  const id = $derived(experiment.id);
  const params = $derived({ experiment_id: experiment.id });
  const ready = $derived(reportReady(experiment.status, hasAnalysis));

  async function savePrereg(_path: string, name: string) {
    const body = await status.track(request<unknown>(ROUTES.getPreregistration, { params }));
    return saveText(textField(body, 'preregistration'), name);
  }

  async function saveReport(_path: string, name: string) {
    const body = await status.track(
      request<unknown>(ROUTES.generateExperimentReport, {
        params,
        body: { format: 'markdown', include_charts: false, include_tables: true },
      }),
    );
    return saveText(textField(body, 'report'), name);
  }

  const group =
    'mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text3';
  const body = 'divide-y divide-border rounded-lg border border-border bg-bg/40 px-3';
</script>

<div class="flex flex-col gap-4" data-testid="condition-export">
  <Panel title={R.exportTitle} readout={R.exportReadout}>
    <div class="flex flex-col gap-5">
      <section data-testid="export-data">
        <h3 class={group}>
          <FileJson class="h-3.5 w-3.5" aria-hidden="true" />{R.dataGroup}
        </h3>
        <div class={body}>
          <DownloadLink
            label={R.rows.csv.label}
            description={R.rows.csv.sentence}
            path={pathFor(ROUTES.exportConditions, { params })}
            fallbackName={`experiment_${id}_conditions.csv`}
            onDownload={saveDownload}
          />
          <DownloadLink
            label={R.rows.jsonl.label}
            description={R.rows.jsonl.sentence}
            path={pathFor(ROUTES.exportExperiment, { params, query: { format: 'jsonl' } })}
            fallbackName={`study-${id}-responses.jsonl`}
            onDownload={saveDownload}
          />
          <DownloadLink
            label={R.rows.json.label}
            description={R.rows.json.sentence}
            path={pathFor(ROUTES.exportExperiment, { params })}
            fallbackName={`study-${id}.json`}
            onDownload={saveDownload}
          />
        </div>
      </section>

      <section data-testid="export-documents">
        <h3 class={group}>
          <FileText class="h-3.5 w-3.5" aria-hidden="true" />{R.documentsGroup}
        </h3>
        <div class={body}>
          <DownloadLink
            label={R.rows.prereg.label}
            description={R.rows.prereg.sentence}
            path={pathFor(ROUTES.getPreregistration, { params })}
            fallbackName={preregName(id)}
            onDownload={savePrereg}
          />
          <DownloadLink
            label={R.rows.report.label}
            description={R.rows.report.sentence}
            path={pathFor(ROUTES.generateExperimentReport, { params })}
            fallbackName={reportName(id)}
            onDownload={saveReport}
            disabled={!ready}
            disabledReason={R.reportNotReady}
          />
        </div>
      </section>
    </div>
  </Panel>
</div>
