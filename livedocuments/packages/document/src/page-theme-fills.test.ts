import { describe, expect, it } from 'vitest';
import { defaultPageBackground } from './page-default-background';
import {
  PAGE_MOTION_COLOURINGS,
  colouringOf,
  followedFill,
  isThemeOwnFill,
  motionFill,
  themeBackgroundPresets,
  themeGradientFill,
  withPageBackgroundsFollowingTheme,
} from './page-theme-fills';
import { themePresetColors } from './theme-presets';
import { getBuiltInTheme } from './themes';
import type { Element, Page, PageFill, Tab } from './index';

const ocean = getBuiltInTheme('ocean');
const forest = getBuiltInTheme('forest');
const tabOn = (...fills: (PageFill | undefined)[]): Pick<Tab, 'elements' | 'pages'> => ({
  elements: [] as Element[],
  pages: fills.map((fill, i): Page => ({
    id: `page-${i + 1}`,
    orientation: 'portrait',
    kind: 'infographic',
    ...(fill ? { background: { fill } } : {}),
  })),
});

describe('page-theme-fills: the backgrounds that are the theme’s own', () => {
  it('names each Theme gradient', () => {
    expect(themeGradientFill(ocean, 'dusk')).toEqual(
      themeBackgroundPresets(ocean).find((p) => p.id === 'theme-dusk')!.fill,
    );
  });

  it('keeps an animated background’s speed, leaving its own pace off', () => {
    expect(motionFill(ocean, 'aurora', 'night', 1)).not.toHaveProperty('speed');
    const fast = motionFill(ocean, 'aurora', 'night', 2);
    expect(followedFill(fast, ocean, forest)).toEqual(motionFill(forest, 'aurora', 'night', 2));
  });

  it('follows every colouring, and a theme to itself moves nothing', () => {
    for (const { id } of PAGE_MOTION_COLOURINGS) {
      const fill = motionFill(ocean, 'mesh', id);
      expect(colouringOf(ocean, fill)).toBe(id);
      expect(followedFill(fill, ocean, forest)).toEqual(motionFill(forest, 'mesh', id));
    }
    const same = tabOn(themeGradientFill(ocean, 'ink'));
    expect(withPageBackgroundsFollowingTheme(same, ocean, ocean)).toBe(same);
  });

  it('leaves an animated background in colours of someone’s own, and a page with only a pattern', () => {
    const motion = motionFill(ocean, 'mesh', 'deep');
    if (motion.kind !== 'gradient') throw new Error('an animated background is a gradient');
    const own: PageFill = { ...motion, from: '#123456' };
    expect(followedFill(own, ocean, forest)).toBeUndefined();
    expect(
      followedFill({ kind: 'gradient', from: '#123456', to: '#654321', angle: 160 }, ocean, forest),
    ).toBeUndefined();
    const patterned = tabOn(themeGradientFill(ocean, 'ink'));
    patterned.pages!.push({
      id: 'page-2',
      orientation: 'portrait',
      kind: 'infographic',
      background: {},
    });
    const out = withPageBackgroundsFollowingTheme(patterned, ocean, forest);
    expect(out.pages![1]!.background?.fill).toBeUndefined();
  });

  it('finds no colouring for a solid or a gradient of someone’s own', () => {
    expect(colouringOf(ocean, { kind: 'solid', color: '#123456' })).toBeUndefined();
    expect(colouringOf(ocean, undefined)).toBeUndefined();
  });

  it('carries the Theme Palette by place and leaves a picture', () => {
    const [first] = themePresetColors(ocean).filter((c) => c.toLowerCase() !== '#ffffff');
    expect(isThemeOwnFill({ kind: 'solid', color: first! }, ocean)).toBe(true);
    expect(isThemeOwnFill({ kind: 'solid', color: '#123456' }, ocean)).toBe(false);
    expect(
      followedFill({ kind: 'image', imageId: 'i' } as unknown as PageFill, ocean, forest),
    ).toBeUndefined();
  });

  it('a new infographic page’s default follows the theme as a Theme gradient does', () => {
    const fill = defaultPageBackground(ocean).fill!;
    expect(isThemeOwnFill(fill, ocean)).toBe(true);
    expect(followedFill(fill, ocean, forest)).toEqual(defaultPageBackground(forest).fill);
  });

  it('moves only the pages on the old theme’s fills, and leaves a tab with none as it was', () => {
    const plain = tabOn(undefined);
    expect(withPageBackgroundsFollowingTheme(plain, ocean, forest)).toBe(plain);
    const own = tabOn({ kind: 'solid', color: '#123456' });
    expect(withPageBackgroundsFollowingTheme(own, ocean, forest)).toBe(own);
    const out = withPageBackgroundsFollowingTheme(
      tabOn(themeGradientFill(ocean, 'glow'), { kind: 'solid', color: '#123456' }),
      ocean,
      forest,
    );
    expect(out.pages!.map((p) => p.background?.fill)).toEqual([
      themeGradientFill(forest, 'glow'),
      { kind: 'solid', color: '#123456' },
    ]);
  });
});
