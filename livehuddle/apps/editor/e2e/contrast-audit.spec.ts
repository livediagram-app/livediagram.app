import { auditContrast, type ContrastReport } from './contrast';
import {
  CANVAS,
  darkVisitor,
  documentRow,
  freshDarkPage,
  seedDocument,
  shareLink,
} from './audit-screens';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  test,
  untilHydrated,
  mintGuest,
} from './fixtures';

// Contrast audit, dark mode (docs/specs/003-system-architecture/e2e-smoke.md; the palette it guards is
// docs/specs/004-interface-design/color-scheme.md, Dark palette (Steel)). Every visible text node on each
// screen must meet WCAG AA against the background painted under it. There is no allow-list: a failure
// is fixed at its colour. Light mode is out of scope here: its brand ramp (solid fills and brand ink) is held by
// app/light-palette.test.ts, and the editor's light muted text is still being brought in line (color-scheme.md).

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
  // A visitor with no identity leaves /new for the guest handoff the moment the page hydrates (fixtures.ts
  // serverNewUrl), which destroyed the page mid-audit: the wizard is audited as a minted guest, who stays.
  test('the New Canvas wizard', async ({ page, pageErrors }) => {
    await darkVisitor(page, await mintGuest(page.request));
    await page.goto('/new');
    await page.getByText('New Canvas', { exact: false }).first().waitFor();
    await untilHydrated(page.getByRole('button', { name: /^create$/i }));
    await expect(page.locator('html')).toHaveClass(/dark/);
    expectAA(await auditContrast(page), 'wizard');
    expectNoPageErrors(pageErrors);
  });

  test('the editor, its panels and dialogs', async ({ page, pageErrors, baseURL }) => {
    const owner = await mintGuest(page.request);
    const origin = new URL(baseURL!).origin;
    const id = await seedDocument(page, owner, origin);
    await darkVisitor(page, owner);
    await page.goto(`/document/${id}`);
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
    await page.getByRole('dialog', { name: /^Share / }).waitFor();
    expectAA(await auditContrast(page), 'Share dialog');
    await page.keyboard.press('Escape');
    expectNoPageErrors(pageErrors);
  });

  test('the Join dialog a share link opens', async ({ page, browser, baseURL }) => {
    const owner = await mintGuest(page.request);
    const origin = new URL(baseURL!).origin;
    const id = await seedDocument(page, owner, origin);
    const code = await shareLink(page, owner, origin, id);
    const visitor = await freshDarkPage(browser);
    await visitor.goto(`/document/shared?s=${code}`);
    await visitor.getByRole('button', { name: /^join$/i }).waitFor();
    expectAA(await auditContrast(visitor), 'Join dialog');
    await visitor.context().close();
  });

  // My Work, which lists the seeded document as a row.
  test('the Explorer', async ({ page, pageErrors, baseURL }) => {
    const owner = await mintGuest(page.request);
    await seedDocument(page, owner, new URL(baseURL!).origin);
    await darkVisitor(page, owner);
    await page.goto('/explorer/all');
    await documentRow(page, 'Contrast').waitFor();
    expectAA(await auditContrast(page), 'Explorer, My Work');
    expectNoPageErrors(pageErrors);
  });
});
