import { expect, expectNoPageErrors, openStartBlank, test } from './fixtures';

// The top row fits every width (docs/specs/007-editor/editor-app.md "Header actions"; Work Tracker 731). With no header
// bar (experiment) the top row is the logo, the menu card, the palette and the corner card (Share and the account),
// floating over the canvas: none of them may run into another, from a 320 px phone up, and the page never scrolls
// sideways. The cards are one copy for every editor (@liveworkspace/workbench ToolbarMenuCard, MenuCardLogo,
// EditorCornerActions), so this sweep, run here, holds them for all five.

const WIDTHS = Array.from({ length: (1440 - 320) / 10 + 1 }, (_, i) => 320 + i * 10);

test('the top row’s logo, menu, palette and corner card never overlap from 320 px up', async ({
  page,
  pageErrors,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openStartBlank(page);
  await expect(page.locator('header[data-region="header"]')).toHaveCount(0);
  await expect(page.locator('[data-corner-actions]')).toBeVisible();

  // Nothing hovered or focused, so no hover card or menu is open over the row.
  await page.mouse.move(0, 700);
  await page.locator('[data-canvas-a11y-root]').focus();
  const overlaps: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    const found = await page.evaluate(() => {
      // Where a part paints: its box and every shown element inside it (a popover or tooltip it opens is not it).
      const box = (el: Element | null | undefined) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        let { left, right, top, bottom } = r;
        for (const inner of el.querySelectorAll('*')) {
          const b = inner.getBoundingClientRect();
          if (
            b.width === 0 ||
            b.height === 0 ||
            inner.closest('[role="tooltip"], [role="menu"], [role="dialog"]')
          )
            continue;
          left = Math.min(left, b.left);
          right = Math.max(right, b.right);
          top = Math.min(top, b.top);
          bottom = Math.max(bottom, b.bottom);
        }
        return { left, right, top, bottom };
      };
      const menu = document.querySelector('[data-toolbar-menu]');
      // The logo's own card beside the menu card (MenuCardLogo), where it shows.
      const logo = menu?.parentElement?.querySelector(':scope > :not([data-toolbar-menu])');
      const strip = document.querySelector('[data-toolbar-palette]:not(.hidden)');
      const parts = [
        ['logo', box(logo && !logo.contains(menu) ? logo : null)],
        ['menu', box(menu)],
        // A phone's strip row holds the menu too: its other cards are the palette's.
        ...[...(strip?.children ?? [])]
          .filter((c) => !menu || !c.contains(menu))
          .map((c, i) => [`palette ${i + 1}`, box(c)] as const),
        ['corner card', box(document.querySelector('[data-corner-actions]')?.firstElementChild)],
      ].filter(
        (p): p is [string, { left: number; right: number; top: number; bottom: number }] =>
          p[1] !== null,
      );
      const hits: string[] = [];
      // Any two that share both some width and some height overlap (half a pixel for subpixel layout).
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) {
          const [a, ra] = parts[i]!;
          const [b, rb] = parts[j]!;
          const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (x > 0.5 && y > 0.5) hits.push(`${a}/${b} by ${x.toFixed(1)}px`);
        }
      if (document.documentElement.scrollWidth > window.innerWidth)
        hits.push('page scrolls sideways');
      return hits;
    });
    for (const hit of found) overlaps.push(`${width}px: ${hit}`);
  }
  expect(overlaps).toEqual([]);
  expectNoPageErrors(pageErrors);
});
