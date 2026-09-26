import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, seedTab, startBlankDiagram, test } from './fixtures';

// Arrow labels on the line and bending by the line, end to end
// (docs/specs/008-canvas/arrow-labels.md, docs/specs/008-canvas/arrow-bending.md). Unit tests
// prove the layout and the bend maths; only the editor proves that a fast
// double-click edits instead of bending, and that a drag bends.

const square = (id: string, label: string, x: number, y: number) => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 100,
  height: 100,
  label,
});
const pinned = (elementId: string, anchor: string) => ({ kind: 'pinned', elementId, anchor });

// Two boxes 400px apart, joined by a labelled straight arrow at y = 250.
const linked = [
  square('a', 'Client', 100, 200),
  square('b', 'Server', 600, 200),
  { id: 'ar', type: 'arrow', from: pinned('a', 'e'), to: pinned('b', 'w'), label: 'calls' },
];

const pathD = (page: Page, id: string) =>
  page.locator(`path[data-element-id="${id}"]`).getAttribute('d');

// A screen point on the arrow's line, `f` of the way along its hit band
// (the band of a horizontal line is centred on it).
async function onLine(page: Page, id: string, f: number) {
  const box = (await page.locator(`path[data-element-id="${id}"]`).boundingBox())!;
  return { x: box.x + box.width * f, y: box.y + box.height / 2 };
}

// Double-click where the label is drawn. The text itself is pointer-inert;
// the catcher over it takes the press, as it does for a person.
async function dblclickLabel(page: Page, text: string) {
  const box = (await page.getByText(text, { exact: true }).boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2, { delay: 20 });
}

const editor = (page: Page) => page.getByRole('textbox', { name: 'Arrow label' });

test.describe('arrow labels and bending', () => {
  test('a label sits on its line, which is broken open behind it', async ({ page, pageErrors }) => {
    await startBlankDiagram(page);
    await seedTab(page, linked);
    const line = await onLine(page, 'ar', 0.5);
    const label = (await page.getByText('calls', { exact: true }).boundingBox())!;
    expect(Math.abs(label.y + label.height / 2 - line.y)).toBeLessThan(2);
    // The drawn line carries the knockout mask.
    await expect(page.locator('path[mask^="url(#lvd-behind-ar)"]').first()).toBeAttached();
    expectNoPageErrors(pageErrors);
  });

  test('a fast double-click on the line edits the label and never bends', async ({
    page,
    pageErrors,
  }) => {
    await startBlankDiagram(page);
    await seedTab(page, linked);
    const before = await pathD(page, 'ar');
    const p = await onLine(page, 'ar', 0.3);
    await page.mouse.dblclick(p.x, p.y, { delay: 20 });
    await expect(editor(page)).toBeFocused();
    expect(await pathD(page, 'ar')).toBe(before);
    expectNoPageErrors(pageErrors);
  });

  test('a fast double-click on the label edits it', async ({ page, pageErrors }) => {
    await startBlankDiagram(page);
    await seedTab(page, linked);
    const before = await pathD(page, 'ar');
    await dblclickLabel(page, 'calls');
    await expect(editor(page)).toBeFocused();
    expect(await pathD(page, 'ar')).toBe(before);
    expectNoPageErrors(pageErrors);
  });

  test('Shift+Enter breaks the label, Enter commits it', async ({ page, pageErrors }) => {
    await startBlankDiagram(page);
    await seedTab(page, linked);
    await dblclickLabel(page, 'calls');
    await editor(page).fill('calls');
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('over https');
    await page.keyboard.press('Enter');
    await expect(editor(page)).toHaveCount(0);
    await expect(page.getByText('over https', { exact: true })).toBeVisible();
    await expect(page.getByText('calls', { exact: true })).toBeVisible();
    expectNoPageErrors(pageErrors);
  });

  test('a blank line keeps its height', async ({ page, pageErrors }) => {
    await startBlankDiagram(page);
    await seedTab(page, linked);
    await dblclickLabel(page, 'calls');
    await editor(page).fill('');
    await page.keyboard.type('1');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('2');
    await page.keyboard.press('Enter');
    const one = (await page.getByText('1', { exact: true }).boundingBox())!;
    const two = (await page.getByText('2', { exact: true }).boundingBox())!;
    // Two line heights apart, not one: the blank line between them stays.
    expect(two.y - one.y).toBeGreaterThan(one.height * 1.8);
    expectNoPageErrors(pageErrors);
  });

  test('dragging the line bends it, and one undo straightens it', async ({ page, pageErrors }) => {
    await startBlankDiagram(page);
    await seedTab(page, linked);
    const before = await pathD(page, 'ar');
    const p = await onLine(page, 'ar', 0.3);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x, p.y - 30, { steps: 5 });
    await page.mouse.move(p.x, p.y - 80, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => pathD(page, 'ar')).toContain('Q');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => pathD(page, 'ar')).toBe(before);
    expectNoPageErrors(pageErrors);
  });

  test('a free arrow moves by its frame', async ({ page, pageErrors }) => {
    await startBlankDiagram(page);
    await seedTab(page, [
      {
        id: 'free',
        type: 'arrow',
        from: { kind: 'free', x: 200, y: 300 },
        to: { kind: 'free', x: 600, y: 300 },
      },
    ]);
    const p = await onLine(page, 'free', 0.3);
    await page.mouse.click(p.x, p.y);
    const frame = (await page.getByTestId('arrow-move-frame').boundingBox())!;
    const before = await pathD(page, 'free');
    const x = frame.x + frame.width / 3;
    await page.mouse.move(x, frame.y + 2);
    await page.mouse.down();
    await page.mouse.move(x + 20, frame.y + 30, { steps: 5 });
    await page.mouse.move(x + 40, frame.y + 62, { steps: 5 });
    await page.mouse.up();
    const after = (await pathD(page, 'free'))!;
    expect(after).not.toBe(before);
    // Moved, not bent.
    expect(after).not.toContain('Q');
    expectNoPageErrors(pageErrors);
  });
});
