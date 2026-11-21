import { expect, test, expectNoPageErrors } from './fixtures';
import { newServerKnowledgebase, writeLines } from './knowledgebase';

// Appearance (docs/specs/007-editor/editor-app.md) end to end: the three settings on the real control, and
// the thing the merge was for: a page on the Default theme repainting
// with the viewer, without writing to the knowledgebase.
//
// Unit tests can only say the store resolves and the helpers return the right
// hex. Whether the canvas a reader is looking at actually changes needs the
// editor, because it depends on a context reaching memoised element views.

const CANVAS = '[data-canvas-a11y-root]';

// A new knowledgebase on the Default colour scheme, on the server so a write to it would be a request to see.
const startBlank = newServerKnowledgebase;
// The page's ground follows the appearance alone (lib/view-backdrop.ts): white in light, and in dark the chrome's
// own surface, the lime theme's slate-900 for a new knowledgebase (knowledgeDarkGround,
// docs/specs/030-knowledgebase/blueprints/page-surface.md "Knowledgebase Style (built)").
const DARK_CANVAS = '#131b26';
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
    await startBlank(page);

    // A first-time visitor on a dark machine lands dark: System is the default
    // (docs/specs/007-editor/editor-app.md), and the pre-hydration script resolves it before first paint.
    expect(await setting(page)).toBe('System');
    await expect(page.locator('html')).toHaveClass(/dark/);
    // The CANVAS comes with it, not just the chrome — a Default tab has no
    // stored colours to contradict the viewer.
    await expect.poll(() => canvasColour(page)).toBe(rgb(DARK_CANVAS));

    // What is written is drawn on the page's own paper, whatever the appearance.
    await writeLines(page, 'Written in the dark.');

    // System → Light. An explicit pick outranks the device, which is still dark.
    await appearanceButton(page).click();
    expect(await setting(page)).toBe('Light');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect
      .poll(() => canvasColour(page), { message: 'canvas follows the appearance' })
      .toBe(rgb(LIGHT_CANVAS));
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

  test('changing the appearance never writes to the document', async ({ page, pageErrors }) => {
    // The whole reason Default resolves per viewer instead of baking a half at
    // pick time: switching chrome is not an edit. If it were, one reader's
    // appearance would travel to everyone else on the tab.
    await page.emulateMedia({ colorScheme: 'light' });
    await startBlank(page);
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
    // document or its tabs is not.
    expect(writes.filter((w) => /\/api\/documents/.test(w))).toEqual([]);
    expectNoPageErrors(pageErrors);
  });

  test('tells Dark Reader to stand down, in the served head', async ({ page }) => {
    // Asserted on the rendered page, not the metadata object: Next drops a meta
    // whose content is empty, and a unit test on the object passed while the
    // page carried nothing.
    await page.goto('/new');
    await expect(page.locator('head meta[name="darkreader-lock"]')).toHaveCount(1);
  });

  test('remembers the setting across a reload, before first paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await startBlank(page);
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
