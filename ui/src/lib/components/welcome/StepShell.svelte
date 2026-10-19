<!--
  One first-run step's card (brief 9.8): the "step 0N" eyebrow, the heading,
  an optional lead and body (screens.ts `welcome.1` to `welcome.5`), the
  step's own content, then its buttons.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { WelcomeStep } from '$lib/copy/screens';

  interface Props {
    copy: WelcomeStep;
    /** The Done step's card: a chip eyebrow and a brighter frame. */
    finale?: boolean;
    children?: Snippet;
    actions?: Snippet;
  }

  let { copy, finale = false, children, actions }: Props = $props();
</script>

<section
  class="relative overflow-hidden rounded-2xl border p-10 backdrop-blur {finale
    ? 'border-accent/40 bg-gradient-to-br from-accentSoft/40 via-surface to-surface shadow-[0_0_80px_-20px_rgb(var(--accent)/0.5)]'
    : 'border-border bg-surface/70 shadow-[0_0_60px_-20px_rgb(var(--accent)/0.3)]'}"
  aria-labelledby="welcome-heading"
>
  {#if finale}
    <div
      class="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-accent/20 blur-3xl"
      aria-hidden="true"
    ></div>
  {/if}
  <div class="relative">
    <div class="mb-6">
      {#if finale}
        <div
          class="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accentSoft/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-accentText"
          data-testid="welcome-eyebrow"
        >
          {copy.eyebrow}
        </div>
      {:else}
        <div
          class="mb-1 font-mono text-xs uppercase tracking-widest text-accentHover"
          data-testid="welcome-eyebrow"
        >
          {copy.eyebrow}
        </div>
      {/if}
      <h2 id="welcome-heading" class="font-semibold text-text {finale ? 'text-4xl' : 'text-3xl'}">
        {copy.heading}
      </h2>
    </div>

    {#if copy.lead}
      <p class="mb-6 max-w-lg text-lg leading-relaxed text-text2" data-testid="welcome-lead">
        {copy.lead}
      </p>
    {/if}
    {#if copy.body}
      <p class="mb-8 text-sm leading-relaxed text-text3" data-testid="welcome-body">{copy.body}</p>
    {/if}

    {#if children}
      {@render children()}
    {/if}

    {#if actions}
      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {@render actions()}
      </div>
    {/if}
  </div>
</section>
