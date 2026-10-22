import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { freshUserId, installClerkStub, type StubUser } from './clerk-stub';

// Placement rides the create (docs/specs/013-workspace/folders.md "Placement on create",
// docs/specs/007-editor/new-document-route.md): a signed-in member's /new into a team folder files
// the document there in the one create, with no follow-up placement request, and a refused
// placement shows its own card instead of a document filed somewhere else.

const NEW_EDITOR = /\/document\/[0-9a-f-]{36}$/;

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
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:user-preferences:v1', JSON.stringify({ tourSeen: true }));
  });
  await installClerkStub(page, stubUser(userId));
  const token = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  return { Authorization: `Bearer ${token}`, Origin: new URL(baseURL).origin };
}

// Every request the page makes to a document's placement route.
function placementRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (req) => {
    if (/\/api\/documents\/[^/]+\/folder$/.test(new URL(req.url()).pathname)) seen.push(req.url());
  });
  return seen;
}

test('a create into a team folder lands there in one write', async ({ page, baseURL }) => {
  const userId = freshUserId('placer');
  const headers = await signedIn(page, baseURL!, userId);
  const teamId = crypto.randomUUID();
  const folderId = crypto.randomUUID();
  expect(
    (await page.request.post('/api/teams', { headers, data: { id: teamId, name: 'Atlas' } })).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post('/api/folders', {
        headers,
        data: { id: folderId, name: 'Designs', parentId: null, teamId },
      })
    ).ok(),
  ).toBe(true);
  const moves = placementRequests(page);

  await page.goto(`/new?blank=1&team=${teamId}&folder=${folderId}`);
  await expect(page).toHaveURL(NEW_EDITOR, { timeout: 20_000 });
  const documentId = page.url().split('/').pop()!;

  const library = (await (
    await page.request.get(`/api/teams/${teamId}/library`, { headers })
  ).json()) as { documents: { id: string; folderId: string | null; teamId: string | null }[] };
  expect(library.documents.find((d) => d.id === documentId)).toMatchObject({ teamId, folderId });
  const personal = (await (await page.request.get('/api/documents', { headers })).json()) as {
    documents: { id: string }[];
  };
  expect(personal.documents.map((d) => d.id)).not.toContain(documentId);
  expect(moves).toEqual([]);
});

test('a refused placement says why and offers another place', async ({ page, baseURL }) => {
  await signedIn(page, baseURL!, freshUserId('refused'));

  await page.goto(`/new?blank=1&folder=${crypto.randomUUID()}`);

  await expect(page.getByRole('heading', { name: 'Couldn’t file the document there' })).toBeVisible(
    {
      timeout: 20_000,
    },
  );
  await expect(page.getByText('That folder no longer exists, or isn’t yours.')).toBeVisible();
  await page.getByRole('button', { name: 'Choose another place' }).click();
  await expect(page).toHaveURL(/\/new$/);
});
