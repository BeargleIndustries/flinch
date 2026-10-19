import { describe, expect, it } from 'vitest';
import { PUBLISH } from '$lib/copy/data';
import {
  EXTENSIONS,
  FORMATS,
  TEMPLATES,
  dateRange,
  distinctDomains,
  docFromExport,
  docFromRow,
  documentName,
  downloadPath,
  exportBody,
  fileName,
  formProblems,
  isFormat,
  isTemplate,
  previewsAsPage,
  templateLabel,
  themeSampleHtml,
  themeSwatches,
  toDocList,
  toggled,
  usesTheme,
  type PublishForm,
} from './publish';

const day = new Date(2026, 9, 7, 23, 30); // 7 October 2026, local

function form(over: Partial<PublishForm> = {}): PublishForm {
  return {
    template: 'comparison_table',
    format: 'markdown',
    models: new Set(),
    domains: new Set(),
    from: '',
    to: '',
    theme: 'beargle-dark',
    ...over,
  };
}

describe('templates and formats', () => {
  it('lists the four templates and four formats of brief 9.3 and I13 (no JSON)', () => {
    expect(TEMPLATES).toEqual([
      'comparison_table',
      'consistency_matrix',
      'pushback_summary',
      'full_report',
    ]);
    expect(FORMATS).toEqual(['markdown', 'html', 'csv', 'pdf']);
    expect(isFormat('json')).toBe(false);
  });

  it('has a label and a sentence for each', () => {
    for (const t of TEMPLATES) {
      expect(PUBLISH.templates[t]).toBeTruthy();
      expect(PUBLISH.templateWhy[t]).toBeTruthy();
    }
    for (const f of FORMATS) {
      expect(PUBLISH.formats[f]).toBeTruthy();
      expect(PUBLISH.downloadWhy[f]).toBeTruthy();
    }
  });

  it('guards template and format strings', () => {
    expect(isTemplate('full_report')).toBe(true);
    expect(isTemplate('nope')).toBe(false);
    expect(isTemplate(3)).toBe(false);
    expect(isFormat('pdf')).toBe(true);
  });

  it('previews HTML and PDF as a page, the rest as text; the same two take a theme', () => {
    expect(FORMATS.filter(previewsAsPage)).toEqual(['html', 'pdf']);
    expect(FORMATS.filter(usesTheme)).toEqual(['html', 'pdf']);
  });

  it('uses the download route extensions', () => {
    expect(EXTENSIONS).toEqual({ markdown: 'md', html: 'html', csv: 'csv', pdf: 'pdf' });
  });
});

describe('names', () => {
  it('names a document "{template}-{YYYY-MM-DD}"', () => {
    expect(documentName('pushback_summary', day)).toBe('pushback_summary-2026-10-07');
  });

  it("builds the route's file name", () => {
    expect(fileName('full_report-2026-10-07', 'markdown')).toBe('full_report-2026-10-07.md');
    expect(fileName('my doc name', 'pdf')).toBe('my_doc_name.pdf');
  });

  it('builds the download path', () => {
    expect(downloadPath(12)).toBe('/api/publication/exports/12/download');
  });
});

describe('date range', () => {
  it('is null when neither date is set', () => {
    expect(dateRange('', '')).toBeNull();
    expect(dateRange('garbage', ' ')).toBeNull();
  });

  it('pads each end to the whole day, as runs.created_at is compared as a string', () => {
    expect(dateRange('2026-10-01', '2026-10-07')).toEqual({
      start: '2026-10-01 00:00:00',
      end: '2026-10-07 23:59:59',
    });
    expect(dateRange('2026-10-01', '')).toEqual({ start: '2026-10-01 00:00:00' });
    expect(dateRange('', '2026-10-07')).toEqual({ end: '2026-10-07 23:59:59' });
  });
});

describe('formProblems', () => {
  it('is empty for a plain form', () => {
    expect(formProblems(form(), false)).toEqual([]);
  });

  it('flags a start after the end', () => {
    expect(formProblems(form({ from: '2026-10-08', to: '2026-10-07' }), true)).toEqual(['dates']);
    expect(formProblems(form({ from: '2026-10-07', to: '2026-10-07' }), true)).toEqual([]);
    expect(formProblems(form({ from: '2026-10-08' }), true)).toEqual([]);
  });

  it('flags PDF when weasyprint is not ready', () => {
    expect(formProblems(form({ format: 'pdf' }), false)).toEqual(['pdf']);
    expect(formProblems(form({ format: 'pdf' }), true)).toEqual([]);
  });
});

