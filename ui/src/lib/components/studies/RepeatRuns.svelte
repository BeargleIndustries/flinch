<!--
  Repeat runs (brief 8.3, D16; formerly Stat Analysis): opens with its
  research question; "No session yet" while none is picked (brief 8: the
  screen needs a session). Set up (probes and N), the live run while one is
  going in this session, then Results: the session's runs and the selected
  run's split and calls.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import NoSession from '$lib/components/shell/NoSession.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import { REPEAT } from '$lib/copy/studies';
  import { session } from '$lib/stores/session.svelte';
  import RepeatLive from './RepeatLive.svelte';
  import RepeatResults from './RepeatResults.svelte';
  import RepeatSetup from './RepeatSetup.svelte';
  import { repeat } from './repeat.svelte';

  const sessionId = $derived(session.current?.id ?? null);
  const noSession = $derived(session.loaded && !session.current);

  // The list follows the current session; each visit reads it again.
  $effect(() => {
    const id = sessionId;
    if (id === null) return;
    untrack(() => void repeat.load(id));
  });
</script>

<section class="flex max-w-[1040px] flex-col gap-4 pb-6" data-testid="repeat-screen">
  <header>
    <h1 class="text-base font-semibold text-text">{REPEAT.title}</h1>
    <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS.repeat}
    </p>
  </header>

  {#if noSession}
    <div class="rounded-xl border border-dashed border-border"><NoSession /></div>
  {:else if sessionId !== null}
    {#key sessionId}
      {@const live = repeat.shownFor(sessionId)}
      <div
        class="grid items-start gap-4 {live ? 'xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]' : ''}"
      >
        <RepeatSetup {sessionId} />
        {#if live}
          <RepeatLive />
        {/if}
      </div>
      <RepeatResults {sessionId} />
    {/key}
  {/if}
</section>
