import type { Page } from '@playwright/test';
import {
  chooseToolbarLayout,
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  test,
} from './fixtures';

// Editor modes end to end (docs/specs/007-editor/editor-modes.md), in dark mode: the chip in the
// Palette header switches a general tab between Diagram and Draw, a stroke drawn in Draw stays in
// Diagram, Shift+D toggles, the choice survives a reload, a new tab opens in Diagram,
// a Plan board survives every switch, and Opens in changes the tab's opening mode, switching only
// the chooser. Synthesised content only.

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
const boards = (page: Page) => page.locator('[data-plan-board]');
const sketches = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /^Sketch/ });

async function openBlank(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/new?blank=1');
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

async function chooseMode(page: Page, name: 'Diagram' | 'Draw' | 'Plan') {
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
  test('a general tab opens in Diagram, with the chip in the Palette header', async ({
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

  // Illustrate is on by default, so there are three modes: Shift+D moves to the next, and wraps
  // (docs/specs/007-editor/editor-modes.md "The mode switch").
  test('Shift+D moves to the next mode and wraps, and the choice survives a reload', async ({
    page,
    pageErrors,
  }) => {
    await openBlank(page);
    await page.locator(CANVAS).click({ position: { x: 40, y: 40 } });
    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
    await expect(dock(page)).toBeVisible();

    await page.reload();
    await page.locator(CANVAS).waitFor();
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');

    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Illustrate');
    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Plan');
    // Plan moves on like any mode (docs/specs/026-plan/plan-mode.md "Switching modes keeps the tab").
    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
    expectNoPageErrors(pageErrors);
  });

  // A board placed in Plan stays through Diagram and Draw, and works again back in Plan
  // (docs/specs/026-plan/plan-mode.md "Switching modes keeps the tab").
  test('a board placed in Plan stays on the tab in every mode', async ({ page, pageErrors }) => {
    await openBlank(page);
    await chooseMode(page, 'Plan');
    await page.getByRole('button', { name: /^Kanban/ }).click();
    await expect(boards(page)).toHaveCount(1);

    // The new board is selected, and a key on a selection types into it: a press on empty canvas,
    // right of the board, lets it go and gives the canvas the keys.
    await page.locator(CANVAS).click({ position: { x: 1500, y: 600 } });
    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(boards(page)).toHaveCount(1);

    await chooseMode(page, 'Draw');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
    await expect(boards(page)).toHaveCount(1);

    await chooseMode(page, 'Plan');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Plan');
    await expect(boards(page)).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Start with a Board' })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('a new tab opens in Diagram, even when made in Draw mode', async ({ page, pageErrors }) => {
    await openBlank(page);
    await chooseMode(page, 'Draw');
    await page.getByRole('button', { name: 'Add tab' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-editor-tabbar]').getByText('Tab 2')).toBeVisible();
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
    expectNoPageErrors(pageErrors);
  });

  test('Opens in sets the opening mode and switches the chooser', async ({ page, pageErrors }) => {
    await openBlank(page);
    await page.getByRole('button', { name: 'Tab menu' }).click();
    await page.getByRole('button', { name: /^Opens in/ }).click();
    const opensIn = page.getByRole('group', { name: 'Opens in' });
    // The Tab menu is a control menu, so each mode is a toggle button (docs/specs/004-interface-design/menus.md).
    await opensIn.getByRole('button', { name: /^Draw/ }).click();
    await page.keyboard.press('Escape');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
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

  // A Draw tool in hand never takes the press meant for the switch, in either layout.
  for (const layout of ['floating', 'toolbar'] as const) {
    test(`switches back to Diagram with a marker in hand (${layout} layout)`, async ({
      page,
      pageErrors,
    }) => {
      if (layout === 'toolbar') await chooseToolbarLayout(page);
      await openBlank(page);
      await chooseMode(page, 'Draw');
      await dock(page)
        .getByRole('button', { name: /^Marker 2/ })
        .click();
      await expect(dock(page).getByRole('button', { name: /^Marker 2/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await chooseMode(page, 'Diagram');
      await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
      await expect(sketches(page)).toHaveCount(0);
      expectNoPageErrors(pageErrors);
    });
  }
});
