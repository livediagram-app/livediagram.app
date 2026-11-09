import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  serverNewUrl,
  test,
} from './fixtures';

// docs/specs/008-canvas/drag-preview.md "A dragged element keeps its look": an element looks exactly the same mid-drag
// as at rest. The canvas draws a theme in the viewer's half (a light theme's colours turned dark on a dark screen),
// while a drag works on the stored elements: drawn from those, a dragged element took the other half's colours until
// it was dropped. Each element is compared at rest and mid-drag twice over: every node's computed colours, and the
// pixels inside it.

const CANVAS = '[data-canvas-a11y-root]';

// What a light theme stamps on the elements it paints (themes-data.ts), and its canvas, so a dark screen redraws them.
const INDIGO = { fillColor: '#e0e7ff', strokeColor: '#4338ca', textColor: '#312e81' };
const INDIGO_TAB = { theme: 'indigo', backgroundColor: '#eef2ff', patternColor: '#c7d2fe' };
// A dark theme on a light screen: the other way round.
const PINE = { fillColor: '#166534', strokeColor: '#86efac', textColor: '#dcfce7' };
const PINE_TAB = { theme: 'pine', backgroundColor: '#14532d', patternColor: '#166534' };

// One row, every edge and centre apart, so a drag straight down meets no alignment guide.
function board(paint: Record<string, string>) {
  return [
    {
      id: 'entity',
      type: 'shape',
      shape: 'entity',
      x: 120,
      y: 150,
      width: 200,
      height: 110,
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      label: 'Dashboard widget',
      entityFields: [
        { name: 'view', type: 'text' },
        { name: 'types', type: 'json' },
      ],
      ...paint,
    },
    {
      id: 'square',
      type: 'shape',
      shape: 'square',
      x: 430,
      y: 150,
      width: 150,
      height: 90,
      label: 'Plain',
      ...paint,
    },
    { id: 'sticky', type: 'sticky', x: 730, y: 150, width: 150, height: 150, label: 'Sticky' },
    {
      id: 'text',
      type: 'text',
      x: 1030,
      y: 150,
      width: 190,
      height: 40,
      label: 'Some text',
      textColor: paint.textColor,
    },
  ];
}

const box = (page: Page, id: string) => page.locator(`${CANVAS} [data-element-id="${id}"]`).first();

// Every paint the element's nodes are drawn in. As a set: a control the pointer reveals by hovering (it sits on the
// element mid-drag) adds a node, not a colour.
const looks = (page: Page, id: string) =>
  box(page, id).evaluate((root) =>
    [
      ...new Set(
        [root, ...root.querySelectorAll('*')].map((n) => {
          const s = getComputedStyle(n);
          return [
            s.backgroundColor,
            s.color,
            s.fill,
            s.stroke,
            s.borderTopColor,
            s.opacity,
            s.filter,
          ].join('|');
        }),
      ),
    ].sort(),
  );

// The element's own pixels: everything else on the page (the canvas, the selection's chrome, the toolbars that follow
// it) hidden for the shot, so only the element itself is compared.
async function inside(page: Page, id: string): Promise<string> {
  const only = `[data-element-id="${id}"]`;
  const shot = await box(page, id).screenshot({
    animations: 'disabled',
    style: `body * { visibility: hidden !important; } ${CANVAS} ${only}, ${CANVAS} ${only} * { visibility: visible !important; }`,
  });
  return shot.toString('base64');
}

// The share of pixels that differ between two shots of the same size, decoded in the page.
const pixelsDiffering = (page: Page, a: string, b: string) =>
  page.evaluate(
    async ([a, b]) => {
      const read = async (png: string) => {
        const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${png}`)).blob(),
        );
        const c = new OffscreenCanvas(bitmap.width, bitmap.height);
        const g = c.getContext('2d')!;
        g.drawImage(bitmap, 0, 0);
        return g.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const [pa, pb] = await Promise.all([read(a), read(b)]);
      if (pa.width !== pb.width || pa.height !== pb.height) return 1;
      let off = 0;
      for (let i = 0; i < pa.data.length; i += 4) {
        const d = Math.max(
          Math.abs(pa.data[i]! - pb.data[i]!),
          Math.abs(pa.data[i + 1]! - pb.data[i + 1]!),
          Math.abs(pa.data[i + 2]! - pb.data[i + 2]!),
        );
        if (d > 24) off++;
      }
      return off / (pa.width * pa.height);
    },
    [a, b] as [string, string],
  );

async function openBoard(
  page: Page,
  scheme: 'dark' | 'light',
  paint: Record<string, string>,
  tab: object,
) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(await serverNewUrl(page, '/new?blank=1'));
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await seedTab(page, board(paint), tab as Record<string, unknown>);
  await page.keyboard.press('v');
  await expect(box(page, 'entity')).toBeVisible();
}

for (const { name, scheme, paint, tab } of [
  {
    name: 'a light theme on a dark screen',
    scheme: 'dark' as const,
    paint: INDIGO,
    tab: INDIGO_TAB,
  },
  { name: 'a dark theme on a light screen', scheme: 'light' as const, paint: PINE, tab: PINE_TAB },
]) {
  test(`every element keeps its look while dragged: ${name}`, async ({ page, pageErrors }) => {
    // Four drags, each looked at twice.
    test.setTimeout(120_000);
    await openBoard(page, scheme, paint, tab);
    // The canvas does redraw this theme: the entity is not drawn in its stored fill.
    const stored = await box(page, 'entity').evaluate((n) => getComputedStyle(n).backgroundColor);
    expect(stored).not.toBe('rgb(224, 231, 255)');
    for (const id of ['entity', 'square', 'sticky', 'text']) {
      const r = (await box(page, id).boundingBox())!;
      // By its top edge: an entity's rows below take their own gestures.
      const at = { x: r.x + r.width / 2, y: r.y + 12 };
      // Selected first, so the rest shot carries the same selection chrome a drag does.
      await page.mouse.click(at.x, at.y);
      await page.mouse.move(800, 820);
      await page.waitForTimeout(250);
      const restLooks = await looks(page, id);
      const restShot = await inside(page, id);

      // Past the double-click window, so the press is a fresh drag and not a second click (which edits).
      await page.waitForTimeout(600);
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(at.x, at.y + i * 20);
      await page.waitForTimeout(250);
      const moved = (await box(page, id).boundingBox())!;
      expect(moved.y, `${id} moved`).toBeGreaterThan(r.y + 150);
      expect(await looks(page, id), `${id}'s colours mid-drag`).toEqual(restLooks);
      expect(
        await pixelsDiffering(page, restShot, await inside(page, id)),
        `${id}'s pixels mid-drag`,
      ).toBeLessThan(0.01);

      // Cancelled, so the board is as seeded for the next element.
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect.poll(async () => (await box(page, id).boundingBox())!.y).toBeCloseTo(r.y, 0);
    }
    expectNoPageErrors(pageErrors);
  });
}
