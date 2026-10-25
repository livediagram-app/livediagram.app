import { createInMode, expect, expectNoPageErrors, test } from './fixtures';

// The start's mode switch (docs/specs/007-editor/start-diagramming.md "Changing mode"): a mode change turns the
// panel in place as a View Transition of the start alone, on the short token; under reduced motion it starts none
// (docs/specs/004-interface-design/motion.md "View Transitions").

type Probe = { calls: number; animations: { pseudo: string; ms: number }[] };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: Probe };
    w.__vt = { calls: 0, animations: [] };
    const start = Document.prototype.startViewTransition;
    if (!start) return;
    Document.prototype.startViewTransition = function (this: Document, ...args) {
      w.__vt.calls++;
      const transition = start.apply(this, args as never);
      void transition.ready.then(() => {
        for (const a of document.getAnimations()) {
          const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement ?? '';
          if (pseudo.startsWith('::view-transition'))
            w.__vt.animations.push({ pseudo, ms: Number(a.effect?.getTiming().duration) });
        }
      });
      return transition;
    } as typeof start;
  });
});

async function switchToDraw(page: import('@playwright/test').Page) {
  await createInMode(page, 'diagram');
  const chip = page
    .locator('[data-start-mode-switch]')
    .getByRole('button', { name: /^Tab mode: Diagram/ });
  await chip.click();
  await page.getByRole('menuitemradio', { name: /Draw/ }).click();
  await expect(
    page.locator('[data-start-mode-switch]').getByRole('button', { name: /^Tab mode: Draw/ }),
  ).toBeVisible();
  return page.evaluate(() => (window as unknown as { __vt: Probe }).__vt);
}

test('a mode change turns the start in place, and only the start', async ({ page, pageErrors }) => {
  const vt = await switchToDraw(page);
  expect(vt.calls).toBe(1);
  // The pictures the browser animates: the start's own, never the page root's, on the short token. (React's own
  // zero-length animations on `::view-transition-group(root)` and `::view-transition` are how it keeps the root
  // out and the page interactive; they draw nothing.)
  const pictures = vt.animations.filter((a) => /^::view-transition-(old|new)\(/.test(a.pseudo));
  expect(pictures.length).toBeGreaterThan(0);
  expect(pictures.filter((a) => a.pseudo.includes('(root)'))).toEqual([]);
  expect(pictures.every((a) => a.ms === 200)).toBe(true);
  expectNoPageErrors(pageErrors);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a mode change starts no View Transition', async ({ page, pageErrors }) => {
    const vt = await switchToDraw(page);
    expect(vt.calls).toBe(0);
    expectNoPageErrors(pageErrors);
  });
});
