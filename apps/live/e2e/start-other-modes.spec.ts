import { createInMode, dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// A start's search finds templates in other modes (docs/specs/007-editor/start-diagramming.md "Found in other
// modes"): they show under In Other Modes, each saying where it leads, and choosing one lands it and switches the tab
// to that mode, Plan's line included while the tab is empty.

const chip = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Editor mode: / });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // The mode tours offer themselves on arrival; their overlay would take the presses below.
  await page.addInitScript(() => {
    const key = 'livediagram:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      localStorage.setItem(
        key,
        JSON.stringify({
          ...prefs,
          planTourSeen: true,
          planTourTracks: ['boards', 'sheets'],
          facilitateTourSeen: true,
        }),
      );
    } catch {
      // No storage: nothing to mark.
    }
  });
});

test('Start Diagramming finds a Facilitate template and switches the tab to it', async ({
  page,
  pageErrors,
}) => {
  await createInMode(page, 'diagram');
  await dismissQuickTour(page);
  const start = page.getByRole('region', { name: 'Start Diagramming' });
  await start.getByRole('textbox', { name: 'Find a template' }).fill('sailboat');
  await expect(start.getByRole('status')).toHaveText(
    'No diagram templates match “sailboat”. Found in other modes.',
  );
  const facilitate = start
    .getByRole('region', { name: 'In Other Modes' })
    .getByRole('region', { name: 'Facilitate' });
  const card = facilitate.getByRole('button', { name: /^Sailboat retrospective in Facilitate:/ });
  await expect(card).toContainText('Opens in Facilitate');
  await card.click();
  await expect(start).toBeHidden();
  await expect(chip(page)).toHaveAccessibleName('Editor mode: Facilitate');
  await expect(page.locator('[data-canvas-a11y-root]').getByRole('img').first()).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('Start Planning finds a Diagram template and the tab crosses out of Plan', async ({
  page,
  pageErrors,
}) => {
  await createInMode(page, 'plan');
  const start = page.getByRole('region', { name: 'Start Planning' });
  await start
    .getByRole('textbox', { name: 'Find a board, sheet, form or layout' })
    .fill('flowchart');
  await start
    .getByRole('region', { name: 'In Other Modes' })
    .getByRole('button', { name: /^Flowchart in Diagram:/ })
    .click();
  await expect(start).toBeHidden();
  await expect(chip(page)).toHaveAccessibleName('Editor mode: Diagram');
  expectNoPageErrors(pageErrors);
});
