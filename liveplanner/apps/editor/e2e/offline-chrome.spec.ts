import type { Page } from '@playwright/test';
import { expect, serverNewUrl, test } from './fixtures';

// The chrome over a Board tab with the browser offline, at desktop width (Work Tracker 1213): the offline banner
// pushes the board below the top row, so its name stays in its own header, and the menu box beside the logo holds
// nothing else. Before the no-header layout, the menu box showed the tab's name ("Board") as a second, stray board
// menu beside the board's own header. docs/specs/007-editor/toolbar-layout.md, docs/specs/006-project/offline-mode.md.

const menuBoxes = (page: Page) => page.locator('[data-toolbar-menu]');
// The board's name, wherever it rides: in its header, or in the menu box while the header holds the top row.
const boardNames = (page: Page) =>
  page.getByText('Kanban', { exact: true }).filter({ visible: true });

test.describe('offline chrome on a Board tab', () => {
  test('shows one menu box and one board name, online and offline', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(await serverNewUrl(page, '/new?template=kanban'));
    await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
    await expect(boardNames(page)).toHaveCount(1);
    await expect(menuBoxes(page)).toHaveCount(1);

    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: /offline/ })).toBeVisible();
    // The board's name is back in its header, so the menu box's name slot is empty, and no tab name stands in.
    await expect(page.locator('[data-menu-name-slot]')).toBeEmpty();
    await expect(menuBoxes(page)).toHaveCount(1);
    await expect(menuBoxes(page)).not.toContainText('Board');
    await expect(boardNames(page)).toHaveCount(1);
    await context.setOffline(false);
  });
});
