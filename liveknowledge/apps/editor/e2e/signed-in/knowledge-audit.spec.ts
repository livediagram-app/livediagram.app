import type { Page } from '@playwright/test';
import { auditContrast } from '@liveworkspace/e2e-kit/contrast';
import { auditOptical, OPTICAL_TOLERANCE_PX } from '@liveworkspace/e2e-kit/optical';
import { expect, test } from '../fixtures';
import { expectNoSidewaysScroll, nameOpenPage, titleOf, writeLines } from '../knowledgebase';
import { openView, savedWith, signedInKnowledgebase } from './knowledge-session';

// The contrast and optical alignment audits (docs/specs/004-interface-design/color-scheme.md "Accessibility",
// optical-alignment.md; @liveworkspace/e2e-kit) over what liveknowledge adds: Pages, Ask, AI Knowledge and Home,
// in light and in dark. Contrast: every visible text node meets WCAG AA against what is painted under it. Optical:
// every glyph in a small painted shape sits within OPTICAL_TOLERANCE_PX of its centre. No allow-list in either.

type Screen = 'Pages' | 'Ask' | 'AI Knowledge' | 'Home';
const SCREENS: Screen[] = ['Pages', 'Ask', 'AI Knowledge', 'Home'];

// A knowledgebase with a verified page of writing, then the screen asked for.
async function open(page: Page, screen: Screen): Promise<void> {
  await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  const saved = savedWith(page, 'blue lever');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saved;
  await page
    .getByRole('region', { name: 'Page Health' })
    .getByRole('button', { name: 'Verify', exact: true })
    .click();
  await expect(page.locator('[data-page-meta]')).toContainText('Verified by');
  if (screen === 'Home') {
    await page.goto('/home');
    await expect(page.locator('[data-home-knowledgebase]')).toContainText('1 page');
    return;
  }
  if (screen !== 'Pages') await openView(page, screen);
  if (screen === 'Ask')
    await expect(page.locator('[data-ask-ai]')).toContainText('Uses built-in AI');
  if (screen === 'AI Knowledge')
    await expect(page.getByRole('region', { name: 'Knowledge Health' })).toBeVisible();
  if (screen === 'Pages') await expect(titleOf(page)).toHaveText('Runbook');
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Knowledgebase audits, ${scheme}`, () => {
    test.use({
      colorScheme: scheme,
      reducedMotion: 'reduce',
      viewport: { width: 1440, height: 860 },
    });

    for (const screen of SCREENS) {
      test(`contrast: ${screen}`, async ({ page }) => {
        await open(page, screen);
        const report = await auditContrast(page);
        test.info().annotations.push({
          type: `contrast: ${screen}`,
          description: `${report.measured} text nodes measured; skipped ${JSON.stringify(report.skipped)}`,
        });
        expect(report.measured, `${screen}: nothing was measured`).toBeGreaterThan(0);
        const lines = report.failures.map(
          (f) =>
            `"${f.text}" ${f.fg} on ${f.bg} = ${f.ratio}:1 (needs ${f.required}) at ${f.where}`,
        );
        expect(lines, `${screen}: text below WCAG AA in ${scheme} mode`).toEqual([]);
      });
    }

    test.describe('optical', () => {
      // At 4x, so half a pixel is two device pixels.
      test.use({ deviceScaleFactor: 4 });
      for (const screen of SCREENS) {
        test(`optical alignment: ${screen}`, async ({ page }) => {
          await open(page, screen);
          const report = await auditOptical(page);
          test.info().annotations.push({
            type: `optical: ${screen}`,
            description: `${report.measured} shapes measured`,
          });
          expect(report.measured, `${screen}: nothing was measured`).toBeGreaterThan(0);
          const lines = report.failures.map((f) => `${f.offsetPx}px ${f.what} at ${f.where}`);
          expect(
            lines,
            `${screen}: glyphs off-centre by more than ${OPTICAL_TOLERANCE_PX}px`,
          ).toEqual([]);
        });
      }
    });
  });
}

test.describe('Home on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('Home does not scroll sideways', async ({ page }) => {
    const { id } = await signedInKnowledgebase(page);
    await page.goto('/home');
    await expect(page.locator(`[data-home-knowledgebase="${id}"]`)).toContainText('1 page');
    await expectNoSidewaysScroll(page, 'Home');
  });
});
