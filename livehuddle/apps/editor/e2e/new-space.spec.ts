import type { Page } from '@playwright/test';
import { adoptGuest, expect, expectNoPageErrors, mintGuest, test, untilHydrated } from './fixtures';

// The New Space wizard (docs/specs/007-editor/new-document-route.md "One-step wizard"), as a guest: its body always says
// what Create makes and where it will be saved, every way out of it makes a real Space, and the create's error card
// shows only when the api really fails (issue #330).

const CREATE_FAILED = /Couldn.t create the space/;

// The page opens as a guest that already holds its token, as a returning guest does. A fresh browser first leaves
// /new for the guest hand-off and comes back, and a check that lands during that round trip loses its page.
async function openWizard(page: Page): Promise<void> {
  await adoptGuest(page, await mintGuest(page.request));
  await page.goto('/new');
  await untilHydrated(page.getByRole('button', { name: 'Create', exact: true }));
}

const syncSwitch = (page: Page) => page.getByRole('switch', { name: /Sync Space to Server/ });

async function expectCanvas(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await expect(page.getByText(CREATE_FAILED)).toHaveCount(0);
}

test('the wizard body names the Blank Space and offers the Sync switch', async ({
  page,
  pageErrors,
}) => {
  await openWizard(page);
  const body = page.locator('[data-new-space-body]');
  await expect(body.getByRole('region', { name: 'Blank Space' })).toBeVisible();
  await expect(body.getByRole('listitem')).not.toHaveCount(0);
  // A guest's default is This Browser, so the switch starts off.
  await expect(body.getByRole('switch', { name: /Sync Space to Server/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expectNoPageErrors(pageErrors);
});

test('Create makes a Space in this browser', async ({ page, pageErrors }) => {
  await openWizard(page);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expectCanvas(page);
  expectNoPageErrors(pageErrors);
});

test('Skip makes a Space with its start closed', async ({ page, pageErrors }) => {
  await openWizard(page);
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expectCanvas(page);
  await expect(page.getByRole('region', { name: /^Start a Space$/ })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('with Sync on, Create makes the Space on the server', async ({ page, pageErrors }) => {
  await openWizard(page);
  await syncSwitch(page).click();
  await expect(syncSwitch(page)).toHaveAttribute('aria-checked', 'true');
  const created = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/documents',
  );
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  expect((await created).ok()).toBe(true);
  await expectCanvas(page);
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
  await openWizard(page);
  await syncSwitch(page).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText(CREATE_FAILED)).toBeVisible({ timeout: 30_000 });
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expectCanvas(page);
  expectNoPageErrors(pageErrors);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the wizard fills the screen with its footer at the bottom', async ({
    page,
    pageErrors,
  }) => {
    await openWizard(page);
    await expect(page.getByRole('region', { name: 'Blank Space' })).toBeVisible();
    const create = await page.getByRole('button', { name: 'Create', exact: true }).boundingBox();
    // The footer is pinned to the bottom of the full-screen card, not left mid-screen under an empty body.
    expect(create && create.y + create.height).toBeGreaterThan(844 - 80);
    expectNoPageErrors(pageErrors);
  });
});
