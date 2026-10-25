import {
  test,
  expect,
  dismissQuickTour,
  expectNoPageErrors,
  seedTab,
  startBlankProject,
} from './fixtures';

// A failed autosave names its real cause (docs/specs/006-project/per-tab-storage.md). Production showed
// `Http401.SaveTab` reading as "Check your connection" on a wired fibre line.
// The worker's exact 401 is replayed on the tab PUT, since no signed-in session
// exists in the e2e stack; lifting it proves the next edit saves again.
test('a save refused as unauthenticated says so, then recovers', async ({ page, pageErrors }) => {
  await startBlankProject(page);
  await seedTab(page, [
    { id: 'sq', type: 'shape', shape: 'square', x: 400, y: 300, width: 120, height: 120 },
  ]);
  const square = page.getByRole('img', { name: 'Square', exact: true }).first();
  const tabWrites = '**/api/projects/*/tabs/*';

  await page.route(tabWrites, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'account_id_not_a_guest_credential' }),
        })
      : route.continue(),
  );
  // An edit: the square nudged by the keyboard.
  await square.click();
  await page.keyboard.press('ArrowRight');

  // Next's route announcer is an alert too; the toast is the other one.
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert).toContainText('Your sign-in has lapsed');
  await expect(alert).not.toContainText(/connection/i);

  await page.unroute(tabWrites);
  await dismissQuickTour(page);
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/api\/projects\/[^/]+\/tabs\//.test(r.url()),
  );
  await page.keyboard.press('ArrowRight');
  expect((await saved).status()).toBeLessThan(300);

  expectNoPageErrors(pageErrors);
});
