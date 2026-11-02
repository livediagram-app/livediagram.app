import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { workingSizeOf } from '../src/working-size';

// THE EDITOR'S OWN PIXELS. The detector is judged on the working image the
// product would give it, so that image is made the product's way: the photo
// decoded by a real Chromium (`createImageBitmap`, EXIF orientation applied)
// and drawn at the working size with `imageSmoothingQuality = 'high'` —
// exactly `drawTo` in apps/editor/lib/photo-detect.ts. ImageMagick's resize is a
// different filter, and on small notes the difference moved whole boxes: the
// same detector scored 91.4 on ImageMagick's pixels and 90.7 on Chromium's,
// and a different wall passed.

// Render every photo's working image in ONE browser, caching the RGBA beside
// the ImageMagick cache. Returns the names it could render; any it could not
// (no browser installed, say) are left to the ImageMagick path.
export async function renderWorkingImages(
  photoDir: string,
  names: string[],
  edge: number,
  cachePathOf: (name: string) => { rgba: string; meta: string },
): Promise<string[]> {
  const todo = names.filter((n) => !existsSync(cachePathOf(n).rgba));
  if (todo.length === 0) return names;
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.warn(
      `  no Chromium for the editor's resampling (${String(err).split('\n')[0]}); using ImageMagick`,
    );
    return names.filter((n) => existsSync(cachePathOf(n).rgba));
  }
  try {
    const page = await browser.newPage();
    for (const name of todo) {
      const bytes = readFileSync(`${photoDir}/${name}`).toString('base64');
      const type = /\.png$/i.test(name) ? 'image/png' : 'image/jpeg';
      // Decode in the page, size in Node (the editor's own rule, not a copy of its source), draw
      // in the page: the bitmap stays there between the steps, behind a handle.
      const bitmap = await page.evaluateHandle(
        ({ bytes, type }) =>
          createImageBitmap(
            new Blob([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))], { type }),
            { imageOrientation: 'from-image' },
          ),
        { bytes, type },
      );
      const decoded = await bitmap.evaluate((b) => ({ width: b.width, height: b.height }));
      const { width, height } = workingSizeOf(decoded.width, decoded.height, edge);
      const rgba = await bitmap.evaluate(
        (b, { width, height }) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(b, 0, 0, width, height);
          const data = ctx.getImageData(0, 0, width, height).data;
          let binary = '';
          for (let i = 0; i < data.length; i += 0x8000) {
            binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
          }
          return btoa(binary);
        },
        { width, height },
      );
      await bitmap.dispose();
      const paths = cachePathOf(name);
      writeFileSync(paths.rgba, Buffer.from(rgba, 'base64'));
      writeFileSync(paths.meta, JSON.stringify({ width, height }));
    }
  } finally {
    await browser.close();
  }
  return names;
}
