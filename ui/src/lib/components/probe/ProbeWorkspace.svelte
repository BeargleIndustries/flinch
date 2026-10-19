<!--
  The Probe workspace (brief 7): one state at a time, driven by
  `probes.machine` ($lib/probe-machine). Every state opens with the research
  question it answers (principle 1), then:
    idle      system prompt, Run every probe, Save a baseline (7.1); while a
              batch runs (and until Back) the batch panel instead (7.8)
    selected  probe card, Send probe (S), policy links (7.2)
    custom    custom prompt box, Send custom prompt (S) (7.3)
    sending   the card, "Waiting for {model}…" (7.4)
    pushback  thread, readout, pushback panel: Send pushback (P), Skip (K) (7.5, 7.6)
    done      thread, Keep pushing, Next probe (N), Run again (R), Teach the
              coach this exchange, notes (7.7)
  Requests live in workspace.svelte.ts. Both Probe routes mount this
  component, which attaches the Probe shortcuts (shortcuts.ts) while mounted.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { LoaderCircle } from 'lucide-svelte';
  import NoSession from '$lib/components/shell/NoSession.svelte';
  import { shell } from '$lib/components/shell/shell.svelte';
  import { PROBE, QUESTION } from '$lib/copy/probe';
  import { SCREENS } from '$lib/copy/screens';
  import { attachShortcuts } from '$lib/shortcuts';
  import { probes } from '$lib/stores/probe.svelte';
  import { session } from '$lib/stores/session.svelte';
  import { quickTour } from '$lib/tour/state.svelte';
  import ActionButton from './ActionButton.svelte';
  import BatchRun from './BatchRun.svelte';
  import { batch } from './batch.svelte';
  import CustomPrompt from './CustomPrompt.svelte';
  import DoneActions from './DoneActions.svelte';
  import IdleView from './IdleView.svelte';
  import KeepPushing from './KeepPushing.svelte';
  import NotesPanel from './NotesPanel.svelte';
  import PolicyLinks from './PolicyLinks.svelte';
  import ProbeCard from './ProbeCard.svelte';
  import PushbackPanel from './PushbackPanel.svelte';
  import Thread from './Thread.svelte';
  import { HINT } from './styles';
  import { hadPushbackReply, openingText } from './thread';
  import { workspace } from './workspace.svelte';

  interface Props {
    /** Set on /probe/runs/[runId] (brief 7.9). */
    savedRunId?: number | null;
  }

  let { savedRunId = null }: Props = $props();

  const m = $derived(probes.machine);
  const phase = $derived(m.phase);
  const run = $derived(workspace.run);
  const items = $derived(workspace.items);
  const noSession = $derived(session.loaded && !session.current);
  const question = $derived(phase === 'idle' ? SCREENS['probe.idle'] : QUESTION[phase]);
  const customCard = $derived(
    phase === 'custom' || (phase === 'sending' && m.sentFrom === 'custom'),
  );
  const waiting = $derived(phase === 'sending' || phase === 'response');
  const sendRow = $derived(phase === 'selected' || phase === 'custom' || phase === 'sending');
  const canSend = $derived(
    phase === 'selected' || (phase === 'custom' && workspace.customText.trim() !== ''),
  );
  const fallback = $derived(
    run && workspace.turnsFor === run.id ? openingText(workspace.turns) : null,
  );
  const linkProbeId = $derived(probes.active?.id ?? null);
  const model = $derived(workspace.model);

  /** Run every probe (brief 7.8): the batch panel replaces the idle view until Back. */
  function runAll(delayMs: number): void {
    const id = session.current?.id;
    if (id == null) return;
    void batch.start(id, delayMs, probes.list);
  }

  onMount(() =>
    attachShortcuts(
      {
        send: () => void workspace.send(),
        pushback: () => void workspace.pushback(),
        skip: () => void workspace.skip(),
        next: () => workspace.next(),
        runAgain: () => workspace.runAgain(),
      },
      () => ({
        phase: probes.machine.phase,
        overlayOpen: shell.shortcutsOpen,
        settingsOpen: shell.settingsOpen,
        tourOpen: quickTour.open,
        busy: probes.machine.sending,
      }),
    ),
  );
</script>

