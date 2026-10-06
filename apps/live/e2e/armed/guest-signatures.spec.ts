import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, startBlankDocument, test } from '../fixtures';

// Armed guest signatures (docs/specs/003-system-architecture/e2e-smoke.md "Armed guest signatures";
// docs/specs/014-identity/auth-and-guest-access.md "Signed guest ids"): with enforcement on, as
// production runs it once armed, a first-time guest on any entry path gets a signed id before its
// first owner-scoped call, creates a document and sees the canvas. Run with `pnpm test:e2e:armed`.

// Every api answer the page got, as `METHOD status /path`.
function recordApi(page: Page): string[] {
  const seen: string[] = [];
  page.on('response', (res) => {
    const path = new URL(res.url()).pathname;
    if (path.startsWith('/api/')) seen.push(`${res.request().method()} ${res.status()} ${path}`);
  });
  return seen;
}

async function expectSignedGuestCreated(page: Page, api: string[]): Promise<void> {
  await expect(page).toHaveURL(/\/document\/[^/?]+/);
  await expect(page.locator('[data-canvas-a11y-root]')).toBeAttached();
  expect(api).toContain('POST 201 /api/documents');
  expect(api.filter((line) => / 401 /.test(line))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('livediagram:v2:self-sig'))).toBeTruthy();
}

test.describe('a first-time guest with signatures enforced', () => {
  test('creates a document from /new', async ({ page, pageErrors }) => {
    const api = recordApi(page);
    await startBlankDocument(page);
    await expectSignedGuestCreated(page, api);
    expectNoPageErrors(pageErrors);
  });

  test('creates a document after arriving on /', async ({ page, pageErrors }) => {
    const api = recordApi(page);
    await page.goto('/');
    await page.waitForURL(/\/new/);
    await page.getByText('New Document', { exact: false }).waitFor();
    // Landing signs the guest before anything else; the wizard then starts from that page's identity.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('livediagram:v2:self-sig')))
      .toBeTruthy();
    await startBlankDocument(page);
    await expectSignedGuestCreated(page, api);
    expectNoPageErrors(pageErrors);
  });

  test('creates a blank document straight away', async ({ page, pageErrors }) => {
    const api = recordApi(page);
    await page.goto('/new?blank=1');
    await page.locator('[data-canvas-a11y-root]').waitFor();
    await expectSignedGuestCreated(page, api);
    expectNoPageErrors(pageErrors);
  });

  test('creates a document after opening the Explorer first', async ({ page, pageErrors }) => {
    const api = recordApi(page);
    await page.goto('/explorer');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('livediagram:v2:self-sig')))
      .toBeTruthy();
    await startBlankDocument(page);
    await expectSignedGuestCreated(page, api);
    expectNoPageErrors(pageErrors);
  });

  // A first mint that never lands (offline, or a navigation that cuts it short) leaves a local unsigned
  // id. The next load must not stay locked out with it: the worker refuses its upgrade, and the browser
  // adopts the signed id ("A refused upgrade adopts the signed id").
  test('recovers from a first mint that never landed', async ({ page, pageErrors }) => {
    await page.route('**/api/guest-id', (route) => route.abort('internetdisconnected'), {
      times: 1,
    });
    await page.goto('/new?blank=1');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('livediagram:v2:self-id')))
      .toBeTruthy();
    expect(await page.evaluate(() => localStorage.getItem('livediagram:v2:self-sig'))).toBeNull();

    const api = recordApi(page);
    await page.goto('/new?blank=1');
    await page.locator('[data-canvas-a11y-root]').waitFor();
    expect(api).toContain('POST 403 /api/migrate');
    await expectSignedGuestCreated(page, api);
    expectNoPageErrors(pageErrors);
  });
});
