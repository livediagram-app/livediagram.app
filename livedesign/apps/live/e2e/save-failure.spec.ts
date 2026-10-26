import {
  test,
  expect,
  dismissQuickTour,
  expectNoPageErrors,
  onPage,
  openBlankPage,
  paletteTile,
} from './fixtures';

// A failed autosave names its real cause (docs/specs/006-design/per-tab-storage.md). Production showed
// `Http401.SaveTab` reading as "Check your connection" on a wired fibre line.
// The worker's exact 401 is replayed on the tab PUT, since no signed-in session
// exists in the e2e stack; lifting it proves the next edit saves again.
test('a save refused as unauthenticated says so, then recovers', async ({ page, pageErrors }) => {
  // Its page chosen a Logo first, its save awaited, so the squares below have a page to land on.
  await openBlankPage(page);
  const canvas = page.locator('[data-canvas-a11y-root]');
  const tabWrites = '**/api/designs/*/tabs/*';

  await page.route(tabWrites, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'account_id_not_a_guest_credential' }),
        })
      : route.continue(),
  );
  await (await paletteTile(page, 'Add Square')).click();
  await canvas.click({ position: await onPage(page, 0.3, 0.25) });

  // Next's route announcer is an alert too; the toast is the other one.
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert).toContainText('Your sign-in has lapsed');
  await expect(alert).not.toContainText(/connection/i);

  await page.unroute(tabWrites);
  await dismissQuickTour(page);
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/api\/designs\/[^/]+\/tabs\//.test(r.url()),
  );
  await (await paletteTile(page, 'Add Square')).click();
  await canvas.click({ position: await onPage(page, 0.7, 0.25) });
  expect((await saved).status()).toBeLessThan(300);

  expectNoPageErrors(pageErrors);
});
