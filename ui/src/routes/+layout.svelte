<!--
  The application shell (brief 6, D8 to D12, D15, D22). Header, then a row of
  [probe rail | workspace], then the fixed 36px status strip; the settings
  drawer, the shortcuts overlay, first-time tips and the crash banner mount
  here. The welcome routes (T33) render bare, without the shell.

  Keys handled here, on every route: `?` toggles the shortcuts overlay
  (outside text fields) and Escape closes it first when it is open (it is the
  topmost layer). The drawer, menus and dialogs close themselves on Escape.
  The Probe keys (S, P, K, N, R, Up, Down) belong to T17's shortcuts.ts.

  ProbeRail renders the rail inside RailFrame; NewSessionDialog opens on
  `shell.newSessionOpen` (T16). Mount points for later tasks: T20 puts the
  ExportDialog on `shell.exportOpen`; T19 fills
  components/settings/SettingsSections.svelte.
-->
<script lang="ts">
  import '../app.css';
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import FirstTimeTip from '$lib/components/FirstTimeTip.svelte';
  import StatusStrip from '$lib/components/StatusStrip.svelte';
  import SettingsDrawer from '$lib/components/settings/SettingsDrawer.svelte';
  import SettingsSections from '$lib/components/settings/SettingsSections.svelte';
  import CrashBanner from '$lib/components/shell/CrashBanner.svelte';
  import Header from '$lib/components/shell/Header.svelte';
  import NewSessionDialog from '$lib/components/dialogs/NewSessionDialog.svelte';
  import ProbeRail from '$lib/components/rail/ProbeRail.svelte';
  import ShortcutsOverlay from '$lib/components/shell/ShortcutsOverlay.svelte';
  import { shell } from '$lib/components/shell/shell.svelte';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { status } from '$lib/stores/status.svelte';

  let { children }: { children: Snippet } = $props();

  const path: string = $derived(page.url.pathname);
  /** First run (T33) has no header (brief 6). */
  const bare = $derived(path === '/welcome' || path.startsWith('/welcome/'));
  /** The rail shows in Probe and Studies only (D15, brief 6.2). */
  const railVisible = $derived(
    path === '/probe' ||
      path.startsWith('/probe/') ||
      path === '/studies' ||
      path.startsWith('/studies/'),
  );

  onMount(() => capabilities.start());

  /** Typing a "?" into a field types it. */
  function inField(t: EventTarget | null): boolean {
    if (!(t instanceof HTMLElement)) return false;
    return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
  }

  // Capture phase, so the overlay (the topmost layer) closes before the drawer,
  // a menu or a dialog underneath sees the same Escape.
  $effect(() => {
    const onCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && shell.shortcutsOpen) {
        e.preventDefault();
        e.stopPropagation();
        shell.shortcutsOpen = false;
      }
    };
    window.addEventListener('keydown', onCapture, true);
    return () => window.removeEventListener('keydown', onCapture, true);
  });

  function onKey(e: KeyboardEvent) {
    if (bare || e.key !== '?' || e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (inField(e.target)) return;
    e.preventDefault();
    shell.toggleShortcuts();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if bare}
  {@render children()}
{:else}
  <div
    class="flex h-screen flex-col overflow-hidden bg-bg pb-9 text-text"
    data-busy={status.busy ? 'true' : 'false'}
  >
    <Header />
    <CrashBanner />
    <div class="flex min-h-0 flex-1">
      {#if railVisible}
        <ProbeRail />
      {/if}
      <main class="min-w-0 flex-1 overflow-y-auto p-4" data-testid="workspace">
        {@render children()}
      </main>
    </div>
  </div>
  <StatusStrip />
  <SettingsDrawer open={shell.settingsOpen} onClose={() => shell.closeSettings()}>
    <SettingsSections />
  </SettingsDrawer>
  <ShortcutsOverlay open={shell.shortcutsOpen} onClose={() => (shell.shortcutsOpen = false)} />
  <NewSessionDialog open={shell.newSessionOpen} onClose={() => (shell.newSessionOpen = false)} />
  <FirstTimeTip />
{/if}
