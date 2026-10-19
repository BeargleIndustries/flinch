<!--
  Settings, Developer (brief 9.7, D25). Database path and the sidecar version
  from /health (B21), the app version from the shell ("dev" in a browser), and
  a link to the sidecar's FastAPI /docs page. Desktop only: Open DevTools,
  the open-at-start toggle (`flinch:devtools_autoopen`), Copy diagnostic
  details (crash.rs, already sanitised) and the crash log names.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import CopyButton from '$lib/components/CopyButton.svelte';
  import { base } from '$lib/api/client';
  import { SETTINGS } from '$lib/copy/settings';
  import { friendlyError } from '$lib/errors';
  import { isTauri } from '$lib/is-tauri';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import {
    appVersion,
    copyDiagnostic,
    listCrashLogs,
    openDevtools,
    openExternal,
  } from '$lib/tauri';
  import SettingsSection from './SettingsSection.svelte';
  import { DEVTOOLS_AUTOOPEN } from './developer';

  const desktop = isTauri();
  let app = $state('dev');
  let docsUrl = $state('/docs');
  let autoOpen = $state(false);
  let crashLogs = $state<string[] | null>(null);
  let copied = $state(false);
  let devError = $state<string | null>(null);
  const h = $derived(capabilities.health);

  onMount(() => {
    void capabilities.checkHealth();
    appVersion().then(
      (v) => (app = v),
      () => {},
    );
    base().then(
      (b) => (docsUrl = `${b}/docs`),
      () => {},
    );
    if (desktop) {
      try {
        autoOpen = localStorage.getItem(DEVTOOLS_AUTOOPEN) === 'true';
      } catch {
        autoOpen = false;
      }
      listCrashLogs().then(
        (names) => (crashLogs = names),
        () => (crashLogs = []),
      );
    }
  });

  function openDocs(e: MouseEvent) {
    if (!desktop) return; // the browser follows the link itself
    e.preventDefault();
    openExternal(docsUrl).catch((err: unknown) => (devError = friendlyError(err).message));
  }

  async function devtools() {
    devError = null;
    try {
      await openDevtools();
    } catch (e) {
      devError = friendlyError(e).message;
    }
  }

  function toggleAutoOpen() {
    autoOpen = !autoOpen;
    try {
      localStorage.setItem(DEVTOOLS_AUTOOPEN, String(autoOpen));
    } catch {
      // Storage refused: the toggle still reflects this window.
    }
  }

  async function diagnostic() {
    devError = null;
    try {
      await navigator.clipboard.writeText(await copyDiagnostic());
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch (e) {
      devError = friendlyError(e).message;
    }
  }

  const linkBtn =
    'text-xs text-accentText underline-offset-2 hover:underline focus:outline-none focus-visible:underline';
</script>

<SettingsSection id="developer" title={SETTINGS.devHeading}>
  <dl class="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-2.5 text-xs">
    <dt class="pt-0.5 text-text4">{SETTINGS.database}</dt>
    <dd class="flex min-w-0 items-start gap-2">
      <span
        class="min-w-0 flex-1 break-all font-mono text-[11px] text-text2"
        data-testid="settings-db-path">{h?.db_path ?? '-'}</span
      >
      {#if h?.db_path}<CopyButton text={h.db_path} />{/if}
    </dd>

    <dt class="text-text4">{SETTINGS.versions}</dt>
    <dd class="font-mono text-[11px] text-text2" data-testid="settings-versions">
      {SETTINGS.versionLine(app, h?.version ?? '-')}
    </dd>

    <dt class="text-text4">{SETTINGS.apiDocs}</dt>
    <dd>
      <a
        href={docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        class={linkBtn}
        data-testid="settings-api-docs"
        onclick={openDocs}>{SETTINGS.apiDocsLink}</a
      >
    </dd>

    {#if desktop}
      <dt class="text-text4">{SETTINGS.crashLogs}</dt>
      <dd class="min-w-0">
        {#if crashLogs && crashLogs.length > 0}
          <ul class="space-y-0.5 font-mono text-[11px] text-text2">
            {#each crashLogs as name (name)}<li class="break-all">{name}</li>{/each}
          </ul>
        {:else}
          <span class="text-text3">{SETTINGS.crashLogsNone}</span>
        {/if}
      </dd>
    {/if}
  </dl>

  {#if desktop}
    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button type="button" class={linkBtn} onclick={devtools}>{SETTINGS.devtools}</button>
      <button type="button" class={linkBtn} onclick={diagnostic}>
        {copied ? SETTINGS.copied : SETTINGS.diagnostic}
      </button>
    </div>
    <label class="mt-2.5 flex cursor-pointer items-center gap-2 text-xs text-text2">
      <input
        type="checkbox"
        checked={autoOpen}
        onchange={toggleAutoOpen}
        class="h-3.5 w-3.5 accent-accent"
      />
      {SETTINGS.devtoolsAuto}
    </label>
  {/if}

  {#if devError}
    <p class="mt-2 text-xs text-danger" role="alert">{devError}</p>
  {/if}
</SettingsSection>
