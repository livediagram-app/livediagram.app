import type { Page } from '@playwright/test';
import { expect } from '../fixtures';
import type { StubUser } from './clerk-stub';

// What the agent specs share (docs/specs/024-agents/): Webber, signed in, with his own unshared document holding one
// square, his participant row, and an API token for his agent; and opening that document until its room greets the
// editor.

export const CANVAS = '[data-canvas-a11y-root]';
export const WEBBER: StubUser = {
  firstName: 'Webber',
  lastName: 'Takken',
  email: 'webber@example.com',
  hasImage: false,
  imageUrl: 'https://img.clerk.com/stub/default',
  externalAccounts: [],
};

export type Setup = { id: string; tabId: string; token: string; session: Record<string, string> };

// Webber's personal document with one square, his participant row, and an API token for his agent.
export async function arrange(page: Page, baseURL: string, userId: string): Promise<Setup> {
  const jwt = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  const session = { Authorization: `Bearer ${jwt}`, Origin: new URL(baseURL).origin };
  await page.request.put(`/api/participants/${userId}`, {
    headers: session,
    data: { name: 'Webber', color: '#f59e0b' },
  });
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const created = await page.request.post('/api/documents', {
    headers: session,
    data: {
      id,
      name: 'Payments',
      tabs: [
        {
          id: tabId,
          name: 'Board',
          elements: [
            {
              id: 'api',
              type: 'shape',
              shape: 'square',
              x: 200,
              y: 200,
              width: 180,
              height: 80,
              label: 'API',
            },
          ],
        },
      ],
    },
  });
  expect(created.ok()).toBe(true);
  const minted = await page.request.post('/api/tokens', {
    headers: session,
    data: { name: 'agent' },
  });
  expect(minted.ok()).toBe(true);
  const { token } = (await minted.json()) as { token: string };
  return { id, tabId, token, session };
}

export async function agentSubmits(page: Page, s: Setup, body: unknown) {
  return page.request.post(`/api/documents/${s.id}/tabs/${s.tabId}/changesets`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-Livediagram-Client': 'cli' },
    data: body,
  });
}

export async function storedIds(page: Page, s: Setup): Promise<string[]> {
  const res = await page.request.get(`/api/documents/${s.id}/tabs/${s.tabId}`, {
    headers: { Authorization: `Bearer ${s.token}` },
  });
  const { tab } = (await res.json()) as { tab: { elements: { id: string }[] } };
  return tab.elements.map((e) => e.id);
}

// Opens the document and waits for its room to greet the editor: from then on a changeset is relayed
// live (one that lands before is caught up by the join check, without a toast).
export async function open(page: Page, s: Setup) {
  await page.addInitScript(() => {
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:user-preferences:v1', JSON.stringify({ tourSeen: true }));
  });
  const socket = page.waitForEvent('websocket', (ws) => ws.url().includes(`/documents/${s.id}/ws`));
  await page.goto(`/document/${s.id}`);
  const ws = await socket;
  await ws.waitForEvent('framereceived', (f) => String(f.payload).includes('"kind":"presence"'));
  await page.locator(CANVAS).waitFor();
  await expect(page.getByText('API', { exact: true })).toBeVisible();
}
