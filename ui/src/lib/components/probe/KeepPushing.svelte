<!--
  "Keep pushing" (brief 7.7 item 1): shown after a pushback that got a
  response. Each follow-up continues the same conversation (B09) and is
  stored as your own words (source "override"); the thread grows and the
  panel stays.
-->
<script lang="ts">
  import Panel from '$lib/components/Panel.svelte';
  import { PROBE } from '$lib/copy/probe';
  import ActionButton from './ActionButton.svelte';
  import { FIELD } from './styles';

  interface Props {
    sending: boolean;
    onSend: (text: string) => Promise<boolean>;
  }

  let { sending, onSend }: Props = $props();

  const uid = $props.id();
  let text = $state('');

  async function send() {
    if (await onSend(text)) text = '';
  }
</script>

<div data-testid="keep-pushing">
  <Panel eyebrow={PROBE.keepEyebrow} title={PROBE.keepTitle} readout={PROBE.keepWhy}>
    <div>
      <label for="keep-{uid}" class="sr-only">{PROBE.keepLabel}</label>
      <textarea
        id="keep-{uid}"
        rows="3"
        maxlength="5000"
        placeholder={PROBE.keepPlaceholder}
        bind:value={text}
        disabled={sending}
        class="{FIELD} resize-y font-mono text-[13px] leading-relaxed"
      ></textarea>
    </div>
    <ActionButton
      variant="secondary"
      label={sending ? PROBE.sendingPushback : PROBE.keepSend}
      why={PROBE.sendPushbackWhy}
      disabled={sending || text.trim() === ''}
      onclick={send}
    />
  </Panel>
</div>
