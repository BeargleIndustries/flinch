// The Python step's progress card (brief 9.8): `bootstrap:progress` events
// (src-tauri/src/bootstrap/events.rs, snake_case stages with `message` and
// `progress`) become a label and a bar. The bar fills by stage index, or by
// `progress` inside a stage when it is between 0 and 1.
import { STAGE_LABELS } from '$lib/copy/onboarding';
import type { BootstrapStage } from '$lib/tauri';

export const STAGE_ORDER: readonly BootstrapStage[] = [
  'probing',
  'cleaning',
  'extracting_pbs',
  'creating_venv',
  'installing_deps',
  'ready',
];

/** The label for a stage; an unknown stage (a newer shell) shows its raw name. */
export function stageLabel(stage: string): string {
  return (STAGE_LABELS as Record<string, string>)[stage] ?? stage;
}

/** Whole percent, 0 to 100, for a stage and its in-stage progress. */
export function stagePercent(stage: string, progress: number): number {
  const i = STAGE_ORDER.indexOf(stage as BootstrapStage);
  if (i === -1) return 0;
  if (stage === 'ready') return 100;
  const within = progress > 0 && progress < 1 ? progress : 0;
  const steps = STAGE_ORDER.length - 1;
  return Math.min(100, Math.round(((i + within) / steps) * 100));
}

/** The log keeps its newest lines only. */
export const LOG_LINES = 200;

export function appendLog(lines: readonly string[], line: string): string[] {
  const next = [...lines, line];
  return next.length > LOG_LINES ? next.slice(next.length - LOG_LINES) : next;
}

/** "Copy error details": the error, then the shell's diagnostic when it has one. */
export function errorDetails(detail: string, diagnostic: string | null): string {
  return diagnostic ? `${detail}\n\n${diagnostic}` : detail;
}

/** Bytes as "512 B", "1.5 MB" or "41 MB" (one decimal below 10). */
export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 1024) return `${Math.max(0, Math.round(n || 0))} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}
