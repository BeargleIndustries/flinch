<!--
  Editable framing rows (brief 8.1): a numbered Label plus Prompt text per
  framing, "Add a variant" with the next label, and a remove button on every
  row while more than two remain. Shared by the coach's drafts and
  "Write by hand".
-->
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { Plus, X } from 'lucide-svelte';
  import { FRAMINGS } from '$lib/copy/studies';
  import { BTN, FIELD, LABEL } from '../probe/styles';
  import { nextLabel, type VariantRow } from './framings';

  interface Props {
    rows: VariantRow[];
    disabled?: boolean;
    /** The first row is the base probe as written (the coach's drafts). */
    lockFirstLabel?: boolean;
    /** `data-testid` on the list, so a spec can tell the two editors apart. */
    testid: string;
  }

  let { rows = $bindable(), disabled = false, lockFirstLabel = false, testid }: Props = $props();

  const uid = $props.id();

  function add() {
    rows = [...rows, { label: nextLabel(rows), prompt_text: '' }];
  }

  function remove(i: number) {
    rows = rows.filter((_, j) => j !== i);
  }

  const pad = (i: number) => String(i + 1).padStart(2, '0');
</script>

<div class="flex flex-col gap-2">
  <ol class="flex flex-col gap-2" data-testid={testid}>
    {#each rows as row, i (i)}
      <li
        class="grid grid-cols-[1.75rem_1fr] gap-x-2 rounded-md border border-border bg-bg/40 p-2.5 sm:grid-cols-[1.75rem_minmax(9rem,13rem)_1fr_auto]"
        data-testid="variant-row"
        in:fly={{ y: 4, duration: 160 }}
      >
        <span
          class="pt-[1.6rem] font-mono text-[11px] tabular-nums text-accentText"
          aria-hidden="true">{pad(i)}</span
        >
        <div>
          <label for="vl-{uid}-{i}" class={LABEL}>{FRAMINGS.label}</label>
          <input
            id="vl-{uid}-{i}"
            class={FIELD}
            maxlength="100"
            bind:value={row.label}
            disabled={disabled || (lockFirstLabel && i === 0)}
          />
        </div>
        <div class="col-start-2 mt-2 sm:col-start-auto sm:mt-0">
          <label for="vp-{uid}-{i}" class={LABEL}>{FRAMINGS.prompt}</label>
          <textarea
            id="vp-{uid}-{i}"
            rows="3"
            maxlength="10000"
            placeholder={FRAMINGS.promptPlaceholder}
            class="{FIELD} resize-y font-mono text-[12px] leading-relaxed"
            bind:value={row.prompt_text}
            {disabled}
          ></textarea>
        </div>
        <div class="col-start-2 flex justify-end sm:col-start-auto sm:pt-[1.35rem]">
          {#if rows.length > 2}
            <button
              type="button"
              class="rounded p-1 text-text4 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
              aria-label={FRAMINGS.removeVariant(row.label)}
              title={FRAMINGS.removeVariant(row.label)}
              {disabled}
              onclick={() => remove(i)}
            >
              <X class="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
  <button type="button" class="self-start {BTN.ghost}" {disabled} onclick={add}>
    <Plus class="h-3.5 w-3.5" aria-hidden="true" />
    {FRAMINGS.addVariant}
  </button>
</div>
