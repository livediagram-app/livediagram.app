import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test, openJustDraw } from './fixtures';

// Scrollbars are in-theme everywhere (docs/specs/004-interface-design/scrollbars.md): no surface that
// scrolls is left on the operating system's default, in either appearance.

async function openEditor(page: Page, scheme: 'dark' | 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  await openJustDraw(page);
}

// Every element on the page that scrolls, with the thumb colour it resolves
// to, beside what the theme's slate 500 resolves to on this page.
function scrollingSurfaces(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-slate-500)';
    document.body.appendChild(probe);
    const themed = getComputedStyle(probe).color;
    probe.remove();
    const surfaces: { where: string; thumb: string; width: string }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      const style = getComputedStyle(el);
      const scrolls =
        (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) ||
        (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth);
      if (!scrolls) continue;
      // 'auto', or '<thumb> <track>' with a transparent track.
      const thumb = style.scrollbarColor.replace(/\s+(transparent|rgba\(0, 0, 0, 0\))$/, '');
      surfaces.push({
        where: `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join('.')}`,
        thumb,
        width: style.scrollbarWidth,
      });
    }
    return { themed, surfaces };
  });
}

for (const scheme of ['dark', 'light'] as const) {
  test(`every scrolling surface is in-theme (${scheme})`, async ({ page, pageErrors }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await openEditor(page, scheme);
    // Settings is the tallest scroller the editor opens.
    await page.getByRole('button', { name: 'Application settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).waitFor();
    const { themed, surfaces } = await scrollingSurfaces(page);
    expect(surfaces.length).toBeGreaterThan(0);
    const offTheme = surfaces.filter((s) => s.width !== 'none' && s.thumb !== themed);
    expect(offTheme).toEqual([]);
    expectNoPageErrors(pageErrors);
  });
}
