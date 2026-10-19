<!--
  The Python step's progress card (brief 9.8): the stage label and the
  shell's message, a bar that fills by stage (or by `progress` inside one),
  downloaded bytes when the shell reports them, and a "Show the log"
  disclosure with the `bootstrap:log` lines.
-->
<script lang="ts">
  import { LoaderCircle, CheckCircle2 } from 'lucide-svelte';
  import { WELCOME } from '$lib/copy/onboarding';
  import { fmtBytes, stageLabel, stagePercent } from './bootstrap';

  interface Props {
    stage: string;
    message: string;
    progress: number;
    bytesDownloaded?: number | null;
    bytesTotal?: number | null;
    log: readonly string[];
  }

  let {
    stage,
    message,
    progress,
    bytesDownloaded = null,
    bytesTotal = null,
    log,
  }: Props = $props();

  const pct = $derived(stagePercent(stage, progress));
  const done = $derived(stage === 'ready');
</script>

<div
  class="rounded-xl border border-border bg-bg/60 p-5"
  role="status"
  aria-live="polite"
  data-testid="bootstrap-progress"
  data-stage={stage}
>
  <div class="flex items-start gap-3">
    {#if done}
      <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden="true" />
    {:else}
      <LoaderCircle
        class="mt-0.5 h-5 w-5 shrink-0 animate-spin text-accentText"
        aria-hidden="true"
      />
    {/if}
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium text-text" data-testid="bootstrap-stage">{stageLabel(stage)}</p>
      {#if message}
        <p class="mt-0.5 truncate font-mono text-[11px] text-text4" title={message}>{message}</p>
      {/if}
    </div>
    <span class="font-mono text-xs tabular-nums text-text3">{pct}%</span>
  </div>

  <div
    class="mt-4 h-1.5 overflow-hidden rounded-full bg-surface2"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={pct}
    aria-label={stageLabel(stage)}
  >
    <div
      class="h-full rounded-full bg-accent shadow-[0_0_12px_rgb(var(--accent)/0.6)] transition-[width] duration-500 ease-out"
      style:width={`${pct}%`}
    ></div>
  </div>

  {#if bytesTotal}
    <p class="mt-2 font-mono text-[11px] text-text4">
      {fmtBytes(bytesDownloaded ?? 0)} / {fmtBytes(bytesTotal)}
    </p>
  {/if}

  <details class="mt-4">
    <summary class="cursor-pointer text-xs text-text3 hover:text-text2">{WELCOME.showLog}</summary>
    <pre
      class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-bg p-3 font-mono text-[11px] leading-relaxed text-text3"
      data-testid="bootstrap-log">{log.length ? log.join('\n') : WELCOME.logEmpty}</pre>
  </details>
</div>
