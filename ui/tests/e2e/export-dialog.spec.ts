// The Export dialog (brief 9.5 and 13.3 spec 6, D24, I21, plan 6.3, T20):
// opened from the header, one sentence under every row, each enabled row
// downloads the file its route names in Content-Disposition, the include
// options change the JSON rows, the PDF row follows capabilities.pdf, and a
// cross-session compare produces a summary and its files. Downloads are the
// browser path of saveFile (a blob download), caught with Playwright's
// download event.
import fs from 'node:fs';
import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import { EXPORT } from '../../src/lib/copy/export';
import { SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, sendProbe, type Seed, type Session } from './helpers';

type Health = { version: string };
type Capabilities = { pdf: boolean };
type SessionRow = Session & { target_model: string };
type ExportedRun = { probe_name: string; turns: unknown[] };

const VERSION = '0.9.0';
const DATE = String.raw`\d{4}-\d{2}-\d{2}`;

let seed: Seed;
let seeded: SessionRow;

test.beforeAll(async () => {
  seed = readSeed();
  const rows = await api<SessionRow[]>('GET', '/api/sessions');
  seeded = rows.find((s) => s.id === seed.sessionId)!;
});

test.beforeEach(async ({ page }) => {
  // Onboarding done, the tour and every first-time tip seen (brief 13.3), and
  // the seeded session current.
  await page.addInitScript(
    ({ tipIds, sessionId }: { tipIds: string[]; sessionId: number }) => {
      localStorage.setItem('flinch:onboarding_done', 'true');
      localStorage.setItem('flinch:tour_seen', 'true');
      for (const id of tipIds) localStorage.setItem(`flinch:tip_seen:${id}`, 'true');
      localStorage.setItem('flinch:session_id', String(sessionId));
    },
    { tipIds: tipsRegistry.map((t) => t.id), sessionId: readSeed().sessionId },
  );
});

/** The file-name stem the export route builds from a session name (`flinch/app.py` export_session). */
function safeName(name: string): string {
  return [...name]
    .filter((c) => /[A-Za-z0-9\-_ ]/.test(c))
    .join('')
    .trim()
    .replace(/ /g, '-');
}

/** Opens Probe, waits for the sidecar, and opens the dialog from the header's Export button. */
async function openExport(page: Page): Promise<Locator> {
  await page.goto('/probe');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  const button = page.getByRole('button', { name: SHELL.exportLabel });
  await expect(button).toBeEnabled();
  await button.click();
  const dialog = page.getByRole('dialog', { name: EXPORT.title(seeded.name) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('export-dialog')).toBeVisible();
  return dialog;
}

function downloadButton(dialog: Locator, label: string): Locator {
  return dialog.getByRole('button', { name: `Download ${label}`, exact: true });
}

/** Clicks a row's Download and returns the file and its text. */
async function grab(
  page: Page,
  dialog: Locator,
  label: string,
): Promise<{ download: Download; name: string; text: string }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadButton(dialog, label).click(),
  ]);
  const file = await download.path();
  const text = fs.readFileSync(file, 'utf8');
  return { download, name: download.suggestedFilename(), text };
}

