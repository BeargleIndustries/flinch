<!--
  Baselines (brief 8.6, D16; formerly Snapshots): opens with its research
  question; "No session yet" while none is picked. The session's baselines,
  newest first: name, description, date, probe count and the badges each
  holds, with "Show saved results" (9.9), "Compare with now" and "Delete this
  baseline". "Save a baseline…" opens SaveBaselineDialog. The compare form
  holds a baseline against now (the sidecar's diff) or against a second
  baseline; the result is a summary ("N changed, M unchanged"), the counts by
  status (counted here from changes[].status, plan Appendix C item 39), the
  brief's readout, and one row per probe with its before and after badges,
  sorted regressed, improved, changed, unchanged.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { ArrowRight, ChevronDown, GitCompareArrows, Plus, X } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import Readout from '$lib/components/Readout.svelte';
  import SaveBaselineDialog from '$lib/components/dialogs/SaveBaselineDialog.svelte';
  import NoSession from '$lib/components/shell/NoSession.svelte';
  import { CLS_ORDER } from '$lib/cls';
  import { SCREENS } from '$lib/copy/screens';
  import { BASELINES } from '$lib/copy/studies';
  import { formatDate } from '$lib/format';
  import { session } from '$lib/stores/session.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import {
    STATUS_ORDER,
    baselineTally,
    countStatuses,
    latestByProbe,
    parseTarget,
    sortChanges,
    targetValue,
    type CompareTarget,
    type DiffStatus,
  } from './baselines';
  import { baselines } from './baseline-store.svelte';

  const uid = $props.id();

  const sessionId = $derived(session.current?.id ?? null);
  const noSession = $derived(session.loaded && !session.current);
  const ready = $derived(sessionId !== null && baselines.readyFor(sessionId));
  const list = $derived(ready ? baselines.list : []);

  // The list follows the current session; each visit reads it again.
  $effect(() => {
    const id = sessionId;
    if (id === null) return;
    untrack(() => void baselines.load(id));
  });

  let saveOpen = $state(false);

  // ── Show saved results ─────────────────────────────────────────────
  let shown = $state<Set<number>>(new Set());
  function toggleShown(id: number) {
    const next = new Set(shown);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    shown = next;
  }

  // ── Compare form ───────────────────────────────────────────────────
  let beforePick = $state<number | null>(null);
  let afterPick = $state<string>('now');

  const ids = $derived(new Set(list.map((b) => b.id)));
  const before = $derived<number | null>(
    beforePick !== null && ids.has(beforePick) ? beforePick : (list[0]?.id ?? null),
  );
  const after = $derived.by<CompareTarget>(() => {
    const t = parseTarget(afterPick);
    return t === 'now' || (t !== null && ids.has(t)) ? t : 'now';
  });
  const problem = $derived(
    list.length === 0 ? BASELINES.needTwo : before === after ? BASELINES.sameBaseline : null,
  );
  const comparing = $derived(baselines.diff?.loading === true);

  let diffEl: HTMLElement | null = $state(null);

  async function compareWith(b: number, a: CompareTarget) {
    if (sessionId === null) return;
    beforePick = b;
    afterPick = targetValue(a);
    await baselines.compare(sessionId, b, a);
    await tick();
    diffEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function runCompare() {
    if (problem || before === null || comparing) return;
    void compareWith(before, after);
  }

  // ── The diff ───────────────────────────────────────────────────────
  const nameOf = (id: number) => list.find((b) => b.id === id)?.name ?? `#${id}`;
  const diff = $derived(baselines.diff);
  const result = $derived(diff?.result ?? null);
  const counts = $derived(result ? countStatuses(result.changes) : null);
  const rows = $derived(result ? sortChanges(result.changes) : []);
  const afterLabel = $derived(
    diff ? (diff.after === 'now' ? BASELINES.nowColumn : nameOf(diff.after)) : '',
  );

  const STATUS_WORD: Record<DiffStatus, string> = {
    improved: BASELINES.improved,
    regressed: BASELINES.regressed,
    changed: BASELINES.changed,
    unchanged: BASELINES.unchanged,
  };
  const STATUS_TEXT: Record<DiffStatus, string> = {
    improved: 'text-ok',
    regressed: 'text-danger',
    changed: 'text-warn',
    unchanged: 'text-text4',
  };
  const STATUS_PILL: Record<DiffStatus, string> = {
    improved: 'border-ok/40 bg-ok/10 text-ok',
    regressed: 'border-danger/40 bg-danger/10 text-danger',
    changed: 'border-warn/40 bg-warn/10 text-warn',
    unchanged: 'border-border bg-transparent text-text4',
  };
  const STATUS_BAR: Record<DiffStatus, string> = {
    improved: 'bg-ok',
    regressed: 'bg-danger',
    changed: 'bg-warn',
    unchanged: 'bg-borderStrong',
  };
  const STATUS_RULE: Record<DiffStatus, string> = {
    improved: 'before:bg-ok',
    regressed: 'before:bg-danger',
    changed: 'before:bg-warn',
    unchanged: 'before:bg-transparent',
  };
</script>

{#snippet badge(value: string)}
  {#if value}
    <ClassBadge {value} size="sm" />
  {:else}
    <span class="text-[11px] text-text4">{BASELINES.notRun}</span>
  {/if}
{/snippet}

<section class="flex max-w-[1040px] flex-col gap-4 pb-6" data-testid="baselines-screen">
  <header>
    <h1 class="text-base font-semibold text-text">{BASELINES.title}</h1>
    <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS.baselines}
    </p>
  </header>

  {#if noSession}
    <div class="rounded-xl border border-dashed border-border"><NoSession /></div>
  {:else if sessionId !== null}
    {#key sessionId}
      <Panel
        eyebrow={BASELINES.listEyebrow}
        title={BASELINES.listTitle}
        readout={BASELINES.listReadout}
        anchor="baselines"
      >
        {#snippet actions()}
          {#if list.length > 0}
            <span class="font-mono text-[11px] tabular-nums text-text4"
              >{BASELINES.count(list.length)}</span
            >
          {/if}
          <button
            type="button"
            class={BTN.primary}
            title={BASELINES.saveWhy}
            disabled={!ready}
            onclick={() => (saveOpen = true)}
            data-testid="save-baseline"
          >
            <Plus class="h-3.5 w-3.5" aria-hidden="true" />
            {BASELINES.save}
          </button>
        {/snippet}

        <div data-testid="baselines-list" aria-busy={!ready}>
          {#if !ready && !baselines.error}
            <p class="text-xs text-text4">{BASELINES.loading}</p>
          {:else if baselines.error && list.length === 0}
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-danger">{baselines.error}</p>
              <button
                type="button"
                class={BTN.secondary}
                onclick={() => sessionId !== null && baselines.load(sessionId)}
              >
                {BASELINES.loadAgain}
              </button>
            </div>
          {:else if list.length === 0}
            <div
              class="rounded-lg border border-dashed border-border"
              data-testid="baselines-empty"
            >
              <EmptyState title={BASELINES.emptyTitle} body={BASELINES.emptyBody} />
            </div>
          {:else}
            <ul class="flex flex-col divide-y divide-border">
              {#each list as b, i (b.id)}
                {@const d = baselines.details[b.id]}
                {@const tally = d?.detail ? baselineTally(d.detail.rows) : null}
                {@const open = shown.has(b.id)}
                <li
                  class="flex flex-col gap-3 py-3 first:pt-0 last:pb-0"
                  data-testid="baseline-row"
                  data-baseline-id={b.id}
                  data-baseline-name={b.name}
                  in:fly={{ y: 6, duration: 180, delay: Math.min(i, 8) * 25 }}
                  out:slide={{ duration: 160 }}
                >
                  <div
                    class="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <div class="flex min-w-0 flex-col gap-1">
                      <span
                        class="truncate text-sm font-medium text-text"
                        data-testid="baseline-row-name">{b.name}</span
                      >
                      {#if b.description}
                        <p class="line-clamp-2 text-xs leading-relaxed text-text3">
                          {b.description}
                        </p>
                      {/if}
                      <span class="font-mono text-[11px] tabular-nums text-text4">
                        {#if tally}{BASELINES.probeCount(tally.probes)} ·
                        {/if}{formatDate(b.created_at)}
                      </span>
                    </div>

                    <div
                      class="flex min-h-5 flex-wrap items-center gap-2"
                      data-testid="baseline-tally"
                      aria-label={BASELINES.tallyLabel(b.name)}
                    >
                      {#if tally}
                        {#each CLS_ORDER as c (c)}
                          {#if tally.counts[c]}
                            <span class="inline-flex items-center gap-1" data-tally-cls={c}>
                              <ClassBadge value={c} size="sm" glyphOnly />
                              <span class="font-mono text-[11px] tabular-nums text-text3"
                                >{BASELINES.tallyCount(tally.counts[c] ?? 0)}</span
                              >
                            </span>
                          {/if}
                        {/each}
                      {:else if d?.error}
                        <span class="text-[11px] text-danger">{d.error}</span>
                      {:else}
                        <span class="text-[11px] text-text4">{BASELINES.detailLoading}</span>
                      {/if}
                    </div>

                    <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        class={BTN.ghost}
                        aria-expanded={open}
                        aria-controls="baseline-rows-{uid}-{b.id}"
                        onclick={() => toggleShown(b.id)}
                        data-testid="baseline-show"
                      >
                        <ChevronDown
                          class="h-3.5 w-3.5 transition-transform {open ? 'rotate-180' : ''}"
                          aria-hidden="true"
                        />
                        {open ? BASELINES.hide : BASELINES.show}
                      </button>
                      <button
                        type="button"
                        class={BTN.secondary}
                        title={BASELINES.compareNowWhy}
                        disabled={comparing}
                        onclick={() => compareWith(b.id, 'now')}
                        data-testid="baseline-compare-now"
                      >
                        {BASELINES.compareNow}
                        <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <ConfirmButton
                        label={BASELINES.remove}
                        confirmLabel={BASELINES.removeConfirm}
                        danger
                        disabled={baselines.removing.has(b.id)}
                        onConfirm={() => baselines.remove(b.id).then(() => undefined)}
                      />
                    </div>
                  </div>

                  {#if open}
                    <div
                      id="baseline-rows-{uid}-{b.id}"
                      class="rounded-md border border-border bg-bg/60"
                      transition:slide={{ duration: 160 }}
                      data-testid="baseline-saved-rows"
                    >
                      {#if d?.detail}
                        {@const saved = latestByProbe(d.detail.rows)}
                        {#if saved.length === 0}
                          <p class="px-3 py-2 text-xs text-text4">{BASELINES.noRows}</p>
                        {:else}
                          <ul aria-label={BASELINES.savedRows(b.name)}>
                            {#each saved as r (r.probe_id)}
                              <li
                                class="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-1.5 last:border-b-0"
                                data-testid="baseline-saved-row"
                              >
                                <span class="truncate font-mono text-[12px] text-text2"
                                  >{r.probe_name}</span
                                >
                                <ClassBadge
                                  value={r.final_classification || r.initial_classification}
                                  size="sm"
                                />
                              </li>
                            {/each}
                          </ul>
                        {/if}
                      {:else if d?.error}
                        <p class="px-3 py-2 text-xs text-danger">{d.error}</p>
                      {:else}
                        <p class="px-3 py-2 text-xs text-text4">{BASELINES.detailLoading}</p>
                      {/if}
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </Panel>

      <div bind:this={diffEl}>
        <Panel
          eyebrow={BASELINES.compareEyebrow}
          title={BASELINES.compareTitle}
          readout={BASELINES.compareReadout}
          anchor="baselines-compare"
        >
          <form
            class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
            onsubmit={(e) => {
              e.preventDefault();
              runCompare();
            }}
            data-testid="baselines-compare-form"
          >
            <div class="min-w-0">
              <label for="cmp-before-{uid}" class={LABEL}>{BASELINES.before}</label>
              <select
                id="cmp-before-{uid}"
                class={FIELD}
                disabled={!ready || list.length === 0}
                value={before === null ? '' : String(before)}
                onchange={(e) => (beforePick = Number(e.currentTarget.value))}
                data-testid="compare-before"
              >
                {#each list as b (b.id)}
                  <option value={String(b.id)}>{b.name} · {formatDate(b.created_at)}</option>
                {/each}
              </select>
            </div>
            <span class="hidden pb-2 text-text4 sm:block" aria-hidden="true">
              <ArrowRight class="h-4 w-4" />
            </span>
            <div class="min-w-0">
              <label for="cmp-after-{uid}" class={LABEL}>{BASELINES.after}</label>
              <select
                id="cmp-after-{uid}"
                class={FIELD}
                disabled={!ready || list.length === 0}
                value={targetValue(after)}
                onchange={(e) => (afterPick = e.currentTarget.value)}
                data-testid="compare-after"
              >
                <option value="now">{BASELINES.now}</option>
                {#each list as b (b.id)}
                  <option value={String(b.id)}>{b.name} · {formatDate(b.created_at)}</option>
                {/each}
              </select>
            </div>
            <button
              type="submit"
              class={BTN.primary}
              disabled={!ready || problem !== null || comparing}
              data-testid="compare-run"
            >
              <GitCompareArrows class="h-3.5 w-3.5" aria-hidden="true" />
              {comparing ? BASELINES.comparing : BASELINES.run}
            </button>
          </form>
          {#if ready && problem}
            <p class={HINT} data-testid="compare-problem">{problem}</p>
          {/if}

          {#if diff}
            <div
              class="flex flex-col gap-3 border-t border-border pt-4"
              data-testid="baseline-diff"
              data-before={diff.before}
              data-after={targetValue(diff.after)}
              aria-busy={diff.loading}
              transition:slide={{ duration: 180 }}
            >
              <div class="flex items-start justify-between gap-3">
                <h3 class="min-w-0 truncate text-xs font-medium text-text2">
                  {BASELINES.diffTitle(
                    nameOf(diff.before),
                    diff.after === 'now' ? BASELINES.nowLabel : nameOf(diff.after),
                  )}
                </h3>
                <button
                  type="button"
                  class="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-text3 hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
                  aria-label={BASELINES.close}
                  onclick={() => baselines.closeDiff()}
                >
                  <X class="h-4 w-4" />
                </button>
              </div>

              {#if diff.loading}
                <p class="text-xs text-text4">{BASELINES.comparing}</p>
              {:else if diff.error}
                <p class="text-sm text-danger" role="alert">{diff.error}</p>
              {:else if result && counts}
                <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                  <p
                    class="font-mono text-lg font-semibold tabular-nums text-text"
                    data-testid="diff-summary"
                  >
                    {BASELINES.summary(result.changed_count, result.unchanged_count)}
                  </p>
                  <dl class="flex flex-wrap gap-x-5 gap-y-2">
                    {#each STATUS_ORDER as s (s)}
                      <div class="flex flex-col" data-testid="diff-count" data-status={s}>
                        <dt class="text-[10px] font-medium uppercase tracking-widest text-text4">
                          {STATUS_WORD[s]}
                        </dt>
                        <dd
                          class="font-mono text-sm font-semibold tabular-nums {counts[s] > 0
                            ? STATUS_TEXT[s]
                            : 'text-text4'}"
                        >
                          {counts[s]}
                        </dd>
                      </div>
                    {/each}
                  </dl>
                </div>
                {#if result.changes.length > 0}
                  <div
                    class="flex h-1.5 overflow-hidden rounded-full bg-surface2"
                    aria-hidden="true"
                  >
                    {#each STATUS_ORDER as s (s)}
                      {#if counts[s] > 0}
                        <span
                          class="h-full {STATUS_BAR[s]} transition-[width] duration-300 ease-out"
                          style:width="{(counts[s] / result.changes.length) * 100}%"
                        ></span>
                      {/if}
                    {/each}
                  </div>
                {/if}
                <Readout text={SCREENS['baselines.diff'](counts)} />

                {#if rows.length === 0}
                  <p class="text-xs text-text4">{BASELINES.noChanges}</p>
                {:else}
                  <div class="overflow-x-auto">
                    <table class="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr
                          class="border-b border-border text-[10px] uppercase tracking-widest text-text4"
                        >
                          <th scope="col" class="py-2 pl-3 pr-3 font-medium">
                            {BASELINES.probeColumn}
                          </th>
                          <th scope="col" class="w-px whitespace-nowrap px-3 py-2 font-medium">
                            {BASELINES.baselineColumn}
                          </th>
                          <th scope="col" class="w-px px-0 py-2" aria-hidden="true"></th>
                          <th
                            scope="col"
                            class="w-px max-w-[12rem] truncate whitespace-nowrap px-3 py-2 font-medium"
                          >
                            {afterLabel}
                          </th>
                          <th scope="col" class="w-px whitespace-nowrap py-2 pl-3 pr-3 font-medium"
                            >{BASELINES.statusColumn}</th
                          >
                        </tr>
                      </thead>
                      <tbody>
                        {#each rows as r (r.probe_id)}
                          <tr
                            class="border-b border-border/60 last:border-b-0 {r.status ===
                            'unchanged'
                              ? 'text-text3'
                              : 'text-text'}"
                            data-testid="diff-row"
                            data-probe-name={r.probe_name}
                            data-status={r.status}
                            data-old={r.old_classification}
                            data-new={r.new_classification}
                          >
                            <td
                              class="relative max-w-[18rem] truncate py-2 pl-3 pr-3 font-mono text-[12px] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full {STATUS_RULE[
                                r.status
                              ]}"
                            >
                              {r.probe_name}
                            </td>
                            <td class="px-3 py-2" data-testid="diff-old">
                              {@render badge(r.old_classification)}
                            </td>
                            <td class="px-0 py-2 text-text4" aria-hidden="true">
                              <ArrowRight class="h-3 w-3" />
                            </td>
                            <td class="px-3 py-2" data-testid="diff-new">
                              {@render badge(r.new_classification)}
                            </td>
                            <td class="py-2 pl-3">
                              <span
                                class="inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium {STATUS_PILL[
                                  r.status
                                ]}"
                                data-testid="diff-status">{STATUS_WORD[r.status]}</span
                              >
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              {/if}
            </div>
          {/if}
        </Panel>
      </div>

      <SaveBaselineDialog open={saveOpen} {sessionId} onClose={() => (saveOpen = false)} />
    {/key}
  {/if}
</section>
