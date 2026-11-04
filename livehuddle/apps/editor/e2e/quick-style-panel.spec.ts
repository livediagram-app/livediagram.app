import type { Page } from '@playwright/test';
import type { StoredDocument, StoredTab } from './stored';
import {
  expect,
  expectNoPageErrors,
  test,
  openStartBlank,
  pageOwnerHeaders,
  seedTab,
} from './fixtures';

// The quick style panel, end to end (docs/specs/008-canvas/quick-style-panel.md). Unit tests prove the rules; only
// the editor proves a choice lands and is saved. livehuddle's palette draws no shapes or arrows (Work Tracker #423),
// so the panel is driven on stored ones, which still load, select and save; style memory for the next one drawn
// has nothing to draw and is left to the unit tests.

const CANVAS = '[data-canvas-a11y-root]';
type El = Record<string, unknown> & { id: string; type: string; shape?: string };

const pinned = (elementId: string, anchor: string) => ({ kind: 'pinned', elementId, anchor });
const shape = (id: string, kind: string, x: number, y: number) => ({
  id,
  type: 'shape',
  shape: kind,
  x,
  y,
  width: 120,
  height: 120,
});
// A circle on the right, clear of the panel on the canvas's left, and two squares joined by an arrow.
const STORED = [
  shape('c', 'circle', 900, 100),
  shape('a', 'square', 100, 400),
  shape('b', 'square', 600, 400),
  { id: 'ar', type: 'arrow', from: pinned('a', 'e'), to: pinned('b', 'w') },
];

async function openBoard(page: Page, stored: Record<string, unknown>[] = STORED): Promise<void> {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openStartBlank(page);
  await seedTab(page, stored);
}

const circle = (page: Page) =>
  page.locator(CANVAS).getByRole('img', { name: 'Circle', exact: true });

async function selectCircle(page: Page) {
  await circle(page).click();
  await expect(panel(page)).toBeVisible();
}

