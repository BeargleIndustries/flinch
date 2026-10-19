<!--
  A study's Raters tab (brief 8.2.3, D21, I11, B14):

    AI raters           rater models, "Rate responses" (stream `rate:{id}`,
                        POST /rate {rater_models}); win rates and winner
                        agreement worked out from GET /ratings; the ratings
                        table, one rank column per condition, decoded with
                        `blinding_order[position_label]`
    Human raters        only for two or three conditions (I11): Make tasks
    (Prolific)          (POST /prolific; a second call honestly reports 0 new
                        tasks), the task CSV download, results import from a
                        pasted or read CSV (POST /human-evals/import), and the
                        tasks table (GET /human-evals)

  Raters and Prolific use the first repeat of each cell (B14).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { FileUp, Plus, Scale, Users, X } from 'lucide-svelte';
  import { pathFor, request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { Condition, Experiment, ModelProvider } from '$lib/api/types';
  import DownloadLink from '$lib/components/DownloadLink.svelte';
  import ModelPicker from '$lib/components/ModelPicker.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import StreamProgress from '$lib/components/StreamProgress.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import { saveDownload } from '$lib/components/save-download';
  import { SCREENS } from '$lib/copy/screens';
  import { CONDITIONS_RESULTS as R } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { status } from '$lib/stores/status.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import { promptName, type StudyPrompt, type StudyResponse } from './conditions';
  import {
    DEFAULT_RATER,
    PROLIFIC_PROMPTS,
    PROLIFIC_RATERS,
    prolificAllowed,
    prolificBody,
    prolificError,
    ranksByCondition,
    ratePct,
    winRates,
    winnerAgreement,
    type AiRating,
    type EvalTask,
    type HumanImportResult,
    type ProlificResult,
  } from './condition-results';
  import type { StudyJob } from './condition-jobs.svelte';

  interface Props {
    experiment: Experiment;
    conditions: Condition[];
    prompts: StudyPrompt[];
    responses: StudyResponse[];
    rate: StudyJob;
  }

  let { experiment, conditions, prompts, responses, rate }: Props = $props();

  const uid = $props.id();
  const params = $derived({ experiment_id: experiment.id });
  const sortedConditions = $derived(
    [...conditions].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
  );
  const promptById = $derived(new Map(prompts.map((p) => [p.id, p])));
  const hasCompleted = $derived(
    responses.some((r) => r.status === 'completed' && r.repetition === 0),
  );

  // ---- Data -----------------------------------------------------------------

  let ratings = $state<AiRating[]>([]);
  let tasks = $state<EvalTask[]>([]);
  let groups = $state<ModelProvider[]>([]);
  let loadError = $state<string | null>(null);

  async function load() {
    try {
      const [r, t] = await status.track(
        Promise.all([
          request<{ ratings: AiRating[] }>(ROUTES.listExperimentRatings, { params }),
          request<{ eval_tasks: EvalTask[] }>(ROUTES.listHumanEvals, { params }),
        ]),
      );
      ratings = r.ratings;
      tasks = t.eval_tasks;
      loadError = null;
    } catch (e) {
      loadError = friendlyError(e).message;
    }
  }

  async function loadModels() {
    try {
      groups = await status.track(request<ModelProvider[]>(ROUTES.listModels));
    } catch {
      // The pickers fall back to typing a model id.
    }
  }

  // First load, and again when a rating run ends.
  $effect(() => {
    void rate.version;
    untrack(() => void load());
  });
  $effect(() => {
    untrack(() => void loadModels());
  });

  // ---- AI raters --------------------------------------------------------------

  let raters = $state<string[]>([DEFAULT_RATER]);
  const raterError = $derived.by(() => {
    const picked = raters.map((r) => r.trim()).filter(Boolean);
    if (new Set(picked).size !== picked.length) return R.rateUniqueRaters;
    return null;
  });
  const canRate = $derived(
    !rate.live &&
      hasCompleted &&
      conditions.length >= 2 &&
      raters.some((r) => r.trim()) &&
      !raterError,
  );

  function startRating() {
    if (!canRate) return;
    const rater_models = [...new Set(raters.map((r) => r.trim()).filter(Boolean))];
    void rate.run(R.rateStream(experiment.name), { rater_models });
  }

  const wins = $derived(
    winRates(
      ratings,
      sortedConditions.map((c) => c.id),
    ),
  );
  const agree = $derived(winnerAgreement(ratings));
  const SHOW_ROWS = 200;

  // ---- Prolific -----------------------------------------------------------------

  const allowed = $derived(prolificAllowed(conditions.length));
  let promptCount = $state(PROLIFIC_PROMPTS);
  let ratersPerTask = $state(PROLIFIC_RATERS);
  let batchId = $state('');
  let models = $state<string[]>(untrack(() => [...(experiment.model_ids ?? [])]));
  let making = $state(false);
  let made = $state<ProlificResult | null>(null);
  let makeError = $state<string | null>(null);
  let tried = $state(false);

  const form = $derived({ promptCount, models, ratersPerTask, batchId });
  const formError = $derived(prolificError(form));

  function toggleModel(m: string, on: boolean) {
    models = on ? [...new Set([...models, m])] : models.filter((x) => x !== m);
  }

  async function makeTasks() {
    tried = true;
    if (formError || making) return;
    making = true;
    makeError = null;
    try {
      made = await status.track(
        request<ProlificResult>(ROUTES.createProlificExport, { params, body: prolificBody(form) }),
      );
      if (!batchId.trim() && made.batch_id) batchId = made.batch_id;
      void load();
    } catch (e) {
      const f = friendlyError(e);
      makeError = f.message;
      status.error(f.message, f.details);
    } finally {
      making = false;
    }
  }

  /** The CSV download marks tasks exported; reload the table after it. */
  async function downloadTasks(path: string, fallbackName: string) {
    try {
      return await saveDownload(path, fallbackName);
    } finally {
      void load();
    }
  }

  let csvText = $state('');
  let importing = $state(false);
  let imported = $state<HumanImportResult | null>(null);
  let importError = $state<string | null>(null);
  let fileNote = $state<string | null>(null);

  async function readFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      csvText = await file.text();
      fileNote = R.fileRead(file.name);
    } catch {
      fileNote = R.fileFailed;
    } finally {
      input.value = '';
    }
  }

  async function importResults() {
    if (importing) return;
    if (!csvText.trim()) {
      importError = R.importNeedsText;
      return;
    }
    importing = true;
    importError = null;
    try {
      imported = await status.track(
        request<HumanImportResult>(ROUTES.importHumanEvals, {
          params,
          body: { csv_text: csvText },
        }),
      );
      void load();
    } catch (e) {
      const f = friendlyError(e);
      importError = f.message;
      status.error(f.message, f.details);
    } finally {
      importing = false;
    }
  }

  const th = 'px-2.5 py-1.5 text-left font-medium text-text3';
  const td = 'px-2.5 py-1.5';
  const head = 'text-[10px] font-medium uppercase tracking-widest text-text4';
  const check =
    'h-3.5 w-3.5 shrink-0 rounded border-borderStrong bg-bg accent-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover';
