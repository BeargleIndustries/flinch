// Shell copy (brief 6.1 to 6.5, 7.10, D8, D16): the header, the section and
// sub-tab names, the sidecar chip and crash banner, the probe rail frame and
// the keyboard shortcuts overlay. These strings are read by the shell
// components and by shell.spec.ts, so they live here (brief 5.7 rule 9).

export interface SectionDef {
  /** Path prefix that marks the section active. */
  base: string;
  /** Where the section's tab goes. */
  href: string;
  label: string;
}

/** The three header sections (D8). */
export const SECTIONS: readonly SectionDef[] = [
  { base: '/probe', href: '/probe', label: 'Probe' },
  { base: '/studies', href: '/studies/framings', label: 'Studies' },
  { base: '/data', href: '/data/browse', label: 'Data' },
];

export interface SubTabDef {
  href: string;
  label: string;
}

/** Studies sub-tabs, with the D16 names, in the brief 6.3 order. */
export const STUDIES_TABS: readonly SubTabDef[] = [
  { href: '/studies/framings', label: 'Framings' },
  { href: '/studies/conditions', label: 'Conditions' },
  { href: '/studies/repeat', label: 'Repeat runs' },
  { href: '/studies/sequences', label: 'Sequences' },
  { href: '/studies/compare', label: 'Model compare' },
  { href: '/studies/baselines', label: 'Baselines' },
];

/** Data sub-tabs, with the D16 names, in the brief 6.3 order. */
export const DATA_TABS: readonly SubTabDef[] = [
  { href: '/data/browse', label: 'Browse' },
  { href: '/data/scorecard', label: 'Scorecard' },
  { href: '/data/publish', label: 'Publish' },
  { href: '/data/coach', label: 'Coach examples' },
];

/** How many provider keys Settings can hold (anthropic, openai, google, xai, meta). */
export const KEY_SLOTS = 5;

export const SHELL = {
  brand: 'Flinch',
  brandLink: 'Go to Probe',
  sectionsLabel: 'Sections',
  studiesLabel: 'Studies screens',
  dataLabel: 'Data screens',

  // Session switcher (6.1 item 2)
  noSession: 'No session',
  newSession: 'New session…',
  switcherLabel: 'Switch session',
  sessionsLoading: 'Loading sessions…',
  sessionsEmpty: 'No sessions yet',
  sessionRow: (name: string, model: string, runs: number) =>
    `${name} · ${model} · ${runs} ${runs === 1 ? 'run' : 'runs'}`,
  deleteSession: 'Delete this session…',
  deleteSessionConfirm: (name: string) => `Delete '${name}' and its runs`,

  // Sidecar chip (6.1 item 3)
  sidecarReady: 'Sidecar ready',
  sidecarStarting: 'Sidecar starting',
  sidecarOffline: 'Sidecar offline',
  sidecarDetails: 'Sidecar details',
  version: 'Version',
  database: 'Database',
  keys: 'Keys',
  keysSet: (n: number) => `${n} of ${KEY_SLOTS} set`,
  restartSidecar: 'Restart sidecar',
  restarting: 'Restarting…',

  // Crash banner (6.1)
  crashed: "Flinch's sidecar stopped.",
  unreachable:
    "Flinch's sidecar is not reachable. Start it with python -m flinch.app, then reload.",
  crashDetails: 'Details',
  hideCrashDetails: 'Hide details',

  // Right cluster (6.1 item 5)
  exportLabel: 'Export this session',
  exportNeedsSession: 'Pick a session first',
  settingsLabel: 'Open settings',

  // Probe rail frame (6.2)
  railEyebrow: 'Probes',
  railLabel: 'Probe rail',
  railHide: 'Hide probes',
  railShow: 'Show probes',
  railNoSession: 'Pick or make a session to see its probes.',

  // Shortcuts overlay (7.10)
  shortcutsTitle: 'Keyboard shortcuts',
  shortcutsLead: 'S, P, K, N and R work in the Probe section when no text field has focus.',
  shortcutsFooter: 'Press ? or Escape to close',
} as const;

/** Job progress in StreamProgress and the status strip (brief 5.6), and the strip's error side. */
export const PROGRESS = {
  failed: (n: number) => `${n} failed`,
  cancel: 'Cancel',
  cancelling: 'Cancelling…',
  show: 'Show',
  statusRegion: 'Status',
  details: 'Details',
  hideDetails: 'Hide details',
  dismiss: 'Dismiss',
} as const;

/** The guide menu (D12, brief 9.6): the button's label and its five items, in order. */
export const GUIDE_MENU = {
  menuButton: 'Open the guide',
  takeTour: 'Take the tour',
  glossary: 'Glossary',
  methodology: 'Methodology',
  policies: 'Policies',
  shortcuts: 'Keyboard shortcuts',
} as const;

export const GUIDE_ITEMS = [
  GUIDE_MENU.takeTour,
  GUIDE_MENU.glossary,
  GUIDE_MENU.methodology,
  GUIDE_MENU.policies,
  GUIDE_MENU.shortcuts,
] as const;

export interface ShortcutRow {
  keys: string[];
  /** When the key works (brief 7.10 "Phase"). */
  when: string;
  action: string;
}

/** One row per line of the brief 7.10 table. */
export const SHORTCUT_ROWS: readonly ShortcutRow[] = [
  { keys: ['S'], when: 'Probe selected or custom prompt', action: 'Send' },
  { keys: ['P'], when: 'Pushback', action: 'Send pushback' },
  { keys: ['K'], when: 'Pushback', action: 'Skip' },
  { keys: ['N'], when: 'Done', action: 'Next probe' },
  { keys: ['R'], when: 'Done', action: 'Run again' },
  { keys: ['↑', '↓'], when: 'Probe and Studies', action: 'Move the active probe' },
  { keys: ['?'], when: 'Anywhere', action: 'Show or hide this list' },
  { keys: ['Esc'], when: 'Anywhere', action: 'Close the topmost panel' },
  { keys: ['Enter'], when: 'One-line field in a dialog', action: 'Submit the dialog' },
];
