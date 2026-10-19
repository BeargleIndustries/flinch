<!--
  One probe in the rail (brief 6.2 item 6). Name, then the first 60 characters
  of the prompt in mono; chips after the name for a framing group and for a
  narrative probe ("IF"). On the right, the newest run's outcome as a glyph
  badge with the probe's run count in this session, and on hover a trash icon
  that turns into "Delete?" for 4 s; the second click deletes. In select mode
  a checkbox leads the row and clicking the row toggles it.
-->
<script lang="ts">
  import { Trash2 } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import { RAIL } from '$lib/copy/rail';
  import {
    hasNarrative,
    preview,
    type FramingChip,
    type ProbeStat,
    type RailProbe,
  } from '$lib/stores/probe-list';

  interface Props {
    probe: RailProbe;
    active: boolean;
    chip?: FramingChip;
    stat?: ProbeStat;
    selecting: boolean;
    checked: boolean;
    /** The first row carries the tour anchor (brief 6.2, A.3). */
    first?: boolean;
    onPick: () => void;
    onToggle: () => void;
    onDelete: () => Promise<boolean>;
  }

  let {
    probe,
    active,
    chip,
    stat,
    selecting,
    checked,
    first = false,
    onPick,
    onToggle,
    onDelete,
  }: Props = $props();

  const ARM_MS = 4000;
  let armed = $state(false);
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function disarm() {
    armed = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function trash() {
    if (busy) return;
    if (!armed) {
      armed = true;
      timer = setTimeout(disarm, ARM_MS);
      return;
    }
    disarm();
    busy = true;
    try {
      await onDelete();
    } finally {
      busy = false;
    }
  }

  function onTrashKey(e: KeyboardEvent) {
    if (armed && e.key === 'Escape') {
      e.stopPropagation();
      disarm();
    }
  }

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });

  const narrative = $derived(hasNarrative(probe));
</script>

<li
  class="group relative flex items-stretch border-l-2 transition-colors {active
    ? 'border-accent bg-accentSoft/15'
    : 'border-transparent hover:bg-surface2/60'}"
  data-testid="probe-row"
  data-probe-name={probe.name}
>
  {#if selecting}
    <label class="flex shrink-0 cursor-pointer items-start pl-2.5 pt-2">
      <input
        type="checkbox"
        {checked}
        onchange={onToggle}
        aria-label={RAIL.selectProbe(probe.name)}
        class="h-3.5 w-3.5 accent-accent"
      />
    </label>
  {/if}
  <button
    type="button"
    onclick={selecting ? onToggle : onPick}
    aria-current={active ? 'true' : undefined}
    data-probe-id={probe.id}
    data-tour={first ? 'probe-row' : undefined}
    class="min-w-0 flex-1 py-1.5 pr-1 text-left focus:outline-none focus-visible:bg-surface2 {selecting
      ? 'pl-2'
      : 'pl-2.5'}"
  >
    <span class="flex min-w-0 items-center gap-1.5">
      <span class="truncate text-[13px] {active ? 'text-accentText' : 'text-text2'}"
        >{probe.name}</span
      >
      {#if chip}
        <span
          class="shrink-0 whitespace-nowrap rounded border border-border px-1 text-[10px] leading-4 text-text3"
          title={RAIL.framingTitle(chip.groupId)}
          data-testid="framing-chip">{RAIL.framingChip(chip.label)}</span
        >
      {/if}
      {#if narrative}
        <span
          class="shrink-0 rounded-sm bg-accentSoft/40 px-1 font-mono text-[10px] font-semibold leading-4 tracking-wide text-accentText"
          title={RAIL.ifTitle}
          data-testid="if-chip">{RAIL.ifChip}</span
        >
      {/if}
    </span>
    <span class="mt-0.5 block truncate font-mono text-[11px] leading-4 text-text4"
      >{preview(probe.prompt_text)}</span
    >
  </button>
  <span class="flex shrink-0 items-start gap-1 pr-2 pt-1.5">
    {#if stat && !armed}
      <span
        class="inline-flex items-center gap-1 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
        title={RAIL.runsTitle(stat.runs)}
        data-testid="probe-stat"
      >
        <ClassBadge value={stat.last} size="sm" glyphOnly />
        <span class="font-mono text-[10px] tabular-nums text-text4">{stat.runs}</span>
      </span>
    {/if}
    {#if !selecting}
      <button
        type="button"
        onclick={trash}
        onkeydown={onTrashKey}
        onblur={disarm}
        disabled={busy}
        aria-label={armed ? RAIL.deleteArmed : RAIL.deleteProbe}
        data-armed={armed}
        class="absolute right-2 top-1.5 rounded px-1 text-[11px] font-medium transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover {armed
          ? 'bg-danger text-white opacity-100'
          : 'text-text4 opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100'}"
      >
        {#if armed}{RAIL.deleteArmed}{:else}<Trash2 class="h-3.5 w-3.5" aria-hidden="true" />{/if}
      </button>
    {/if}
  </span>
</li>
