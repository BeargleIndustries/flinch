<!--
  One provider key row in Settings (brief 9.7, 5.6): label, status
  ("Set · {masked}" or "Not set"), "Add a key" or "Replace", and when set
  "Test" and "Remove". Add or Replace reveals a password field and "Save".

  The row owns the wording and the states; T19's KeysSection supplies the
  three actions, which pick the store (Credential Manager in the desktop app,
  .env in dev, D11) and reload the list.
-->
<script lang="ts">
  import ConfirmButton from '../ConfirmButton.svelte';
  import { friendlyError } from '$lib/errors';
  import { canTest, keyLabel, keyStatus, type KeyEntry, type KeyResult } from './key-row';

  interface Props {
    entry: KeyEntry;
    expanded?: boolean;
    /** Validate and store the key. */
    onSave: (key: string) => Promise<KeyResult>;
    /** POST /api/settings/test-key for this provider. */
    onTest: () => Promise<KeyResult>;
    /** Delete the stored key. */
    onRemove: () => Promise<void>;
  }

  let { entry, expanded = false, onSave, onTest, onRemove }: Props = $props();

  // Starts from `expanded`; the row's own buttons open and close it after that.
  let editing = $state<boolean | null>(null);
  const open = $derived(editing ?? expanded);
  let draft = $state('');
  let busy = $state<'save' | 'test' | null>(null);
  let note = $state<{ ok: boolean; text: string } | null>(null);

  const label = $derived(keyLabel(entry));
  const uid = $props.id();

  async function save() {
    const key = draft.trim();
    if (!key || busy) return;
    busy = 'save';
    note = null;
    try {
      const r = await onSave(key);
      if (r.ok) {
        draft = '';
        editing = false;
        note = { ok: true, text: 'Saved.' };
      } else {
        note = { ok: false, text: `That key did not work: ${r.error}` };
      }
    } catch (e) {
      note = { ok: false, text: friendlyError(e).message };
    } finally {
      busy = null;
    }
  }

  async function test() {
    if (busy) return;
    busy = 'test';
    note = null;
    try {
      const r = await onTest();
      note = r.ok
        ? { ok: true, text: 'Key works.' }
        : { ok: false, text: `Test failed: ${r.error}` };
    } catch (e) {
      note = { ok: false, text: `Test failed: ${friendlyError(e).message}` };
    } finally {
      busy = null;
    }
  }

  async function remove() {
    note = null;
    try {
      await onRemove();
    } catch (e) {
      note = { ok: false, text: friendlyError(e).message };
    }
  }

  function onFieldKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      editing = false;
      draft = '';
    }
  }

  const linkBtn =
    'text-xs text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:text-text4 disabled:no-underline';
</script>

<div class="border-b border-border py-3 last:border-b-0" data-provider={entry.provider}>
  <div class="flex items-center gap-3">
    <span
      class="h-1.5 w-1.5 shrink-0 rounded-full {entry.is_set ? 'bg-ok' : 'bg-text4/50'}"
      aria-hidden="true"
    ></span>
    <div class="min-w-0 flex-1">
      <p class="text-sm text-text">
        {label}
      </p>
      <p class="truncate font-mono text-[11px] {entry.is_set ? 'text-ok' : 'text-text4'}">
        {keyStatus(entry)}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-3">
      {#if entry.is_set}
        {#if canTest(entry.provider)}
          <button type="button" class={linkBtn} disabled={busy !== null} onclick={test}>
            {busy === 'test' ? 'Testing…' : 'Test'}
          </button>
        {:else}
          <span class="text-xs text-text4">Checked when saved.</span>
        {/if}
        <ConfirmButton
          label="Remove"
          confirmLabel={`Remove the ${label} key`}
          danger
          onConfirm={remove}
          class="!px-2 !py-0.5"
        />
      {/if}
      <button
        type="button"
        class={linkBtn}
        aria-expanded={open}
        aria-controls="key-{uid}"
        onclick={() => {
          editing = !open;
          note = null;
        }}
      >
        {open ? 'Cancel' : entry.is_set ? 'Replace' : 'Add a key'}
      </button>
    </div>
  </div>

  {#if open}
    <div id="key-{uid}" class="mt-2.5 flex items-center gap-2 pl-[18px]">
      <input
        type="password"
        bind:value={draft}
        onkeydown={onFieldKey}
        placeholder={`${label} API key`}
        aria-label={`${label} API key`}
        autocomplete="off"
        spellcheck="false"
        class="min-w-0 flex-1 rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 font-mono text-[13px] text-text placeholder:font-sans placeholder:text-text4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="button"
        onclick={save}
        disabled={!draft.trim() || busy !== null}
        class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accentHover focus:outline-none focus-visible:ring-2 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === 'save' ? 'Saving…' : 'Save'}
      </button>
    </div>
  {/if}

  {#if note}
    <p class="mt-1.5 pl-[18px] text-xs {note.ok ? 'text-ok' : 'text-danger'}" role="status">
      {note.text}
    </p>
  {/if}
</div>
