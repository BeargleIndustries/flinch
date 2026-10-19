// Publish (brief 9.3, 9.9, 13.3; plan 6.3, T31; I10, I13, B24). One fresh
// session with a refused and an answered run, then:
// 1. Each template previews as Markdown (the text is what the sidecar saved)
//    and downloads as "{template}-{YYYY-MM-DD}.md" with text/markdown.
// 2. HTML previews in <iframe sandbox="" src="blob:..."> and downloads as
//    .html; making another document revokes the old blob URL.
// 3. The theme row shows only for HTML and PDF, its sample frame is a
//    sandboxed blob too, and switching the theme changes the request's
//    theme (and the saved flinch:export_theme).
// 4. The PDF option follows capabilities.pdf, with "PDF needs weasyprint on
//    the sidecar." when it is false; a PDF document reopened from Past
//    documents shows the page, the PDF line, no Copy, and a disabled
//    Download.
// 5. CSV previews as text and downloads as .csv with text/csv.
// 6. Models, domains and the date range go into the request's filters, and
//    a backwards range stops the button.
// 7. Past documents lists every saved document newest first; Preview
//    reopens one. The sidecar has no route to delete a saved document, so
//    there is nothing to delete here.
import fs from 'node:fs';
import { expect, test, type Page, type Response } from '@playwright/test';
import { PUBLISH } from '../../src/lib/copy/data';
import { SCREENS } from '../../src/lib/copy/screens';
import { SHELL } from '../../src/lib/copy/shell';
import { tipsRegistry } from '../../src/lib/tips/tips-registry';
import { api, createSession, readSeed, sendProbe, type Session } from './helpers';

type Capabilities = { pdf: boolean };
type SavedDoc = {
  id: number;
  name: string;
  format: string;
  template: string;
  content: string;
};
type ListedDoc = Omit<SavedDoc, 'content'> & { created_at: string };
type ExportBody = {
  name: string;
  format: string;
  template: string;
  filters: { models: string[]; domains: string[]; date_range?: { start?: string; end?: string } };
  theme: string;
};
type ThemeOption = { name: string; display_name: string };

const TEMPLATES = [
  'comparison_table',
  'consistency_matrix',
  'pushback_summary',
  'full_report',
] as const;
const DAY = String.raw`\d{4}-\d{2}-\d{2}`;

test.describe.configure({ mode: 'serial' });

let sess: Session;
let model: string;
let domain: string;

test.beforeAll(async () => {
  const seed = readSeed();
  sess = await createSession(`Publish ${String(Date.now()).slice(-7)}`, [
    seed.probes.refuseMe,
    seed.probes.answerMe,
  ]);
  await sendProbe(sess.id, seed.probes.refuseMe);
  await sendProbe(sess.id, seed.probes.answerMe);
  model = (await api<{ target_model: string }>('GET', `/api/sessions/${sess.id}`)).target_model;
  const probes = await api<{ id: number; domain: string }[]>('GET', '/api/probes');
  domain = probes.find((p) => p.id === seed.probes.refuseMe)!.domain;
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ tipIds, sessionId }: { tipIds: string[]; sessionId: number }) => {
      localStorage.setItem('flinch:onboarding_done', 'true');
      localStorage.setItem('flinch:tour_seen', 'true');
      for (const id of tipIds) localStorage.setItem(`flinch:tip_seen:${id}`, 'true');
      localStorage.setItem('flinch:session_id', String(sessionId));
    },
    { tipIds: tipsRegistry.map((t) => t.id), sessionId: sess.id },
  );
});

/** Opens Publish and waits for its reads. */
async function openPublish(page: Page): Promise<void> {
  await page.goto('/data/publish');
  await expect(page.getByTestId('sidecar-chip')).toHaveText(SHELL.sidecarReady);
  await expect(page.getByTestId('screen-question')).toHaveText(SCREENS.publish);
  await expect(page.getByTestId('publish-form')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('publish-docs')).toHaveAttribute('aria-busy', 'false');
}

const isExportPost = (r: Response) =>
  r.url().endsWith('/api/publication/export') && r.request().method() === 'POST';

