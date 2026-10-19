<!--
  Keyboard shortcuts overlay (brief 7.10, D22): one row per shortcut with its
  key in a kbd chip. `?` anywhere toggles it and Escape closes it; both are
  handled by the root layout. The Probe keys themselves are registered by the
  Probe routes (shortcuts.ts, T17).
-->
<script lang="ts">
  import Dialog from '$lib/components/Dialog.svelte';
  import { SHELL, SHORTCUT_ROWS } from '$lib/copy/shell';

  let { open, onClose }: { open: boolean; onClose: () => void } = $props();
</script>

<Dialog {open} {onClose} title={SHELL.shortcutsTitle} lead={SHELL.shortcutsLead}>
  <table class="w-full border-collapse text-left" data-testid="shortcuts-overlay">
    <tbody>
      {#each SHORTCUT_ROWS as row (row.action)}
        <tr class="border-t border-border first:border-t-0">
          <td class="w-24 py-2 pr-3 align-top">
            <span class="flex gap-1">
              {#each row.keys as k (k)}
                <kbd
                  class="inline-flex h-6 min-w-6 items-center justify-center rounded border border-borderStrong border-b-2 bg-bg px-1.5 font-mono text-[11px] text-text"
                  >{k}</kbd
                >
              {/each}
            </span>
          </td>
          <td class="py-2 pr-3 align-top text-sm text-text">{row.action}</td>
          <td class="py-2 text-right align-top text-xs text-text4">{row.when}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="mt-4 border-t border-border pt-3 text-xs text-text4">{SHELL.shortcutsFooter}</p>
</Dialog>
