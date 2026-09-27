import { describe, expect, it } from 'vitest';

import { centreOffsetPx } from './centring';
import { ICON_CATALOG_1 } from './icon-catalog-1';
import { ICON_CATALOG_2 } from './icon-catalog-2';
import { iconPrimsMarkup } from './markup';
import { ICON_STROKE_PX, strokeUnits } from './weight';

// Every line-art catalogue glyph's ink sits within 0.5px of its box centre at palette-thumbnail
// size (docs/specs/004-interface-design/iconography.md, "Guarding").
const TOLERANCE_PX = 0.5;
const THUMB_PX = 24;

// Glyphs asymmetric by design, each with the reason it is allowed off-centre.
const CENTRING_EXCEPTIONS: Record<string, string> = {};

const LINE_ART = [...ICON_CATALOG_1, ...ICON_CATALOG_2].filter(
  (d) => !d.prims.some((p) => p.t === 'text'),
);

describe('icon catalogue centring', () => {
  it('centres every line-art glyph within tolerance, or names why not', () => {
    const sw = strokeUnits(ICON_STROKE_PX, THUMB_PX, 24);
    const off = LINE_ART.filter((d) => !CENTRING_EXCEPTIONS[d.id])
      .map((d) => ({
        id: d.id,
        o: centreOffsetPx(iconPrimsMarkup(d.prims), {
          units: 24,
          sizePx: THUMB_PX,
          strokeUnits: sw,
        }),
      }))
      .filter(({ o }) => o && (Math.abs(o.dx) > TOLERANCE_PX || Math.abs(o.dy) > TOLERANCE_PX))
      .map(({ id, o }) => `${id} dx=${o!.dx} dy=${o!.dy}`);
    expect(off).toEqual([]);
  });

  it('measures every line-art glyph', () => {
    const sw = strokeUnits(ICON_STROKE_PX, THUMB_PX, 24);
    const unmeasured = LINE_ART.filter(
      (d) =>
        !centreOffsetPx(iconPrimsMarkup(d.prims), { units: 24, sizePx: THUMB_PX, strokeUnits: sw }),
    ).map((d) => d.id);
    expect(unmeasured).toEqual([]);
  });

  it('lists only exceptions that still exist', () => {
    const ids = new Set(LINE_ART.map((d) => d.id));
    expect(Object.keys(CENTRING_EXCEPTIONS).filter((id) => !ids.has(id))).toEqual([]);
  });
});
