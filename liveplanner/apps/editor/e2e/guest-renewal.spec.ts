import {
  test,
  createInMode,
  expect,
  expectNoPageErrors,
  guestTokenFor,
  mintGuest,
} from './fixtures';

// A guest whose token is about to lapse renews it (liveworkspace/docs/specs/003-accounts/accounts.md "Renewing without
// the cookie"). Safari can clear the accounts site's `lw_guest` cookie, so the page presents the token it holds as
// proof of the guest, and the guest keeps their id. The round trip (the api's page posting the token on, the accounts
// site's 303, the hand-back to /auth/guest) takes no history entry, so Back from the page it opens lands on the page
// before, never on the renewal and never on a second /new that would make another plan. Runs in Chromium and Firefox
// (playwright.config.ts): their redirect, form-post and cookie rules differ.

const GUEST_KEY = 'liveplanner:v2:guest-token';
const THIS_BROWSER_KEY = 'liveworkspace:this-browser:liveplanner';
// Under the 15 days a token must have left to be left alone (GUEST_TOKEN_REFRESH_BEFORE_MS).
const ABOUT_TO_LAPSE_SECONDS = 3600;

const claimsOf = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as {
    sub: string;
    exp: number;
  };

test('a guest renewing with the lw_guest cookie gone keeps their id, and Back skips the renewal', async ({
  page,
  context,
  pageErrors,
}) => {
  const owner = await mintGuest(page.request);
  const held = guestTokenFor(owner)!;
  const before = claimsOf(held);

  // The page before: a plan, made with a token that is not about to lapse (so it renews nothing).
  const firstPlan = await createInMode(page);
  await expect(page.getByRole('heading', { name: 'Start Planning' })).toBeVisible();

  // The same guest, a token with an hour left, and no `lw_guest` cookie on the accounts site, as Safari leaves it.
  const lapsingResponse = await page.request.get(
    `/e2e/guest-token?sub=${owner}&expires_in=${ABOUT_TO_LAPSE_SECONDS}`,
  );
  const lapsing = (await lapsingResponse.json()) as { token: string };
  await context.clearCookies({ name: 'lw_guest' });
  expect((await context.cookies()).filter((c) => c.name === 'lw_guest')).toEqual([]);
  await page.evaluate(
    ([key, token]) => localStorage.setItem(key!, token!),
    [GUEST_KEY, lapsing.token],
  );

  // /new renews first, then makes its plan, in place of the renewal in the history.
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
  });
  await page.goto('/new');
  await page.waitForURL(
    (url) => /\/project\/[^/?#]+/.test(url.pathname) && !url.pathname.endsWith(firstPlan),
    {
      timeout: 30_000,
    },
  );
  await expect(page.getByRole('heading', { name: 'Start Planning' })).toBeVisible();
  expect(visited.some((path) => path.startsWith('/auth/guest'))).toBe(true);

  // The guest is the same one, on a token with a new lease of 45 days.
  const renewed = claimsOf(
    (await page.evaluate((key) => localStorage.getItem(key), GUEST_KEY)) as string,
  );
  expect(renewed.sub).toBe(before.sub);
  expect(renewed.exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(30 * 24 * 3600);
  const items = () =>
    page.evaluate((key) => {
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as { items?: { id: string }[] };
      return (stored.items ?? []).length;
    }, THIS_BROWSER_KEY);
  await expect.poll(items).toBe(2);

  // Back lands on the page before, not on the renewal or a second /new, and no plan is made on the way.
  const visitedBeforeBack = visited.length;
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/project/${firstPlan}(#.*)?$`));
  await expect(page.getByRole('heading', { name: 'Start Planning' })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await items()).toBe(2);
  expect(
    visited.slice(visitedBeforeBack).filter((path) => path === '/new' || path.startsWith('/auth/')),
  ).toEqual([]);
  expectNoPageErrors(pageErrors);
});