test('opens from the header with every group, row and sentence', async ({ page }) => {
  const dialog = await openExport(page);
  const caps = await api<Capabilities>('GET', '/api/settings/capabilities');

  for (const g of Object.values(EXPORT.groups)) {
    await expect(dialog.getByRole('heading', { name: g, exact: true })).toBeVisible();
  }

  const rows = EXPORT.rows;
  const always = [rows.json, rows.csv, rows.findings, rows.report, rows.html, rows.agent];
  for (const row of always) {
    await expect(dialog.getByText(row.label, { exact: true })).toBeVisible();
    await expect(dialog.getByText(row.sentence, { exact: true })).toBeVisible();
  }
  await expect(dialog.getByText(rows.pdf.label, { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(caps.pdf ? rows.pdf.sentence : EXPORT.pdfUnavailable, { exact: true }),
  ).toBeVisible();

  // I21: the four options sit in For tools, with the brief's defaults.
  const tools = dialog.getByTestId('export-group-tools');
  await expect(tools.getByText(EXPORT.options, { exact: true })).toBeVisible();
  await expect(tools.getByLabel(EXPORT.include.turns)).not.toBeChecked();
  await expect(tools.getByLabel(EXPORT.include.annotations)).toBeChecked();
  await expect(tools.getByLabel(EXPORT.include.policy)).not.toBeChecked();
  await expect(tools.getByLabel(EXPORT.include.variants)).not.toBeChecked();

  // Theme picker under the reports, listing the sidecar's themes.
  await expect(dialog.getByLabel(EXPORT.theme)).toHaveValue('beargle-dark');

  // Compare rows wait for a pick.
  const compare = dialog.getByTestId('export-group-compare');
  await expect(compare.getByText(rows.compareJson.label, { exact: true })).toBeVisible();
  await expect(compare.getByText(EXPORT.comparePickOne)).toHaveCount(2);
  await expect(downloadButton(dialog, rows.compareJson.label)).toBeDisabled();
  await expect(downloadButton(dialog, rows.compareCsv.label)).toBeDisabled();

  await dialog.getByRole('button', { name: EXPORT.close, exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('JSON carries version 0.9.0 and follows the include-every-turn option', async ({ page }) => {
  const health = await api<Health>('GET', '/health');
  expect(health.version).toBe(VERSION);
  const dialog = await openExport(page);
  const stem = safeName(seeded.name);

  const plain = await grab(page, dialog, EXPORT.rows.json.label);
  expect(plain.name).toMatch(new RegExp(`^flinch-${stem}-${DATE}\\.json$`));
  const first = JSON.parse(plain.text) as { flinch_version: string; runs: ExportedRun[] };
  expect(first.flinch_version).toBe(VERSION);
  expect(first.runs.length).toBeGreaterThan(0);
  expect(first.runs.every((r) => r.turns.length === 0)).toBe(true);
  await expect(dialog.getByText('Downloaded')).toBeVisible();

  await dialog.getByLabel(EXPORT.include.turns).check();
  const withTurns = await grab(page, dialog, EXPORT.rows.json.label);
  const second = JSON.parse(withTurns.text) as { flinch_version: string; runs: ExportedRun[] };
  expect(second.flinch_version).toBe(VERSION);
  expect(second.runs.some((r) => r.turns.length > 0)).toBe(true);

  // Unchecking it again leaves the turns out.
  await dialog.getByLabel(EXPORT.include.turns).uncheck();
  const again = JSON.parse((await grab(page, dialog, EXPORT.rows.json.label)).text) as {
    runs: ExportedRun[];
  };
  expect(again.runs.every((r) => r.turns.length === 0)).toBe(true);
});

test('CSV downloads with the route file name', async ({ page }) => {
  const dialog = await openExport(page);
  const { name, text } = await grab(page, dialog, EXPORT.rows.csv.label);
  expect(name).toMatch(new RegExp(`^flinch-${safeName(seeded.name)}-${DATE}\\.csv$`));
  expect(text.split(/\r?\n/)[0]).toMatch(/^run_id,probe_name,/);
});

test('findings, research report, web page and agent format download', async ({ page }) => {
  const dialog = await openExport(page);
  const stem = safeName(seeded.name);

  const findings = await grab(page, dialog, EXPORT.rows.findings.label);
  expect(findings.name).toMatch(new RegExp(`^flinch-findings-${stem}-${DATE}\\.json$`));
  expect(JSON.parse(findings.text)).toHaveProperty('key_findings');

  const report = await grab(page, dialog, EXPORT.rows.report.label);
  expect(report.name).toMatch(new RegExp(`^flinch-report-${stem}-${DATE}\\.md$`));
  expect(report.text).toContain('#');

  const html = await grab(page, dialog, EXPORT.rows.html.label);
  expect(html.name).toMatch(new RegExp(`^flinch-${stem}-${DATE}\\.html$`));
  expect(html.text).toContain('<!DOCTYPE html>');
  expect(html.text).toContain(seeded.name);

  const agent = await grab(page, dialog, EXPORT.rows.agent.label);
  expect(agent.name).toMatch(new RegExp(`^flinch-agent-${stem}-${DATE}\\.json$`));
  expect(() => JSON.parse(agent.text)).not.toThrow();
});

test('the PDF row follows capabilities.pdf (weasyprint reason when false)', async ({ page }) => {
  const caps = await api<Capabilities>('GET', '/api/settings/capabilities');
  const dialog = await openExport(page);
  const pdf = downloadButton(dialog, EXPORT.rows.pdf.label);
  if (caps.pdf) {
    await expect(pdf).toBeEnabled();
  } else {
    await expect(pdf).toBeDisabled();
    await expect(pdf).toHaveAttribute('title', EXPORT.pdfUnavailable);
    await expect(dialog.getByText(EXPORT.pdfUnavailable, { exact: true })).toBeVisible();
  }
});

test('the theme choice is remembered and sent with the web page', async ({ page }) => {
  const themes = await api<{ name: string }[]>('GET', '/api/themes');
  const other = themes.find((t) => t.name !== 'beargle-dark');
  test.skip(!other, 'the sidecar lists one theme only');
  const dialog = await openExport(page);

  const requested = page.waitForRequest((r) => r.url().includes('format=html'));
  await dialog.getByLabel(EXPORT.theme).selectOption(other!.name);
  const html = await grab(page, dialog, EXPORT.rows.html.label);
  expect((await requested).url()).toContain(`theme=${other!.name}`);
  expect(html.name).toMatch(/\.html$/);
  expect(await page.evaluate(() => localStorage.getItem('flinch:export_theme'))).toBe(other!.name);
});

test('a cross-session compare produces a summary and its files', async ({ page }) => {
  // A second session that ran one of the seeded session's probes.
  const second = await createSession(`Export compare ${Date.now()}`, [seed.probes.refuseMe]);
  await sendProbe(second.id, seed.probes.refuseMe);
  const row = (await api<SessionRow[]>('GET', '/api/sessions')).find((s) => s.id === second.id)!;

  const dialog = await openExport(page);
  const compare = dialog.getByTestId('export-group-compare');
  await compare.getByLabel(EXPORT.compareOption(row.name, row.target_model)).check();

  const expected = await api<{ probes_in_all_sessions: number; agreement_rate: number }>(
    'GET',
    `/api/compare?session_ids=${seed.sessionId},${second.id}`,
  );
  expect(expected.probes_in_all_sessions).toBeGreaterThan(0);
  await expect(compare.getByTestId('export-compare-summary')).toHaveText(
    EXPORT.compareSummary(expected.probes_in_all_sessions, expected.agreement_rate),
  );
  await expect(compare.getByText(EXPORT.comparePickOne)).toHaveCount(0);
  await expect(compare.getByText(EXPORT.rows.compareJson.sentence)).toHaveCount(2);

  const ids = `${seed.sessionId}-${second.id}`;
  const json = await grab(page, dialog, EXPORT.rows.compareJson.label);
  expect(json.name).toMatch(new RegExp(`^flinch-compare-${ids}-${DATE}\\.json$`));
  const body = JSON.parse(json.text) as { flinch_version: string; export_type: string };
  expect(body.flinch_version).toBe(VERSION);
  expect(body.export_type).toBe('cross_session_comparison');

  const csv = await grab(page, dialog, EXPORT.rows.compareCsv.label);
  expect(csv.name).toMatch(new RegExp(`^flinch-compare-${ids}-${DATE}\\.csv$`));
  expect(csv.text.split(/\r?\n/)[0]).toBe(
    `probe_name,probe_domain,session_${seed.sessionId}_classification,session_${second.id}_classification,disagreement`,
  );
});
