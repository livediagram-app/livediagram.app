import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { getBuiltInTheme, themedForTab } from './themes';
import { themeHalf } from './theme-halves';
import { isLightColor } from './colors';
import type { Element } from './index';

// docs/specs/007-editor/pages-mode.md "Layouts": a placed layout takes its tab's theme where it sets no colour.
describe('a layout in its tab’s theme', () => {
  const bare = { ...createShape('circle', 0, 0), id: 'c' } as Element;
  const accented = { ...createShape('square', 0, 0), id: 's', fillColor: '#ff0000' } as Element;

  it('fills each unset colour from a built-in theme, keeping the colours the layout set', () => {
    const mocha = getBuiltInTheme('mocha');
    const [circle, square] = themedForTab([bare, accented], 'mocha') as (Element & {
      fillColor?: string;
      strokeColor?: string;
    })[];
    expect(circle!.strokeColor).toBe(mocha.elementStroke);
    expect(square!.fillColor).toBe('#ff0000');
  });

  it('takes the theme’s dark half on a dark page, so its words read light there', () => {
    const text = { ...createShape('square', 0, 0), id: 't', label: 'Title' } as Element;
    const [onDark] = themedForTab([text], 'ocean', { dark: true }) as (Element & {
      textColor?: string;
    })[];
    const [onLight] = themedForTab([text], 'ocean') as (Element & { textColor?: string })[];
    const dark = themeHalf(getBuiltInTheme('ocean'), 'dark');
    expect(onDark!.textColor).toBe(dark.elementText);
    expect(isLightColor(onDark!.textColor!)).toBe(true);
    expect(isLightColor(onLight!.textColor!)).toBe(false);
  });

  it('leaves it as built on the default scheme, an unknown theme, or no theme', () => {
    for (const id of [undefined, 'brand', 'custom-1234'])
      expect(themedForTab([bare], id)).toEqual([bare]);
  });
});
