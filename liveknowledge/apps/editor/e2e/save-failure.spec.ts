import { test, expect, expectNoPageErrors } from './fixtures';
import { newServerKnowledgebase, writeLines } from './knowledgebase';

// A failed autosave names its real cause (docs/specs/006-document/per-tab-storage.md). Production showed
// `Http401.SaveTab` reading as "Check your connection" on a wired fibre line.
// The worker's exact 401 is replayed on the page's PUT, since no signed-in session
// exists in the e2e stack; lifting it proves the next edit saves again.
test('a save refused as unauthenticated says so, then recovers', async ({ page, pageErrors }) => {
  await newServerKnowledgebase(page);
  const pageWrites = '**/api/documents/*/tabs/*';

  await page.route(pageWrites, (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'account_id_not_a_guest_credential' }),
        })
      : route.continue(),
  );
  await writeLines(page, 'A line the server refuses.');

  // Next's route announcer is an alert too; the toast is the other one.
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert).toContainText('Your sign-in has lapsed');
  await expect(alert).not.toContainText(/connection/i);

  await page.unroute(pageWrites);
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/api\/documents\/[^/]+\/tabs\//.test(r.url()),
  );
  await writeLines(page, 'A line the server takes.');
  expect((await saved).status()).toBeLessThan(300);

  expectNoPageErrors(pageErrors);
});
