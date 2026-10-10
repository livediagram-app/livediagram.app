import { describe, expect, it } from 'vitest';
import {
  PEN_BOARDS,
  PEN_COLOUR_NAMES,
  WHITEBOARD_BOARD,
  WHITEBOARD_INK,
  YELLOW_DARK_CONTRAST,
  PEN_NEUTRAL_CHROMA,
  contrastRatio,
  hexOklch,
  isCustomPenColour,
  isPenColourName,
  nearestPenColour,
  penColourAtHue,
  penColourHueDistance,
  penColourCss,
  penColourHardToSee,
  penColourHex,
  penColourLabel,
  penContrast,
  readablePenColour,
} from './index';

// docs/specs/023-draw-mode/draw-mode.md "The colour picker": Ink and eight stock colours, each
// stored by name and drawn in the version tuned for the board it is shown on.
describe('pen stock colours', () => {
  it('names eight colours after the ink: Blue, Red, Orange, Yellow, Green, Teal, Violet, Pink', () => {
    expect(PEN_COLOUR_NAMES).toEqual([
      'blue',
      'red',
      'orange',
      'yellow',
      'green',
      'teal',
      'violet',
      'pink',
    ]);
    expect(PEN_COLOUR_NAMES.map(penColourLabel)).toEqual([
      'Blue',
      'Red',
      'Orange',
      'Yellow',
      'Green',
      'Teal',
      'Violet',
      'Pink',
    ]);
  });

  it('tunes against the whiteboard boards, whose ink is itself 4.5:1 or more', () => {
    expect(PEN_BOARDS).toEqual(WHITEBOARD_BOARD);
    for (const board of ['light', 'dark'] as const) {
      expect(contrastRatio(WHITEBOARD_INK[board], WHITEBOARD_BOARD[board])).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('draws every colour at least 4.5:1 on its board, darker on the light board', () => {
    for (const name of PEN_COLOUR_NAMES) {
      const light = penColourHex(name, 'light');
      const dark = penColourHex(name, 'dark');
      expect(light).toMatch(/^#[0-9a-f]{6}$/);
      expect(penContrast(light, 'light'), name).toBeGreaterThanOrEqual(4.5);
      expect(penContrast(dark, 'dark'), name).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(light, '#000000')).toBeLessThan(contrastRatio(dark, '#000000'));
    }
  });

  // Yellow is the lightest hue: at 6:1 on the dark board it would be mustard.
  it('draws Yellow a golden yellow on the dark board and a deep gold on the light one', () => {
    expect(penColourHex('yellow', 'dark')).toBe('#fdca04');
    expect(penContrast(penColourHex('yellow', 'dark'), 'dark')).toBeGreaterThanOrEqual(
      YELLOW_DARK_CONTRAST,
    );
    expect(penColourHex('yellow', 'light')).toBe('#775d01');
    expect(penContrast(penColourHex('yellow', 'light'), 'light')).toBeGreaterThanOrEqual(6);
  });

  it('reads names and custom colours', () => {
    expect(isPenColourName('blue')).toBe(true);
    expect(isPenColourName('blue-3')).toBe(false);
    expect(isPenColourName('#1d7afc')).toBe(false);
    expect(isCustomPenColour('#ff6b00')).toBe(true);
    expect(isCustomPenColour('blue')).toBe(false);
  });

  it('resolves a stored colour for a board: a name adapts, a custom hex stays, null is the ink', () => {
    expect(penColourCss('blue', 'light', '#000')).toBe(penColourHex('blue', 'light'));
    expect(penColourCss('blue', 'dark', '#000')).toBe(penColourHex('blue', 'dark'));
    expect(penColourCss('#ff6b00', 'dark', '#000')).toBe('#ff6b00');
    expect(penColourCss(null, 'dark', '#e2e8f0')).toBe('#e2e8f0');
  });

  // Ink is a stock colour too (docs/specs/007-editor/editor-modes.md "One look"): stored by name, drawn
  // in the board's ink for each appearance, never one of the eight hued picks.
  it("stores Ink by name and draws it in each board's ink", () => {
    expect(isPenColourName('ink')).toBe(true);
    expect(PEN_COLOUR_NAMES).not.toContain('ink');
    expect(penColourLabel('ink')).toBe('Ink');
    expect(penColourHex('ink', 'light')).toBe(WHITEBOARD_INK.light);
    expect(penColourHex('ink', 'dark')).toBe(WHITEBOARD_INK.dark);
    expect(penColourCss('ink', 'dark', '#000')).toBe(WHITEBOARD_INK.dark);
  });

  it('says which board a custom colour is hard to see on, and offers a nearby readable one', () => {
    expect(penColourHardToSee('#ffff00')).toEqual(['light']);
    expect(penColourHardToSee('#101010')).toEqual(['dark']);
    expect(penColourHardToSee('#d9480f')).toEqual([]);
    for (const hex of ['#ffff00', '#101010', '#fbfaf7', '#00ffcc', '#3300aa']) {
      const fixed = readablePenColour(hex);
      expect(penColourHardToSee(fixed), `${hex} -> ${fixed}`).toEqual([]);
    }
    expect(readablePenColour('#D9480F')).toBe('#d9480f');
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Snap colours": a neutral custom colour becomes the ink,
// any other the stock colour nearest in hue.
describe('nearestPenColour', () => {
  it('reads a colour in OKLCH', () => {
    const blue = hexOklch('#1971c2')!;
    expect(blue.l).toBeCloseTo(0.543, 3);
    expect(blue.c).toBeCloseTo(0.149, 3);
    expect(blue.h).toBeCloseTo(251.7, 1);
    expect(hexOklch('#FFFFFF')!.c).toBeLessThan(0.001);
    expect(hexOklch('blue')).toBeNull();
  });

  it.each([
    ['#1e1e1e', 'black'],
    ['#ffffff', 'white'],
    ['#868e96', 'grey'],
    ['#9ca3af', 'cool grey'],
    ['#78716c', 'warm grey'],
    ['#64748b', 'slate'],
    ['#997770', 'chroma just under the threshold'],
  ])('snaps %s (%s) to the ink', (hex) => {
    expect(nearestPenColour(hex)).toBe('ink');
  });

  it.each([
    ['#1971c2', 'blue'],
    ['#0000ff', 'blue'],
    ['#e03131', 'red'],
    ['#9f746d', 'red'],
    ['#f08c00', 'orange'],
    ['#8b4513', 'orange'],
    ['#ffd43b', 'yellow'],
    ['#2f9e44', 'green'],
    ['#ffff00', 'yellow'],
    ['#008080', 'teal'],
    ['#00ffff', 'teal'],
    ['#c0c0ff', 'violet'],
    ['#800080', 'pink'],
    ['#ff00ff', 'pink'],
    ['#d8a7b1', 'pink'],
  ])('snaps %s to %s', (hex, name) => {
    expect(nearestPenColour(hex)).toBe(name);
  });

  it.each([
    ['#d06a84', 'pink'],
    ['#d16a7e', 'red'],
    ['#d26f56', 'red'],
    ['#d17150', 'orange'],
    ['#cc872f', 'orange'],
    ['#ca892c', 'yellow'],
    ['#95a238', 'yellow'],
    ['#90a33c', 'green'],
    ['#1ba87c', 'green'],
    ['#00a882', 'teal'],
    ['#209fbc', 'teal'],
    ['#009fca', 'blue'],
    ['#7588de', 'blue'],
    ['#7c86dd', 'violet'],
    ['#b273c0', 'violet'],
    ['#b672bb', 'pink'],
  ])('takes the nearer hue just either side of a boundary: %s to %s', (hex, name) => {
    expect(nearestPenColour(hex)).toBe(name);
  });

  it('measures hue round the circle, and gives a tie to the earlier in the picker', () => {
    expect(penColourAtHue(359)).toBe('pink');
    expect(penColourAtHue(10)).toBe('red');
    expect(penColourAtHue(7.5)).toBe('red');
    expect(penColourAtHue(70)).toBe('orange');
    expect(penColourAtHue(117.5)).toBe('yellow');
    expect(penColourAtHue(275)).toBe('blue');
  });

  it('is case-insensitive and refuses anything but #rrggbb', () => {
    expect(nearestPenColour('#E03131')).toBe('red');
    for (const bad of ['', 'red', '#fff', 'transparent', 'rgb(0,0,0)', '#12345g']) {
      expect(nearestPenColour(bad)).toBeNull();
    }
  });

  it('measures hue distance round the circle', () => {
    expect(penColourHueDistance(255, 'blue')).toBe(0);
    expect(penColourHueDistance(5, 'pink')).toBe(15);
    expect(penColourHueDistance(185, 'red')).toBe(160);
  });

  it('keeps the neutral threshold in its safe range', () => {
    expect(PEN_NEUTRAL_CHROMA).toBeGreaterThanOrEqual(0.03);
    expect(PEN_NEUTRAL_CHROMA).toBeLessThanOrEqual(0.08);
  });
});

describe('hexOklch', () => {
  it('reads a #rrggbb colour as OKLCH', () => {
    const black = hexOklch('#000000');
    expect(black!.l).toBeCloseTo(0, 5);
    const white = hexOklch('#ffffff');
    expect(white!.l).toBeCloseTo(1, 3);
    expect(white!.c).toBeLessThan(0.001);
    const blue = hexOklch('#1971c2')!;
    expect(blue.h).toBeGreaterThan(245);
    expect(blue.h).toBeLessThan(260);
  });

  it('is null for anything that is not a hex colour', () => {
    expect(hexOklch('blue')).toBeNull();
    expect(hexOklch('#12345')).toBeNull();
    expect(hexOklch('#fff')).toBeNull();
  });
});

describe('Grey, the neutral stock colour', () => {
  it('is a stock name, tuned per board, and never a hue the snap measures', async () => {
    const m = await import('./pen-colours');
    expect(m.isPenColourName('grey')).toBe(true);
    expect(m.penColourLabel('grey')).toBe('Grey');
    expect(m.PEN_COLOUR_NAMES).not.toContain('grey');
    for (const board of ['light', 'dark'] as const) {
      const hex = m.penColourHex('grey', board);
      expect(m.hexOklch(hex)!.c).toBeLessThan(0.01);
      expect(m.penContrast(hex, board)).toBeGreaterThanOrEqual(m.PEN_STOCK_CONTRAST - 0.2);
      expect(hex).not.toBe(m.penColourHex('ink', board));
    }
  });
});
