import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, openStartBlank, test } from './fixtures';

// A swatch row never wraps and is never clipped (docs/specs/008-canvas/quick-style-panel.md "Where
// it sits"): the panel's width counts the targets, their gaps, the padding and the border exactly.
// Checked for a diagram's eight-swatch rows (the theme's seven and Ink) and Draw mode's Marker
// colour rows (the nine stock colours, and the tab's eight custom colours).

const PREFS_KEY = 'livediagram:user-preferences:v1';
const YOURS = [
  '#ff6b00',
  '#00a39b',
  '#c026d3',
  '#7c3aed',
  '#0891b2',
  '#65a30d',
  '#b45309',
  '#be123c',
];

async function withPrefs(page: Page) {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(
    ([key, recent]) => {
      const prefs = JSON.parse(localStorage.getItem(key as string) ?? '{}');
      localStorage.setItem(
        key as string,
        JSON.stringify({ ...prefs, whiteboardYourColours: recent }),
      );
    },
    [PREFS_KEY, YOURS] as const,
  );
}

const panel = (page: Page) => page.getByRole('region', { name: 'Quick style' });

// Every swatch row in the panel: one line (every target on the same top, per row of a grid), and
// nothing wider than the row's box, which itself sits inside the panel.
async function rowsFit(page: Page) {
  return panel(page).evaluate((root) => {
    const inner = root.getBoundingClientRect();
    const rows = [...root.querySelectorAll<HTMLElement>('[role="radiogroup"]')].filter((g) =>
      g.querySelector('[role="radio"] span[style*="background"]'),
    );
    return rows.map((g) => {
      const radios = [...g.querySelectorAll<HTMLElement>('[role="radio"]')];
      const box = g.getBoundingClientRect();
      const right = Math.max(...radios.map((r) => r.getBoundingClientRect().right));
      return {
        name: g.getAttribute('aria-label'),
        count: radios.length,
        overflow: g.scrollWidth - g.clientWidth,
        lines: new Set(radios.map((r) => Math.round(r.getBoundingClientRect().top))).size,
        insidePanel: box.left >= inner.left && right <= inner.right - 1 + 0.01,
      };
    });
  });
}

function expectFit(rows: Awaited<ReturnType<typeof rowsFit>>) {
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) {
    expect(r.overflow, `${r.name} overflows`).toBeLessThanOrEqual(0);
    expect(r.lines, `${r.name} wraps`).toBe(1);
    expect(r.insidePanel, `${r.name} is clipped`).toBe(true);
  }
}

test.describe('swatch rows', () => {
  test('a diagram’s eight-swatch rows sit on one line, unclipped', async ({ page, pageErrors }) => {
    await withPrefs(page);
    await openStartBlank(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('o');
    await page.mouse.click(500, 400);
    await expect(panel(page)).toBeVisible();
    const rows = await rowsFit(page);
    expect(rows.find((r) => r.name === 'Stroke')?.count).toBe(8);
    expectFit(rows);
    expectNoPageErrors(pageErrors);
  });

  test('a whiteboard’s Marker colour rows: nine stock colours and eight customs, one line each', async ({
    page,
    pageErrors,
  }) => {
    await withPrefs(page);
    await page.goto('/new?template=whiteboard');
    await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
    await dismissQuickTour(page);
    // Eight strokes, each in one of Your colours, so the tab uses eight custom colours.
    const marker2 = page.getByRole('button', { name: /^Marker 2/ });
    for (const [i, hex] of YOURS.entries()) {
      await page.keyboard.press('2');
      if ((await marker2.getAttribute('aria-expanded')) !== 'true') await marker2.click();
      await page.getByRole('button', { name: `Custom ${hex}`, exact: true }).click();
      await page.keyboard.press('Escape');
      await page.mouse.move(640, 180 + i * 28);
      await page.mouse.down();
      await page.mouse.move(980, 180 + i * 28, { steps: 8 });
      await page.mouse.up();
    }
    await page.keyboard.press('v');
    await page.mouse.click(810, 180);
    await expect(panel(page).getByText('Marker stroke')).toBeVisible();
    const rows = await rowsFit(page);
    expect(rows.find((r) => r.name === 'Marker colour')?.count).toBe(9);
    expect(rows.find((r) => r.name === 'Custom colours')?.count).toBe(8);
    expectFit(rows);
    expectNoPageErrors(pageErrors);
  });
});
