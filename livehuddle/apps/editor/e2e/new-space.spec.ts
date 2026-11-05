import type { Page } from '@playwright/test';
import { adoptGuest, expect, expectNoPageErrors, mintGuest, serverNewUrl, test } from './fixtures';

// /new as a guest (docs/specs/007-editor/new-document-route.md "No welcome screen"): it has no screen of its own, it
// makes a Blank Space at once and opens it on Start a Space, on Recommended. Start Blank opens with the start closed,
// and the create's error card shows only when the api really fails (issue #330).

const CREATE_FAILED = /Couldn.t create the space/;
const startPanel = (page: Page) => page.getByRole('region', { name: /^Start a Space$/ });

// The page opens as a guest that already holds its token, as a returning guest does. A fresh browser first leaves
// /new for the guest hand-off and comes back, and a check that lands during that round trip loses its page.
async function openNew(page: Page, url = '/new'): Promise<void> {
  await adoptGuest(page, await mintGuest(page.request));
  await page.goto(url);
}

async function expectCanvas(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await expect(page.getByText(CREATE_FAILED)).toHaveCount(0);
}

test('/new makes a Space at once and opens it on Start a Space, on Recommended', async ({
  page,
  pageErrors,
}) => {
  await openNew(page);
  await expectCanvas(page);
  await expect(startPanel(page)).toBeVisible();
  await expect(startPanel(page).getByRole('button', { name: /^Recommended/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(startPanel(page).locator('[data-start-card="blank-session"]')).toBeVisible();
  // The handoff takes /new's history entry: there is no page to come back to that would make another Space.
  expect(await page.evaluate(() => location.pathname.startsWith('/document/'))).toBe(true);
  expectNoPageErrors(pageErrors);
});

test('Start Blank makes a Space with its start closed', async ({ page, pageErrors }) => {
  await openNew(page, '/new?start=blank');
  await expectCanvas(page);
  await expect(startPanel(page)).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('the create error shows only when the api fails, and Try again recovers', async ({
  page,
  pageErrors,
}) => {
  let fail = true;
  await page.route('**/api/documents', (route) =>
    fail && route.request().method() === 'POST'
      ? route.fulfill({ status: 503, body: '{}' })
      : route.fallback(),
  );
  // A folder context makes the create a server one, so the api answers it (serverNewUrl).
  await page.goto(await serverNewUrl(page));
  await expect(page.getByText(CREATE_FAILED)).toBeVisible({ timeout: 30_000 });
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expectCanvas(page);
  expectNoPageErrors(pageErrors);
});
