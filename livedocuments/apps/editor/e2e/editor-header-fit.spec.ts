import { expect, expectNoPageErrors, openStartBlank, test } from './fixtures';

// The header fits every width (docs/specs/007-editor/editor-app.md "Header actions"; Work Tracker 731): the name
// truncates first, so the visibility pill, the role pill and the right edge's actions never run into each other or
// into the name, from a 320 px phone up. The header is one copy for every editor (@liveworkspace/workbench
// EditorHeader), so this sweep, run here, holds it for all five. A guest's blank document is in This Browser, the
// widest pill, beside Editing: the pair that overlapped at 650 px.

// As long as a name may be (longer ones are cut short as they are saved).
const LONG_NAME = 'Quarterly planning review with every team and roadmaps';
const WIDTHS = Array.from({ length: (1440 - 320) / 10 + 1 }, (_, i) => 320 + i * 10);

test('the header name, pills and actions never overlap from 320 px up', async ({
  page,
  pageErrors,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openStartBlank(page);
  const header = page.locator('header[data-region="header"]');
  // A long name, so the title has to give way at every width.
  await header.getByRole('button', { name: /Untitled/ }).click();
  const field = header.getByRole('textbox');
  await field.fill(LONG_NAME);
  await field.press('Enter');
  await expect(header.getByRole('button', { name: LONG_NAME })).toBeVisible();
  await expect(header.locator('[data-header-pills]')).toContainText('This Browser');

  // Nothing hovered or focused, so no legend or hover card is open over the bar.
  await page.mouse.move(0, 700);
  await page.locator('[data-canvas-a11y-root]').focus();
  const overlaps: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    const found = await page.evaluate(() => {
      const bar = document.querySelector('header[data-region="header"]')!;
      // Where a part paints, not only its box: a pill squeezed narrower than its words still paints them past its
      // edge (the 650 px overlap), so its extent takes in every element inside it. The name clips its own text.
      const box = (el: Element | null | undefined) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        let { left, right } = r;
        for (const inner of el.querySelectorAll('*')) {
          const b = inner.getBoundingClientRect();
          // A popover the pill opens (its legend, a hover card) is not the pill.
          if (
            b.width === 0 ||
            b.height === 0 ||
            inner.closest('[data-visibility-legend], [role="tooltip"]')
          )
            continue;
          left = Math.min(left, b.left);
          right = Math.max(right, b.right);
        }
        return { left, right };
      };
      const pills = bar.querySelector('[data-header-pills]');
      const parts: [string, { left: number; right: number } | null][] = [
        ['name', box(bar.querySelector('[data-header-pills]')?.previousElementSibling)],
        ['visibility', box(pills?.firstElementChild)],
        ['role', box(pills?.children[1])],
        ['actions', box(bar.lastElementChild)],
      ];
      const shown = parts.filter(
        (p): p is [string, { left: number; right: number }] => p[1] !== null,
      );
      const hits: string[] = [];
      // Side by side on one row, so a later part must start at or after the earlier one ends (half a pixel for
      // subpixel layout).
      for (let i = 1; i < shown.length; i++) {
        const [a, ra] = shown[i - 1]!;
        const [b, rb] = shown[i]!;
        if (rb.left < ra.right - 0.5)
          hits.push(`${a}/${b} by ${(ra.right - rb.left).toFixed(1)}px`);
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
