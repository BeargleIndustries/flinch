<!--
  The done row (brief 7.7 item 2): "Next probe" (N), "Run again" (R) and
  "Teach the coach this exchange" (D14) with the hint for the run's outcome.
  Teaching promotes the run to a coach example and the button becomes a
  disabled "Taught".
-->
<script lang="ts">
  import { Check, GraduationCap } from 'lucide-svelte';
  import type { Run } from '$lib/api/types';
  import { PROBE } from '$lib/copy/probe';
  import { SCREENS } from '$lib/copy/screens';
  import ActionButton from './ActionButton.svelte';
  import { HINT } from './styles';
  import { teachKey } from './thread';

  interface Props {
    run: Run;
    taught: boolean;
    teaching: boolean;
    error: string | null;
    onNext: () => void;
    onRunAgain: () => void;
    onTeach: () => void;
  }

  let { run, taught, teaching, error, onNext, onRunAgain, onTeach }: Props = $props();

  const hint = $derived.by(() => {
    const key = teachKey(run);
    return key ? SCREENS[key] : SCREENS['teach.complied'];
  });
</script>

<div class="flex flex-col gap-2" data-testid="done-actions">
  <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
    <ActionButton
      variant="primary"
      label={PROBE.next}
      why={PROBE.nextWhy}
      kbd="N"
      testid="next-probe"
      onclick={onNext}
    />
    <ActionButton
      label={PROBE.runAgain}
      why={PROBE.runAgainWhy}
      kbd="R"
      testid="run-again"
      onclick={onRunAgain}
    />
    <ActionButton
      label={taught ? PROBE.taught : teaching ? PROBE.teaching : PROBE.teach}
      why={hint}
      anchor="teach-coach"
      testid="teach-coach"
      disabled={taught || teaching}
      onclick={onTeach}
    >
      {#snippet icon()}
        {#if taught}
          <Check class="h-3.5 w-3.5 text-ok" aria-hidden="true" />
        {:else}
          <GraduationCap class="h-3.5 w-3.5" aria-hidden="true" />
        {/if}
      {/snippet}
    </ActionButton>
    <p class="{HINT} ml-auto self-center">{PROBE.doneHint}</p>
  </div>
  {#if error}
    <p class="text-xs text-danger" role="alert" data-testid="workspace-error">{error}</p>
  {/if}
</div>
