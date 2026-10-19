<!--
  Browse, one sequence (brief 9.1 `/data/browse/sequences/[id]`). The header
  (probe, strategy, model, status, warmup setting, mode, session, date) is GET
  /api/sequences/{id} with names from the Browse store's lists; the export
  menu is the Sequences one (JSON, CSV, web page, PDF); "Delete this
  sequence" confirms first. Then the Runs panel of 8.4: one row per run
  (warmup turns sent, the probe's badge, threshold), and the picked run's
  thread from GET /api/sequence-runs/{id}/turns drawn by SequenceThread.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft, Flag } from 'lucide-svelte';
  import { ApiError } from '$lib/api/client';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import StatusChip from '$lib/components/StatusChip.svelte';
  import { BROWSE, SEQUENCE_DETAIL as D } from '$lib/copy/data';
  import { friendlyError } from '$lib/errors';
  import { formatDate } from '$lib/format';
  import { session } from '$lib/stores/session.svelte';
  import { status } from '$lib/stores/status.svelte';
  import { BTN } from '../probe/styles';
  import { isFound, orderedRuns } from '../studies/sequence-results';
  import SequenceExport from '../studies/SequenceExport.svelte';
  import SequenceThread from '../studies/SequenceThread.svelte';
  import { latestRun, type SequenceSummary, type SequenceTurn } from '../studies/sequences';
  import { BROWSE_ROUTE, sessionHref } from './browse';
  import { browse, readSequence, readSequenceTurns } from './browse-store.svelte';

  interface Props {
    sequenceId: number;
  }

  let { sequenceId }: Props = $props();

  const uid = $props.id();

  let loading = $state(true);
  let missing = $state(false);
  let error = $state<string | null>(null);
  let seq = $state<SequenceSummary | null>(null);

  let picked = $state<number | null>(null);
  let turns = $state<SequenceTurn[]>([]);
  let turnsLoading = $state(false);
  let turnsError = $state<string | null>(null);
  let turnsToken = 0;
  let removing = $state(false);

  async function load(id: number) {
    loading = true;
    missing = false;
    error = null;
    try {
      seq = await readSequence(id);
      picked = latestRun(seq.runs ?? [])?.id ?? null;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) missing = true;
      else {
        const f = friendlyError(e);
        status.error(f.message, f.details);
        error = f.message;
      }
    } finally {
      loading = false;
    }
  }

  async function loadTurns(runId: number) {
    const token = ++turnsToken;
    turnsLoading = true;
    turnsError = null;
    turns = [];
    try {
      const list = await readSequenceTurns(runId);
      if (token === turnsToken) turns = list;
    } catch (e) {
      if (token === turnsToken) turnsError = friendlyError(e).message;
    } finally {
      if (token === turnsToken) turnsLoading = false;
    }
  }

  $effect(() => {
    const id = sequenceId;
    untrack(() => {
      void load(id);
      // Names for the header come from Browse's lists.
      if (!browse.loaded) void browse.load();
    });
  });

  $effect(() => {
    const run = picked;
    if (run === null) return;
    untrack(() => void loadTurns(run));
  });

  const runs = $derived(orderedRuns(seq?.runs ?? []));
  const row = $derived(browse.sequences.find((s) => s.id === sequenceId) ?? null);
  const probeName = $derived(
    seq ? (browse.probeNames[seq.probe_id] ?? BROWSE.unknownProbe(seq.probe_id)) : '',
  );
  const strategyName = $derived(
    seq ? (browse.strategyNames[seq.strategy_id] ?? BROWSE.unknownStrategy(seq.strategy_id)) : '',
  );
  const owner = $derived(seq ? session.all.find((s) => s.id === seq!.session_id) : undefined);
  const sessionName = $derived(
    row?.session_name ?? owner?.name ?? (seq ? BROWSE.unknownSession(seq.session_id) : ''),
  );
  const model = $derived(row?.target_model ?? owner?.target_model ?? '');
  const pickedIndex = $derived(runs.findIndex((r) => r.id === picked));

  async function remove() {
    removing = true;
    try {
      if (await browse.removeSequence(sequenceId)) await goto(BROWSE_ROUTE);
    } finally {
      removing = false;
    }
  }

  const DT = 'text-[10px] font-medium uppercase tracking-widest text-text4';
  const DD = 'mt-0.5 truncate text-[13px] text-text';
</script>

