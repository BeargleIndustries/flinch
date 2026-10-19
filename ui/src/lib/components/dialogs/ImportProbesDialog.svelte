<!--
  Import probes from a file (brief 6.8). Lists the Markdown and YAML files in
  the sidecar's probes folder (GET /api/probes/files); "Import" on a row runs
  POST /api/probes/import-file and shows "Loaded {n} probes" under it, and the
  rail reloads. The import route reads only that folder, so this is a list of
  its files rather than an open-file picker.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { FileText } from 'lucide-svelte';
  import { request } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import Dialog from '$lib/components/Dialog.svelte';
  import { IMPORT_PROBES } from '$lib/copy/rail';
  import { friendlyError } from '$lib/errors';
  import { probes } from '$lib/stores/probe.svelte';
  import { status } from '$lib/stores/status.svelte';

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open, onClose }: Props = $props();

  interface ProbeFile {
    name: string;
    path: string;
  }

  let files = $state<ProbeFile[] | null>(null);
  let listError = $state<string | null>(null);
  let busy = $state<string | null>(null);
  /** Per file: "Loaded {n} probes" or the error line. */
  let results = $state<Record<string, { ok: boolean; text: string }>>({});

  $effect(() => {
    if (open) untrack(() => void load());
  });

  async function load() {
    files = null;
    listError = null;
    results = {};
    try {
      const res = await status.track(request<{ files: ProbeFile[] }>(ROUTES.listProbeFiles));
      files = res.files ?? [];
    } catch (e) {
      files = [];
      listError = friendlyError(e).message;
    }
  }

  async function importOne(file: ProbeFile) {
    if (busy) return;
    busy = file.name;
    try {
      const loaded = await probes.importFile(file.name);
      results = { ...results, [file.name]: { ok: true, text: IMPORT_PROBES.loaded(loaded) } };
    } catch (e) {
      results = { ...results, [file.name]: { ok: false, text: friendlyError(e).message } };
    } finally {
      busy = null;
    }
  }
</script>

<Dialog {open} {onClose} title={IMPORT_PROBES.title} lead={IMPORT_PROBES.lead}>
  <div data-testid="import-dialog">
    {#if files === null}
      <p class="py-4 text-xs text-text4" aria-live="polite">{IMPORT_PROBES.loading}</p>
    {:else if listError}
      <p class="py-4 text-xs text-danger" role="alert">{listError}</p>
    {:else if files.length === 0}
      <p class="py-4 text-xs text-text4">{IMPORT_PROBES.empty}</p>
    {:else}
      <ul class="divide-y divide-border rounded-md border border-border">
        {#each files as f (f.name)}
          {@const result = results[f.name]}
          <li class="flex flex-col gap-1 px-3 py-2" data-testid="import-row">
            <div class="flex items-center gap-2">
              <FileText class="h-3.5 w-3.5 shrink-0 text-text4" aria-hidden="true" />
              <span class="min-w-0 flex-1 truncate font-mono text-[13px] text-text">{f.name}</span>
              <button
                type="button"
                onclick={() => importOne(f)}
                aria-disabled={busy !== null}
                aria-label={IMPORT_PROBES.importFile(f.name)}
                class="shrink-0 rounded-md border border-borderStrong px-2.5 py-1 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-60"
              >
                {busy === f.name ? IMPORT_PROBES.importing : IMPORT_PROBES.import}
              </button>
            </div>
            {#if result}
              <p
                class="pl-5 text-xs {result.ok ? 'text-ok' : 'text-danger'}"
                role={result.ok ? 'status' : 'alert'}
                data-testid="import-result"
              >
                {result.text}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#snippet footer()}
    <button
      type="button"
      onclick={onClose}
      class="rounded-md border border-borderStrong px-3 py-1.5 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
      >{IMPORT_PROBES.close}</button
    >
  {/snippet}
</Dialog>
