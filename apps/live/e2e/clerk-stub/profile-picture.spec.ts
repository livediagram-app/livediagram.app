import type { Locator, Page, Route } from '@playwright/test';
import { test, expect, expectNoPageErrors } from '../fixtures';
import {
  clerkTargetPicture,
  installClerkStub,
  STUB_PICTURE_SVG,
  TARGET_RIM,
  type StubUser,
} from './clerk-stub';

// The account avatar end to end (docs/specs/014-identity/profile-picture.md), against the
// Clerk-enabled export with a stubbed signed-in user: the Google picture in the header trigger
// and the Settings identity card, the initial without one, the initial again when it fails,
// and the avatar's box unmoved through every state.

test.use({ colorScheme: 'dark' });

const PICTURES = 'https://img.clerk.com/stub/**';
const GOOGLE_PICTURE = 'https://img.clerk.com/stub/google';

const WEBBER: StubUser = {
  firstName: 'Webber',
  lastName: 'Takken',
  email: 'webber@example.com',
  hasImage: true,
  imageUrl: 'https://img.clerk.com/stub/copied-at-sign-up',
  externalAccounts: [{ provider: 'google', imageUrl: GOOGLE_PICTURE }],
};

const trigger = (page: Page) => page.getByRole('button', { name: 'Account menu' });
const avatarIn = (host: Locator) => host.locator('[data-avatar-state]');

// Holds every picture request until `release`, so the loading state can be measured.
function holdPictures(page: Page) {
  const held: Route[] = [];
  const referers: (string | undefined)[] = [];
  const urls: string[] = [];
  let released: 'serve' | 'fail' | null = null;
  const answer = (route: Route) =>
    released === 'fail'
      ? route.abort('failed')
      : route.fulfill({ status: 200, contentType: 'image/svg+xml', body: STUB_PICTURE_SVG });
  const ready = page.route(PICTURES, (route) => {
    referers.push(route.request().headers()['referer']);
    urls.push(route.request().url());
    if (!released) {
      held.push(route);
      return;
    }
    return answer(route);
  });
  return {
    ready,
    referers,
    urls,
    async release(how: 'serve' | 'fail') {
      released = how;
      await Promise.all(held.splice(0).map(answer));
    },
  };
}

test('draws the Google picture in the header and the identity card, without moving', async ({
  page,
  pageErrors,
}) => {
  const pictures = holdPictures(page);
  await pictures.ready;
  await installClerkStub(page, WEBBER);
  await page.goto('/explorer/timeline');

  const avatar = avatarIn(trigger(page));
  await expect(avatar).toHaveAttribute('data-avatar-state', 'loading');
  const loadingBox = await trigger(page).boundingBox();
  const loadingAvatarBox = await avatar.boundingBox();

  await pictures.release('serve');
  await expect(avatar).toHaveAttribute('data-avatar-state', 'picture');
  expect(await trigger(page).boundingBox()).toEqual(loadingBox);
  expect(await avatar.boundingBox()).toEqual(loadingAvatarBox);
  expect(loadingAvatarBox).toMatchObject({ width: 20, height: 20 });

  // The Google account's picture, cropped to 96px, fetched with no referrer.
  // Size only, never a crop (docs/specs/014-identity/profile-picture.md §2).
  expect(pictures.urls[0]).toBe(`${GOOGLE_PICTURE}?width=96&height=96`);
  expect(pictures.referers.every((r) => r === undefined)).toBe(true);

  await trigger(page).click();
  await page.getByRole('menuitem', { name: 'Account' }).click();
  const card = page.getByRole('dialog').locator('[data-avatar-state]').first();
  await expect(card).toHaveAttribute('data-avatar-state', 'picture');
  // Polled: the dialog scales in, and the box is only true once it has settled.
  await expect.poll(async () => await card.boundingBox()).toMatchObject({ width: 44, height: 44 });
  // One size for both surfaces: the card reuses the header's download.
  expect(new Set(pictures.urls).size).toBe(1);

  expectNoPageErrors(pageErrors);
});

test('keeps the initial when there is no picture, and asks for none', async ({
  page,
  pageErrors,
}) => {
  const pictures = holdPictures(page);
  await pictures.ready;
  await installClerkStub(page, { ...WEBBER, hasImage: false, externalAccounts: [] });
  await page.goto('/explorer/timeline');

  const avatar = avatarIn(trigger(page));
  await expect(avatar).toHaveAttribute('data-avatar-state', 'initial');
  await expect(avatar).toHaveText('W');
  await expect(avatar.locator('img')).toHaveCount(0);
  expect(pictures.urls).toEqual([]);

  expectNoPageErrors(pageErrors);
});

test('falls back to the initial when the picture fails, without moving', async ({
  page,
  pageErrors,
}) => {
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text());
  });
  const pictures = holdPictures(page);
  await pictures.ready;
  await installClerkStub(page, WEBBER);
  await page.goto('/explorer/timeline');

  const avatar = avatarIn(trigger(page));
  await expect(avatar).toHaveAttribute('data-avatar-state', 'loading');
  const loadingBox = await trigger(page).boundingBox();

  await pictures.release('fail');
  await expect(avatar).toHaveAttribute('data-avatar-state', 'initial');
  await expect(avatar).toHaveText('W');
  expect(await trigger(page).boundingBox()).toEqual(loadingBox);
  expect(warnings.some((w) => w.startsWith('[profile-picture] load failed'))).toBe(true);

  expectNoPageErrors(pageErrors);
});

// Framing (docs/specs/014-identity/profile-picture.md §2): the disc shows the whole picture, as
// Google frames it. Against a stub that answers like Clerk, a `fit=crop` request would come back
// as a band the disc crops again, and the edge of the disc would show the green ring, not the rim.
test('frames the picture as its source does, crisp at 2x', async ({ browser, pageErrors }) => {
  const context = await browser.newContext({ deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const requested: string[] = [];
  await page.route(PICTURES, (route) => {
    requested.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: clerkTargetPicture(route.request().url()),
    });
  });
  await installClerkStub(page, WEBBER);
  await page.goto('/explorer/timeline');
  await trigger(page).click();
  await page.getByRole('menuitem', { name: 'Account' }).click();
  const card = page.getByRole('dialog').locator('[data-avatar-state]').first();
  await expect(card).toHaveAttribute('data-avatar-state', 'picture');
  await expect.poll(async () => await card.boundingBox()).toMatchObject({ width: 44, height: 44 });

  // At 2x the 44px disc needs 88 device pixels: the browser takes the 96px source, never a crop.
  expect(requested.every((u) => !u.includes('fit='))).toBe(true);
  const img = card.locator('img');
  expect(await img.evaluate((el: HTMLImageElement) => el.currentSrc)).toContain('width=96');

  // The rim sits in the outer fifth of the picture; 4 CSS px inside the disc's left edge, on its
  // horizontal centre line, is well inside it when the framing is right.
  const shot = await card.screenshot();
  const edge = await page.evaluate(async (png: string) => {
    const bitmap = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${png}`)).blob(),
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const px = ctx.getImageData(8, Math.floor(bitmap.height / 2), 1, 1).data;
    return { r: px[0] ?? 0, g: px[1] ?? 0, b: px[2] ?? 0 };
  }, shot.toString('base64'));
  expect(Math.abs(edge.r - TARGET_RIM.r)).toBeLessThan(24);
  expect(Math.abs(edge.g - TARGET_RIM.g)).toBeLessThan(24);
  expect(Math.abs(edge.b - TARGET_RIM.b)).toBeLessThan(24);

  await context.close();
  expectNoPageErrors(pageErrors);
});
