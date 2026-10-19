<!--
  Run history (brief 6.2 footer): the newest 50 runs of the session, each a
  glyph badge of its outcome and the probe name, linking to the saved run
  (/probe/runs/{id}). Hover shows a trash icon with an inline confirm
  (DELETE /api/runs/{id}). Empty: "No runs yet".
-->
<script lang="ts">
  import { Trash2 } from 'lucide-svelte';
  import ClassBadge from '$lib/components/ClassBadge.svelte';
  import { RAIL } from '$lib/copy/rail';
  import { runOutcome } from '$lib/stores/probe-list';
  import { probes } from '$lib/stores/probe.svelte';

  const ARM_MS = 4000;
  let armedId = $state<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function disarm() {
    armedId = null;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function trash(id: number) {
    if (armedId !== id) {
      disarm();
      armedId = id;
      timer = setTimeout(disarm, ARM_MS);
      return;
    }
    disarm();
    await probes.removeRun(id);
  }

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });
</script>

<section aria-label={RAIL.historyLabel} class="border-t border-border/60" data-testid="run-history">
  {#if probes.recent.length === 0}
    <p class="px-3 py-2 text-xs text-text4">{RAIL.noRuns}</p>
  {:else}
    <ul class="max-h-40 overflow-y-auto py-1">
      {#each probes.recent as run (run.id)}
        {@const armed = armedId === run.id}
        <li class="group relative flex items-center">
          <a
            href="/probe/runs/{run.id}"
            aria-label={RAIL.openRun(run.probe_name)}
            data-testid="history-row"
            class="flex min-w-0 flex-1 items-center gap-2 px-3 py-1 text-xs text-text3 hover:bg-surface2/60 hover:text-text focus:outline-none focus-visible:bg-surface2"
          >
            <ClassBadge value={runOutcome(run)} size="sm" glyphOnly />
            <span class="truncate">{run.probe_name}</span>
          </a>
          <button
            type="button"
            onclick={() => trash(run.id)}
            onblur={() => armed && disarm()}
            aria-label={armed ? RAIL.deleteArmed : RAIL.deleteRun}
            class="absolute right-2 rounded px-1 text-[11px] font-medium transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover {armed
              ? 'bg-danger text-white opacity-100'
              : 'text-text4 opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100'}"
          >
            {#if armed}{RAIL.deleteArmed}{:else}<Trash2 class="h-3 w-3" aria-hidden="true" />{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
