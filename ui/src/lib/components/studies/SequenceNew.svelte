<!--
  Sequences, "New sequence" (brief 8.4, data-tour="sequence-form"): Strategy
  (GET /api/strategies, "{name} ({category})" with the description under it),
  Probe (the session's probes, the rail's active one first picked, plus
  "Custom prompt…" which reveals a textarea), Mode (automatic or
  interactive), Warmup turns (1 to 20, default 10), the interactive-fiction
  engine checkbox, then "Create sequence" and "Create and whittle" (creates an
  automatic sequence, then whittles it).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Plus, Scissors } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { SEQUENCES as S } from '$lib/copy/studies';
  import { probes } from '$lib/stores/probe.svelte';
  import { status } from '$lib/stores/status.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import {
    WARMUP_DEFAULT,
    WARMUP_MAX,
    WARMUP_MIN,
    clampWarmup,
    pickStrategy,
    strategyOption,
  } from './sequences';
  import { sequences } from './sequences.svelte';

  interface Props {
    sessionId: number;
  }

  let { sessionId }: Props = $props();

  const uid = $props.id();
  const CUSTOM = 'custom';

  const list = $derived(probes.sessionId === sessionId ? probes.list : []);
  const strategies = $derived(sequences.strategies);

  let strategyId = $state<number | null>(null);
  let probeChoice = $state<string>('');
  let customText = $state('');
  let mode = $state<'automatic' | 'interactive'>('automatic');
  let warmup = $state(WARMUP_DEFAULT);
  let engine = $state(false);
  let busy = $state<'create' | 'whittle' | null>(null);
  let problem = $state<string | null>(null);

  // Keep the picked strategy while it is listed, else the first.
  $effect(() => {
    const listed = strategies;
    untrack(() => (strategyId = pickStrategy(listed, strategyId)));
  });

  /** "Custom prompt…" picked by hand (not the fallback for an empty list). */
  let customByHand = $state(false);
  const listLoaded = $derived(probes.sessionId === sessionId && probes.loaded);

  // Keep the picked probe while it is listed; else the rail's active probe,
  // else the first. "Custom prompt…" is the fallback only once the session's
  // list has loaded empty, so a list that arrives late still gets picked.
  $effect(() => {
    const ids = list.map((p) => String(p.id));
    const active = probes.activeId;
    const loaded = listLoaded;
    untrack(() => {
      if ((probeChoice === CUSTOM && customByHand) || ids.includes(probeChoice)) return;
      if (ids.length)
        probeChoice = active !== null && ids.includes(String(active)) ? String(active) : ids[0];
      else probeChoice = loaded ? CUSTOM : '';
    });
  });

  const strategy = $derived(strategies.find((s) => s.id === strategyId) ?? null);
  const custom = $derived(probeChoice === CUSTOM);
  const probeName = $derived(
    custom ? S.customLabel : (list.find((p) => String(p.id) === probeChoice)?.name ?? ''),
  );
  const ready = $derived(strategyId !== null && !!probeChoice);

  async function create(andWhittle: boolean) {
    if (busy || strategyId === null) return;
    problem = null;
    if (custom && !customText.trim()) {
      problem = S.customEmpty;
      return;
    }
    busy = andWhittle ? 'whittle' : 'create';
    const n = clampWarmup(warmup);
    try {
      const seq = await sequences.create(sessionId, {
        strategyId,
        probeId: custom ? null : Number(probeChoice),
        customText: customText.trim(),
        mode: andWhittle ? 'automatic' : mode,
        warmup: n,
        engine,
      });
      if (!seq) return;
      const name = custom
        ? (probes.list.find((p) => p.id === seq.probe_id)?.name ?? S.customLabel)
        : probeName;
      if (custom) {
        customText = '';
        probeChoice = String(seq.probe_id);
        customByHand = false;
      }
      status.note(S.created(name));
      if (andWhittle) void sequences.whittle(seq, name);
    } finally {
      busy = null;
    }
  }
</script>

