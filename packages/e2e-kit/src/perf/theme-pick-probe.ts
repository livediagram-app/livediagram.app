// A theme pick on a big board (each product's docs/specs/008-canvas/canvas-performance.md "A theme pick on a big
// board"): on an editor page already showing the board, the Tab Style dialog's Colours panel, one theme picked, and
// the main thread read from the click until the canvas has drawn in the new theme and held for a second. Each
// product's `e2e/perf/theme-pick.perf.ts` seeds and opens its board and hands the page here. Reports only.

import type { Browser, Page } from '@playwright/test';
import {
  readMainThreadProbe,
  startMainThreadProbe,
  startProbeTrace,
  throttleCpu,
  type MainThreadReading,
} from './main-thread-probe';

export async function measureThemePick(
  browser: Browser,
  page: Page,
  rate: number,
  trace?: { path: string; invalidations: boolean },
): Promise<MainThreadReading> {
  await page.getByRole('button', { name: 'Theme and canvas' }).click();
  await page.getByRole('button', { name: /^Colours: / }).click();
  const fourth = page.locator('button[aria-pressed="false"]').filter({ hasText: /\S/ }).nth(3);
  await fourth.waitFor();
  // Held by its theme's name, as the pressed state moves to it.
  const label = (await fourth.locator('p').first().textContent())!;
  const target = page
    .locator('button[aria-pressed]')
    .filter({ has: page.getByText(label, { exact: true }) });
  await page.waitForTimeout(500);

  const cdp = await throttleCpu(page, rate);
  await startMainThreadProbe(page);
  if (trace) await startProbeTrace(browser, page, trace.path, trace.invalidations);
  await target.click();
  await target.and(page.locator('[aria-pressed="true"]')).waitFor();
  await page.waitForTimeout(1500);
  const reading = await readMainThreadProbe(page);
  if (trace) await browser.stopTracing();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return reading;
}
