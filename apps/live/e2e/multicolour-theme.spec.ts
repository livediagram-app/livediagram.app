import {
  expect,
  test,
  dismissQuickTour,
  expectNoPageErrors,
  startTemplateDiagram,
} from './fixtures';

// Multi-colour themes (docs/specs/011-theme/multicolour-themes.md) end to end:
// picking Rainbow on a mind map paints each limb its own palette colour, and
// the wrapper leaves its trace in the console (blueprint O1). Unit tests prove
// the branch map; only the editor proves the colours reach the canvas.

const CANVAS = '[data-canvas-a11y-root]';
const SWITCH_LOG = /^\[theme-graph\] switch theme=rainbow elements=\d+ branches=\d+$/;

// Rainbow's palette fills (packages/diagram/src/themes-data.ts), as computed CSS.
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
  test('Rainbow gives each limb of a mind map its own palette colour', async ({
    page,
    pageErrors,
  }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await startTemplateDiagram(page, /Browse Mind maps templates/, /^Mind map/i);
    await dismissQuickTour(page);
    // The template's own theme carries none of Rainbow's hues, so any found
    // afterwards came from the switch.
    expect(await rainbowHues(page)).toBe(0);

    await page.getByRole('button', { name: 'Theme and canvas' }).click();
    await page.getByRole('button', { name: 'Browse Multi-colour themes' }).click();
    await page
      .getByRole('button', { name: /^Rainbow/ })
      .first()
      .click();

    await expect
      .poll(() => rainbowHues(page), { message: 'limbs take distinct palette colours' })
      .toBeGreaterThanOrEqual(3);
    await expect
      .poll(() => logs, { message: 'the switch leaves its [theme-graph] trace' })
      .toContainEqual(expect.stringMatching(SWITCH_LOG));
    expectNoPageErrors(pageErrors);
  });
});
