import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, openStartBlank, test } from './fixtures';

// A swatch row never wraps and is never clipped (docs/specs/008-canvas/quick-style-panel.md "Where
// it sits"): the panel's width counts the targets, their gaps, the padding and the border exactly.
// Checked for a diagram's rows (the theme's seven, Ink and More colours).

const panel = (page: Page) => page.getByRole('region', { name: 'Quick style' });

// Every swatch row in the panel: one line (every target on the same top, per row of a grid), and
// nothing wider than the row's box, which itself sits inside the panel.
async function rowsFit(page: Page) {
  return panel(page).evaluate((root) => {
    const inner = root.getBoundingClientRect();
    const rows = [...root.querySelectorAll<HTMLElement>('[role="group"]')].filter((g) =>
      g.querySelector(':scope > * > button [data-swatch-chip], :scope > button [data-swatch-chip]'),
    );
    return rows.map((g) => {
      const radios = [...g.querySelectorAll<HTMLElement>('button[data-colour-key]')];
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
  test('a diagram’s colour rows sit on one line, unclipped', async ({ page, pageErrors }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openStartBlank(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('o');
    await page.mouse.click(500, 400);
    await expect(panel(page)).toBeVisible();
    const rows = await rowsFit(page);
    expect(rows.find((r) => r.name === 'Stroke')?.count).toBe(9);
    expectFit(rows);
    expectNoPageErrors(pageErrors);
  });
});