</script>

<div class="flex flex-col gap-4" data-testid="condition-raters">
  {#if loadError}
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-danger" role="alert">{R.loadFailed} {loadError}</p>
      <button type="button" class={BTN.ghost} onclick={load}>{R.reload}</button>
    </div>
  {/if}

  <!-- AI raters -->
  <Panel title={R.aiTitle} readout={SCREENS['conditions.raters.ai']}>
    <ul class="flex flex-col gap-2" data-testid="rater-models">
      {#each raters as rater, i (i)}
        <li class="flex items-start gap-2">
          <div class="min-w-0 flex-1 sm:max-w-md">
            <ModelPicker
              value={rater}
              {groups}
              allowCustom
              label={R.raterN(i + 1)}
              disabled={rate.live}
              onChange={(m) => (raters[i] = m)}
            />
          </div>
          <button
            type="button"
            class="mt-1 rounded-md p-1 text-text4 hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-40"
            aria-label={R.removeRater(rater)}
            disabled={raters.length === 1 || rate.live}
            onclick={() => (raters = raters.filter((_, j) => j !== i))}
          >
            <X class="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </li>
      {/each}
    </ul>
    {#if raterError}<p class="text-xs text-danger" role="alert">{raterError}</p>{/if}

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class={BTN.secondary}
        disabled={rate.live}
        onclick={() => (raters = [...raters, ''])}
      >
        <Plus class="h-3.5 w-3.5" aria-hidden="true" />
        {R.addRater}
      </button>
      <button
        type="button"
        class={BTN.primary}
        disabled={!canRate}
        onclick={startRating}
        data-testid="rate-responses"
      >
        <Scale class="h-3.5 w-3.5" aria-hidden="true" />
        {rate.live ? R.rating : R.rate}
      </button>
      {#if conditions.length < 2}
        <span class={HINT}>{R.rateNeedsTwo}</span>
      {:else if !hasCompleted}
        <span class={HINT}>{R.rateNeedsCompleted}</span>
      {/if}
    </div>

    {#if rate.live}
      <div data-testid="rate-progress" data-completed={rate.completed} data-total={rate.total}>
        <StreamProgress
          label={R.rateLabel}
          completed={rate.completed}
          total={rate.total}
          failed={rate.failed}
        />
      </div>
    {:else if rate.ended}
      <p
        class="text-xs {rate.ended === 'failed' ? 'text-danger' : 'text-text2'}"
        aria-live="polite"
        data-testid="rate-result"
        data-ended={rate.ended}
      >
        {#if rate.ended === 'complete'}
          {R.rateDone(rate.completed)}
          {#if rate.failed > 0}<span class="text-danger"> {R.rateFailed(rate.failed)}</span>{/if}
        {:else if rate.ended === 'nothing'}
          {R.rateNothing}
        {:else if rate.ended === 'stopped'}
          {R.rateStopped}
        {:else}
          {rate.error}
        {/if}
      </p>
    {/if}

    <!-- Win rates -->
    <div class="flex flex-col gap-2 border-t border-border pt-3">
      <p class={head}>{R.winTitle}</p>
      <p class="text-xs text-text3">{R.winReadout}</p>
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full border-collapse text-xs" data-testid="win-rates">
          <thead>
            <tr class="border-b border-border bg-surface2/40">
              <th scope="col" class={th}>{R.colCondition}</th>
              <th scope="col" class="{th} text-right">{R.colFirst}</th>
              <th scope="col" class="{th} text-right">{R.colMeanRank}</th>
              <th scope="col" class="{th} text-right">{R.colRated}</th>
            </tr>
          </thead>
          <tbody>
            {#each wins as w (w.conditionId)}
              {@const label = sortedConditions.find((c) => c.id === w.conditionId)?.label ?? ''}
              <tr
                class="border-b border-border/60 last:border-0"
                data-testid="win-row"
                data-condition-id={w.conditionId}
                data-wins={w.wins}
                data-rated={w.rated}
              >
                <th scope="row" class="{td} text-left font-normal text-text2">{label}</th>
                <td class="{td} text-right font-mono tabular-nums text-text">
                  <span class="inline-flex items-center justify-end gap-2">
                    <span class="hidden h-1 w-16 overflow-hidden rounded-full bg-surface2 sm:block">
                      <span class="block h-full bg-accent" style:width="{(w.winRate ?? 0) * 100}%"
                      ></span>
                    </span>
                    {ratePct(w.winRate)}
                  </span>
                </td>
                <td class="{td} text-right font-mono tabular-nums text-text2"
                  >{w.meanRank === null ? R.noRate : w.meanRank.toFixed(2)}</td
                >
                <td class="{td} text-right font-mono tabular-nums text-text3"
                  >{R.winCell(w.wins, w.rated)}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class={HINT} data-testid="rater-agreement">
        {agree.shared > 0 ? R.agreement(agree.agreed, agree.shared) : R.agreementNone}
      </p>
    </div>

    <!-- Ratings table -->
    <div class="flex flex-col gap-2 border-t border-border pt-3">
      <p class={head}>{R.ratingsTitle}</p>
      {#if ratings.length === 0}
        <p class={HINT} data-testid="no-ratings">{R.noRatings}</p>
      {:else}
        <div class="max-h-80 overflow-auto rounded-md border border-border">
          <table class="w-full border-collapse text-xs" data-testid="ratings-table">
            <thead class="sticky top-0 bg-surface">
              <tr class="border-b border-border">
                <th scope="col" class={th}>{R.colRater}</th>
                <th scope="col" class={th}>{R.colPrompt}</th>
                <th scope="col" class={th}>{R.colModel}</th>
                <th scope="col" class={th}>{R.colStatus}</th>
                {#each sortedConditions as c (c.id)}
                  <th scope="col" class="{th} text-right text-text2">{c.label}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each ratings.slice(0, SHOW_ROWS) as r (r.id)}
                {@const ranks = ranksByCondition(r)}
                <tr class="border-b border-border/60 last:border-0" data-testid="rating-row">
                  <td class="{td} font-mono text-[11px] text-text3">{r.rater_model}</td>
                  <td class="{td} max-w-[16rem] truncate text-text2"
                    >{promptName(promptById.get(r.prompt_id))}</td
                  >
                  <td class="{td} font-mono text-[11px] text-text3">{r.target_model_id}</td>
                  <td class={td}><StatusChip status={r.status} /></td>
                  {#each sortedConditions as c (c.id)}
                    {@const rank = ranks.get(c.id)}
                    <td
                      class="{td} text-right font-mono tabular-nums {rank === 1
                        ? 'font-semibold text-accentText'
                        : 'text-text2'}"
                      data-testid="rating-rank">{rank === undefined ? R.noRate : R.rankOf(rank)}</td
                    >
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if ratings.length > SHOW_ROWS}<p class={HINT}>{R.ratingsMore(ratings.length)}</p>{/if}
      {/if}
    </div>
  </Panel>

  <!-- Human raters (Prolific) -->
  <Panel title={R.humanTitle} readout={SCREENS['conditions.raters.human']}>
    {#if !allowed}
      <p class="text-xs text-text3" data-testid="prolific-not-allowed">
        {R.prolificNotAllowed(conditions.length)}
      </p>
    {:else}
      <div class="flex flex-col gap-4" data-testid="prolific">
        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <label for="pl-prompts-{uid}" class={LABEL}>{R.prolificPrompts}</label>
            <input
              id="pl-prompts-{uid}"
              type="number"
              min="1"
              step="1"
              class="{FIELD} font-mono tabular-nums"
              bind:value={promptCount}
              data-testid="prolific-prompts"
            />
            <p class="mt-1 {HINT}">{R.prolificPromptsHint}</p>
          </div>
          <div>
            <label for="pl-raters-{uid}" class={LABEL}>{R.prolificRaters}</label>
            <input
              id="pl-raters-{uid}"
              type="number"
              min="1"
              step="1"
              class="{FIELD} font-mono tabular-nums"
              bind:value={ratersPerTask}
              data-testid="prolific-raters"
            />
          </div>
          <div>
            <label for="pl-batch-{uid}" class={LABEL}>{R.prolificBatch}</label>
            <input
              id="pl-batch-{uid}"
              type="text"
              class="{FIELD} font-mono text-xs"
              placeholder={R.prolificBatchPlaceholder}
              bind:value={batchId}
              data-testid="prolific-batch"
            />
          </div>
        </div>
        <fieldset>
          <legend class={LABEL}>{R.prolificModels}</legend>
          <div class="flex flex-wrap gap-2">
            {#each experiment.model_ids ?? [] as m (m)}
              <label
                class="flex cursor-pointer items-center gap-1.5 rounded border border-border bg-bg px-2 py-1 font-mono text-[11px] text-text2 hover:border-borderStrong"
              >
                <input
                  type="checkbox"
                  class={check}
                  checked={models.includes(m)}
                  onchange={(e) => toggleModel(m, e.currentTarget.checked)}
                />
                {m}
              </label>
            {/each}
          </div>
        </fieldset>
        {#if tried && formError}<p class="text-xs text-danger" role="alert">{formError}</p>{/if}

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class={BTN.primary}
            disabled={making || !hasCompleted}
            onclick={makeTasks}
            data-testid="make-tasks"
          >
            <Users class="h-3.5 w-3.5" aria-hidden="true" />
            {making ? R.making : R.makeTasks}
          </button>
          {#if !hasCompleted}<span class={HINT}>{R.rateNeedsCompleted}</span>{/if}
        </div>
        {#if makeError}
          <p class="text-xs text-danger" role="alert">{makeError}</p>
        {:else if made}
          <p
            class="text-xs text-text2"
            aria-live="polite"
            data-testid="prolific-result"
            data-task-count={made.task_count}
          >
            {R.prolificResult(made.task_count, made.prompt_count, made.batch_id)}
            {#if made.task_count === 0}<span class="text-text3"> {R.prolificNoneNew}</span>{/if}
          </p>
        {/if}

        <div class="rounded-md border border-border bg-bg/40 px-3" data-testid="prolific-csv">
          <DownloadLink
            label={R.taskCsv}
            description={R.taskCsvSentence}
            path={pathFor(ROUTES.downloadProlificCsv, { params })}
            fallbackName={`prolific_experiment_${experiment.id}.csv`}
            onDownload={downloadTasks}
          />
        </div>

        <!-- Results import -->
        <div class="flex flex-col gap-2 border-t border-border pt-3">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <label for="pl-paste-{uid}" class="text-xs font-medium text-text2"
              >{R.pasteResults}</label
            >
            <label
              class="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-accentText hover:underline focus-within:underline"
            >
              <FileUp class="h-3 w-3" aria-hidden="true" />
              {R.chooseFile}
              <input
                type="file"
                accept=".csv,text/csv"
                class="sr-only"
                onchange={readFile}
                data-testid="results-file"
              />
            </label>
          </div>
          <textarea
            id="pl-paste-{uid}"
            rows="4"
            class="{FIELD} font-mono text-[11px] leading-relaxed"
            bind:value={csvText}
            aria-describedby="pl-paste-hint-{uid}"
            data-testid="results-csv"
          ></textarea>
          <p id="pl-paste-hint-{uid}" class={HINT}>
            {R.pasteHint}{#if fileNote}<span class="ml-2 text-text3">{fileNote}</span>{/if}
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class={BTN.secondary}
              disabled={importing}
              onclick={importResults}
              data-testid="import-results"
            >
              {importing ? R.importing : R.importResults}
            </button>
            {#if importError}
              <span class="text-xs text-danger" role="alert">{importError}</span>
            {:else if imported}
              <span
                class="text-xs text-text2"
                aria-live="polite"
                data-testid="import-result"
                data-imported={imported.imported}
                >{R.importResult(imported.imported, imported.skipped, imported.errors.length)}</span
              >
            {/if}
          </div>
          {#if imported && imported.errors.length > 0}
            <ul
              class="flex flex-col gap-0.5 font-mono text-[11px] text-danger"
              data-testid="import-errors"
            >
              {#each imported.errors as err, i (i)}<li>{err}</li>{/each}
            </ul>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Tasks table: shown whenever tasks exist, even when the form is not offered. -->
    {#if allowed || tasks.length > 0}
      <div class="flex flex-col gap-2 border-t border-border pt-3">
        <p class={head}>{R.tasksTitle}</p>
        {#if tasks.length === 0}
          <p class={HINT}>{R.noTasks}</p>
        {:else}
          <div class="max-h-72 overflow-auto rounded-md border border-border">
            <table class="w-full border-collapse text-xs" data-testid="tasks-table">
              <thead class="sticky top-0 bg-surface">
                <tr class="border-b border-border">
                  <th scope="col" class={th}>{R.colBatch}</th>
                  <th scope="col" class={th}>{R.colTracking}</th>
                  <th scope="col" class={th}>{R.colModel}</th>
                  <th scope="col" class={th}>{R.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {#each tasks.slice(0, SHOW_ROWS) as t (t.id)}
                  <tr class="border-b border-border/60 last:border-0" data-testid="task-row">
                    <td class="{td} font-mono text-[11px] text-text3">{t.batch_id}</td>
                    <td class="{td} font-mono text-[11px] text-text2">{t.tracking_id}</td>
                    <td class="{td} font-mono text-[11px] text-text3">{t.target_model_id}</td>
                    <td class={td}><StatusChip status={t.status} /></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if tasks.length > SHOW_ROWS}<p class={HINT}>{R.tasksMore(tasks.length)}</p>{/if}
        {/if}
      </div>
    {/if}
  </Panel>
</div>
