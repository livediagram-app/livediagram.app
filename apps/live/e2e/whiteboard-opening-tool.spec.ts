import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, seedTab, test } from './fixtures';

// The tool a whiteboard opens with (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard
// shows"): an empty board puts the active pen in hand, a board with content opens on Select.
// Dark mode; synthesised board.

const dock = (page: Page) => page.locator('[data-whiteboard-dock]');
const selectTool = (page: Page) => dock(page).getByRole('button', { name: 'Select', exact: true });
const marker1 = (page: Page) => dock(page).getByRole('button', { name: /^Marker 1/ });

async function openNewWhiteboard(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/new?template=whiteboard');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await dock(page).waitFor();
}

test.describe('whiteboard opening tool', () => {
  test('an empty board puts the pen in hand', async ({ page, pageErrors }) => {
    await openNewWhiteboard(page);
    await expect(marker1(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(selectTool(page)).toHaveAttribute('aria-pressed', 'false');
    expectNoPageErrors(pageErrors);
  });

  test('a board with content opens on Select', async ({ page, pageErrors }) => {
    await openNewWhiteboard(page);
    await seedTab(page, [
      { id: 'note', type: 'shape', shape: 'square', x: 600, y: 300, width: 160, height: 100 },
    ]);
    await dock(page).waitFor();
    await expect(page.locator('[data-element-id="note"]').first()).toBeVisible();
    await expect(selectTool(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(marker1(page)).toHaveAttribute('aria-pressed', 'false');
    expectNoPageErrors(pageErrors);
  });
});
