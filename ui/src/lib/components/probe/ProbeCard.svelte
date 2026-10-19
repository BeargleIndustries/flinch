<!--
  The probe card (brief 7.2): eyebrow "Probe", the probe's name, its domain
  and tag chips, the prompt in monospace, and the narrative blocks when set.
  A saved run whose probe is not in this session's rail (a Model compare
  run) shows the text it was opened with instead.
-->
<script lang="ts">
  import Panel from '$lib/components/Panel.svelte';
  import type { Probe } from '$lib/api/types';
  import { PROBE } from '$lib/copy/probe';

  interface Props {
    probe: Probe | null;
    /** The opening turn's text, for a run whose probe is not listed. */
    fallbackText?: string | null;
  }

  let { probe, fallbackText = null }: Props = $props();

  const chip = 'rounded border border-border bg-surface2 px-1.5 py-px text-[11px] text-text3';
  const block = 'whitespace-pre-line font-mono text-[13px] leading-relaxed text-text';
</script>

<div data-tour="probe-card" data-testid="probe-card" data-probe-id={probe?.id}>
  <Panel eyebrow={PROBE.cardEyebrow} title={probe?.name ?? PROBE.cardEyebrow}>
    {#snippet actions()}
      {#if probe?.domain}<span class={chip}>{probe.domain}</span>{/if}
      {#each [...new Set(probe?.tags ?? [])] as tag (tag)}
        <span class="{chip} text-text4">#{tag}</span>
      {/each}
    {/snippet}
    <p class={block}>{probe?.prompt_text ?? fallbackText ?? ''}</p>
    {#if probe?.narrative_opening}
      <div class="border-l-2 border-borderStrong pl-3">
        <p class="mb-1 text-[10px] font-medium uppercase tracking-widest text-text4">
          {PROBE.narrativeOpening}
        </p>
        <p class="{block} text-text2">{probe.narrative_opening}</p>
      </div>
    {/if}
    {#if probe?.narrative_target}
      <div class="border-l-2 border-borderStrong pl-3">
        <p class="mb-1 text-[10px] font-medium uppercase tracking-widest text-text4">
          {PROBE.narrativeTarget}
        </p>
        <p class="{block} text-text2">{probe.narrative_target}</p>
      </div>
    {/if}
  </Panel>
</div>
