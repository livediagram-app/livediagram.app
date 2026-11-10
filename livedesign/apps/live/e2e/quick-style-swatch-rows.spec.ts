import type { Locator, Page } from '@playwright/test';
import { expect, expectNoPageErrors, openBlankPage, pagePoint, test } from './fixtures';
import { quickBar, quickPopover, quickRow, type QuickRowTitle } from './quick-style-bar';

// A swatch row never wraps and is never clipped (docs/specs/008-canvas/quick-style-panel.md "Where
// it sits"): the popover counts the targets, their gaps, the padding and the border exactly. Checked
// for a shape's colour rows (the theme's seven, Ink and More colours).

// Every swatch row in a popover: one line (every target on the same top), and nothing wider than the
// row's box, which itself sits inside the popover's dialog.
async function rowsFit(dialog: Locator) {
  return dialog.evaluate((root) => {
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

async function fitOf(page: Page, title: QuickRowTitle) {
  await quickRow(page, title);
  return rowsFit(quickPopover(page, title));
}

test.describe('swatch rows', () => {
  test('a diagram’s colour rows sit on one line, unclipped', async ({ page, pageErrors }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    // Its page chosen a Logo: a circle is drawn only on a page (fixtures openBlankPage).
    await openBlankPage(page);
    const at = await pagePoint(page, 0.4, 0.45);
    await page.keyboard.press('Escape');
    await page.keyboard.press('o');
    await page.mouse.click(at.x, at.y);
    await expect(quickBar(page)).toBeVisible();
    const stroke = await fitOf(page, 'Stroke');
    expect(stroke.find((r) => r.name === 'Stroke')?.count).toBe(9);
    expectFit(stroke);
    expectFit(await fitOf(page, 'Fill'));
    expectNoPageErrors(pageErrors);
  });
});
