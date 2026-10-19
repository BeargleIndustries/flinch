<!--
  A study's Results tab (brief 8.2.3, B04, B31, I22; Appendix C 31, 35):

    Condition comparison  one card per condition: responses, the badge bar,
                          the Complied or Negotiated rate, the system prompt;
                          Classify (POST /classify, `{classified, skipped}`)
    Text metrics          compute (stream `metrics:{id}`, `completed/total/pct`),
                          the mean ± sd table with d and Sig once statistics
                          exist, Run statistics (POST /analyze, per-test
                          `error` keys shown as lines), the statistics table
                          download (I22)
    Responses             every prompt with one badge per response grouped by
                          condition (repeat in the title); the picked prompt's
                          answers side by side (GET /responses?prompt_id=)

  The comparison, prompts and cells come from ConditionStudy, which reloads
  them when a run, the metrics job or this tab asks (`onChanged`).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { BarChart3, ListChecks, Search, Sigma, Tags } from 'lucide-svelte';
  import { pathFor, request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { Condition, ConditionComparison, Experiment } from '$lib/api/types';
  import { CLS_SPEC, toCls } from '$lib/cls';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ClassBar from '$lib/components/ClassBar.svelte';
  import DownloadLink from '$lib/components/DownloadLink.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import ResizableSplit from '$lib/components/ResizableSplit.svelte';
  import StreamProgress from '$lib/components/StreamProgress.svelte';
  import { saveDownload } from '$lib/components/save-download';
  import { SCREENS } from '$lib/copy/screens';
  import { CONDITIONS, CONDITIONS_RESULTS as R } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { formatDate } from '$lib/format';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { status } from '$lib/stores/status.svelte';
  import { BTN, FIELD, HINT } from '../probe/styles';
  import { RESPONSES_LIMIT, promptName, type StudyPrompt, type StudyResponse } from './conditions';
  import {
    COLLAPSE_AT,
    analysisLines,
    classCounts,
    clip,
    dTone,
    largestD,
    meanSd,
    metricStat,
    ratePct,
    smallestP,
    stars,
    unclassifiedTotal,
    visibleMetricRows,
    type AnalysisLine,
    type ClassifyResult,
    type StudyResponseText,
  } from './condition-results';
  import type { StudyJob } from './condition-jobs.svelte';
  import type { StudyRun } from './conditions.svelte';

  interface Props {
    experiment: Experiment;
    conditions: Condition[];
    prompts: StudyPrompt[];
    responses: StudyResponse[];
    comparison: ConditionComparison | null;
    comparisonError: string | null;
    run: StudyRun;
    metrics: StudyJob;
    onChanged: () => void;
  }

  let {
    experiment,
    conditions,
    prompts,
    responses,
    comparison,
    comparisonError,
    run,
    metrics,
    onChanged,
  }: Props = $props();

  const uid = $props.id();
  const id = $derived(experiment.id);
  const params = $derived({ experiment_id: experiment.id });
  const running = $derived(run.live || experiment.status === 'running');
  const completedCount = $derived(responses.filter((r) => r.status === 'completed').length);

  // ---- Comparison and Classify (B04) ----------------------------------------

  const unclassified = $derived(unclassifiedTotal(comparison));
  let classifying = $state(false);
  let classifyResult = $state<ClassifyResult | null>(null);

  async function classify() {
    if (classifying || running) return;
    classifying = true;
    try {
      classifyResult = await status.track(
        request<ClassifyResult>(ROUTES.classifyExperiment, { params }),
      );
      onChanged();
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
    } finally {
      classifying = false;
    }
  }

  // ---- Text metrics and statistics (I22, B31) --------------------------------

  const extras = $derived(capabilities.caps?.experiment_extras);
  const analysis = $derived(comparison?.analysis_results ?? null);
  const metricRows = $derived(comparison ? visibleMetricRows(comparison.conditions) : []);
  const showStatsCols = $derived(Boolean(comparison?.has_analysis && analysis));

  let analyzing = $state(false);
  /** The last /analyze answer in this window: it carries per-test errors the saved rows lack. */
  let freshLines = $state<AnalysisLine[] | null>(null);
  let statsError = $state<string | null>(null);
  let computedAt = $state<string | null>(null);

  const lines = $derived(freshLines ?? analysisLines(analysis));
  const errorLines = $derived(lines.filter((l) => l.state === 'error').length);

  $effect(() => {
    untrack(() => void capabilities.loadCapabilities());
  });

  // "Statistics computed {date}" from the newest saved analysis row (9.9).
  $effect(() => {
    const has = comparison?.has_analysis;
    untrack(() => {
      if (has) void loadComputedAt();
      else computedAt = null;
    });
  });

  async function loadComputedAt() {
    try {
      const res = await status.track(
        request<{ results: { created_at: string }[] }>(ROUTES.getExperimentAnalysis, { params }),
      );
      computedAt = res.results[0]?.created_at ?? null;
    } catch {
      computedAt = null;
    }
  }

  function computeMetrics() {
    void metrics.run(R.metricsStream(experiment.name));
  }

  async function runStats() {
    if (analyzing) return;
    analyzing = true;
    statsError = null;
    try {
      const res = await status.track(
        request<{ analysis: Record<string, unknown> }>(ROUTES.analyzeExperiment, { params }),
      );
      freshLines = analysisLines(res.analysis);
      void loadComputedAt();
    } catch (e) {
      const f = friendlyError(e);
      statsError = R.statsFailed(f.message);
      status.error(f.message, f.details);
    } finally {
      analyzing = false;
      onChanged();
    }
  }

  const D_CLASS: Record<string, string> = {
    none: 'text-text3',
    small: 'text-accentText',
    medium: 'text-warn',
    large: 'text-danger',
  };

  // ---- Responses (8.2.3) -----------------------------------------------------

  const sortedConditions = $derived(
    [...conditions].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
  );
  const conditionLabel = $derived(new Map(conditions.map((c) => [c.id, c.label])));

  let query = $state('');
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter((p) =>
      [p.probe_name, p.custom_prompt_text, p.probe_text].some((t) =>
        (t ?? '').toLowerCase().includes(q),
      ),
    );
  });

  /** prompt id → condition id → its cells, by model then repeat. */
  const byPrompt = $derived.by(() => {
    const out = new Map<number, Map<number, StudyResponse[]>>();
    for (const r of responses) {
      let m = out.get(r.prompt_id);
      if (!m) out.set(r.prompt_id, (m = new Map()));
      const list = m.get(r.condition_id);
      if (list) list.push(r);
      else m.set(r.condition_id, [r]);
    }
    for (const m of out.values())
      for (const list of m.values())
        list.sort(
          (a, b) =>
            (a.model_id < b.model_id ? -1 : a.model_id > b.model_id ? 1 : 0) ||
            a.repetition - b.repetition,
        );
    return out;
  });

  let picked = $state<number | null>(null);
  let detail = $state<StudyResponseText[] | null>(null);
  let detailError = $state<string | null>(null);
  let open = $state<Set<number>>(new Set());
  let detailSeq = 0;

  async function pick(promptId: number) {
    picked = promptId;
    detail = null;
    detailError = null;
    open = new Set();
    const mine = ++detailSeq;
    try {
      const res = await status.track(
        request<{ responses: StudyResponseText[] }>(ROUTES.listExperimentResponses, {
          params,
          query: { prompt_id: promptId },
        }),
      );
      if (mine === detailSeq) detail = res.responses;
    } catch (e) {
      if (mine === detailSeq) detailError = friendlyError(e).message;
    }
  }

  // Reload the picked prompt when the study's data changes (a run, Classify).
  $effect(() => {
    void responses;
    untrack(() => {
      if (picked !== null) void pick(picked);
    });
  });

  const detailBy = $derived.by(() => {
    const out = new Map<number, StudyResponseText[]>();
    for (const r of detail ?? []) {
      const list = out.get(r.condition_id);
      if (list) list.push(r);
      else out.set(r.condition_id, [r]);
    }
    for (const list of out.values())
      list.sort(
        (a, b) =>
          (a.model_id < b.model_id ? -1 : a.model_id > b.model_id ? 1 : 0) ||
          a.repetition - b.repetition,
      );
    return out;
  });

  function toggleOpen(rid: number) {
    const next = new Set(open);
    if (next.has(rid)) next.delete(rid);
    else next.add(rid);
    open = next;
  }

  const head = 'text-[10px] font-medium uppercase tracking-widest text-text4';
