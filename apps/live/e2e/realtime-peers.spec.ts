import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Two people on one shared document (docs/specs/012-collaboration/realtime-conflict-resolution.md): each sees
// the other online, an edit reaches the other side live, the autosave keeps everyone's edits (a peer's is
// never saved back over or reverted), and a walking avatar shows on the other screen
// (docs/specs/008-canvas/avatar-mode.md).

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

async function openAs(
  browser: Browser,
  baseURL: string,
  url: string,
  owner: string | null,
): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  await ctx.addInitScript((o) => {
    if (o) {
      localStorage.setItem('livediagram:v2:self-id', o);
      localStorage.setItem('livediagram:v2:name-confirmed', '1');
    }
    localStorage.setItem(
      'livediagram:user-preferences:v1',
      JSON.stringify({ panelLayout: 'toolbar' }),
    );
  }, owner);
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

async function declineTour(page: Page): Promise<void> {
  const decline = page.getByRole('button', { name: /^no thanks$/i }).first();
  if (await decline.isVisible().catch(() => false)) await decline.click();
}

const squares = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /Square/ });

test('two peers see each other, edit live, and every edit is kept', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = crypto.randomUUID();
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const headers = { 'X-Owner-Id': owner, Origin: new URL(baseURL!).origin };
  const seeded = await page.request.post(`${apiBase}/documents`, {
    headers,
    data: {
      id,
      name: 'Room',
      tabs: [
        {
          id: tabId,
          name: 'Board',
          elements: [
            { id: 'a', type: 'shape', shape: 'square', x: 100, y: 100, width: 200, height: 100 },
          ],
        },
      ],
    },
  });
  expect(seeded.ok()).toBe(true);
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'edit' },
  });
  const code = ((await share.json()) as { link: { code: string } }).link.code;

  const ownerPage = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await ownerPage.locator(CANVAS).waitFor();
  const peerPage = await openAs(browser, baseURL!, `/document/shared?s=${code}`, null);
  await peerPage.getByRole('button', { name: /^join$/i }).click();
  await peerPage.locator(CANVAS).waitFor();
  await declineTour(ownerPage);
  await declineTour(peerPage);

  // Presence: the owner sees two people online, the peer among them.
  const online = ownerPage.locator('[role="img"][aria-label$="(Online)"]');
  await expect.poll(() => online.count()).toBeGreaterThanOrEqual(2);

  // A peer's edit reaches the owner live.
  await peerPage
    .getByRole('button', { name: 'Add square', exact: true })
    .first()
    .dragTo(peerPage.locator(CANVAS), { targetPosition: { x: 700, y: 500 } });
  await peerPage.keyboard.press('Escape');
  await expect(squares(ownerPage)).toHaveCount(2);

  // The owner edits too; the autosave keeps both, and a reload shows both.
  await ownerPage
    .getByRole('button', { name: 'Add square', exact: true })
    .first()
    .dragTo(ownerPage.locator(CANVAS), { targetPosition: { x: 300, y: 600 } });
  await ownerPage.keyboard.press('Escape');
  await expect
    .poll(async () => {
      const res = await ownerPage.request.get(`${apiBase}/documents/${id}/tabs/${tabId}`, {
        headers,
      });
      return res.ok()
        ? (((await res.json()) as { tab?: { elements?: unknown[] } }).tab?.elements?.length ?? 0)
        : 0;
    })
    .toBe(3);
  await ownerPage.reload();
  await ownerPage.locator(CANVAS).waitFor();
  await expect(squares(ownerPage)).toHaveCount(3);

  // The peer walks as an avatar; the owner sees the character.
  await peerPage.getByRole('button', { name: 'Selection mode' }).click();
  await peerPage.getByText('Avatar', { exact: true }).first().click();
  await peerPage.locator(CANVAS).click({ position: { x: 900, y: 300 } });
  await expect(ownerPage.locator('[data-avatar="peer"]')).toHaveCount(1);

  await ownerPage.context().close();
  await peerPage.context().close();
});
