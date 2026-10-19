<!--
  Model picker (brief 5.6): one optgroup per provider from GET /api/models.
  Unavailable providers stay listed but disabled, with the reason in the group
  label, so a missing key reads as a missing key rather than a missing model.
  With `allowCustom`, "Other model id…" reveals a text field for any id the
  sidecar accepts.
-->
<script lang="ts">
  import { CUSTOM_OPTION, groupLabel, isListed, type ModelGroup } from './model-picker';

  interface Props {
    value: string;
    onChange: (model: string) => void;
    groups: ModelGroup[];
    allowCustom?: boolean;
    /** Accessible name when no visible <label for> points at `id`. */
    label?: string;
    id?: string;
    disabled?: boolean;
  }

  let {
    value,
    onChange,
    groups,
    allowCustom = false,
    label = 'Model',
    id,
    disabled = false,
  }: Props = $props();

  const uid = $props.id();
  const selectId = $derived(id ?? `model-${uid}`);

  // Custom mode: chosen from the menu, or the current value is not in the list.
  let picked = $state(false);
  const custom = $derived(allowCustom && (picked || (value !== '' && !isListed(value, groups))));
  const selectValue = $derived(custom ? CUSTOM_OPTION : value);

  function onSelect(e: Event) {
    const next = (e.currentTarget as HTMLSelectElement).value;
    if (next === CUSTOM_OPTION) {
      picked = true;
      return;
    }
    picked = false;
    onChange(next);
  }

  const field =
    'w-full rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50';
</script>

<div class="flex flex-col gap-1.5">
  <select
    id={selectId}
    aria-label={id ? undefined : label}
    value={selectValue}
    onchange={onSelect}
    {disabled}
    class="{field} pr-8"
  >
    {#if value === '' && !custom}
      <option value="" disabled>Choose a model</option>
    {/if}
    {#each groups as group (group.provider)}
      <optgroup label={groupLabel(group)} disabled={!group.available}>
        {#each group.models as m (m.id)}
          <option value={m.id}>{m.name}{m.deprecated ? ' (legacy)' : ''}</option>
        {/each}
      </optgroup>
    {/each}
    {#if allowCustom}
      <option value={CUSTOM_OPTION}>Other model id…</option>
    {/if}
  </select>
  {#if custom}
    <input
      type="text"
      value={isListed(value, groups) ? '' : value}
      oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value.trim())}
      placeholder="claude-…, gpt-…, gemini-…, ollama:…"
      aria-label="Model id"
      spellcheck="false"
      autocomplete="off"
      {disabled}
      class="{field} font-mono text-[13px]"
    />
  {/if}
</div>
