<!--
  New conditions study (brief 8.2.2, D28, B08, B11, B36, I12): About,
  Conditions (a Control row with no system prompt, by hand or from a
  conditions file), Prompts (HH-RLHF, picked probes, pasted CSV), Models and
  repeats (with per-provider rate limits saved in the study's config and sent
  on Start and Resume), a live cell count, then Create. Every problem shows
  under its panel before anything is sent.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { ArrowLeft, FileUp, Plus, X } from 'lucide-svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type {
    CreateExperimentBody,
    Experiment,
    ModelProvider,
    VariantFile,
    VariantFileDetail,
  } from '$lib/api/types';
  import ModelPicker from '$lib/components/ModelPicker.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import { CONDITIONS, RATE_PROVIDER_LABELS } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { defaultTargetModel } from '$lib/session';
  import { status } from '$lib/stores/status.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import PromptSourcesFields from './PromptSourcesFields.svelte';
  import {
    LARGE_STUDY,
    NAME_MAX,
    RATE_CONFIG_KEY,
    REPEATS_MAX,
    cellTotal,
    conditionRow,
    conditionsBody,
    conditionsError,
    defaultConditions,
    emptySources,
    nextConditionLabel,
    providersOf,
    rateDefault,
    rateLimitsBody,
    repeatsValue,
    rowsFromVariants,
    seedValue,
    sourcePromptCount,
    sourcesError,
    studyRoute,
    type RateRow,
  } from './conditions';
  import { addPromptSources } from './conditions.svelte';

  const uid = $props.id();

  // About
  let name = $state('');
  let description = $state('');
  // Conditions
  let rows = $state(defaultConditions());
  // Prompts
  let sources = $state(emptySources());
  // Models and repeats
  let groups = $state<ModelProvider[]>([]);
  let models = $state<string[]>(['']);
  let repeats = $state(1);
  let seedText = $state('');
  let rates = $state<Record<string, RateRow>>({});

  let tried = $state(false);
  let busy = $state(false);
  let formError = $state<string | null>(null);

  // Conditions files ("Import from a file…")
  let fileMenu = $state(false);
  let files = $state<VariantFile[] | null>(null);
  let filesError = $state<string | null>(null);
  let loadingFile = $state<string | null>(null);

  $effect(() => {
    untrack(() => void loadModels());
  });

  async function loadModels() {
    try {
      groups = await status.track(request<ModelProvider[]>(ROUTES.listModels));
      if (models.length === 1 && models[0] === '') models = [defaultTargetModel(groups)];
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
    }
  }

  const picked = $derived(models.map((m) => m.trim()).filter(Boolean));
  const providers = $derived(providersOf(picked));
  const promptCount = $derived(sourcePromptCount(sources));
  const repeatsOk = $derived(repeatsValue(repeats));
  const total = $derived(cellTotal(promptCount, rows.length, picked.length, repeatsOk ?? 0));
  const limits = $derived(rateLimitsBody(providers, rates));

  const errors = $derived({
    about: !name.trim()
      ? CONDITIONS.needName
      : name.trim().length > NAME_MAX
        ? CONDITIONS.nameLong
        : null,
    conditions: conditionsError(rows),
    prompts: sourcesError(sources, CONDITIONS.needPrompt),
    models:
      picked.length === 0
        ? CONDITIONS.needModel
        : new Set(picked).size !== picked.length
          ? CONDITIONS.uniqueModels
          : repeatsOk === null
            ? CONDITIONS.repeatsBad
            : seedValue(seedText) === null
              ? CONDITIONS.seedBad
              : limits === null
                ? CONDITIONS.ratesBad
                : null,
  });
  const hasError = $derived(Object.values(errors).some(Boolean));

  function rateRow(p: string): RateRow {
    return rates[p] ?? { rpm: '', concurrent: '' };
  }

  function setRate(p: string, field: keyof RateRow, value: string) {
    rates = { ...rates, [p]: { ...rateRow(p), [field]: value } };
  }

  function addCondition() {
    rows = [...rows, conditionRow(nextConditionLabel(rows))];
  }

  function removeCondition(key: number) {
    rows = rows.filter((r) => r.key !== key);
  }

  async function toggleFiles() {
    fileMenu = !fileMenu;
    if (!fileMenu || files !== null) return;
    try {
      const all = await status.track(request<VariantFile[]>(ROUTES.listVariantFiles));
      files = all.filter((f) => f.variant_type === 'conditions');
    } catch (e) {
      filesError = friendlyError(e).message;
    }
  }

  async function importFile(groupId: string) {
    loadingFile = groupId;
    try {
      const d = await status.track(
        request<VariantFileDetail>(ROUTES.getVariantFile, { params: { group_id: groupId } }),
      );
      if (d.variants.length > 0) {
        rows = rowsFromVariants(d.variants);
        status.note(CONDITIONS.importedNotice(groupId, d.variants.length));
      }
      fileMenu = false;
    } catch (e) {
      filesError = friendlyError(e).message;
    } finally {
      loadingFile = null;
    }
  }

  function closeMenuOnEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && fileMenu) {
      e.stopPropagation();
      fileMenu = false;
    }
  }

  async function create() {
    tried = true;
    formError = null;
    if (hasError || busy || limits === null || repeatsOk === null) return;
    busy = true;
    const seed = seedValue(seedText);
    const body: CreateExperimentBody = {
      name: name.trim(),
      description: description.trim(),
      model_ids: picked,
      random_seed: seed ?? null,
      repetitions: repeatsOk,
      config: Object.keys(limits).length > 0 ? { [RATE_CONFIG_KEY]: limits } : {},
      conditions: conditionsBody(rows),
    };
    let id: number;
    try {
      const res = await status.track(
        request<{ experiment: Experiment }>(ROUTES.createExperiment, { body }),
      );
      id = res.experiment.id;
    } catch (e) {
      const f = friendlyError(e);
      status.error(f.message, f.details);
      formError = f.message;
      busy = false;
      return;
    }
    try {
      await addPromptSources(id, sources);
      status.note(CONDITIONS.createdNotice(body.name));
    } catch (e) {
      status.error(CONDITIONS.addPromptsFailed(e instanceof Error ? e.message : String(e)));
    }
    await goto(studyRoute(id));
  }

  const err = 'text-xs text-danger';
