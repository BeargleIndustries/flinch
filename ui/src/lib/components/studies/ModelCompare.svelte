<!--
  Model compare (brief 8.5, D16, D29; formerly Multi-Model Compare): global,
  not tied to a session. Opens with its research question and a line on
  where the per-model sessions go. Set up: two to five models (ModelPicker
  rows over GET /api/models; providers without a key disabled), probes (this
  session's rail list or every probe, plus an optional custom prompt) and an
  optional system prompt. Run is one synchronous request (R11): a working
  line with the expected duration and the elapsed time while it runs, then
  the saved comparison opens. Past comparisons below, newest first.
-->
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { ArrowRight, Info, LoaderCircle, Play, Plus, X } from 'lucide-svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ModelPicker from '$lib/components/ModelPicker.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import ProbePicker from '$lib/components/ProbePicker.svelte';
  import type { PickerProbe } from '$lib/components/probe-picker';
  import { SCREENS } from '$lib/copy/screens';
  import { COMPARE } from '$lib/copy/studies';
  import { formatDate } from '$lib/format';
  import { probes } from '$lib/stores/probe.svelte';
  import { session } from '$lib/stores/session.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import {
    MAX_MODELS,
    MIN_MODELS,
    agreementLabel,
    agreementTone,
    compareProblems,
    comparisonRoute,
    defaultModels,
    displayName,
    pickedModels,
    type Tone,
  } from './compare';
  import { compare } from './compare.svelte';
  import { clock } from './sequences';

  const uid = $props.id();

  // Every visit reads the model list, every probe and the past comparisons.
  $effect(() => {
    untrack(() => {
      void compare.loadSetup();
      void compare.loadList();
    });
  });

  // ── Models ──────────────────────────────────────────────────────────
  let rows = $state<string[]>(['', '']);
  let modelsTouched = $state(false);

  // The defaults land once the list does, unless the rows were already edited.
  $effect(() => {
    const groups = compare.groups;
    if (!compare.groupsLoaded) return;
    untrack(() => {
      if (!modelsTouched && rows.every((r) => r === '')) rows = defaultModels(groups);
    });
  });

  function setRow(i: number, value: string) {
    modelsTouched = true;
    rows[i] = value;
  }

  function addRow() {
    modelsTouched = true;
    rows = [...rows, ''];
  }

  function removeRow(i: number) {
    modelsTouched = true;
    rows = rows.filter((_, j) => j !== i);
  }

  // ── Probes ──────────────────────────────────────────────────────────
  type Source = 'session' | 'all';
  const SOURCES: { v: Source; label: string; why: string }[] = [
    { v: 'session', label: COMPARE.sourceSession, why: COMPARE.sourceSessionWhy },
    { v: 'all', label: COMPARE.sourceAll, why: COMPARE.sourceAllWhy },
  ];
  const sessionList = $derived<PickerProbe[]>(
    session.current && probes.sessionId === session.current.id ? probes.list : [],
  );
  const hasSessionList = $derived(sessionList.length > 0);
  let sourcePick = $state<Source | null>(null);
  const source = $derived<Source>(sourcePick ?? (hasSessionList ? 'session' : 'all'));
  const list = $derived<PickerProbe[]>(source === 'session' ? sessionList : compare.allProbes);
  const listReady = $derived(source === 'session' ? probes.loaded : compare.allProbesLoaded);

  let picked = $state<Set<number>>(new Set());
  let probesTouched = $state(false);

  // Until the picker is used, it starts from the rail's active probe.
  $effect(() => {
    const ids = new Set(list.map((p) => p.id));
    const active = probes.activeId;
    untrack(() => {
      if (probesTouched || picked.size > 0) return;
      if (active !== null && ids.has(active)) picked = new Set([active]);
    });
  });

  function pick(next: Set<number>) {
    probesTouched = true;
    picked = next;
  }

  let custom = $state('');
  let systemPrompt = $state('');

  // ── Run ─────────────────────────────────────────────────────────────
  const models = $derived(pickedModels(rows));
  const probeIds = $derived(list.filter((p) => picked.has(p.id)).map((p) => p.id));
  const probeCount = $derived(probeIds.length + (custom.trim() ? 1 : 0));
  const problems = $derived(compareProblems(rows, probeCount));
  const ready = $derived(compare.groupsLoaded && listReady);
  const busy = $derived(compare.running);

  let mounted = true;
  onDestroy(() => (mounted = false));

  async function run() {
    if (problems.length > 0 || busy) return;
    const id = await compare.start({
      models,
      probeIds,
      custom,
      systemPrompt: systemPrompt.trim(),
    });
    if (id === null) return;
    custom = '';
    if (mounted) await goto(comparisonRoute(id));
  }

  // The elapsed clock under the working line.
  let now = $state(Date.now());
  $effect(() => {
    if (!compare.running) return;
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });

  const TONE: Record<Tone, string> = {
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
  };
  const TONE_BAR: Record<Tone, string> = {
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
  };

  const segment =
    'relative flex cursor-pointer items-center rounded-[5px] px-2.5 py-1 text-xs transition-colors has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-accentHover';
