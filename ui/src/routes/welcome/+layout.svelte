<!--
  First run (brief 9.8, D26): Pry's welcome layout with its atmosphere (an
  indigo wash and a faint grid) and the step dots Welcome, Python, Key,
  Probes, Done. The dots fill up to and including the current step. The root
  layout renders /welcome/* bare, without the header or the status strip.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import FlinchMark from '$lib/components/shell/FlinchMark.svelte';
  import { WELCOME } from '$lib/copy/onboarding';
  import { WELCOME_STEPS, stepIndex } from '$lib/onboarding';

  let { children }: { children: Snippet } = $props();

  const current = $derived(stepIndex(page.url.pathname));
</script>

<div class="relative min-h-screen overflow-hidden bg-bg text-text">
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(var(--accent)/0.15),transparent_60%)]"
    aria-hidden="true"
  ></div>
  <div
    class="welcome-grid pointer-events-none absolute inset-0 opacity-[0.03]"
    aria-hidden="true"
  ></div>

  <div class="relative flex min-h-screen flex-col items-center px-6 pb-12 pt-16">
    <header class="mb-10 flex flex-col items-center text-center">
      <FlinchMark size={28} class="mb-4" />
      <div class="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-accentHover/70">
        {WELCOME.eyebrow}
      </div>
      <h1 class="text-3xl font-semibold text-text">{WELCOME.title}</h1>
    </header>

    <ol
      class="mb-10 flex items-center gap-2"
      aria-label={WELCOME.dotsLabel}
      data-testid="welcome-dots"
    >
      {#each WELCOME_STEPS as step, i (step.slug)}
        <li class="flex items-center gap-2">
          <span
            class="block h-2.5 w-2.5 rounded-full transition-all duration-300 {i <= current
              ? 'bg-accent shadow-[0_0_12px_rgb(var(--accent)/0.6)]'
              : 'bg-borderStrong'}"
            title={step.label}
            data-testid="welcome-dot"
            data-step={step.slug}
            data-filled={i <= current ? 'true' : 'false'}
            aria-current={i === current ? 'step' : undefined}
          >
            <span class="sr-only">{WELCOME.dot(step.label, i + 1, WELCOME_STEPS.length)}</span>
          </span>
          {#if i < WELCOME_STEPS.length - 1}
            <span
              class="block h-px w-6 transition-colors duration-300 {i < current
                ? 'bg-accent/60'
                : 'bg-border'}"
              aria-hidden="true"
            ></span>
          {/if}
        </li>
      {/each}
    </ol>

    <main class="w-full max-w-2xl" data-testid="welcome-step">
      {@render children()}
    </main>
  </div>
</div>

<style>
  .welcome-grid {
    background-image:
      linear-gradient(rgb(255 255 255) 1px, transparent 1px),
      linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px);
    background-size: 32px 32px;
  }
</style>
