import { devices } from '@playwright/test';
import { adoptGuest, documentHeaders, expect, mintGuest, serverNewUrl, test } from './fixtures';

// A tap on Join leaves no tooltip behind (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md, "Opens
// instantly on keyboard focus"): the Join dialog closing hands focus back, and on a phone that focus is not keyboard
// focus, so no hint opens. Work Tracker #465.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';
const HINT = '[data-hint]';

test('tapping Join on a phone leaves no tooltip showing', async ({ page, browser, baseURL }) => {
  test.setTimeout(60_000);
  const owner = await mintGuest(page.request);
  const ownerCtx = await browser.newContext({
    baseURL: baseURL!,
    viewport: { width: 1440, height: 860 },
  });
  await adoptGuest(ownerCtx, owner);
  await ownerCtx.addInitScript(() => localStorage.setItem('livehuddle:v2:name-confirmed', '1'));
  const ownerPage = await ownerCtx.newPage();
  await ownerPage.goto(await serverNewUrl(ownerPage, '/new?template=team-pod'));
  await ownerPage.locator(CANVAS).waitFor({ timeout: 30_000 });
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

  const { defaultBrowserType: _unused, ...phone } = devices['iPhone 13'];
  const ctx = await browser.newContext({
    ...phone,
    baseURL: baseURL!,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const guest = await ctx.newPage();
  await guest.goto(`/document/shared?s=${code}`);
  const join = guest.getByRole('button', { name: /^join$/i });
  const at = (await join.boundingBox())!;
  await join.tap();
  // A phone follows the tap with a mouse event at the finger, on whatever the closed dialog left there (Settings sits
  // under Join on a phone). Playwright's tap sends none, so send it.
  await guest.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await guest.locator(CANVAS).waitFor();
  // Past the hint's open delay and its close grace: nothing may be showing.
  await guest.waitForTimeout(1500);
  await expect(guest.locator(HINT)).toHaveCount(0);
  await guest.screenshot({ path: test.info().outputPath('after-join-phone.png') });

  await ctx.close();
  await ownerCtx.close();
});
