import { describe, expect, it } from 'vitest';
import { createText } from './factories';
import { layOutPages, type Page } from './page';
import { darkSlideBackground } from './recipe-slides';
import { resolveThemeIn, tabWithTheme } from './tab-theme-apply';
import type { Element, Tab } from './index';

// docs/specs/011-theme/light-and-dark.md "A page's own paper": a theme lands on each element in the half its page draws
// it in; elements on the plain paper or off every page take the applier's half.

const dark: Page = {
  id: 'd',
  orientation: 'landscape',
  size: 'slide',
  kind: 'slide',
  background: darkSlideBackground('midnight'),
};
const paper: Page = { id: 'p', orientation: 'landscape', size: 'slide', kind: 'slide' };
const ink = (theme: string, half: 'light' | 'dark') => resolveThemeIn(theme, half)!.elementText!;

function tabOn(pages: Page[], theme = 'midnight'): Tab {
  const laid = layOutPages(pages);
  const words: Element[] = laid.map((p) => ({
    ...createText(p.rect.x + 40, p.rect.y + 40),
    id: `t-${p.id}`,
    label: 'Words',
    textColor: ink(theme, 'light'),
  }));
  const off = {
    ...createText(-5000, -5000),
    id: 'off',
    label: 'Off',
    textColor: ink(theme, 'light'),
  } as Element;
  return { id: 't', name: 'Deck', theme, elements: [...words, off], pages };
}
const colourOf = (tab: Tab, id: string) =>
  (tab.elements.find((e) => e.id === id) as { textColor?: string }).textColor;

describe('tabWithTheme on pages of their own', () => {
  it('gives a dark page’s words the dark half and the rest the applier’s', () => {
    const out = tabWithTheme(tabOn([dark, paper]), 'forest', 'light');
    expect(colourOf(out, 't-d')).toBe(ink('forest', 'dark'));
    expect(colourOf(out, 't-p')).toBe(ink('forest', 'light'));
    expect(colourOf(out, 'off')).toBe(ink('forest', 'light'));
    expect(out.theme).toBe('forest');
  });

  it('keeps a tab with no filled page in the applier’s half', () => {
    const out = tabWithTheme(tabOn([paper]), 'ocean', 'dark');
    expect(colourOf(out, 't-p')).toBe(ink('ocean', 'dark'));
    expect(colourOf(out, 'off')).toBe(ink('ocean', 'dark'));
  });

  it('resets a tab on an unknown theme in each element’s half', () => {
    const out = tabWithTheme({ ...tabOn([dark, paper]), theme: 'nope' }, 'sunset', 'light');
    expect(out.theme).toBe('sunset');
    expect(colourOf(out, 't-d')).toBe(ink('sunset', 'dark'));
    expect(colourOf(out, 't-p')).toBe(ink('sunset', 'light'));
  });
});
