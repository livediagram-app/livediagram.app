import type { Page } from '@playwright/test';
import { penColourHex, WHITEBOARD_INK } from '@livediagram/document';
import { dismissQuickTour, expect, expectNoPageErrors, seedTab, test } from './fixtures';

// The quick style panel on a mixed whiteboard selection (docs/specs/008-canvas/quick-style-panel.md
// "Multi-selection"), as a pasted or imported board selects: every row styles what it fits,
// stickies and images are passed over, named stock colours draw in the board's version
// (docs/specs/023-draw-mode/draw-mode.md "Imported and pasted content"). Dark mode throughout.

const SHOTS = process.env.E2E_SHOTS_DIR;
const panel = (page: Page) => page.getByRole('region', { name: 'Quick style' });

const points = (n: number, y: number) =>
  Array.from({ length: n }, (_, i) => ({ nx: i / (n - 1), ny: (Math.sin(i / 2) + 1) / 2 + y * 0 }));

// A synthesised board: two marker strokes, a blue rectangle and a green label (both by name), a
// custom-grey arrow, a text box, a path, a sticky and an image placeholder.
const BOARD = [
  {
    id: 'stroke-1',
    type: 'freehand',
    x: 120,
    y: 120,
    width: 220,
    height: 40,
    points: points(12, 0),
    closed: false,
    penWidth: 1.5,
    streamline: 0.2,
  },
  {
    id: 'stroke-2',
    type: 'freehand',
    x: 120,
    y: 190,
    width: 220,
    height: 40,
    points: points(12, 1),
    closed: false,
    penWidth: 2.5,
    penColour: 'red',
  },
  {
    id: 'rect',
    type: 'shape',
    shape: 'square',
    x: 400,
    y: 120,
    width: 180,
    height: 100,
    penColour: 'blue',
    penTextColour: 'green',
    label: 'Plan',
  },
  {
    id: 'arrow',
    type: 'arrow',
    from: { kind: 'free', x: 600, y: 170 },
    to: { kind: 'free', x: 760, y: 170 },
    strokeColor: '#868e96',
    arrowheadShape: 'line',
  },
  {
    id: 'text',
    type: 'text',
    x: 120,
    y: 280,
    width: 200,
    height: 30,
    sizing: 'fit',
    label: 'Retro notes',
    font: 'caveat',
    textSize: 'md',
    penTextColour: 'violet',
  },
  {
    id: 'path',
    type: 'path',
    x: 400,
    y: 260,
    width: 160,
    height: 80,
    closed: false,
    nodes: [
      { nx: 0, ny: 1, mode: 'corner' },
      { nx: 0.5, ny: 0, mode: 'corner' },
      { nx: 1, ny: 1, mode: 'corner' },
    ],
    penColour: 'orange',
  },
  {
    id: 'sticky',
    type: 'sticky',
    x: 620,
    y: 240,
    width: 140,
    height: 140,
    fillColor: '#bae6fd',
    textColor: '#082f49',
    label: 'Idea',
  },
  { id: 'image', type: 'image', x: 800, y: 240, width: 120, height: 90, imageId: null },
];

async function openBoard(page: Page) {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/new?template=whiteboard');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await seedTab(page, BOARD);
}

test.describe('the quick style panel on a mixed whiteboard selection', () => {
  test('draws named colours in the dark board’s versions', async ({ page, pageErrors }) => {
    await openBoard(page);
    await expect(page.locator('[data-element-id="text"]')).toBeVisible();
    expect(await coloursIn(page, 'text')).toContain(hexToRgb(penColourHex('violet', 'dark')));
    expect(await coloursIn(page, 'rect')).toContain(hexToRgb(penColourHex('blue', 'dark')));
    expect(await coloursIn(page, 'rect')).toContain(hexToRgb(penColourHex('green', 'dark')));
    expectNoPageErrors(pageErrors);
  });

  test('styles what each row fits, and says how many', async ({ page, pageErrors }) => {
    await openBoard(page);
    await page.keyboard.press('v');
    await page.mouse.click(1100, 600);
    await page.keyboard.press('ControlOrMeta+a');
    const p = panel(page);
    await expect(p).toBeVisible();
    // Two strokes, rectangle, arrow, text, path: the sticky and the image are passed over.
    await expect(p.getByText('6 elements', { exact: true })).toBeVisible();
    // Colour rows are groups of toggle buttons (docs/specs/004-interface-design/colour-picker.md);
    // the rest are radio groups.
    for (const row of ['Marker colour', 'Stroke', 'Text colour']) {
      await expect(p.getByRole('group', { name: row, exact: true })).toBeVisible();
    }
    for (const row of ['Marker width', 'Stroke width']) {
      await expect(p.getByRole('radiogroup', { name: row, exact: true })).toBeVisible();
    }
    // The shapes' named colours mark no theme swatch.
    const stroke = p.getByRole('group', { name: 'Stroke', exact: true });
    await expect(stroke.getByRole('button', { pressed: true })).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/mixed-before.png` });

    // Keyboard: a colour row is one Tab stop; the arrows move, Enter picks.
    await stroke.getByRole('button').first().focus();
    await page.keyboard.press('Enter');
    await expect(stroke.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');

    const width = p.getByRole('radiogroup', { name: 'Stroke width', exact: true });
    await width.getByRole('radio', { name: 'Thick' }).click();
    await expect(width.getByRole('radio', { name: 'Thick' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const marker = p.getByRole('group', { name: 'Marker colour', exact: true });
    await marker.getByRole('button', { name: 'Green' }).click();
    await expect(marker.getByRole('button', { name: 'Green' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    if (SHOTS) {
      // Past the swatch ring's transition.
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/mixed-after.png` });
    }

    // The rectangle took the ink (its named blue gone), the sticky kept its paper.
    const rect = await coloursIn(page, 'rect');
    expect(rect).toContain(hexToRgb(WHITEBOARD_INK.dark));
    expect(rect).not.toContain(hexToRgb(penColourHex('blue', 'dark')));
    expectNoPageErrors(pageErrors);
  });
});

// Every colour drawn inside an element: SVG strokes and fills, text and border colours, as rgb().
function coloursIn(page: Page, id: string): Promise<string[]> {
  return page
    .locator(`[data-element-id="${id}"]`)
    .first()
    .evaluate((root) => {
      const out = new Set<string>();
      const probe = document.createElement('span');
      document.body.appendChild(probe);
      const norm = (c: string | null) => {
        if (!c || c === 'none') return;
        probe.style.color = '';
        probe.style.color = c;
        out.add(getComputedStyle(probe).color);
      };
      for (const node of [root, ...root.querySelectorAll('*')]) {
        const cs = getComputedStyle(node);
        norm(node.getAttribute('stroke'));
        norm(node.getAttribute('fill'));
        norm(cs.color);
        norm(cs.borderTopColor);
        norm(cs.stroke);
      }
      probe.remove();
      return [...out];
    });
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
