import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// The quick style panel and style memory, end to end (docs/specs/008-canvas/quick-style-panel.md). Unit
// tests prove the rules; only the editor proves a choice lands, is remembered
// for the next element the user draws, and is forgotten by Clear styles.

const CANVAS = '[data-canvas-a11y-root]';
type El = Record<string, unknown> & { id: string; type: string; shape?: string };

async function openBoard(page: Page, layout?: 'floating' | 'toolbar'): Promise<void> {
  await page.emulateMedia({ colorScheme: 'dark' });
  if (layout) {
    await page.addInitScript((panelLayout) => {
      const key = 'livediagram:user-preferences:v1';
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}');
      localStorage.setItem(key, JSON.stringify({ ...prefs, panelLayout }));
    }, layout);
  }
  await page.goto('/new');
  const canvas = page.locator(CANVAS);
  await expect(async () => {
    if (!(await canvas.isVisible())) {
      await page.getByRole('button', { name: /^just draw$/i }).click({ timeout: 2_000 });
    }
    await canvas.waitFor({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await dismissQuickTour(page);
}

// The saved elements of the diagram's first tab, read through the api.
async function savedElements(page: Page): Promise<El[]> {
  return page.evaluate(async () => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const headers = { 'X-Owner-Id': owner };
    const diagram = await (await fetch(`/api/diagrams/${id}`, { headers })).json();
    const tabId = diagram.diagram?.tabs?.[0]?.id;
    if (!tabId) return [];
    const got = await (await fetch(`/api/diagrams/${id}/tabs/${tabId}`, { headers })).json();
    return (got.tab?.elements ?? []) as El[];
  });
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

async function drawShape(page: Page, key: 'o' | 'r', at: { x: number; y: number }) {
  await page.keyboard.press('Escape');
  await page.keyboard.press(key);
  await page.mouse.click(at.x, at.y);
}

async function drawArrow(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('a');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

const panel = (page: Page) => page.getByRole('region', { name: 'Quick style' });
const choose = (page: Page, row: string, option: string) =>
  panel(page).getByRole('radiogroup', { name: row }).getByRole('radio', { name: option }).click();

const shapesOf = (els: El[], kind: string) => els.filter((e) => e.shape === kind);

const PALETTE = '[data-tour-id="palette"][data-floating-panel]';

test.describe('quick style panel', () => {
  test('one click on Flowing makes the selected arrow dashed and animated', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await drawArrow(page, { x: 300, y: 300 }, { x: 600, y: 300 });
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

  test('Floating: docks right beneath the Palette, the Palette’s width, and follows it', async ({
    page,
    pageErrors,
  }) => {
    // Tall enough that the whole panel fits beneath the Favourites Palette.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openBoard(page, 'floating');
    await drawShape(page, 'o', { x: 500, y: 300 });
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByText('Quick style', { exact: true })).toBeVisible();
    const docked = async () => {
      const p = (await page.locator(PALETTE).boundingBox())!;
      const q = (await panel(page).boundingBox())!;
      expect(Math.abs(q.x - p.x)).toBeLessThan(1);
      expect(Math.abs(q.width - p.width)).toBeLessThan(1);
      expect(Math.abs(q.y - (p.y + p.height + 16))).toBeLessThan(1);
    };
    await expect(docked).toPass();
    // Collapse the Palette to its banner: the panel rises with it.
    await page.locator(PALETTE).getByRole('button', { name: 'Collapse palette' }).click();
    await expect(docked).toPass();
    expectNoPageErrors(pageErrors);
  });

  test('Toolbar: sits on the right edge, vertically centred', async ({ page, pageErrors }) => {
    await openBoard(page, 'toolbar');
    await drawShape(page, 'o', { x: 500, y: 400 });
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByText('Quick style', { exact: true })).toHaveCount(0);
    await expect(async () => {
      const canvas = (await page.locator(CANVAS).boundingBox())!;
      const q = (await panel(page).boundingBox())!;
      expect(Math.abs(q.x + q.width - (canvas.x + canvas.width - 12))).toBeLessThan(1);
      expect(Math.abs(q.y + q.height / 2 - (canvas.y + canvas.height / 2))).toBeLessThan(1);
    }).toPass();
    expectNoPageErrors(pageErrors);
  });

  test('a stroke picked for a circle carries to the next circle, not to a square', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await drawShape(page, 'o', { x: 500, y: 300 });
    await expect(panel(page)).toBeVisible();
    await choose(page, 'Stroke', 'Green');
    await expect(
      panel(page).getByRole('radiogroup', { name: 'Stroke' }).getByRole('radio', { name: 'Green' }),
    ).toHaveAttribute('aria-checked', 'true');

    await drawShape(page, 'o', { x: 500, y: 600 });
    await drawShape(page, 'r', { x: 300, y: 600 });
    const els = await saved(
      page,
      (e) => shapesOf(e, 'circle').length === 2 && shapesOf(e, 'square').length === 1,
    );
    const [first, second] = shapesOf(els, 'circle');
    expect(first!.strokeSwatch).toBe(4);
    expect(second!.strokeSwatch).toBe(4);
    expect(second!.strokeColor).toBe(first!.strokeColor);
    expect(shapesOf(els, 'square')[0]!.strokeSwatch).toBeUndefined();
    expectNoPageErrors(pageErrors);
  });

  test('an arrow flows in one click, and the next arrow flows too', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await drawArrow(page, { x: 300, y: 300 }, { x: 600, y: 300 });
    await expect(panel(page)).toBeVisible();
    await choose(page, 'Stroke style', 'Flowing');
    await drawArrow(page, { x: 300, y: 500 }, { x: 600, y: 500 });
    await drawShape(page, 'o', { x: 800, y: 400 });
    const els = await saved(
      page,
      (e) => e.filter((x) => x.type === 'arrow').length === 2 && shapesOf(e, 'circle').length === 1,
    );
    for (const arrow of els.filter((x) => x.type === 'arrow')) {
      expect(arrow).toMatchObject({ strokeStyle: 'dashed', flow: 'dashes' });
    }
    expect(shapesOf(els, 'circle')[0]!.strokeStyle).toBeUndefined();
    expectNoPageErrors(pageErrors);
  });

  test('Clear styles resets the selection and forgets its kind', async ({ page, pageErrors }) => {
    await openBoard(page);
    await drawShape(page, 'o', { x: 500, y: 300 });
    await choose(page, 'Background', 'Violet');
    await choose(page, 'Stroke width', 'Thick');
    await panel(page).getByRole('button', { name: 'Clear styles' }).click();
    await drawShape(page, 'o', { x: 500, y: 600 });
    const els = await saved(page, (e) => shapesOf(e, 'circle').length === 2);
    for (const circle of shapesOf(els, 'circle')) {
      expect(circle.fillSwatch).toBeUndefined();
      expect(circle.strokeWidth).toBeUndefined();
    }
    expectNoPageErrors(pageErrors);
  });

  test('the panel keys like a radio group and stands down for the context menu', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await drawShape(page, 'o', { x: 500, y: 300 });
    const widths = panel(page).getByRole('radiogroup', { name: 'Stroke width' });
    await widths.getByRole('radio', { name: 'Medium' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(widths.getByRole('radio', { name: 'Thick' })).toBeFocused();
    await expect(widths.getByRole('radio', { name: 'Thick' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.mouse.click(500, 300, { button: 'right' });
    await expect(panel(page)).toBeHidden();
    expectNoPageErrors(pageErrors);
  });
});
