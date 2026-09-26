import { test, expect, dismissQuickTour, expectNoPageErrors, startBlankDiagram } from './fixtures';

// A failed autosave names its real cause (docs/specs/006-diagram/per-tab-storage.md). Production showed
// `Http401.SaveTab` reading as "Check your connection" on a wired fibre line.
// The worker's exact 401 is replayed on the tab PUT, since no Clerk session
// exists in the e2e stack; lifting it proves the next edit saves again.
test('a save refused as unauthenticated says so, then recovers', async ({ page, pageErrors }) => {
  await startBlankDiagram(page);
  const canvas = page.locator('[data-canvas-a11y-root]');
  const tabWrites = '**/api/diagrams/*/tabs/*';

  await page.route(tabWrites, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'account_id_not_a_guest_credential' }),
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Add square', exact: true }).click();
  await canvas.click({ position: { x: 420, y: 300 } });

  // Next's route announcer is an alert too; the toast is the other one.
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert).toContainText('Couldn’t confirm you’re signed in');
  await expect(alert).not.toContainText(/connection/i);

  await page.unroute(tabWrites);
  await dismissQuickTour(page);
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/api\/diagrams\/[^/]+\/tabs\//.test(r.url()),
  );
  await page.getByRole('button', { name: 'Add square', exact: true }).click();
  await canvas.click({ position: { x: 560, y: 300 } });
  expect((await saved).status()).toBeLessThan(300);

  expectNoPageErrors(pageErrors);
});
