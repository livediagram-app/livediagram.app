import type { Page } from '@playwright/test';
import {
  createInMode,
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  test,
  pageOwnerHeaders,
} from './fixtures';

// Editor modes end to end (docs/specs/007-editor/editor-modes.md), in dark mode: a tab's mode is chosen on its
// start while it is empty, never beside the menu button or in the tab menu; a tab with content keeps its mode (Shift+D
// included) across a reload; a new tab opens in its maker's mode; and a switch reaches everyone at once, with Undo
// switching it back. Synthesised content only.

const CANVAS = '[data-canvas-a11y-root]';
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// The first tab's opening mode as the api stores it.
async function savedOpensIn(page: Page): Promise<unknown> {
  const headers = await pageOwnerHeaders(page);
  return page.evaluate(
    async ({ base, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      const doc = (await (await fetch(`${base}/documents/${id}`, { headers })).json()) as {
        document?: { tabs?: { id: string }[] };
      };
      const tabId = doc.document?.tabs?.[0]?.id;
      if (!tabId) return undefined;
      const got = (await (
        await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })
      ).json()) as { tab?: { opensIn?: unknown } };
      return got.tab?.opensIn;
    },
    { base: apiBase, headers },
  );
}

const dock = (page: Page) => page.locator('[data-whiteboard-dock]');
// The open tab's editor mode, as the editor marks it.
const mode = (page: Page) => page.locator('[data-editor-mode]');
// The start's own switch, the one place a tab's mode is chosen.
const startSwitch = (page: Page) => page.getByRole('button', { name: /^Tab mode: / });
const sketches = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /^Sketch/ });

// A new document in a mode, on its start, in dark mode at a desktop size.
async function openInMode(page: Page, name: 'diagram' | 'draw') {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  // Marks the Workshop tour seen, as these specs once had to (it offered itself until 25 October 2026); harmless now
  // that tours only start from the footer's Start Tour button.
  await page.addInitScript(() => {
    const key = 'livediagram:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      if (prefs.workshopTourSeen !== true)
        localStorage.setItem(key, JSON.stringify({ ...prefs, workshopTourSeen: true }));
    } catch {
      // No storage: nothing to mark.
    }
  });
  await createInMode(page, name);
}

async function chooseOnStart(page: Page, name: 'Diagram' | 'Draw') {
  await startSwitch(page).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}`) }).click();
}

// An empty tab offers each mode's start screen (docs/specs/007-editor/start-diagramming.md); its × starts from a
// blank canvas, as a person drawing straight away would close it.
async function closeStart(page: Page) {
  const start = page.getByRole('region', {
    name: /^Start (Diagramming|Drawing|a Workshop)$/,
  });
  await start.waitFor();
  await start.getByRole('button', { name: 'Close' }).click();
  await start.waitFor({ state: 'detached' });
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
  // docs/specs/007-editor/editor-modes.md "The mode switch": only an empty tab's start offers one.
  test('a tab offers no mode switch beside the menu button or in its tab menu', async ({
    page,
    pageErrors,
  }) => {
    await openInMode(page, 'diagram');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'diagram');
    await expect(startSwitch(page)).toHaveAccessibleName('Tab mode: Diagram');
    await closeStart(page);
    await expect(page.getByRole('button', { name: /mode:/i })).toHaveCount(0);

    await page.getByRole('button', { name: 'Tab menu' }).click();
    await expect(page.getByRole('button', { name: 'Add to Folder' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Mode/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Mode' })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test("the start's switch turns an empty tab to Draw, and once drawn on the tab keeps its mode", async ({
    page,
    pageErrors,
  }) => {
    await openInMode(page, 'diagram');
    await chooseOnStart(page, 'Draw');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    await expect(dock(page)).toBeVisible();
    await closeStart(page);

    await page.keyboard.press('1');
    await drawWave(page, { x: 500, y: 600 });
    await expect(sketches(page)).toHaveCount(1);

    // A tab with content keeps its mode: Shift+D does nothing.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+D');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');

    await expect.poll(() => savedOpensIn(page), { timeout: 15_000 }).toBe('draw');
    await page.reload();
    await page.locator(CANVAS).waitFor();
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    await expect(sketches(page)).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });

  test('Shift+D moves an empty tab to the next mode', async ({ page, pageErrors }) => {
    await openInMode(page, 'diagram');
    await closeStart(page);
    await page.locator(CANVAS).click({ position: { x: 800, y: 500 } });
    await page.keyboard.press('Shift+D');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    expectNoPageErrors(pageErrors);
  });

  // docs/specs/007-editor/editor-modes.md "A new tab opens in the mode it was made from".
  test('a new tab opens in the mode it was made from', async ({ page, pageErrors }) => {
    await openInMode(page, 'diagram');
    await chooseOnStart(page, 'Draw');
    await page.getByRole('button', { name: 'Add tab' }).click();
    await expect(page.locator('[data-editor-tabbar]').getByText('Tab 2')).toBeVisible();
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    // On its mode's own start, with no Quick Start over it.
    await expect(page.getByRole('region', { name: 'Start Drawing' })).toBeVisible();
    expectNoPageErrors(pageErrors);
  });

  // docs/specs/007-editor/editor-modes.md "Where the mode lives": the mode is the tab's, the same
  // for everyone on it, and a switch is one undo step.
  test("the start's switch changes the tab for everyone, and Undo switches it back", async ({
    page,
    pageErrors,
  }) => {
    await openInMode(page, 'diagram');
    // A second window on the same tab, open before the switch.
    const other = await page.context().newPage();
    await other.emulateMedia({ colorScheme: 'dark' });
    await other.setViewportSize({ width: 1600, height: 900 });
    await other.goto(page.url());
    await other.locator(CANVAS).waitFor({ timeout: 30_000 });
    await dismissQuickTour(other);
    await expect(mode(other)).toHaveAttribute('data-editor-mode', 'diagram');

    await chooseOnStart(page, 'Draw');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'draw');
    await expect.poll(() => savedOpensIn(page), { timeout: 15_000 }).toBe('draw');
    // The other window follows the tab, live.
    await expect(mode(other)).toHaveAttribute('data-editor-mode', 'draw', { timeout: 15_000 });

    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(mode(page)).toHaveAttribute('data-editor-mode', 'diagram');
    await expect(mode(other)).toHaveAttribute('data-editor-mode', 'diagram', { timeout: 15_000 });
    await other.close();
    expectNoPageErrors(pageErrors);
  });
});
