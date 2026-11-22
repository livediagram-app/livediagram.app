import { auditContrast, type ContrastReport } from '@liveworkspace/e2e-kit/contrast';
import { freshDarkPage, seedDocument, shareLink } from './audit-screens';
import { expect, test, mintGuest } from './fixtures';

// Contrast audit, dark mode, of the Join dialog a share link opens: the knowledgebase's own screens (Pages, Ask,
// AI Knowledge, Home), in light and dark, are signed-in/knowledge-audit.spec.ts's. (docs/specs/003-system-architecture/e2e-smoke.md; the palette it guards is
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
  test('the Join dialog a share link opens', async ({ page, browser, baseURL }) => {
    const owner = await mintGuest(page.request);
    const origin = new URL(baseURL!).origin;
    const id = await seedDocument(page, owner, origin);
    const code = await shareLink(page, owner, origin, id);
    const visitor = await freshDarkPage(browser);
    await visitor.goto(`/document/${id}?s=${code}`);
    await visitor.getByRole('button', { name: /^join$/i }).waitFor();
    expectAA(await auditContrast(visitor), 'Join dialog');
    await visitor.context().close();
  });
});
