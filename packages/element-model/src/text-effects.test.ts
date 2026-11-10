import { describe, expect, it } from 'vitest';
import {
  highlightBandCss,
  isHighlightColour,
  TEXT_GRADIENTS,
  textGradientCss,
  textGradientOf,
} from './text-effects';

describe('text effects (docs/specs/008-canvas/text-effects.md)', () => {
  it('has the six presets of the spec, each a pair of hex colours', () => {
    expect(TEXT_GRADIENTS.map((g) => g.id)).toEqual([
      'sunset',
      'ocean',
      'aurora',
      'berry',
      'ember',
      'midnight',
    ]);
    for (const g of TEXT_GRADIENTS) {
      expect(isHighlightColour(g.from) && isHighlightColour(g.to), g.id).toBe(true);
    }
  });

  it('reads a known preset and refuses anything else', () => {
    expect(textGradientOf('ocean')?.from).toBe('#0ea5e9');
    expect(textGradientOf('rainbow')).toBeNull();
    expect(textGradientOf(undefined)).toBeNull();
    expect(textGradientOf(3)).toBeNull();
  });

  it('accepts only hex highlight colours', () => {
    expect(isHighlightColour('#fde68a')).toBe(true);
    expect(isHighlightColour('#FFF')).toBe(true);
    expect(isHighlightColour('red')).toBe(false);
    expect(isHighlightColour('url(x)')).toBe(false);
    expect(isHighlightColour(undefined)).toBe(false);
  });

  it('writes the band over the lower part of the line and the gradient left to right', () => {
    expect(highlightBandCss('#fde68a')).toBe(
      'linear-gradient(to bottom, transparent 38%, #fde68a 38%, #fde68a 94%, transparent 94%)',
    );
    expect(textGradientCss({ from: '#000000', to: '#ffffff' })).toBe(
      'linear-gradient(90deg, #000000, #ffffff)',
    );
  });
});
