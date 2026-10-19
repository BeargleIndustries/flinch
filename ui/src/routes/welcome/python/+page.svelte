<!--
  First run, step 2: Setting up Python (brief 9.8, I24, 12.3).

  Desktop, from the shell's runtime_status ({ready, installed, current}):
  - ready: wait for a 200 from /health, then go on to the key step;
  - installed and current: the shell is launching the sidecar; poll /health
    every 750 ms for up to 60 s;
  - otherwise: run bootstrap_runtime_command, which reports `bootstrap:progress`
    (stage labels and a bar), `bootstrap:log` lines and, for a background
    launch failure, `bootstrap:error`, then launches the sidecar.
  A failure shows the error card: the detail, Retry, Copy error details (the
  detail plus copy_diagnostic) and the anti-virus note.

  Browser (dev): there is nothing to install. The step says to start the
  sidecar by hand and enables Continue once /health answers.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCcw } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { request, resetBase } from '$lib/api/client';
  import { ROUTES } from '$lib/api/endpoints';
  import CopyButton from '$lib/components/CopyButton.svelte';
  import BootstrapProgress from '$lib/components/welcome/BootstrapProgress.svelte';
  import StepShell from '$lib/components/welcome/StepShell.svelte';
  import { appendLog, errorDetails } from '$lib/components/welcome/bootstrap';
  import { PRIMARY, SECONDARY } from '$lib/components/welcome/styles';
  import { WELCOME } from '$lib/copy/onboarding';
  import { SCREENS } from '$lib/copy/screens';
  import { friendlyError } from '$lib/errors';
  import { isTauri } from '$lib/is-tauri';
  import { nextPath } from '$lib/onboarding';
  import { write } from '$lib/prefs';
  import { status } from '$lib/stores/status.svelte';
  import {
    bootstrapRuntime,
    copyDiagnostic,
    onBootstrapError,
    onBootstrapLog,
    onBootstrapProgress,
    runtimeStatus,
    tauriError,
    type Unlisten,
  } from '$lib/tauri';

  const POLL_MS = 750;
  const LAUNCH_WAIT_MS = 60_000;

  const desktop = isTauri();

  /** checking: asking the shell; installing: bootstrap runs; starting: waiting for /health. */
  type Phase = 'checking' | 'installing' | 'starting' | 'ready' | 'failed';
  let phase = $state<Phase>('checking');
  let stage = $state('probing');
  let message = $state('');
  let progress = $state(-1);
  let bytesDownloaded = $state<number | null>(null);
  let bytesTotal = $state<number | null>(null);
  let log = $state<string[]>([]);
  let error = $state<string | null>(null);
  let diagnostic = $state<string | null>(null);

  let destroyed = false;
  /** Bumped by each attempt, so a stale attempt never moves the page. */
  let attempt = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** One /health check. Never throws. */
  async function healthy(): Promise<boolean> {
    try {
      await status.track(request(ROUTES.health));
      return true;
    } catch {
      return false;
    }
  }

  /** Polls /health until it answers, `until` passes, or the attempt is stale. */
  async function waitForHealth(run: number, until: number): Promise<boolean> {
    resetBase();
    while (!destroyed && run === attempt) {
      if (await healthy()) return true;
      if (Date.now() + POLL_MS > until) return false;
      await sleep(POLL_MS);
    }
    return false;
  }

  function fail(detail: string): void {
    attempt++;
    error = detail;
    phase = 'failed';
    diagnostic = null;
    if (desktop) {
      copyDiagnostic()
        .then((d) => (diagnostic = d))
        .catch(() => (diagnostic = null));
    }
  }

  function goOn(): void {
    write('onboarding_step', 'python');
    void goto(nextPath('python'));
  }

  /** Dev: wait (without a deadline) for the sidecar the developer starts. */
  async function watchDev(run: number): Promise<void> {
    phase = 'starting';
    if (await waitForHealth(run, Number.POSITIVE_INFINITY)) phase = 'ready';
  }

  /** Desktop: the runtime_status branches of brief 9.8. */
  async function runDesktop(run: number): Promise<void> {
    phase = 'checking';
    error = null;
    try {
      const rs = await runtimeStatus();
      if (run !== attempt) return;
      if (!rs.ready && !(rs.installed && rs.current)) {
        phase = 'installing';
        log = [];
        stage = 'probing';
        progress = -1;
        await bootstrapRuntime();
        if (run !== attempt) return;
      }
      phase = 'starting';
      if (await waitForHealth(run, Date.now() + LAUNCH_WAIT_MS)) {
        phase = 'ready';
        goOn();
      } else if (run === attempt && !destroyed) {
        fail(WELCOME.sidecarTimeout);
      }
    } catch (e) {
      if (run === attempt) fail(tauriError(e).message || friendlyError(e).message);
    }
  }

  function start(): void {
    const run = ++attempt;
    if (desktop) void runDesktop(run);
    else void watchDev(run);
  }

  onMount(() => {
    const unlisten: Unlisten[] = [];
    if (desktop) {
      const add = (p: Promise<Unlisten>) =>
        void p.then((u) => (destroyed ? u() : unlisten.push(u)));
      add(
        onBootstrapProgress((p) => {
          stage = p.stage;
          message = p.message;
          progress = p.progress;
          bytesDownloaded = p.bytes_downloaded;
          bytesTotal = p.bytes_total;
        }),
      );
      add(onBootstrapLog((line) => (log = appendLog(log, line))));
      add(onBootstrapError((e) => fail(e.detail)));
    }
    start();
    return () => {
      destroyed = true;
      for (const u of unlisten) u();
    };
  });
