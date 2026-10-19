<!--
  A saved run (brief 7.9, /probe/runs/[runId]). Once the session list has
  loaded, opens the run in the workspace (workspace.openRun): its session
  becomes current when it is another listed one, its probe is selected in
  the rail, and the thread shows in `pushback` or `done`. A pushback from
  here continues this run's conversation (B09). Moving the workspace off the
  run (Next probe, Run again, a pick in the rail, a session switch) goes back
  to /probe. A missing run shows "That run no longer exists."
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { PROBE } from '$lib/copy/probe';
  import { probes } from '$lib/stores/probe.svelte';
  import { session } from '$lib/stores/session.svelte';
  import ProbeWorkspace from './ProbeWorkspace.svelte';
  import { workspace, type OpenResult } from './workspace.svelte';

  let { runId }: { runId: number } = $props();

  let result = $state<OpenResult | 'loading'>('loading');
  let started = false;

  $effect(() => {
    if (started || !session.loaded) return;
    started = true;
    if (!Number.isInteger(runId) || runId <= 0) {
      result = 'missing';
      return;
    }
    // Untracked: the requests' own state must not re-run this effect.
    void untrack(() => workspace.openRun(runId)).then((r) => (result = r));
  });

  $effect(() => {
    if (result === 'ok' && probes.machine.run?.id !== runId) void goto('/probe');
  });

  const back = { label: PROBE.backToProbe, onClick: () => void goto('/probe') };
</script>

{#if result === 'ok'}
  <ProbeWorkspace savedRunId={runId} />
{:else if result === 'missing'}
  <div
    class="max-w-[880px] rounded-xl border border-dashed border-border"
    data-testid="run-missing"
  >
    <EmptyState title={PROBE.runMissing} body={PROBE.runMissingBody} action={back} />
  </div>
{:else if result === 'error'}
  <div class="max-w-[880px] rounded-xl border border-dashed border-border" data-testid="run-failed">
    <EmptyState title={PROBE.runFailed} body={PROBE.runFailedBody} action={back} />
  </div>
{:else}
  <p class="text-sm text-text4" role="status" data-testid="run-loading">{PROBE.loadingRun}</p>
{/if}
