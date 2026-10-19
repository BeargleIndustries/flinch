<!--
  Browse, one session (brief 9.1 `/data/browse/sessions/[id]`, 9.9 Findings).
  GET /api/sessions/{id} and GET /api/sessions/{id}/export/summary: a header
  card (name, model, created date, "{total_runs} runs", the outcome bar from
  stats.outcome_classifications, a domain table with Runs, R, X, N, C), then
  "Expand all" and "Collapse all" over one collapsible row per run (the first
  80 characters of the probe text and the outcome badge). Expanded: the probe
  text, the first response with its badge, the pushback with its source, the
  final response with its badge, and, past two turns, the whole conversation
  from GET /api/runs/{id}/turns. "Open in Probe" makes the session current and
  opens /probe/runs/{id}. The header exports the session (JSON, CSV), makes it
  current, or deletes it after a confirm. The Findings panel lists GET
  /api/sessions/{id}/findings.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import {
    ArrowLeft,
    ArrowUpRight,
    ChevronDown,
    ChevronsDownUp,
    ChevronsUpDown,
  } from 'lucide-svelte';
  import { ApiError, pathFor } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import type { RunTurn, SessionDetail as SessionDetailReply, SessionRun } from '$lib/api/types';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ClassBar from '$lib/components/ClassBar.svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import { CLASSES } from '$lib/cls';
  import { SESSION_DETAIL as D } from '$lib/copy/data';
  import { friendlyError } from '$lib/errors';
  import { formatDate } from '$lib/format';
  import { session } from '$lib/stores/session.svelte';
  import { status } from '$lib/stores/status.svelte';
  import { BTN } from '../probe/styles';
  import {
    BROWSE_ROUTE,
    domainRows,
    pushbackSource,
    runHref,
    runOutcome,
    runPreview,
    showConversation,
    toClsCounts,
    type Finding,
    type SessionSummary,
  } from './browse';
  import { browse, readFindings, readRunTurns, readSession } from './browse-store.svelte';
  import SaveButton from './SaveButton.svelte';

  interface Props {
    sessionId: number;
  }

  let { sessionId }: Props = $props();

  const uid = $props.id();

  let loading = $state(true);
  let missing = $state(false);
  let error = $state<string | null>(null);
  let detail = $state<SessionDetailReply | null>(null);
  let summary = $state<SessionSummary | null>(null);

  let findings = $state<Finding[] | null>(null);
  let findingsError = $state<string | null>(null);

  let expanded = $state<Set<number>>(new Set());
  let turns = $state<Record<number, { loading: boolean; list: RunTurn[]; error: string | null }>>(
    {},
  );
  let removing = $state(false);

  async function load(id: number) {
    loading = true;
    missing = false;
    error = null;
    try {
      const got = await readSession(id);
      detail = got.detail;
      summary = got.summary;
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
    try {
      findings = await readFindings(id);
      findingsError = null;
    } catch (e) {
      if (!missing) findingsError = friendlyError(e).message;
      findings = [];
    }
  }

  $effect(() => {
    const id = sessionId;
    untrack(() => void load(id));
  });

  const runs = $derived<SessionRun[]>(detail?.runs ?? []);
  const outcomes = $derived(toClsCounts(summary?.stats?.outcome_classifications));
  const domains = $derived(domainRows(summary?.domain_breakdown));
  const totalRuns = $derived(summary?.total_runs ?? runs.length);
  const name = $derived(detail?.name ?? summary?.session.name ?? '');
  const model = $derived(detail?.target_model ?? summary?.session.target_model ?? '');
  const isCurrent = $derived(session.current?.id === sessionId);

  async function loadTurns(runId: number) {
    if (turns[runId]?.list.length || turns[runId]?.loading) return;
    turns = { ...turns, [runId]: { loading: true, list: [], error: null } };
    try {
      const list = await readRunTurns(runId);
      turns = { ...turns, [runId]: { loading: false, list, error: null } };
    } catch (e) {
      turns = { ...turns, [runId]: { loading: false, list: [], error: friendlyError(e).message } };
    }
  }

  function toggle(runId: number) {
    const next = new Set(expanded);
    if (next.has(runId)) next.delete(runId);
    else {
      next.add(runId);
      void loadTurns(runId);
    }
    expanded = next;
  }

  function expandAll() {
    expanded = new Set(runs.map((r) => r.id));
    for (const r of runs) void loadTurns(r.id);
  }

  function collapseAll() {
    expanded = new Set();
  }

  async function makeCurrent() {
    if (!session.list.some((s) => s.id === sessionId)) await session.load();
    session.select(sessionId);
  }

  async function openInProbe(runId: number) {
    await makeCurrent();
    await goto(runHref(runId));
  }

  async function remove() {
    removing = true;
    try {
      if (await browse.removeSession(sessionId)) await goto(BROWSE_ROUTE);
    } finally {
      removing = false;
    }
  }

  const SOURCE_TONE: Record<string, string> = {
    coach: 'border-accent/40 text-accentText',
    override: 'border-warn/40 text-warn',
    skip: 'border-border text-text4',
  };

  const TEXT =
    'max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border/70 bg-bg/60 px-3 py-2 text-[13px] leading-relaxed text-text2';
  const STEP = 'text-[10px] font-semibold uppercase tracking-widest text-text4';
</script>

<section class="flex max-w-[1040px] flex-col gap-4 pb-6" data-testid="session-detail">
  <a
    href={BROWSE_ROUTE}
    class="inline-flex w-fit items-center gap-1 text-xs text-text3 transition-colors hover:text-text"
  >
    <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
    {D.back}
  </a>

  {#if loading && !detail}
    <p class="text-xs text-text4" aria-busy="true">{D.loading}</p>
  {:else if missing}
    <div class="rounded-lg border border-dashed border-border" data-testid="session-missing">
      <EmptyState title={D.notFound} body="" />
    </div>
  {:else if error && !detail}
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-danger">{error}</p>
      <button type="button" class={BTN.secondary} onclick={() => load(sessionId)}>
        {D.loadAgain}
      </button>
    </div>
  {:else if detail}
    <!-- Header card -->
    <section
      class="relative overflow-hidden rounded-lg border border-border bg-surface"
      aria-labelledby="session-title-{uid}"
      data-testid="session-header"
      data-session-id={sessionId}
    >
      <span
        class="absolute inset-y-0 left-0 w-0.5 {isCurrent ? 'bg-accent' : 'bg-borderStrong'}"
        aria-hidden="true"
      ></span>
      <div class="flex flex-wrap items-start justify-between gap-4 p-4 pl-5">
        <div class="min-w-0">
          <p class="text-[10px] font-medium uppercase tracking-widest text-text4">{D.eyebrow}</p>
          <h1
            id="session-title-{uid}"
            class="truncate text-lg font-semibold text-text"
            data-testid="session-name"
          >
            {name}
          </h1>
          <p
            class="mt-1 flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] tabular-nums text-text4"
          >
            <span class="text-text3">{model}</span>
            <span aria-hidden="true">·</span>
            <span>{D.created(formatDate(detail.created_at))}</span>
            <span aria-hidden="true">·</span>
            <span data-testid="session-run-total">{D.runs(totalRuns)}</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class={BTN.secondary}
            title={D.makeCurrentWhy}
            disabled={isCurrent}
            onclick={async () => {
              await makeCurrent();
              await goto('/probe');
            }}
            data-testid="session-make-current"
          >
            {D.makeCurrent}
          </button>
          <SaveButton
            path={pathFor(ROUTES.exportSession, {
              params: { session_id: sessionId },
              query: { format: 'json' },
            })}
            label={D.downloadJson}
            fallbackName="flinch-session-{sessionId}.json"
            tone="outline"
          />
          <SaveButton
            path={pathFor(ROUTES.exportSession, {
              params: { session_id: sessionId },
              query: { format: 'csv' },
            })}
            label={D.downloadCsv}
            fallbackName="flinch-session-{sessionId}.csv"
            tone="outline"
          />
          <span data-testid="session-delete">
            <ConfirmButton
              label={D.remove}
              confirmLabel={D.removeConfirm}
              danger
              disabled={removing}
              onConfirm={remove}
              class="px-3 py-1.5"
            />
          </span>
        </div>
      </div>

      <div
        class="grid gap-4 border-t border-border p-4 pl-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
      >
        <div class="flex flex-col gap-2">
          <p class={STEP}>{D.outcomes}</p>
          <ClassBar counts={outcomes} />
        </div>
        {#if domains.length > 0}
          <div class="min-w-0">
            <p class="{STEP} mb-1">{D.domainsTitle}</p>
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-left text-xs" data-testid="session-domains">
                <thead>
                  <tr
                    class="border-b border-border text-[10px] uppercase tracking-widest text-text4"
                  >
                    <th scope="col" class="py-1.5 pr-3 font-medium">{D.domainColumn}</th>
                    <th scope="col" class="w-px px-2 py-1.5 text-right font-medium"
                      >{D.runsColumn}</th
                    >
                    {#each CLASSES as c (c)}
                      <th scope="col" class="w-px px-2 py-1.5 text-right font-medium">
                        <span class="inline-flex justify-end"
                          ><ClassBadge value={c} size="sm" glyphOnly /></span
                        >
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each domains as d (d.domain)}
                    <tr class="border-b border-border/60 last:border-b-0">
                      <td
                        class="max-w-[14rem] truncate py-1.5 pr-3 font-mono text-[12px] text-text2"
                      >
                        {d.domain || D.noDomain}
                      </td>
                      <td class="px-2 py-1.5 text-right font-mono tabular-nums text-text"
                        >{d.total}</td
                      >
                      {#each CLASSES as c (c)}
                        <td
                          class="px-2 py-1.5 text-right font-mono tabular-nums {d[c]
                            ? 'text-text2'
                            : 'text-text4'}">{d[c]}</td
                        >
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>
    </section>

    <!-- Runs -->
    <Panel eyebrow={D.runsEyebrow} title={D.runsTitle} readout={D.runsReadout} anchor="browse-runs">
      {#snippet actions()}
        {#if runs.length > 0}
          <button type="button" class="{BTN.ghost} px-2 py-1" onclick={expandAll}>
            <ChevronsUpDown class="h-3.5 w-3.5" aria-hidden="true" />
            {D.expandAll}
          </button>
          <button type="button" class="{BTN.ghost} px-2 py-1" onclick={collapseAll}>
            <ChevronsDownUp class="h-3.5 w-3.5" aria-hidden="true" />
            {D.collapseAll}
          </button>
        {/if}
      {/snippet}

      {#if runs.length === 0}
        <div class="rounded-lg border border-dashed border-border" data-testid="session-runs-empty">
          <EmptyState title={D.noRunsTitle} body={D.noRunsBody} />
        </div>
      {:else}
        <ol class="flex flex-col divide-y divide-border/70" data-testid="session-runs">
          {#each runs as r, i (r.id)}
            {@const open = expanded.has(r.id)}
            {@const outcome = runOutcome(r)}
            {@const src = pushbackSource(r.pushback_source)}
            {@const t = turns[r.id]}
            <li
              data-testid="session-run"
              data-run-id={r.id}
              data-outcome={outcome}
              in:fly={{ y: 6, duration: 160, delay: Math.min(i, 10) * 20 }}
            >
              <button
                type="button"
                class="group flex w-full items-center gap-3 py-2.5 text-left focus:outline-none focus-visible:bg-surface2"
                aria-expanded={open}
                aria-controls="run-body-{uid}-{r.id}"
                onclick={() => toggle(r.id)}
                data-testid="session-run-toggle"
              >
                <span class="w-8 shrink-0 font-mono text-[11px] tabular-nums text-text4"
                  >{i + 1}</span
                >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13px] text-text2 group-hover:text-text"
                    >{runPreview(r.probe_text)}</span
                  >
                  <span class="block truncate font-mono text-[11px] text-text4">{r.probe_name}</span
                  >
                </span>
                <span data-testid="session-run-badge"><ClassBadge value={outcome} size="sm" /></span
                >
                <ChevronDown
                  class="h-3.5 w-3.5 shrink-0 text-text4 transition-transform {open
                    ? 'rotate-180'
                    : ''}"
                  aria-hidden="true"
                />
              </button>

              {#if open}
                <div
                  id="run-body-{uid}-{r.id}"
                  class="mb-3 ml-11 flex flex-col gap-3 border-l border-border pl-4"
                  transition:slide={{ duration: 160 }}
                  data-testid="session-run-body"
                >
                  <div class="flex flex-col gap-1">
                    <p class={STEP}>{D.probe}</p>
                    <div class={TEXT}>{r.probe_text}</div>
                  </div>

                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                      <p class={STEP}>{D.firstResponse}</p>
                      <ClassBadge value={r.initial_classification} size="sm" />
                    </div>
                    <div class={TEXT}>{r.initial_response || D.noResponse}</div>
                  </div>

                  {#if src || r.pushback_text}
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <p class={STEP}>{D.pushback}</p>
                        {#if src}
                          <span
                            class="rounded border px-1 py-px text-[10px] font-medium {SOURCE_TONE[
                              src
                            ] ?? 'border-border text-text3'}"
                            data-testid="session-run-source">{D.sources[src] ?? src}</span
                          >
                        {/if}
                      </div>
                      {#if r.pushback_text}
                        <div class={TEXT}>{r.pushback_text}</div>
                      {/if}
                    </div>
                  {/if}

                  {#if r.final_response || r.final_classification}
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <p class={STEP}>{D.finalResponse}</p>
                        <ClassBadge value={r.final_classification} size="sm" />
                      </div>
                      <div class={TEXT}>{r.final_response || D.noResponse}</div>
                    </div>
                  {/if}

                  {#if t?.loading}
                    <p class="text-[11px] text-text4">{D.conversationLoading}</p>
                  {:else if t?.error}
                    <p class="text-[11px] text-danger">{t.error}</p>
                  {:else if t && showConversation(t.list.length)}
                    <div class="flex flex-col gap-1.5" data-testid="session-run-conversation">
                      <p class={STEP}>{D.conversation}</p>
                      <ol class="flex flex-col gap-1.5">
                        {#each t.list as turn (turn.id)}
                          <li class="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-2">
                            <span
                              class="pt-0.5 font-mono text-[10px] uppercase tracking-wider text-text4"
                              >{D.roles[turn.role] ?? turn.role}</span
                            >
                            <span
                              class="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text2"
                              >{turn.content}</span
                            >
                            {#if turn.classification}
                              <ClassBadge value={turn.classification} size="sm" glyphOnly />
                            {/if}
                          </li>
                        {/each}
                      </ol>
                    </div>
                  {/if}

                  <div>
                    <button
                      type="button"
                      class="{BTN.secondary} py-1"
                      title={D.openInProbeWhy}
                      onclick={() => openInProbe(r.id)}
                      data-testid="session-run-open"
                    >
                      {D.openInProbe}
                      <ArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    </Panel>

    <!-- Findings (brief 9.9) -->
    <Panel
      eyebrow={D.findingsEyebrow}
      title={D.findingsTitle}
      readout={D.findingsReadout}
      anchor="browse-findings"
    >
      <div data-testid="session-findings" aria-busy={findings === null}>
        {#if findings === null}
          <p class="text-xs text-text4">{D.findingsLoading}</p>
        {:else if findingsError}
          <p class="text-sm text-danger">{findingsError}</p>
        {:else if findings.length === 0}
          <p class="text-xs text-text4" data-testid="session-findings-empty">{D.findingsEmpty}</p>
        {:else}
          <ul class="flex flex-col gap-2">
            {#each findings as f (f.id)}
              <li
                class="rounded-md border border-border/70 bg-bg/40 px-3 py-2"
                data-testid="session-finding"
                data-run-id={f.run_id}
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="truncate font-mono text-[11px] text-text3">{f.probe_name}</span>
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1 text-[11px] text-accentText hover:underline focus:outline-none focus-visible:underline"
                    onclick={() => openInProbe(f.run_id)}
                  >
                    {D.openRun}
                    <ArrowUpRight class="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
                <p
                  class="mt-1 text-sm leading-relaxed text-text"
                  data-testid="session-finding-text"
                >
                  {f.finding}
                </p>
                {#if f.pattern_tags.length > 0}
                  <div class="mt-1.5 flex flex-wrap gap-1">
                    {#each f.pattern_tags as tag (tag)}
                      <span
                        class="rounded border border-borderStrong bg-surface2 px-1.5 py-px font-mono text-[10px] text-text3"
                        >{tag}</span
                      >
                    {/each}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </Panel>
  {/if}
</section>
