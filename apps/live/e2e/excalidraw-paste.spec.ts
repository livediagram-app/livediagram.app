import type { Page } from '@playwright/test';
import { excalidrawBuilder, excalidrawText } from '../lib/excalidraw-fixtures';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// Paste from Excalidraw (docs/specs/020-import-export/excalidraw-import-export.md "Paste"): a copy
// made in Excalidraw, pasted with Ctrl+V, lands as native content, selected, in one undo step.
// The board is synthesised here: real boards are never fixtures.

// A small board shaped like a real copy: labelled boxes joined by bound arrows (one bent, one
// labelled), a stock-coloured diamond, a grey dashed box, a red pen stroke, a sticky note, a
// heading, a frame, and two items grouped.
function sampleCopy(): { text: string; items: number } {
  const b = excalidrawBuilder();
  const inbox = b.rectangle({ x: 0, y: 0, width: 160, height: 70 });
  const triage = b.diamond({ x: 260, y: -15, width: 120, height: 100, strokeColor: '#f08c00' });
  const done = b.rectangle({ x: 480, y: 0, width: 160, height: 70, strokeColor: '#2f9e44' });
  const toTriage = b.arrow(
    [
      [0, 0],
      [98, 0],
    ],
    { x: 161, y: 35 },
    { from: inbox, to: triage },
  );
  const toDone = b.arrow(
    [
      [0, 0],
      [50, -40],
      [99, 0],
    ],
    { x: 381, y: 35, strokeColor: '#1971c2' },
    { from: triage, to: done },
  );
  const notes = b.rectangle({
    x: 0,
    y: 160,
    width: 300,
    height: 120,
    strokeColor: '#868e96',
    strokeStyle: 'dashed',
    groupIds: ['g'],
  });
  const elements = [
    b.frame('Sketch', { x: -40, y: -140, width: 720, height: 460 }),
    b.text('Weekly flow', { x: 0, y: -110, width: 220, height: 50, fontSize: 40 }),
    inbox,
    b.label(inbox, 'Inbox'),
    triage,
    b.label(triage, 'Triage', { strokeColor: '#f08c00' }),
    done,
    b.label(done, 'Done', { strokeColor: '#2f9e44' }),
    toTriage,
    toDone,
    b.label(toDone, 'ship it', { fontSize: 16 }),
    notes,
    b.text('Ideas go here', { x: 20, y: 180, fontSize: 24, groupIds: ['g'] }),
    b.freedraw(
      [
        [0, 0],
        [20, 12],
        [45, 4],
        [70, 18],
        [95, 6],
        [120, 16],
      ],
      { x: 360, y: 200, strokeColor: '#e03131' },
    ),
    b.stickynote({ x: 480, y: 140, width: 160, height: 160 }),
  ];
  // Bound labels ride on their container: 15 elements, 11 items.
  return { text: excalidrawText(elements), items: 11 };
}

const countElements = (page: Page) =>
  page.evaluate(
    () =>
      new Set(
        [...document.querySelectorAll('[data-element-id]')].map((n) =>
          n.getAttribute('data-element-id'),
        ),
      ).size,
  );

async function pasteSample(page: Page, path: string) {
  await page.goto(path);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  const sample = sampleCopy();
  await page.evaluate((text) => navigator.clipboard.writeText(text), sample.text);
  await page.mouse.move(700, 450);
  await page.keyboard.press('Control+v');
  await expect.poll(() => countElements(page)).toBe(sample.items);
  return sample;
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`on a ${colorScheme} whiteboard`, () => {
    test.use({ colorScheme, viewport: { width: 1400, height: 900 } });

    test('an Excalidraw copy lands selected, says what changed, and undoes in one step', async ({
      page,
      pageErrors,
    }, testInfo) => {
      const sample = await pasteSample(page, '/new?template=whiteboard');
      // Selected: the quick style panel restyles the whole paste at once.
      await expect(page.getByRole('region', { name: 'Quick style' })).toBeVisible();
      // The group is the one change this copy carries.
      const notice = page.getByRole('status').filter({ hasText: 'Pasted from Excalidraw' });
      await expect(notice).toContainText('Groups were dropped');
      await page.screenshot({ path: testInfo.outputPath(`pasted-${colorScheme}.png`) });

      await page.keyboard.press('Escape');
      await page.keyboard.press('Shift+!');
      await page.screenshot({ path: testInfo.outputPath(`fit-${colorScheme}.png`) });

      await page.keyboard.press('Control+z');
      await expect.poll(() => countElements(page)).toBe(0);
      await page.keyboard.press('Control+Shift+z');
      await expect.poll(() => countElements(page)).toBe(sample.items);
      expectNoPageErrors(pageErrors);
    });
  });
}

test.describe('on a diagram tab', () => {
  test.use({ colorScheme: 'dark', viewport: { width: 1400, height: 900 } });

  test('an Excalidraw copy lands as diagram elements', async ({ page, pageErrors }, testInfo) => {
    await pasteSample(page, '/new?blank=1');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+!');
    await page.screenshot({ path: testInfo.outputPath('diagram-dark.png') });
    expectNoPageErrors(pageErrors);
  });
});

test.describe('ordinary text', () => {
  test.use({ colorScheme: 'dark' });

  test('is not mistaken for an Excalidraw copy', async ({ page, pageErrors }) => {
    await page.goto('/new?template=whiteboard');
    await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
    await dismissQuickTour(page);
    await page.evaluate(() => navigator.clipboard.writeText('{"type":"excalidrawish"}'));
    await page.mouse.move(700, 450);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(500);
    expect(await countElements(page)).toBe(0);
    expectNoPageErrors(pageErrors);
  });
});
