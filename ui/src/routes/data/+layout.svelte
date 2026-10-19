<!--
  Data section (brief 6.3): the sub-tab strip with the D16 names over the
  current screen.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import TabStrip from '$lib/components/shell/TabStrip.svelte';
  import { DATA_TABS, SHELL } from '$lib/copy/shell';

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-full flex-col gap-5">
  <TabStrip tabs={DATA_TABS} label={SHELL.dataLabel} />
  {@render children()}
</div>
