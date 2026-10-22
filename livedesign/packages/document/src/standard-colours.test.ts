import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { PEN_BOARDS, PEN_INK, isPenColourName, penColourHex, penColourLabel } from './pen-colours';
import {
  STANDARD_COLOUR_NAMES,
  SOFT_WHITE,
  isHexColour,
  standardColourAt,
  standardColours,
} from './standard-colours';

const APPEARANCES = ['light', 'dark'] as const;

describe('standard colours', () => {
  it('are the same ten names, in order, in both tones and appearances', () => {
    for (const tone of ['strong', 'soft'] as const)
      for (const a of APPEARANCES)
        expect(standardColours(tone, a).map((c) => c.name)).toEqual([...STANDARD_COLOUR_NAMES]);
    expect(STANDARD_COLOUR_NAMES).toHaveLength(10);
    expect(STANDARD_COLOUR_NAMES.every(isPenColourName)).toBe(true);
  });

  it('strong is the stock pen colour for the surface, at least 4.5:1 on it', () => {
    for (const a of APPEARANCES)
      for (const c of standardColours('strong', a)) {
        expect(c.hex).toBe(penColourHex(c.name, a));
        expect(c.label).toBe(penColourLabel(c.name));
        expect(contrastRatio(c.hex, PEN_BOARDS[a])).toBeGreaterThanOrEqual(4.5);
      }
  });

  it('soft puts White in place of Ink and keeps the ink readable on every wash', () => {
    for (const a of APPEARANCES) {
      const [first, ...rest] = standardColours('soft', a);
      expect(first).toEqual({ name: 'ink', label: 'White', hex: SOFT_WHITE });
      for (const c of rest) expect(contrastRatio(PEN_INK[a], c.hex)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('every version is a distinct hex', () => {
    const all = (['strong', 'soft'] as const).flatMap((t) =>
      APPEARANCES.flatMap((a) => standardColours(t, a).map((c) => `${t}:${a}:${c.hex}`)),
    );
    const hexes = (['strong', 'soft'] as const).flatMap((t) =>
      APPEARANCES.flatMap((a) => standardColours(t, a).map((c) => c.hex)),
    );
    // White is shared by both soft tables; everything else is unique.
    expect(new Set(hexes).size).toBe(hexes.length - 1);
    expect(all).toHaveLength(40);
  });

  it('finds a colour by any version of its hex, case-insensitively', () => {
    const blueDark = penColourHex('blue', 'dark');
    expect(standardColourAt(blueDark.toUpperCase())).toEqual({
      name: 'blue',
      label: 'Blue',
      tone: 'strong',
      appearance: 'dark',
    });
    expect(standardColourAt(standardColours('soft', 'light')[3]!.hex)?.name).toBe('orange');
    expect(standardColourAt('#123456')).toBeNull();
  });

  it('isHexColour accepts #rrggbb only', () => {
    expect(isHexColour('#A1b2C3')).toBe(true);
    for (const v of ['#abc', 'red', 'transparent', '#1234567', 12, null])
      expect(isHexColour(v)).toBe(false);
  });
});
