import { createInMode, expect, expectNoPageErrors, test } from './fixtures';

// A start's search finds templates in other modes (docs/specs/007-editor/start-diagramming.md "Found in other
// modes"): they show under In Other Modes, each saying where it leads, and choosing one lands it and switches the tab
// to that mode.

// The open tab's editor mode, as the editor marks it.
const mode = (page: import('@playwright/test').Page) => page.locator('[data-editor-mode]');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // The mode tours offer themselves on arrival; their overlay would take the presses below.
  await page.addInitScript(() => {
    const key = 'livehuddle:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      localStorage.setItem(
        key,
        JSON.stringify({
          ...prefs,
          workshopTourSeen: true,
        }),
      );
    } catch {
      // No storage: nothing to mark.
    }
  });
});

test('Start Diagramming finds a Workshop template and switches the tab to it', async ({
  page,
  pageErrors,
}) => {
  // No tour dismissal: the tours wait while a start is open, and this one leaves for Workshop.
  await createInMode(page, 'diagram');
  const start = page.getByRole('region', { name: 'Start Diagramming' });
  await start.getByRole('textbox', { name: 'Find a template' }).fill('sailboat');
  // The search's own line: the footer's Sync to Server switch keeps a live region of its own, empty until it speaks.
  await expect(start.getByRole('status').filter({ hasText: 'No diagram templates' })).toHaveText(
    'No diagram templates match “sailboat”. Found in other modes.',
  );
  const workshop = start
    .getByRole('region', { name: 'In Other Modes' })
    .getByRole('region', { name: 'Workshop' });
  const card = workshop.getByRole('button', { name: /^Sailboat Retrospective in Workshop:/ });
  await expect(card).toContainText('Opens in Workshop');
  await card.click();
  await expect(start).toBeHidden();
  await expect(mode(page)).toHaveAttribute('data-editor-mode', 'workshop');
  await expect(page.locator('[data-canvas-a11y-root]').getByRole('img').first()).toBeVisible();
  expectNoPageErrors(pageErrors);
});
