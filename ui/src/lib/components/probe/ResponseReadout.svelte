<!--
  What the latest answer means and what to do next (brief 7.5): one readout
  per class (copy keys `response.*`), tracking the latest response.
-->
<script lang="ts">
  import Readout from '$lib/components/Readout.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import type { MachineRun } from '$lib/probe-machine';
  import { readoutKey } from './thread';

  let { run }: { run: MachineRun } = $props();

  const key = $derived(readoutKey(run));
</script>

<div data-tour="response-readout" data-testid="response-readout" data-readout={key}>
  <Readout text={SCREENS[key]} />
</div>
