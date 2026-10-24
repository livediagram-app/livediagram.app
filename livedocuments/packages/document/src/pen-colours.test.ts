import { describe, expect, it } from 'vitest';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
} from '@liveworkspace/model-core/canvas-colors';
import {
  PEN_BOARDS,
  PEN_COLOUR_NAMES,
  PEN_INK,
  YELLOW_DARK_CONTRAST,
  contrastRatio,
  hexOklch,
  isPenColourName,
  penColourHardToSee,
  penColourHex,
  penColourLabel,
  penContrast,
  readablePenColour,
} from './index';

// docs/specs/004-interface-design/colour-picker.md "The colours": Ink and eight stock colours, each
// stored by name and drawn in the version tuned for the canvas it is shown on.
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

  it("tunes against the Default theme's canvases, whose ink is itself 4.5:1 or more", () => {
    expect(PEN_BOARDS).toEqual({
      light: DEFAULT_BACKGROUND_COLOR,
      dark: DARK_CANVAS_BACKGROUND_COLOR,
    });
    for (const board of ['light', 'dark'] as const) {
      expect(contrastRatio(PEN_INK[board], PEN_BOARDS[board])).toBeGreaterThanOrEqual(4.5);
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

  it('reads names', () => {
    expect(isPenColourName('blue')).toBe(true);
    expect(isPenColourName('blue-3')).toBe(false);
    expect(isPenColourName('#1d7afc')).toBe(false);
  });

  // Ink is a stock colour too (docs/specs/008-canvas/canvas-and-palette.md "Colours"): stored by name, drawn
  // in the board's ink for each appearance, never one of the eight hued picks.
  it("stores Ink by name and draws it in each board's ink", () => {
    expect(isPenColourName('ink')).toBe(true);
    expect(PEN_COLOUR_NAMES).not.toContain('ink');
    expect(penColourLabel('ink')).toBe('Ink');
    expect(penColourHex('ink', 'light')).toBe(PEN_INK.light);
    expect(penColourHex('ink', 'dark')).toBe(PEN_INK.dark);
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

describe('OKLCH', () => {
  it('reads a colour in OKLCH', () => {
    const blue = hexOklch('#1971c2')!;
    expect(blue.l).toBeCloseTo(0.543, 3);
    expect(blue.c).toBeCloseTo(0.149, 3);
    expect(blue.h).toBeCloseTo(251.7, 1);
    expect(hexOklch('#FFFFFF')!.c).toBeLessThan(0.001);
    expect(hexOklch('blue')).toBeNull();
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
