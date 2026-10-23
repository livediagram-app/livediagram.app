import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test, untilHydrated } from '../fixtures';
import { freshUserId, installSession, type StubUser } from './session';

// A signed-in member's default folder in a team (docs/specs/013-workspace/default-folders.md "Use as
// default for", "The New Document wizard", "Settings"), in dark mode: set from the team library's
// folder menu, a new document moved into the team when its template is picked on the start screen, named in
// Settings.

function stubUser(id: string): StubUser {
  return {
    id,
    firstName: 'Pat',
    lastName: 'Lane',
    email: `${id}@example.com`,
  };
}

async function signedIn(page: Page, baseURL: string, userId: string) {
  await page.addInitScript(() => {
    localStorage.setItem('livediagram:v2:ui-mode', 'dark');
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:user-preferences:v1', JSON.stringify({ tourSeen: true }));
  });
  await installSession(page, stubUser(userId));
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
  await page.getByRole('menuitem', { name: 'Use as Default for' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Retrospectives' }).click();
  await expect.poll(defaults).toEqual([{ key: 'template:retrospective', folderId }]);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-default-marker]').first()).toBeVisible();

  // The wizard asks for a mode and creates at once; the Sailboat retrospective is picked on Start a Workshop, and the new
  // document moves to the template's default folder, since no folder was chosen ("A template picked after creation").
  await page.goto('/new');
  const workshop = page.locator('[data-new-mode="workshop"]');
  await untilHydrated(workshop);
  await workshop.click();
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const start = page.getByRole('region', { name: 'Start a Workshop' });
  await start.getByRole('textbox', { name: 'Find a template' }).fill('sailboat');
  await start
    .getByRole('button', { name: /^Sailboat/ })
    .first()
    .click();
  await expect(page.getByText(/Moved to Boards/)).toBeVisible({ timeout: 20_000 });
  // The path's last segment: the editor adds the open tab as a fragment (#t=...).
  const documentId = new URL(page.url()).pathname.split('/').pop()!;
  await expect
    .poll(async () => {
      const library = (await (
        await page.request.get(`/api/teams/${teamId}/library`, { headers })
      ).json()) as { documents: { id: string; folderId: string | null }[] };
      return library.documents.find((d) => d.id === documentId)?.folderId;
    })
    .toBe(folderId);

  // Settings names the folder with its team.
  await page.goto(`/explorer/team?id=${teamId}&settings=documents`);
  await expect(page.getByText('Boards · Atlas')).toBeVisible({ timeout: 30_000 });
  expectNoPageErrors(pageErrors);
});
