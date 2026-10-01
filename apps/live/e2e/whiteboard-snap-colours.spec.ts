import type { Page } from '@playwright/test';
import { penColourHex, WHITEBOARD_INK } from '@livediagram/document';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  settledBox,
  test,
  type Seed,
} from './fixtures';

// Snap colours (docs/specs/023-whiteboard/whiteboard.md "Snap colours"): a synthesised board with
// custom-coloured marker strokes, a shape and an arrow, beside a stock stroke and a highlighter
// that must stay as they are. The Settings flyout offers the snap, it lands as one undo step, and
// the strokes then draw in each board's own version of their stock colour.

const SHOTS = process.env.E2E_SNAP_SHOTS;

// A gentle wave across its box, in normalised points.
const wave = (phase: number) =>
  Array.from({ length: 24 }, (_, i) => ({
    nx: i / 23,
    ny: 0.5 + 0.4 * Math.sin(phase + (i / 23) * Math.PI * 2),
  }));

const stroke = (id: string, y: number, colour: Record<string, unknown>, phase = 0) => ({
  id,
  type: 'freehand',
  x: 240,
  y,
  width: 420,
  height: 60,
  points: wave(phase),
  closed: false,
  penWidth: 2.5,
  streamline: 0,
  ...colour,
});

const BOARD: Seed = [
  stroke('orange', 140, { strokeColor: '#ff6b00' }),
  stroke('fuchsia', 220, { strokeColor: '#c026d3' }, 1),
  stroke('grey', 300, { strokeColor: '#7a7a7a' }, 2),
  stroke('sea', 380, { strokeColor: '#00a39b' }, 3),
  stroke('stock', 460, { penColour: 'blue' }, 4),
  stroke('marker', 540, { strokeColor: '#ffd43b', pen: 'highlighter', penWidth: 14 }, 5),
  {
    id: 'box',
    type: 'shape',
    shape: 'square',
    x: 740,
    y: 160,
    width: 200,
    height: 140,
    strokeColor: '#0891b2',
    fillColor: 'transparent',
  },
  {
    id: 'link',
    type: 'arrow',
    from: { kind: 'free', x: 740, y: 400 },
    to: { kind: 'free', x: 940, y: 520 },
    strokeColor: '#be123c',
    strokeWidth: 2.5,
  },
];

// The colours an element is painted in on the canvas: its drawn parts' fill and stroke, and a
// shape's border.
async function painted(page: Page, id: string): Promise<string[]> {
  return page
    .locator(`[data-element-id="${id}"]`)
    .first()
    .evaluate((hit) => {
      // An arrow's id sits on its transparent hit band; its drawn line is in the band's group.
      const el = hit instanceof SVGElement ? (hit.closest('g[role="img"]') ?? hit) : hit;
      const out = new Set<string>();
      const add = (c: string) => {
        const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c);
        if (!m || m[4] === '0') return;
        out.add(
          '#' +
            m
              .slice(1, 4)
              .map((v) => Number(v).toString(16).padStart(2, '0'))
              .join(''),
        );
      };
      for (const node of [el, ...el.querySelectorAll('*')]) {
        const s = getComputedStyle(node);
        if (node instanceof SVGElement) [s.fill, s.stroke].forEach(add);
        else if (parseFloat(s.borderTopWidth) > 0) add(s.borderTopColor);
      }
      return [...out];
    });
}

const PREFS_KEY = 'livediagram:user-preferences:v1';
const dock = (page: Page) => page.locator('[data-whiteboard-dock]');

async function openSettings(page: Page) {
  await dock(page).getByRole('button', { name: 'Settings', exact: true }).click();
  return page.locator('#whiteboard-flyout-settings');
}

// The dock at the top (the default) or the bottom (docs/specs/023-whiteboard/whiteboard.md "Where
// the dock sits"), chosen before the editor loads, as the synced preference stores it.
async function placeDock(page: Page, position: 'top' | 'bottom') {
  await page.addInitScript(
    ([key, whiteboardDockPosition]) => {
      const prefs = JSON.parse(localStorage.getItem(key as string) ?? '{}');
      localStorage.setItem(key as string, JSON.stringify({ ...prefs, whiteboardDockPosition }));
    },
    [PREFS_KEY, position] as const,
  );
}