</script>

<section class="flex max-w-[960px] flex-col gap-4 pb-6" data-testid="conditions-new">
  <header class="flex flex-col gap-2">
    <a
      href="/studies/conditions"
      class="inline-flex w-fit items-center gap-1 text-xs text-text3 hover:text-text focus:outline-none focus-visible:underline"
    >
      <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
      {CONDITIONS.backToList}
    </a>
    <h1 class="text-base font-semibold text-text">{CONDITIONS.newTitle}</h1>
    <p class="max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS['conditions.list']}
    </p>
  </header>

  <form
    class="flex flex-col gap-4"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      void create();
    }}
  >
    <!-- 1. About -->
    <Panel title={CONDITIONS.aboutTitle} eyebrow="1">
      <div class="grid gap-3">
        <div>
          <label for="name-{uid}" class={LABEL}>{CONDITIONS.name}</label>
          <input
            id="name-{uid}"
            class={FIELD}
            maxlength={NAME_MAX}
            placeholder={CONDITIONS.namePlaceholder}
            bind:value={name}
            data-testid="study-name"
          />
        </div>
        <div>
          <label for="desc-{uid}" class={LABEL}>{CONDITIONS.description}</label>
          <textarea
            id="desc-{uid}"
            rows="2"
            class="{FIELD} resize-y"
            placeholder={CONDITIONS.descriptionPlaceholder}
            bind:value={description}
          ></textarea>
        </div>
      </div>
      {#if tried && errors.about}<p class={err} role="alert">{errors.about}</p>{/if}
    </Panel>

    <!-- 2. Conditions -->
    <Panel
      title={CONDITIONS.conditionsTitle}
      eyebrow="2"
      readout={CONDITIONS.conditionsReadout}
      anchor="conditions-list"
    >
      <ol class="flex flex-col gap-2" data-testid="condition-rows">
        {#each rows as row, i (row.key)}
          <li
            class="grid gap-2 rounded-md border border-border bg-bg/40 p-2.5 sm:grid-cols-[11rem_1fr_auto]"
            data-testid="condition-row"
            in:fly={{ y: 6, duration: 160 }}
          >
            <div class="flex flex-col gap-1">
              <span class="font-mono text-[10px] tabular-nums text-text4">{i + 1}</span>
              <input
                class="{FIELD} text-[13px]"
                aria-label={CONDITIONS.label}
                maxlength={100}
                bind:value={row.label}
                data-testid="condition-label"
              />
            </div>
            <textarea
              rows="3"
              spellcheck="false"
              class="{FIELD} resize-y font-mono text-[12px] leading-relaxed"
              aria-label={CONDITIONS.systemPrompt}
              placeholder={CONDITIONS.systemPromptPlaceholder}
              bind:value={row.systemPrompt}
              data-testid="condition-prompt"
            ></textarea>
            <button
              type="button"
              class="self-start rounded-md p-1 text-text4 hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-40"
              aria-label={CONDITIONS.removeCondition(row.label)}
              disabled={rows.length <= 1}
              onclick={() => removeCondition(row.key)}
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </li>
        {/each}
      </ol>

      <div
        class="flex flex-wrap items-center gap-2"
        role="presentation"
        onkeydown={closeMenuOnEscape}
      >
        <button type="button" class={BTN.secondary} onclick={addCondition}>
          <Plus class="h-3.5 w-3.5" aria-hidden="true" />
          {CONDITIONS.addCondition}
        </button>
        <button
          type="button"
          class={BTN.ghost}
          aria-expanded={fileMenu}
          aria-controls="files-{uid}"
          onclick={toggleFiles}
          data-testid="import-conditions-file"
        >
          <FileUp class="h-3.5 w-3.5" aria-hidden="true" />
          {CONDITIONS.importFile}
        </button>
      </div>
      {#if fileMenu}
        <div
          id="files-{uid}"
          class="rounded-md border border-borderStrong bg-surface2/60 p-1.5"
          transition:slide={{ duration: 140 }}
          data-testid="conditions-files"
        >
          {#if filesError}
            <p class="px-2 py-1.5 text-xs text-danger">{filesError}</p>
          {:else if files === null}
            <p class="px-2 py-1.5 {HINT}">{CONDITIONS.importLoading}</p>
          {:else if files.length === 0}
            <p class="px-2 py-1.5 text-xs text-text3">{CONDITIONS.importEmpty}</p>
          {:else}
            <ul class="flex flex-col">
              {#each files as f (f.group_id)}
                <li>
                  <button
                    type="button"
                    class="flex w-full items-baseline justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-surface2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-50"
                    disabled={loadingFile !== null}
                    onclick={() => importFile(f.group_id)}
                    data-group-id={f.group_id}
                  >
                    <span class="min-w-0">
                      <span class="block truncate text-[13px] text-text2"
                        >{f.title || f.group_id}</span
                      >
                      <span class="block truncate font-mono text-[11px] text-text4"
                        >{f.labels.join(' · ')}</span
                      >
                    </span>
                    <span class="shrink-0 font-mono text-[11px] tabular-nums text-text3"
                      >{CONDITIONS.importRows(f.variant_count)}</span
                    >
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
      {#if tried && errors.conditions}<p class={err} role="alert">{errors.conditions}</p>{/if}
    </Panel>

    <!-- 3. Prompts -->
    <Panel title={CONDITIONS.promptsTitle} eyebrow="3" readout={CONDITIONS.promptsReadout}>
      <PromptSourcesFields bind:sources showErrors={tried} />
      {#if tried && errors.prompts}<p class={err} role="alert">{errors.prompts}</p>{/if}
    </Panel>

    <!-- 4. Models and repeats -->
    <Panel title={CONDITIONS.modelsTitle} eyebrow="4">
      <ul class="flex flex-col gap-2" data-testid="study-models">
        {#each models as model, i (i)}
          <li class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <ModelPicker
                value={model}
                {groups}
                allowCustom
                label={CONDITIONS.modelN(i + 1)}
                onChange={(m) => (models[i] = m)}
              />
            </div>
            <button
              type="button"
              class="mt-1 rounded-md p-1 text-text4 hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-40"
              aria-label={CONDITIONS.removeModel(model)}
              disabled={models.length <= 1}
              onclick={() => (models = models.filter((_, j) => j !== i))}
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </li>
        {/each}
      </ul>
      <button
        type="button"
        class="{BTN.secondary} self-start"
        onclick={() => (models = [...models, ''])}
      >
        <Plus class="h-3.5 w-3.5" aria-hidden="true" />
        {CONDITIONS.addModel}
      </button>

      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label for="repeats-{uid}" class={LABEL}>{CONDITIONS.repeats}</label>
          <input
            id="repeats-{uid}"
            type="number"
            min="1"
            max={REPEATS_MAX}
            step="1"
            class="{FIELD} font-mono tabular-nums"
            bind:value={repeats}
            data-testid="study-repeats"
          />
          <p class="mt-1 {HINT}">{CONDITIONS.repeatsHint}</p>
        </div>
        <div>
          <label for="seed-{uid}" class={LABEL}>{CONDITIONS.seed}</label>
          <input
            id="seed-{uid}"
            inputmode="numeric"
            class="{FIELD} font-mono tabular-nums"
            bind:value={seedText}
          />
          <p class="mt-1 {HINT}">{CONDITIONS.seedHint}</p>
        </div>
      </div>

      <fieldset class="flex flex-col gap-2 border-t border-border pt-3" data-testid="rate-limits">
        <legend class="sr-only">{CONDITIONS.ratesTitle}</legend>
        <div>
          <p class="text-xs font-medium text-text2" aria-hidden="true">{CONDITIONS.ratesTitle}</p>
          <p class={HINT}>{CONDITIONS.ratesHint}</p>
        </div>
        {#if providers.length === 0}
          <p class={HINT}>{CONDITIONS.ratesNone}</p>
        {:else}
          {#each providers as p (p)}
            {@const d = rateDefault(p)}
            {@const label = RATE_PROVIDER_LABELS[p] ?? p}
            <div
              class="grid items-center gap-2 sm:grid-cols-[9rem_8rem_8rem_1fr]"
              data-testid="rate-row"
              data-provider={p}
            >
              <span class="text-[13px] text-text2">{label}</span>
              <input
                type="number"
                min="1"
                max="10000"
                step="1"
                class="{FIELD} font-mono tabular-nums"
                placeholder={CONDITIONS.ratesRpm}
                aria-label={CONDITIONS.ratesRpmFor(label)}
                value={rateRow(p).rpm}
                oninput={(e) => setRate(p, 'rpm', (e.currentTarget as HTMLInputElement).value)}
                data-testid="rate-rpm"
              />
              <input
                type="number"
                min="1"
                max="50"
                step="1"
                class="{FIELD} font-mono tabular-nums"
                placeholder={CONDITIONS.ratesConcurrent}
                aria-label={CONDITIONS.ratesConcurrentFor(label)}
                value={rateRow(p).concurrent}
                oninput={(e) =>
                  setRate(p, 'concurrent', (e.currentTarget as HTMLInputElement).value)}
                data-testid="rate-concurrent"
              />
              <span class={HINT}>{CONDITIONS.ratesDefault(d.rpm, d.concurrent)}</span>
            </div>
          {/each}
        {/if}
      </fieldset>
      {#if tried && errors.models}<p class={err} role="alert">{errors.models}</p>{/if}
    </Panel>

    <!-- Footer -->
    <div
      class="sticky bottom-10 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borderStrong bg-surface/95 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur"
    >
      <div class="flex min-w-0 flex-col gap-0.5">
        <p
          class="font-mono text-xs tabular-nums {total > LARGE_STUDY ? 'text-warn' : 'text-text2'}"
          data-testid="cells-line"
          data-total={total}
          aria-live="polite"
        >
          {CONDITIONS.cellsLine(promptCount, rows.length, picked.length, repeatsOk ?? 0, total)}
        </p>
        {#if total > LARGE_STUDY}
          <p class="text-[11px] text-warn">{CONDITIONS.cellsLarge}</p>
        {/if}
        {#if formError}<p class={err} role="alert">{formError}</p>{/if}
      </div>
      <div class="flex items-center gap-2">
        <a href="/studies/conditions" class={BTN.ghost}>{CONDITIONS.cancel}</a>
        <button type="submit" class={BTN.primary} disabled={busy} data-testid="create-study">
          {busy ? CONDITIONS.creating : CONDITIONS.create}
        </button>
      </div>
    </div>
  </form>
</section>
