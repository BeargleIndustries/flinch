<!--
  A study's prompt sources (brief 8.2.2 panel 3, 8.2.3 "Add prompts…"), in
  the order Flinch adds them (I12): HH-RLHF first (the importer refuses a
  study that already has prompts), then picked probes, then pasted CSV. Used
  by the New study page and PromptSourcesDialog. Loads every probe itself.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { Probe } from '$lib/api/types';
  import ProbePicker from '$lib/components/ProbePicker.svelte';
  import Readout from '$lib/components/Readout.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import { CONDITIONS, HH_KIND_LABELS } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { status } from '$lib/stores/status.svelte';
  import { FIELD, HINT, LABEL } from '../probe/styles';
  import {
    HH_DEFAULT_MIX,
    HH_KINDS,
    HH_SUBSETS,
    HH_TARGET_MAX,
    csvCount,
    hhError,
    mixSum,
    type PromptSources,
  } from './conditions';

  interface Props {
    sources: PromptSources;
    /** False when the study already has prompts (the importer would skip). */
    hhAllowed?: boolean;
    /** Show field problems (after a submit attempt). */
    showErrors?: boolean;
  }

  let { sources = $bindable(), hhAllowed = true, showErrors = false }: Props = $props();

  const uid = $props.id();

  let probes = $state<Probe[]>([]);
  let probesLoaded = $state(false);
  let probesError = $state<string | null>(null);

  $effect(() => {
    untrack(() => void loadProbes());
  });

  async function loadProbes() {
    try {
      probes = await status.track(request<Probe[]>(ROUTES.listProbes));
    } catch (e) {
      probesError = friendlyError(e).message;
    } finally {
      probesLoaded = true;
    }
  }

  const csv = $derived(csvCount(sources.csvText));
  const sum = $derived(mixSum(sources.hh.mix));
  const hhProblem = $derived(hhError(sources.hh));

  function toggleSubset(s: string, on: boolean) {
    const next = sources.hh.subsets.filter((x) => x !== s);
    sources.hh.subsets = on ? HH_SUBSETS.filter((x) => x === s || next.includes(x)) : next;
  }

  function numberFrom(e: Event): number {
    const v = (e.currentTarget as HTMLInputElement).valueAsNumber;
    return Number.isFinite(v) ? v : NaN;
  }
</script>

