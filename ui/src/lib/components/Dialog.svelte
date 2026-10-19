<!--
  Dialog frame (brief 5.4, 5.6). z-50 over a dimmed backdrop. Backdrop click
  and Escape close it; focus moves into the dialog on open, stays inside while
  it is open (Tab wraps) and goes back to where it was on close. Enter in a
  single-line input calls `onSubmit`, the footer's primary action.

  Escape is handled on the dialog itself, not the window, so a control inside
  that handles Escape first (a badge menu, a glossary tooltip, an armed
  ConfirmButton) can stop it from closing the dialog.
-->
<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { X } from 'lucide-svelte';
  import { isSubmitKey } from './dialog';

  interface Props {
    open: boolean;
    title: string;
    onClose: () => void;
    width?: 'md' | 'lg';
    children: Snippet;
    footer?: Snippet;
    /** The footer's primary action; Enter in a single-line input runs it. */
    onSubmit?: () => void;
    /** One sentence under the title saying what the dialog is for. */
    lead?: string;
  }

  let { open, title, onClose, width = 'md', children, footer, onSubmit, lead }: Props = $props();

  const uid = $props.id();
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let panel: HTMLDivElement | null = $state(null);
  let returnTo: HTMLElement | null = null;

  function focusables(): HTMLElement[] {
    return panel ? [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
  }

  // Focus in on open, back out on close.
  $effect(() => {
    if (!open) return;
    returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void tick().then(() => {
      if (!panel) return;
      const body = panel.querySelector<HTMLElement>('[data-dialog-body]');
      const first =
        panel.querySelector<HTMLElement>('[autofocus]') ??
        body?.querySelector<HTMLElement>(FOCUSABLE) ??
        panel;
      first.focus();
    });
    return () => {
      const el = returnTo;
      returnTo = null;
      if (el?.isConnected) el.focus({ preventScroll: true });
    };
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (onSubmit && isSubmitKey(e)) {
      e.preventDefault();
      onSubmit();
    }
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

{#if open}
  <div
    role="presentation"
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 pb-10 pt-[12vh]"
    transition:fade={{ duration: 120 }}
    onclick={onBackdrop}
  >
    <div
      bind:this={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-{uid}-title"
      aria-describedby={lead ? `dialog-${uid}-lead` : undefined}
      tabindex="-1"
      onkeydown={onKeydown}
      transition:scale={{ duration: 140, start: 0.97, opacity: 0 }}
      class="w-full rounded-xl border border-border bg-surface p-5 shadow-xl shadow-black/40 focus:outline-none {width ===
      'lg'
        ? 'max-w-2xl'
        : 'max-w-lg'}"
    >
      <header class="mb-4 flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 id="dialog-{uid}-title" class="text-base font-semibold text-text">{title}</h2>
          {#if lead}
            <p id="dialog-{uid}-lead" class="mt-1 text-sm text-text3">{lead}</p>
          {/if}
        </div>
        <button
          type="button"
          onclick={onClose}
          aria-label="Close this dialog"
          class="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-text3 hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover"
        >
          <X class="h-4 w-4" />
        </button>
      </header>
      <div data-dialog-body class="text-sm text-text2">
        {@render children()}
      </div>
      {#if footer}
        <footer class="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}
