<!--
  Groups tab list (brief 8.1): the batch panel while a group runs in this
  session, "Run every group" (every probe across every framing group,
  deduplicated, one batch), the framings files, then "Groups without a file".
-->
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { PlayCircle } from 'lucide-svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { FRAMINGS } from '$lib/copy/studies';
  import { session } from '$lib/stores/session.svelte';
  import { batch } from '../probe/batch.svelte';
  import { BTN, HINT } from '../probe/styles';
  import FramingGroupCard from './FramingGroupCard.svelte';
  import FramingRun from './FramingRun.svelte';
  import type { FramingGroup } from './framings';
  import { framings } from './framings.svelte';

  interface Props {
    onResults: () => void;
  }

  let { onResults }: Props = $props();

  const sessionId = $derived(session.current?.id ?? null);
  const running = $derived(batch.live && batch.sessionId === sessionId);
  const canRun = $derived(sessionId !== null && !running);
  const lists = $derived(framings.lists);
  const total = $derived(lists.files.length + lists.dbOnly.length);

  function runGroup(group: FramingGroup) {
    if (sessionId === null) return;
    void framings.run(sessionId, group.probeIds, FRAMINGS.runningGroup(group.groupId));
  }

  function runEvery() {
    if (sessionId === null) return;
    void framings.run(sessionId, framings.everyId, FRAMINGS.runningEvery);
  }
</script>

<div class="flex flex-col gap-4" data-testid="framing-groups">
  {#if batch.shownFor(sessionId)}
    <FramingRun {onResults} />
  {/if}

  {#if framings.loaded && total === 0}
    <div class="rounded-xl border border-dashed border-border" data-testid="framings-empty">
      <EmptyState title={FRAMINGS.emptyTitle} body={FRAMINGS.emptyBody} />
    </div>
  {:else if total > 0}
    <div class="flex flex-wrap items-end justify-between gap-3">
      <p class="text-[10px] font-medium uppercase tracking-widest text-text4">
        {FRAMINGS.groupsEyebrow}
        <span class="ml-1 font-mono tabular-nums text-text3">{FRAMINGS.groupsCount(total)}</span>
      </p>
      <div class="flex flex-col items-end gap-1">
        <button
          type="button"
          class={BTN.secondary}
          disabled={!canRun || framings.everyId.length === 0}
          onclick={runEvery}
        >
          <PlayCircle class="h-3.5 w-3.5" aria-hidden="true" />
          {FRAMINGS.runEvery(framings.everyId.length)}
        </button>
        <span class={HINT}>{FRAMINGS.runEveryWhy}</span>
      </div>
    </div>

    <ul class="flex flex-col gap-3">
      {#each lists.files as group (group.groupId)}
        <li in:fly={{ y: 6, duration: 180 }}>
          <FramingGroupCard {group} {canRun} onRun={runGroup} />
        </li>
      {/each}
    </ul>

    {#if lists.dbOnly.length > 0}
      <p class="mt-2 text-[10px] font-medium uppercase tracking-widest text-text4">
        {FRAMINGS.dbOnlyEyebrow}
      </p>
      <ul class="flex flex-col gap-3">
        {#each lists.dbOnly as group (group.groupId)}
          <li in:fly={{ y: 6, duration: 180 }}>
            <FramingGroupCard {group} {canRun} onRun={runGroup} />
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>