<section
  class="flex max-w-[880px] flex-col gap-4 pb-6"
  data-testid="probe-workspace"
  data-phase={phase}
>
  <header>
    {#if savedRunId !== null}
      <p class="text-[10px] font-medium uppercase tracking-widest text-accentText">
        {PROBE.savedEyebrow(savedRunId)}
      </p>
    {/if}
    <h1 class="text-base font-semibold text-text">{PROBE.title}</h1>
    {#key question}
      <p
        class="mt-1 max-w-[68ch] text-sm leading-relaxed text-text3"
        data-testid="screen-question"
        data-tour={phase === 'idle' ? 'probe-idle' : undefined}
        in:fly={{ y: 4, duration: 180 }}
      >
        {question}
      </p>
    {/key}
  </header>

  {#if noSession}
    <div class="rounded-xl border border-dashed border-border"><NoSession /></div>
  {:else if phase === 'idle' && batch.shownFor(session.current?.id)}
    <BatchRun />
  {:else if phase === 'idle'}
    <IdleView
      systemPrompt={session.current?.system_prompt ?? null}
      probeCount={probes.list.length}
      onRunAll={runAll}
    />
  {:else}
    {#if customCard}
      <CustomPrompt
        value={workspace.customText}
        disabled={phase === 'sending'}
        onInput={(t) => (workspace.customText = t)}
      />
    {:else}
      <ProbeCard probe={probes.active} fallbackText={fallback} />
    {/if}

    {#if sendRow}
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-start gap-4">
          <ActionButton
            variant="primary"
            label={customCard ? PROBE.sendCustom : PROBE.send}
            why={phase === 'custom' && !canSend ? PROBE.customEmpty : PROBE.sendWhy(model)}
            kbd="S"
            anchor="send-button"
            testid="send-button"
            disabled={!canSend}
            onclick={() => void workspace.send()}
          />
          <p class="{HINT} mt-2">{PROBE.sendHint}</p>
        </div>
        {#if m.error && !waiting}
          <p class="text-xs text-danger" role="alert" data-testid="workspace-error">{m.error}</p>
        {/if}
      </div>
    {/if}

    {#if waiting}
      <div
        role="status"
        data-testid="sending-panel"
        class="relative flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface px-4 py-3"
        in:fly={{ y: 6, duration: 160 }}
      >
        <span
          class="absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-accent to-transparent"
          aria-hidden="true"
        ></span>
        <LoaderCircle
          class="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accentText"
          aria-hidden="true"
        />
        <div>
          <p class="text-sm text-text">{PROBE.waiting(model)}</p>
          <p class={HINT}>{PROBE.waitingWhy}</p>
        </div>
      </div>
    {/if}

    {#if linkProbeId !== null && !waiting}
      {#key linkProbeId}
        <PolicyLinks probeId={linkProbeId} />
      {/key}
    {/if}

    {#if run && items.length > 0 && (phase === 'pushback' || phase === 'done')}
      <div in:fly={{ y: 8, duration: 200 }}>
        <Thread {items} {run} onCorrect={(item, v) => void workspace.correct(item, v)} />
      </div>
    {/if}

    {#if run && phase === 'pushback'}
      <div in:fly={{ y: 8, duration: 200, delay: 60 }}>
        <PushbackPanel
          {run}
          draft={m.draft}
          sending={m.sending}
          error={m.error}
          onDraft={(text) => probes.dispatch({ type: 'DRAFT', text })}
          onSend={() => void workspace.pushback()}
          onSkip={() => void workspace.skip()}
        />
      </div>
    {/if}

    {#if run && phase === 'done'}
      {#if hadPushbackReply(run)}
        <KeepPushing sending={m.sending} onSend={(t) => workspace.continueWith(t)} />
      {/if}
      <DoneActions
        {run}
        taught={workspace.taught.has(run.id)}
        teaching={workspace.teaching}
        error={m.error}
        onNext={() => workspace.next()}
        onRunAgain={() => workspace.runAgain()}
        onTeach={() => void workspace.teach()}
      />
      {#key run.id}
        <NotesPanel
          annotation={workspace.annotation}
          onSave={(body) => workspace.saveAnnotation(body)}
          loadTags={() => workspace.tagSuggestions()}
        />
      {/key}
    {/if}
  {/if}
</section>
