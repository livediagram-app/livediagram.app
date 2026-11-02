import type { Browser, Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  test,
  adoptGuest,
  mintGuest,
  documentHeaders,
  seedDocumentItem,
  paletteTile,
} from './fixtures';

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
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(
    ({ o }) => {
      if (o) {
        localStorage.setItem('livehuddle:v2:name-confirmed', '1');
      }
      // The Workshop tour offers itself over the board (fixtures openBlankSession); its overlay would take the presses.
      localStorage.setItem(
        'livehuddle:user-preferences:v1',
        JSON.stringify({ workshopTourSeen: true }),
      );
    },
    { o: owner },
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
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const seeded = await seedDocumentItem(page.request, owner, {
    id,
    name: 'Room',
    tabs: [
      {
        id: tabId,
        name: 'Board',
        opensIn: 'workshop',
        elements: [
          { id: 'a', type: 'shape', shape: 'square', x: 100, y: 100, width: 200, height: 100 },
          // Avatar mode's one way in (docs/specs/008-canvas/avatar-mode.md "Where it lives").
          {
            id: 'walk',
            type: 'shape',
            shape: 'mode-button',
            mode: 'avatar',
            label: 'Walk In',
            x: 400,
            y: 100,
            width: 120,
            height: 120,
          },
        ],
      },
    ],
  });
  expect(seeded.ok()).toBe(true);
  const headers = await documentHeaders(page.request, owner, id, {
    Origin: new URL(baseURL!).origin,
  });
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
      const res = await ownerPage.request.get(`${apiBase}/documents/${id}/tabs/${tabId}`, {
        headers,
      });
      return res.ok()
        ? (((await res.json()) as { tab?: { elements?: unknown[] } }).tab?.elements?.length ?? 0)
        : 0;
    })
    .toBe(4);
  await ownerPage.reload();
  await ownerPage.locator(CANVAS).waitFor();
  await expect(squares(ownerPage)).toHaveCount(3);

  // The peer walks as an avatar; the owner sees the character.
  await peerPage.getByRole('button', { name: /switch to Avatar mode/ }).click();
  await peerPage.locator(CANVAS).click({ position: { x: 900, y: 300 } });
  await expect(ownerPage.locator('[data-avatar="peer"]')).toHaveCount(1);

  await ownerPage.context().close();
  await peerPage.context().close();
});