</script>

<StepShell copy={SCREENS['welcome.2']}>
  {#if !desktop}
    <div
      class="rounded-xl border border-border bg-bg/60 p-5"
      role="status"
      aria-live="polite"
      data-testid="python-dev"
    >
      <p class="text-sm leading-relaxed text-text2">{WELCOME.devNotice}</p>
      <p class="mt-3 flex items-center gap-2 text-xs" data-testid="python-sidecar">
        {#if phase === 'ready'}
          <CheckCircle2 class="h-4 w-4 text-ok" aria-hidden="true" />
          <span class="text-ok">{WELCOME.sidecarReady}</span>
        {:else}
          <LoaderCircle class="h-4 w-4 animate-spin text-text4" aria-hidden="true" />
          <span class="text-text4">{WELCOME.sidecarWaiting}</span>
        {/if}
      </p>
    </div>
  {:else if phase === 'failed'}
    <div
      class="rounded-xl border border-danger/40 bg-dangerSoft/30 p-5"
      role="alert"
      data-testid="python-error"
    >
      <div class="flex items-start gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-text">{WELCOME.failedTitle}</p>
          <pre
            class="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text3"
            data-testid="python-error-detail">{error}</pre>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" class={SECONDARY} onclick={start}>
          <RefreshCcw class="h-4 w-4" aria-hidden="true" />
          {WELCOME.retry}
        </button>
        <CopyButton text={errorDetails(error ?? '', diagnostic)} label={WELCOME.copyDetails} />
      </div>
      <p class="mt-4 text-xs leading-relaxed text-text4">{WELCOME.avNote}</p>
    </div>
    {#if log.length}
      <div class="mt-4">
        <BootstrapProgress {stage} {message} {progress} {bytesDownloaded} {bytesTotal} {log} />
      </div>
    {/if}
  {:else if phase === 'installing'}
    <BootstrapProgress {stage} {message} {progress} {bytesDownloaded} {bytesTotal} {log} />
  {:else}
    <p
      class="flex items-center gap-2 text-sm text-text3"
      role="status"
      data-testid="python-starting"
    >
      <LoaderCircle class="h-4 w-4 animate-spin text-accentText" aria-hidden="true" />
      {WELCOME.starting}
    </p>
  {/if}

  {#snippet actions()}
    {#if !desktop}
      <button type="button" class={PRIMARY} disabled={phase !== 'ready'} onclick={goOn}>
        {WELCOME.continue}
      </button>
    {/if}
  {/snippet}
</StepShell>
