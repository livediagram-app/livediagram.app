import { describe, expect, it } from 'vitest';

import { techGlyphStrokeUnits, techIconArtMarkup } from './markup';
import type { TechIconDef } from './types';

const tile: TechIconDef = {
  id: 'probe',
  label: 'Probe',
  provider: 'generic',
  keywords: '',
  color: '#123456',
  glyph: '<path d="M8 12h8"/>',
};

describe('techGlyphStrokeUnits', () => {
  it('draws the chrome weight on screen at every tile preset', () => {
    // 1.5px at 32 / 48 / 64 / 96px (ICON_SIZE_PX) on the 24-unit tile box.
    expect(techGlyphStrokeUnits(32)).toBe(1.125);
    expect(techGlyphStrokeUnits(48)).toBe(0.75);
    expect(techGlyphStrokeUnits(64)).toBe(0.5625);
    expect(techGlyphStrokeUnits(96)).toBe(0.375);
  });

  it('drops to the small weight at 12px or less', () => {
    expect(techGlyphStrokeUnits(12)).toBe(2.5);
  });
});

describe('techIconArtMarkup', () => {
  it('draws the tile and a white glyph group that inherits its stroke width', () => {
    const markup = techIconArtMarkup(tile);
    expect(markup).toContain('fill="#123456"');
    expect(markup).toContain('stroke="#fff"');
    expect(markup).toContain(tile.glyph);
    // The renderer sets the weight for the tile's rendered size on the enclosing <svg>.
    expect(markup).not.toContain('stroke-width');
  });
});
