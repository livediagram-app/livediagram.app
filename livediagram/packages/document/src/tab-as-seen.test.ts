import { describe, expect, it } from 'vitest';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
} from '@liveworkspace/model-core/canvas-colors';
import { APPEARANCES, DEFAULT_SCHEME_LIGHT, THEMES, isAppearance } from './themes';
import { themeHalf } from './theme-halves';
import { tabAsSeen, themeSource } from './tab-as-seen';
import type { Tab } from './index';

// A tab as one appearance sees it (docs/specs/011-theme/light-and-dark.md), shared by exports and previews.
const tab = (over: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...over });

describe('isAppearance', () => {
  it('names light and dark, and nothing else', () => {
    for (const a of APPEARANCES) expect(isAppearance(a)).toBe(true);
    for (const other of ['system', 'Dark', '', null, undefined, 1])
      expect(isAppearance(other)).toBe(false);
  });
});

describe('themeSource', () => {
  it('reads Default as its light half and a catalogue theme as written, and nothing else', () => {
    expect(themeSource('brand')).toBe(DEFAULT_SCHEME_LIGHT);
    expect(themeSource('forest')).toBe(THEMES.find((t) => t.id === 'forest'));
    expect(themeSource(undefined)).toBeUndefined();
    expect(themeSource('nope')).toBeUndefined();
  });
});

describe('tabAsSeen', () => {
  it('draws a Default tab stored in either half in the asked half', () => {
    expect(tabAsSeen(tab(), 'dark').backgroundColor).toBe(DARK_CANVAS_BACKGROUND_COLOR);
    expect(
      tabAsSeen(tab({ backgroundColor: DARK_CANVAS_BACKGROUND_COLOR }), 'light').backgroundColor,
    ).toBe(DEFAULT_BACKGROUND_COLOR);
  });

  it('draws a catalogue theme in its asked half', () => {
    const forest = THEMES.find((t) => t.id === 'forest')!;
    const seen = tabAsSeen(
      tab({ theme: 'forest', backgroundColor: forest.backgroundColor }),
      'dark',
    );
    expect(seen.backgroundColor).not.toBe(forest.backgroundColor);
    expect(seen.backgroundColor).toBe(themeHalf(forest, 'dark').backgroundColor);
  });

  it('keeps a canvas colour someone picked', () => {
    expect(tabAsSeen(tab({ backgroundColor: '#ffe4e6' }), 'dark').backgroundColor).toBe('#ffe4e6');
  });

  it('draws an element stored by stock colour name in the ink of the asked canvas', () => {
    const square = tab({
      elements: [
        {
          id: 's',
          type: 'shape',
          shape: 'square',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          penColour: 'ink',
        },
      ],
    });
    const stroke = (a: 'light' | 'dark') =>
      (tabAsSeen(square, a).elements[0] as { strokeColor?: string }).strokeColor;
    expect(stroke('light')).not.toBe(stroke('dark'));
  });
});
