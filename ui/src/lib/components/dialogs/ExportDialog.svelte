<!--
  Export dialog (brief 9.5, D24, I21; compare summary 9.9). Opened from the
  header's Export button on `shell.exportOpen`. A grouped list where every
  row is a DownloadLink with a label and one sentence:

    Raw data          JSON, CSV (the four include flags below apply to both)
    Reports           Findings, Research report, Web page, PDF, then the theme
    For tools         AI agent format, then "Options for the JSON and CSV rows"
    Compare sessions  other sessions to pick, a summary line, JSON and CSV

  Downloads go through saveDownload: a blob download named by the server in
  the browser, a save dialog opening in Downloads in the desktop app (R10
  sentence when the folder is out of scope, nothing when cancelled). The PDF
  row is disabled with its reason when `capabilities.pdf` is false (B24).
  Paths and query flags are built in export-paths.ts.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Bot, Database, FileText, GitCompareArrows } from 'lucide-svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import Dialog from '$lib/components/Dialog.svelte';
  import DownloadLink from '$lib/components/DownloadLink.svelte';
  import { saveDownload } from '$lib/components/save-download';
  import { EXPORT } from '$lib/copy/export';
  import { friendlyError } from '$lib/errors';
  import { read, write } from '$lib/prefs';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { session } from '$lib/stores/session.svelte';
  import { status } from '$lib/stores/status.svelte';
  import {
    DEFAULT_INCLUDE,
    DEFAULT_THEME,
    compareExportPath,
    compareIds,
    compareQuery,
    fallbackName,
    pickTheme,
    rawExportPath,
    reportExportPath,
    themedExportPath,
    type CompareSummary,
    type IncludeOptions,
    type ThemeOption,
  } from './export-paths';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  const uid = $props.id();
  const INCLUDE_KEYS = ['turns', 'annotations', 'policy', 'variants'] as const;

  let include = $state<IncludeOptions>({ ...DEFAULT_INCLUDE });
  let themes = $state<ThemeOption[]>([]);
  let theme = $state(read('export_theme') ?? DEFAULT_THEME);
  let themesLoaded = false;

  let picked = $state<Set<number>>(new Set());
  let summary = $state<CompareSummary | null>(null);
  let summaryBusy = $state(false);
  let summaryError = $state<string | null>(null);
  let summarySeq = 0;

  const current = $derived(session.current);
  const sid = $derived(current?.id ?? null);
  const stem = $derived(sid === null ? 'session' : `session-${sid}`);
  const others = $derived(session.list.filter((s) => s.id !== sid));
  const ids = $derived(sid === null ? [] : compareIds(sid, picked));
  const canCompare = $derived(ids.length >= 2);

  const pdf = $derived(capabilities.caps?.pdf);
  const themeDescription = $derived(themes.find((t) => t.name === theme)?.description ?? '');

  // Every open: fresh compare picks, the session list and the capabilities
  // re-read, and the themes listed once.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      picked = new Set();
      summary = null;
      summaryError = null;
      void session.refresh();
      void capabilities.loadCapabilities();
      if (!themesLoaded) void loadThemes();
    });
  });

  async function loadThemes() {
    try {
      themes = await status.track(request<ThemeOption[]>(ROUTES.listThemes));
      themesLoaded = true;
      theme = pickTheme(theme, themes);
    } catch {
      // The select keeps the saved or default theme; the server falls back too.
    }
  }

  function setTheme(next: string) {
    theme = next;
    write('export_theme', next);
  }

  function toggle(id: number, on: boolean) {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    picked = next;
  }

  // The summary line follows the picks; a newer pick drops an older answer.
  $effect(() => {
    const list = ids;
    const ready = open && canCompare;
    untrack(() => {
      const seq = ++summarySeq;
      summary = null;
      summaryError = null;
      if (ready) void loadSummary(list, seq);
      else summaryBusy = false;
    });
  });

  async function loadSummary(list: number[], seq: number) {
    summaryBusy = true;
    try {
      const res = await status.track(
        request<CompareSummary>(ROUTES.compareSessions, { query: compareQuery(list) }),
      );
      if (seq === summarySeq) summary = res;
    } catch (e) {
      if (seq === summarySeq) summaryError = friendlyError(e).message;
    } finally {
      if (seq === summarySeq) summaryBusy = false;
    }
  }

  const groupHead =
    'mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text3';
  const groupBody = 'divide-y divide-border rounded-lg border border-border bg-bg/40 px-3';
  const field =
    'w-full rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50';
  const check =
    'h-3.5 w-3.5 shrink-0 rounded border-borderStrong bg-bg accent-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover';
