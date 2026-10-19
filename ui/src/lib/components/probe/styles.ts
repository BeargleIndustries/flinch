// Tailwind class strings the Probe workspace shares, in the shell's idiom
// (the same buttons and fields as the rail and the dialogs).

export const BTN = {
  primary:
    'inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accentHover focus:outline-none focus-visible:ring-2 focus-visible:ring-accentHover focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center gap-2 rounded-md border border-borderStrong px-3 py-1.5 text-xs font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-60',
  ghost:
    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-text3 transition-colors hover:bg-surface2 hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-accentHover disabled:cursor-not-allowed disabled:opacity-50',
} as const;

export const FIELD =
  'w-full rounded-md border border-borderStrong bg-bg px-2.5 py-1.5 text-sm text-text placeholder:text-text4 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60';

export const LABEL = 'mb-1 block text-xs font-medium text-text2';

export const HINT = 'text-[11px] leading-snug text-text4';

export const KBD =
  'inline-flex h-4 min-w-4 items-center justify-center rounded border border-white/25 px-1 font-mono text-[10px] leading-none opacity-80';

/** Timeline dot colours by class (brief 7.5); pushback turns use the accent. */
export const DOT: Record<string, string> = {
  refused: 'bg-clsRefused',
  collapsed: 'bg-clsCollapsed',
  negotiated: 'bg-clsNegotiated',
  complied: 'bg-clsComplied',
  unknown: 'bg-clsUnknown',
  pushback: 'bg-accent',
};
