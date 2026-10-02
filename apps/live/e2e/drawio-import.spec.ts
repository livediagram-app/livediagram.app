import { deflateRawSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, startBlankDocument, test } from './fixtures';

// draw.io import end to end (docs/specs/020-import-export/drawio-import.md): pick a
// file from the fixture corpus through the real Import dialog, and check the
// tabs, the summary, and what the api stored. DRAWIO_SHOTS=<dir> also saves
// screenshots of each step (for reviews); CI leaves it unset.

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../lib/drawio/__fixtures__');
const SHOTS = process.env.DRAWIO_SHOTS;

test.use({ colorScheme: 'dark' });

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function importFile(page: Page, file: string) {
  await page.getByRole('button', { name: 'Tab menu' }).click();
  const content = page.getByRole('button', { name: 'Content' });
  if ((await content.getAttribute('aria-expanded')) === 'false') await content.click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: /^draw\.io/ }).click();
  await shot(page, `${file}-1-panel`);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a file instead' }).click();
  await (await chooser).setFiles(join(FIXTURES, file));
}

// The saved document, read back through the api the way the editor stores it.
async function storedTabs(page: Page) {
  return page.evaluate(async () => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const headers = { 'X-Owner-Id': owner };
    const stored = await (await fetch(`/api/documents/${id}`, { headers })).json();
    const summaries: { id: string; name: string }[] = stored.document?.tabs ?? [];
    return Promise.all(
      summaries.map(async (t) => {
        const got = await (await fetch(`/api/documents/${id}/tabs/${t.id}`, { headers })).json();
        return { name: t.name, elements: (got.tab?.elements ?? []).length as number };
      }),
    );
  });
}

test('a multi-page draw.io file becomes a tab per page, with a summary', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await dismissQuickTour(page);
  await importFile(page, 'multi-page.drawio');

  const summary = page.getByTestId('import-image-report');
  await expect(summary).toBeVisible();
  // The one import report every importer shares: what landed, then each change with its count.
  await expect(summary).toContainText('Import complete');
  await expect(summary).toContainText('Groups were dropped');
  await shot(page, 'multi-page.drawio-2-summary');
  await page.getByRole('button', { name: 'Done' }).click();

  for (const name of ['Overview', 'Detail', 'Scratch']) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("Platform team's board").first()).toBeVisible();
  await shot(page, 'multi-page.drawio-3-overview');

  await expect
    .poll(() => storedTabs(page), { timeout: 15_000 })
    .toEqual([
      { name: 'Overview', elements: 9 },
      { name: 'Detail', elements: 8 },
      { name: 'Scratch', elements: 0 },
    ]);
  await page.getByText('Detail', { exact: true }).first().click();
  await expect(page.getByText('Big and bold').first()).toBeVisible();
  await shot(page, 'multi-page.drawio-4-detail');

  // One undo takes the whole import back: the new tabs go, the first tab is
  // empty and named as before, on screen and in storage.
  await page.getByText('Overview', { exact: true }).first().click();
  await page.locator('[data-canvas-a11y-root]').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByText('Detail', { exact: true })).toHaveCount(0);
  await expect
    .poll(() => storedTabs(page), { timeout: 15_000 })
    .toEqual([{ name: 'Tab 1', elements: 0 }]);
  await shot(page, 'multi-page.drawio-5-undone');
  expectNoPageErrors(pageErrors);
});

