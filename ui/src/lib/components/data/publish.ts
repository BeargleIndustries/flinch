// Publish (brief 9.3, 9.9; I10, I13, B24): the pure half of the screen.
//
// POST /api/publication/export {name, format, template, filters, theme}
//   name      "{template}-{YYYY-MM-DD}"
//   filters   {models, domains, date_range?}; empty lists mean "all"
//             (`flinch/publication.py` _build_run_where); date_range is
//             {start: "{from} 00:00:00", end: "{to} 23:59:59"} because
//             runs.created_at is "YYYY-MM-DD HH:MM:SS" and the filter
//             compares strings.
//   reply     {export_id, preview}; PDF is stored and previewed as HTML and
//             converted on download (B24).
// GET /api/publication/exports            [{id, name, format, template, created_at}]
// GET /api/publication/exports/{id}       the row with `content`
// GET /api/publication/exports/{id}/download
//   file "{name with spaces as _}.{md|html|csv|pdf}"; PDF is 400 with the
//   B24 sentence when weasyprint cannot run.
import { pathFor } from '$lib/api/client';
import { ROUTES } from '$lib/api/endpoints';
import type { PublicationExportBody } from '$lib/api/types';

export const TEMPLATES = [
  'comparison_table',
  'consistency_matrix',
  'pushback_summary',
  'full_report',
] as const;
export type Template = (typeof TEMPLATES)[number];

export const FORMATS = ['markdown', 'html', 'csv', 'pdf'] as const;
export type Format = (typeof FORMATS)[number];

export const DEFAULT_TEMPLATE: Template = 'full_report';
export const DEFAULT_FORMAT: Format = 'markdown';

/** The file extension the download route gives each format. */
export const EXTENSIONS: Record<Format, string> = {
  markdown: 'md',
  html: 'html',
  csv: 'csv',
  pdf: 'pdf',
};

export function isTemplate(v: unknown): v is Template {
  return typeof v === 'string' && (TEMPLATES as readonly string[]).includes(v);
}

export function isFormat(v: unknown): v is Format {
  return typeof v === 'string' && (FORMATS as readonly string[]).includes(v);
}

/** GET /api/publication/exports/{id}/download, for DownloadLink. */
export function downloadPath(id: number): string {
  return pathFor(ROUTES.downloadPublicationExport, { params: { export_id: id } });
}

/** HTML and PDF are previewed as a page in a sandboxed frame; Markdown and CSV as text. */
export function previewsAsPage(format: Format): boolean {
  return format === 'html' || format === 'pdf';
}

/** HTML and PDF take a theme. */
export function usesTheme(format: Format): boolean {
  return previewsAsPage(format);
}

/** "YYYY-MM-DD" of `d` in local time. */
export function isoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Brief 9.3: "{template}-{YYYY-MM-DD}". */
export function documentName(template: Template, today: Date): string {
  return `${template}-${isoDay(today)}`;
}

/** The download route's file name: spaces become underscores, then the format's extension. */
export function fileName(name: string, format: Format): string {
  return `${name.replace(/ /g, '_')}.${EXTENSIONS[format]}`;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  start?: string;
  end?: string;
}

/** The filter's date range from two date inputs, or null when neither is set. */
export function dateRange(from: string, to: string): DateRange | null {
  const range: DateRange = {};
  if (DAY.test(from.trim())) range.start = `${from.trim()} 00:00:00`;
  if (DAY.test(to.trim())) range.end = `${to.trim()} 23:59:59`;
  return range.start || range.end ? range : null;
}

export interface PublishForm {
  template: Template;
  format: Format;
  models: ReadonlySet<string>;
  domains: ReadonlySet<string>;
  from: string;
  to: string;
  theme: string;
}

export type PublishProblem = 'dates' | 'pdf';

/** What stops the form from being sent. `pdfReady` is `capabilities.pdf === true`. */
export function formProblems(form: PublishForm, pdfReady: boolean): PublishProblem[] {
  const out: PublishProblem[] = [];
  const from = form.from.trim();
  const to = form.to.trim();
  if (DAY.test(from) && DAY.test(to) && from > to) out.push('dates');
  if (form.format === 'pdf' && !pdfReady) out.push('pdf');
  return out;
}

/** Sorted, so the request does not depend on the order things were clicked. */
const sorted = (s: ReadonlySet<string>) => [...s].sort((a, b) => a.localeCompare(b));

/** A type alias, not an interface, so it fits the contract's `Record<string, unknown>`. */
export type PublishFilters = {
  models: string[];
  domains: string[];
  date_range?: DateRange;
};

