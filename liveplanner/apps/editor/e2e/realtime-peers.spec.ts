import type { Browser, Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  test,
  guestSigFor,
  mintSignedGuest,
  ownerHeaders,
  paletteTile,
} from './fixtures';

// Two people on one shared project (docs/specs/012-collaboration/realtime-conflict-resolution.md): each sees
// the other online, an edit reaches the other side live, the autosave keeps everyone's edits (a peer's is
// never saved back over or reverted).

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

async function openAs(
  browser: Browser,
  baseURL: string,
  url: string,
  owner: string | null,
): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  await ctx.addInitScript(
    ({ o, sig }) => {
      if (o) {
        localStorage.setItem('liveplanner:v2:self-id', o);
        if (sig) localStorage.setItem('liveplanner:v2:self-sig', sig);
        localStorage.setItem('liveplanner:v2:name-confirmed', '1');
      }
    },
    { o: owner, sig: owner ? guestSigFor(owner) : null },
  );
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

const squares = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /Square/ });

test('two peers see each other, edit live, and every edit is kept', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await mintSignedGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const headers = ownerHeaders(owner, { Origin: new URL(baseURL!).origin });
  const seeded = await page.request.post(`${apiBase}/projects`, {
    headers,
    data: {
      id,
      name: 'Room',
      tabs: [
        {
          id: tabId,
          name: 'Board',
          opensIn: 'diagram',
          elements: [
            { id: 'a', type: 'shape', shape: 'square', x: 100, y: 100, width: 200, height: 100 },
          ],
        },
      ],
    },
  });
  expect(seeded.ok()).toBe(true);
  const share = await page.request.post(`${apiBase}/projects/${id}/share`, {
    headers,
    data: { role: 'edit' },
  });
  const code = ((await share.json()) as { link: { code: string } }).link.code;

  const ownerPage = await openAs(browser, baseURL!, `/project/${id}`, owner);
  await ownerPage.locator(CANVAS).waitFor();
  const peerPage = await openAs(browser, baseURL!, `/project/shared?s=${code}`, null);
  await peerPage.getByRole('button', { name: /^join$/i }).click();
  await peerPage.locator(CANVAS).waitFor();
  await dismissQuickTour(ownerPage);
  await dismissQuickTour(peerPage);

  // Presence: the owner sees two people online, the peer among them.
  const online = ownerPage.locator('[role="img"][aria-label$="(Online)"]');
  await expect.poll(() => online.count()).toBeGreaterThanOrEqual(2);

  // A peer's edit reaches the owner live.
  await (
    await paletteTile(peerPage, 'Add Square')
  ).dragTo(peerPage.locator(CANVAS), { targetPosition: { x: 700, y: 500 } });
  await peerPage.keyboard.press('Escape');
  await expect(squares(ownerPage)).toHaveCount(2);

  // The owner edits too; the autosave keeps both, and a reload shows both.
  await (
    await paletteTile(ownerPage, 'Add Square')
  ).dragTo(ownerPage.locator(CANVAS), {
    targetPosition: { x: 300, y: 600 },
  });
  await ownerPage.keyboard.press('Escape');
  await expect
    .poll(async () => {
      const res = await ownerPage.request.get(`${apiBase}/projects/${id}/tabs/${tabId}`, {
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

  await ownerPage.context().close();
  await peerPage.context().close();
});
