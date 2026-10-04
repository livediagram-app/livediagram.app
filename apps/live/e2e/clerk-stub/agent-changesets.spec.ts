import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { freshUserId, installClerkStub, type StubUser } from './clerk-stub';

// Agent changesets end to end (docs/specs/024-agents/agent-changesets.md; livediagram #343): a
// person has their own, unshared document open; their agent changes it with an API token. Before
// changesets the change never reached the editor and the person's next autosave erased it. Now it
// arrives live, outlined in their colour, with a toast; it survives their save; Ctrl+Z leaves it;
// the toast's Undo reverts it; and an element they have selected is refused to the agent.

test.use({ colorScheme: 'dark', viewport: { width: 1440, height: 860 } });

const CANVAS = '[data-canvas-a11y-root]';
const WEBBER: StubUser = {
  firstName: 'Webber',
  lastName: 'Takken',
  email: 'webber@example.com',
  hasImage: false,
  imageUrl: 'https://img.clerk.com/stub/default',
  externalAccounts: [],
};

type Setup = { id: string; tabId: string; token: string; session: Record<string, string> };

// Webber's personal document with one square, his participant row, and an API token for his agent.
async function arrange(page: Page, baseURL: string, userId: string): Promise<Setup> {
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

async function agentSubmits(page: Page, s: Setup, body: unknown) {
  return page.request.post(`/api/documents/${s.id}/tabs/${s.tabId}/changesets`, {
    headers: { Authorization: `Bearer ${s.token}`, 'X-Livediagram-Client': 'cli' },
    data: body,
  });
}

async function storedIds(page: Page, s: Setup): Promise<string[]> {
  const res = await page.request.get(`/api/documents/${s.id}/tabs/${s.tabId}`, {
    headers: { Authorization: `Bearer ${s.token}` },
  });
  const { tab } = (await res.json()) as { tab: { elements: { id: string }[] } };
  return tab.elements.map((e) => e.id);
}

// Opens the document and waits for its room to greet the editor: from then on a changeset is relayed
// live (one that lands before is caught up by the join check, without a toast).
async function open(page: Page, s: Setup) {
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

const paymentBox = {
  operations: [
    {
      op: 'add',
      element: {
        id: 'payments',
        type: 'shape',
        shape: 'square',
        x: 520,
        y: 200,
        width: 220,
        height: 80,
        label: 'Payment service',
      },
    },
  ],
  summary: 'add payment service',
};

test("an agent's changeset reaches the open editor, survives its save, and the toast's Undo reverts it", async ({
  page,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(90_000);
  const userId = freshUserId('webber');
  await installClerkStub(page, { ...WEBBER, id: userId });
  const s = await arrange(page, baseURL!, userId);
  await open(page, s);

  // The agent writes; the person sees it arrive, outlined, with a toast naming them.
  expect((await agentSubmits(page, s, paymentBox)).status()).toBe(200);
  await expect(page.getByText('Payment service', { exact: true })).toBeVisible();
  await expect(page.locator('[data-reveal-id="payments"]')).toBeVisible();
  const toast = page
    .getByRole('status')
    .filter({ hasText: 'Webber Takken changed 1 element: add payment service' });
  await expect(toast).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('agent-changeset-toast.png') });

  // Show frames what changed.
  await toast.getByRole('button', { name: "Show Webber Takken's changes" }).click();
  await expect(page.getByText('Payment service', { exact: true })).toBeInViewport();
  // The outline goes after its reveal time; the toast stays.
  await expect(page.locator('[data-reveal-id="payments"]')).toHaveCount(0, { timeout: 5_000 });
  await expect(toast).toBeVisible();

  // The person draws a square: their autosave keeps the agent's element.
  await page.mouse.click(1000, 600);
  await page.keyboard.press('r');
  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(1040, 580, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await expect.poll(() => storedIds(page, s), { timeout: 10_000 }).toHaveLength(3);
  expect(await storedIds(page, s)).toContain('payments');

  // Ctrl+Z undoes the person's own square, never the agent's change.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => storedIds(page, s), { timeout: 10_000 }).toEqual(['api', 'payments']);
  await expect(page.getByText('Payment service', { exact: true })).toBeVisible();

  // The toast's Undo reverts the changeset, for the person and in storage.
  await toast.getByRole('button', { name: "Undo Webber Takken's changes" }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Undone/ })).toBeVisible();
  await expect(page.getByText('Payment service', { exact: true })).toHaveCount(0);
  await expect.poll(() => storedIds(page, s), { timeout: 10_000 }).toEqual(['api']);
  expect(pageErrors).toEqual([]);
});

test('an element the person has selected is held from the agent', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(60_000);
  const userId = freshUserId('webber');
  await installClerkStub(page, { ...WEBBER, id: userId });
  const s = await arrange(page, baseURL!, userId);
  // A second session of someone else would hold it; the owner's own selection never does, so the
  // person here opens the document as an edit-link visitor.
  const share = await page.request.post(`/api/documents/${s.id}/share`, {
    headers: s.session,
    data: { role: 'edit' },
  });
  const { link } = (await share.json()) as { link: { code: string } };
  const visitor = await page.context().browser()!.newContext({ baseURL, colorScheme: 'dark' });
  const bea = await visitor.newPage();
  await bea.addInitScript(() => localStorage.setItem('livediagram:v2:name-confirmed', '1'));
  await bea.goto(`/document/shared?s=${link.code}`);
  const join = bea.getByRole('button', { name: /^join$/i });
  if (await join.isVisible({ timeout: 5_000 }).catch(() => false)) await join.click();
  await bea.locator(CANVAS).waitFor();
  await bea.locator('[data-element-id="api"]').click();

  await expect
    .poll(
      async () =>
        (
          await agentSubmits(page, s, {
            operations: [{ op: 'set', target: 'api', fields: { label: 'Gateway' } }],
          })
        ).status(),
      {
        timeout: 10_000,
      },
    )
    .toBe(409);
  const refused = await agentSubmits(page, s, {
    operations: [{ op: 'set', target: 'api', fields: { label: 'Gateway' } }],
  });
  expect(await refused.json()).toMatchObject({ error: 'elements_held', held: [{ id: 'api' }] });
  await visitor.close();
  expect(pageErrors).toEqual([]);
});
