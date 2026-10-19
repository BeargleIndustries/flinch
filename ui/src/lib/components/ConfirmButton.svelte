<!--
  Two-step button (brief 5.6), the app's replacement for the browser's confirm box: the
  first click swaps the label to `confirmLabel` for 4 s; a second click in that
  time runs `onConfirm`. Escape or leaving the button cancels.
-->
<script lang="ts">
  interface Props {
    label: string;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
    danger?: boolean;
    disabled?: boolean;
    /** Extra classes for size and placement. */
    class?: string;
  }

  let {
    label,
    confirmLabel,
    onConfirm,
    danger = false,
    disabled = false,
    class: extra = '',
  }: Props = $props();

  const ARM_MS = 4000;

  let armed = $state(false);
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function disarm() {
    armed = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function click() {
    if (busy) return;
    if (!armed) {
      armed = true;
      timer = setTimeout(disarm, ARM_MS);
      return;
    }
    disarm();
    busy = true;
    try {
      await onConfirm();
    } finally {
      busy = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (armed && e.key === 'Escape') {
      e.stopPropagation();
      disarm();
    }
  }

  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });

  const tone = $derived(
    armed
      ? danger
        ? 'border-danger bg-danger text-white hover:bg-danger/90'
        : 'border-accent bg-accent text-white hover:bg-accentHover'
      : danger
        ? 'border-danger/40 text-danger hover:bg-dangerSoft'
        : 'border-borderStrong text-text2 hover:bg-surface2 hover:text-text',
  );
</script>

<button
  type="button"
  onclick={click}
  onkeydown={onKey}
  onblur={disarm}
  disabled={disabled || busy}
  aria-live="polite"
  data-armed={armed}
  class="inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-50 {tone} {extra}"
>
  {armed ? confirmLabel : label}
</button>