export interface PublishBody extends PublicationExportBody {
  name: string;
  format: Format;
  template: Template;
  filters: PublishFilters;
  theme: string;
}

export function exportBody(form: PublishForm, today: Date): PublishBody {
  const filters: PublishFilters = { models: sorted(form.models), domains: sorted(form.domains) };
  const range = dateRange(form.from, form.to);
  if (range) filters.date_range = range;
  return {
    name: documentName(form.template, today),
    format: form.format,
    template: form.template,
    filters,
    theme: form.theme,
  };
}

/** Distinct, trimmed, sorted probe domains (GET /api/probes). */
export function distinctDomains(list: readonly { domain?: string | null }[]): string[] {
  const set = new Set<string>();
  for (const p of list) if (p.domain?.trim()) set.add(p.domain.trim());
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** `set` with `value` added or removed. */
export function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** A row of GET /api/publication/exports. */
export interface PublishedDoc {
  id: number;
  name: string;
  format: Format;
  template: string;
  created_at: string;
}

/** The list route's rows, with anything malformed left out. */
export function toDocList(rows: unknown): PublishedDoc[] {
  if (!Array.isArray(rows)) return [];
  const out: PublishedDoc[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'number' || typeof o.name !== 'string') continue;
    out.push({
      id: o.id,
      name: o.name,
      format: isFormat(o.format) ? o.format : 'markdown',
      template: typeof o.template === 'string' ? o.template : '',
      created_at: typeof o.created_at === 'string' ? o.created_at : '',
    });
  }
  return out;
}

/** The document on screen: just made, or reopened from Past documents. */
export interface OpenDoc {
  id: number;
  name: string;
  format: Format;
  template: string;
  content: string;
}

/** The POST reply as the document on screen. */
export function docFromExport(reply: unknown, body: PublishBody): OpenDoc | null {
  if (!reply || typeof reply !== 'object') return null;
  const o = reply as Record<string, unknown>;
  if (typeof o.export_id !== 'number') return null;
  return {
    id: o.export_id,
    name: body.name,
    format: body.format,
    template: body.template,
    content: typeof o.preview === 'string' ? o.preview : '',
  };
}

/** GET /api/publication/exports/{id} as the document on screen. */
export function docFromRow(row: unknown): OpenDoc | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  if (typeof o.id !== 'number' || typeof o.name !== 'string') return null;
  return {
    id: o.id,
    name: o.name,
    format: isFormat(o.format) ? o.format : 'markdown',
    template: typeof o.template === 'string' ? o.template : '',
    content: typeof o.content === 'string' ? o.content : '',
  };
}

/** The template's label, or the raw id for a template this screen does not know. */
export function templateLabel(template: string, labels: Record<Template, string>): string {
  return isTemplate(template) ? labels[template] : template;
}

/** One of GET /api/themes/{name}'s colour fields (`ExportTheme`, `flinch/models.py`). */
export const SWATCH_FIELDS = [
  'bg_color',
  'bg_secondary',
  'text_color',
  'heading_color',
  'accent_color',
  'border_color',
  'color_high',
  'color_mid',
  'color_low',
] as const;
export type SwatchField = (typeof SWATCH_FIELDS)[number];

/** The theme's colours that are plain CSS colour values (hex, rgb(), hsl() or a name). */
export function themeSwatches(theme: unknown): { field: SwatchField; color: string }[] {
  if (!theme || typeof theme !== 'object') return [];
  const o = theme as Record<string, unknown>;
  const ok = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([\d\s.,%/]+\)|[a-z]+)$/i;
  return SWATCH_FIELDS.flatMap((field) => {
    const v = o[field];
    return typeof v === 'string' && ok.test(v.trim()) ? [{ field, color: v.trim() }] : [];
  });
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SampleTable {
  heading: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}

/**
 * The theme preview page (brief 9.9): a fixed sample table styled by GET
 * /api/themes/{name}/preview-css, which answers a whole `<style>` block. It
 * is shown in a sandboxed blob frame (I10), never in the app's own DOM.
 */
export function themeSampleHtml(styleBlock: string, sample: SampleTable): string {
  const th = sample.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = sample.rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  const style = /<style[\s>]/i.test(styleBlock) ? styleBlock : '';
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8">${style}` +
    '<style>body{padding:12px 14px!important;max-width:none!important}h2{margin-top:0!important}table{margin-bottom:0!important}</style>' +
    `</head><body><h2>${escapeHtml(sample.heading)}</h2>` +
    `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></body></html>`
  );
}