<Panel eyebrow={S.newEyebrow} title={S.newTitle} readout={S.newReadout} anchor="sequence-form">
  <div class="flex flex-col gap-4" data-testid="sequence-new">
    <div>
      <label for="seq-strategy-{uid}" class={LABEL}>{S.strategy}</label>
      {#if strategies.length === 0 && sequences.strategiesLoaded}
        <p class={HINT}>{S.strategyNone}</p>
      {:else}
        <select
          id="seq-strategy-{uid}"
          class={FIELD}
          bind:value={strategyId}
          aria-describedby="seq-strategy-desc-{uid}"
          data-testid="sequence-strategy"
        >
          {#each strategies as s (s.id)}
            <option value={s.id}>{strategyOption(s)}</option>
          {/each}
        </select>
        <p id="seq-strategy-desc-{uid}" class="mt-1 min-h-4 text-xs text-text3">
          {strategy?.description ?? ''}
        </p>
      {/if}
    </div>

    <div>
      <label for="seq-probe-{uid}" class={LABEL}>{S.probe}</label>
      <select
        id="seq-probe-{uid}"
        class="{FIELD} font-mono text-[13px]"
        bind:value={probeChoice}
        onchange={() => (customByHand = probeChoice === CUSTOM)}
        data-testid="sequence-probe"
      >
        {#each list as p (p.id)}
          <option value={String(p.id)}>{p.name}</option>
        {/each}
        <option value={CUSTOM}>{S.customOption}</option>
      </select>
      {#if list.length === 0 && probes.loaded}
        <p class="mt-1 {HINT}">{S.noProbes}</p>
      {/if}
      {#if custom}
        <div class="mt-2 border-l-2 border-accent/50 pl-3">
          <label for="seq-custom-{uid}" class="sr-only">{S.customLabel}</label>
          <textarea
            id="seq-custom-{uid}"
            rows="3"
            class="{FIELD} resize-y font-mono text-[13px]"
            placeholder={S.customLabel}
            bind:value={customText}
            data-testid="sequence-custom"
          ></textarea>
          <p class="mt-1 {HINT}">{S.customHint}</p>
        </div>
      {/if}
    </div>

    <fieldset>
      <legend class={LABEL}>{S.mode}</legend>
      <div class="grid gap-1.5 sm:grid-cols-2">
        {#each [['automatic', S.modeAutomatic], ['interactive', S.modeInteractive]] as [value, text] (value)}
          {@const [head, tail] = text.split(': ')}
          <label
            class="flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors {mode ===
            value
              ? 'border-accent/60 bg-accent/5'
              : 'border-border hover:border-borderStrong'}"
          >
            <input
              type="radio"
              name="seq-mode-{uid}"
              {value}
              bind:group={mode}
              class="mt-0.5 h-3.5 w-3.5 accent-accent"
              data-testid="sequence-mode-{value}"
            />
            <span class="leading-snug">
              <span class="font-medium text-text">{head}</span>
              <span class="block text-text3">{tail[0].toUpperCase()}{tail.slice(1)}</span>
            </span>
          </label>
        {/each}
      </div>
    </fieldset>

    <div>
      <div class="flex items-baseline justify-between gap-3">
        <label for="seq-warmup-{uid}" class={LABEL}>{S.warmup}</label>
        <output
          for="seq-warmup-{uid}"
          class="font-mono text-xs tabular-nums text-accentText"
          data-testid="sequence-warmup-value">{S.warmupValue(warmup)}</output
        >
      </div>
      <input
        id="seq-warmup-{uid}"
        type="range"
        min={WARMUP_MIN}
        max={WARMUP_MAX}
        step="1"
        bind:value={warmup}
        aria-describedby="seq-warmup-hint-{uid}"
        class="w-full accent-accent"
        data-testid="sequence-warmup"
      />
      <div
        class="flex justify-between font-mono text-[10px] tabular-nums text-text4"
        aria-hidden="true"
      >
        <span>{WARMUP_MIN}</span><span>{WARMUP_MAX}</span>
      </div>
      <p id="seq-warmup-hint-{uid}" class={HINT}>{S.warmupHint}</p>
    </div>

    <label class="flex cursor-pointer items-start gap-2 text-sm text-text2">
      <input
        type="checkbox"
        bind:checked={engine}
        class="mt-0.5 h-3.5 w-3.5 accent-accent"
        aria-describedby="seq-engine-hint-{uid}"
        data-testid="sequence-engine"
      />
      <span>
        {S.engine}
        <span id="seq-engine-hint-{uid}" class="mt-0.5 block {HINT}">{S.engineHint}</span>
      </span>
    </label>

    {#if problem}
      <p class="text-xs text-danger" role="alert">{problem}</p>
    {/if}

    <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
      <button
        type="button"
        class={BTN.secondary}
        title={S.createWhittleWhy}
        disabled={!!busy || !ready}
        onclick={() => void create(true)}
        data-testid="sequence-create-whittle"
      >
        <Scissors class="h-3.5 w-3.5" aria-hidden="true" />
        {busy === 'whittle' ? S.creating : S.createWhittle}
      </button>
      <button
        type="button"
        class={BTN.primary}
        title={S.createWhy}
        disabled={!!busy || !ready}
        onclick={() => void create(false)}
        data-testid="sequence-create"
      >
        <Plus class="h-3.5 w-3.5" aria-hidden="true" />
        {busy === 'create' ? S.creating : S.create}
      </button>
    </div>
  </div>
</Panel>
