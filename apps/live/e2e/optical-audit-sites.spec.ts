import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import { auditOptical, OPTICAL_TOLERANCE_PX } from './optical';

// Optical alignment audit on the other sites (docs/specs/004-interface-design/optical-alignment.md): the
// help centre, the telemetry dashboard and the marketing site. The e2e stack serves their static builds
// (help and telemetry under their basePath on this origin, marketing on its own port); against a dev
// stack, point E2E_HELP_URL / E2E_TELEMETRY_URL / E2E_MARKETING_URL at the dev servers.

test.use({
  colorScheme: 'dark',
  reducedMotion: 'reduce',
  viewport: { width: 1440, height: 860 },
  deviceScaleFactor: 4,
});

const marketingPort = process.env.E2E_MARKETING_PORT ?? '3013';
const site = (name: 'help' | 'telemetry' | 'marketing', baseURL: string) =>
  ({
    help: process.env.E2E_HELP_URL ?? `${baseURL}/help`,
    telemetry: process.env.E2E_TELEMETRY_URL ?? `${baseURL}/telemetry`,
    marketing: process.env.E2E_MARKETING_URL ?? `http://localhost:${marketingPort}`,
  })[name];

async function open(page: Page, url: string, build: string): Promise<void> {
  const res = await page.goto(url);
  expect(
    res?.status(),
    `${url} did not load: build it (pnpm --filter @livediagram/${build} build)`,
  ).toBe(200);
}

async function expectCentred(page: Page, screen: string): Promise<void> {
  const report = await auditOptical(page);
  test
    .info()
    .annotations.push({
      type: `optical: ${screen}`,
      description: `${report.measured} shapes measured`,
    });
  expect(report.measured, `${screen}: nothing was measured`).toBeGreaterThan(0);
  const lines = report.failures.map((f) => `${f.offsetPx}px ${f.what} at ${f.where}`);
  expect
    .soft(lines, `${screen}: glyphs off-centre by more than ${OPTICAL_TOLERANCE_PX}px`)
    .toEqual([]);
}

test.describe('Optical alignment audit, other sites', () => {
  test('the help centre', async ({ page, pageErrors, baseURL }) => {
    const help = site('help', baseURL!);
    await open(page, `${help}/`, 'help');
    await expectCentred(page, 'help home');
    await open(page, `${help}/getting-started/`, 'help');
    await expectCentred(page, 'help category');
    const article = page.locator('main a[href*="/getting-started/"]').first();
    await article.click();
    await page.waitForLoadState('networkidle');
    await expectCentred(page, 'help article');
    expectNoPageErrors(pageErrors);
  });

  test('the telemetry dashboard', async ({ page, pageErrors, baseURL }) => {
    await open(page, `${site('telemetry', baseURL!)}/`, 'telemetry');
    await expectCentred(page, 'telemetry dashboard');
    expectNoPageErrors(pageErrors);
  });

  test('the marketing site', async ({ page, pageErrors, baseURL }) => {
    const marketing = site('marketing', baseURL!);
    await open(page, `${marketing}/`, 'marketing');
    await expectCentred(page, 'marketing home');
    await open(page, `${marketing}/features/collaboration/`, 'marketing');
    await expectCentred(page, 'marketing feature page');
    expectNoPageErrors(pageErrors);
  });
});
