<!--
  First run, step 5: Done (brief 9.8). Both buttons write
  `flinch:onboarding_done`, so `/` opens Probe from now on. "Take the tour"
  goes to /probe?tour=1 (the root layout's Tour opens the New session dialog
  first when there is no session, then starts); "Go straight in" also writes
  `flinch:tour_seen`.
-->
<script lang="ts">
  import { ArrowRight, PlayCircle } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import StepShell from '$lib/components/welcome/StepShell.svelte';
  import { PRIMARY, SECONDARY } from '$lib/components/welcome/styles';
  import { WELCOME } from '$lib/copy/onboarding';
  import { SCREENS } from '$lib/copy/screens';
  import { remove, write } from '$lib/prefs';

  function finish(tour: boolean): void {
    write('onboarding_done', 'true');
    remove('onboarding_step');
    if (tour) {
      void goto('/probe?tour=1');
      return;
    }
    write('tour_seen', 'true');
    void goto('/probe');
  }
</script>

<StepShell copy={SCREENS['welcome.5']} finale>
  {#snippet actions()}
    <button type="button" class={PRIMARY} onclick={() => finish(true)}>
      <PlayCircle class="h-4 w-4" aria-hidden="true" />
      {WELCOME.takeTour}
    </button>
    <button type="button" class={SECONDARY} onclick={() => finish(false)}>
      {WELCOME.goStraightIn}
      <ArrowRight
        class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  {/snippet}
</StepShell>
