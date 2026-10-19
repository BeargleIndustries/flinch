<!--
  First run, step 1: Welcome (brief 9.8). "Get started" records the step as
  left and goes to the Python step; a later visit to /welcome resumes after
  the step last left (`flinch:onboarding_step`, brief 4.3).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowRight, ChevronDown } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import StepShell from '$lib/components/welcome/StepShell.svelte';
  import { PRIMARY } from '$lib/components/welcome/styles';
  import { WELCOME } from '$lib/copy/onboarding';
  import { SCREENS } from '$lib/copy/screens';
  import { nextPath, resumePath } from '$lib/onboarding';
  import { read, write } from '$lib/prefs';

  onMount(() => {
    const resume = resumePath(read('onboarding_step'));
    if (resume) void goto(resume, { replaceState: true });
  });

  function start(): void {
    write('onboarding_step', 'welcome');
    void goto(nextPath('welcome'));
  }
</script>

<StepShell copy={SCREENS['welcome.1']}>
  {#snippet actions()}
    <button type="button" class={PRIMARY} onclick={start}>
      {WELCOME.start}
      <ArrowRight
        class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  {/snippet}
</StepShell>

<details class="group mt-6 rounded-xl border border-border bg-surface/50 px-6 py-4">
  <summary
    class="flex cursor-pointer list-none items-center gap-2 text-sm text-text3 hover:text-text2"
  >
    <ChevronDown class="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
    {WELCOME.whatIsThis}
  </summary>
  <div class="mt-4 space-y-3 text-sm leading-relaxed text-text3" data-testid="welcome-about">
    {#each WELCOME.about as para, i (i)}
      <p class={i === WELCOME.about.length - 1 ? 'text-text4' : ''}>{para}</p>
    {/each}
  </div>
</details>
