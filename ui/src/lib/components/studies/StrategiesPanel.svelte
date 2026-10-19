<!--
  Sequences, Run tab, "Strategies" (brief 9.9, D21, D30): every strategy from
  GET /api/strategies with name, category, description and a "Built in" chip.
  "New strategy…" opens StrategyDialog (POST /api/strategies). Custom rows get
  "Edit" (GET then PUT /api/strategies/{id}) and "Delete this strategy"
  (DELETE). Built-in rows have no edit actions: the routes refuse them.
-->
<script lang="ts">
  import { Lock, Pencil, Plus } from 'lucide-svelte';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import StrategyDialog from '$lib/components/dialogs/StrategyDialog.svelte';
  import { SEQUENCES as S } from '$lib/copy/studies';
  import { BTN } from '../probe/styles';
  import { isBuiltin, strategyTitle, type Strategy } from './sequences';
  import { sequences } from './sequences.svelte';

  let dialogOpen = $state(false);
  let editing = $state<Strategy | null>(null);

  const rows = $derived(sequences.strategies);

  function openNew() {
    editing = null;
    dialogOpen = true;
  }

  function openEdit(s: Strategy) {
    editing = s;
    dialogOpen = true;
  }
</script>

<Panel eyebrow={S.strategiesEyebrow} title={S.strategiesTitle} readout={S.strategiesReadout}>
  {#snippet actions()}
    <button type="button" class={BTN.secondary} onclick={openNew} data-testid="strategy-new">
      <Plus class="h-3.5 w-3.5" aria-hidden="true" />
      {S.newStrategy}
    </button>
  {/snippet}

  {#if sequences.strategiesLoaded && rows.length === 0}
    <p class="text-xs text-text4">{S.strategiesEmpty}</p>
  {:else}
    <ul class="grid gap-2 md:grid-cols-2" data-testid="strategy-list">
      {#each rows as s (s.id)}
        {@const builtin = isBuiltin(s)}
        <li
          class="flex flex-col gap-1.5 rounded-md border border-border bg-bg/40 px-3 py-2.5"
          data-testid="strategy-row"
          data-strategy-id={s.id}
          data-builtin={builtin}
        >
          <div class="flex min-w-0 items-center gap-2">
            <span class="truncate text-[13px] font-medium text-text" data-testid="strategy-name"
              >{strategyTitle(s.name)}</span
            >
            {#if s.category}
              <span
                class="shrink-0 rounded border border-border px-1.5 py-px font-mono text-[10px] text-text3"
                >{s.category}</span
              >
            {/if}
            {#if builtin}
              <span
                class="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-text4"
                title={S.builtInWhy}
              >
                <Lock class="h-3 w-3" aria-hidden="true" />{S.builtIn}
              </span>
            {/if}
          </div>
          {#if s.description}
            <p class="text-xs leading-snug text-text3">{s.description}</p>
          {/if}
          {#if !builtin}
            <div class="mt-0.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border border-borderStrong px-2.5 py-1 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
                aria-label={S.editFor(strategyTitle(s.name))}
                onclick={() => openEdit(s)}
                data-testid="strategy-edit"
              >
                <Pencil class="h-3 w-3" aria-hidden="true" />{S.edit}
              </button>
              <ConfirmButton
                label={S.deleteStrategy}
                confirmLabel={S.deleteStrategyConfirm}
                danger
                onConfirm={() => sequences.deleteStrategy(s)}
              />
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</Panel>

<StrategyDialog open={dialogOpen} strategy={editing} onClose={() => (dialogOpen = false)} />
