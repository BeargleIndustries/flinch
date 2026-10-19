<!--
  A study's Run tab (brief 8.2.3, B02, B03, B36, F6, F14): the estimate and
  the action row, this window's stream while it runs, the Progress panel
  (overall, by condition, by model, and the cell grid), then Setup, where a
  draft study takes another condition ("Add a condition…", brief 9.9).

  Actions by state come from `runActions`. Resume stays enabled whatever the
  server says (F14): a 409 shows ERROR_COPY.studyRunning by the row, and
  nothing retries on its own.
-->
<script lang="ts">
  import { Pause, Play, RotateCcw, StepForward } from 'lucide-svelte';
  import type { Condition, Experiment, StudyProgress } from '$lib/api/types';
  import { CLS_ORDER, CLS_SPEC } from '$lib/cls';
  import Panel from '$lib/components/Panel.svelte';
  import StreamProgress from '$lib/components/StreamProgress.svelte';
  import { CONDITIONS, RATE_PROVIDER_LABELS } from '$lib/copy/studies';
  import { formatDate } from '$lib/format';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import {
    RESPONSES_LIMIT,
    buildGrid,
    promptName,
    rateWords,
    runActions,
    savedRateLimits,
    type CellState,
    type PrimaryAction,
    type StudyEstimate,
    type StudyPrompt,
    type StudyResponse,
  } from './conditions';
  import type { StudyRun } from './conditions.svelte';

  interface Props {
    experiment: Experiment;
    conditions: Condition[];
    prompts: StudyPrompt[];
    progress: StudyProgress;
    responses: StudyResponse[];
    estimate: StudyEstimate | null;
    run: StudyRun;
    onAddPrompts: () => void;
    /** Adds a condition to a draft study (brief 9.9); resolves to an error message or null. */
    onAddCondition: (label: string, systemPrompt: string) => Promise<string | null>;
  }

  let {
    experiment,
    conditions,
    prompts,
    progress,
    responses,
    estimate,
    run,
    onAddPrompts,
    onAddCondition,
  }: Props = $props();

  // "Add a condition…" (draft studies only): Label and System prompt.
  let adding = $state(false);
  let newLabel = $state('');
  let newPrompt = $state('');
  let addError = $state<string | null>(null);
  let saving = $state(false);

  function closeAdd() {
    adding = false;
    newLabel = '';
    newPrompt = '';
    addError = null;
  }

  async function saveCondition() {
    const label = newLabel.trim();
    if (!label) addError = CONDITIONS.needCondition;
    else if (label.length > 100) addError = CONDITIONS.labelLong;
    else if (conditions.some((c) => c.label.trim() === label)) addError = CONDITIONS.uniqueLabels;
    else addError = null;
    if (addError || saving) return;
    saving = true;
    addError = await onAddCondition(label, newPrompt);
    saving = false;
    if (!addError) closeAdd();
  }

  const limits = $derived(savedRateLimits(experiment.config));
  const act = $derived(
    runActions({
      status: experiment.status,
      attached: run.live,
      active: progress.active,
      progress,
      prompts: prompts.length,
    }),
  );
  const repeats = $derived(Number(experiment.config?.repetitions ?? 1) || 1);
  const grid = $derived(buildGrid(conditions, responses, prompts));
  const promptById = $derived(new Map(prompts.map((p) => [p.id, p])));
  const pct = $derived(progress.total > 0 ? (progress.completed / progress.total) * 100 : 0);
  const sortedConditions = $derived(
    [...conditions].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
  );

  const PRIMARY: Record<Exclude<PrimaryAction, null>, string> = {
    start: CONDITIONS.start,
    pause: CONDITIONS.pause,
    resume: CONDITIONS.resume,
    runPending: CONDITIONS.runPending,
  };

  function primary() {
    switch (act.primary) {
      case 'start':
        void run.run('start', experiment.name, limits);
        break;
      case 'pause':
        void run.pause();
        break;
      case 'resume':
      case 'runPending':
        void run.run('resume', experiment.name, limits);
        break;
    }
  }

  const CELL_CLASS: Record<CellState, string> = {
    pending: 'border border-borderStrong bg-transparent',
    failed: 'bg-danger',
    refused: CLS_SPEC.refused.glyphBg,
    collapsed: CLS_SPEC.collapsed.glyphBg,
    negotiated: CLS_SPEC.negotiated.glyphBg,
    complied: CLS_SPEC.complied.glyphBg,
    unknown: CLS_SPEC.unknown.glyphBg,
  };

  const cellWord = (s: CellState) =>
    s === 'pending'
      ? CONDITIONS.legendPending
      : s === 'failed'
        ? CONDITIONS.legendFailed
        : CLS_SPEC[s].word;

  const NOTE: Record<string, string> = {
    orphan: CONDITIONS.orphanRunning,
    elsewhere: CONDITIONS.activeElsewhere,
    allDone: CONDITIONS.allDone,
    needPrompts: CONDITIONS.needPrompts,
  };

  const share = (c: { completed: number; total: number }) =>
    c.total > 0 ? (c.completed / c.total) * 100 : 0;
