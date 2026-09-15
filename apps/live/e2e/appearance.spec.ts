import { expect, test, dismissQuickTour, expectNoPageErrors } from './fixtures';

// Appearance (spec/07) end to end: the three settings on the real control, and
// the thing the merge was for — a tab on the Default colour scheme repainting
// with the viewer, canvas AND elements, without writing to the diagram.
//
// Unit tests can only say the store resolves and the helpers return the right
// hex. Whether the canvas a reader is looking at actually changes needs the
// editor, because it depends on a context reaching memoised element views.

const CANVAS = '[data-canvas-a11y-root]';

// The wizard's Skip path (spec/14): a blank diagram on the Default colour
// scheme, in one click. What this suite needs is a default tab, not the wizard.
async function justDraw(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/new');
  await page.getByRole('button', { name: /^just draw$/i }).click();
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);
}
const DARK_CANVAS = '#2b2b33';
const LIGHT_CANVAS = '#ffffff';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** The appearance control cycles, so its accessible name says where it is. */
const appearanceButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Appearance: (Light|Dark|System)\./ });

async function setting(page: import('@playwright/test').Page): Promise<string> {
  const label = await appearanceButton(page).getAttribute('aria-label');
  return /^Appearance: (\w+)\./.exec(label ?? '')?.[1] ?? '';
}

/** The colours the placed square is actually DRAWN in, computed. */
async function squareInk(
  page: import('@playwright/test').Page,
): Promise<{ border: string; background: string }> {
  return page.getByRole('img', { name: 'Square', exact: true }).evaluate((el) => {
    const s = getComputedStyle(el as HTMLElement);
    return { border: s.borderTopColor, background: s.backgroundColor };
  });
}

// The painted canvas colour, read off the surface the user is looking at. The
// a11y root IS the painted element (Canvas.tsx puts the backdrop style on it),
// so read that and nothing inside it: a descendant probe picked up the first
// element with a background instead, which after dropping a shape was the
// shape.
async function canvasColour(page: import('@playwright/test').Page): Promise<string> {
  return page.locator(CANVAS).evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe('Appearance', () => {
  test('opens on the device setting, then cycles', async ({ page, pageErrors }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await justDraw(page);

    // A first-time visitor on a dark machine lands dark: System is the default
    // (spec/07), and the pre-hydration script resolves it before first paint.
    expect(await setting(page)).toBe('System');
    await expect(page.locator('html')).toHaveClass(/dark/);
    // The CANVAS comes with it, not just the chrome — a Default tab has no
    // stored colours to contradict the viewer.
    await expect.poll(() => canvasColour(page)).toBe(rgb(DARK_CANVAS));

    // Drop a shape. On the Default scheme it carries NO colours of its own, so
    // what it is drawn in is entirely the canvas's ink — the thing the merge
    // depends on, and the thing a unit test can't see reach a memoised view.
    const square = page.getByRole('img', { name: 'Square', exact: true });
    await page.getByRole('button', { name: 'Add square', exact: true }).click();
    await page.locator(CANVAS).click({ position: { x: 420, y: 300 } });
    await expect(square).toHaveCount(1);
    await expect
      .poll(async () => (await squareInk(page)).border, { message: 'element ink follows too' })
      .toBe(rgb('#a1a1aa'));

    // System → Light. An explicit pick outranks the device, which is still dark.
    await appearanceButton(page).click();
    expect(await setting(page)).toBe('Light');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect
      .poll(() => canvasColour(page), { message: 'canvas follows the appearance' })
      .toBe(rgb(LIGHT_CANVAS));
    await expect.poll(async () => (await squareInk(page)).border).toBe(rgb('#0ea5e9')); // brand-500, the light canvas's ink

    // Light → Dark, explicitly.
    await appearanceButton(page).click();
    expect(await setting(page)).toBe('Dark');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect.poll(() => canvasColour(page)).toBe(rgb(DARK_CANVAS));

    // Dark → System, back to the start of the cycle.
    await appearanceButton(page).click();
    expect(await setting(page)).toBe('System');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // The device flipping under System takes the editor with it, live.
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect.poll(() => canvasColour(page)).toBe(rgb(LIGHT_CANVAS));

    expectNoPageErrors(pageErrors);
  });

  test('changing the appearance never writes to the diagram', async ({ page, pageErrors }) => {
    // The whole reason Default resolves per viewer instead of baking a half at
    // pick time: switching chrome is not an edit. If it were, one reader's
    // appearance would travel to everyone else on the tab.
    await page.emulateMedia({ colorScheme: 'light' });
    await justDraw(page);
    await page.waitForTimeout(1500); // let the create-time autosave settle

    const writes: string[] = [];
    page.on('request', (req) => {
      if (['PUT', 'POST', 'PATCH', 'DELETE'].includes(req.method()) && req.url().includes('/api/'))
        writes.push(`${req.method()} ${new URL(req.url()).pathname}`);
    });

    await appearanceButton(page).click(); // System -> Light
    await appearanceButton(page).click(); // Light -> Dark
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.waitForTimeout(2000); // well past the autosave debounce

    // A preference write is fine (it is the user's own setting); a write to the
    // diagram, its tabs or its change log is not.
    expect(writes.filter((w) => /\/api\/diagrams/.test(w))).toEqual([]);
    expectNoPageErrors(pageErrors);
  });

  test('remembers the setting across a reload, before first paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await justDraw(page);
    await appearanceButton(page).click(); // System -> Light
    await appearanceButton(page).click(); // Light -> Dark
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    // Asserted on the FIRST paint state: the class is applied by the
    // pre-hydration script, so it is there before React mounts.
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(await setting(page)).toBe('Dark');
  });
});
