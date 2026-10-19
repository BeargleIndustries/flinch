<!--
  The settings drawer's content (brief 9.7). T19 fills this file with the
  Keys, Local models, Coach and Developer sections; the root layout already
  mounts it inside SettingsDrawer. Until then it shows the two Developer facts
  the shell already reads from /health (D25).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import CopyButton from '$lib/components/CopyButton.svelte';
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { appVersion } from '$lib/tauri';

  let app = $state('dev');
  const h = $derived(capabilities.health);

  onMount(() => {
    appVersion().then(
      (v) => (app = v),
      () => {},
    );
  });
</script>

<section aria-labelledby="settings-developer" class="space-y-3" data-testid="settings-sections">
  <h3
    id="settings-developer"
    class="text-[10px] font-semibold uppercase tracking-[0.12em] text-text4"
  >
    Developer
  </h3>
  <dl class="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-2 text-xs">
    <dt class="pt-0.5 text-text4">Database</dt>
    <dd class="flex min-w-0 items-start gap-2">
      <span class="min-w-0 flex-1 break-all font-mono text-[11px] text-text2"
        >{h?.db_path ?? '-'}</span
      >
      {#if h?.db_path}<CopyButton text={h.db_path} />{/if}
    </dd>
    <dt class="text-text4">Versions</dt>
    <dd class="font-mono text-[11px] text-text2">App {app} · Sidecar {h?.version ?? '-'}</dd>
  </dl>
</section>