</script>

<Dialog {open} {onClose} title={EXPORT.title(current?.name ?? '')} lead={EXPORT.lead} width="lg">
  {#if sid !== null}
    <div class="flex flex-col gap-5" data-testid="export-dialog">
      <section aria-labelledby="ex-raw-{uid}" data-testid="export-group-raw">
        <h3 id="ex-raw-{uid}" class={groupHead}>
          <Database class="h-3.5 w-3.5" aria-hidden="true" />{EXPORT.groups.raw}
        </h3>
        <div class={groupBody}>
          <DownloadLink
            label={EXPORT.rows.json.label}
            description={EXPORT.rows.json.sentence}
            path={rawExportPath(sid, 'json', include)}
            fallbackName={fallbackName(stem, 'json')}
            onDownload={saveDownload}
          />
          <DownloadLink
            label={EXPORT.rows.csv.label}
            description={EXPORT.rows.csv.sentence}
            path={rawExportPath(sid, 'csv', include)}
            fallbackName={fallbackName(stem, 'csv')}
            onDownload={saveDownload}
          />
        </div>
      </section>

      <section aria-labelledby="ex-reports-{uid}" data-testid="export-group-reports">
        <h3 id="ex-reports-{uid}" class={groupHead}>
          <FileText class="h-3.5 w-3.5" aria-hidden="true" />{EXPORT.groups.reports}
        </h3>
        <div class={groupBody}>
          <DownloadLink
            label={EXPORT.rows.findings.label}
            description={EXPORT.rows.findings.sentence}
            path={reportExportPath(sid, 'findings')}
            fallbackName={fallbackName(`findings-${sid}`, 'json')}
            onDownload={saveDownload}
          />
          <DownloadLink
            label={EXPORT.rows.report.label}
            description={EXPORT.rows.report.sentence}
            path={reportExportPath(sid, 'report')}
            fallbackName={fallbackName(`report-${sid}`, 'md')}
            onDownload={saveDownload}
          />
          <DownloadLink
            label={EXPORT.rows.html.label}
            description={EXPORT.rows.html.sentence}
            path={themedExportPath(sid, 'html', theme)}
            fallbackName={fallbackName(stem, 'html')}
            onDownload={saveDownload}
          />
          <DownloadLink
            label={EXPORT.rows.pdf.label}
            description={EXPORT.rows.pdf.sentence}
            path={themedExportPath(sid, 'pdf', theme)}
            fallbackName={fallbackName(stem, 'pdf')}
            onDownload={saveDownload}
            disabled={pdf !== true}
            disabledReason={pdf === false ? EXPORT.pdfUnavailable : undefined}
          />
          <div class="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-4">
            <label for="ex-theme-{uid}" class="shrink-0 text-sm text-text">{EXPORT.theme}</label>
            <div class="min-w-0 flex-1 sm:max-w-sm">
              <select
                id="ex-theme-{uid}"
                value={theme}
                onchange={(e) => setTheme(e.currentTarget.value)}
                class={field}
              >
                {#if themes.length === 0}
                  <option value={theme}>{theme}</option>
                {/if}
                {#each themes as t (t.name)}
                  <option value={t.name}>{t.display_name}</option>
                {/each}
              </select>
              <p class="mt-1 text-xs text-text4">{themeDescription || EXPORT.themeHint}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="ex-tools-{uid}" data-testid="export-group-tools">
        <h3 id="ex-tools-{uid}" class={groupHead}>
          <Bot class="h-3.5 w-3.5" aria-hidden="true" />{EXPORT.groups.tools}
        </h3>
        <div class={groupBody}>
          <DownloadLink
            label={EXPORT.rows.agent.label}
            description={EXPORT.rows.agent.sentence}
            path={reportExportPath(sid, 'agent')}
            fallbackName={fallbackName(`agent-${sid}`, 'json')}
            onDownload={saveDownload}
          />
          <fieldset class="py-2.5">
            <legend class="float-left mb-2 w-full text-sm text-text">{EXPORT.options}</legend>
            <div class="clear-left grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {#each INCLUDE_KEYS as key (key)}
                <label
                  class="flex cursor-pointer items-center gap-2 text-xs text-text2 hover:text-text"
                >
                  <input type="checkbox" bind:checked={include[key]} class={check} />
                  {EXPORT.include[key]}
                </label>
              {/each}
            </div>
          </fieldset>
        </div>
      </section>

      <section aria-labelledby="ex-compare-{uid}" data-testid="export-group-compare">
        <h3 id="ex-compare-{uid}" class={groupHead}>
          <GitCompareArrows class="h-3.5 w-3.5" aria-hidden="true" />{EXPORT.groups.compare}
        </h3>
        <div class={groupBody}>
          <div class="py-2.5">
            <p id="ex-compare-lead-{uid}" class="mb-2 text-xs text-text3">{EXPORT.compareLead}</p>
            {#if others.length === 0}
              <p class="text-xs text-text4">{EXPORT.compareNone}</p>
            {:else}
              <ul
                class="max-h-36 overflow-y-auto rounded-md border border-border bg-bg px-2 py-1.5"
                aria-label={EXPORT.compareSessionsLabel}
                aria-describedby="ex-compare-lead-{uid}"
              >
                {#each others as s (s.id)}
                  <li>
                    <label
                      class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-text2 hover:bg-surface2 hover:text-text"
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(s.id)}
                        onchange={(e) => toggle(s.id, e.currentTarget.checked)}
                        class={check}
                      />
                      <span class="truncate">{EXPORT.compareOption(s.name, s.target_model)}</span>
                    </label>
                  </li>
                {/each}
              </ul>
            {/if}
            <p class="mt-2 min-h-4 text-xs" aria-live="polite" data-testid="export-compare-summary">
              {#if summaryError}
                <span class="text-danger">{summaryError}</span>
              {:else if summary}
                <span class="text-text"
                  >{EXPORT.compareSummary(
                    summary.probes_in_all_sessions,
                    summary.agreement_rate,
                  )}</span
                >
              {:else if summaryBusy}
                <span class="text-text4">{EXPORT.compareLoading}</span>
              {/if}
            </p>
          </div>
          <DownloadLink
            label={EXPORT.rows.compareJson.label}
            description={EXPORT.rows.compareJson.sentence}
            path={compareExportPath(ids, 'json')}
            fallbackName={fallbackName(`compare-${ids.join('-')}`, 'json')}
            onDownload={saveDownload}
            disabled={!canCompare}
            disabledReason={EXPORT.comparePickOne}
          />
          <DownloadLink
            label={EXPORT.rows.compareCsv.label}
            description={EXPORT.rows.compareCsv.sentence}
            path={compareExportPath(ids, 'csv')}
            fallbackName={fallbackName(`compare-${ids.join('-')}`, 'csv')}
            onDownload={saveDownload}
            disabled={!canCompare}
            disabledReason={EXPORT.comparePickOne}
          />
        </div>
      </section>
    </div>
  {/if}

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="rounded-md border border-borderStrong px-3 py-1.5 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
      >{EXPORT.close}</button
    >
  {/snippet}
</Dialog>
