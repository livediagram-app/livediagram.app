import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { freshUserId, installSession, type StubUser } from './session';

// Making a project is a use (docs/specs/015-api/api.md "Marking a project used"), signed in, against the signed-in
// export: the api records an API client's create as its open, so the project is in Home’s Most Used or Recent unopened; one it
// makes with markUsed: false is not.

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

function stubUser(id: string): StubUser {
  return {
    id,
    firstName: 'Ida',
    lastName: 'Maker',
    email: `${id}@example.com`,
  };
}

async function signedIn(page: Page, userId: string): Promise<Record<string, string>> {
  await page.addInitScript(() => {
    localStorage.setItem('liveplanner:v2:name-confirmed', '1');
    localStorage.setItem('liveplanner:user-preferences:v1', JSON.stringify({ planTourSeen: true }));
  });
  await installSession(page, stubUser(userId));
  const token = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  return { Authorization: `Bearer ${token}` };
}

async function apiCreate(
  page: Page,
  headers: Record<string, string>,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const id = crypto.randomUUID();
  const res = await page.request.post('/api/projects', {
    headers,
    data: { id, name, tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }], ...extra },
  });
  expect(res.status(), `create ${name}`).toBe(201);
}

// Home's opened projects: the Most Used and Recent sections, grids on a wide screen, strips on a phone.
const homeOpened = (page: Page) =>
  page.getByRole('region', { name: /^(Most Used|Recent)$/ }).getByRole('listitem');

test('an API client’s project is in Home’s Most Used or Recent unless it says markUsed: false', async ({
  page,
  pageErrors,
}) => {
  const headers = await signedIn(page, freshUserId('maker'));
  await apiCreate(page, headers, 'Made by a script');
  await apiCreate(page, headers, 'One of a batch', { markUsed: false });

  await page.goto('/explorer/home');
  await expect(homeOpened(page).getByRole('link', { name: 'Made by a script' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(homeOpened(page).getByRole('link', { name: 'One of a batch' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
