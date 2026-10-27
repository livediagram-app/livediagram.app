import type { Page } from '@playwright/test';
import { expect } from '../fixtures';
import { ARRANGED_VIEW } from './agent-changeset-bodies';
import type { StubUser } from './session';

// What the agent specs share (docs/specs/024-agents/): Webber, signed in, with his own unshared project holding one
// Dashboard view (ARRANGED_VIEW) beside a box of his own (PERSON_BOX), his participant row, and an API token for his
// agent; and opening that project until its room greets the editor.
//
// The box keeps the tab an ordinary canvas tab. A general tab holding only Plan elements is an old Plan tab, which
// becomes a Dashboard when its editor opens it (docs/specs/026-plan/plan-tabs.md "Converting old Plan tabs"); a
// Dashboard's rows cover the canvas, so its views could not be selected, nudged or badged with comments there.

export const CANVAS = '[data-canvas-a11y-root]';
export const WEBBER: StubUser = {
  firstName: 'Webber',
  lastName: 'Takken',
  email: 'webber@example.com',
};

// Webber's own element on the tab: not one an agent adds, so it is his alone.
export const PERSON_BOX = {
  id: 'notes',
  type: 'shape',
  shape: 'rectangle',
  x: 200,
  y: 480,
  width: 220,
  height: 110,
  label: 'Launch notes',
} as const;

export type Setup = { id: string; tabId: string; token: string; session: Record<string, string> };

// Webber's personal project with one Dashboard view, his participant row, and an API token for his agent.
export async function arrange(page: Page, baseURL: string, userId: string): Promise<Setup> {
  const jwt = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  const session = { Authorization: `Bearer ${jwt}`, Origin: new URL(baseURL).origin };
  await page.request.put(`/api/participants/${userId}`, {
    headers: session,
    data: { name: 'Webber Takken', color: '#f59e0b' },
  });
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const created = await page.request.post('/api/projects', {
    headers: session,
    data: {
      id,
      name: 'Payments',
      tabs: [
        {
          id: tabId,
          name: 'Board',
          elements: [ARRANGED_VIEW, PERSON_BOX],
        },
      ],
    },
  });
  expect(created.ok()).toBe(true);
  // The agent's API token, made on liveworkspace.app: the stack's accounts stand-in keeps it
  // (scripts/e2e-stack.mjs, packages/auth-client e2e-token-stand-in.ts).
  const minted = await page.request.post('/e2e/accounts/__seed/token', {
    data: { userId, email: WEBBER.email, name: 'agent' },
  });
  expect(minted.ok()).toBe(true);
  const { secret: token } = (await minted.json()) as { secret: string };
  return { id, tabId, token, session };
}

export async function agentSubmits(page: Page, s: Setup, body: unknown) {
  return page.request.post(`/api/projects/${s.id}/tabs/${s.tabId}/changesets`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-Liveplanner-Client': 'cli' },
    data: body,
  });
}

// The tab's stored element ids, in id order: the editor's saves may write them in another order.
export async function storedIds(page: Page, s: Setup): Promise<string[]> {
  const res = await page.request.get(`/api/projects/${s.id}/tabs/${s.tabId}`, {
    headers: { Authorization: `Bearer ${s.token}` },
  });
  const { tab } = (await res.json()) as { tab: { elements: { id: string }[] } };
  return tab.elements.map((e) => e.id).sort();
}

// Where a stored element sits across, or null when it is not stored.
export async function storedX(page: Page, s: Setup, id: string): Promise<number | null> {
  const res = await page.request.get(`/api/projects/${s.id}/tabs/${s.tabId}`, {
    headers: { Authorization: `Bearer ${s.token}` },
  });
  const { tab } = (await res.json()) as { tab: { elements: { id: string; x: number }[] } };
  return tab.elements.find((e) => e.id === id)?.x ?? null;
}

// Opens the project and waits for its room to greet the editor: from then on a changeset is relayed
// live (one that lands before is caught up by the join check, without a toast).
export async function open(page: Page, s: Setup) {
  await page.addInitScript(() => {
    localStorage.setItem('liveplanner:v2:name-confirmed', '1');
    localStorage.setItem('liveplanner:user-preferences:v1', JSON.stringify({ planTourSeen: true }));
  });
  const socket = page.waitForEvent('websocket', (ws) => ws.url().includes(`/projects/${s.id}/ws`));
  await page.goto(`/project/${s.id}`);
  const ws = await socket;
  await ws.waitForEvent('framereceived', (f) => String(f.payload).includes('"kind":"presence"'));
  await page.locator(CANVAS).waitFor();
  await expect(page.locator('[data-element-id="api"]')).toBeVisible();
}
