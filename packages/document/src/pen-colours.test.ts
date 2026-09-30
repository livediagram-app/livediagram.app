import { describe, expect, it } from 'vitest';
import {
  PEN_BOARDS,
  PEN_COLOUR_NAMES,
  WHITEBOARD_BOARD,
  WHITEBOARD_INK,
  contrastRatio,
  isCustomPenColour,
  isPenColourName,
  penColourCss,
  penColourHardToSee,
  penColourHex,
  penColourLabel,
  penContrast,
  readablePenColour,
} from './index';

// docs/specs/023-whiteboard/whiteboard.md "The colour picker": Ink and seven stock colours, each
// stored by name and drawn in the version tuned for the board it is shown on.
describe('pen stock colours', () => {
  it('names seven colours after the ink: Blue, Red, Orange, Green, Teal, Violet, Pink', () => {
    expect(PEN_COLOUR_NAMES).toEqual(['blue', 'red', 'orange', 'green', 'teal', 'violet', 'pink']);
    expect(PEN_COLOUR_NAMES.map(penColourLabel)).toEqual([
      'Blue',
      'Red',
      'Orange',
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

  it('reads names and custom colours', () => {
    expect(isPenColourName('blue')).toBe(true);
    expect(isPenColourName('blue-3')).toBe(false);
    expect(isPenColourName('ink')).toBe(false);
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
