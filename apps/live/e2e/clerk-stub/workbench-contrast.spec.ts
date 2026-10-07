import type { Page } from '@playwright/test';
import { auditContrast, type ContrastReport } from '../contrast';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { WEBBER } from './agent-session';
import { freshUserId, installClerkStub } from './clerk-stub';

// Contrast of the workbench pairing surfaces (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Accessibility"), to WCAG 2.2 AA: a paired-workbench row in Settings > API tokens in both colour schemes, and the
// pairing page in its pending state in dark. The pairing page is the device page's card, whose light-mode solid
// brand fill belongs to the shared light palette, outside these audits as in contrast-audit.spec.ts. Both need a
// signed-in person, so they run against the Clerk-enabled export here rather than in the guest-mode audit. The
// api's answers are stubbed, as the device page's spec stubs the MCP worker, so each surface renders exactly the
// state under audit.

const CODE = 'AAAAAAAAAAAAAAAAAAAAAA';
const DAY = 86_400_000;
const NOW = Date.now();
const TOKEN = {
  id: 'tok_contrast',
  name: 'livediagram CLI',
  createdAt: NOW - 10 * DAY,
  expiresAt: NOW + 170 * DAY,
  lastUsedAt: NOW - DAY,
  readOnly: false,
};
const PAIRING = {
  id: 'pair_contrast',
  tokenId: TOKEN.id,
  origin: 'https://127.0.0.1:5175',
  name: 'Spinner',
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
  await installClerkStub(page, { ...WEBBER, id: freshUserId('webber') });
  await page.addInitScript((mode) => localStorage.setItem('livediagram:v2:ui-mode', mode), scheme);
}

test.describe('Workbench pairing contrast, the pairing page', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: VIEWPORT });

  test('pending, dark', async ({ page, pageErrors }) => {
    await signedIn(page, 'dark');
    await page.route(`**/api/workbench/pairing-requests/${CODE}`, (route) =>
      route.fulfill({
        json: {
          request: {
            origin: PAIRING.origin,
            name: PAIRING.name,
            tokenName: TOKEN.name,
            expiresAt: NOW + 600_000,
            status: 'pending',
          },
        },
      }),
    );
    await page.goto(`/workbench/pair?code=${CODE}`);
    await expect(page.getByRole('heading', { name: 'Allow this workbench?' })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await page.screenshot({ path: test.info().outputPath('pair-pending-dark.png') });
    expectAA(await auditContrast(page), 'pairing page, pending, dark');
    expectNoPageErrors(pageErrors);
  });
});

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`Workbench pairing contrast, Settings, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce', viewport: VIEWPORT });

    test('a paired workbench under its token', async ({ page, pageErrors }) => {
      await signedIn(page, scheme);
      await page.route('**/api/tokens', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ json: { tokens: [TOKEN] } })
          : route.fallback(),
      );
      await page.route('**/api/workbench/pairings', (route) =>
        route.fulfill({ json: { pairings: [PAIRING] } }),
      );
      await page.goto('/explorer/home?settings=tokens');
      const pairings = page.getByRole('list', { name: 'Paired workbenches' });
      await expect(pairings.getByText('Spinner')).toBeVisible();
      if (scheme === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
      await page.screenshot({ path: test.info().outputPath(`pair-settings-${scheme}.png`) });
      // The token card holding the row, so the audit judges this surface and nothing behind the dialog.
      expectAA(
        await auditContrast(page, 'li:has([aria-label^="Unpair "])'),
        `paired workbench row, ${scheme}`,
      );
      expectNoPageErrors(pageErrors);
    });
  });
}
