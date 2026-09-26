import { describe, expect, it } from 'vitest';
import { classifyRgb } from './classify';
import { rgbToHsv } from './colour';
import type { PaperFloors } from './floors';

// The hue bands tile the circle between green and blue (docs/specs/021-event-storming/event-storming.md Phase 9):
// a pale mint read model photographed on kraft measures h≈173 to 182, and a
// hue that belongs to no band is paper that belongs to no note.

const KRAFT_FLOORS: PaperFloors = { saturation: 0.42, value: 0.2, wallHue: 29 };

describe('the hue bands between green and blue', () => {
  it('reads pale mint paper as a read model', () => {
    const mint = { r: 164, g: 204, b: 206 };
    expect(rgbToHsv(mint).h).toBeGreaterThan(175);
    expect(classifyRgb(mint.r, mint.g, mint.b, KRAFT_FLOORS)).toBe('read-model');
  });

  it('still reads a sky blue as a command', () => {
    const blue = { r: 120, g: 190, b: 230 };
    expect(rgbToHsv(blue).h).toBeGreaterThan(185);
    expect(classifyRgb(blue.r, blue.g, blue.b, KRAFT_FLOORS)).toBe('command');
  });
});