/** Picks a template and format, presses Make the document, and returns the request and reply. */
async function make(
  page: Page,
  template: string,
  format: string,
): Promise<{ body: ExportBody; id: number; saved: SavedDoc }> {
  await page.getByTestId('publish-template').selectOption(template);
  await page.getByTestId('publish-format').selectOption(format);
  const [res] = await Promise.all([
    page.waitForResponse(isExportPost),
    page.getByRole('button', { name: PUBLISH.make }).click(),
  ]);
  expect(res.status()).toBe(200);
  const body = res.request().postDataJSON() as ExportBody;
  const { export_id: id } = (await res.json()) as { export_id: number };
  await expect(page.getByTestId('publish-preview')).toHaveAttribute('data-export-id', String(id));
  const saved = await api<SavedDoc>('GET', `/api/publication/exports/${id}`);
  return { body, id, saved };
}

/** Clicks the preview's Download; returns the file name, its text and the route's content type. */
async function downloadShown(
  page: Page,
  fileName: string,
): Promise<{ name: string; text: string; type: string }> {
  const [download, res] = await Promise.all([
    page.waitForEvent('download'),
    page.waitForResponse((r) => /\/api\/publication\/exports\/\d+\/download$/.test(r.url())),
    page
      .getByTestId('publish-preview')
      .getByRole('button', { name: `Download ${fileName}`, exact: true })
      .click(),
  ]);
  const text = fs.readFileSync(await download.path(), 'utf8');
  return { name: download.suggestedFilename(), text, type: res.headers()['content-type'] ?? '' };
}

/** A line each template's Markdown is known to contain (or its empty message). */
const MARKERS: Record<(typeof TEMPLATES)[number], RegExp> = {
  comparison_table: /\| Model\s+\| Probes/,
  consistency_matrix: /\| Probe\s+\||No stat runs found matching filters\./,
  pushback_summary: /\| Move\s+\||No coach examples found matching filters\./,
  full_report: /^# Flinch Research Export$/m,
};

test('each template previews as Markdown and downloads as a .md file', async ({ page }) => {
  await openPublish(page);
  await expect(page.getByTestId('publish-theme-row')).toHaveCount(0);

  for (const template of TEMPLATES) {
    const { body, id, saved } = await make(page, template, 'markdown');
    expect(body.template).toBe(template);
    expect(body.format).toBe('markdown');
    expect(body.name).toMatch(new RegExp(`^${template}-${DAY}$`));
    expect(body.filters).toEqual({ models: [], domains: [] });
    expect(saved).toMatchObject({ id, name: body.name, format: 'markdown', template });

    const pre = page.getByTestId('publish-preview-text');
    await expect(pre).toBeVisible();
    expect(await pre.textContent()).toBe(saved.content);
    expect(saved.content).toMatch(MARKERS[template]);
    if (template === 'comparison_table') expect(saved.content).toContain(model);
    await expect(page.getByTestId('publish-preview-frame')).toHaveCount(0);
    await expect(
      page.getByTestId('publish-preview').getByRole('button', { name: PUBLISH.copy }),
    ).toBeVisible();

    const file = await downloadShown(page, `${body.name}.md`);
    expect(file.name).toBe(`${body.name}.md`);
    expect(file.type).toContain('text/markdown');
    expect(file.text).toBe(saved.content);
  }
});

