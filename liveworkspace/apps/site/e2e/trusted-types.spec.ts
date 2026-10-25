import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// The site's pages under its enforced Trusted Types header (livediagram/docs/specs/016-platform/trusted-types.md),
// in the browser that enforces it. Every Explorer view is checked: each app's router serves this same page under
// the app's own address, with these same headers (@liveworkspace/sites/workspace-proxy), so a sink the default policy
// refuses blanks the Explorer on every address at once. It did: the layout rendered its silent sign-in script from a
// plain string, and every /explorer page crashed with "[trusted-types] html-refused".

const EXPLORER = fileURLToPath(new URL('../app/explorer/', import.meta.url));
const VIEWS = [
  '/explorer',
  ...readdirSync(EXPLORER)
    .filter((name) => statSync(`${EXPLORER}${name}`).isDirectory())
    .map((name) => `/explorer/${name}`),
];
const PAGES = ['/', '/sign-in', '/account', '/telemetry'];
// Retired addresses the Explorer replaces with a view of its own on an app's address; here they draw nothing.
const RETIRED = new Set(['/explorer/offline']);

/** Every Trusted Types refusal and uncaught error the page raises, as it raises them. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && /trusted-types|TrustedHTML|TrustedScript/.test(m.text()))
      problems.push(m.text().slice(0, 300));
  });
  return problems;
}

for (const path of [...VIEWS, ...PAGES]) {
  test(`${path} renders under the Trusted Types header`, async ({ page }) => {
    const problems = watch(page);
    const res = await page.goto(path, { waitUntil: 'networkidle' });
    expect(res?.headers()['content-security-policy']).toContain(
      "require-trusted-types-for 'script'",
    );
    if (!RETIRED.has(path)) await expect(page.locator('body')).not.toBeEmpty();
    expect(problems).toEqual([]);
  });
}

// The silent sign-in is in the HTML itself, so it runs as the page loads on an app's address (it does nothing here).
test('the Explorer carries its silent sign-in in the HTML', async ({ request }) => {
  const html = await (await request.get('/explorer/recent')).text();
  expect(html).toMatch(/<script>\(function\(\)\{var h=location\.host/);
});

// A client navigation renders the Explorer's layout in the browser, the case a server-minted string fails.
test('a client navigation into the Explorer renders under the header', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() =>
    (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(
      '/explorer/recent',
    ),
  );
  await page.waitForURL('**/explorer/recent');
  await page.waitForLoadState('networkidle');
  const silent = await page.evaluate(
    () => [...document.scripts].filter((s) => s.text.includes('location.host.toLowerCase')).length,
  );
  expect(silent).toBe(1);
  expect(problems).toEqual([]);
});
