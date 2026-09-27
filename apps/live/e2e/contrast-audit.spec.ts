import { auditContrast, type ContrastReport } from './contrast';
import { CANVAS, darkVisitor, freshDarkPage, seedDiagram, shareLink } from './audit-screens';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// Contrast audit, dark mode (docs/specs/003-system-architecture/e2e-smoke.md; the palette it guards is
// docs/specs/004-interface-design/color-scheme.md, Dark palette (Steel)). Every visible text node on each
// screen must meet WCAG AA against the background painted under it. There is no allow-list: a failure
// is fixed at its colour. Light mode is deliberately out of scope: its colours belong to the light half
// of #74, owned by Thomas.

test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1440, height: 860 } });

function expectAA(report: ContrastReport, screen: string): void {
  test.info().annotations.push({
    type: `contrast: ${screen}`,
    description: `${report.measured} text nodes measured; skipped ${JSON.stringify(report.skipped)}`,
  });
  expect(report.measured, `${screen}: nothing was measured`).toBeGreaterThan(0);
  const lines = report.failures.map(
    (f) => `"${f.text}" ${f.fg} on ${f.bg} = ${f.ratio}:1 (needs ${f.required}) at ${f.where}`,
  );
  expect(lines, `${screen}: text below WCAG AA in dark mode`).toEqual([]);
}

test.describe('Contrast audit, dark mode', () => {
  test('the New Diagram wizard', async ({ page, pageErrors }) => {
    await darkVisitor(page);
    await page.goto('/new');
    await page.getByText('New Diagram', { exact: false }).first().waitFor();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expectAA(await auditContrast(page), 'wizard, template step');

    await page.getByRole('button', { name: /^next$/i }).click();
    await page
      .getByText('All themes', { exact: false })
      .or(page.getByText('Default').first())
      .first()
      .waitFor();
    expectAA(await auditContrast(page), 'wizard, theme step');
    expectNoPageErrors(pageErrors);
  });

  test('the editor, its panels and dialogs', async ({ page, pageErrors, baseURL }) => {
    const owner = crypto.randomUUID();
    const origin = new URL(baseURL!).origin;
    const id = await seedDiagram(page, owner, origin);
    await darkVisitor(page, owner);
    await page.goto(`/diagram/${id}`);
    await page.locator(CANVAS).waitFor();
    await dismissQuickTour(page);
    await expect(page.getByRole('img', { name: /Spinner/ }).first()).toBeVisible();
    expectAA(await auditContrast(page), 'editor with its default panels');

    await page
      .getByRole('img', { name: /Spinner/ })
      .first()
      .click();
    expectAA(await auditContrast(page), 'editor, a shape selected');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Application settings' }).click();
    await page.getByRole('dialog').first().waitFor();
    expectAA(await auditContrast(page), 'Settings dialog');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Share$/ }).click();
    await page.getByRole('dialog', { name: 'Share this diagram' }).waitFor();
    expectAA(await auditContrast(page), 'Share dialog');
    await page.keyboard.press('Escape');
    expectNoPageErrors(pageErrors);
  });

  test('the Join dialog a share link opens', async ({ page, browser, baseURL }) => {
    const owner = crypto.randomUUID();
    const origin = new URL(baseURL!).origin;
    const id = await seedDiagram(page, owner, origin);
    const code = await shareLink(page, owner, origin, id);
    const visitor = await freshDarkPage(browser);
    await visitor.goto(`/diagram/shared?s=${code}`);
    await visitor.getByRole('button', { name: /^join$/i }).waitFor();
    expectAA(await auditContrast(visitor), 'Join dialog');
    await visitor.context().close();
  });

  test('the Explorer', async ({ page, pageErrors, baseURL }) => {
    const owner = crypto.randomUUID();
    await seedDiagram(page, owner, new URL(baseURL!).origin);
    await darkVisitor(page, owner);
    await page.goto('/explorer');
    await page.getByText('Contrast').first().waitFor();
    expectAA(await auditContrast(page), 'Explorer');
    expectNoPageErrors(pageErrors);
  });
});