test('HTML previews in a sandboxed blob frame and downloads as .html', async ({ page }) => {
  await openPublish(page);
  const { body, saved } = await make(page, 'full_report', 'html');
  expect(body.format).toBe('html');
  expect(saved.content).toContain('<h1>Flinch Research Export</h1>');

  const frame = page.getByTestId('publish-preview-frame');
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(frame).toHaveAttribute('src', /^blob:/);
  await expect(page.getByTestId('publish-preview-text')).toHaveCount(0);
  await expect(
    page.frameLocator('[data-testid="publish-preview-frame"]').getByRole('heading', {
      name: 'Flinch Research Export',
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.getByTestId('publish-pdf-note')).toHaveCount(0);

  const file = await downloadShown(page, `${body.name}.html`);
  expect(file.name).toBe(`${body.name}.html`);
  expect(file.type).toContain('text/html');
  expect(file.text).toBe(saved.content);

  // Another document replaces the frame and revokes the old blob URL.
  const oldSrc = (await frame.getAttribute('src'))!;
  await make(page, 'comparison_table', 'html');
  await expect(frame).not.toHaveAttribute('src', oldSrc);
  await expect(frame).toHaveAttribute('src', /^blob:/);
  await expect(
    page.frameLocator('[data-testid="publish-preview-frame"]').getByRole('heading', {
      name: 'Model Comparison',
    }),
  ).toBeVisible();
  const oldStillReadable = await page.evaluate(async (u) => {
    try {
      await fetch(u);
      return true;
    } catch {
      return false;
    }
  }, oldSrc);
  expect(oldStillReadable).toBe(false);
});

test('the theme picker shows for HTML, previews in a sandboxed frame, and sets the request theme', async ({
  page,
}) => {
  const themes = await api<ThemeOption[]>('GET', '/api/themes');
  expect(themes.length).toBeGreaterThan(1);
  await openPublish(page);

  await page.getByTestId('publish-format').selectOption('csv');
  await expect(page.getByTestId('publish-theme-row')).toHaveCount(0);
  await page.getByTestId('publish-format').selectOption('html');
  await expect(page.getByTestId('publish-theme-row')).toBeVisible();

  const select = page.getByTestId('publish-theme');
  await expect(select.locator('option')).toHaveText(themes.map((t) => t.display_name));
  const first = await select.inputValue();
  const other = themes.find((t) => t.name !== first)!;

  const sample = page.getByTestId('publish-theme-frame');
  await expect(sample).toHaveAttribute('sandbox', '');
  await expect(sample).toHaveAttribute('src', /^blob:/);
  await expect(
    page
      .frameLocator('[data-testid="publish-theme-frame"]')
      .getByRole('heading', { name: PUBLISH.sample.heading }),
  ).toBeVisible();
  const before = (await sample.getAttribute('src'))!;

  const detail = await api<{ description: string }>('GET', `/api/themes/${other.name}`);
  await select.selectOption(other.name);
  await expect(page.getByTestId('publish-theme-description')).toHaveText(detail.description);
  await expect(sample).not.toHaveAttribute('src', before);
  await expect(sample).toHaveAttribute('src', /^blob:/);
  expect(await page.evaluate(() => localStorage.getItem('flinch:export_theme'))).toBe(other.name);

  const { body } = await make(page, 'full_report', 'html');
  expect(body.theme).toBe(other.name);

  await select.selectOption(first);
  const again = await make(page, 'full_report', 'html');
  expect(again.body.theme).toBe(first);
});

test('the PDF option follows capabilities.pdf, with the weasyprint reason when false', async ({
  page,
}) => {
  const caps = await api<Capabilities>('GET', '/api/settings/capabilities');
  // A PDF document saved through the route (stored as HTML, B24) to reopen.
  const made = await api<{ export_id: number }>('POST', '/api/publication/export', {
    name: `pdf check ${Date.now()}`,
    format: 'pdf',
    template: 'full_report',
    filters: {},
    theme: 'beargle-dark',
  });
  const saved = await api<SavedDoc>('GET', `/api/publication/exports/${made.export_id}`);
  await openPublish(page);

  const pdfOption = page.getByTestId('publish-format').locator('option[value="pdf"]');
  await expect(pdfOption).toHaveText(PUBLISH.formats.pdf);
  if (caps.pdf) {
    await expect(pdfOption).toBeEnabled();
    await expect(page.getByTestId('publish-format-hint')).not.toHaveText(PUBLISH.pdfUnavailable);
  } else {
    await expect(pdfOption).toBeDisabled();
    await expect(pdfOption).toHaveAttribute('title', PUBLISH.pdfUnavailable);
    await expect(page.getByTestId('publish-format-hint')).toHaveText(PUBLISH.pdfUnavailable);
  }

  const row = page.locator(`[data-testid="publish-doc-row"][data-export-id="${made.export_id}"]`);
  await row.getByTestId('publish-doc-preview').click();
  const preview = page.getByTestId('publish-preview');
  await expect(preview).toHaveAttribute('data-export-id', String(made.export_id));
  await expect(preview).toHaveAttribute('data-format', 'pdf');
  await expect(page.getByTestId('publish-preview-frame')).toHaveAttribute('sandbox', '');
  await expect(page.getByTestId('publish-preview-frame')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByTestId('publish-pdf-note')).toHaveText(PUBLISH.pdfNote);
  await expect(preview.getByRole('button', { name: PUBLISH.copy })).toHaveCount(0);
  expect(saved.content).toContain('<h1>Flinch Research Export</h1>');

  const fileName = `${saved.name.replace(/ /g, '_')}.pdf`;
  const download = preview.getByRole('button', { name: `Download ${fileName}`, exact: true });
  if (caps.pdf) {
    await expect(download).toBeEnabled();
  } else {
    await expect(download).toBeDisabled();
    await expect(download).toHaveAttribute('title', PUBLISH.pdfUnavailable);
    await expect(preview.getByText(PUBLISH.pdfUnavailable, { exact: true })).toBeVisible();
  }
});

test('CSV previews as text and downloads as .csv', async ({ page }) => {
  await openPublish(page);
  const { body, saved } = await make(page, 'comparison_table', 'csv');
  expect(saved.content).toMatch(/^Model,Probes,Refused,Collapsed,Negotiated,Complied,Refusal Rate/);
  expect(await page.getByTestId('publish-preview-text').textContent()).toBe(saved.content);
  await expect(page.getByTestId('publish-preview-frame')).toHaveCount(0);

  const file = await downloadShown(page, `${body.name}.csv`);
  expect(file.name).toBe(`${body.name}.csv`);
  expect(file.type).toContain('text/csv');
  expect(file.text.replace(/\r\n/g, '\n')).toBe(saved.content.replace(/\r\n/g, '\n'));
});

test('models, domains and the date range go into the filters', async ({ page }) => {
  await openPublish(page);
  await page
    .getByTestId('publish-models')
    .getByRole('checkbox', { name: model, exact: true })
    .check();
  await page
    .getByTestId('publish-domains')
    .getByRole('checkbox', { name: domain, exact: true })
    .check();

  await page.getByTestId('publish-from').fill('2100-01-02');
  await page.getByTestId('publish-to').fill('2100-01-01');
  await expect(page.getByText(PUBLISH.datesBackwards, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: PUBLISH.make })).toBeDisabled();

  await page.getByTestId('publish-from').fill('2000-01-01');
  await page.getByTestId('publish-to').fill('2100-01-01');
  await expect(page.getByRole('button', { name: PUBLISH.make })).toBeEnabled();
  const { body, saved } = await make(page, 'comparison_table', 'markdown');
  expect(body.filters).toEqual({
    models: [model],
    domains: [domain],
    date_range: { start: '2000-01-01 00:00:00', end: '2100-01-01 23:59:59' },
  });
  expect(saved.content).toContain(model);

  // A range with no runs in it says so.
  await page.getByTestId('publish-from').fill('2001-01-01');
  await page.getByTestId('publish-to').fill('2001-01-02');
  const empty = await make(page, 'comparison_table', 'markdown');
  expect(empty.saved.content).toContain('No runs found matching filters.');
  await expect(page.getByTestId('publish-preview-text')).toHaveText(empty.saved.content);
});

test('Past documents lists every saved document and Preview reopens one', async ({ page }) => {
  await openPublish(page);
  const listed = await api<ListedDoc[]>('GET', '/api/publication/exports');
  expect(listed.length).toBeGreaterThan(1);
  const rows = page.getByTestId('publish-doc-row');
  await expect(rows).toHaveCount(listed.length);
  const ids = await rows.evaluateAll((els) =>
    els.map((e) => Number(e.getAttribute('data-export-id'))),
  );
  expect(ids).toEqual(listed.map((d) => d.id));

  // Nothing on screen yet in a fresh page.
  await expect(page.getByText(PUBLISH.previewEmpty, { exact: true })).toBeVisible();

  const target = listed.find((d) => d.format === 'markdown')!;
  const row = page.locator(`[data-testid="publish-doc-row"][data-export-id="${target.id}"]`);
  await expect(row).toContainText(target.name);
  await expect(row).toContainText(PUBLISH.templates[target.template as 'full_report']);
  await row.getByRole('button', { name: PUBLISH.previewOf(target.name) }).click();
  await expect(page.getByTestId('publish-preview')).toHaveAttribute(
    'data-export-id',
    String(target.id),
  );
  await expect(row.getByText(PUBLISH.showing, { exact: true })).toBeVisible();
  const saved = await api<SavedDoc>('GET', `/api/publication/exports/${target.id}`);
  expect(await page.getByTestId('publish-preview-text').textContent()).toBe(saved.content);

  // A new document goes to the top of the list.
  const { id } = await make(page, 'pushback_summary', 'markdown');
  await expect(rows.first()).toHaveAttribute('data-export-id', String(id));
  await expect(rows).toHaveCount(listed.length + 1);
  const after = await api<ListedDoc[]>('GET', '/api/publication/exports');
  expect(after[0].id).toBe(id);
});
