<!--
  Coach examples (brief 9.4; I19, D14, B28, B20). No rail (D15). Opens with
  its research question, then the profile select (the I19 union of GET
  /api/coach-profiles and every session's coach_profile, plus "New profile
  name…" which reveals a text field) and every example of that profile, best
  rated first (GET /api/coach-examples?profile=&limit=500). Each example is a
  card (CoachExampleCard) with its rating, an inline pushback edit and a
  two-step delete. Teaching happens in Probe (D14); the empty state says so.
  Controls stay disabled until the reads land.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { COACH } from '$lib/copy/data';
  import { SCREENS } from '$lib/copy/screens';
  import { DEFAULT_COACH_PROFILE, profileOptions } from '$lib/session';
  import { session } from '$lib/stores/session.svelte';
  import { BTN, FIELD, HINT, LABEL } from '../probe/styles';
  import { NEW_PROFILE, chosenProfile } from './coach';
  import { coach } from './coach-store.svelte';
  import CoachExampleCard from './CoachExampleCard.svelte';

  const uid = $props.id();

  let choice = $state(DEFAULT_COACH_PROFILE);
  let typed = $state('');

  const ready = $derived(coach.profilesLoaded && session.loaded);
  const options = $derived(profileOptions(coach.profileNames, session.all));
  const target = $derived(chosenProfile(choice, typed));
  const listBusy = $derived(!coach.loaded);

  // Each visit reads the profile names and the default profile's examples.
  $effect(() => {
    untrack(() => {
      void coach.loadProfiles();
      void coach.load(DEFAULT_COACH_PROFILE);
    });
  });

  function pick(v: string) {
    choice = v;
    if (v === NEW_PROFILE) return;
    void coach.load(v);
  }

  function showTyped(e?: Event) {
    e?.preventDefault();
    const p = chosenProfile(NEW_PROFILE, typed);
    if (p && p !== coach.profile) void coach.load(p);
  }
</script>

<section class="flex max-w-[1180px] flex-col gap-4 pb-6" data-testid="coach-screen">
  <header class="min-w-0">
    <h1 class="text-base font-semibold text-text">{COACH.title}</h1>
    <p class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3" data-testid="screen-question">
      {SCREENS.coach}
    </p>
  </header>

  <div
    class="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3"
  >
    <div class="w-64 min-w-0">
      <label for="coach-profile-{uid}" class={LABEL}>{COACH.profile}</label>
      <select
        id="coach-profile-{uid}"
        class={FIELD}
        value={choice}
        disabled={!ready}
        aria-busy={!ready}
        aria-describedby="coach-profile-hint-{uid}"
        onchange={(e) => pick(e.currentTarget.value)}
        data-testid="coach-profile"
      >
        {#each options as p (p)}
          <option value={p}>{p}</option>
        {/each}
        <option value={NEW_PROFILE}>{COACH.newProfile}</option>
      </select>
    </div>
    {#if choice === NEW_PROFILE}
      <form class="flex items-end gap-2" onsubmit={showTyped}>
        <div class="w-56">
          <label for="coach-typed-{uid}" class={LABEL}>{COACH.newProfileLabel}</label>
          <input
            id="coach-typed-{uid}"
            class={FIELD}
            bind:value={typed}
            placeholder={COACH.newProfilePlaceholder}
            maxlength="200"
            data-testid="coach-profile-typed"
          />
        </div>
        <button type="submit" class={BTN.secondary} disabled={target === null}>{COACH.show}</button>
      </form>
    {/if}
    <p id="coach-profile-hint-{uid}" class="{HINT} basis-full">{COACH.profileHint}</p>
  </div>

  <div class="flex flex-col gap-3" data-testid="coach-examples" aria-busy={listBusy}>
    {#if !coach.loaded}
      <p class="text-xs text-text4">{COACH.loading}</p>
    {:else if coach.error}
      <div class="flex items-center gap-3 rounded-lg border border-danger/40 px-4 py-3">
        <p class="text-sm text-text2">{COACH.failed}</p>
        <button type="button" class={BTN.secondary} onclick={() => void coach.load(coach.profile)}
          >{COACH.loadAgain}</button
        >
      </div>
    {:else if coach.examples.length === 0}
      <p
        class="rounded-lg border border-dashed border-borderStrong px-4 py-8 text-center text-sm leading-relaxed text-text3"
        data-testid="coach-empty"
      >
        {COACH.empty}
      </p>
    {:else}
      <p class="font-mono text-[11px] tabular-nums text-text4" data-testid="coach-count">
        {COACH.count(coach.examples.length, coach.profile)}
      </p>
      {#each coach.examples as ex (ex.id)}
        <CoachExampleCard {ex} busy={coach.busy.has(ex.id)} />
      {/each}
    {/if}
  </div>
</section>
