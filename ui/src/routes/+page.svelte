<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isTauri } from '$lib/is-tauri';
  import { startPath } from '$lib/onboarding';
  import { read } from '$lib/prefs';
  import { runtimeStatus, type RuntimeStatus } from '$lib/tauri';

  // "/" has no screen of its own (brief 4.2): the first run until
  // `flinch:onboarding_done` is "true", then the Probe section. The desktop
  // app also checks the runtime, so a missing or outdated one is set up again.
  onMount(() => {
    const done = read('onboarding_done');
    const runtime: Promise<RuntimeStatus | null> =
      done === 'true' && isTauri() ? runtimeStatus().catch(() => null) : Promise.resolve(null);
    void runtime.then((rs) => goto(startPath(done, rs), { replaceState: true }));
  });
</script>
