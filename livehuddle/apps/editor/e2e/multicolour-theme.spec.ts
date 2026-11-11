import { expect, test, expectNoPageErrors, seedTab, startBlankDocument } from './fixtures';

// Multi-colour themes (docs/specs/011-theme/multicolour-themes.md) end to end:
// Rainbow, picked for uncoloured boxes, paints each loose box its own palette colour, and
// the switch leaves its trace in the console (blueprint O1). Unit tests prove
// the branch map; only the editor proves the colours reach the canvas.

const CANVAS = '[data-canvas-a11y-root]';
const SWITCH_LOG = /^\[theme-graph\] switch theme=rainbow elements=\d+ branches=\d+$/;

// Rainbow's palette fills (packages/document/src/themes-data.ts), as computed CSS.
const RAINBOW_FILLS = ['#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff'].map(
  (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  },
);

async function rainbowHues(page: import('@playwright/test').Page): Promise<number> {
  const fills = await page
    .locator(`${CANVAS} [role="img"]`)
    .evaluateAll((els) => els.map((el) => getComputedStyle(el as HTMLElement).backgroundColor));
  return new Set(fills.filter((f) => RAINBOW_FILLS.includes(f))).size;
}

test.describe('Multi-colour themes', () => {
  test('Rainbow gives each loose box its own palette colour', async ({ page, pageErrors }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    // Four boxes with no colours of their own (a template's authored hues would rightly be kept as
    // customisations, docs/specs/011-theme/multicolour-themes.md), so any Rainbow hue found came from the
    // palette. Not joined by arrows (they left with the element engine's part 4,
    // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"): a loose box takes the next hue.
    await startBlankDocument(page);
    const box = (id: string, x: number, y: number) => ({
      id,
      type: 'sticky',
      x,
      y,
      width: 120,
      height: 60,
      label: id,
    });
    await seedTab(page, [
      box('root', 100, 300),
      box('one', 400, 150),
      box('two', 400, 300),
      box('three', 400, 450),
    ]);
    expect(await rainbowHues(page)).toBe(0);

    await page.getByRole('button', { name: 'Theme and canvas' }).click();
    // The dialog opens on its home (docs/specs/011-theme/canvas-and-theme-dialog.md "Fine-tune"): Colours
    // opens the theme browser.
    await page.getByRole('button', { name: /^Colours: / }).click();
    // Every theme sits in one paged list ("Colours panel"): page on until Rainbow shows.
    const rainbow = page.getByRole('button', { name: /^Rainbow/ }).first();
    for (let i = 0; i < 4 && !(await rainbow.isVisible()); i++)
      await page.getByRole('button', { name: 'Next themes' }).click();
    await rainbow.click();
    await expect
      .poll(() => logs, { message: 'the switch leaves its [theme-graph] trace' })
      .toContainEqual(expect.stringMatching(SWITCH_LOG));

    await expect
      .poll(() => rainbowHues(page), { message: 'loose boxes take distinct palette colours' })
      .toBeGreaterThanOrEqual(3);
    expectNoPageErrors(pageErrors);
  });
});
