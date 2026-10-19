<!--
  Empty state (brief 5.6): what is missing, why it matters, and the one action
  that fills it. Centred, max-w-sm.
-->
<script lang="ts">
  interface Props {
    title: string;
    body: string;
    action?: { label: string; onClick: () => void };
  }

  let { title, body, action }: Props = $props();
</script>

<div class="mx-auto flex max-w-sm flex-col items-center gap-2 px-4 py-10 text-center">
  <span class="mb-1 block h-px w-8 bg-borderStrong" aria-hidden="true"></span>
  <h2 class="text-sm font-semibold text-text">{title}</h2>
  <p class="text-sm leading-relaxed text-text3">{body}</p>
  {#if action}
    <button
      type="button"
      onclick={action.onClick}
      class="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accentHover focus:outline-none focus-visible:ring-2 focus-visible:ring-accentHover focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {action.label}
    </button>
  {/if}
</div>
