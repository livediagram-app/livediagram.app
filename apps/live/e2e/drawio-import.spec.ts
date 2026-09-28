import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, startBlankDiagram, test } from './fixtures';

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

// The saved diagram, read back through the api the way the editor stores it.
async function storedTabs(page: Page) {
  return page.evaluate(async () => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const headers = { 'X-Owner-Id': owner };
    const diagram = await (await fetch(`/api/diagrams/${id}`, { headers })).json();
    const summaries: { id: string; name: string }[] = diagram.diagram?.tabs ?? [];
    return Promise.all(
      summaries.map(async (t) => {
        const got = await (await fetch(`/api/diagrams/${id}/tabs/${t.id}`, { headers })).json();
        return { name: t.name, elements: (got.tab?.elements ?? []).length as number };
      }),
    );
  });
}

test('a multi-page draw.io file becomes a tab per page, with a summary', async ({
  page,
  pageErrors,
}) => {
  await startBlankDiagram(page);
  await dismissQuickTour(page);
  await importFile(page, 'multi-page.drawio');

  const summary = page.getByTestId('import-report');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('3 pages became 3 tabs, 17 elements.');
  await expect(summary).toContainText('1 group was dropped; its shapes kept their places.');
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
    await startBlankDiagram(page);
    await dismissQuickTour(page);
    await importFile(page, file);
    const summary = page.getByTestId('import-report');
    // A clean import closes the dialog; one that changed anything summarises.
    const dialogs = page.getByRole('dialog');
    await expect
      .poll(async () => (await summary.isVisible()) || (await dialogs.count()) === 0)
      .toBe(true);
    if (await summary.isVisible()) {
      if (file === 'cloud-architecture.drawio.svg') {
        await expect(summary.getByTestId('import-report-images')).toContainText('1 image imported');
        await expect(summary.getByTestId('import-report-notes')).toContainText(
          '1 image links to a file outside the diagram',
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
