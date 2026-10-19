<!--
  Stacked classification bar (brief 5.3, 5.6): how a set of runs split across
  the four badges, in the order refused, collapsed, negotiated, complied,
  unknown. A 6px bar plus a legend of glyph-only badges with counts. An empty
  total renders a muted bar and "No data".
-->
<script lang="ts">
  import { CLS_SPEC, type Cls } from '$lib/cls';
  import ClassBadge from './ClassBadge.svelte';
  import { classBarLabel, classBarRows, type ClsCounts } from './class-bar';

  interface Props {
    counts: ClsCounts;
    legend?: boolean;
  }

  let { counts, legend = true }: Props = $props();

  const words = Object.fromEntries(Object.entries(CLS_SPEC).map(([k, v]) => [k, v.word])) as Record<
    Cls,
    string
  >;

  const bar = $derived(classBarRows(counts));
  const label = $derived(classBarLabel(counts, words));
</script>

<div class="flex flex-col gap-1.5">
  <div
    role="img"
    aria-label={label}
    class="flex h-1.5 w-full overflow-hidden rounded-full bg-surface2"
  >
    {#if bar.total > 0}
      {#each bar.rows as row (row.cls)}
        {#if row.count > 0}
          <span
            class="h-full transition-[width] duration-300 ease-out first:rounded-l-full last:rounded-r-full {CLS_SPEC[
              row.cls
            ].glyphBg}"
            style:width="{row.pct}%"
            title="{words[row.cls]}: {row.count}"
          ></span>
        {/if}
      {/each}
    {/if}
  </div>
  {#if bar.total === 0}
    <p class="text-xs text-text4">No data</p>
  {:else if legend}
    <ul class="flex flex-wrap items-center gap-x-2.5 gap-y-1" aria-hidden="true">
      {#each bar.rows as row (row.cls)}
        <li class="inline-flex items-center gap-1">
          <ClassBadge value={row.cls} size="sm" glyphOnly />
          <span class="font-mono text-xs tabular-nums {row.count ? 'text-text2' : 'text-text4'}"
            >{row.count}</span
          >
        </li>
      {/each}
    </ul>
  {/if}
</div>
