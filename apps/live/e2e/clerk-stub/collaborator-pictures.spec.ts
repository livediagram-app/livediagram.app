import type { Browser, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { freshUserId, installClerkStub, STUB_PICTURE_SVG, type StubUser } from './clerk-stub';

// Pictures between people (docs/specs/014-identity/profile-picture.md §5, §6), end to end: a real
// document, a real realtime room and the api verifying each stub account's session token. Ann has
// a picture. Bob, signed in, opens her share link and sees it on her presence avatar, her cursor
// and her comment. An anonymous visitor on the same link sees her initials, and their browser is
// never even given the URL. Ann turning the switch off takes it off Bob's screen at once.

const CANVAS = '[data-canvas-a11y-root]';
const ANN_PICTURE = 'https://img.clerk.com/stub/ann';

const ANN: StubUser = {
  firstName: 'Ann',
  lastName: 'Lee',
  email: 'ann@example.com',
  hasImage: true,
  imageUrl: 'https://img.clerk.com/stub/ann-copied',
  externalAccounts: [{ provider: 'google', imageUrl: ANN_PICTURE }],
};
const BOB: StubUser = {
  firstName: 'Bob',
  lastName: 'Ray',
  email: 'bob@example.com',
  hasImage: false,
  imageUrl: 'https://img.clerk.com/stub/default',
  externalAccounts: [],
};

async function tokenFor(page: Page, sub: string): Promise<string> {
  return (await page.request.get(`/e2e/token?sub=${sub}`)).text();
}

// A browser for one person: the stub (or nobody signed in), pictures served, requests recorded.
async function personPage(browser: Browser, baseURL: string, who: StubUser | null) {
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 860 },
    colorScheme: 'dark',
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:user-preferences:v1', JSON.stringify({ tourSeen: true }));
  });
  const pictureRequests: string[] = [];
  await ctx.route('https://img.clerk.com/stub/**', (route) => {
    pictureRequests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: STUB_PICTURE_SVG });
  });
  const page = await ctx.newPage();
  await installClerkStub(page, who);
  return { page, pictureRequests, close: () => ctx.close() };
}

async function joinShared(page: Page, code: string): Promise<void> {
  await page.goto(`/document/shared?s=${code}`);
  const join = page.getByRole('button', { name: /^join$/i });
  if (await join.isVisible({ timeout: 5_000 }).catch(() => false)) await join.click();
  await page.locator(CANVAS).waitFor();
}

const annAvatar = (page: Page) => page.getByRole('img', { name: /^Ann Lee \(/ }).first();

test('signed-in collaborators see the picture; anonymous visitors see initials', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  // Fresh accounts every run: the stack's D1 keeps Ann's switch from the last one.
  const ANN_ID = freshUserId('ann');
  const BOB_ID = freshUserId('bob');
  // Arrange: Ann's participant row, a document holding her comment, and an edit link.
  const auth = { Authorization: `Bearer ${await tokenFor(page, ANN_ID)}` };
  const origin = { Origin: new URL(baseURL!).origin };
  expect(
    (
      await page.request.put(`/api/participants/${ANN_ID}`, {
        headers: { ...auth, ...origin },
        data: { name: 'Ann Lee', color: '#ec4899' },
      })
    ).ok(),
  ).toBe(true);
  const id = crypto.randomUUID();
  const created = await page.request.post('/api/documents', {
    headers: { ...auth, ...origin },
    data: {
      id,
      name: 'Pictures',
      tabs: [
        {
          id: crypto.randomUUID(),
          name: 'Board',
          elements: [
            {
              id: 'pin',
              type: 'shape',
              shape: 'comment-pin',
              x: 520,
              y: 160,
              width: 300,
              height: 220,
              commentThread: {
                resolved: false,
                comments: [
                  {
                    id: 'c1',
                    text: 'Framing looks right now.',
                    createdAt: Date.now(),
                    authorName: 'Ann Lee',
                    authorColor: '#ec4899',
                    authorId: ANN_ID,
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  });
  expect(created.ok()).toBe(true);
  const share = await page.request.post(`/api/documents/${id}/share`, {
    headers: { ...auth, ...origin },
    data: { role: 'edit' },
  });
  const code = ((await share.json()) as { link: { code: string } }).link.code;

  // Ann opens her document: her picture is published to her participant record.
  const ann = await personPage(browser, baseURL!, { ...ANN, id: ANN_ID });
  await ann.page.goto(`/document/${id}`);
  await ann.page.locator(CANVAS).waitFor();
  const bobAuth = { Authorization: `Bearer ${await tokenFor(page, BOB_ID)}` };
  await expect
    .poll(async () => {
      const res = await page.request.get(`/api/participants/${ANN_ID}`, { headers: bobAuth });
      return ((await res.json()) as { participant: { pictureUrl: string | null } }).participant
        .pictureUrl;
    })
    .toBe(ANN_PICTURE);

  // Bob, signed in, joins by the link: Ann's presence avatar and comment carry her picture.
  const bob = await personPage(browser, baseURL!, { ...BOB, id: BOB_ID });
  await joinShared(bob.page, code);
  await expect(annAvatar(bob.page).locator('xpath=..').locator('img')).toHaveAttribute(
    'src',
    `${ANN_PICTURE}?width=96&height=96`,
  );
  const comment = bob.page.locator(CANVAS).getByText('Framing looks right now.');
  await expect(comment).toBeVisible();
  await expect(
    bob.page.locator(`${CANVAS} [data-avatar-state="picture"] img[src^="${ANN_PICTURE}?"]`).first(),
  ).toBeVisible();

  // Ann moves over the canvas: her cursor on Bob's screen leads with her picture.
  const box = (await ann.page.locator(CANVAS).boundingBox())!;
  await ann.page.mouse.move(box.x + 300, box.y + 300);
  await ann.page.mouse.move(box.x + 340, box.y + 320, { steps: 5 });
  // The name pill (RemoteCursor): the one absolutely placed span naming her that holds a picture.
  await expect(
    bob.page
      .locator(`span.absolute:has(img[src^="${ANN_PICTURE}?"])`, { hasText: 'Ann Lee' })
      .first(),
  ).toBeVisible();

  // An anonymous visitor on the same link: initials, and not one request for her picture.
  const visitor = await personPage(browser, baseURL!, null);
  await joinShared(visitor.page, code);
  await expect(annAvatar(visitor.page)).toBeVisible();
  await expect(annAvatar(visitor.page).locator('xpath=..').locator('img')).toHaveCount(0);
  await visitor.page.waitForTimeout(1_000);
  expect(visitor.pictureRequests.filter((u) => u.startsWith(ANN_PICTURE))).toEqual([]);

  // Ann turns the switch off: Bob's roster drops her picture on the next presence update.
  await ann.page.evaluate(() => {
    const key = 'livediagram:user-preferences:v1';
    const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
    localStorage.setItem(key, JSON.stringify({ ...prefs, showProfilePicture: false }));
    window.dispatchEvent(new Event('livediagram:preferences-changed'));
  });
  await expect(annAvatar(bob.page).locator('xpath=..').locator('img')).toHaveCount(0);

  await Promise.all([ann.close(), bob.close(), visitor.close()]);
});
