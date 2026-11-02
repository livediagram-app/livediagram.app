import { DARK_CANVAS_BACKGROUND_COLOR, DEFAULT_BACKGROUND_COLOR } from '@livehuddle/document';
import type { Page } from '@playwright/test';
import { darkVisitor, seedDocument } from './audit-screens';
import { expect, expectNoPageErrors, mintGuest, test } from './fixtures';

// A preview is the canvas as the viewer would see it on opening it (docs/specs/006-document/document-snapshots.md
// "In the viewer's half"), end to end: liveworkspace's Explorer at /explorer asks the previews service for the
// viewer's appearance, the service asks the index who may see it and this api's export door to draw it. A Default
// canvas stored in the light half previews on the dark canvas for a dark viewer before anyone opens it, and on the
// light one once they switch to light.

// The seeded canvas's card picture, as the page shows it (its blob's SVG).
const shownPreview = (page: Page) =>
  page
    .locator('main')
    .getByRole('link', { name: 'Contrast' })
    .locator('img[src^="blob:"]')
    .first()
    .evaluate(async (img: HTMLImageElement) => (await fetch(img.src)).text())
    .catch(() => '');

test('an Explorer preview is drawn in the viewer’s appearance, before the canvas is opened', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const owner = await mintGuest(page.request);
  await darkVisitor(page, owner);
  const id = await seedDocument(page, owner, new URL(baseURL!).origin);
  const asked: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes(`/api/previews/items/${id}`)) asked.push(r.url());
  });

  // Every canvas, as cards: a canvas made but never opened is not on Home.
  await page.goto('/explorer/all');
  await expect
    .poll(() => shownPreview(page), { timeout: 30_000 })
    .toContain(`fill="${DARK_CANVAS_BACKGROUND_COLOR}"`);
  expect(asked.some((u) => u.includes('appearance=dark'))).toBe(true);

  // Switched on the real control, which cycles: the open Explorer asks for the other half at once.
  const toggle = page.getByRole('button', { name: /^Appearance: (Light|Dark|System)\b/ }).first();
  for (let i = 0; i < 3; i++) {
    if (/^Appearance: Light\b/.test((await toggle.getAttribute('aria-label')) ?? '')) break;
    await toggle.click();
  }
  await expect
    .poll(() => shownPreview(page), { timeout: 30_000 })
    .toContain(`fill="${DEFAULT_BACKGROUND_COLOR}"`);
  expect(asked.some((u) => u.includes('appearance=light'))).toBe(true);
  expectNoPageErrors(pageErrors);
});
