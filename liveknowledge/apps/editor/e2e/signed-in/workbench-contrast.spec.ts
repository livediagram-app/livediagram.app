import type { Page } from '@playwright/test';
import { auditContrast, type ContrastReport } from '@liveworkspace/e2e-kit/contrast';
import { expect, expectNoPageErrors, startBlankDocument, test } from '../fixtures';
import { WEBBER } from './agent-session';
import { freshUserId, installSession } from './session';

// Contrast of the workbench pairing surface (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Accessibility"), to WCAG 2.2 AA in both colour schemes (the pairing page itself is liveworkspace.app's,
// liveworkspace/docs/specs/011-workbench/workbench.md): Settings > API Tokens with a paired workbench (the tokens
// themselves are made and listed on liveworkspace.app, so the row links there and lists only pairings). It needs a
// signed-in person, so it runs against the signed-in export here rather than in the guest-mode audit. The api's
// answers are stubbed, so the surface renders exactly the state under audit.

const DAY = 86_400_000;
const NOW = Date.now();
// The token is the liveworkspace account's (made on liveworkspace.app); the app knows only its id and name.
const TOKEN = { id: 'tok_contrast', name: 'liveknowledge CLI' };
const PAIRING = {
  id: 'pair_contrast',
  tokenId: TOKEN.id,
  origin: 'https://127.0.0.1:5175',
  name: 'Acme Editor',
  scope: 'design',
  pairedAt: NOW - 2 * DAY,
};
const VIEWPORT = { width: 1280, height: 800 };

function expectAA(report: ContrastReport, screen: string): void {
  test.info().annotations.push({
    type: `contrast: ${screen}`,
    description: `${report.measured} text nodes measured; skipped ${JSON.stringify(report.skipped)}`,
  });
  expect(report.measured, `${screen}: nothing was measured`).toBeGreaterThan(0);
  const lines = report.failures.map(
    (f) => `"${f.text}" ${f.fg} on ${f.bg} = ${f.ratio}:1 (needs ${f.required}) at ${f.where}`,
  );
  expect(lines, `${screen}: text below WCAG AA`).toEqual([]);
}

async function signedIn(page: Page, scheme: 'dark' | 'light'): Promise<void> {
  await installSession(page, { ...WEBBER, id: freshUserId('webber') });
  await page.addInitScript(
    (mode) => localStorage.setItem('liveknowledge:v2:ui-mode', mode),
    scheme,
  );
}

async function expectScheme(page: Page, scheme: 'dark' | 'light'): Promise<void> {
  if (scheme === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
}

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`Workbench pairing contrast, Settings, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce', viewport: VIEWPORT });

    test('the API Tokens row with a paired workbench', async ({ page, pageErrors }) => {
      await signedIn(page, scheme);
      await page.route('**/api/workbench/pairings', (route) =>
        route.fulfill({ json: { pairings: [PAIRING] } }),
      );
      // Settings opens on its deep link wherever the editor is (a blank document here, made on the server as the
      // signed-in account, so no Offline copy asks to move; the Explorer is liveworkspace.app's).
      await startBlankDocument(page);
      await page.goto(`${new URL(page.url()).pathname}?settings=tokens`);
      const pairings = page.getByRole('list', { name: 'Paired workbenches' });
      await expect(pairings.getByText('Acme Editor')).toBeVisible();
      await expectScheme(page, scheme);
      await page.screenshot({ path: test.info().outputPath(`pair-settings-${scheme}.png`) });
      // The row's body (Manage API Tokens and the paired workbenches), so the audit judges this surface and
      // nothing behind the dialog.
      expectAA(
        await auditContrast(page, 'div:has(> div > ul[aria-labelledby])'),
        `API Tokens row with a paired workbench, ${scheme}`,
      );
      expectNoPageErrors(pageErrors);
    });
  });
}
