<!--
  The pushback panel (brief 7.6, D13): one editable box prefilled with the
  coach's draft, "Send pushback" and "Skip". The status line says, before
  anything is sent, whether the text goes as the coach's draft or as your
  override (an edited draft is stored with source "override").
-->
<script lang="ts">
  import Panel from '$lib/components/Panel.svelte';
  import type { Run } from '$lib/api/types';
  import { moveCopy } from '$lib/copy/moves';
  import { PROBE } from '$lib/copy/probe';
  import { SCREENS } from '$lib/copy/screens';
  import ActionButton from './ActionButton.svelte';
  import { FIELD, HINT } from './styles';
  import { coachSuggestion, pushbackStatus } from './thread';

  interface Props {
    run: Run;
    draft: string;
    sending: boolean;
    error: string | null;
    onDraft: (text: string) => void;
    onSend: () => void;
    onSkip: () => void;
  }

  let { run, draft, sending, error, onDraft, onSend, onSkip }: Props = $props();

  const suggestion = $derived(coachSuggestion(run));
  const move = $derived(moveCopy(suggestion?.move_suggested ?? run.coach_move_suggested));
  const pattern = $derived(suggestion?.pattern_detected ?? run.coach_pattern_detected);
  const kind = $derived(pushbackStatus(draft, suggestion?.pushback_draft ?? ''));
  const statusLine = $derived(
    kind === 'empty'
      ? SCREENS['pushback.empty']
      : kind === 'edited'
        ? SCREENS['pushback.edited']
        : SCREENS['pushback.unedited'],
  );
</script>

<div data-testid="pushback-panel">
  <Panel eyebrow={PROBE.coachEyebrow} title={PROBE.pushTitle} anchor="pushback-panel">
    <div class="flex flex-col gap-0.5 text-xs text-text3" data-testid="coach-lines">
      {#if suggestion}
        {#if pattern}<p>{PROBE.pattern(pattern)}</p>{/if}
        {#if move}<p>{PROBE.move(move.name, move.description)}</p>{/if}
      {:else}
        <p>{SCREENS['pushback.noCoach']}</p>
      {/if}
    </div>

    <div>
      <label for="pushback-text" class="sr-only">{PROBE.pushbackLabel}</label>
      <textarea
        id="pushback-text"
        rows="5"
        maxlength="5000"
        value={draft}
        disabled={sending}
        oninput={(e) => onDraft(e.currentTarget.value)}
        aria-describedby="pushback-status"
        class="{FIELD} resize-y font-mono text-[13px] leading-relaxed"
      ></textarea>
      <p
        id="pushback-status"
        role="status"
        aria-live="polite"
        data-testid="pushback-status"
        data-state={kind}
        class="mt-1 text-xs {kind === 'edited' ? 'text-warn' : 'text-text4'}"
      >
        {statusLine}
      </p>
    </div>

    <div class="flex flex-wrap items-start gap-x-4 gap-y-2">
      <ActionButton
        variant="primary"
        label={sending ? PROBE.sendingPushback : PROBE.sendPushback}
        why={PROBE.sendPushbackWhy}
        kbd="P"
        anchor="send-pushback"
        disabled={sending || kind === 'empty'}
        onclick={onSend}
      />
      <ActionButton
        variant="ghost"
        label={PROBE.skip}
        why={PROBE.skipWhy}
        kbd="K"
        disabled={sending}
        onclick={onSkip}
      />
      <p class="{HINT} ml-auto self-center">{PROBE.pushHint}</p>
    </div>
    {#if error}
      <p class="text-xs text-danger" role="alert" data-testid="workspace-error">{error}</p>
    {/if}
  </Panel>
</div>
