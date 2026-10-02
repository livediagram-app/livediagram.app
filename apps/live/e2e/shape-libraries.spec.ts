import { deflateRawSync } from 'node:zlib';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, startBlankDocument, test } from './fixtures';

// Shape libraries end to end (docs/specs/013-workspace/shape-libraries.md): a synthesised draw.io
// library imported from the Explorer becomes a named library, its shapes are placed from the
// palette's My shapes, and the Explorer page renames and deletes it. SHAPE_LIBRARY_SHOTS=<dir> also
// saves screenshots of each step.

const SHOTS = process.env.SHAPE_LIBRARY_SHOTS;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

const compress = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
const model = (cells: string) =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
const box = (id: string, label: string, x: number) =>
  `<mxCell id="${id}" value="${label}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="${x}" y="0" width="120" height="60" as="geometry"/></mxCell>`;
const library = `<mxlibrary>${JSON.stringify([
  {
    xml: compress(model(box('a', 'Service', 0))),
    w: 120,
    h: 60,
    aspect: 'fixed',
    title: 'Service',
  },
  {
    xml: compress(
      model(
        box('a', 'Client', 0) +
          box('b', 'Server', 200) +
          '<mxCell id="e" edge="1" parent="1" source="a" target="b" style="endArrow=classic;"><mxGeometry relative="1" as="geometry"/></mxCell>',
      ),
    ),
    w: 320,
    h: 60,
    title: 'Request',
  },
])}</mxlibrary>`;

// How many elements the active tab stores, read back through the api.
async function storedElements(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const headers = { 'X-Owner-Id': owner };
    const doc = await (await fetch(`/api/documents/${id}`, { headers })).json();
    const tabId = doc.document?.tabs?.[0]?.id;
    if (!tabId) return -1;
    const tab = await (await fetch(`/api/documents/${id}/tabs/${tabId}`, { headers })).json();
    return (tab.tab?.elements ?? []).length as number;
  });
}

test.use({ colorScheme: 'dark', viewport: { width: 1400, height: 900 } });

test('a draw.io library becomes a shape library, placed from My shapes', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await dismissQuickTour(page);

  // Import: one library file imports straight away and is named in the report.
  await page.goto('/explorer/recent');
  await page
    .getByRole('toolbar', { name: 'Import from' })
    .getByRole('button', { name: 'Import from draw.io' })
    .click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose files', exact: true }).click();
  await (
    await chooser
  ).setFiles([{ name: 'Team shapes.xml', mimeType: 'text/xml', buffer: Buffer.from(library) }]);
  await expect(page.getByTestId('import-libraries')).toContainText('Team shapes');
  await shot(page, '1-report');
  await page.getByRole('button', { name: 'Done' }).click();

  // The Explorer page lists it; rename it in place.
  await page.goto('/explorer/shape-libraries');
  const card = page.getByRole('article', { name: 'Team shapes' });
  await expect(card).toContainText('2 shapes');
  await card.getByRole('button', { name: 'Rename Team shapes' }).click();
  const input = page.getByRole('textbox', { name: 'Library name' });
  await input.fill('House shapes');
  await input.press('Enter');
  await expect(page.getByRole('article', { name: 'House shapes' })).toBeVisible();
  await shot(page, '2-explorer');

  // Place both shapes from the palette's My shapes: one box, then two boxes and their connection.
  await startBlankDocument(page);
  await page.getByRole('button', { name: 'Palette category' }).click();
  await page.locator('[data-option-id="my-shapes"]').click();
  await page.getByRole('button', { name: 'Insert Service from House shapes' }).click();
  await expect.poll(() => storedElements(page), { timeout: 15_000 }).toBe(1);
  await page.getByRole('button', { name: 'Insert Request from House shapes' }).click();
  await expect.poll(() => storedElements(page), { timeout: 15_000 }).toBe(4);
  await page.waitForTimeout(400);
  await shot(page, '3-placed');

  // Delete it after confirming: the page says there are none.
  await page.goto('/explorer/shape-libraries');
  await page
    .getByRole('article', { name: 'House shapes' })
    .getByRole('button', { name: 'Delete House shapes' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No shape libraries yet')).toBeVisible();
  expectNoPageErrors(pageErrors);
});
