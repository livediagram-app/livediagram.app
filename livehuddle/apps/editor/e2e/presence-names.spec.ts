import type { Browser, Page } from '@playwright/test';
import {
  adoptGuest,
  documentHeaders,
  expect,
  markModeToursSeen,
  mintGuest,
  seedDocumentItem,
  test,
} from './fixtures';

// Presence names (docs/specs/014-identity/auth-and-guest-access.md "Presence names"; Work Tracker 797 and 801): the
// room picks every name. A visitor who types a name in the join dialog is seen by it on the owner's screen, and a
// reload keeps it, because the room reads it from their profile rather than from what their hello says.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

async function openAs(
  browser: Browser,
  baseURL: string,
  url: string,
  guest: string,
  confirmed: boolean,
): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  await adoptGuest(ctx, guest);
  if (confirmed) {
    await ctx.addInitScript(() => localStorage.setItem('livehuddle:v2:name-confirmed', '1'));
  }
  await markModeToursSeen(ctx);
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

// An avatar in the owner's presence stack, by the name a screen reader hears ("Grace (Online)").
const avatarNamed = (page: Page, name: string) =>
  page.locator(`[role="img"][aria-label^="${name} ("]`);

test("a visitor's typed join name reaches the owner, and a reload keeps it", async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await mintGuest(page.request);
  const visitor = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedDocumentItem(page.request, owner, {
    id,
    name: 'Names',
    tabs: [{ id: crypto.randomUUID(), name: 'Board', elements: [] }],
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

  const ownerPage = await openAs(browser, baseURL!, `/document/${id}`, owner, true);
  await ownerPage.locator(CANVAS).waitFor();
  const visitorPage = await openAs(browser, baseURL!, `/document/shared?s=${code}`, visitor, false);
  const nameField = visitorPage.getByRole('textbox', { name: 'Your name' });
  await nameField.fill('Grace Hopper');
  await visitorPage.getByRole('button', { name: /^join$/i }).click();
  await visitorPage.locator(CANVAS).waitFor();

  // The owner sees the typed name, not the guest's first random one.
  await expect(avatarNamed(ownerPage, 'Grace Hopper').first()).toBeVisible({ timeout: 15_000 });

  // A reload: the visitor's editor says hello with whatever it holds, and the room still shows their profile's name.
  await visitorPage.reload();
  await visitorPage.locator(CANVAS).waitFor();
  await expect(avatarNamed(ownerPage, 'Grace Hopper').first()).toBeVisible({ timeout: 15_000 });

  await ownerPage.context().close();
  await visitorPage.context().close();
});
