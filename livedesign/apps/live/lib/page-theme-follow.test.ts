import { describe, expect, it } from 'vitest';
import {
  defaultPageBackground,
  getBuiltInTheme,
  pagesOf,
  type PageFill,
  type Tab,
} from '@livedesign/design';
import { themeBackgroundPresets } from './page-paint';
import { motionFill } from './page-motion';
import { followedFill, withPageBackgroundsFollowingTheme } from './page-theme-follow';
import { themePresetColors } from './themes';

// docs/specs/007-editor/pages-mode.md "Backgrounds": a page on a fill of the theme's own
// follows a theme change; a colour someone picked stays.
const ocean = getBuiltInTheme('ocean');
const forest = getBuiltInTheme('forest');
const tabOn = (fill: PageFill) =>
  ({
    id: 't',
    name: 'T',
    elements: [
      {
        id: 'h',
        type: 'text',
        x: -300,
        y: -400,
        width: 300,
        height: 40,
        label: 'Hi',
        textColor: '#0f172a',
      },
    ],
    pages: [{ id: 'p', orientation: 'portrait', kind: 'wireframe', background: { fill } }],
  }) as unknown as Tab;
const fillOf = (t: Tab) => pagesOf(t)[0]!.background?.fill;

describe('page backgrounds follow the theme', () => {
  it('moves a theme gradient to the same one of the new theme', () => {
    const dusk = themeBackgroundPresets(ocean).find((p) => p.id === 'theme-dusk')!.fill;
    const want = themeBackgroundPresets(forest).find((p) => p.id === 'theme-dusk')!.fill;
    expect(followedFill(dusk, ocean, forest)).toEqual(want);
  });

  it("moves the default Mist, so a new page's background keeps matching", () => {
    const out = withPageBackgroundsFollowingTheme(
      tabOn(defaultPageBackground(ocean).fill!),
      ocean,
      forest,
    );
    expect(fillOf(out)).toEqual(defaultPageBackground(forest).fill);
  });

  it('keeps an animated background its motion and colouring', () => {
    expect(followedFill(motionFill(ocean, 'aurora', 'night'), ocean, forest)).toEqual(
      motionFill(forest, 'aurora', 'night'),
    );
  });

  it("moves a Theme Palette colour to the new palette's same place", () => {
    const before = themePresetColors(ocean).filter((c) => !/^#?f{3}(f{3})?$/i.test(c));
    const after = themePresetColors(forest).filter((c) => !/^#?f{3}(f{3})?$/i.test(c));
    expect(followedFill({ kind: 'solid', color: before[2]! }, ocean, forest)).toEqual({
      kind: 'solid',
      color: after[2],
    });
  });

  it("leaves someone's own colour, a picture's page and an unchanged tab as they are", () => {
    expect(followedFill({ kind: 'solid', color: '#123456' }, ocean, forest)).toBeUndefined();
    const own = tabOn({ kind: 'gradient', from: '#111111', to: '#222222', angle: 160 });
    expect(withPageBackgroundsFollowingTheme(own, ocean, forest)).toBe(own);
  });

  it('re-inks what is on a page whose fill moved to a dark one', () => {
    const light = themeBackgroundPresets(ocean).find((p) => p.id === 'theme-ink')!.fill;
    const out = withPageBackgroundsFollowingTheme(tabOn(light), ocean, forest);
    expect(fillOf(out)).not.toEqual(light);
    expect((out.elements[0] as { textColor: string }).textColor).not.toBe('#0f172a');
  });
});

describe('custom animated colours and the theme', () => {
  it('stay as they are when the theme changes', () => {
    const own: PageFill = {
      kind: 'gradient',
      from: '#ff0066',
      to: '#330099',
      angle: 160,
      motion: 'lava',
    };
    expect(followedFill(own, ocean, forest)).toBeUndefined();
  });
});
