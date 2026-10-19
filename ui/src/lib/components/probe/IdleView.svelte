<!--
  Idle (brief 7.1): the session's system prompt when it has one (first 400
  characters, "Show all"), then "Run every probe" and "Save a baseline".

  The batch run itself is BatchRun.svelte (T18): the "Run every probe" panel
  renders only when `onRunAll` is passed. "Save a baseline…" opens
  SaveBaselineDialog (T28); when the session has baselines the panel also
  links to Baselines ("Compare with a baseline"). Without a session the panel
  only links to Baselines.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { Plus } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import SaveBaselineDialog from '$lib/components/dialogs/SaveBaselineDialog.svelte';
  import { BASELINES_ROUTE } from '$lib/components/studies/baselines';
  import { baselines } from '$lib/components/studies/baseline-store.svelte';
  import { PROBE } from '$lib/copy/probe';
  import { SCREENS } from '$lib/copy/screens';
  import { session } from '$lib/stores/session.svelte';
  import ActionButton from './ActionButton.svelte';
  import { FIELD, LABEL } from './styles';

  interface Props {
    systemPrompt: string | null;
    probeCount: number;
    /** Starts the batch run (T18). */
    onRunAll?: (delayMs: number) => void;
  }

  let { systemPrompt, probeCount, onRunAll }: Props = $props();

  const uid = $props.id();
  const SHORT = 400;
  let showAll = $state(false);
  let delay = $state(2000);

  const prompt = $derived((systemPrompt ?? '').trim());
  const long = $derived(prompt.length > SHORT);
  const shown = $derived(long && !showAll ? `${prompt.slice(0, SHORT)}…` : prompt);

  const sessionId = $derived(session.current?.id ?? null);
  const baselinesReady = $derived(sessionId !== null && baselines.readyFor(sessionId));
  const hasBaselines = $derived(baselinesReady && baselines.list.length > 0);
  let saveOpen = $state(false);

  // Whether to offer "Compare with a baseline" (brief 7.1): this session's list.
  $effect(() => {
    const id = sessionId;
    if (id === null) return;
    untrack(() => void baselines.load(id));
  });

  const link =
    'text-xs text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline';
</script>

<div class="flex flex-col gap-4" data-testid="probe-idle">
  {#if prompt}
    <Panel title={PROBE.systemPrompt} readout={PROBE.systemPromptWhy}>
      <pre
        class="max-h-80 overflow-y-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-text2">{shown}</pre>
      {#if long}
        <button type="button" class="self-start {link}" onclick={() => (showAll = !showAll)}>
          {showAll ? PROBE.showLess : PROBE.showAll}
        </button>
      {/if}
    </Panel>
  {/if}

  <div class="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-2">
    {#if onRunAll}
      <Panel title={PROBE.runAllTitle} readout={SCREENS['probe.runAll'](probeCount)}>
        <div class="max-w-[14rem]">
          <label for="delay-{uid}" class={LABEL}>{PROBE.runAllDelay}</label>
          <input
            id="delay-{uid}"
            type="number"
            min="0"
            max="60000"
            step="100"
            bind:value={delay}
            class={FIELD}
          />
        </div>
        <ActionButton
          variant="primary"
          label={PROBE.runAll(probeCount)}
          why={PROBE.runAllWhy}
          disabled={probeCount === 0}
          onclick={() => onRunAll?.(Math.min(60000, Math.max(0, Number(delay) || 0)))}
        />
      </Panel>
    {/if}
    <Panel title={PROBE.baselineTitle} readout={SCREENS['probe.baseline']}>
      {#if sessionId !== null}
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ActionButton
            label={PROBE.baselineSave}
            why={PROBE.baselineSaveWhy}
            testid="probe-save-baseline"
            onclick={() => (saveOpen = true)}
          >
            {#snippet icon()}
              <Plus class="h-3.5 w-3.5" aria-hidden="true" />
            {/snippet}
          </ActionButton>
          {#if hasBaselines}
            <a href={BASELINES_ROUTE} class={link} data-testid="probe-compare-baseline"
              >{PROBE.baselineCompare}</a
            >
          {/if}
        </div>
      {:else}
        <a href={BASELINES_ROUTE} class="self-start {link}">{PROBE.baselineOpen}</a>
      {/if}
    </Panel>
  </div>
</div>

{#if sessionId !== null}
  <SaveBaselineDialog open={saveOpen} {sessionId} onClose={() => (saveOpen = false)} />
{/if}
