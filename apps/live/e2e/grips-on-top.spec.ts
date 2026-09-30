import type { Page } from '@playwright/test';
import { test, expect, expectNoPageErrors, openJustDraw, seedTab } from './fixtures';

// The handles are always on top (docs/specs/008-canvas/canvas-and-palette.md "Resize"): whatever the
// selected element's place in the stacking order, its rotation, opacity or animation, and whatever
// is drawn over it, the element under every grip's centre is the grip itself. Unit tests cannot see
// stacking contexts, so this reads document.elementFromPoint in a real browser.

test.use({ viewport: { width: 1600, height: 1000 }, colorScheme: 'dark', ignoreHTTPSErrors: true });

const box = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 160,
  height: 100,
  label: id,
  ...extra,
});

// Each target is painted first (sent to back) with a later element over its bottom-right corner.
const CASES = [
  { name: 'rotated', target: { rotation: 20 } },
  { name: 'faded', target: { opacity: 0.6 } },
  { name: 'animated', target: { animation: 'bounce' } },
  {
    name: 'under a note',
    target: { opacity: 0.8 },
    cover: { type: 'sticky', width: 120, height: 120 },
  },
] as const;

const seed = [
  ...CASES.flatMap((c, i) => {
    const x = 480 + i * 250;
    const cover: Record<string, unknown> = box(`C${i}`, x + 120, 370, 'cover' in c ? c.cover : {});
    if (cover.type === 'sticky') delete cover.shape;
    return [box(`T${i}`, x, 300, c.target), cover];
  }),
  // An arrow whose end sits under a box painted after it.
  {
    id: 'AR',
    type: 'arrow',
    from: { kind: 'free', x: 400, y: 620 },
    to: { kind: 'free', x: 600, y: 640 },
  },
  box('K', 570, 610, { width: 70, height: 70 }),
];

// Every grip an element covers at the grip's own centre, with the element that covers it. The
// floating panels over the canvas are not elements, and the viewport leaves some grips beneath them.
async function coveredGrips(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const grips = [
      ...document.querySelectorAll<HTMLElement>('[data-canvas-handle]'),
      ...document.querySelectorAll<SVGElement>('[data-selection-grips] svg circle'),
    ];
    return grips.flatMap((grip) => {
      const r = grip.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (hit === grip || (hit && grip.contains(hit))) return [];
      const host = hit?.closest('[data-element-id]');
      if (!host) return [];
      return [
        `${grip.getAttribute('aria-label') ?? grip.tagName} under ${host.getAttribute('aria-label')}`,
      ];
    });
  });
}

async function select(page: Page, label: string): Promise<void> {
  const el = page.locator(`[aria-label='Square "${label}"']`);
  const r = (await el.boundingBox())!;
  await page.mouse.click(r.x + r.width * 0.35, r.y + r.height * 0.35);
}

test.describe('selection grips', () => {
  test('stay above every element', async ({ page, pageErrors }) => {
    await openJustDraw(page);
    await seedTab(page, seed);

    for (const [i, c] of CASES.entries()) {
      await select(page, `T${i}`);
      const grips = page.locator('[data-selection-grips] [data-grips-for] [data-canvas-handle]');
      await expect(grips, c.name).toHaveCount(8);
      expect(await coveredGrips(page), c.name).toEqual([]);
      await page.keyboard.press('Escape');
    }

    // The arrow's end grips.
    const line = page.locator('path[data-element-id="AR"]');
    const r = (await line.boundingBox())!;
    await page.mouse.click(r.x + r.width * 0.3, r.y + r.height * 0.3);
    await expect(page.locator('[data-selection-grips] svg circle[r="6"]')).toHaveCount(2);
    expect(await coveredGrips(page), 'arrow').toEqual([]);

    expectNoPageErrors(pageErrors);
  });
});
