import { describe, expect, it } from 'vitest';
import { contrastRatio, mixHex } from '@livediagram/document';
import { LABEL_COLOURS, labelColour } from './label-colour';

// A label chip in the card panel (components/primitives/ChipField.tsx `chipColour`): a 12% tint of the swatch, inked
// with 70% of it mixed into the page's ink (dark in light mode, white in dark). Every swatch must read at WCAG AA.
const LIGHT_PAGE = '#ffffff';
const DARK_PAGE = '#141d29';

describe('label chips', () => {
  it('read at 4.5:1 in light and dark for every swatch', () => {
    for (const c of LABEL_COLOURS) {
      expect(
        contrastRatio(mixHex(c, '#0f172a', 0.7), mixHex(c, LIGHT_PAGE, 0.12)),
        `${c} light`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(mixHex(c, '#ffffff', 0.7), mixHex(c, DARK_PAGE, 0.12)),
        `${c} dark`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives the same label the same swatch', () => {
    expect(labelColour('Web')).toBe(labelColour('Web'));
    expect(LABEL_COLOURS).toContain(labelColour('SEO'));
  });
});
