<!--
  The header (brief 5.4, 6.1): 44px. Left, the brand, the session switcher
  and the sidecar chip; centre, the Probe / Studies / Data section tabs (D8);
  right, Export, the guide menu and Settings.
-->
<script lang="ts">
  import { Download, Settings } from 'lucide-svelte';
  import { SECTIONS, SHELL } from '$lib/copy/shell';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import Brand from './Brand.svelte';
  import GuideMenu from './GuideMenu.svelte';
  import SessionSwitcher from './SessionSwitcher.svelte';
  import SidecarChip from './SidecarChip.svelte';
  import TabStrip from './TabStrip.svelte';
  import { sessions } from './sessions.svelte';
  import { shell } from './shell.svelte';

  const hasSession = $derived(sessions.current !== null);
  // The dot asks for a key until there is one or Settings has been opened (brief 6.1 item 5).
  const keyDot = $derived(capabilities.health?.keys_set === 0 && !shell.settingsSeen);

  const icon =
    'relative flex h-7 w-7 items-center justify-center rounded-md text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text3';
</script>

<header
  class="grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch border-b border-border bg-surface px-3"
>
  <div class="flex min-w-0 items-center gap-2">
    <Brand />
    <span class="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true"></span>
    <SessionSwitcher />
    <SidecarChip />
  </div>

  <TabStrip tabs={SECTIONS} label={SHELL.sectionsLabel} anchor="section-tabs" variant="header" />

  <div class="flex items-center justify-end gap-0.5">
    <span title={hasSession ? undefined : SHELL.exportNeedsSession}>
      <button
        type="button"
        onclick={() => shell.openExport()}
        disabled={!hasSession}
        aria-label={SHELL.exportLabel}
        data-tip="export-button"
        class={icon}
      >
        <Download class="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
    <GuideMenu onTour={() => shell.startTour()} onShortcuts={() => (shell.shortcutsOpen = true)} />
    <button
      type="button"
      onclick={() => shell.openSettings()}
      aria-label={SHELL.settingsLabel}
      aria-haspopup="dialog"
      aria-expanded={shell.settingsOpen}
      data-tour="settings-button"
      class={icon}
    >
      <Settings class="h-4 w-4" aria-hidden="true" />
      {#if keyDot}
        <span
          class="absolute right-1 top-1 h-2 w-2 rounded-full bg-brandDot ring-2 ring-surface"
          data-testid="settings-dot"
          aria-hidden="true"
        ></span>
      {/if}
    </button>
  </div>
</header>