</script>

<section class="flex max-w-[1080px] flex-col gap-4 pb-6" data-testid="compare-screen">
  <header>
    <h1 class="text-base font-semibold text-text">{COMPARE.title}</h1>
    <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS.compare}
    </p>
    <p
      class="mt-3 flex max-w-[76ch] items-start gap-2 rounded-md border border-border bg-surface/60 px-3 py-2 text-xs leading-relaxed text-text3"
      data-testid="compare-sessions-note"
    >
      <Info class="mt-0.5 h-3.5 w-3.5 shrink-0 text-text4" aria-hidden="true" />
      <span>{COMPARE.sessionsNote}</span>
    </p>
  </header>

  <Panel
    eyebrow={COMPARE.setupEyebrow}
    title={COMPARE.setupTitle}
    readout={COMPARE.setupReadout}
    anchor="compare-setup"
  >
    <fieldset
      class="flex min-w-0 flex-col gap-5"
      disabled={!ready || busy}
      aria-busy={!ready}
      data-testid="compare-setup"
    >
      <div class="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <!-- Models and the system prompt -->
        <div class="flex min-w-0 flex-col gap-4">
          <div>
            <p class={LABEL}>{COMPARE.models}</p>
            <p class="mb-2 {HINT}">{COMPARE.modelsHint}</p>
            {#if !compare.groupsLoaded}
              <p class="py-2 {HINT}">{COMPARE.modelsLoading}</p>
            {:else}
              <ol class="flex flex-col gap-2" data-testid="compare-models">
                {#each rows as model, i (i)}
                  <li class="flex items-start gap-2" transition:slide={{ duration: 140 }}>
                    <span
                      class="mt-[7px] w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-text4"
                      aria-hidden="true">{i + 1}</span
                    >
                    <div class="min-w-0 flex-1">
                      <ModelPicker
                        value={model}
                        groups={compare.groups}
                        allowCustom
                        label={COMPARE.modelN(i + 1)}
                        onChange={(m) => setRow(i, m)}
                      />
                    </div>
                    <button
                      type="button"
                      class="mt-1 rounded-md p-1 text-text4 hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-40"
                      aria-label={COMPARE.removeModel(model)}
                      disabled={rows.length <= MIN_MODELS}
                      onclick={() => removeRow(i)}
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </li>
                {/each}
              </ol>
              <button
                type="button"
                class="{BTN.ghost} mt-2 -ml-1"
                disabled={rows.length >= MAX_MODELS}
                onclick={addRow}
                data-testid="compare-add-model"
              >
                <Plus class="h-3.5 w-3.5" aria-hidden="true" />
                {COMPARE.addModel}
              </button>
            {/if}
          </div>

          <div>
            <label for="system-{uid}" class={LABEL}>{COMPARE.systemPrompt}</label>
            <textarea
              id="system-{uid}"
              rows="3"
              class="{FIELD} resize-y font-mono text-[13px]"
              bind:value={systemPrompt}
              data-testid="compare-system-prompt"
            ></textarea>
            <p class="mt-1 {HINT}">{COMPARE.systemPromptHint}</p>
          </div>
        </div>

        <!-- Probes -->
        <div class="flex min-w-0 flex-col gap-2">
          <div class="flex flex-wrap items-end justify-between gap-2">
            <p class={LABEL}>{COMPARE.probes}</p>
            {#if hasSessionList}
              <div
                role="radiogroup"
                aria-label={COMPARE.sourceLabel}
                class="inline-flex gap-0.5 rounded-md border border-border bg-bg p-0.5"
              >
                {#each SOURCES as opt (opt.v)}
                  <label
                    class="{segment} {source === opt.v
                      ? 'bg-surface2 text-text'
                      : 'text-text3 hover:text-text'}"
                    title={opt.why}
                  >
                    <input
                      type="radio"
                      name="source-{uid}"
                      class="sr-only"
                      value={opt.v}
                      checked={source === opt.v}
                      onchange={() => (sourcePick = opt.v)}
                    />
                    {opt.label}
                  </label>
                {/each}
              </div>
            {/if}
          </div>
          {#if !listReady}
            <p class="rounded-md border border-dashed border-border px-3 py-6 text-center {HINT}">
              {COMPARE.probesLoading}
            </p>
          {:else if list.length === 0}
            <p
              class="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-text4"
            >
              {COMPARE.noProbes}
            </p>
          {:else}
            <ProbePicker probes={list} selected={picked} onChange={pick} height="15rem" />
          {/if}

          <details class="group mt-1 rounded-md border border-border bg-bg/40" open={!!custom}>
            <summary
              class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-text2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
            >
              <Plus
                class="h-3.5 w-3.5 text-text4 transition-transform group-open:rotate-45"
                aria-hidden="true"
              />
              {COMPARE.customSummary}
            </summary>
            <div class="flex flex-col gap-1 px-3 pb-3">
              <label for="custom-{uid}" class="sr-only">{COMPARE.customLabel}</label>
              <textarea
                id="custom-{uid}"
                rows="3"
                class="{FIELD} resize-y"
                bind:value={custom}
                data-testid="compare-custom"
              ></textarea>
              <p class={HINT}>{COMPARE.customHint}</p>
            </div>
          </details>
        </div>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"
        data-testid="compare-footer"
      >
        <p class="font-mono text-xs tabular-nums" aria-live="polite" data-testid="compare-plan">
          {#if problems.includes('duplicate')}
            <span class="text-warn">{COMPARE.duplicateModels}</span>
          {:else if problems.length > 0}
            <span class="text-text4">{COMPARE.needPick}</span>
          {:else}
            <span class="text-text2">{COMPARE.plan(models.length, probeCount)}</span>
          {/if}
        </p>
        <button
          type="button"
          class={BTN.primary}
          title={COMPARE.runWhy}
          disabled={problems.length > 0 || busy || !ready}
          onclick={run}
          data-testid="compare-run"
        >
          {#if busy}
            <LoaderCircle class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {:else}
            <Play class="h-3.5 w-3.5" aria-hidden="true" />
          {/if}
          {COMPARE.run(models.length, probeCount)}
        </button>
      </div>
    </fieldset>

    {#if compare.run}
      {@const r = compare.run}
      <div
        class="flex flex-wrap items-start gap-3 rounded-md border px-3 py-2.5 text-xs {r.error
          ? 'border-danger/40 bg-dangerSoft/30'
          : 'border-accent/30 bg-accentSoft/10'}"
        role="status"
        data-testid="compare-working"
        transition:slide={{ duration: 160 }}
      >
        {#if r.running}
          <LoaderCircle
            class="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accentText"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <p class="leading-relaxed text-text2">
              {COMPARE.working(r.probes, r.models, r.minutes)}
            </p>
            <p class="mt-1 font-mono tabular-nums text-text4">
              {COMPARE.elapsed(clock(now - r.startedAt))}
            </p>
          </div>
        {:else if r.error}
          <div class="min-w-0 flex-1">
            <p class="font-medium text-danger">{COMPARE.failed}</p>
            <p class="mt-0.5 text-text3">{r.error}</p>
          </div>
          <button
            type="button"
            class={BTN.ghost}
            onclick={() => compare.dismiss()}
            aria-label={COMPARE.closeTurns}
          >
            <X class="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        {:else}
          <p class="min-w-0 flex-1 text-text2">{COMPARE.finished}</p>
          {#if r.comparisonId !== null}
            <a href={comparisonRoute(r.comparisonId)} class={BTN.secondary}>
              {COMPARE.openResult}
              <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          {/if}
        {/if}
      </div>
    {/if}
  </Panel>

  <Panel
    eyebrow={COMPARE.pastEyebrow}
    title={COMPARE.pastTitle}
    readout={compare.list.length > 0 ? COMPARE.pastReadout : null}
    anchor="compare-history"
  >
    {#snippet actions()}
      {#if compare.list.length > 0}
        <span class="font-mono text-[11px] tabular-nums text-text4"
          >{COMPARE.pastCount(compare.list.length)}</span
        >
      {/if}
    {/snippet}
    <div data-testid="compare-history" aria-busy={!compare.listLoaded}>
      {#if compare.listLoaded && compare.listError && compare.list.length === 0}
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-danger">{compare.listError}</p>
          <button type="button" class={BTN.secondary} onclick={() => compare.loadList()}>
            {COMPARE.loadAgain}
          </button>
        </div>
      {:else if compare.listLoaded && compare.list.length === 0}
        <div class="rounded-lg border border-dashed border-border" data-testid="compare-empty">
          <EmptyState title={COMPARE.emptyTitle} body={COMPARE.emptyBody} />
        </div>
      {:else}
        <ul class="flex flex-col divide-y divide-border">
          {#each compare.list as c, i (c.id)}
            {@const tone = agreementTone(c.agreement_rate)}
            <li
              class="grid items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              data-testid="comparison-row"
              data-comparison-id={c.id}
              in:fly={{ y: 6, duration: 180, delay: Math.min(i, 8) * 25 }}
              out:slide={{ duration: 160 }}
            >
              <div class="flex min-w-0 flex-col gap-1.5">
                <a
                  href={comparisonRoute(c.id)}
                  class="truncate text-sm font-medium text-text hover:text-accentText focus:outline-none focus-visible:underline"
                  aria-label={COMPARE.openComparison(displayName(c.name))}
                  data-testid="comparison-name">{displayName(c.name)}</a
                >
                <div class="flex flex-wrap items-center gap-1.5">
                  {#each c.models as m, j (m)}
                    {#if j > 0}<span class="text-[10px] text-text4">{COMPARE.vs}</span>{/if}
                    <span
                      class="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text3"
                      >{m}</span
                    >
                  {/each}
                  <span class="ml-1 text-[11px] text-text4"
                    >{COMPARE.probeCount(c.total_probes)} · {formatDate(c.created_at)}</span
                  >
                </div>
              </div>
              <div class="flex w-28 flex-col gap-1" data-testid="comparison-agreement">
                <span class="font-mono text-sm font-semibold tabular-nums {TONE[tone]}"
                  >{agreementLabel(c.agreement_rate)}</span
                >
                <span class="h-1 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                  <span
                    class="block h-full rounded-full {TONE_BAR[tone]}"
                    style:width="{Math.max(0, Math.min(100, c.agreement_rate))}%"
                  ></span>
                </span>
              </div>
              <div class="flex items-center gap-2 sm:justify-end">
                <a href={comparisonRoute(c.id)} class={BTN.secondary} data-testid="comparison-open">
                  {COMPARE.open}
                  <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <ConfirmButton
                  label={COMPARE.remove}
                  confirmLabel={COMPARE.removeConfirm}
                  danger
                  disabled={compare.removing.has(c.id)}
                  onConfirm={() => compare.remove(c.id).then(() => undefined)}
                />
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </Panel>
</section>
