import type { Locator, Page } from '@playwright/test';
import {
  CANVAS,
  darkVisitor,
  documentRow,
  freshDarkPage,
  jumpBackIn,
  seedDocument,
  seedOpenedDocument,
  shareLink,
} from './audit-screens';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  test,
  untilHydrated,
  mintSignedGuest,
} from './fixtures';
import { auditOptical, OPTICAL_TOLERANCE_PX } from './optical';

// Optical alignment audit (docs/specs/004-interface-design/optical-alignment.md): on each screen, every glyph
// in a small painted shape sits within OPTICAL_TOLERANCE_PX of the shape's centre, and stack rows share one
// line. Rendered at 4x (D47) so a half pixel is two device pixels.

test.use({
  colorScheme: 'dark',
  reducedMotion: 'reduce',
  viewport: { width: 1440, height: 860 },
  deviceScaleFactor: 4,
});

async function expectCentred(page: Page, screen: string): Promise<void> {
  const report = await auditOptical(page);
  test.info().annotations.push({
    type: `optical: ${screen}`,
    description: `${report.measured} shapes measured`,
  });
  expect(report.measured, `${screen}: nothing was measured`).toBeGreaterThan(0);
  const lines = report.failures.map((f) => `${f.offsetPx}px ${f.what} at ${f.where}`);
  expect
    .soft(lines, `${screen}: glyphs off-centre by more than ${OPTICAL_TOLERANCE_PX}px`)
    .toEqual([]);
}

// A seeded document open in the editor, its quick tour dismissed; returns the seeded Spinner shape.
async function openSeededEditor(page: Page, baseURL: string): Promise<Locator> {
  const owner = await mintSignedGuest(page.request);
  const id = await seedDocument(page, owner, new URL(baseURL).origin);
  await darkVisitor(page, owner);
  await page.goto(`/document/${id}`);
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);
  const spinner = page.getByRole('img', { name: /Spinner/ }).first();
  await expect(spinner).toBeVisible();
  return spinner;
}

test.describe('Optical alignment audit', () => {
  test('the New Document wizard', async ({ page, pageErrors }) => {
    await darkVisitor(page);
    await page.goto('/new');
    await page.getByText('New Document', { exact: false }).first().waitFor();
    await untilHydrated(page.getByRole('button', { name: /^next$/i }));
    await expectCentred(page, 'wizard, template step');
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByText('Name your document', { exact: false }).first().waitFor();
    await expectCentred(page, 'wizard, location step');
    expectNoPageErrors(pageErrors);
  });

  // One editor screen per test: each 4x audit is CPU-bound, so four of them in one test left it at the
  // mercy of whatever else the runner was doing within one 30-second budget.
  test('the editor with its default panels', async ({ page, pageErrors, baseURL }) => {
    await openSeededEditor(page, baseURL!);
    await expectCentred(page, 'editor with its default panels');
    expectNoPageErrors(pageErrors);
  });

  test('the editor with a shape selected', async ({ page, pageErrors, baseURL }) => {
    const spinner = await openSeededEditor(page, baseURL!);
    await spinner.click();
    await expectCentred(page, 'editor, a shape selected');
    expectNoPageErrors(pageErrors);
  });

  test('the Settings dialog', async ({ page, pageErrors, baseURL }) => {
    await openSeededEditor(page, baseURL!);
    await page.getByRole('button', { name: 'Application settings' }).click();
    await page.getByRole('dialog').first().waitFor();
    await expectCentred(page, 'Settings dialog');
    expectNoPageErrors(pageErrors);
  });

  test('the Share dialog', async ({ page, pageErrors, baseURL }) => {
    await openSeededEditor(page, baseURL!);
    await page.getByRole('button', { name: /^Share$/ }).click();
    await page.getByRole('dialog', { name: 'Share this document' }).waitFor();
    await expectCentred(page, 'Share dialog');
    expectNoPageErrors(pageErrors);
  });

  test('the Join dialog a share link opens', async ({ page, browser, baseURL }) => {
    const owner = await mintSignedGuest(page.request);
    const origin = new URL(baseURL!).origin;
    const id = await seedDocument(page, owner, origin);
    const code = await shareLink(page, owner, origin, id);
    const visitor = await freshDarkPage(browser, 4);
    await visitor.goto(`/document/shared?s=${code}`);
    await visitor.getByRole('button', { name: /^join$/i }).waitFor();
    await expectCentred(visitor, 'Join dialog');
    await visitor.context().close();
  });

  // Home as a returning owner meets it (the document they opened in Jump back in), then My
  // documents, which lists it as a row.
  test('the Explorer', async ({ page, pageErrors, baseURL }) => {
    // Signed, so the identity holds across the two page loads.
    const owner = await mintSignedGuest(page.request);
    await seedOpenedDocument(page, owner, new URL(baseURL!).origin);
    await darkVisitor(page, owner);
    await page.goto('/explorer');
    await jumpBackIn(page, 'Contrast').waitFor();
    await expectCentred(page, 'Explorer Home');

    await page.goto('/explorer/all');
    await documentRow(page, 'Contrast').waitFor();
    await expectCentred(page, 'Explorer, My documents');
    expectNoPageErrors(pageErrors);
  });
});

// A capital with a tail (Q, J) drops below the baseline by design, like a descender: an all-caps disc
// holding one is judged by its cap band, not its ink. Participant names are random, so this is pinned here
// rather than left to the day a "Q" comes up.
test('initials with a tailed capital centre on their cap band', async ({ page }) => {
  await page.goto('/new');
  await page.getByText('New Document', { exact: false }).first().waitFor();
  await page.evaluate(() => {
    const disc = document.createElement('span');
    disc.setAttribute('aria-label', 'Tailed initials');
    disc.style.cssText =
      'position:fixed;left:40px;top:40px;z-index:99999;display:inline-flex;width:24px;height:24px;' +
      'border-radius:9999px;align-items:center;justify-content:center;background:#4f46e5;color:#fff;' +
      'font-size:10px;font-weight:600;line-height:1';
    disc.innerHTML = '<span class="text-optical-centre">QW</span>';
    document.body.appendChild(disc);
  });
  const report = await auditOptical(page);
  const tailed = report.failures.filter((f) => f.where.includes('Tailed initials'));
  expect(tailed.map((f) => `${f.offsetPx}px ${f.what}`)).toEqual([]);
  // The audit reads a tailed capital through a stand-in and puts the text back.
  await expect(page.getByLabel('Tailed initials')).toHaveText('QW');
});