for (const file of [
  'flowchart.drawio.png',
  'swimlanes.drawio.png',
  'uml.drawio',
  'cloud-architecture.drawio.svg',
  'flowchart.compressed.drawio',
]) {
  test(`imports ${file}`, async ({ page, pageErrors }) => {
    await startBlankDocument(page);
    await dismissQuickTour(page);
    await importFile(page, file);
    const summary = page.getByTestId('import-image-report');
    // A clean import closes the dialog; one that changed anything summarises.
    const dialogs = page.getByRole('dialog');
    await expect
      .poll(async () => (await summary.isVisible()) || (await dialogs.count()) === 0)
      .toBe(true);
    if (await summary.isVisible()) {
      if (file === 'cloud-architecture.drawio.svg') {
        await expect(summary).toContainText('1 image imported');
        await expect(summary).toContainText(
          'Images linked outside the diagram came in as placeholders or were left out',
        );
      }
      await shot(page, `${file}-2-summary`);
      await page.getByRole('button', { name: 'Done' }).click();
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(600); // the fit animation settles
    await shot(page, `${file}-3-canvas`);
    await expect
      .poll(async () => (await storedTabs(page))[0]?.elements ?? 0, { timeout: 15_000 })
      .toBeGreaterThan(5);
    if (file === 'cloud-architecture.drawio.svg') {
      // The embedded logo came across into the gallery through the import image
      // pipeline; the web-linked status badge stayed a placeholder, never fetched.
      await expect(page.locator('[data-canvas-a11y-root]')).toBeVisible();
      const images = await page.evaluate(async () => {
        const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
        const res = await fetch('/api/images', { headers: { 'X-Owner-Id': owner } });
        return ((await res.json()) as { images: { contentType: string }[] }).images;
      });
      // A 1 px PNG already beats its WebP, so the pipeline keeps it as PNG.
      expect(images.map((i) => i.contentType)).toEqual(['image/png']);
    }
    expectNoPageErrors(pageErrors);
  });
}

// docs/specs/020-import-export/drawio-import.md "Import as new documents": files saved to Google
// Drive (no extension, compressed pages) and JSON exports, picked in the Explorer, each a document.
test.describe('importing draw.io files from the Explorer', () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  const compress = (xml: string) =>
    deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
  const page1 = (label: string) =>
    `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="${label}" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="160" height="60" as="geometry"/></mxCell></root></mxGraphModel>`;
  const driveSave = `<mxfile host="app.diagrams.net" modified="2026-03-12T10:00:00.000Z" name="Ignored">${[
    'Context',
    'Containers',
    'Deploy',
  ]
    .map((p) => `<diagram id="${p}" name="${p}">${compress(page1(p))}</diagram>`)
    .join('')}</mxfile>`;
  const jsonExport = JSON.stringify({
    version: '31.7.0',
    pages: [
      {
        id: 'p1',
        name: 'Flow',
        cells: [
          { id: '1', type: 'layer', parent: '0' },
          { id: 'a', type: 'node', parent: '1', label: 'Start' },
          { id: 'b', type: 'node', parent: '1', label: 'Finish<br>line', html: 1 },
          { id: 'e', type: 'edge', parent: '1', source: 'a', target: 'b' },
        ],
      },
    ],
  });

  const library = `<mxlibrary>${JSON.stringify([
    { xml: compress(page1('Service')), w: 160, h: 60, aspect: 'fixed', title: 'Service' },
  ])}</mxlibrary>`;

  test('each diagram becomes its own document, after the list', async ({ page, pageErrors }) => {
    await startBlankDocument(page);
    await dismissQuickTour(page);
    await page.goto('/explorer/recent');
    await page
      .getByRole('toolbar', { name: 'Import from' })
      .getByRole('button', { name: 'Import from draw.io' })
      .click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose files', exact: true }).click();
    await (
      await chooser
    ).setFiles([
      { name: 'Platform', mimeType: '', buffer: Buffer.from(driveSave) },
      { name: 'Signup flow.json', mimeType: 'application/json', buffer: Buffer.from(jsonExport) },
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a diagram') },
      { name: 'Team shapes.xml', mimeType: 'text/xml', buffer: Buffer.from(library) },
    ]);
    const list = page.getByRole('group', { name: 'Files to import' });
    await expect(list).toContainText('Platform');
    await expect(list).toContainText('Edited 12 Mar 2026 · 3 pages');
    await expect(list).toContainText('Signup flow');
    await expect(list).toContainText('Shape library · 1 shape');
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      '1 file will be left out',
    );
    await shot(page, 'explorer-1-list');
    await page.getByRole('button', { name: 'Import 3 files' }).click();

    const report = page.getByTestId('import-image-report');
    await expect(report).toContainText(
      "Positions and styles weren't in the file; the layout is automatic",
    );
    await expect(report).toContainText('notes.txt');
    // A library becomes a shape library of its own (docs/specs/013-workspace/shape-libraries.md).
    await expect(page.getByTestId('import-libraries')).toContainText('Team shapes');
    const documents = page.getByTestId('import-documents');
    await expect(documents).toContainText('Platform');
    await expect(documents).toContainText('Signup flow');
    await shot(page, 'explorer-2-report');

    // The Drive save opens as one document with a diagram tab per page.
    await documents.getByRole('link', { name: 'Platform' }).click();
    await expect
      .poll(() => storedTabs(page), { timeout: 15_000 })
      .toEqual([
        { name: 'Context', elements: 1 },
        { name: 'Containers', elements: 1 },
        { name: 'Deploy', elements: 1 },
      ]);
    await page.locator('[data-canvas-a11y-root]').waitFor();
    await expect(page.getByText('Containers', { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(600); // the fit animation settles
    await shot(page, 'explorer-3-document');
    expectNoPageErrors(pageErrors);
  });
});
