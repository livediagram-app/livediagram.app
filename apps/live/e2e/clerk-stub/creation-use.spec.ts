import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { syntheticExportZip } from '../ms-whiteboard-board';
import { freshUserId, installClerkStub, type StubUser } from './clerk-stub';

// Making a document is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md
// "Making a document"; docs/specs/015-api/api.md "Marking a document used"), signed in, against the
// Clerk-enabled export: a board imported on its own and a document an API client makes are in Jump
// back in unopened; one the API client makes with markUsed: false is not, nor a two-board import.

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
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:user-preferences:v1', JSON.stringify({ tourSeen: true }));
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

async function importBoards(page: Page, boards: 1 | 2): Promise<void> {
  await page.goto('/explorer/recent');
  await page
    .getByRole('toolbar', { name: 'Import from' })
    .getByRole('button', { name: 'Import from Microsoft Whiteboard' })
    .click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a .zip' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'boards.zip',
    mimeType: 'application/zip',
    buffer: syntheticExportZip(boards),
  });
  // One board imports at once; several are listed first, to choose from.
  if (boards === 2) await page.getByRole('button', { name: 'Import 2 boards' }).click();
  await expect(page.getByTestId('import-documents')).toContainText('Sprint board');
}

const jumpBackIn = (page: Page) => page.getByRole('list', { name: 'Jump back in' });

test('an API client’s document is in Jump back in unless it says markUsed: false', async ({
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

test('signed in, a single imported board is in Jump back in; a two-board import is not', async ({
  page,
  pageErrors,
}) => {
  await signedIn(page, freshUserId('importer'));
  await importBoards(page, 2);
  await page.goto('/explorer/home');
  await expect(page.getByRole('region', { name: 'Jump back in' })).toContainText(
    'The documents you use most and last will gather here.',
    { timeout: 30_000 },
  );

  await importBoards(page, 1);
  await page.goto('/explorer/home');
  await expect(jumpBackIn(page).getByRole('link')).toHaveCount(1);
  await expect(jumpBackIn(page).getByRole('link', { name: 'Sprint board' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('signed-in-import-home.png') });
  expectNoPageErrors(pageErrors);
});