<div class="flex flex-col gap-5" data-testid="prompt-sources">
  <!-- 1. HH-RLHF -->
  <div class="flex flex-col gap-3 rounded-md border border-border bg-bg/40 p-3">
    <label class="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        class="mt-0.5 h-3.5 w-3.5 accent-accent"
        bind:checked={sources.hh.enabled}
        disabled={!hhAllowed}
        data-testid="hh-toggle"
      />
      <span class="flex flex-col gap-0.5">
        <span class="text-[13px] font-medium text-text2">{CONDITIONS.hhToggle}</span>
        {#if !hhAllowed}<span class={HINT}>{CONDITIONS.hhNeedsEmpty}</span>{/if}
      </span>
    </label>

    {#if sources.hh.enabled && hhAllowed}
      <div class="flex flex-col gap-3" transition:slide={{ duration: 160 }}>
        <Readout text={SCREENS['conditions.hh']} />
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label for="hh-target-{uid}" class={LABEL}>{CONDITIONS.hhTarget}</label>
            <input
              id="hh-target-{uid}"
              type="number"
              min="1"
              max={HH_TARGET_MAX}
              step="1"
              class="{FIELD} font-mono tabular-nums"
              value={sources.hh.targetCount}
              oninput={(e) => (sources.hh.targetCount = numberFrom(e))}
              data-testid="hh-target"
            />
            <p class="mt-1 {HINT}">{CONDITIONS.hhTargetHint}</p>
          </div>
          <div>
            <label for="hh-seed-{uid}" class={LABEL}>{CONDITIONS.hhSeed}</label>
            <input
              id="hh-seed-{uid}"
              type="number"
              step="1"
              class="{FIELD} font-mono tabular-nums"
              value={sources.hh.seed}
              oninput={(e) => (sources.hh.seed = numberFrom(e))}
            />
            <p class="mt-1 {HINT}">{CONDITIONS.hhSeedHint}</p>
          </div>
        </div>

        <fieldset>
          <legend class={LABEL}>{CONDITIONS.hhSubsets}</legend>
          <div class="flex flex-wrap gap-x-4 gap-y-1.5">
            {#each HH_SUBSETS as s (s)}
              <label
                class="flex cursor-pointer items-center gap-1.5 font-mono text-[12px] text-text3"
              >
                <input
                  type="checkbox"
                  class="h-3.5 w-3.5 accent-accent"
                  checked={sources.hh.subsets.includes(s)}
                  onchange={(e) => toggleSubset(s, (e.currentTarget as HTMLInputElement).checked)}
                />
                {s}
              </label>
            {/each}
          </div>
        </fieldset>

        <fieldset>
          <div class="mb-1 flex items-baseline justify-between gap-3">
            <legend class="text-xs font-medium text-text2">{CONDITIONS.hhMix}</legend>
            <button
              type="button"
              class="text-[11px] text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
              onclick={() => (sources.hh.mix = { ...HH_DEFAULT_MIX })}
              >{CONDITIONS.hhMixReset}</button
            >
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {#each HH_KINDS as k (k)}
              <label class="flex flex-col gap-1">
                <span class="text-[11px] text-text3">{HH_KIND_LABELS[k]}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  class="{FIELD} font-mono tabular-nums"
                  value={sources.hh.mix[k]}
                  oninput={(e) => (sources.hh.mix[k] = numberFrom(e))}
                  data-testid="hh-mix-{k}"
                />
              </label>
            {/each}
          </div>
          {#if Math.abs(sum - 100) > 0.001}
            <p class="mt-1 text-[11px] leading-snug text-warn">{CONDITIONS.hhMixSum(sum)}</p>
          {:else}
            <p class="mt-1 {HINT}">{CONDITIONS.hhMixHint}</p>
          {/if}
        </fieldset>
        {#if showErrors && hhProblem}
          <p class="text-xs text-danger" role="alert">{hhProblem}</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- 2. Picked probes -->
  <div class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between gap-3">
      <span class="text-xs font-medium text-text2">{CONDITIONS.probesLabel}</span>
      <span class="font-mono text-[11px] tabular-nums text-text3" data-testid="probes-picked"
        >{CONDITIONS.probesPicked(sources.probeIds.size)}</span
      >
    </div>
    {#if !probesLoaded}
      <p class={HINT}>{CONDITIONS.probesLoading}</p>
    {:else if probesError}
      <p class="text-xs text-danger">{probesError}</p>
    {:else}
      <div data-testid="study-probe-picker">
        <ProbePicker
          {probes}
          selected={sources.probeIds}
          onChange={(next) => (sources.probeIds = next)}
          height="13rem"
        />
      </div>
    {/if}
  </div>

  <!-- 3. Pasted CSV -->
  <details class="group rounded-md border border-border bg-bg/40" open={sources.csvText !== ''}>
    <summary
      class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[13px] font-medium text-text2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
    >
      <span>{CONDITIONS.csvToggle}</span>
      {#if csv.rows > 0}
        <span class="font-mono text-[11px] tabular-nums text-text3"
          >{CONDITIONS.csvRows(csv.rows)}</span
        >
      {/if}
    </summary>
    <div class="flex flex-col gap-1.5 border-t border-border px-3 pb-3 pt-2">
      <p class={HINT}>{CONDITIONS.csvHint}</p>
      <textarea
        rows="5"
        spellcheck="false"
        aria-label={CONDITIONS.csvLabel}
        class="{FIELD} resize-y font-mono text-[12px] leading-relaxed"
        placeholder="prompt_text,domain"
        bind:value={sources.csvText}
        data-testid="csv-text"
      ></textarea>
      {#if sources.csvText.trim()}
        <p
          class="font-mono text-[11px] tabular-nums {csv.hasHeader ? 'text-text3' : 'text-warn'}"
          data-testid="csv-count"
          aria-live="polite"
        >
          {csv.hasHeader ? CONDITIONS.csvRows(csv.rows) : CONDITIONS.csvNoHeader}
        </p>
      {/if}
    </div>
  </details>
</div>
