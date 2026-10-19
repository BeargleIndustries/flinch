<!--
  Stand-in for a screen whose task has not landed yet: the screen's name, its
  opening research question (brief 5.7 rule 5), and an empty state. Screens
  that need a session show "No session yet" instead while none is picked.
  Each screen task replaces its route's use of this component.
-->
<script lang="ts">
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { SHELL } from '$lib/copy/shell';
  import NoSession from './NoSession.svelte';
  import { session } from '$lib/stores/session.svelte';

  interface Props {
    title: string;
    question: string;
    /** Probe, Framings, Repeat runs, Sequences and Baselines need a session (brief 4.1). */
    needsSession?: boolean;
  }

  let { title, question, needsSession = false }: Props = $props();
</script>

<section class="max-w-[880px]" data-testid="screen-placeholder">
  <h1 class="text-base font-semibold text-text">{title}</h1>
  <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
    {question}
  </p>
  <div class="mt-6 rounded-xl border border-dashed border-border">
    {#if needsSession && session.loaded && !session.current}
      <NoSession />
    {:else}
      <EmptyState title={SHELL.notBuiltTitle} body={SHELL.notBuiltBody} />
    {/if}
  </div>
</section>
