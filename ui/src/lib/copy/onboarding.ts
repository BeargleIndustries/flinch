// First run and tour copy (brief 9.8, A.3). The step headings, leads and
// bodies are `welcome.1` to `welcome.5` in screens.ts (A.6); the rest of the
// welcome screens' words, and the tour card's buttons, live here (brief 5.7
// rule 9) and in COPY_FILES. first-run.spec.ts and tour.spec.ts read them.

import type { BootstrapStage } from '$lib/tauri';

export const WELCOME = {
  // Layout (9.8)
  eyebrow: 'content restriction research',
  title: 'Setting up Flinch',
  dotsLabel: 'Setup steps',
  dot: (label: string, n: number, total: number) => `Step ${n} of ${total}: ${label}`,

  // Step 1
  start: 'Get started',
  whatIsThis: 'What is this?',
  about: [
    'Flinch records refusals and what changes them. It is a research instrument, not a jailbreak tool: it is built for people studying how content rules are enforced, and every pushback is a human decision.',
    'Everything is stored in one SQLite file on this computer. Model calls go only to the providers whose keys you add.',
    'Setup installs a private copy of Python for Flinch, which needs the internet once, then asks for one API key.',
  ],

  // Step 2
  devNotice: 'Running in development: start the sidecar yourself with python -m flinch.app.',
  sidecarWaiting: 'Waiting for the sidecar to answer…',
  sidecarReady: 'Sidecar ready',
  starting: 'Starting the sidecar…',
  showLog: 'Show the log',
  logEmpty: 'No log lines yet.',
  failedTitle: 'Setup stopped',
  retry: 'Retry',
  copyDetails: 'Copy error details',
  copied: 'Copied.',
  copyFailed: 'Could not copy. Select the text above instead.',
  avNote:
    "If setup keeps failing, Windows Defender or another anti-virus program is usually quarantining Flinch's Python. Add an exclusion for %LOCALAPPDATA%\\Flinch\\runtime\\ and press Retry. If that does not help, delete that folder and press Retry.",
  sidecarTimeout: 'The sidecar did not answer within 60 seconds.',

  // Step 3
  otherProviders: 'Other providers',
  skipForNow: 'Skip for now',
  skipHint:
    'Without a key you can only test local Ollama models, responses are classified by keywords only, and the coach is off.',
  keysFailed: 'Could not read the keys.',

  // Step 4
  loadDefaults: 'Load the default set',
  loadingDefaults: 'Loading…',
  importOwn: 'Import my own files',
  skip: 'Skip',

  // Step 5
  takeTour: 'Take the tour',
  goStraightIn: 'Go straight in',

  // Shared
  continue: 'Continue',
} as const;

/** Progress card labels per stage (9.8), in stage order. */
export const STAGE_LABELS: Record<BootstrapStage, string> = {
  probing: 'Checking',
  cleaning: 'Cleaning up an earlier install',
  extracting_pbs: 'Unpacking Python',
  creating_venv: 'Creating the environment',
  installing_deps: 'Installing Flinch',
  ready: 'Ready',
};

/** The tour card (A.3). */
export const TOUR = {
  label: 'Tour',
  back: 'Back',
  next: 'Next',
  close: 'Close',
  done: 'Done',
  progress: (n: number, total: number) => `Step ${n} of ${total}`,
} as const;