for (const [scheme, position] of [
  ['dark', 'top'],
  ['light', 'top'],
  ['dark', 'bottom'],
  ['light', 'bottom'],
] as const) {
  const shot = (step: string) => `${SHOTS}/${scheme}-${position}-${step}.png`;
  test(`snaps a board's custom colours to stock colours, one undo step (${scheme}, dock at the ${position})`, async ({
    page,
    pageErrors,
  }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 800 });
    await placeDock(page, position);
    await page.goto('/new?template=whiteboard');
    await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
    await dismissQuickTour(page);
    await seedTab(page, BOARD);
    await page.locator('[data-element-id="link"]').first().waitFor();
    await page.keyboard.press('v');
    if (SHOTS) await page.screenshot({ path: shot('1-before') });

    const settings = await openSettings(page);
    const colours = settings.getByRole('group', { name: 'Colours' });
    // Six custom colours: four strokes, the shape and the arrow; never the stock stroke or the
    // highlighter.
    await expect(colours.getByText('6 custom colours')).toBeVisible();
    await expect(colours.locator('[data-snap-swatch]')).toHaveCount(6);
    // The section follows its flyout to the board side of the dock, wholly in view.
    await expect(dock(page)).toHaveAttribute('data-dock-position', position);
    await expect(settings).toHaveAttribute('data-side', position === 'top' ? 'below' : 'above');
    // The dock's own box (its pills), and the section once the flyout's pop-in has settled.
    const bar = (await dock(page).boundingBox())!;
    const section = await settledBox(colours);
    if (position === 'top') expect(section.y).toBeGreaterThan(bar.y + bar.height);
    else expect(section.y + section.height).toBeLessThan(bar.y);
    expect(section.y).toBeGreaterThanOrEqual(0);
    expect(section.y + section.height).toBeLessThanOrEqual(800);
    if (SHOTS) await page.screenshot({ path: shot('2-offer') });

    await colours.getByRole('button', { name: 'Snap to stock colours' }).click();
    await expect(colours.getByRole('status')).toHaveText(
      '6 custom colours snapped to stock colours',
    );
    await expect(colours.getByRole('button', { name: 'Snap to stock colours' })).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: shot('3-snapped') });

    // Each now draws in its stock colour's version for this board; grey became the ink.
    const expected: Record<string, string> = {
      orange: penColourHex('orange', scheme),
      fuchsia: penColourHex('pink', scheme),
      grey: WHITEBOARD_INK[scheme],
      sea: penColourHex('teal', scheme),
      stock: penColourHex('blue', scheme),
      box: penColourHex('teal', scheme),
      link: penColourHex('red', scheme),
    };
    for (const [id, hex] of Object.entries(expected)) {
      await expect.poll(() => painted(page, id), { message: id }).toContain(hex);
    }
    await expect.poll(() => painted(page, 'marker')).toContain('#ffd43b');

    // Closing the flyout forgets the confirmation; with nothing left to snap there is no section.
    await page.keyboard.press('Escape');
    await openSettings(page);
    await expect(page.getByRole('group', { name: 'Colours' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    if (SHOTS) await page.screenshot({ path: shot('4-after') });

    // One undo brings every custom colour back, and with them the section.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => painted(page, 'orange')).toContain('#ff6b00');
    await expect.poll(() => painted(page, 'link')).toContain('#be123c');
    const again = await openSettings(page);
    await expect(
      again.getByRole('group', { name: 'Colours' }).getByText('6 custom colours'),
    ).toBeVisible();
    if (SHOTS) await page.screenshot({ path: shot('5-undone') });

    // From the keyboard: Tab reaches the button inside the flyout, Enter snaps, and the focus
    // lands on the confirmation rather than being lost with the button.
    const snapButton = again.getByRole('button', { name: 'Snap to stock colours' });
    for (
      let i = 0;
      i < 20 && !(await snapButton.evaluate((b) => b === document.activeElement));
      i++
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(snapButton).toBeFocused();
    await page.keyboard.press('Enter');
    const status = again.getByRole('status');
    await expect(status).toHaveText('6 custom colours snapped to stock colours');
    await expect(status).toBeFocused();

    expectNoPageErrors(pageErrors);
  });
}
