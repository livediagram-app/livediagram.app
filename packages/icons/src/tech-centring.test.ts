import { describe, expect, it } from 'vitest';

import { centreOffsetPx } from './centring';
import { techGlyphStrokeUnits } from './markup';
import { TECH_ICON_CATALOG } from './tech-icon-catalog';

// Every technology tile's white glyph sits within 0.5px of the tile centre at the 32px tile size
// (docs/specs/004-interface-design/iconography.md, "Guarding").
const TOLERANCE_PX = 0.5;
const TILE_PX = 32;

// Glyphs asymmetric by design, each with the reason it is allowed off-centre.
const CENTRING_EXCEPTIONS: Record<string, string> = {};

// Glyphs the measurer cannot read (rotated ellipses), centred on 12,12 by construction.
const CENTRED_BY_CONSTRUCTION: Record<string, string> = {
  'azure-cosmosdb': 'three orbits rotated about 12,12',
  react: 'three orbits rotated about 12,12',
};

const LINE_ART = TECH_ICON_CATALOG.filter((d) => d.glyph && !/<text\b/.test(d.glyph));

function offset(glyph: string) {
  return centreOffsetPx(glyph, {
    units: 24,
    sizePx: TILE_PX,
    strokeUnits: techGlyphStrokeUnits(TILE_PX),
  });
}

describe('technology tile centring', () => {
  it('centres every tile glyph within tolerance, or names why not', () => {
    const off = LINE_ART.filter((d) => !CENTRING_EXCEPTIONS[d.id])
      .map((d) => ({ id: d.id, o: offset(d.glyph!) }))
      .filter(({ o }) => o && (Math.abs(o.dx) > TOLERANCE_PX || Math.abs(o.dy) > TOLERANCE_PX))
      .map(({ id, o }) => `${id} dx=${o!.dx} dy=${o!.dy}`);
    expect(off).toEqual([]);
  });

  it('measures every tile glyph', () => {
    expect(
      LINE_ART.filter((d) => !CENTRED_BY_CONSTRUCTION[d.id] && !offset(d.glyph!)).map((d) => d.id),
    ).toEqual([]);
  });

  it('lists only exceptions that still exist', () => {
    const ids = new Set(LINE_ART.map((d) => d.id));
    expect(Object.keys(CENTRING_EXCEPTIONS).filter((id) => !ids.has(id))).toEqual([]);
  });
});
