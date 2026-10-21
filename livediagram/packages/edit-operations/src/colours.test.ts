import { describe, expect, it } from 'vitest';
import { getBuiltInTheme, quickSwatchColor, type Element } from '@livediagram/document';
import { fillSlotNames, isHexColour, resolveColourValue } from './colours';

const theme = getBuiltInTheme(undefined);
const square = {
  id: 's',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
} as Element;
const sticky = { id: 'k', type: 'sticky', x: 0, y: 0, width: 1, height: 1 } as Element;

describe('resolveColourValue (EO21, EO49)', () => {
  it("names the theme's slots: theme and six hues", () => {
    expect([...fillSlotNames(theme).keys()]).toEqual([
      'theme',
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'violet',
    ]);
  });

  it('binds a slot, so it follows a theme change', () => {
    expect(resolveColourValue(square, 'Green', theme)).toEqual({
      patch: { fillColor: quickSwatchColor(theme, 'fill', 4), fillSwatch: 4 },
      overridesTheme: false,
    });
    expect(resolveColourValue(square, 'theme', theme)).toEqual({
      patch: { fillColor: quickSwatchColor(theme, 'fill', 0), fillSwatch: undefined },
      overridesTheme: false,
    });
  });

  it('takes a hex as an override, and refuses anything else with the slot names', () => {
    expect(resolveColourValue(square, '#ff0000', theme)).toEqual({
      patch: { fillColor: '#ff0000', fillSwatch: undefined },
      overridesTheme: true,
    });
    expect(resolveColourValue(square, 'chartreuse', theme)).toEqual({
      rule: 'a theme colour or a hex',
      allowed: ['theme', 'red', 'orange', 'yellow', 'green', 'blue', 'violet'],
    });
  });

  it("gives a sticky its palette's pairs, or a hex without a warning", () => {
    expect(resolveColourValue(sticky, 'Lemon', theme)).toEqual({
      patch: { fillColor: '#fef08a', textColor: '#422006' },
      overridesTheme: false,
    });
    expect(resolveColourValue(sticky, '#abc', theme)).toEqual({
      patch: { fillColor: '#abc' },
      overridesTheme: false,
    });
    const refusal = resolveColourValue(sticky, 'green', theme);
    expect('rule' in refusal && refusal.allowed.slice(0, 3)).toEqual(['classic', 'lemon', 'peach']);
  });

  it('knows a hex', () => {
    expect([
      isHexColour('#fff'),
      isHexColour('#ffffff'),
      isHexColour('#ffff'),
      isHexColour(3),
    ]).toEqual([true, true, false, false]);
  });
});
