import type { Page } from '@playwright/test';
import { CANVAS, darkVisitor, freshDarkPage, seedDiagram, shareLink } from './audit-screens';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';
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

test.describe('Optical alignment audit', () => {
  test('the New Diagram wizard', async ({ page, pageErrors }) => {
    await darkVisitor(page);
    await page.goto('/new');
    await page.getByText('New Diagram', { exact: false }).first().waitFor();
    await expectCentred(page, 'wizard, template step');
    await page.getByRole('button', { name: /^next$/i }).click();
    await page
      .getByText('All themes', { exact: false })
      .or(page.getByText('Default').first())
      .first()
      .waitFor();
    await expectCentred(page, 'wizard, theme step');
    expectNoPageErrors(pageErrors);
  });

  test('the editor, its panels and dialogs', async ({ page, pageErrors, baseURL }) => {
    const owner = crypto.randomUUID();
    const id = await seedDiagram(page, owner, new URL(baseURL!).origin);
    await darkVisitor(page, owner);
    await page.goto(`/diagram/${id}`);
    await page.locator(CANVAS).waitFor();
    await dismissQuickTour(page);
    const spinner = page.getByRole('img', { name: /Spinner/ }).first();
    await expect(spinner).toBeVisible();
    await expectCentred(page, 'editor with its default panels');

    await spinner.click();
    await expectCentred(page, 'editor, a shape selected');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Application settings' }).click();
    await page.getByRole('dialog').first().waitFor();
    await expectCentred(page, 'Settings dialog');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Share$/ }).click();
    await page.getByRole('dialog', { name: 'Share this diagram' }).waitFor();
    await expectCentred(page, 'Share dialog');
    await page.keyboard.press('Escape');
    expectNoPageErrors(pageErrors);
  });

  test('the Join dialog a share link opens', async ({ page, browser, baseURL }) => {
    const owner = crypto.randomUUID();
    const origin = new URL(baseURL!).origin;
    const id = await seedDiagram(page, owner, origin);
    const code = await shareLink(page, owner, origin, id);
    const visitor = await freshDarkPage(browser, 4);
    await visitor.goto(`/diagram/shared?s=${code}`);
    await visitor.getByRole('button', { name: /^join$/i }).waitFor();
    await expectCentred(visitor, 'Join dialog');
    await visitor.context().close();
  });

  test('the Explorer', async ({ page, pageErrors, baseURL }) => {
    const owner = crypto.randomUUID();
    await seedDiagram(page, owner, new URL(baseURL!).origin);
    await darkVisitor(page, owner);
    await page.goto('/explorer');
    await page.getByText('Contrast').first().waitFor();
    await expectCentred(page, 'Explorer');
    expectNoPageErrors(pageErrors);
  });
});
