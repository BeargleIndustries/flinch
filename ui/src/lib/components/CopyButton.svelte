<!--
  Copies `text` to the clipboard and says "Copied" for 1.5 s (brief 5.6).
-->
<script lang="ts">
  import { Check, Copy } from 'lucide-svelte';

  interface Props {
    text: string;
    label?: string;
  }

  let { text, label = 'Copy' }: Props = $props();

  const COPIED_MS = 1500;

  let copied = $state(false);
  let failed = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copy() {
    failed = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      failed = true;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      copied = false;
      failed = false;
    }, COPIED_MS);
  }

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });
</script>

<button
  type="button"
  onclick={copy}
  aria-live="polite"
  class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
>
  {#if copied}
    <Check class="h-3 w-3 text-ok" aria-hidden="true" />
    <span>Copied</span>
  {:else if failed}
    <span class="text-danger">Copy failed</span>
  {:else}
    <Copy class="h-3 w-3" aria-hidden="true" />
    <span>{label}</span>
  {/if}
</button>
