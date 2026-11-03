import type { Browser, Locator, Page } from '@playwright/test';
import { adoptGuest, documentHeaders, expect, mintGuest, serverNewUrl, test } from './fixtures';

// A Space walked by two people (docs/specs/003-system-architecture/e2e-smoke.md "The smoke"): a Spaces template opens
// walking as it lands (docs/specs/008-canvas/avatar-mode.md), a second person joins from a share link and walks in
// too, and each sees the other's character move as they steer with the arrows. The relay between them is the room's
// avatar fan-out (@liveworkspace/api-kit/room-presence-relay), so this is the one browser check of it end to end.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';
// A Spaces template: a small pod with a Walk In entrance (packages/templates template-builders-spaces.ts).
const SPACE = 'team-pod';

async function personIn(browser: Browser, baseURL: string, owner: string | null): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(
    ({ o }) => {
      // The owner has a name; the second person gives theirs in the Join dialog.
      if (o) localStorage.setItem('livehuddle:v2:name-confirmed', '1');
      // The Workshop tour stays away; its overlay would take the arrows.
      localStorage.setItem(
        'livehuddle:user-preferences:v1',
        JSON.stringify({ workshopTourSeen: true }),
      );
    },
    { o: owner },
  );
  return ctx.newPage();
}

const self = (page: Page) => page.locator('[data-avatar="self"]');
const peer = (page: Page) => page.locator('[data-avatar="peer"]');

async function leftOf(avatar: Locator): Promise<number> {
  return avatar.evaluate((el) => parseFloat((el as HTMLElement).style.left));
}

// Steer with an arrow held down for a moment, as a person walks.
async function walkRight(page: Page): Promise<void> {
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
}

test('two people walk a Space and each sees the other move', async ({ page, browser, baseURL }) => {
  test.setTimeout(60_000);
  const owner = await mintGuest(page.request);
  const ownerPage = await personIn(browser, baseURL!, owner);
  await ownerPage.goto(await serverNewUrl(ownerPage, `/new?template=${SPACE}`));
  await ownerPage.locator(CANVAS).waitFor({ timeout: 30_000 });
  // A Spaces template opens walking as it lands.
  await expect(self(ownerPage)).toHaveCount(1, { timeout: 15_000 });
  await expect(ownerPage).toHaveURL(/\/document\/[^/?]+/);
  const id = new URL(ownerPage.url()).pathname.split('/').filter(Boolean).pop()!;

  const headers = await documentHeaders(page.request, owner, id, {
    Origin: new URL(baseURL!).origin,
  });
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'edit' },
  });
  expect(share.ok(), `share: ${share.status()}`).toBe(true);
  const code = ((await share.json()) as { link: { code: string } }).link.code;
  // The owner's page learns of the link it was shared by on its next open, as after sharing from the Share dialog and
  // coming back: presence goes out only on a shared Space. The Space opens walking again.
  await ownerPage.reload();
  await ownerPage.locator(CANVAS).waitFor();
  await expect(self(ownerPage)).toHaveCount(1, { timeout: 15_000 });

  const guestPage = await personIn(browser, baseURL!, null);
  await guestPage.goto(`/document/shared?s=${code}`);
  await guestPage.getByRole('button', { name: /^join$/i }).click();
  await guestPage.locator(CANVAS).waitFor();
  // The Space opens walking for the second person too, and each sees the other's character.
  await expect(self(guestPage)).toHaveCount(1, { timeout: 15_000 });
  await expect(peer(ownerPage)).toHaveCount(1, { timeout: 15_000 });
  await expect(peer(guestPage)).toHaveCount(1, { timeout: 15_000 });

  // The owner walks right: the guest sees the owner's character move.
  const ownerSeenAt = await leftOf(peer(guestPage));
  await walkRight(ownerPage);
  await expect
    .poll(() => leftOf(peer(guestPage)), { timeout: 10_000 })
    .toBeGreaterThan(ownerSeenAt + 20);

  // And the other way round.
  const guestSeenAt = await leftOf(peer(ownerPage));
  await walkRight(guestPage);
  await expect
    .poll(() => leftOf(peer(ownerPage)), { timeout: 10_000 })
    .toBeGreaterThan(guestSeenAt + 20);

  // Each side as its person sees it, for the report.
  await ownerPage.screenshot({ path: test.info().outputPath('owner.png') });
  await guestPage.screenshot({ path: test.info().outputPath('guest.png') });

  await ownerPage.context().close();
  await guestPage.context().close();
});
