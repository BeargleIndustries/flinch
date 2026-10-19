<!--
  Session stats (brief 6.2 footer): "Runs: {total_runs}" and a ClassBar of
  the session's outcome classes from GET /api/sessions/{id}/stats.
-->
<script lang="ts">
  import ClassBar from '$lib/components/ClassBar.svelte';
  import { RAIL } from '$lib/copy/rail';
  import { clsCounts } from '$lib/stores/probe-list';
  import { probes } from '$lib/stores/probe.svelte';

  const total = $derived(probes.stats?.total_runs ?? 0);
  const counts = $derived(clsCounts(probes.stats?.outcome_classifications));
</script>

<section
  class="flex flex-col gap-1.5 px-3 pb-2 pt-2.5"
  aria-label={RAIL.statsLabel}
  data-tour="session-stats"
  data-testid="session-stats"
>
  <p class="font-mono text-xs tabular-nums text-text2" data-testid="session-runs">
    {RAIL.runs(total)}
  </p>
  <ClassBar {counts} />
</section>
