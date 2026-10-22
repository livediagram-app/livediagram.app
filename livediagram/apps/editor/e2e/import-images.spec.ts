import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import {
  test,
  expect,
  dismissQuickTour,
  expectNoPageErrors,
  startBlankDocument,
  pageOwnerHeaders,
} from './fixtures';

// Excalidraw import brings its images through the import image pipeline
// (docs/specs/020-import-export/import-image-pipeline.md): resized in the browser, stored in the
// gallery, counted in the report; and it reads a PNG exported with the scene embedded
// (docs/specs/020-import-export/excalidraw-import-export.md).

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../lib/__fixtures__/${name}`, import.meta.url)));

// A real PNG (an Excalidraw export) as the scene's bitmap, an SVG, and an
// image whose bytes the scene lacks.
function boardWithImages(): Buffer {
  const png = `data:image/png;base64,${fixture('excalidraw-export.excalidraw.png').toString('base64')}`;
  const svg = `data:image/svg+xml;base64,${Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#6366f1"/></svg>',
  ).toString('base64')}`;
  const image = (id: string, fileId: string, x: number) => ({
    id,
    type: 'image',
    x,
    y: 0,
    width: 200,
    height: 100,
    fileId,
    status: 'saved',
    isDeleted: false,
  });
  return Buffer.from(
    JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        image('a', 'png', 0),
        image('b', 'png', 250),
        image('c', 'svg', 500),
        image('d', 'gone', 750),
      ],
      files: {
        png: { id: 'png', mimeType: 'image/png', dataURL: png },
        svg: { id: 'svg', mimeType: 'image/svg+xml', dataURL: svg },
      },
    }),
  );
}

async function importExcalidrawFile(page: Page, name: string, buffer: Buffer) {
  await page.getByRole('button', { name: 'Tab menu' }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: /^Excalidraw/ }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import a file instead' }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/octet-stream', buffer });
}

test('an Excalidraw scene brings its images into the gallery and reports them', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await dismissQuickTour(page);
  await importExcalidrawFile(page, 'board.excalidraw', boardWithImages());

  const report = page.getByTestId('import-image-report');
  await expect(report).toContainText('Import complete');
  await expect(report).toContainText('3 images imported');
  await expect(report).toContainText('1 left as a placeholder');
  await expect(report).toContainText("The file didn't include the image data.");
  await expect(report.getByRole('button', { name: 'Done' })).toBeFocused();
  await report.getByRole('button', { name: 'Done' }).click();

  // The gallery holds two images: the PNG (used twice) and the rasterised SVG.
  const headers = await pageOwnerHeaders(page);
  const images = await page.evaluate(async (headers) => {
    const res = await fetch('/api/images', { headers });
    return ((await res.json()) as { images: { contentType: string }[] }).images;
  }, headers);
  expect(images.map((i) => i.contentType).sort()).toEqual(['image/webp', 'image/webp']);
  expectNoPageErrors(pageErrors);
});

test('a full gallery leaves placeholders and says so, never failing the import', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await dismissQuickTour(page);
  await page.route('**/api/images', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'gallery_full',
            reason: 'count',
            limit: 100,
            current: 100,
          }),
        })
      : route.fallback(),
  );
  await importExcalidrawFile(page, 'board.excalidraw', boardWithImages());

  const report = page.getByTestId('import-image-report');
  await expect(report).toContainText('4 left as placeholders');
  await expect(report.locator('[data-failure="gallery-full"]')).toContainText('3');
  await expect(report).toContainText('Your image gallery is full.');
  await expect(report).toContainText('Double-click a placeholder to add its image.');
  // The browser logs the refused uploads as failed resources; nothing else may leak.
  expectNoPageErrors(pageErrors);
});

test('a PNG exported from Excalidraw with the scene embedded imports its content', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await dismissQuickTour(page);
  await importExcalidrawFile(
    page,
    'board.excalidraw.png',
    fixture('excalidraw-export.excalidraw.png'),
  );
  // No images in this scene, so the dialog closes as before.
  await expect(page.getByRole('dialog', { name: 'Import into tab' })).toBeHidden();
  await expect(page.getByText('Imported from Excalidraw')).toBeVisible();
  expectNoPageErrors(pageErrors);
});

// A browser whose canvas cannot encode WebP hands back a PNG instead (Safari
// does). Emulated here in any engine by answering WebP requests with PNG, so
// the pipeline must detect it by the blob type and load the WASM encoder.
test('without canvas WebP, images are still stored as WebP via the WASM encoder', async ({
  page,
  pageErrors,
}) => {
  await page.addInitScript(() => {
    const asPng = (type?: string) => (type === 'image/webp' ? 'image/png' : type);
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
      return toBlob.call(this, cb, asPng(type), quality);
    };
    if (typeof OffscreenCanvas !== 'undefined') {
      const convert = OffscreenCanvas.prototype.convertToBlob;
      OffscreenCanvas.prototype.convertToBlob = function (options) {
        return convert.call(this, { ...options, type: asPng(options?.type) });
      };
    }
  });
  const wasmRequests: string[] = [];
  page.on('request', (r) => {
    if (/webp_enc(_simd)?\.[^/]*wasm$/.test(new URL(r.url()).pathname)) wasmRequests.push(r.url());
  });
  await startBlankDocument(page);
  await dismissQuickTour(page);
  // Nothing is fetched until an image needs encoding.
  expect(wasmRequests).toEqual([]);
  await importExcalidrawFile(page, 'board.excalidraw', boardWithImages());
  await expect(page.getByTestId('import-image-report')).toContainText('3 images imported');

  const headers = await pageOwnerHeaders(page);
  const images = await page.evaluate(async (headers) => {
    const res = await fetch('/api/images', { headers });
    return ((await res.json()) as { images: { contentType: string }[] }).images;
  }, headers);
  expect(images.map((i) => i.contentType).sort()).toEqual(['image/webp', 'image/webp']);
  expect(wasmRequests).toHaveLength(1);
  expectNoPageErrors(pageErrors);
});
