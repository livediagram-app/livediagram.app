import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// Editor modes end to end (docs/specs/007-editor/editor-modes.md), in dark mode: the chip beside
// the tabs switches a general tab between Diagram and Draw, a stroke drawn in Draw stays in
// Diagram, Shift+D toggles, the choice survives a reload, a new tab inherits the creator's mode,
// and Opens in changes the tab's opening mode without switching anyone. Synthesised content only.

const CANVAS = '[data-canvas-a11y-root]';
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// The first tab's opening mode as the api stores it.
async function savedOpensIn(page: Page): Promise<unknown> {
  return page.evaluate(async (base) => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const sig = localStorage.getItem('livediagram:v2:self-sig');
    const headers: Record<string, string> = { 'X-Owner-Id': owner };
    if (sig) headers['X-Owner-Sig'] = sig;
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const doc = await (await fetch(`${base}/documents/${id}`, { headers })).json();
    const tabId = doc.document?.tabs?.[0]?.id;
    if (!tabId) return undefined;
    const got = await (await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })).json();
    return got.tab?.opensIn;
  }, apiBase);
}

const dock = (page: Page) => page.locator('[data-whiteboard-dock]');
const chip = (page: Page) => page.getByRole('button', { name: /^Editor mode: / });
const sketches = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /^Sketch/ });

async function openBlank(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/new?blank=1');
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

async function chooseMode(page: Page, name: 'Diagram' | 'Draw') {
  await chip(page).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }).click();
}

async function drawWave(page: Page, from: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(from.x + i * 10, from.y + Math.sin(i / 5) * 50);
  }
  await page.mouse.up();
}

test.describe('editor modes', () => {
  test('a general tab opens in Diagram, with the chip beside the tabs', async ({
    page,
    pageErrors,
  }) => {
    await openBlank(page);
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
    await expect(chip(page)).toHaveAttribute('aria-haspopup', 'menu');
    await expect(dock(page)).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('the chip switches to Draw, and a stroke drawn there stays in Diagram', async ({
    page,
    pageErrors,
  }) => {
    await openBlank(page);
    await chooseMode(page, 'Draw');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
    await expect(dock(page)).toBeVisible();

    await page.keyboard.press('1');
    await drawWave(page, { x: 500, y: 600 });
    await expect(sketches(page)).toHaveCount(1);

    await chooseMode(page, 'Diagram');
    await expect(dock(page)).toHaveCount(0);
    await expect(sketches(page)).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });

  test('Shift+D toggles, and the choice survives a reload', async ({ page, pageErrors }) => {
    await openBlank(page);
    await page.locator(CANVAS).click({ position: { x: 40, y: 40 } });
    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
    await expect(dock(page)).toBeVisible();

    await page.reload();
    await page.locator(CANVAS).waitFor();
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');

    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
    expectNoPageErrors(pageErrors);
  });

  test('a new tab inherits the mode its creator is in', async ({ page, pageErrors }) => {
    await openBlank(page);
    await chooseMode(page, 'Draw');
    await page.getByRole('button', { name: 'Add tab' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-editor-tabbar]').getByText('Tab 2')).toBeVisible();
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
    expectNoPageErrors(pageErrors);
  });

  test('Opens in sets the opening mode without switching the chooser', async ({
    page,
    pageErrors,
  }) => {
    await openBlank(page);
    await page.getByRole('button', { name: 'Tab menu' }).click();
    await page.getByRole('button', { name: /^Opens in/ }).click();
    const opensIn = page.getByRole('group', { name: 'Opens in' });
    await opensIn.getByRole('menuitemradio', { name: /^Draw/ }).click();
    await page.keyboard.press('Escape');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
    await expect.poll(() => savedOpensIn(page), { timeout: 15_000 }).toBe('draw');

    // A fresh page, with no choice remembered for this tab, opens it in its opening mode.
    const url = page.url();
    const other = await page.context().newPage();
    await other.emulateMedia({ colorScheme: 'dark' });
    await other.setViewportSize({ width: 1600, height: 900 });
    await other.goto(url);
    await other.locator(CANVAS).waitFor({ timeout: 30_000 });
    await dismissQuickTour(other);
    await expect(chip(other)).toHaveAccessibleName('Editor mode: Draw');
    await other.close();
    expectNoPageErrors(pageErrors);
  });
});
