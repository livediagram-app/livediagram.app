import type { Page } from '@playwright/test';
import { penColourHex } from '@livehuddle/document';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  test,
  serverNewUrl,
} from './fixtures';

// A pasted or imported board's named stock colours draw in the board's version (docs/specs/023-draw-mode/draw-mode.md
// "Imported and pasted content"). The quick style panel's rows on such a selection (Marker colour and width, "6
// elements") were a whiteboard's, and no board is a whiteboard since Draw mode went; the colours stay. Dark mode.

// A synthesised board: a blue rectangle and a green label (both by name), a text box, a sticky and an image
// placeholder. Only kinds livehuddle makes (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
const BOARD = [
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
  await page.goto(await serverNewUrl(page, '/new?template=blank-session'));
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await seedTab(page, BOARD);
}

test.describe('a pasted board’s named colours', () => {
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