<section class="flex max-w-[1040px] flex-col gap-4 pb-6" data-testid="sequence-detail">
  <a
    href={BROWSE_ROUTE}
    class="inline-flex w-fit items-center gap-1 text-xs text-text3 transition-colors hover:text-text"
  >
    <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
    {D.back}
  </a>

  {#if loading && !seq}
    <p class="text-xs text-text4" aria-busy="true">{D.loading}</p>
  {:else if missing}
    <div class="rounded-lg border border-dashed border-border" data-testid="sequence-missing">
      <EmptyState title={D.notFound} body="" />
    </div>
  {:else if error && !seq}
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-danger">{error}</p>
      <button type="button" class={BTN.secondary} onclick={() => load(sequenceId)}>
        {D.loadAgain}
      </button>
    </div>
  {:else if seq}
    <section
      class="rounded-lg border border-border bg-surface"
      aria-labelledby="sequence-title-{uid}"
      data-testid="sequence-header"
      data-status={seq.status}
      data-warmup={seq.max_warmup_turns}
    >
      <div class="flex flex-wrap items-start justify-between gap-4 p-4">
        <div class="min-w-0">
          <p class="text-[10px] font-medium uppercase tracking-widest text-text4">{D.eyebrow}</p>
          <h1 id="sequence-title-{uid}" class="truncate text-lg font-semibold text-text">
            {D.title(probeName)}
          </h1>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <SequenceExport {sequenceId} />
          <ConfirmButton
            label={D.remove}
            confirmLabel={D.removeConfirm}
            danger
            disabled={removing}
            onConfirm={remove}
            class="px-3 py-1.5"
          />
        </div>
      </div>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border p-4 sm:grid-cols-4">
        <div class="min-w-0">
          <dt class={DT}>{D.strategy}</dt>
          <dd class={DD}>{strategyName}</dd>
        </div>
        <div class="min-w-0">
          <dt class={DT}>{D.model}</dt>
          <dd class="{DD} font-mono text-[12px]">{model}</dd>
        </div>
        <div class="min-w-0">
          <dt class={DT}>{D.status}</dt>
          <dd class="mt-1" data-testid="sequence-status"><StatusChip status={seq.status} /></dd>
        </div>
        <div class="min-w-0">
          <dt class={DT}>{D.warmup}</dt>
          <dd class="{DD} font-mono tabular-nums" data-testid="sequence-warmup">
            {D.warmupValue(seq.max_warmup_turns)}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class={DT}>{D.mode}</dt>
          <dd class={DD}>{D.modes[seq.mode] ?? seq.mode}</dd>
        </div>
        <div class="min-w-0">
          <dt class={DT}>{D.session}</dt>
          <dd class={DD}>
            <a
              href={sessionHref(seq.session_id)}
              class="text-accentText underline-offset-4 hover:underline">{sessionName}</a
            >
          </dd>
        </div>
        <div class="min-w-0">
          <dt class={DT}>{D.date}</dt>
          <dd class="{DD} font-mono text-[12px] tabular-nums">{formatDate(seq.created_at)}</dd>
        </div>
      </dl>
    </section>

    <Panel
      eyebrow={D.runsEyebrow}
      title={D.runsTitle}
      readout={D.runsReadout}
      anchor="browse-sequence-runs"
    >
      {#if runs.length === 0}
        <p class="text-xs text-text4" data-testid="sequence-runs-empty">{D.runsEmpty}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)]">
          <ol class="flex flex-col gap-1" aria-label={D.runsTitle} data-testid="sequence-runs">
            {#each runs as r, i (r.id)}
              {@const on = r.id === picked}
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover {on
                    ? 'border-accent/60 bg-accentSoft'
                    : 'border-border hover:border-borderStrong hover:bg-surface2'}"
                  aria-pressed={on}
                  onclick={() => (picked = r.id)}
                  data-testid="sequence-run"
                  data-run-id={r.id}
                >
                  <span class="font-mono text-[11px] tabular-nums text-text4">{i + 1}</span>
                  <span class="min-w-0 flex-1 truncate text-xs text-text2"
                    >{D.runRow(r.warmup_count)}</span
                  >
                  {#if isFound(r.threshold_found)}
                    <span title={D.threshold} class="text-warn">
                      <Flag class="h-3 w-3" aria-label={D.threshold} />
                    </span>
                  {/if}
                  {#if r.probe_classification}
                    <ClassBadge value={r.probe_classification} size="sm" />
                  {:else}
                    <span class="text-[10px] text-text4">{D.noProbeYet}</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ol>
          <div class="min-w-0 rounded-md border border-border/70 bg-bg/40 p-3">
            {#if turnsError}
              <p class="text-sm text-danger">{turnsError}</p>
            {:else}
              <SequenceThread
                {turns}
                label={D.threadLabel(pickedIndex + 1)}
                loading={turnsLoading}
              />
            {/if}
          </div>
        </div>
      {/if}
    </Panel>
  {/if}
</section>
