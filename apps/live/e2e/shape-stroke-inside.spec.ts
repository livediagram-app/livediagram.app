import type { Locator, Page } from '@playwright/test';
import { expect, test, expectNoPageErrors, openJustDraw } from './fixtures';

// A diamond's stroke stays inside its box, as a square's CSS border does
// (docs/specs/008-canvas/canvas-and-palette.md, Shape primitives). The proof is pixels: the ring
// just outside the element box paints the same with the diamond shown as with it hidden.

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

test('a diamond paints no stroke outside its box', async ({ page, pageErrors }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await openJustDraw(page);
  const canvas = page.locator('[data-canvas-a11y-root]');

  await page.getByRole('button', { name: 'Add diamond', exact: true }).click();
  await canvas.click({ position: { x: 500, y: 300 } });
  await page.keyboard.press('Escape');
  const polygon = page.locator('polygon[points="50,0 100,50 50,100 0,50"]');
  await polygon.waitFor();
  const element = polygon.locator('xpath=ancestor::*[local-name()="svg"][1]/..');

  expect(await inkOutsideBox(page, element)).toBe(0);

  expectNoPageErrors(pageErrors);
});
