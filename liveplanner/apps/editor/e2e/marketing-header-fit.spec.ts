import { expect, test } from './fixtures';

// The marketing header fits a phone (docs/specs/019-marketing/marketing-site.md "Header"): the logo,
// the Explorer link and the primary CTA never widen the page past the screen, and the CTA keeps its
// 16px gutter. Below 430px the primary drops its verb ("Template"), which is what makes the longest
// wordmark fit. The e2e stack serves the marketing build on its own port; against a dev stack, point
// E2E_MARKETING_URL at the dev server.
const marketing =
  process.env.E2E_MARKETING_URL ?? `http://localhost:${process.env.E2E_MARKETING_PORT ?? '3013'}`;

for (const width of [320, 360, 390, 430]) {
  test(`the marketing header fits a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${marketing}/`);
    const fit = await page.evaluate(() => {
      const bar = document.querySelector('header > div')!;
      const cta = bar.lastElementChild!.getBoundingClientRect();
      return { page: document.documentElement.scrollWidth, ctaRight: Math.round(cta.right) };
    });
    expect(fit.page, 'the page scrolls sideways').toBeLessThanOrEqual(width);
    expect(fit.ctaRight, 'the CTA eats the 16px gutter').toBeLessThanOrEqual(width - 16);
  });
}
