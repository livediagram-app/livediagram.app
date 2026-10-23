import type { Page } from '@playwright/test';
import { penColourHex } from '@livedocuments/document';
import { dismissQuickTour, expect, expectNoPageErrors, seedTab, test } from './fixtures';

// The quick style panel on a mixed selection (docs/specs/008-canvas/quick-style-panel.md
// "Multi-selection"), as a pasted or imported board selects: named stock colours draw in the canvas's version
// (docs/specs/008-canvas/canvas-and-palette.md). Dark mode throughout.

const points = (n: number, y: number) =>
  Array.from({ length: n }, (_, i) => ({ nx: i / (n - 1), ny: (Math.sin(i / 2) + 1) / 2 + y * 0 }));

// A synthesised board: two marker strokes, a blue rectangle and a green label (both by name), a
// custom-grey arrow, a text box, a sticky and an image placeholder.
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
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await seedTab(page, BOARD);
}

test.describe('the quick style panel on a mixed selection', () => {
  test('draws named colours in the dark board’s versions', async ({ page, pageErrors }) => {
    await openBoard(page);
    await expect(page.locator('[data-element-id="text"]')).toBeVisible();
    expect(await coloursIn(page, 'text')).toContain(hexToRgb(penColourHex('violet', 'dark')));
    expect(await coloursIn(page, 'rect')).toContain(hexToRgb(penColourHex('blue', 'dark')));
    expect(await coloursIn(page, 'rect')).toContain(hexToRgb(penColourHex('green', 'dark')));
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
