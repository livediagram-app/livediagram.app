import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  serverNewUrl,
  test,
  type Seed,
} from './fixtures';

// The Fill tool (docs/specs/023-draw-mode/fill-tool.md): a board with an empty square, a marker loop
// whose ends nearly meet and an open squiggle. The bucket fills the square, closes and fills the
// loop, hints on the bare board, each fill one undo step, and the fills survive a reload. On a phone
// a tap fills. E2E_FILL_SHOTS names a folder for before and after screenshots.

const SHOTS = process.env.E2E_FILL_SHOTS;

// A ring stopping `gapDeg` short of a full turn, in normalised points.
const ring = (gapDeg: number) =>
  Array.from({ length: 40 }, (_, i) => {
    const a = (i / 39) * (((360 - gapDeg) * Math.PI) / 180);
    return { nx: 0.5 + 0.5 * Math.cos(a), ny: 0.5 + 0.5 * Math.sin(a) };
  });

const BOARD: Seed = [
  {
    id: 'box',
    type: 'shape',
    shape: 'square',
    x: 200,
    y: 180,
    width: 200,
    height: 160,
    fillColor: 'transparent',
  },
  {
    id: 'loop',
    type: 'freehand',
    x: 480,
    y: 180,
    width: 160,
    height: 160,
    points: ring(12),
    closed: false,
    penWidth: 2.5,
    streamline: 0,
  },
  {
    id: 'squiggle',
    type: 'freehand',
    x: 720,
    y: 200,
    width: 200,
    height: 120,
    points: ring(200),
    closed: false,
    penWidth: 2.5,
    streamline: 0,
  },
];

const dock = (page: Page) => page.locator('[data-whiteboard-dock]');
const fillButton = (page: Page) => dock(page).getByRole('button', { name: 'Fill', exact: true });

// The colour a seeded element's fill path paints, or null.
async function loopFill(page: Page): Promise<string | null> {
  return page
    .locator('[data-element-id="loop"] [data-loop-fill]')
    .first()
    .getAttribute('fill', { timeout: 2000 })
    .catch(() => null);
}

// Whether the square paints a fill: any of its drawn parts with a visible fill or background.
async function boxFilled(page: Page): Promise<boolean> {
  return page
    .locator('[data-element-id="box"]')
    .first()
    .evaluate((el) => {
      const visible = (c: string) => /^rgb/.test(c) && !/rgba\([^)]*,\s*0\)$/.test(c);
      return [el, ...el.querySelectorAll('*')].some((n) => {
        const style = getComputedStyle(n);
        return n instanceof SVGElement && !(n instanceof SVGSVGElement)
          ? n.tagName !== 'text' && visible(style.fill)
          : visible(style.backgroundColor);
      });
    });
}

async function openBoard(page: Page) {
  await page.goto(await serverNewUrl(page, '/new?template=whiteboard'));
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await seedTab(page, BOARD);
  await page.locator('[data-element-id="loop"]').first().waitFor();
  await page.keyboard.press('v');
}

// A press in canvas px of a seeded element's box, as a fraction of it.
async function pressAt(page: Page, id: string, fx = 0.5, fy = 0.5) {
  const box = (await page.locator(`[data-element-id="${id}"]`).first().boundingBox())!;
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

test('fills a shape and a marker loop, hints elsewhere, one undo step each, kept on reload', async ({
  page,
  pageErrors,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openBoard(page);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-before.png` });
  expect(await boxFilled(page)).toBe(false);
  expect(await loopFill(page)).toBeNull();

  // F picks the bucket up; its button says it is in hand.
  await page.keyboard.press('f');
  await expect(fillButton(page)).toHaveAttribute('aria-pressed', 'true');
  // Pressed again in hand, it opens the one colour picker; pick a theme fill.
  await fillButton(page).click();
  const flyout = page.locator('#whiteboard-flyout-fill');
  await expect(flyout).toBeVisible();
  await expect(flyout.getByRole('button', { name: 'No fill' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-picker.png` });
  await page.keyboard.press('Escape');
  await expect(flyout).toBeHidden();
  await expect(fillButton(page)).toHaveAttribute('aria-pressed', 'true');

  const inBox = await pressAt(page, 'box');
  await page.mouse.click(inBox.x, inBox.y);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-box.png` });
  await expect.poll(() => boxFilled(page)).toBe(true);

  const inLoop = await pressAt(page, 'loop');
  await page.mouse.click(inLoop.x, inLoop.y);
  await expect.poll(() => loopFill(page)).not.toBeNull();

  // The open squiggle's middle is not inside anything: a hint, and nothing changes.
  const inSquiggle = await pressAt(page, 'squiggle', 0.1, 0.9);
  await page.mouse.click(inSquiggle.x, inSquiggle.y);
  await expect(
    page.getByText('Click inside a closed shape, or a loop whose ends meet, to fill it.'),
  ).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desktop-after.png` });

  // One undo step takes the loop's fill back, and only that.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => loopFill(page)).toBeNull();
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(() => loopFill(page)).not.toBeNull();

  // Still in hand after each fill; kept on the server.
  await expect(fillButton(page)).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(2500);
  await page.reload();
  await page.locator('[data-element-id="loop"]').first().waitFor();
  await expect.poll(() => loopFill(page)).not.toBeNull();
  expectNoPageErrors(pageErrors);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('a tap with the bucket fills', async ({ page, pageErrors }) => {
    test.setTimeout(120_000);
    await openBoard(page);
    await fillButton(page).tap();
    await expect(fillButton(page)).toHaveAttribute('aria-pressed', 'true');
    const inLoop = await pressAt(page, 'loop');
    await page.touchscreen.tap(inLoop.x, inLoop.y);
    await expect.poll(() => loopFill(page)).not.toBeNull();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-after.png` });
    expectNoPageErrors(pageErrors);
  });
});
