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
  markModeToursSeen,
} from './fixtures';

// Two people on one shared document (docs/specs/012-collaboration/realtime-conflict-resolution.md): each sees
// the other online, an edit reaches the other side live, the autosave keeps everyone's edits (a peer's is
// never saved back over or reverted), and a walking avatar shows on the other screen
// (docs/specs/008-canvas/avatar-mode.md).

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

// The strip's Edit | Walk toggle (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle").
const editToggle = (page: Page, side: 'Edit' | 'Walk') =>
  page
    .getByRole('group', { name: 'Edit or Walk' })
    .getByRole('button', { name: side, exact: true });

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
    },
    { o: owner },
  );
  // The Receptionist's welcome and the element tours open over the board; their bubbles would take the presses.
  await markModeToursSeen(ctx);
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

// The seeded square and the sticky notes each peer adds.
const squares = (page: Page) =>
  page.locator(CANVAS).getByRole('img', { name: /^(Square|Sticky note)$/ });

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
          { id: 'a', type: 'sticky', x: 100, y: 100, width: 200, height: 100 },
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
  // The tab offers the walk, so both open walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"), the strip
  // the avatar palette: both Editors switch to Edit to build.
  for (const p of [ownerPage, peerPage]) await editToggle(p, 'Edit').click();

  // Presence: the owner sees two people online, the peer among them.
  const online = ownerPage.locator('[role="img"][aria-label$="(Online)"]');
  await expect.poll(() => online.count()).toBeGreaterThanOrEqual(2);

  // A peer's edit reaches the owner live.
  await (
    await paletteTile(peerPage, 'Add Sticky Note')
  ).dragTo(peerPage.locator(CANVAS), { targetPosition: { x: 700, y: 500 } });
  await peerPage.keyboard.press('Escape');
  await expect(squares(ownerPage)).toHaveCount(2);

  // The owner edits too; the autosave keeps both, and a reload shows both.
  await (
    await paletteTile(ownerPage, 'Add Sticky Note')
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
  await editToggle(peerPage, 'Walk').click();
  await peerPage.locator(CANVAS).click({ position: { x: 900, y: 300 } });
  await expect(ownerPage.locator('[data-avatar="peer"]')).toHaveCount(1);

  await ownerPage.context().close();
  await peerPage.context().close();
});
