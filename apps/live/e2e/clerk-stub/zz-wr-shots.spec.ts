import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { freshUserId, installClerkStub } from './clerk-stub';

async function api(
  page: Page,
  userId: string,
  method: 'POST' | 'PUT' | 'GET',
  path: string,
  data?: unknown,
  extra: Record<string, string> = {},
) {
  const token = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  const res = await page.request.fetch(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...extra },
    ...(data === undefined ? {} : { data }),
  });
  expect(res.ok()).toBe(true);
  return res;
}

for (const [label, w, h] of [
  ['desktop', 1280, 800],
  ['phone', 390, 844],
] as const) {
  test(`signed-in shots ${label}`, async ({ page }) => {
    const ann = freshUserId('ann');
    const shape = {
      id: 'a',
      type: 'shape',
      shape: 'square',
      x: 40,
      y: 40,
      width: 200,
      height: 100,
    };
    for (const name of [
      'Payments architecture',
      'Sprint retros',
      'Order flow',
      'Team structure',
      'Q4 goals map',
      'Launch plan',
    ]) {
      const doc = crypto.randomUUID();
      const tab = crypto.randomUUID();
      await api(page, ann, 'POST', '/documents', {
        id: doc,
        name,
        tabs: [{ id: tab, name: 'Tab 1', elements: [{ ...shape, label: name }] }],
      });
      await api(page, ann, 'GET', `/documents/${doc}/tabs/${tab}`, undefined, {
        'X-Document-Open': '1',
      });
    }
    await installClerkStub(page, {
      id: ann,
      firstName: 'Ann',
      lastName: 'Tester',
      email: `${ann}@example.com`,
      hasImage: false,
      imageUrl: '',
      externalAccounts: [],
    });
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/explorer/home');
    await expect(page.getByRole('list', { name: 'Jump back in' }).getByRole('link')).toHaveCount(
      6,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `/tmp/wr-shots/after-signedin-${label}-dark.png` });
  });
}
