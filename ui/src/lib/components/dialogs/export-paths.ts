// The Export dialog's routes (brief 9.5, D24, I21; 9.9 for the compare summary).
// Every row is a GET the dialog hands to DownloadLink; these build the paths.
//
// Session rows: GET /api/sessions/{id}/export?format=...
//   json, csv   + include_turns, include_annotations, include_policy, include_variants
//   findings, report, agent   (no flags; the server always includes everything)
//   html, pdf   + theme
// Compare rows: GET /api/export/compare?session_ids={current},{others}&format=json|csv
// Compare summary: GET /api/compare?session_ids={current},{others}
import { pathFor } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';

/** The four include flags of the two Raw data rows (I21). */
export interface IncludeOptions {
  turns: boolean;
  annotations: boolean;
  policy: boolean;
  variants: boolean;
}

/** Brief 9.5: every turn off, notes and tags on, policy links off, framing groups off. */
export const DEFAULT_INCLUDE: Readonly<IncludeOptions> = {
  turns: false,
  annotations: true,
  policy: false,
  variants: false,
};

/** The server's default theme (`flinch/app.py` export_session; `flinch/themes`). */
export const DEFAULT_THEME = 'beargle-dark';

export type RawFormat = 'json' | 'csv';
export type ReportFormat = 'findings' | 'report' | 'agent';
export type ThemedFormat = 'html' | 'pdf';
export type CompareFormat = 'json' | 'csv';

/** One entry of GET /api/themes (`ThemeSummary`, `flinch/models.py`). */
export interface ThemeOption {
  name: string;
  display_name: string;
  description: string;
  is_builtin: boolean;
}

/** The part of GET /api/compare the summary line reads. */
export interface CompareSummary {
  agreement_rate: number;
  total_probes: number;
  probes_in_all_sessions: number;
}

export function rawExportPath(sessionId: number, format: RawFormat, inc: IncludeOptions): string {
  return pathFor(ROUTES.exportSession, {
    params: { session_id: sessionId },
    query: {
      format,
      include_turns: inc.turns,
      include_annotations: inc.annotations,
      include_policy: inc.policy,
      include_variants: inc.variants,
    },
  });
}

export function reportExportPath(sessionId: number, format: ReportFormat): string {
  return pathFor(ROUTES.exportSession, { params: { session_id: sessionId }, query: { format } });
}

export function themedExportPath(sessionId: number, format: ThemedFormat, theme: string): string {
  return pathFor(ROUTES.exportSession, {
    params: { session_id: sessionId },
    query: { format, theme },
  });
}

/** The current session first, then the chosen others, without repeats. */
export function compareIds(currentId: number, others: Iterable<number>): number[] {
  const ids = [currentId];
  for (const id of others) if (!ids.includes(id)) ids.push(id);
  return ids;
}

export function compareExportPath(ids: number[], format: CompareFormat): string {
  return pathFor(ROUTES.exportCompare, { query: { ...compareQuery(ids), format } });
}

/** The query of the compare routes: `session_ids` as one comma-separated value. */
export function compareQuery(ids: number[]): { session_ids: string } {
  return { session_ids: ids.join(',') };
}

/**
 * The file name used when a response names none. The routes always send a
 * `Content-Disposition`, so this is only a guard.
 */
export function fallbackName(stem: string, ext: string): string {
  return `flinch-${stem}.${ext}`;
}

/** The saved theme when the sidecar still lists it, else the default, else the first listed. */
export function pickTheme(saved: string | null, themes: ThemeOption[]): string {
  const names = themes.map((t) => t.name);
  if (saved && names.includes(saved)) return saved;
  if (names.length === 0 || names.includes(DEFAULT_THEME)) return DEFAULT_THEME;
  return names[0];
}
