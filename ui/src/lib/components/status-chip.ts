// Study and sequence status pill (brief 5.6 `StatusChip`): draft and pending
// zinc, running accent, paused warn, completed and complete ok, failed danger,
// abandoned and cancelled muted. Anything else is shown as zinc with its own word.

export type StatusTone = 'neutral' | 'accent' | 'warn' | 'ok' | 'danger' | 'muted';

const TONES: Record<string, StatusTone> = {
  draft: 'neutral',
  pending: 'neutral',
  running: 'accent',
  paused: 'warn',
  completed: 'ok',
  complete: 'ok',
  failed: 'danger',
  abandoned: 'muted',
  cancelled: 'muted',
};

export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'border-borderStrong bg-surface2 text-text2',
  accent: 'border-accent/50 bg-accent/15 text-accentText',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  ok: 'border-ok/40 bg-ok/10 text-ok',
  danger: 'border-danger/50 bg-danger/10 text-danger',
  muted: 'border-border bg-transparent text-text4',
};

export function statusTone(status: string | null | undefined): StatusTone {
  return TONES[(status ?? '').trim().toLowerCase()] ?? 'neutral';
}

/** "running" becomes "Running"; an empty status reads "Unknown". */
export function statusWord(status: string | null | undefined): string {
  const s = (status ?? '').trim().replace(/_/g, ' ');
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : 'Unknown';
}