</script>

<div class="flex flex-col gap-4" data-testid="condition-run">
  <!-- Estimate and the action row -->
  <div
    class="flex flex-col gap-3 rounded-lg border border-borderStrong bg-surface px-4 py-3"
    data-testid="run-bar"
  >
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0" data-testid="study-estimate">
        {#if estimate}
          <p class="text-sm text-text">
            {CONDITIONS.estimateLine(estimate.cells, estimate.estimate.estimated_cost_usd)}
          </p>
          <p class="font-mono text-[11px] tabular-nums text-text3">
            {CONDITIONS.estimateBreakdown(
              estimate.prompts,
              estimate.conditions,
              estimate.models,
              estimate.repetitions,
            )}
          </p>
          <p class={HINT}>{CONDITIONS.estimateHint}</p>
        {/if}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        {#if act.retry > 0}
          <button
            type="button"
            class={BTN.secondary}
            title={CONDITIONS.retryFailedWhy}
            onclick={() => void run.run('retry', experiment.name, limits)}
            data-testid="run-retry"
          >
            <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
            {CONDITIONS.retryFailed(act.retry)}
          </button>
        {/if}
        {#if act.primary}
          <button
            type="button"
            class={act.primary === 'pause' ? BTN.secondary : BTN.primary}
            disabled={!act.enabled || run.pausing}
            onclick={primary}
            data-testid="run-action"
            data-action={act.primary}
          >
            {#if act.primary === 'pause'}
              <Pause class="h-3.5 w-3.5" aria-hidden="true" />
              {run.pausing ? CONDITIONS.pausing : PRIMARY.pause}
            {:else if act.primary === 'start'}
              <Play class="h-3.5 w-3.5" aria-hidden="true" />
              {PRIMARY.start}
            {:else}
              <StepForward class="h-3.5 w-3.5" aria-hidden="true" />
              {PRIMARY[act.primary]}
            {/if}
          </button>
        {/if}
      </div>
    </div>

    {#if act.note}
      <p
        class="text-xs {act.note === 'allDone' ? 'text-ok' : 'text-text3'}"
        data-testid="run-note"
        data-note={act.note}
      >
        {NOTE[act.note]}
      </p>
    {/if}
    {#if run.error && !run.live}
      <p class="text-xs text-danger" role="alert" data-testid="run-error">{run.error}</p>
    {/if}

    {#if run.live}
      <div data-testid="run-progress" data-completed={run.completed} data-total={run.total}>
        <StreamProgress
          label={CONDITIONS.runLabel}
          completed={run.completed}
          total={run.total}
          failed={run.failed}
        />
      </div>
    {/if}
  </div>

  <!-- Progress -->
  <Panel title={CONDITIONS.progressTitle} readout={CONDITIONS.progressReadout}>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <p
        class="font-mono text-2xl font-semibold tabular-nums tracking-tight text-text"
        data-testid="cells-done"
        data-completed={progress.completed}
        data-total={progress.total}
      >
        {CONDITIONS.cellsDone(progress.completed, progress.total)}
      </p>
      <p class="flex gap-3 font-mono text-xs tabular-nums">
        {#if progress.failed > 0}
          <span class="text-danger">{CONDITIONS.failedCount(progress.failed)}</span>
        {/if}
        {#if progress.pending > 0}
          <span class="text-text3">{CONDITIONS.pendingCount(progress.pending)}</span>
        {/if}
      </p>
    </div>
    <div
      role="progressbar"
      aria-label={CONDITIONS.progressTitle}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-valuenow={progress.completed}
      class="flex h-1.5 w-full overflow-hidden rounded-full bg-surface2"
    >
      <div
        class="h-full bg-accent transition-[width] duration-500 ease-out"
        style:width="{pct}%"
      ></div>
      {#if progress.total > 0 && progress.failed > 0}
        <div
          class="h-full bg-danger/80"
          style:width="{(progress.failed / progress.total) * 100}%"
        ></div>
      {/if}
    </div>

    {#if progress.total > 0}
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <p class="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-text4">
            {CONDITIONS.byCondition}
          </p>
          <ul class="flex flex-col gap-1.5">
            {#each sortedConditions as c (c.id)}
              {@const counts = progress.by_condition[String(c.id)]}
              {#if counts}
                <li class="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2">
                  <span class="truncate text-xs text-text2">{c.label}</span>
                  <span class="h-1 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                    <span class="block h-full bg-accent" style:width="{share(counts)}%"></span>
                  </span>
                  <span class="font-mono text-[11px] tabular-nums text-text3"
                    >{counts.completed}/{counts.total}</span
                  >
                </li>
              {/if}
            {/each}
          </ul>
        </div>
        <div>
          <p class="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-text4">
            {CONDITIONS.byModel}
          </p>
          <ul class="flex flex-col gap-1.5">
            {#each Object.entries(progress.by_model) as [model, counts] (model)}
              <li class="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2">
                <span class="truncate font-mono text-[11px] text-text2">{model}</span>
                <span class="h-1 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                  <span class="block h-full bg-accent" style:width="{share(counts)}%"></span>
                </span>
                <span class="font-mono text-[11px] tabular-nums text-text3"
                  >{counts.completed}/{counts.total}</span
                >
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}

    <!-- The cell grid: a row per condition; the same column is the same prompt, model and repeat. -->
    <div
      class="flex flex-col gap-2 border-t border-border pt-3"
      role="group"
      aria-label={CONDITIONS.gridLabel}
      data-testid="cell-grid"
      data-state={run.live ? 'running' : experiment.status}
    >
      {#if responses.length === 0}
        <p class={HINT}>{CONDITIONS.gridEmpty}</p>
      {:else}
        {#each grid as row (row.condition.id)}
          <div class="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-3">
            <span class="truncate pt-px text-[11px] text-text3" title={row.condition.label}
              >{row.condition.label}</span
            >
            <div class="flex flex-wrap gap-[3px]">
              {#each row.cells as cell (cell.id)}
                <span
                  class="h-3 w-3 rounded-[3px] transition-colors duration-300 {CELL_CLASS[
                    cell.state
                  ]} {cell.state === 'pending' && run.live ? 'border-accent/50' : ''}"
                  title={CONDITIONS.cellTitle(
                    row.condition.label,
                    promptName(promptById.get(cell.promptId)),
                    cell.modelId,
                    cell.repetition + 1,
                    cellWord(cell.state),
                  )}
                  data-testid="grid-cell"
                  data-state={cell.state}
                ></span>
              {/each}
            </div>
          </div>
        {/each}
        {#if responses.length >= RESPONSES_LIMIT}
          <p class={HINT}>{CONDITIONS.gridLimit}</p>
        {/if}
        <ul class="mt-1 flex flex-wrap gap-x-3 gap-y-1" aria-hidden="true">
          {#each CLS_ORDER as cls (cls)}
            <li class="flex items-center gap-1 text-[10px] text-text4">
              <span class="h-2 w-2 rounded-[2px] {CELL_CLASS[cls]}"></span>{CLS_SPEC[cls].word}
            </li>
          {/each}
          <li class="flex items-center gap-1 text-[10px] text-text4">
            <span class="h-2 w-2 rounded-[2px] {CELL_CLASS.failed}"></span>{CONDITIONS.legendFailed}
          </li>
          <li class="flex items-center gap-1 text-[10px] text-text4">
            <span class="h-2 w-2 rounded-[2px] {CELL_CLASS.pending}"
            ></span>{CONDITIONS.legendPending}
          </li>
        </ul>
      {/if}
    </div>
  </Panel>

  <!-- Setup -->
  <Panel title={CONDITIONS.setupTitle}>
    {#snippet actions()}
      {#if experiment.status === 'draft' && !run.live}
        <button
          type="button"
          class={BTN.secondary}
          title={CONDITIONS.addConditionWhy}
          aria-expanded={adding}
          disabled={adding}
          onclick={() => (adding = true)}
          data-testid="add-condition"
        >
          {CONDITIONS.addConditionOpen}
        </button>
        <button
          type="button"
          class={BTN.secondary}
          onclick={onAddPrompts}
          data-testid="add-prompts"
        >
          {CONDITIONS.addPrompts}
        </button>
      {/if}
    {/snippet}
    {#if adding && experiment.status === 'draft'}
      <form
        class="flex flex-col gap-2 rounded-md border border-border bg-bg/40 p-3"
        data-testid="add-condition-form"
        onsubmit={(e) => {
          e.preventDefault();
          void saveCondition();
        }}
      >
        <label class={LABEL} for="new-cond-label">{CONDITIONS.label}</label>
        <input
          id="new-cond-label"
          class={FIELD}
          maxlength="100"
          bind:value={newLabel}
          data-testid="new-condition-label"
        />
        <label class={LABEL} for="new-cond-prompt">{CONDITIONS.systemPrompt}</label>
        <textarea
          id="new-cond-prompt"
          rows="3"
          spellcheck="false"
          class="{FIELD} resize-y font-mono text-[12px] leading-relaxed"
          placeholder={CONDITIONS.systemPromptPlaceholder}
          bind:value={newPrompt}
          data-testid="new-condition-prompt"
        ></textarea>
        {#if addError}<p class="text-xs text-danger" role="alert">{addError}</p>{/if}
        <div class="flex gap-2">
          <button type="submit" class={BTN.primary} disabled={saving}>
            {saving ? CONDITIONS.addingCondition : CONDITIONS.addConditionSave}
          </button>
          <button type="button" class={BTN.ghost} onclick={closeAdd}>{CONDITIONS.cancel}</button>
        </div>
      </form>
    {/if}
    <dl class="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-[9rem_1fr]">
      <dt class="text-text4">{CONDITIONS.setupConditions}</dt>
      <dd>
        <ul class="flex flex-col gap-1.5">
          {#each sortedConditions as c (c.id)}
            <li class="flex flex-col gap-0.5">
              <span class="font-medium text-text2">{c.label}</span>
              {#if c.system_prompt.trim()}
                <span class="font-mono text-[11px] leading-relaxed text-text3"
                  >{c.system_prompt.length > 120
                    ? `${c.system_prompt.slice(0, 119)}…`
                    : c.system_prompt}</span
                >
              {:else}
                <span class="text-[11px] italic text-text4">{CONDITIONS.noSystemPrompt}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </dd>
      <dt class="text-text4">{CONDITIONS.setupModels}</dt>
      <dd class="flex flex-wrap gap-1.5">
        {#each [...(experiment.model_ids ?? []), ...(experiment.base_model_ids ?? [])] as m (m)}
          <span
            class="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[11px] text-text2"
            >{m}</span
          >
        {/each}
      </dd>
      <dt class="text-text4">{CONDITIONS.setupPrompts}</dt>
      <dd class="font-mono tabular-nums text-text2" data-testid="setup-prompts">
        {CONDITIONS.promptsCount(prompts.length)}
      </dd>
      <dt class="text-text4">{CONDITIONS.setupRepeats}</dt>
      <dd class="font-mono tabular-nums text-text2">{repeats}</dd>
      <dt class="text-text4">{CONDITIONS.setupSeed}</dt>
      <dd class="font-mono tabular-nums text-text2">{experiment.random_seed ?? CONDITIONS.none}</dd>
      <dt class="text-text4">{CONDITIONS.setupRates}</dt>
      <dd class="text-text2" data-testid="setup-rates">
        {#if Object.keys(limits).length === 0}
          {CONDITIONS.ratesPoolDefault}
        {:else}
          <ul class="flex flex-col gap-0.5">
            {#each Object.entries(limits) as [p, lim] (p)}
              <li>
                <span class="text-text3">{RATE_PROVIDER_LABELS[p] ?? p}:</span>
                {rateWords(lim)}
              </li>
            {/each}
          </ul>
        {/if}
      </dd>
      <dt class="text-text4">{CONDITIONS.setupCreated}</dt>
      <dd class="text-text2">{formatDate(experiment.created_at)}</dd>
      <dt class="text-text4">{CONDITIONS.setupStarted}</dt>
      <dd class="text-text2">
        {experiment.started_at ? formatDate(experiment.started_at) : CONDITIONS.notYet}
      </dd>
      <dt class="text-text4">{CONDITIONS.setupCompleted}</dt>
      <dd class="text-text2">
        {experiment.completed_at ? formatDate(experiment.completed_at) : CONDITIONS.notYet}
      </dd>
    </dl>
  </Panel>
</div>
