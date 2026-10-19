<!--
  Build a scorecard (brief 9.2): a name, the models (checkbox chips of every
  distinct target model in GET /api/sessions, all checked), the sources:
  sessions with runs (Model compare sessions marked "(model compare)" by
  isCompareSession, R13) and their repeat runs, all checked. Fields stay
  disabled until the reads land; the defaults apply once, and never over a
  pick the user has already made.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Sparkles } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { SCORECARD } from '$lib/copy/data';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import {
    NAME_MAX,
    distinctModels,
    generateBody,
    generateProblems,
    sourceSessions,
    toggled,
  } from './scorecard';
  import { scorecard } from './scorecard-store.svelte';

  const uid = $props.id();

  let name = $state('');
  let models = $state<Set<string>>(new Set());
  let sessionIds = $state<Set<number>>(new Set());
  let statRunIds = $state<Set<number>>(new Set());
  /** The user has changed a pick since this visit's defaults. */
  let touched = $state(false);
  let ready = $state(false);

  const modelList = $derived(distinctModels(scorecard.sessions));
  const sessionList = $derived(sourceSessions(scorecard.sessions));
  const repeatList = $derived(scorecard.statRuns);

  const form = $derived({ name, models, sessionIds, statRunIds });
  const problems = $derived(generateProblems(form));
  const locked = $derived(!ready || scorecard.generating);

  // Each visit reads the sources again; the defaults land with the first read.
  $effect(() => {
    untrack(() => {
      void scorecard.loadSources().then(() => {
        if (!touched) {
          models = new Set(distinctModels(scorecard.sessions));
          sessionIds = new Set(sourceSessions(scorecard.sessions).map((s) => s.id));
          statRunIds = new Set(scorecard.statRuns.map((r) => r.stat_run_id));
        }
        ready = true;
      });
    });
  });

  function pickModel(m: string) {
    touched = true;
    models = toggled(models, m);
  }
  function pickSession(id: number) {
    touched = true;
    sessionIds = toggled(sessionIds, id);
  }
  function pickRepeat(id: number) {
    touched = true;
    statRunIds = toggled(statRunIds, id);
  }
  function allSessions(on: boolean) {
    touched = true;
    sessionIds = new Set(on ? sessionList.map((s) => s.id) : []);
  }
  function allRepeats(on: boolean) {
    touched = true;
    statRunIds = new Set(on ? repeatList.map((r) => r.stat_run_id) : []);
  }
  function allModels(on: boolean) {
    touched = true;
    models = new Set(on ? modelList : []);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (locked || problems.length > 0) return;
    await scorecard.generate(generateBody(form, modelList));
  }

  const CHIP =
    'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-accentHover';
  const LIST = 'max-h-52 overflow-y-auto rounded-md border border-border bg-bg/40';
  const ROW =
    'flex cursor-pointer items-center gap-2.5 border-b border-border/50 px-3 py-1.5 text-xs last:border-b-0 hover:bg-surface2/50';
  const MINI =
    'rounded px-1.5 py-0.5 text-[11px] font-medium text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:opacity-50';
</script>

