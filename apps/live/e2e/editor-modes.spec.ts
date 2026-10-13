import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  test,
  pageOwnerHeaders,
  seedTab,
} from './fixtures';

// Editor modes end to end (docs/specs/007-editor/editor-modes.md), in dark mode: the chip beside the
// menu button switches a general tab between Diagram and Draw, a stroke drawn in Draw stays in
// Diagram, Shift+D toggles, the choice survives a reload, a new tab opens in its maker's mode,
// a Plan board survives every switch, and the tab menu's Mode switches the tab for everyone at
// once, with Undo switching it back. Synthesised content only.

const CANVAS = '[data-canvas-a11y-root]';
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// The first tab's opening mode as the api stores it.
async function savedOpensIn(page: Page): Promise<unknown> {
  const headers = await pageOwnerHeaders(page);
  return page.evaluate(
    async ({ base, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      const doc = await (await fetch(`${base}/documents/${id}`, { headers })).json();
      const tabId = doc.document?.tabs?.[0]?.id;
      if (!tabId) return undefined;
      const got = await (await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })).json();
      return got.tab?.opensIn;
    },
    { base: apiBase, headers },
  );
}

const dock = (page: Page) => page.locator('[data-whiteboard-dock]');
const chip = (page: Page) => page.getByRole('button', { name: /^Editor mode: / });
const boards = (page: Page) => page.locator('[data-plan-board]');
const sketches = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /^Sketch/ });

async function openBlank(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  // The Plan and Facilitate tours offer themselves 800 ms into their modes (OFFER_DELAY_MS), and their overlay
  // takes the presses these specs make there on a slow runner; it has its own unit tests.
  await page.addInitScript(() => {
    const key = 'livediagram:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      if (prefs.planTourSeen !== true || prefs.facilitateTourSeen !== true)
        localStorage.setItem(
          key,
          JSON.stringify({ ...prefs, planTourSeen: true, facilitateTourSeen: true }),
        );
    } catch {
      // No storage: nothing to mark.
    }
  });
  await page.goto('/new?blank=1');
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

async function chooseMode(page: Page, name: 'Diagram' | 'Draw' | 'Plan') {
  await chip(page).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }).click();
}

// An empty tab offers each mode's start screen as it enters it (docs/specs/007-editor/start-diagramming.md); its ×
// starts from a blank canvas, as a person drawing straight away would close it.
async function closeStart(page: Page) {
  const start = page.getByRole('region', {
    name: /^Start (Diagramming|Drawing|Facilitating|Illustrating)$/,
  });
  await start.waitFor();
  await start.getByRole('button', { name: 'Close' }).click();
  await start.waitFor({ state: 'detached' });
}

// A tab with something on it keeps Plan's line (docs/specs/007-editor/editor-modes.md "Plan stands apart"; an empty
// tab crosses it freely, start-diagramming.md "Changing mode").
async function openWithContent(page: Page) {
  await openBlank(page);
  await seedTab(page, [
    {
      id: 'kept',
      type: 'shape',
      shape: 'square',
      x: 900,
      y: 500,
      width: 100,
      height: 100,
      label: 'Kept',
    },
  ]);
  await page.locator(CANVAS).waitFor();
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
  test('a general tab opens in Diagram, with the chip beside the menu button', async ({
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
    await closeStart(page);

    await page.keyboard.press('1');
    await drawWave(page, { x: 500, y: 600 });
    await expect(sketches(page)).toHaveCount(1);

    await chooseMode(page, 'Diagram');
    await expect(dock(page)).toHaveCount(0);
    await expect(sketches(page)).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });

  // Shift+D steps through the modes beside the tab's own and wraps: Plan stands apart, so a canvas tab with content
  // cycles Diagram, Draw, Facilitate and Illustrate (docs/specs/007-editor/editor-modes.md "Plan stands apart").
  test('Shift+D moves to the next mode and wraps, and the choice survives a reload', async ({
    page,
    pageErrors,
  }) => {
    await openWithContent(page);
    await page.locator(CANVAS).click({ position: { x: 40, y: 40 } });
    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
    await expect(dock(page)).toBeVisible();

    await page.reload();
    await page.locator(CANVAS).waitFor();
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');

    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Facilitate');
    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Illustrate');
    await page.keyboard.press('Shift+D');
    // Leaving Illustrate with content on the tab asks first (docs/specs/007-editor/illustrate-pages.md).
    await page.getByRole('button', { name: 'Switch', exact: true }).click();
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
    expectNoPageErrors(pageErrors);
  });

  // Plan stands apart (docs/specs/007-editor/editor-modes.md "Plan stands apart"): picking Plan on a canvas tab
  // offers a new Plan tab instead of switching this one, and on the Plan tab Shift+D does nothing.
  test('Plan opens in a tab of its own, and a Plan tab keeps its mode', async ({
    page,
    pageErrors,
  }) => {
    await openWithContent(page);
    await chooseMode(page, 'Plan');
    await expect(page.getByRole('dialog', { name: 'Open a New Plan Tab?' })).toBeVisible();
    await page.getByRole('button', { name: 'New Plan Tab' }).click();
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Plan');
    await expect(page.getByRole('heading', { name: 'Start Planning' })).toBeVisible();

    // A board from Start Planning fills the tab; Shift+D then leaves the Plan tab in Plan.
    await page.getByRole('button', { name: /^Kanban Board/ }).click();
    await expect(boards(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+D');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Plan');
    await expect(boards(page)).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });

  // docs/specs/007-editor/editor-modes.md "A new tab opens in the mode it was made from".
  test('a new tab opens in the mode it was made from', async ({ page, pageErrors }) => {
    await openBlank(page);
    await chooseMode(page, 'Draw');
    await page.getByRole('button', { name: 'Add tab' }).click();
    await expect(page.locator('[data-editor-tabbar]').getByText('Tab 2')).toBeVisible();
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
    // On its mode's own start, with no Quick Start over it.
    await expect(page.getByRole('region', { name: 'Start Drawing' })).toBeVisible();
    expectNoPageErrors(pageErrors);
  });

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": the mode is the tab's, the same
  // for everyone on it, and a switch is one undo step.
  test("the tab menu's Mode switches the tab for everyone, and Undo switches it back", async ({
    page,
    pageErrors,
  }) => {
    await openBlank(page);
    // A second window on the same tab, open before the switch.
    const other = await page.context().newPage();
    await other.emulateMedia({ colorScheme: 'dark' });
    await other.setViewportSize({ width: 1600, height: 900 });
    await other.goto(page.url());
    await other.locator(CANVAS).waitFor({ timeout: 30_000 });
    await dismissQuickTour(other);
    await expect(chip(other)).toHaveAccessibleName('Editor mode: Diagram');

    await page.getByRole('button', { name: 'Tab menu' }).click();
    // The Tab menu is a control menu, so each mode is a toggle button (docs/specs/004-interface-design/menus.md).
    await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: /^Draw/ }).click();
    await page.keyboard.press('Escape');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Draw');
    await expect.poll(() => savedOpensIn(page), { timeout: 15_000 }).toBe('draw');
    // The other window follows the tab, live.
    await expect(chip(other)).toHaveAccessibleName('Editor mode: Draw', { timeout: 15_000 });

    await page.locator(CANVAS).click({ position: { x: 40, y: 40 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
    await expect(chip(other)).toHaveAccessibleName('Editor mode: Diagram', { timeout: 15_000 });
    await other.close();
    expectNoPageErrors(pageErrors);
  });

  // A Draw tool in hand never takes the press meant for the switch.
  test('switches back to Diagram with a marker in hand', async ({ page, pageErrors }) => {
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
});
