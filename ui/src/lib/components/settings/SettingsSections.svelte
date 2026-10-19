<!--
  The settings drawer's content (brief 9.7, D10): one panel, top to bottom,
  Keys, Local models (Ollama), Coach and Developer. The root layout mounts it
  inside SettingsDrawer, so each section reads its data when the drawer opens.
-->
<script lang="ts">
  import CoachSection from './CoachSection.svelte';
  import DeveloperSection from './DeveloperSection.svelte';
  import KeysSection from './KeysSection.svelte';
  import OllamaSection from './OllamaSection.svelte';
</script>

<div class="space-y-8" data-testid="settings-sections">
  <KeysSection />
  <OllamaSection />
  <CoachSection />
  <DeveloperSection />
</div>
