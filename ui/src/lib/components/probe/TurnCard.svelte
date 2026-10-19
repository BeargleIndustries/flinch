<!--
  One turn of the thread (brief 7.5), on a timeline dot in its class colour
  (pushbacks use the accent). Handles both role vocabularies through
  thread.ts: Probe runs (probe, response, pushback) and Model compare runs
  (user, assistant).

  A response shows "Response" or "Response after pushback" and a ClassBadge;
  the first and the latest responses' badges correct the run's
  classification, earlier responses after pushback are read-only. Its text
  is split into blocks by formatResponse (never parsed as HTML) and
  collapses after 800 characters. A pushback shows "Your pushback" in
  monospace on an accent rule.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import type { Run } from '$lib/api/types';
  import { toCls } from '$lib/cls';
  import { PROBE } from '$lib/copy/probe';
  import { formatResponse, truncate } from '$lib/format';
  import { COLLAPSE_AT, badgeField, badgeValue, type ThreadItem } from './thread';
  import { DOT } from './styles';

  interface Props {
    item: ThreadItem;
    run: Run | null;
    onCorrect?: (value: string) => void;
    /** Shown under the card (the first response's readout). */
    after?: Snippet;
  }

  let { item, run, onCorrect, after }: Props = $props();

  let expanded = $state(false);

  const isResponse = $derived(item.kind === 'response');
  const value = $derived(isResponse ? badgeValue(item, run) : null);
  const cls = $derived(toCls(value));
  const editable = $derived(isResponse && badgeField(item) !== null && !!onCorrect);
  const text = $derived(item.turn.content ?? '');
  const long = $derived(text.length > COLLAPSE_AT);
  const blocks = $derived(formatResponse(long && !expanded ? truncate(text, COLLAPSE_AT) : text));
  const eyebrow = $derived(
    item.kind === 'pushback'
      ? PROBE.yourPushback
      : item.first
        ? PROBE.response
        : PROBE.responseAfter,
  );
</script>

<li
  class="group/turn relative pb-4 pl-7 last:pb-0"
  data-testid="turn-card"
  data-kind={item.kind}
  data-cls={isResponse ? cls : undefined}
>
  <!-- The timeline rail runs through every dot but stops at the last card. -->
  <span
    class="absolute -bottom-[13px] left-[6px] top-[26px] w-px bg-borderStrong group-last/turn:hidden"
    aria-hidden="true"
  ></span>
  <span
    class="absolute left-0 top-[13px] h-[13px] w-[13px] rounded-full ring-4 ring-bg {DOT[
      isResponse ? cls : 'pushback'
    ]}"
    aria-hidden="true"
  ></span>

  <article
    class="rounded-lg border bg-surface px-4 py-3 {isResponse
      ? 'border-border'
      : 'border-accent/30 bg-accentSoft/10'}"
  >
    <header class="mb-2 flex items-center justify-between gap-3">
      <p class="text-[10px] font-medium uppercase tracking-widest text-text4">{eyebrow}</p>
      {#if isResponse}
        {#if editable}
          <span class="flex items-center gap-2">
            <span class="hidden text-[11px] text-text4 sm:inline">{PROBE.badgeWhy}</span>
            <ClassBadge {value} onChange={(next) => onCorrect?.(next)} />
          </span>
        {:else}
          <ClassBadge {value} />
        {/if}
      {/if}
    </header>

    {#if isResponse}
      {#if text.trim() === ''}
        <p class="text-sm italic text-text4">{PROBE.emptyResponse}</p>
      {:else}
        <div class="flex flex-col gap-2 text-sm leading-relaxed text-text2">
          {#each blocks as block, i (i)}
            {#if block.type === 'ul'}
              <ul class="list-disc space-y-1 pl-5">
                {#each block.lines as line, j (j)}<li>{line}</li>{/each}
              </ul>
            {:else if block.type === 'ol'}
              <ol class="list-decimal space-y-1 pl-5">
                {#each block.lines as line, j (j)}<li>{line}</li>{/each}
              </ol>
            {:else if block.type === 'quote'}
              <blockquote
                class="whitespace-pre-line border-l-2 border-borderStrong pl-3 text-text3"
              >
                {block.lines.join('\n')}
              </blockquote>
            {:else if block.type === 'code'}
              <pre
                class="overflow-x-auto rounded-md bg-bg px-3 py-2 font-mono text-[12px] text-text2">{block.lines.join(
                  '\n',
                )}</pre>
            {:else}
              <p class="whitespace-pre-line">{block.lines.join('\n')}</p>
            {/if}
          {/each}
        </div>
        {#if long}
          <button
            type="button"
            class="mt-2 text-xs text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
            aria-expanded={expanded}
            onclick={() => (expanded = !expanded)}
          >
            {expanded ? PROBE.showLessText : PROBE.showMore}
          </button>
        {/if}
      {/if}
    {:else}
      <p
        class="whitespace-pre-line border-l-2 border-accent pl-3 font-mono text-[13px] leading-relaxed text-text"
      >
        {text}
      </p>
    {/if}
  </article>

  {#if after}
    <div class="mt-2">{@render after()}</div>
  {/if}
</li>
