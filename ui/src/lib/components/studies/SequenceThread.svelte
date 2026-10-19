<!--
  A sequence's transcript (brief 8.4): the coach's warmup and setup turns, the
  probe as delivered inside the story, and the model's reply under each with
  its badge. A spine down the left marks each turn's type (W, S, P); the
  probe turn sits on an accent rail so the moment the probe drops stands out.
-->
<script lang="ts">
  import { fly } from 'svelte/transition';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import { SEQUENCES as S } from '$lib/copy/studies';
  import { buildThread, type SequenceTurn } from './sequences';

  interface Props {
    turns: SequenceTurn[];
    label: string;
    loading?: boolean;
    error?: string | null;
  }

  let { turns, label, loading = false, error = null }: Props = $props();

  const thread = $derived(buildThread(turns));

  const MARK: Record<string, string> = {
    warmup: 'border-borderStrong bg-surface2 text-text3',
    setup: 'border-warn/50 bg-warn/10 text-warn',
    probe: 'border-accent bg-accent text-white',
  };
  const LETTER: Record<string, string> = { warmup: 'W', setup: 'S', probe: 'P' };
</script>

<div class="flex flex-col gap-2" data-testid="sequence-thread">
  {#if thread.length === 0}
    <p class="text-xs text-text4" data-testid="thread-empty">
      {loading ? S.threadLoading : S.threadEmpty}
    </p>
  {:else}
    <ol class="relative flex flex-col" aria-label={label}>
      <span
        class="absolute bottom-3 left-[11px] top-3 w-px bg-gradient-to-b from-border via-borderStrong to-accent/60"
        aria-hidden="true"
      ></span>
      {#each thread as t (t.key)}
        {@const model = t.role === 'target'}
        <li
          class="relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 py-1.5"
          in:fly={{ y: 6, duration: 180 }}
          data-testid="thread-turn"
          data-role={t.role}
          data-turn-type={t.turnType}
          data-cls={t.cls ?? ''}
        >
          {#if model}
            <span class="relative z-[1] mx-auto mt-2 h-1.5 w-1.5 rounded-full bg-borderStrong"
            ></span>
          {:else}
            <span
              class="relative z-[1] mt-1 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] font-semibold {MARK[
                t.turnType
              ]}"
              title={S.turnTypes[t.turnType]}
              aria-hidden="true">{LETTER[t.turnType]}</span
            >
          {/if}
          <div
            class="min-w-0 rounded-md border px-3 py-2 {model
              ? 'border-border bg-bg/40'
              : t.turnType === 'probe'
                ? 'border-accent/50 bg-accent/5 shadow-[inset_2px_0_0_0_rgb(var(--accent))]'
                : 'border-border bg-surface2/40'}"
          >
            <div class="mb-1 flex flex-wrap items-center gap-2">
              <span
                class="text-[10px] font-semibold uppercase tracking-[0.1em] {model
                  ? 'text-text4'
                  : 'text-text3'}">{S.roles[t.role]}</span
              >
              {#if !model}
                <span
                  class="rounded border border-border px-1 py-px font-mono text-[10px] text-text3"
                  data-testid="turn-type-chip"
                  >{t.turnType === 'warmup' && t.warmup !== null
                    ? S.warmupN(t.warmup)
                    : S.turnTypes[t.turnType]}</span
                >
              {/if}
              {#if model}
                <span class="ml-auto" data-testid="turn-badge">
                  <ClassBadge value={t.cls} size={t.turnType === 'probe' ? 'md' : 'sm'} />
                </span>
              {/if}
            </div>
            <p
              class="whitespace-pre-wrap break-words text-[13px] leading-relaxed {model
                ? 'text-text2'
                : 'font-mono text-[12px] text-text'}"
            >
              {t.content || S.noReply}
            </p>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
  {#if error}
    <p class="text-xs text-danger" role="alert">{error}</p>
  {/if}
</div>
