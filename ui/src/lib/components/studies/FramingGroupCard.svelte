<!--
  One framing group (brief 8.1): title, description, a numbered chip per
  framing label, the domain and probe count; "Run in this session", "View"
  (label and prompt text from the file, or label and probe name for a group
  without a file) and "Delete this group".
-->
<script lang="ts">
  import { slide } from 'svelte/transition';
  import { ChevronDown, FileText, Play } from 'lucide-svelte';
  import type { VariantFileDetail } from '$lib/api/types';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import { FRAMINGS } from '$lib/copy/studies';
  import { BTN, HINT } from '../probe/styles';
  import type { FramingGroup, ProbeGroup } from './framings';
  import { framings } from './framings.svelte';

  interface Props {
    group: FramingGroup;
    /** False while a batch runs in this session or there is no session. */
    canRun: boolean;
    onRun: (group: FramingGroup) => void;
  }

  let { group, canRun, onRun }: Props = $props();

  const uid = $props.id();
  let open = $state(false);
  let detail = $state<VariantFileDetail | null>(null);
  let dbDetail = $state<ProbeGroup | null>(null);
  let loading = $state(false);
  let failed = $state<string | null>(null);

  const count = $derived(group.probeIds.length);
  const rows = $derived(dbDetail?.variants ?? []);
  const busy = $derived(framings.deleting === group.groupId);

  async function toggle() {
    open = !open;
    if (!open || detail || dbDetail) return;
    loading = true;
    failed = null;
    try {
      if (group.kind === 'file') detail = await framings.detail(group.groupId);
      else dbDetail = await framings.groupDetail(group.groupId);
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  const pad = (i: number) => String(i + 1).padStart(2, '0');
</script>

<article
  data-testid="framing-group"
  data-group-id={group.groupId}
  data-kind={group.kind}
  class="group/card relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface p-4 transition-[border-color,opacity] duration-200 hover:border-borderStrong"
  class:opacity-50={busy}
  aria-labelledby="fg-{uid}"
>
  <!-- A spine of framing ticks down the left edge: one per framing. -->
  <span
    class="pointer-events-none absolute inset-y-3 left-0 flex w-[3px] flex-col gap-[3px]"
    aria-hidden="true"
  >
    {#each group.labels as label, i (i + label)}
      <span class="flex-1 rounded-r-sm bg-accent/25 group-hover/card:bg-accent/50"></span>
    {/each}
  </span>

  <header class="flex flex-wrap items-start justify-between gap-3">
    <div class="min-w-0">
      <p
        class="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-text4"
      >
        {#if group.kind === 'file'}<FileText class="h-3 w-3" aria-hidden="true" />{/if}
        <span data-testid="framing-group-count">{FRAMINGS.probeCount(count)}</span>
        {#if group.domain}
          <span aria-hidden="true">/</span>
          <span class="font-mono normal-case tracking-normal">{group.domain}</span>
        {/if}
      </p>
      <h3 id="fg-{uid}" class="mt-0.5 truncate text-sm font-semibold text-text">
        {group.title}
      </h3>
      {#if group.title !== group.groupId}
        <p class="font-mono text-[11px] text-text4">{group.groupId}</p>
      {/if}
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <button
        type="button"
        class={BTN.primary}
        disabled={!canRun || count === 0}
        title={count === 0 ? FRAMINGS.notSyncedWhy : FRAMINGS.runGroupWhy}
        onclick={() => onRun(group)}
      >
        <Play class="h-3.5 w-3.5" aria-hidden="true" />
        {FRAMINGS.runGroup}
      </button>
      <button
        type="button"
        class={BTN.secondary}
        aria-expanded={open}
        aria-controls="fg-view-{uid}"
        onclick={toggle}
      >
        {open ? FRAMINGS.hide : FRAMINGS.view}
        <ChevronDown
          class="h-3.5 w-3.5 transition-transform duration-200 {open ? 'rotate-180' : ''}"
          aria-hidden="true"
        />
      </button>
      <ConfirmButton
        label={FRAMINGS.deleteGroup}
        confirmLabel={FRAMINGS.deleteConfirm}
        danger
        disabled={busy}
        class="py-1.5"
        onConfirm={() => framings.remove(group)}
      />
    </div>
  </header>

  {#if group.description}
    <p class="max-w-[68ch] text-xs leading-relaxed text-text3">{group.description}</p>
  {/if}

  <ul class="flex flex-wrap gap-1.5" aria-label={FRAMINGS.colLabel}>
    {#each group.labels as label, i (i + label)}
      <li
        class="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg/60 py-0.5 pl-1 pr-2 text-[11px] text-text2"
      >
        <span class="font-mono text-[10px] tabular-nums text-accentText">{pad(i)}</span>
        {label}
      </li>
    {/each}
  </ul>

  {#if count === 0}
    <p class={HINT}>{FRAMINGS.notSynced}</p>
  {/if}

  {#if open}
    <div id="fg-view-{uid}" transition:slide={{ duration: 180 }} data-testid="framing-group-view">
      {#if loading}
        <p class="text-xs text-text3">{FRAMINGS.viewLoading}</p>
      {:else if failed}
        <p class="text-xs text-danger" role="alert">{failed}</p>
      {:else if group.kind === 'file' && detail}
        <dl
          class="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-[minmax(8rem,12rem)_1fr]"
        >
          {#each detail.variants as v, i (i + v.label)}
            <dt
              class="flex items-start gap-2 bg-surface2/40 px-3 py-2 text-xs font-medium text-text2"
            >
              <span class="font-mono text-[10px] tabular-nums text-accentText">{pad(i)}</span>
              {v.label}
            </dt>
            <dd
              class="whitespace-pre-wrap bg-bg/40 px-3 py-2 font-mono text-[12px] leading-relaxed text-text2"
            >
              {v.prompt_text}
            </dd>
          {/each}
        </dl>
        <p class="mt-2 break-all {HINT}">{FRAMINGS.savedAs(detail.source_file)}</p>
      {:else}
        <dl
          class="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-[minmax(8rem,12rem)_1fr]"
        >
          {#each rows as v, i (v.probe_id)}
            <dt
              class="flex items-start gap-2 bg-surface2/40 px-3 py-2 text-xs font-medium text-text2"
            >
              <span class="font-mono text-[10px] tabular-nums text-accentText">{pad(i)}</span>
              {v.variant_label}
            </dt>
            <dd class="bg-bg/40 px-3 py-2 font-mono text-[12px] text-text2">{v.probe_name}</dd>
          {/each}
        </dl>
      {/if}
    </div>
  {/if}
</article>
