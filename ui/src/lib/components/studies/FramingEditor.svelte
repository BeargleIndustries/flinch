<!--
  New framing group (brief 8.1), two tabs:
  - "Write with the coach": base probe, group id, framing chips (the five
    defaults checked; "Add a framing" adds one on Enter), "Draft the
    variants" (POST /api/variants/generate, disabled without an Anthropic
    key), then the drafts as editable rows with the base probe first, "Save
    group" and "Discard".
  - "Write by hand": optional base probe (fills the direct request), group
    id, domain, description and the framing rows.
  Save posts /api/variants/files; the store reloads both lists and the rail.
-->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Check, Sparkles } from 'lucide-svelte';
  import Panel from '$lib/components/Panel.svelte';
  import TabbedPanel from '$lib/components/TabbedPanel.svelte';
  import { DEFAULT_STRATEGIES, FRAMINGS } from '$lib/copy/studies';
  import { probes } from '$lib/stores/probe.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import FramingVariantRows from './FramingVariantRows.svelte';
  import {
    GROUP_ID_MAX,
    canSave,
    completeRows,
    duplicateLabels,
    startRows,
    validGroupId,
    type VariantRow,
  } from './framings';
  import { framings } from './framings.svelte';

  const uid = $props.id();

  const tabs = [
    { id: 'coach', label: FRAMINGS.tabCoach, title: FRAMINGS.tabCoachWhy },
    { id: 'hand', label: FRAMINGS.tabHand, title: FRAMINGS.tabHandWhy },
  ];
  let tab = $state('coach');

  const list = $derived(probes.list);
  const probeOf = (id: number | null) =>
    id === null ? null : (list.find((p) => p.id === id) ?? null);

  // ---- Write with the coach
  let coachProbe = $state<number | null>(null);
  let coachId = $state('');
  let strategies = $state<{ name: string; on: boolean }[]>(
    DEFAULT_STRATEGIES.map((name) => ({ name, on: true })),
  );
  let newStrategy = $state('');
  let drafting = $state(false);
  /** The coach's drafts once drafted; `drafted` says whether the grid shows. */
  let drafts = $state<VariantRow[]>([]);
  let drafted = $state(false);
  let coachError = $state<string | null>(null);
  let coachSaving = $state(false);

  const chosen = $derived(strategies.filter((s) => s.on).map((s) => s.name));
  const keyMissing = $derived(framings.anthropicKey === false);
  const coachBase = $derived(probeOf(coachProbe));
  const canDraft = $derived(
    coachBase !== null &&
      chosen.length > 0 &&
      !drafting &&
      !keyMissing &&
      framings.anthropicKey !== null,
  );

  // Keep the coach's base probe on a probe the session still lists.
  $effect(() => {
    if (coachProbe !== null && !list.some((p) => p.id === coachProbe)) coachProbe = null;
    if (coachProbe === null && list.length > 0) coachProbe = list[0].id;
  });

  function addStrategy(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const name = newStrategy.trim().slice(0, 100);
    if (!name) return;
    if (!strategies.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      strategies = [...strategies, { name, on: true }];
    newStrategy = '';
  }

  async function draft() {
    if (!coachBase || !canDraft) return;
    drafting = true;
    coachError = null;
    try {
      drafts = await framings.draft(coachBase.id, coachBase.prompt_text, chosen);
      drafted = true;
    } catch (e) {
      coachError = e instanceof Error ? e.message : String(e);
    } finally {
      drafting = false;
    }
  }

  async function saveDrafts() {
    if (!drafted || !coachBase) return;
    coachSaving = true;
    coachError = null;
    try {
      await framings.save({
        groupId: coachId,
        baseProbe: coachBase.name,
        domain: coachBase.domain,
        rows: drafts,
      });
      drafts = [];
      drafted = false;
      coachId = '';
    } catch (e) {
      coachError = e instanceof Error ? e.message : String(e);
    } finally {
      coachSaving = false;
    }
  }

  // ---- Write by hand
  let handProbe = $state<number | null>(null);
  let handId = $state('');
  let handDomain = $state('');
  let handDescription = $state('');
  let handRows = $state<VariantRow[]>(startRows());
  let handError = $state<string | null>(null);
  let handSaving = $state(false);

  const handBase = $derived(probeOf(handProbe));

  function pickHandProbe(value: string) {
    handProbe = value === '' ? null : Number(value);
    const base = probeOf(handProbe);
    if (!base) return;
    if (!handRows[0]?.prompt_text.trim()) handRows[0].prompt_text = base.prompt_text;
    if (!handDomain.trim() && base.domain) handDomain = base.domain;
  }

  async function saveHand() {
    handSaving = true;
    handError = null;
    try {
      await framings.save({
        groupId: handId,
        description: handDescription,
        baseProbe: handBase?.name ?? '',
        domain: handDomain,
        rows: handRows,
      });
      handId = '';
      handDomain = '';
      handDescription = '';
      handProbe = null;
      handRows = startRows();
    } catch (e) {
      handError = e instanceof Error ? e.message : String(e);
    } finally {
      handSaving = false;
    }
  }

  /** The line under Save: what is missing, or that the id replaces a group. */
  function saveHint(id: string, rows: readonly VariantRow[]): string | null {
    if (duplicateLabels(rows)) return FRAMINGS.saveNeedsUnique;
    if (!validGroupId(id) || completeRows(rows).length < 2) return FRAMINGS.saveNeeds;
    if (framings.exists(id)) return FRAMINGS.groupIdTaken;
    return null;
  }

  const chip =
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-within:ring-1 focus-within:ring-accentHover';
</script>

{#snippet groupIdField(id: string, value: string, onInput: (v: string) => void)}
  <div>
    <label for={id} class={LABEL}>{FRAMINGS.groupId}</label>
    <input
      {id}
      class="{FIELD} font-mono"
      placeholder={FRAMINGS.groupIdPlaceholder}
      maxlength={GROUP_ID_MAX}
      autocomplete="off"
      spellcheck="false"
      aria-invalid={value !== '' && !validGroupId(value)}
      aria-describedby="{id}-hint"
      {value}
      oninput={(e) => onInput(e.currentTarget.value)}
    />
    <p id="{id}-hint" class="mt-1 {HINT}" class:text-warn={value !== '' && !validGroupId(value)}>
      {value !== '' && !validGroupId(value)
        ? FRAMINGS.groupIdBad
        : framings.exists(value)
          ? FRAMINGS.groupIdTaken
          : FRAMINGS.groupIdWhy}
    </p>
  </div>
{/snippet}

<Panel title={FRAMINGS.newTitle} readout={FRAMINGS.newReadout} anchor="framings-new">
  <div class="-mx-4 -mb-1" data-testid="framing-editor">
    <TabbedPanel {tabs} bind:activeTab={tab}>
      {#snippet children(current)}
        <div class="px-4 pt-4">
          {#if current === 'coach'}
            <div class="flex flex-col gap-4" data-testid="framing-coach">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label for="cb-{uid}" class={LABEL}>{FRAMINGS.baseProbe}</label>
                  <select
                    id="cb-{uid}"
                    class={FIELD}
                    value={coachProbe === null ? '' : String(coachProbe)}
                    disabled={list.length === 0 || drafted}
                    onchange={(e) => {
                      const v = e.currentTarget.value;
                      coachProbe = v === '' ? null : Number(v);
                    }}
                  >
                    {#each list as p (p.id)}
                      <option value={String(p.id)}>{p.name}</option>
                    {/each}
                  </select>
                  <p class="mt-1 {HINT}">
                    {list.length === 0 ? FRAMINGS.baseProbeEmpty : FRAMINGS.baseProbeWhy}
                  </p>
                </div>
                {@render groupIdField(`ci-${uid}`, coachId, (v) => (coachId = v))}
              </div>

              {#if coachBase && !drafted}
                <p
                  class="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-bg/40 px-3 py-2 font-mono text-[12px] leading-relaxed text-text3"
                >
                  {coachBase.prompt_text}
                </p>
              {/if}

              {#if !drafted}
                <fieldset class="flex flex-col gap-2">
                  <legend class={LABEL}>{FRAMINGS.strategies}</legend>
                  <div class="flex flex-wrap gap-1.5">
                    {#each strategies as s, i (s.name)}
                      <label
                        class="{chip} cursor-pointer {s.on
                          ? 'border-accent/60 bg-accentSoft/40 text-accentText'
                          : 'border-borderStrong text-text3 hover:text-text2'}"
                      >
                        <input type="checkbox" class="sr-only" bind:checked={strategies[i].on} />
                        {#if s.on}<Check class="h-3 w-3" aria-hidden="true" />{/if}
                        {s.name}
                      </label>
                    {/each}
                  </div>
                  <div class="max-w-xs">
                    <label for="ns-{uid}" class="sr-only">{FRAMINGS.addStrategy}</label>
                    <input
                      id="ns-{uid}"
                      class={FIELD}
                      maxlength="100"
                      placeholder={FRAMINGS.addStrategyPlaceholder}
                      bind:value={newStrategy}
                      onkeydown={addStrategy}
                    />
                  </div>
                  <p class={HINT}>{FRAMINGS.strategiesWhy}</p>
                </fieldset>

                <div class="flex flex-col items-start gap-1">
                  <button
                    type="button"
                    class={BTN.primary}
                    disabled={!canDraft}
                    onclick={draft}
                    data-testid="framing-draft"
                  >
                    <Sparkles
                      class="h-3.5 w-3.5 {drafting ? 'animate-pulse' : ''}"
                      aria-hidden="true"
                    />
                    {drafting ? FRAMINGS.drafting(chosen.length) : FRAMINGS.draft}
                  </button>
                  <p class={HINT} class:text-warn={keyMissing}>
                    {keyMissing ? FRAMINGS.draftNeedsKey : FRAMINGS.draftWhy}
                  </p>
                </div>
              {:else}
                <div
                  class="flex flex-col gap-3"
                  in:fade={{ duration: 160 }}
                  data-testid="framing-drafts"
                >
                  <div>
                    <p class="text-xs font-semibold text-text">
                      {FRAMINGS.draftsTitle(drafts.length)}
                    </p>
                    <p class="mt-0.5 {HINT}">{FRAMINGS.draftsReadout}</p>
                  </div>
                  <FramingVariantRows
                    bind:rows={drafts}
                    disabled={coachSaving}
                    lockFirstLabel
                    testid="coach-rows"
                  />
                  {@render saveRow(coachId, drafts, coachSaving, saveDrafts, () => {
                    drafts = [];
                    drafted = false;
                    coachError = null;
                  })}
                </div>
              {/if}
              {#if coachError}
                <p class="text-xs text-danger" role="alert">{coachError}</p>
              {/if}
            </div>
          {:else}
            <div class="flex flex-col gap-4" data-testid="framing-hand">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label for="hb-{uid}" class={LABEL}>{FRAMINGS.baseProbe}</label>
                  <select
                    id="hb-{uid}"
                    class={FIELD}
                    value={handProbe === null ? '' : String(handProbe)}
                    onchange={(e) => pickHandProbe(e.currentTarget.value)}
                  >
                    <option value="">{FRAMINGS.baseProbeNone}</option>
                    {#each list as p (p.id)}
                      <option value={String(p.id)}>{p.name}</option>
                    {/each}
                  </select>
                  <p class="mt-1 {HINT}">{FRAMINGS.baseProbeHandWhy}</p>
                </div>
                {@render groupIdField(`hi-${uid}`, handId, (v) => (handId = v))}
                <div>
                  <label for="hd-{uid}" class={LABEL}>{FRAMINGS.domain}</label>
                  <input
                    id="hd-{uid}"
                    class={FIELD}
                    placeholder={FRAMINGS.domainPlaceholder}
                    bind:value={handDomain}
                  />
                </div>
                <div>
                  <label for="hx-{uid}" class={LABEL}>{FRAMINGS.description}</label>
                  <input
                    id="hx-{uid}"
                    class={FIELD}
                    maxlength="2000"
                    placeholder={FRAMINGS.descriptionPlaceholder}
                    bind:value={handDescription}
                  />
                </div>
              </div>
              <FramingVariantRows bind:rows={handRows} disabled={handSaving} testid="hand-rows" />
              {@render saveRow(handId, handRows, handSaving, saveHand)}
              {#if handError}
                <p class="text-xs text-danger" role="alert">{handError}</p>
              {/if}
            </div>
          {/if}
        </div>
      {/snippet}
    </TabbedPanel>
  </div>
</Panel>

{#snippet saveRow(
  id: string,
  rows: VariantRow[],
  saving: boolean,
  onSave: () => void,
  onDiscard?: () => void,
)}
  {@const hint = saveHint(id, rows)}
  <div class="flex flex-wrap items-center gap-3 border-t border-border pt-3">
    <button
      type="button"
      class={BTN.primary}
      disabled={saving || !canSave(id, rows)}
      onclick={onSave}
    >
      {saving ? FRAMINGS.saving : FRAMINGS.save}
    </button>
    {#if onDiscard}
      <button type="button" class={BTN.ghost} disabled={saving} onclick={onDiscard}>
        {FRAMINGS.discard}
      </button>
    {/if}
    {#if hint}
      <span class={HINT} class:text-warn={hint === FRAMINGS.groupIdTaken}>{hint}</span>
    {/if}
  </div>
{/snippet}