</script>

<div class="flex flex-col gap-4" data-testid="condition-results">
  {#if running}
    <p class="text-xs text-text3" data-testid="results-running">{R.runningNote}</p>
  {/if}

  <!-- Condition comparison -->
  <Panel title={R.comparisonTitle} readout={R.comparisonReadout}>
    {#snippet actions()}
      {#if comparison && completedCount > 0}
        <button
          type="button"
          class={unclassified > 0 ? BTN.secondary : BTN.ghost}
          title={R.classifyWhy}
          disabled={classifying || running}
          onclick={classify}
          data-testid="classify"
          data-unclassified={unclassified}
        >
          <Tags class="h-3.5 w-3.5" aria-hidden="true" />
          {classifying
            ? R.classifying
            : unclassified > 0
              ? R.classify(unclassified)
              : R.classifyCheck}
        </button>
      {/if}
    {/snippet}

    {#if classifyResult}
      <p
        class="text-xs text-text2"
        aria-live="polite"
        data-testid="classify-result"
        data-classified={classifyResult.classified}
        data-skipped={classifyResult.skipped}
      >
        {R.classifyResult(classifyResult.classified, classifyResult.skipped)}
      </p>
    {/if}

    <!-- A failed reload keeps the last comparison on screen, with the reason above it. -->
    {#if comparisonError}
      <div class="flex items-center justify-between gap-3" data-testid="comparison-error">
        <p class="text-xs text-danger" role="alert">{R.loadFailed} {comparisonError}</p>
        <button type="button" class={BTN.ghost} onclick={onChanged}>{R.reload}</button>
      </div>
    {/if}
    {#if comparison}
      {#if completedCount === 0 && comparison.conditions.every((c) => c.response_count === 0)}
        <p class={HINT}>{R.noResponses}</p>
      {/if}
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="comparison">
        {#each comparison.conditions as c (c.id)}
          {@const counts = classCounts(c)}
          <li
            class="flex flex-col gap-2.5 rounded-md border border-border bg-bg/50 p-3"
            data-testid="comparison-card"
            data-condition-id={c.id}
            data-responses={c.response_count}
            data-unknown={counts.unknown ?? 0}
          >
            <div class="flex items-baseline justify-between gap-2">
              <h3 class="truncate text-[13px] font-semibold text-text" title={c.label}>
                {c.label}
              </h3>
              <span class="shrink-0 font-mono text-[11px] tabular-nums text-text3"
                >{R.responsesCount(c.response_count)}</span
              >
            </div>
            <div class="flex items-baseline gap-2">
              <span
                class="font-mono text-2xl font-semibold tabular-nums tracking-tight text-text"
                data-testid="compliance-rate">{ratePct(c.compliance_rate)}</span
              >
              <span class="text-[11px] text-text3">{R.compliedOrNegotiated}</span>
            </div>
            <ClassBar {counts} legend />
            {#if c.system_prompt.trim()}
              <p class="font-mono text-[11px] leading-relaxed text-text3">
                {clip(c.system_prompt, 160)}
              </p>
            {:else}
              <p class="text-[11px] italic text-text4">{CONDITIONS.noSystemPrompt}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Panel>

  <!-- Text metrics and statistics -->
  <Panel title={R.metricsTitle} readout={SCREENS['conditions.metrics']}>
    {#snippet actions()}
      {#if comparison?.has_metrics && !metrics.live}
        <button
          type="button"
          class={BTN.ghost}
          title={R.measureNewWhy}
          disabled={running}
          onclick={computeMetrics}
          data-testid="measure-new"
        >
          {R.measureNew}
        </button>
      {/if}
    {/snippet}

    {#if metrics.live}
      <div
        data-testid="metrics-progress"
        data-completed={metrics.completed}
        data-total={metrics.total}
      >
        <StreamProgress
          label={R.metricsLabel}
          completed={metrics.completed}
          total={metrics.total}
        />
      </div>
    {:else if metrics.ended === 'nothing'}
      <p class={HINT}>{R.metricsNothing}</p>
    {:else if metrics.ended === 'stopped'}
      <p class={HINT}>{R.metricsStopped}</p>
    {:else if metrics.ended === 'failed' && metrics.error}
      <p class="text-xs text-danger" role="alert">{metrics.error}</p>
    {/if}

    {#if comparison && !comparison.has_metrics && !metrics.live}
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class={BTN.primary}
          disabled={completedCount === 0 || running}
          onclick={computeMetrics}
          data-testid="compute-metrics"
        >
          <BarChart3 class="h-3.5 w-3.5" aria-hidden="true" />
          {R.computeMetrics}
        </button>
        {#if completedCount === 0}<span class={HINT}>{R.metricsNeedResponses}</span>{/if}
      </div>
    {/if}

    {#if comparison?.has_metrics && metricRows.length > 0}
      <div class="overflow-x-auto rounded-md border border-border" data-testid="metrics-table">
        <table class="w-full border-collapse text-xs">
          <thead>
            <tr class="border-b border-border bg-surface2/40 text-left">
              <th scope="col" class="px-3 py-2 font-medium text-text3">{R.colMetric}</th>
              {#each comparison.conditions as c (c.id)}
                <th scope="col" class="px-3 py-2 text-right font-medium text-text2">{c.label}</th>
              {/each}
              {#if showStatsCols}
                <th
                  scope="col"
                  class="px-3 py-2 text-right font-medium text-text3"
                  title={R.colDWhy}>{R.colD}</th
                >
                <th
                  scope="col"
                  class="px-3 py-2 text-right font-medium text-text3"
                  title={R.colSigWhy}>{R.colSig}</th
                >
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each metricRows as row (row.key)}
              {@const d = largestD(analysis, row.key)}
              {@const p = smallestP(analysis, row.key)}
              <tr class="border-b border-border/60 last:border-0" data-metric={row.key}>
                <th scope="row" class="px-3 py-1.5 text-left font-normal text-text2">{row.label}</th
                >
                {#each comparison.conditions as c (c.id)}
                  {@const s = metricStat(c, row.key)}
                  <td class="px-3 py-1.5 text-right font-mono tabular-nums text-text"
                    >{s ? meanSd(s) : R.noRate}</td
                  >
                {/each}
                {#if showStatsCols}
                  <td
                    class="px-3 py-1.5 text-right font-mono tabular-nums {D_CLASS[dTone(d)]}"
                    data-testid="metric-d">{d === null ? R.noRate : d.toFixed(2)}</td
                  >
                  <td
                    class="px-3 py-1.5 text-right font-mono tabular-nums text-accentText"
                    data-testid="metric-sig">{stars(p)}</td
                  >
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if showStatsCols}<p class={HINT}>{R.legend}</p>{/if}
    {/if}

    {#if comparison?.has_metrics}
      <!-- Statistics -->
      <div class="flex flex-col gap-3 border-t border-border pt-3" data-testid="stats">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <p class="flex items-center gap-1.5 {head}">
              <Sigma class="h-3 w-3" aria-hidden="true" />{R.statsTitle}
            </p>
            <p class="max-w-[64ch] text-xs text-text3">{SCREENS['conditions.stats']}</p>
            {#if computedAt}
              <p class="font-mono text-[11px] text-text4" data-testid="stats-computed">
                {R.statsComputed(formatDate(computedAt))}
              </p>
            {/if}
          </div>
          <button
            type="button"
            class={comparison.has_analysis ? BTN.secondary : BTN.primary}
            disabled={analyzing || running || extras === false}
            title={extras === false ? R.statsNeedExtras : undefined}
            onclick={runStats}
            data-testid="run-stats"
          >
            <ListChecks class="h-3.5 w-3.5" aria-hidden="true" />
            {analyzing ? R.runningStats : comparison.has_analysis ? R.runStatsAgain : R.runStats}
          </button>
        </div>
        {#if extras === false}
          <p class="text-xs text-warn" data-testid="stats-extras">{R.statsNeedExtras}</p>
        {/if}
        {#if statsError}
          <p class="text-xs text-danger" role="alert" data-testid="stats-error">{statsError}</p>
        {/if}
        {#if lines.length > 0}
          {#if errorLines > 0}
            <p class="text-xs text-warn">{R.statsErrorCount(errorLines)}</p>
          {/if}
          <ul class="flex flex-col divide-y divide-border/60" data-testid="stats-lines">
            {#each lines as line (line.key)}
              <li
                class="grid grid-cols-[12rem_minmax(0,1fr)] items-baseline gap-3 py-1.5 text-xs"
                data-testid="stats-line"
                data-test={line.key}
                data-state={line.state}
              >
                <span class="text-text2">{line.label}</span>
                <span
                  class="min-w-0 break-words {line.state === 'error'
                    ? 'text-danger'
                    : line.state === 'ok'
                      ? 'font-mono text-text'
                      : 'text-text4'}">{line.text}</span
                >
              </li>
            {/each}
          </ul>
        {/if}
        {#if comparison.has_analysis}
          <div
            class="rounded-md border border-border bg-bg/40 px-3"
            data-testid="analysis-download"
          >
            <DownloadLink
              label={R.analysisCsv}
              description={R.analysisCsvSentence}
              path={pathFor(ROUTES.exportExperimentAnalysis, { params })}
              fallbackName={`experiment_${id}_analysis.csv`}
              onDownload={saveDownload}
            />
          </div>
        {/if}
      </div>
    {/if}
  </Panel>

  <!-- Responses -->
  <Panel title={R.responsesTitle} readout={R.responsesReadout}>
    {#if prompts.length === 0}
      <p class={HINT}>{R.noResponses}</p>
    {:else}
      <div class="h-[32rem] overflow-hidden rounded-md border border-border">
        <ResizableSplit initialRatio={0.42} minPx={240} storageKey="flinch:split_ratio:results">
          {#snippet left()}
            <div class="flex h-full flex-col">
              <div class="relative border-b border-border p-2">
                <Search
                  class="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text4"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  class="{FIELD} pl-7 text-xs"
                  placeholder={R.searchPrompts}
                  aria-label={R.searchPrompts}
                  bind:value={query}
                />
              </div>
              <ul class="min-h-0 flex-1 overflow-y-auto" data-testid="response-prompts">
                {#each filtered as p (p.id)}
                  {@const cells = byPrompt.get(p.id)}
                  <li>
                    <button
                      type="button"
                      class="flex w-full flex-col gap-1.5 border-b border-border/60 px-3 py-2 text-left transition-colors hover:bg-surface2/60 focus:outline-none focus-visible:bg-surface2 {picked ===
                      p.id
                        ? 'bg-surface2'
                        : ''}"
                      aria-pressed={picked === p.id}
                      onclick={() => pick(p.id)}
                      data-testid="response-prompt"
                      data-prompt-id={p.id}
                    >
                      <span class="truncate text-[12px] text-text2">{promptName(p)}</span>
                      <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {#each sortedConditions as c (c.id)}
                          {@const list = cells?.get(c.id) ?? []}
                          {#if list.length > 0}
                            <span
                              class="inline-flex items-center gap-[3px] rounded border border-border/70 bg-bg/40 px-1 py-0.5"
                              title={c.label}
                            >
                              {#each list as r (r.id)}
                                {@const cls = toCls(r.classification)}
                                <span
                                  class="inline-flex"
                                  title={R.badgeTitle(
                                    c.label,
                                    r.model_id,
                                    r.repetition + 1,
                                    r.status === 'completed'
                                      ? CLS_SPEC[cls].word
                                      : r.status === 'failed'
                                        ? CONDITIONS.legendFailed
                                        : R.notRunYet,
                                  )}
                                  data-testid="response-badge"
                                  data-status={r.status}
                                  data-cls={r.status === 'completed' ? cls : r.status}
                                  data-repetition={r.repetition}
                                >
                                  {#if r.status === 'completed'}
                                    <ClassBadge value={r.classification} size="sm" glyphOnly />
                                  {:else}
                                    <span
                                      class="m-0.5 h-3 w-3 rounded-[3px] {r.status === 'failed'
                                        ? 'bg-danger'
                                        : 'border border-borderStrong'}"
                                    ></span>
                                  {/if}
                                </span>
                              {/each}
                            </span>
                          {/if}
                        {/each}
                      </span>
                    </button>
                  </li>
                {:else}
                  <li class="px-3 py-3 {HINT}">{R.noPromptMatch}</li>
                {/each}
              </ul>
            </div>
          {/snippet}
          {#snippet right()}
            <div class="h-full overflow-auto p-3" data-testid="response-detail">
              {#if picked === null}
                <p class={HINT}>{R.pickPrompt}</p>
              {:else if detailError}
                <p class="text-xs text-danger" role="alert">{detailError}</p>
              {:else if detail === null}
                <p class={HINT}>{R.readingResponses}</p>
              {:else}
                {#if detail.length >= RESPONSES_LIMIT}
                  <p class="mb-2 text-xs text-warn">{R.limitLine}</p>
                {/if}
                <div
                  class="grid gap-3"
                  style:grid-template-columns="repeat({Math.max(1, sortedConditions.length)},
                  minmax(13rem, 1fr))"
                >
                  {#each sortedConditions as c (c.id)}
                    <section aria-labelledby="rc-{uid}-{c.id}" class="flex min-w-0 flex-col gap-2">
                      <h3 id="rc-{uid}-{c.id}" class="truncate {head}">
                        {conditionLabel.get(c.id)}
                      </h3>
                      {#each detailBy.get(c.id) ?? [] as r (r.id)}
                        {@const text = r.response_text ?? ''}
                        {@const long = text.length > COLLAPSE_AT}
                        <article
                          class="flex flex-col gap-1.5 rounded-md border border-border bg-bg/50 p-2.5"
                          data-testid="response-card"
                        >
                          <header class="flex items-center justify-between gap-2">
                            <span class="truncate font-mono text-[10px] text-text4"
                              >{R.responseHead(r.model_id, r.repetition + 1)}</span
                            >
                            {#if r.status === 'completed'}
                              <ClassBadge value={r.classification} size="sm" />
                            {/if}
                          </header>
                          {#if r.status === 'failed'}
                            <p class="text-xs text-danger">{R.failedLine(r.error_message ?? '')}</p>
                          {:else if r.status !== 'completed'}
                            <p class="text-xs italic text-text4">{R.notRunYet}</p>
                          {:else if !text.trim()}
                            <p class="text-xs italic text-text4">{R.emptyText}</p>
                          {:else}
                            <p
                              class="whitespace-pre-wrap break-words text-xs leading-relaxed text-text2"
                            >
                              {long && !open.has(r.id) ? `${text.slice(0, COLLAPSE_AT)}…` : text}
                            </p>
                            {#if long}
                              <button
                                type="button"
                                class="self-start text-[11px] text-accentText hover:underline focus:outline-none focus-visible:underline"
                                aria-expanded={open.has(r.id)}
                                onclick={() => toggleOpen(r.id)}
                                >{open.has(r.id) ? R.showLess : R.showAll}</button
                              >
                            {/if}
                          {/if}
                        </article>
                      {/each}
                    </section>
                  {/each}
                </div>
              {/if}
            </div>
          {/snippet}
        </ResizableSplit>
      </div>
      {#if responses.length >= RESPONSES_LIMIT}
        <p class={HINT}>{CONDITIONS.gridLimit}</p>
      {/if}
    {/if}
  </Panel>
</div>