describe('exportBody', () => {
  it('sends empty lists for "all" and leaves the date range out when unset', () => {
    expect(exportBody(form(), day)).toEqual({
      name: 'comparison_table-2026-10-07',
      format: 'markdown',
      template: 'comparison_table',
      filters: { models: [], domains: [] },
      theme: 'beargle-dark',
    });
  });

  it('sorts the picks and adds the date range', () => {
    const body = exportBody(
      form({
        template: 'full_report',
        format: 'html',
        models: new Set(['zeta', 'alpha']),
        domains: new Set(['violence', 'cyber']),
        from: '2026-10-01',
        to: '2026-10-07',
        theme: 'clean-light',
      }),
      day,
    );
    expect(body).toEqual({
      name: 'full_report-2026-10-07',
      format: 'html',
      template: 'full_report',
      filters: {
        models: ['alpha', 'zeta'],
        domains: ['cyber', 'violence'],
        date_range: { start: '2026-10-01 00:00:00', end: '2026-10-07 23:59:59' },
      },
      theme: 'clean-light',
    });
  });
});

describe('sources', () => {
  it('lists distinct trimmed domains, sorted', () => {
    expect(
      distinctDomains([
        { domain: 'violence' },
        { domain: ' cyber ' },
        { domain: null },
        { domain: '' },
        {},
        { domain: 'violence' },
      ]),
    ).toEqual(['cyber', 'violence']);
  });

  it('toggles a value without changing the original set', () => {
    const a = new Set(['x']);
    const b = toggled(a, 'y');
    expect([...b]).toEqual(['x', 'y']);
    expect([...toggled(b, 'x')]).toEqual(['y']);
    expect([...a]).toEqual(['x']);
  });
});

describe('documents', () => {
  it('reads the list route, dropping malformed rows', () => {
    expect(
      toDocList([
        {
          id: 2,
          name: 'b',
          format: 'html',
          template: 'full_report',
          created_at: '2026-10-07 10:00:00',
        },
        { id: 1, name: 'a', format: 'json', template: 'x' },
        { id: 'x', name: 'c' },
        null,
      ]),
    ).toEqual([
      {
        id: 2,
        name: 'b',
        format: 'html',
        template: 'full_report',
        created_at: '2026-10-07 10:00:00',
      },
      { id: 1, name: 'a', format: 'markdown', template: 'x', created_at: '' },
    ]);
    expect(toDocList({})).toEqual([]);
  });

  it('turns the POST reply into the document on screen', () => {
    const body = exportBody(form({ format: 'pdf', template: 'full_report' }), day);
    expect(docFromExport({ export_id: 9, preview: '<html></html>' }, body)).toEqual({
      id: 9,
      name: 'full_report-2026-10-07',
      format: 'pdf',
      template: 'full_report',
      content: '<html></html>',
    });
    expect(docFromExport({ preview: 'x' }, body)).toBeNull();
    expect(docFromExport(null, body)).toBeNull();
  });

  it('turns a saved row into the document on screen', () => {
    expect(
      docFromRow({ id: 3, name: 'n', format: 'csv', template: 'comparison_table', content: 'a,b' }),
    ).toEqual({ id: 3, name: 'n', format: 'csv', template: 'comparison_table', content: 'a,b' });
    expect(docFromRow({ id: 3, name: 'n' })).toEqual({
      id: 3,
      name: 'n',
      format: 'markdown',
      template: '',
      content: '',
    });
    expect(docFromRow({ name: 'n' })).toBeNull();
  });

  it('labels known templates and passes unknown ones through', () => {
    expect(templateLabel('full_report', PUBLISH.templates)).toBe('Full report');
    expect(templateLabel('legacy_thing', PUBLISH.templates)).toBe('legacy_thing');
  });
});

describe('theme preview', () => {
  it('keeps only plain colour values, in field order', () => {
    expect(
      themeSwatches({
        accent_color: '#e85d3a',
        bg_color: '#0f1117',
        text_color: 'rgb(1, 2, 3)',
        border_color: 'url(javascript:x)',
        heading_color: 'white',
        color_high: 42,
      }),
    ).toEqual([
      { field: 'bg_color', color: '#0f1117' },
      { field: 'text_color', color: 'rgb(1, 2, 3)' },
      { field: 'heading_color', color: 'white' },
      { field: 'accent_color', color: '#e85d3a' },
    ]);
    expect(themeSwatches(null)).toEqual([]);
  });

  it('builds an escaped sample page around the style block', () => {
    const html = themeSampleHtml('<style>body{color:red}</style>', {
      heading: 'A & B',
      headers: ['<x>'],
      rows: [['"q"']],
    });
    expect(html).toContain('<style>body{color:red}</style>');
    expect(html).toContain('<h2>A &amp; B</h2>');
    expect(html).toContain('<th>&lt;x&gt;</th>');
    expect(html).toContain('<td>&quot;q&quot;</td>');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('drops a reply that is not a style block', () => {
    const html = themeSampleHtml('not css <script>', PUBLISH.sample);
    expect(html).not.toContain('<script>');
    expect(html).toContain(PUBLISH.sample.heading);
  });
});
