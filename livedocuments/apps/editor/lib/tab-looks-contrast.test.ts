import { describe, expect, it } from 'vitest';
import {
  canvasSurface,
  contrastRatio,
  defaultArrowStrokeColor,
  THEME_LINE_CONTRAST,
  THEME_TEXT_CONTRAST,
  viewElementInTheme,
  type Appearance,
  type Element,
  sketchRandom,
  type Tab,
} from '@livedocuments/document';
import { rollMashup } from './look-mashup';
import { SEASONAL_LOOKS } from './seasonal-looks';
import { TAB_LOOKS, withLookApplied, type TabLook } from './tab-looks';
import { resolveTabBackdrop, themeViewMap } from './themes';

// docs/specs/011-theme/canvas-and-theme-dialog.md "Looks": every one-click look stays readable in both appearances.
// A look is applied (in the light half, as a light-mode picker would) to a tab holding a box and an arrow, then drawn
// for a light and a dark viewer: the box's text on its fill at 4.5:1, its outline and the arrow on the canvas at 3:1.
const tab = (): Tab =>
  ({
    id: 't',
    name: 'Tab',
    elements: [
      {
        id: 'b',
        type: 'shape',
        shape: 'rectangle',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        label: 'Box',
      },
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 100 },
        to: { kind: 'free', x: 100, y: 100 },
      },
    ],
  }) as unknown as Tab;

// The ink helpers speak `rgb(r g b)` as well as hex; the ratio reads hex. A ratio that cannot be read fails.
const hex = (c: string) => {
  const m = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(c);
  return m
    ? '#' +
        m
          .slice(1)
          .map((n) => Number(n).toString(16).padStart(2, '0'))
          .join('')
    : c;
};
const below = (fg: string, bg: string, min: number) => !(contrastRatio(hex(fg), hex(bg)) >= min);

// The Mashup card's random looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Mashup"), a seeded spread of them.
const MASHUP_SAMPLES = 120;
const mashupRandom = sketchRandom(42);
const mashups: TabLook[] = Array.from({ length: MASHUP_SAMPLES }, () =>
  rollMashup({ random: mashupRandom }),
);

describe('every look and mashup is accessible in both appearances', () => {
  for (const [i, look] of [...TAB_LOOKS, ...SEASONAL_LOOKS, ...mashups].entries()) {
    for (const appearance of ['light', 'dark'] as Appearance[]) {
      it(`${look.id === 'mashup' ? `mashup ${i} (${look.description})` : look.id} (${appearance})`, () => {
        const styled = withLookApplied(tab(), look);
        const map = themeViewMap(styled.theme, appearance);
        const canvas = resolveTabBackdrop(styled, appearance).backgroundColor;
        const [box, arrow] = styled.elements.map((el) => viewElementInTheme(el, map)) as [
          Element & { fillColor?: string; strokeColor?: string; textColor?: string },
          Element & { strokeColor?: string },
        ];
        const problems: string[] = [];
        if (
          box.textColor &&
          contrastRatio(box.textColor, box.fillColor ?? canvas) < THEME_TEXT_CONTRAST
        )
          problems.push(`text ${box.textColor} on ${box.fillColor}`);
        if (box.strokeColor && below(box.strokeColor, canvas, THEME_LINE_CONTRAST))
          problems.push(`outline ${box.strokeColor} on ${canvas}`);
        // An uncoloured arrow (Default leaves it unset) draws in the canvas's ink.
        const arrowInk = arrow.strokeColor ?? defaultArrowStrokeColor(canvasSurface(canvas));
        if (below(arrowInk, canvas, THEME_LINE_CONTRAST))
          problems.push(`arrow ${arrowInk} on ${canvas}`);
        expect(problems).toEqual([]);
      });
    }
  }
});