{#snippet bulk(what: string, onAll: () => void, onNone: () => void, picked: number, total: number)}
  <span class="flex items-center gap-1">
    <span class="mr-1 font-mono text-[11px] tabular-nums text-text4"
      >{SCORECARD.picked(picked, total)}</span
    >
    <button
      type="button"
      class={MINI}
      onclick={onAll}
      aria-label={SCORECARD.selectAllOf(what)}
      disabled={locked || total === 0}>{SCORECARD.selectAll}</button
    >
    <button
      type="button"
      class={MINI}
      onclick={onNone}
      aria-label={SCORECARD.selectNoneOf(what)}
      disabled={locked || picked === 0}>{SCORECARD.selectNone}</button
    >
  </span>
{/snippet}

<Panel
  eyebrow={SCORECARD.buildEyebrow}
  title={SCORECARD.buildTitle}
  readout={SCORECARD.buildReadout}
>
  <form
    class="flex flex-col gap-4"
    onsubmit={submit}
    data-testid="scorecard-build"
    aria-busy={!ready}
  >
    <fieldset class="contents" disabled={locked}>
      <div class="max-w-sm">
        <label for="sc-name-{uid}" class={LABEL}>{SCORECARD.name}</label>
        <input
          id="sc-name-{uid}"
          class={FIELD}
          placeholder={SCORECARD.namePlaceholder}
          maxlength={NAME_MAX + 1}
          bind:value={name}
          data-testid="scorecard-name"
        />
        <p class="{HINT} mt-1">
          {problems.includes('name') ? SCORECARD.nameTooLong : SCORECARD.nameHint}
        </p>
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <span class={LABEL} id="sc-models-{uid}">{SCORECARD.models}</span>
          {@render bulk(
            SCORECARD.models.toLowerCase(),
            () => allModels(true),
            () => allModels(false),
            models.size,
            modelList.length,
          )}
        </div>
        {#if ready && modelList.length === 0}
          <p class={HINT}>{SCORECARD.modelsNone}</p>
        {:else}
          <div
            class="flex flex-wrap gap-1.5"
            role="group"
            aria-labelledby="sc-models-{uid}"
            data-testid="scorecard-models"
          >
            {#each modelList as m (m)}
              {@const on = models.has(m)}
              <label
                class="{CHIP} {on
                  ? 'border-accent/60 bg-accentSoft/40 text-accentText'
                  : 'border-borderStrong text-text3 hover:text-text2'}"
              >
                <input
                  type="checkbox"
                  class="h-3 w-3 accent-accent"
                  checked={on}
                  onchange={() => pickModel(m)}
                  data-model={m}
                />
                {m}
              </label>
            {/each}
          </div>
        {/if}
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="min-w-0">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span class={LABEL} id="sc-sessions-{uid}">
              <span class="text-text4">{SCORECARD.sources} ·</span>
              {SCORECARD.sessions}
            </span>
            {@render bulk(
              SCORECARD.sessions.toLowerCase(),
              () => allSessions(true),
              () => allSessions(false),
              sessionIds.size,
              sessionList.length,
            )}
          </div>
          <div
            class={LIST}
            role="group"
            aria-labelledby="sc-sessions-{uid}"
            data-testid="scorecard-sessions"
          >
            {#if !ready}
              <p class="px-3 py-3 text-xs text-text4">{SCORECARD.loadingSources}</p>
            {:else if sessionList.length === 0}
              <p class="px-3 py-3 text-xs text-text4">{SCORECARD.sessionsNone}</p>
            {:else}
              {#each sessionList as s (s.id)}
                <label class={ROW} data-testid="scorecard-source-session" data-session-id={s.id}>
                  <input
                    type="checkbox"
                    class="h-3.5 w-3.5 shrink-0 accent-accent"
                    checked={sessionIds.has(s.id)}
                    onchange={() => pickSession(s.id)}
                  />
                  <span class="min-w-0 flex-1 truncate text-text2">
                    {s.name}
                    {#if s.compare}
                      <span class="text-text4">{SCORECARD.compareLabel}</span>
                    {/if}
                  </span>
                  <span class="hidden shrink-0 truncate font-mono text-[10px] text-text4 sm:inline"
                    >{s.model}</span
                  >
                  <span class="shrink-0 font-mono text-[10px] tabular-nums text-text4"
                    >{SCORECARD.sessionRuns(s.runCount)}</span
                  >
                </label>
              {/each}
            {/if}
          </div>
        </div>

        <div class="min-w-0">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span class={LABEL} id="sc-repeats-{uid}">
              <span class="text-text4">{SCORECARD.sources} ·</span>
              {SCORECARD.repeatRuns}
            </span>
            {@render bulk(
              SCORECARD.repeatRuns.toLowerCase(),
              () => allRepeats(true),
              () => allRepeats(false),
              statRunIds.size,
              repeatList.length,
            )}
          </div>
          <div
            class={LIST}
            role="group"
            aria-labelledby="sc-repeats-{uid}"
            data-testid="scorecard-repeats"
          >
            {#if !ready}
              <p class="px-3 py-3 text-xs text-text4">{SCORECARD.loadingSources}</p>
            {:else if repeatList.length === 0}
              <p class="px-3 py-3 text-xs text-text4">{SCORECARD.repeatNone}</p>
            {:else}
              {#each repeatList as r (r.stat_run_id)}
                <label
                  class={ROW}
                  data-testid="scorecard-source-repeat"
                  data-stat-run-id={r.stat_run_id}
                >
                  <input
                    type="checkbox"
                    class="h-3.5 w-3.5 shrink-0 accent-accent"
                    checked={statRunIds.has(r.stat_run_id)}
                    onchange={() => pickRepeat(r.stat_run_id)}
                  />
                  <span class="min-w-0 flex-1 truncate font-mono text-[11px] text-text2"
                    >{SCORECARD.repeatRow(r.probe_name, r.model, r.total)}</span
                  >
                </label>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </fieldset>

    <div class="flex flex-wrap items-center gap-3 border-t border-border pt-3">
      <button
        type="submit"
        class={BTN.primary}
        disabled={locked || problems.length > 0}
        data-testid="scorecard-generate"
      >
        <Sparkles class="h-3.5 w-3.5" aria-hidden="true" />
        {scorecard.generating ? SCORECARD.generating : SCORECARD.generate}
      </button>
      {#if ready && problems.includes('models')}
        <p class="text-xs text-warn">{SCORECARD.modelsNeeded}</p>
      {:else if ready && problems.includes('sources')}
        <p class="text-xs text-warn">{SCORECARD.sourcesNeeded}</p>
      {/if}
    </div>
  </form>
</Panel>
