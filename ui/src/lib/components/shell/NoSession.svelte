<!--
  "No session yet" (brief 6.5): shown by every Probe screen and the four
  session-scoped Studies screens while no session is picked.
-->
<script lang="ts">
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { SCREENS } from '$lib/copy/screens';
  import { SHELL } from '$lib/copy/shell';
  import { shell } from './shell.svelte';
</script>

<div data-testid="no-session">
  <EmptyState
    title={SCREENS['noSession.title']}
    body={SCREENS['noSession.body']}
    action={{ label: SHELL.newSession, onClick: () => shell.openNewSession() }}
  />
</div>
