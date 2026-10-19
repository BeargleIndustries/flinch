<!--
  The custom prompt card (brief 7.3): a monospace textarea in place of the
  probe text. The sidecar saves the sent text as a probe in domain "custom"
  and the rail shows it active once the answer is back.
-->
<script lang="ts">
  import Panel from '$lib/components/Panel.svelte';
  import { PROBE } from '$lib/copy/probe';
  import { FIELD } from './styles';

  interface Props {
    value: string;
    disabled?: boolean;
    onInput: (text: string) => void;
  }

  let { value, disabled = false, onInput }: Props = $props();

  const uid = $props.id();
</script>

<div data-testid="custom-card">
  <Panel eyebrow={PROBE.customEyebrow} title={PROBE.customTitle}>
    <label for="custom-{uid}" class="sr-only">{PROBE.customLabel}</label>
    <textarea
      id="custom-{uid}"
      data-tour="custom-text"
      data-testid="custom-text"
      rows="8"
      maxlength="10000"
      placeholder={PROBE.customPlaceholder}
      {value}
      {disabled}
      oninput={(e) => onInput(e.currentTarget.value)}
      class="{FIELD} resize-y font-mono text-[13px] leading-relaxed"
    ></textarea>
  </Panel>
</div>
