// Export dialog copy (brief 9.5, D24, I21; the compare summary line is 9.9).
// Brief A.6 has no export keys, so the dialog's strings live here (brief 5.7
// rule 9) and in COPY_FILES. ExportDialog.svelte and export-dialog.spec.ts
// read them.

export interface ExportRowCopy {
  label: string;
  sentence: string;
}

export const EXPORT = {
  title: (sessionName: string) => `Export ${sessionName}`,
  lead: 'Download this session as data, as a report, or in a form other tools can read.',
  close: 'Close',

  groups: {
    raw: 'Raw data',
    reports: 'Reports',
    tools: 'For tools',
    compare: 'Compare sessions',
  },

  rows: {
    json: { label: 'JSON', sentence: 'Every run with its prompt, responses, badges and pushback.' },
    csv: { label: 'CSV', sentence: 'One row per run with the same fields, for spreadsheets.' },
    findings: {
      label: 'Findings (JSON)',
      sentence:
        'Your key findings with evidence, pattern tags and policy compliance, in a documented schema.',
    },
    report: {
      label: 'Research report (Markdown)',
      sentence:
        'Summary, findings, badges by domain, pattern analysis, policy compliance, framing consistency and method.',
    },
    html: { label: 'Web page (HTML)', sentence: 'A themed page listing every run.' },
    pdf: { label: 'PDF', sentence: 'The same page as a PDF.' },
    agent: {
      label: 'AI agent format (JSON)',
      sentence:
        'Runs, findings and a tag index with field definitions and suggested analyses, for feeding to a model.',
    },
    compareJson: {
      label: 'Comparison (JSON)',
      sentence: 'The same probes across the chosen sessions, with disagreements marked.',
    },
    compareCsv: {
      label: 'Comparison (CSV)',
      sentence: 'The same probes across the chosen sessions, with disagreements marked.',
    },
  } satisfies Record<string, ExportRowCopy>,

  pdfUnavailable: 'Not available: weasyprint is not installed on the sidecar.',

  theme: 'Theme',
  themeHint: 'Used by the web page and the PDF.',

  options: 'Options for the JSON and CSV rows',
  include: {
    turns: 'Include every turn',
    annotations: 'Include notes and tags',
    policy: 'Include policy links',
    variants: 'Include framing groups',
  },

  compareLead: 'Choose the sessions to set beside this one.',
  compareSessionsLabel: 'Other sessions',
  compareOption: (name: string, model: string) => `${name} · ${model}`,
  compareNone: 'There are no other sessions to compare with yet.',
  comparePickOne: 'Pick at least one other session.',
  compareLoading: 'Comparing…',
  compareSummary: (inAll: number, agreementRate: number) =>
    `${inAll} ${inAll === 1 ? 'probe' : 'probes'} ran in every chosen session; ${Math.round(agreementRate)}% got the same badge.`,
} as const;
