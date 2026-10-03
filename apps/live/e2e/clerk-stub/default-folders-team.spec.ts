import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test, untilHydrated } from '../fixtures';
import { freshUserId, installClerkStub, type StubUser } from './clerk-stub';

// A signed-in member's default folder in a team (docs/specs/013-workspace/default-folders.md "Use as
// default for", "The New Document wizard", "Settings"), in dark mode: set from the team library's
// folder menu, pre-selected by the wizard, filed into the team by the one create, named in Settings.

function stubUser(id: string): StubUser {
  return {
    id,
    firstName: 'Pat',
    lastName: 'Lane',
    email: `${id}@example.com`,
    hasImage: false,
    imageUrl: 'https://img.clerk.com/stub/default',
    externalAccounts: [],
  };
}

async function signedIn(page: Page, baseURL: string, userId: string) {
  await page.addInitScript(() => {
    localStorage.setItem('livediagram:v2:ui-mode', 'dark');
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:user-preferences:v1', JSON.stringify({ tourSeen: true }));
  });
  await installClerkStub(page, stubUser(userId));
  const token = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  return { Authorization: `Bearer ${token}`, Origin: new URL(baseURL).origin };
}

test('a team folder becomes a member’s default, and new boards land in it', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 800 });
  const headers = await signedIn(page, baseURL!, freshUserId('defaults'));
  const teamId = crypto.randomUUID();
  const folderId = crypto.randomUUID();
  expect(
    (await page.request.post('/api/teams', { headers, data: { id: teamId, name: 'Atlas' } })).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post('/api/folders', {
        headers,
        data: { id: folderId, name: 'Boards', parentId: null, teamId },
      })
    ).ok(),
  ).toBe(true);
  const defaults = async () =>
    (
      (await (await page.request.get('/api/placement-defaults', { headers })).json()) as {
        defaults: { key: string; folderId: string }[];
      }
    ).defaults;

  // The team library's folder menu.
  await page.goto(`/explorer/team?id=${teamId}`);
  const menu = page.getByRole('button', { name: /^Menu for (folder )?Boards$/ }).last();
  await expect(menu).toBeVisible({ timeout: 30_000 });
  await menu.click();
  await page.getByRole('button', { name: 'Use as default for' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Kanban boards' }).click();
  await expect.poll(defaults).toEqual([{ key: 'template:kanban', folderId }]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-default-marker]').first()).toBeVisible();

  // The wizard pre-selects it for a Kanban board and files the board into the team.
  await page.goto('/new');
  const search = page.getByRole('searchbox', { name: 'Search templates' });
  await untilHydrated(search);
  await search.fill('kanban');
  await page
    .getByRole('button', { name: /^Kanban/ })
    .first()
    .click();
  const next = page.getByRole('button', { name: /^Next/ });
  if (await next.isVisible()) await next.click();
  await expect(page.getByRole('note').filter({ hasText: 'by default' })).toHaveText(
    'Kanban boards go to Boards by default. Change default',
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const documentId = page.url().split('/').pop()!;
  const library = (await (
    await page.request.get(`/api/teams/${teamId}/library`, { headers })
  ).json()) as { documents: { id: string; folderId: string | null }[] };
  expect(library.documents.find((d) => d.id === documentId)?.folderId).toBe(folderId);

  // Settings names the folder with its team.
  await page.goto(`/explorer/team?id=${teamId}&settings=documents`);
  await expect(page.getByText('Boards · Atlas')).toBeVisible({ timeout: 30_000 });
  expectNoPageErrors(pageErrors);
});
