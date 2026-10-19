<!--
  Repeat runs, Set up (brief 8.3): the ProbePicker over this session's probes
  (the rail's list; the rail's active probe picked by default), "Times per
  probe" (1 to 100, default 10), the live "{probes} probes × {n} = {total}
  calls" line, and "Run selected" / "Run every probe in this session". Several
  probes run one after another in one stream (the route takes a list).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { ListChecks, Play } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import ProbePicker from '$lib/components/ProbePicker.svelte';
  import type { PickerProbe } from '$lib/components/probe-picker';
  import { REPEAT } from '$lib/copy/studies';
  import { probes } from '$lib/stores/probe.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import { REPEAT_DEFAULT, REPEAT_MAX, REPEAT_MIN, clampRepeats } from './repeat';
  import { repeat } from './repeat.svelte';

  interface Props {
    sessionId: number;
  }

  let { sessionId }: Props = $props();

  const uid = $props.id();

  /** The rail's list, once it belongs to this session. */
  const list = $derived<PickerProbe[]>(probes.sessionId === sessionId ? probes.list : []);
  let picked = $state<Set<number>>(new Set());
  let times = $state<number | string>(REPEAT_DEFAULT);

  // A new session (or its list arriving) starts from the rail's active probe.
  $effect(() => {
    const ids = new Set(list.map((p) => p.id));
    const active = probes.activeId;
    untrack(() => {
      const kept = new Set([...picked].filter((id) => ids.has(id)));
      if (kept.size === 0 && active !== null && ids.has(active)) kept.add(active);
      picked = kept;
    });
  });

  const n = $derived(clampRepeats(times));
  const chosen = $derived(list.filter((p) => picked.has(p.id)));
  const busy = $derived(repeat.running && repeat.liveSessionId === sessionId);

  function start(plan: PickerProbe[]) {
    times = n;
    void repeat.run(
      sessionId,
      plan.map((p) => ({ id: p.id, name: p.name })),
      n,
    );
  }
</script>

<Panel
  eyebrow={REPEAT.setupEyebrow}
  title={REPEAT.setupTitle}
  readout={REPEAT.setupReadout}
  anchor="repeat-setup"
>
  <div class="flex flex-col gap-4" data-testid="repeat-setup">
    <div>
      <p class={LABEL}>{REPEAT.probes}</p>
      <p class="mb-2 {HINT}">{REPEAT.probesWhy}</p>
      {#if list.length === 0 && probes.loaded}
        <p
          class="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-text4"
        >
          {REPEAT.noProbes}
        </p>
      {:else}
        <ProbePicker
          probes={list}
          selected={picked}
          onChange={(next) => (picked = next)}
          height="13rem"
        />
      {/if}
    </div>

    <div class="grid items-end gap-3 sm:grid-cols-[8rem_1fr]">
      <div>
        <label for="times-{uid}" class={LABEL}>{REPEAT.times}</label>
        <input
          id="times-{uid}"
          type="number"
          min={REPEAT_MIN}
          max={REPEAT_MAX}
          step="1"
          class="{FIELD} font-mono tabular-nums"
          bind:value={times}
          onblur={() => (times = n)}
          data-testid="repeat-times"
        />
      </div>
      <p class="pb-1.5 {HINT}">{REPEAT.timesHint}</p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <p
        class="font-mono text-xs tabular-nums {chosen.length ? 'text-text2' : 'text-text4'}"
        aria-live="polite"
        data-testid="repeat-plan"
      >
        {chosen.length ? REPEAT.plan(chosen.length, n) : REPEAT.pickFirst}
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class={BTN.secondary}
          title={REPEAT.runEveryWhy}
          disabled={busy || list.length === 0}
          onclick={() => start(list)}
          data-testid="repeat-run-every"
        >
          <ListChecks class="h-3.5 w-3.5" aria-hidden="true" />
          {REPEAT.runEvery(list.length)}
        </button>
        <button
          type="button"
          class={BTN.primary}
          title={REPEAT.runSelectedWhy}
          disabled={busy || chosen.length === 0}
          onclick={() => start(chosen)}
          data-testid="repeat-run"
        >
          <Play class="h-3.5 w-3.5" aria-hidden="true" />
          {REPEAT.runSelected}
        </button>
      </div>
    </div>
  </div>
</Panel>