// The arrow, by a click halfway along its drawn line.
async function selectArrow(page: Page) {
  const at = await page.locator('path[data-element-id="ar"]').evaluate((path: SVGPathElement) => {
    const p = path.getPointAtLength(path.getTotalLength() / 2);
    const m = path.getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(at.x, at.y);
  await expect(panel(page)).toBeVisible();
}

// The saved elements of the document's first tab, read through the api.
async function savedElements(page: Page): Promise<El[]> {
  const headers = await pageOwnerHeaders(page);
  return page.evaluate(async (headers) => {
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const liveDoc = (await (
      await fetch(`/api/documents/${id}`, { headers })
    ).json()) as StoredDocument;
    const tabId = liveDoc.document?.tabs?.[0]?.id;
    if (!tabId) return [];
    const got = (await (
      await fetch(`/api/documents/${id}/tabs/${tabId}`, { headers })
    ).json()) as StoredTab<El>;
    return got.tab?.elements ?? [];
  }, headers);
}

// Autosave is debounced: wait until the saved tab satisfies `ok`.
async function saved(page: Page, ok: (els: El[]) => boolean): Promise<El[]> {
  let last: El[] = [];
  await expect(async () => {
    last = await savedElements(page);
    expect(ok(last)).toBe(true);
  }).toPass({ timeout: 15_000 });
  return last;
}

const panel = (page: Page) => page.getByRole('region', { name: 'Quick style' });
// A row of glyph buttons is a radio group; a colour row is a group of toggle buttons
// (docs/specs/004-interface-design/colour-picker.md).
const row = (page: Page, name: string) =>
  panel(page).locator(
    `[role="radiogroup"][aria-label="${name}"], [role="group"][aria-label="${name}"]`,
  );
const choose = (page: Page, name: string, option: string) =>
  row(page, name).getByLabel(option, { exact: true }).click();

const shapesOf = (els: El[], kind: string) => els.filter((e) => e.shape === kind);

test.describe('quick style panel', () => {
  test('one click on Flowing makes the selected arrow dashed and animated', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await selectArrow(page);
    await expect(page.locator('path.lvd-arrow-flow')).toHaveCount(0);
    await choose(page, 'Stroke style', 'Flowing');
    // The line marches on the canvas at once, and one click saved both halves.
    await expect(page.locator('path.lvd-arrow-flow')).toHaveCount(1);
    const [arrow] = (await saved(page, (e) => e.some((x) => x.flow === 'dashes'))).filter(
      (x) => x.type === 'arrow',
    );
    expect(arrow).toMatchObject({ strokeStyle: 'dashed', flow: 'dashes' });
    await expect(
      panel(page)
        .getByRole('radiogroup', { name: 'Stroke style' })
        .getByRole('radio', { name: 'Flowing' }),
    ).toHaveAttribute('aria-checked', 'true');
    expectNoPageErrors(pageErrors);
  });

  test('narrow, ten 24 px swatch targets wide, a theme row nine (its seven, Ink and More colours)', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await selectCircle(page);
    await expect(panel(page)).toBeVisible();
    expect((await panel(page).boundingBox())!.width).toBeCloseTo(258, 0);
    const swatches = panel(page)
      .getByRole('group', { name: 'Stroke', exact: true })
      .getByRole('button');
    await expect(swatches).toHaveCount(9);
    await expect(swatches.nth(7)).toHaveAccessibleName('Ink');
    await expect(swatches.last()).toHaveAccessibleName('More colours, stroke');
    for (const box of await Promise.all((await swatches.all()).map((s) => s.boundingBox()))) {
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
    expectNoPageErrors(pageErrors);
  });

  test('a right-clicked swatch takes a custom colour, used on click, and Clear override restores it', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await selectCircle(page);
    const stroke = panel(page).getByRole('group', { name: 'Stroke', exact: true });
    await stroke.getByRole('button', { name: 'Green' }).click({ button: 'right' });
    const dialog = page.getByRole('dialog', { name: 'Custom colour for Green, Stroke' });
    await expect(dialog).toBeVisible();
    // The one custom colour editor: Enter in its hex field uses the colour and closes.
    await dialog.getByLabel('Hex').fill('#ff5500');
    await dialog.getByLabel('Hex').press('Enter');
    const custom = stroke.getByRole('button', { name: 'Custom orange, in place of Green' });
    await expect(custom).toBeFocused();
    await expect(custom.locator('[data-swatch-marker]')).toHaveCount(1);
    // Kept per user and per theme, in the synced preferences.
    const stored = await page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem('livehuddle:user-preferences:v1') ?? '{}') as {
            quickSwatchOverrides?: unknown;
          }
        ).quickSwatchOverrides,
    );
    expect(stored).toEqual([{ t: expect.any(String), s: { 4: '#ff5500' } }]);
    // Editing the palette styled nothing; choosing the swatch does.
    await custom.click();
    const els = await saved(page, (e) => shapesOf(e, 'circle')[0]?.strokeColor === '#ff5500');
    expect(shapesOf(els, 'circle')[0]!.strokeSwatch).toBeUndefined();
    // Keyboard: Shift+F10 on the focused swatch opens the same popover.
    await custom.focus();
    await page.keyboard.press('Shift+F10');
    await page.getByRole('dialog').getByRole('button', { name: 'Clear override' }).click();
    await expect(stroke.getByRole('button', { name: 'Green' })).toBeVisible();
    await expect(stroke.locator('[data-swatch-marker]')).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('sits on the left edge, vertically centred', async ({ page, pageErrors }) => {
    // The circle alone, so the panel has nothing to step aside for.
    await openBoard(page, STORED.slice(0, 1));
    await selectCircle(page);
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByText('Quick style', { exact: true })).toHaveCount(0);
    await expect(async () => {
      const canvas = (await page.locator(CANVAS).boundingBox())!;
      const q = (await panel(page).boundingBox())!;
      expect(Math.abs(q.x - (canvas.x + 12))).toBeLessThan(1);
      expect(Math.abs(q.y + q.height / 2 - (canvas.y + canvas.height / 2))).toBeLessThan(1);
    }).toPass();
    expectNoPageErrors(pageErrors);
  });

  test('Clear Styles resets the selection', async ({ page, pageErrors }) => {
    await openBoard(page);
    await selectCircle(page);
    await choose(page, 'Background', 'Violet');
    await choose(page, 'Stroke width', 'Thick');
    await saved(page, (e) => shapesOf(e, 'circle')[0]?.fillSwatch !== undefined);
    await panel(page).getByRole('button', { name: 'Clear Styles' }).click();
    const els = await saved(
      page,
      (e) =>
        shapesOf(e, 'circle')[0]?.fillSwatch === undefined &&
        shapesOf(e, 'circle')[0]?.strokeWidth === undefined,
    );
    expect(shapesOf(els, 'circle')).toHaveLength(1);
    expectNoPageErrors(pageErrors);
  });

  test('the panel keys like a radio group and stands down for the context menu', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    // The circle sits clear of the panel, which is on the canvas's left (docs/specs/008-canvas/quick-style-panel.md
    // "Where it sits"), so the right-click below lands on the circle.
    await selectCircle(page);
    const widths = panel(page).getByRole('radiogroup', { name: 'Stroke width' });
    await widths.getByRole('radio', { name: 'Medium' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(widths.getByRole('radio', { name: 'Thick' })).toBeFocused();
    await expect(widths.getByRole('radio', { name: 'Thick' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // On the circle itself: a click the panel or any other chrome would take opens no element menu.
    await circle(page).click({ button: 'right' });
    await expect(page.getByRole('dialog', { name: 'Element menu' })).toBeVisible();
    await expect(panel(page)).toBeHidden();
    expectNoPageErrors(pageErrors);
  });
});
