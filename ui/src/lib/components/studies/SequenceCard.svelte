<!--
  One sequence in "Sequences in this session" (brief 8.4): probe and strategy,
  StatusChip, mode, "IF engine" when set, "Warmup: {n} turns", and for
  completed cards the summary ("{complied} got through, {refused} Refused",
  "Threshold: {n} turns"). Actions by mode and status:
  - interactive, pending or running: "Next turn" and "Drop the probe", with
    the transcript and "{sent} of {planned} warmup turns sent";
  - every other mode, unless running: "Run all turns" (stream `sequence:{id}`,
    "Run again" once it has run) and "Whittle" (one long request; R11 working
    line with the expected duration and a running clock);
  - completed or failed: "Show results" (the Results tab with it picked);
  - all: the export menu and "Delete this sequence".
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import {
    ArrowRight,
    BarChart3,
    ChevronsDown,
    ListOrdered,
    Loader2,
    Play,
    Scissors,
    Square,
    StepForward,
    Target,
  } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import { SEQUENCES as S } from '$lib/copy/studies';
  import { friendlyError } from '$lib/errors';
  import { probes } from '$lib/stores/probe.svelte';
  import { BTN } from '../probe/styles';
  import { runDate } from './repeat';
  import SequenceExport from './SequenceExport.svelte';
  import SequenceThread from './SequenceThread.svelte';
  import {
    autoLineParts,
    canRunAll,
    canStep,
    clock,
    hasResults,
    isInteractive,
    probeClass,
    strategyTitle,
    usesEngine,
    warmupsSent,
    type Sequence,
  } from './sequences';
  import { sequences } from './sequences.svelte';

  interface Props {
    seq: Sequence;
  }

  let { seq }: Props = $props();

  let root: HTMLElement | null = $state(null);
  let now = $state(Date.now());

  const id = $derived(seq.id);
  const probeName = $derived(
    probes.list.find((p) => p.id === seq.probe_id)?.name ?? S.probeFallback(seq.probe_id),
  );
  const strategy = $derived(sequences.strategyById(seq.strategy_id));
  const strategyName = $derived(
    strategy ? strategyTitle(strategy.name) : S.strategyFallback(seq.strategy_id),
  );
  const summary = $derived(sequences.summaries[id]?.summary ?? null);
  const thread = $derived(sequences.threads[id] ?? null);
  const shown = $derived(!!sequences.shown[id]);
  const auto = $derived(sequences.auto[id] ?? null);
  const whittle = $derived(sequences.whittles[id] ?? null);
  const pending = $derived(sequences.pending[id] ?? null);
  const autoRunning = $derived(auto?.phase === 'running');
  const whittling = $derived(!!whittle?.running);
  const busy = $derived(autoRunning || whittling || !!pending);

  const stepping = $derived(canStep(seq));
  const sent = $derived(thread ? warmupsSent(thread.turns) : 0);
  const planned = $derived(thread?.planned ?? seq.max_warmup_turns);
  const dropped = $derived(thread ? probeClass(thread.turns) : null);
  const when = $derived(runDate(seq.created_at));
  const line = $derived(auto ? autoLineParts(auto) : null);

  // Completed and failed cards read their summary once.
  $effect(() => {
    if (!hasResults(seq)) return;
    const sid = id;
    untrack(() => sequences.ensureSummary(sid));
  });

  // An interactive sequence still taking turns opens with its transcript.
  $effect(() => {
    if (!stepping) return;
    const s = seq;
    untrack(() => {
      if (!sequences.threads[s.id]) void sequences.showThread(s);
    });
  });

  // A sequence just created scrolls into view.
  $effect(() => {
    if (sequences.focusId !== id || !root) return;
    const el = root;
    untrack(() => {
      sequences.focusId = null;
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });

  // The whittle working line's clock.
  $effect(() => {
    if (!whittling) return;
    now = Date.now();
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });

  function toggleThread() {
    if (shown) sequences.hideThread(id);
    else void sequences.showThread(seq);
  }

  const ran = $derived(seq.status === 'completed' || seq.status === 'failed');
  const chip = 'rounded border border-border px-1.5 py-px font-mono text-[10px] text-text3';
</script>

<li
  bind:this={root}
  class="flex flex-col gap-3 rounded-lg border bg-bg/40 p-3.5 transition-colors {busy
    ? 'border-accent/50'
    : 'border-border'}"
  in:fly={{ y: 6, duration: 180 }}
  data-testid="sequence-card"
  data-sequence-id={id}
  data-status={seq.status}
  data-mode={seq.mode}
>
  <header class="flex flex-wrap items-start justify-between gap-2">
    <div class="min-w-0">
      <p
        class="truncate font-mono text-[13px] font-medium text-text"
        data-testid="sequence-probe-name"
      >
        {probeName}
      </p>
      <p class="truncate text-xs text-text3" data-testid="sequence-strategy-name">{strategyName}</p>
    </div>
    <span data-testid="sequence-status"><StatusChip status={seq.status} /></span>
  </header>

  <div class="flex flex-wrap items-center gap-1.5">
    <span class={chip} data-testid="sequence-mode">{S.modes[seq.mode] ?? seq.mode}</span>
    {#if usesEngine(seq)}
      <span
        class="rounded border border-accent/40 bg-accent/10 px-1.5 py-px font-mono text-[10px] text-accentText"
        title={S.engineChipWhy}>{S.engineChip}</span
      >
    {/if}
    {#if seq.batch_id !== null}
      <span class={chip}>{S.batchChip(seq.batch_id)}</span>
    {/if}
    <span class={chip}>{S.warmupChip(seq.max_warmup_turns)}</span>
    {#if when}
      <span class="ml-auto font-mono text-[10px] tabular-nums text-text4"
        >{when.date} {when.time}</span
      >
    {/if}
  </div>

  {#if summary && ran}
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="sequence-summary">
      <span class="text-text2">{S.gotThrough(summary.complied, summary.refused)}</span>
      {#if summary.threshold_found && summary.threshold_warmup_count !== null}
        <span class="font-mono tabular-nums text-accentText">
          {S.threshold(summary.threshold_warmup_count)}
        </span>
      {/if}
    </div>
  {/if}

  {#if auto}
    <div class="flex flex-col gap-1.5" data-testid="sequence-auto" data-state={auto.phase}>
      <div class="flex items-center gap-2 text-xs">
        {#if autoRunning}
          <Loader2 class="h-3.5 w-3.5 animate-spin text-accentText" aria-hidden="true" />
        {/if}
        <span class="min-w-0 truncate font-mono tabular-nums text-text2" aria-live="polite">
          {#if line}
            {S.autoLine(auto.step, auto.total, line.type, line.cls)}
          {:else if autoRunning}
            {S.autoStarting}
          {/if}
        </span>
        {#if autoRunning}
          <button
            type="button"
            class="ml-auto inline-flex items-center gap-1 text-text3 hover:text-text focus:outline-none focus-visible:underline"
            title={S.stopWhy}
            onclick={() => void sequences.stopAll(id)}
          >
            <Square class="h-3 w-3" aria-hidden="true" />{S.stop}
          </button>
        {/if}
      </div>
      <div class="h-1 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
        <div
          class="h-full rounded-full bg-accent transition-[width] duration-300"
          style:width="{Math.round((auto.step / Math.max(1, auto.total)) * 100)}%"
        ></div>
      </div>
      {#if auto.probeCls}
        <p class="flex items-center gap-2 text-xs text-text2" data-testid="sequence-auto-result">
          {S.probeResult}
          <ClassBadge value={auto.probeCls} size="sm" />
        </p>
      {:else if auto.phase === 'stopped'}
        <p class="text-[11px] text-text4">{S.autoStopped}</p>
      {:else if auto.error}
        <p class="text-xs text-danger" role="alert">{friendlyError(auto.error).message}</p>
      {/if}
    </div>
  {/if}

  {#if whittle}
    <div
      class="rounded-md border px-3 py-2 text-xs {whittle.running
        ? 'border-accent/40 bg-accent/5'
        : 'border-border'}"
      data-testid="sequence-whittle"
      data-state={whittle.running ? 'running' : whittle.error ? 'failed' : 'done'}
    >
      {#if whittle.running}
        <p class="flex items-start gap-2 text-text2" role="status">
          <Loader2
            class="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-accentText"
            aria-hidden="true"
          />
          <span>
            {S.whittleWorking(whittle.passes, whittle.minutes)}
            <span class="mt-0.5 block font-mono text-[11px] tabular-nums text-text4"
              >{S.whittleElapsed(clock(now - whittle.startedAt))}</span
            >
          </span>
        </p>
      {:else if whittle.error}
        <p class="text-danger" role="alert">{S.whittleFailed}</p>
      {:else if whittle.result}
        {@const r = whittle.result}
        <p class="text-text2" data-testid="sequence-whittle-result">
          {#if r.results.some((x) => x.probe_classification === 'error')}
            {S.whittleFailed}
          {:else if r.threshold_found && r.threshold_at === 0}
            {S.whittleZero}
          {:else if r.threshold_found && r.threshold_at !== null}
            {S.whittleThreshold(r.threshold_at, r.total_runs)}
          {:else}
            {S.whittleNone(whittle.max)}
          {/if}
        </p>
      {/if}
    </div>
  {/if}

  {#if stepping}
    <div class="flex flex-col gap-2" data-testid="sequence-interactive">
      <div class="flex items-center gap-3">
        <div class="flex flex-1 gap-1" aria-hidden="true">
          {#each Array.from({ length: Math.max(planned, 1) }, (_, i) => i) as i (i)}
            <span
              class="h-1.5 flex-1 rounded-full transition-colors duration-300 {i < sent
                ? 'bg-accent'
                : 'bg-surface2'}"
            ></span>
          {/each}
        </div>
        <span
          class="shrink-0 font-mono text-[11px] tabular-nums text-text3"
          data-testid="sequence-sent">{S.sentOf(sent, planned)}</span
        >
      </div>
      {#if sent >= planned && planned > 0}
        <p class="text-[11px] text-text4">{S.plannedReached}</p>
      {/if}
    </div>
  {/if}

  {#if shown && thread}
    <SequenceThread
      turns={thread.turns}
      label={S.threadLabel(probeName)}
      loading={thread.loading}
      error={thread.error}
    />
  {/if}

  {#if pending === 'turn' || pending === 'drop'}
    <p class="flex items-center gap-2 text-xs text-text3" role="status">
      <Loader2 class="h-3.5 w-3.5 animate-spin text-accentText" aria-hidden="true" />
      {pending === 'turn' ? S.stepping : S.dropping}
    </p>
  {/if}

  {#if dropped && isInteractive(seq) && !stepping}
    <p class="flex items-center gap-2 text-xs text-text2" data-testid="sequence-probe-result">
      {S.probeResult}
      <ClassBadge value={dropped} size="sm" />
    </p>
  {/if}

  <footer class="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
    {#if stepping}
      <button
        type="button"
        class={BTN.secondary}
        title={S.nextTurnWhy}
        disabled={busy}
        onclick={() => void sequences.nextTurn(seq)}
        data-testid="sequence-next-turn"
      >
        <StepForward class="h-3.5 w-3.5" aria-hidden="true" />
        {S.nextTurn}
      </button>
      <button
        type="button"
        class={BTN.primary}
        title={S.dropProbeWhy}
        disabled={busy}
        onclick={() => void sequences.dropProbe(seq)}
        data-testid="sequence-drop-probe"
      >
        <Target class="h-3.5 w-3.5" aria-hidden="true" />
        {S.dropProbe}
      </button>
    {/if}
    {#if canRunAll(seq) && !busy}
      <button
        type="button"
        class={ran ? BTN.secondary : BTN.primary}
        title={ran ? S.runAgainWhy : S.runAllWhy}
        onclick={() => void sequences.runAll(seq, probeName)}
        data-testid="sequence-run-all"
      >
        <Play class="h-3.5 w-3.5" aria-hidden="true" />
        {ran ? S.runAgain : S.runAll}
      </button>
      <button
        type="button"
        class={BTN.secondary}
        title={S.whittleWhy}
        onclick={() => void sequences.whittle(seq, probeName)}
        data-testid="sequence-whittle-button"
      >
        <Scissors class="h-3.5 w-3.5" aria-hidden="true" />
        {S.whittle}
      </button>
    {/if}
    {#if hasResults(seq) && !busy}
      <button
        type="button"
        class={BTN.ghost}
        title={S.showResultsWhy}
        onclick={() => sequences.showResults(id)}
        data-testid="sequence-show-results"
      >
        <BarChart3 class="h-3.5 w-3.5" aria-hidden="true" />
        {S.showResults}
        <ArrowRight class="h-3 w-3" aria-hidden="true" />
      </button>
    {/if}
    {#if !stepping && seq.status !== 'pending'}
      <button
        type="button"
        class={BTN.ghost}
        aria-expanded={shown}
        onclick={toggleThread}
        data-testid="sequence-thread-toggle"
      >
        {#if shown}
          <ChevronsDown class="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
          {S.hideThread}
        {:else}
          <ListOrdered class="h-3.5 w-3.5" aria-hidden="true" />
          {S.showThread}
        {/if}
      </button>
    {/if}
    <div class="ml-auto flex flex-wrap items-start gap-2">
      <SequenceExport sequenceId={id} />
      <ConfirmButton
        label={S.deleteSequence}
        confirmLabel={S.deleteConfirm}
        danger
        disabled={busy}
        onConfirm={() => sequences.remove(seq)}
      />
    </div>
  </footer>
</li>
