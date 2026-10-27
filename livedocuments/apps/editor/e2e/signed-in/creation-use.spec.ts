import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { freshUserId, installSession, type StubUser } from './session';

// Making a document is a use (docs/specs/015-api/api.md "Marking a document used"), signed in, against the
// signed-in export: the api records an API client's create as its open, so the document is in Jump Back In
// unopened; one it makes with markUsed: false is not.
// Jump Back In is the shared Explorer's (liveworkspace's, not served here), so this asks the index for
// what it reads: Recent's first page with its Most Used beside it.

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
    localStorage.setItem('livedocuments:v2:name-confirmed', '1');
    localStorage.setItem(
      'livedocuments:user-preferences:v1',
      JSON.stringify({ pagesTourSeen: true }),
    );
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
  const res = await page.request.post('/api/documents', {
    headers,
    data: { id, name, tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }], ...extra },
  });
  expect(res.status(), `create ${name}`).toBe(201);
}

// Jump Back In's documents, as the Explorer reads them: Recent's first page and its Most Used.
async function jumpBackIn(page: Page, headers: Record<string, string>): Promise<string[]> {
  const res = await page.request.get(
    '/api/index/items?app=livedocuments&view=recent&limit=10&used=5',
    {
      headers,
    },
  );
  expect(res.ok(), `index recent: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { items: { title: string }[]; mostUsed?: { title: string }[] };
  return [...(body.mostUsed ?? []), ...body.items].map((item) => item.title);
}

test('an API client’s document is in Jump Back In unless it says markUsed: false', async ({
  page,
}) => {
  const headers = await signedIn(page, freshUserId('maker'));
  await apiCreate(page, headers, 'Made by a script');
  await apiCreate(page, headers, 'One of a batch', { markUsed: false });

  await expect
    .poll(() => jumpBackIn(page, headers), { timeout: 30_000 })
    .toContain('Made by a script');
  expect(await jumpBackIn(page, headers)).not.toContain('One of a batch');
});
