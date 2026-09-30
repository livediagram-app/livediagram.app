import type { Locator, Page } from '@playwright/test';
import { expect, test, expectNoPageErrors, seedTab, startBlankDocument } from './fixtures';

// A shape drawn to its box edge keeps its stroke inside the box, as a square's CSS border does
// (docs/specs/008-canvas/canvas-and-palette.md, Shape primitives). The proof is pixels: the ring
// just outside the element box paints the same with the shape shown as with it hidden.

// The kinds whose outline touches the box edge (shape-geometry.ts `strokeInside`).
const EDGE_KINDS = ['diamond', 'parallelogram', 'hexagon', 'document', 'cylinder', 'cloud'];

const MARGIN_PX = 6;
// Summed RGB difference that counts as ink.
const INK_THRESHOLD = 24;

async function inkOutsideBox(page: Page, element: Locator): Promise<number> {
  // A new element pops in (a scale entry animation), and a bounding box read
  // mid-pop is the shrunken one, while the screenshots below finish the
  // animation first. The ring would then be clipped from a box smaller than
  // the diamond it measures, and count the diamond's own edges as ink. Wait
  // the entry out before measuring.
  await element.evaluate((el: HTMLElement) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  );
  const box = (await element.boundingBox())!;
  const clip = {
    x: box.x - MARGIN_PX,
    y: box.y - MARGIN_PX,
    width: box.width + 2 * MARGIN_PX,
    height: box.height + 2 * MARGIN_PX,
  };
  const shot = () => page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  await element.evaluate((el: HTMLElement) => (el.style.visibility = 'hidden'));
  const without = await shot();
  await element.evaluate((el: HTMLElement) => (el.style.visibility = ''));
  const withShape = await shot();
  return page.evaluate(
    async ([sa, sb, margin, threshold]) => {
      const read = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = new OffscreenCanvas(img.width, img.height);
        const x = c.getContext('2d')!;
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, img.width, img.height);
      };
      const [a, b] = await Promise.all([read(sa), read(sb)]);
      // The ring is MARGIN_PX CSS pixels wide, in image pixels at the page's scale.
      const m = Math.round(margin * window.devicePixelRatio);
      let ink = 0;
      for (let y = 0; y < a.height; y++)
        for (let x = 0; x < a.width; x++) {
          if (x >= m && x < a.width - m && y >= m && y < a.height - m) continue;
          const k = (y * a.width + x) * 4;
          const diff =
            Math.abs(a.data[k]! - b.data[k]!) +
            Math.abs(a.data[k + 1]! - b.data[k + 1]!) +
            Math.abs(a.data[k + 2]! - b.data[k + 2]!);
          if (diff > threshold) ink++;
        }
      return ink;
    },
    [withShape.toString('base64'), without.toString('base64'), MARGIN_PX, INK_THRESHOLD] as const,
  );
}

test('a shape drawn to its box edge paints no stroke outside it', async ({ page, pageErrors }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await startBlankDocument(page);
  // Three to a row, 60px apart: wider than both margins, so no neighbour is in the ring.
  await seedTab(
    page,
    EDGE_KINDS.map((shape, i) => ({
      id: `s-${shape}`,
      type: 'shape',
      shape,
      x: 100 + (i % 3) * 220,
      y: 100 + Math.floor(i / 3) * 160,
      width: 160,
      height: 100,
    })),
  );

  const outside: Record<string, number> = {};
  for (const shape of EDGE_KINDS) {
    const element = page.locator(`[data-element-id="s-${shape}"] svg`).first().locator('..');
    await element.waitFor();
    outside[shape] = await inkOutsideBox(page, element);
  }
  expect(outside).toEqual(Object.fromEntries(EDGE_KINDS.map((shape) => [shape, 0])));

  expectNoPageErrors(pageErrors);
});
