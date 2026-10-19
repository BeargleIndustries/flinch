<!--
  Delete all recorded data (brief 9.1, B26, plan Appendix C item 19). The body
  is the B26 sentence word for word (SCREENS['browse.clearAll']), then the two
  lists it names: what is deleted and what stays. "Export everything first"
  downloads GET /api/dashboard/export-all; "Delete everything" is a two-step
  ConfirmButton ("Yes, delete everything") calling DELETE
  /api/dashboard/clear-all {confirm: "DELETE_ALL_DATA"}. On success it shows
  "Deleted." for 2 s, then closes; the Browse store has already reloaded the
  session store (no current session), the rail's probes and its own lists.
-->
<script lang="ts">
  import { Check, ShieldCheck, Trash2 } from 'lucide-svelte';
  import { pathFor } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import ConfirmButton from '$lib/components/ConfirmButton.svelte';
  import Dialog from '$lib/components/Dialog.svelte';
  import { clearedCounts } from '$lib/components/data/browse';
  import { browse } from '$lib/components/data/browse-store.svelte';
  import SaveButton from '$lib/components/data/SaveButton.svelte';
  import { BROWSE, CLEAR_ALL } from '$lib/copy/data';
  import { SCREENS } from '$lib/copy/screens';
  import { friendlyError } from '$lib/errors';
  import { BTN } from '../probe/styles';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  const DONE_MS = 2000;

  let phase = $state<'idle' | 'working' | 'done'>('idle');
  let error = $state<string | null>(null);
  let removed = $state<{ sessions: number; runs: number } | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Every opening starts clean.
  $effect(() => {
    if (!open) return;
    phase = 'idle';
    error = null;
    removed = null;
  });

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });

  function close() {
    if (phase === 'working') return;
    if (timer) clearTimeout(timer);
    timer = null;
    onClose();
  }

  async function clearEverything() {
    if (phase !== 'idle') return;
    phase = 'working';
    error = null;
    try {
      removed = clearedCounts(await browse.clearAll());
      phase = 'done';
      timer = setTimeout(() => {
        timer = null;
        onClose();
      }, DONE_MS);
    } catch (e) {
      error = friendlyError(e).message;
      phase = 'idle';
    }
  }

  const exportPath = pathFor(ROUTES.exportAllData);
</script>

<Dialog {open} title={CLEAR_ALL.title} onClose={close} width="lg">
  <div class="flex flex-col gap-4" data-testid="clear-all-dialog">
    <p class="leading-relaxed text-text2" data-testid="clear-all-body">
      {SCREENS['browse.clearAll']}
    </p>

    <div class="grid gap-3 sm:grid-cols-2">
      <section
        class="rounded-lg border border-danger/30 bg-danger/[0.06] p-3"
        aria-labelledby="clear-deleted-heading"
        data-testid="clear-all-deleted"
      >
        <h3
          id="clear-deleted-heading"
          class="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-danger"
        >
          <Trash2 class="h-3 w-3" aria-hidden="true" />
          {CLEAR_ALL.deletedHeading}
        </h3>
        <ul class="flex flex-col gap-1">
          {#each CLEAR_ALL.deleted as item (item)}
            <li class="flex items-center gap-2 text-xs text-text2">
              <span class="h-px w-2 bg-danger/60" aria-hidden="true"></span>
              {item}
            </li>
          {/each}
        </ul>
      </section>
      <section
        class="rounded-lg border border-ok/30 bg-ok/[0.06] p-3"
        aria-labelledby="clear-kept-heading"
        data-testid="clear-all-kept"
      >
        <h3
          id="clear-kept-heading"
          class="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-ok"
        >
          <ShieldCheck class="h-3 w-3" aria-hidden="true" />
          {CLEAR_ALL.keptHeading}
        </h3>
        <ul class="flex flex-col gap-1">
          {#each CLEAR_ALL.kept as item (item)}
            <li class="flex items-center gap-2 text-xs text-text2">
              <Check class="h-3 w-3 text-ok/80" aria-hidden="true" />
              {item}
            </li>
          {/each}
        </ul>
      </section>
    </div>

    {#if error}
      <p class="text-sm text-danger" role="alert">{error}</p>
    {/if}
    {#if phase === 'done'}
      <p class="text-sm font-medium text-ok" role="status" data-testid="clear-all-done">
        {CLEAR_ALL.done}
        {#if removed}<span class="font-normal text-text3"
            >{CLEAR_ALL.removedCounts(removed.sessions, removed.runs)}</span
          >{/if}
      </p>
    {/if}
  </div>

  {#snippet footer()}
    <div class="mr-auto">
      <SaveButton
        path={exportPath}
        label={CLEAR_ALL.exportFirst}
        title={BROWSE.exportAllWhy}
        fallbackName="flinch-export-all.json"
        disabled={phase !== 'idle'}
        tone="outline"
        testid="clear-all-export"
      />
    </div>
    <button type="button" class={BTN.ghost} onclick={close} disabled={phase === 'working'}>
      {CLEAR_ALL.cancel}
    </button>
    {#if phase === 'idle'}
      <ConfirmButton
        label={CLEAR_ALL.remove}
        confirmLabel={CLEAR_ALL.removeConfirm}
        danger
        onConfirm={clearEverything}
      />
    {:else}
      <span
        class="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs text-text3"
        aria-live="polite">{phase === 'working' ? CLEAR_ALL.working : CLEAR_ALL.done}</span
      >
    {/if}
  {/snippet}
</Dialog>
