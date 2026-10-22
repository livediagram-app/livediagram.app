import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { freshUserId, installClerkStub, type StubUser } from './clerk-stub';

// Making a document is a use (docs/specs/013-workspace/explorer-home.md "Making a document";
// docs/specs/015-api/api.md "Marking a document used"), signed in, against the Clerk-enabled export:
// a document an API client makes is in Jump Back In unopened; one it makes with markUsed: false is not.

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

function stubUser(id: string): StubUser {
  return {
    id,
    firstName: 'Ida',
    lastName: 'Maker',
    email: `${id}@example.com`,
    hasImage: false,
    imageUrl: '',
    externalAccounts: [],
  };
}

async function signedIn(page: Page, userId: string): Promise<Record<string, string>> {
  await page.addInitScript(() => {
    localStorage.setItem('livepages:v2:name-confirmed', '1');
    localStorage.setItem('livepages:user-preferences:v1', JSON.stringify({ pagesTourSeen: true }));
  });
  await installClerkStub(page, stubUser(userId));
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
  const res = await page.request.post('/api/documents', {
    headers,
    data: { id, name, tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }], ...extra },
  });
  expect(res.status(), `create ${name}`).toBe(201);
}

// Jump Back In's documents: the Most Used and Recent lists on a wide screen, the strip on a phone.
const jumpBackIn = (page: Page) =>
  page.getByRole('region', { name: 'Jump Back In' }).getByRole('listitem');

test('an API client’s document is in Jump Back In unless it says markUsed: false', async ({
  page,
  pageErrors,
}) => {
  const headers = await signedIn(page, freshUserId('maker'));
  await apiCreate(page, headers, 'Made by a script');
  await apiCreate(page, headers, 'One of a batch', { markUsed: false });

  await page.goto('/explorer/home');
  await expect(jumpBackIn(page).getByRole('link', { name: 'Made by a script' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(jumpBackIn(page).getByRole('link', { name: 'One of a batch' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
