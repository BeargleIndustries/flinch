<!--
  Idle (brief 7.1): the session's system prompt when it has one (first 400
  characters, "Show all"), then "Run every probe" and "Save a baseline".

  The batch run itself is T18's BatchRun.svelte: the "Run every probe" panel
  renders only when `onRunAll` is passed. The baseline dialog is T28's; until
  then the panel links to Baselines.
-->
<script lang="ts">
  import Panel from '$lib/components/Panel.svelte';
  import { PROBE } from '$lib/copy/probe';
  import { SCREENS } from '$lib/copy/screens';
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
      <a href="/studies/baselines" class="self-start {link}">{PROBE.baselineOpen}</a>
    </Panel>
  </div>
</div>
