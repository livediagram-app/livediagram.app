import { describe, expect, it } from 'vitest';

import { markupBounds, centreOffsetPx } from './centring';

describe('markupBounds', () => {
  it('measures a path, padded by half the stroke', () => {
    const b = markupBounds('<path d="M4 4L20 20"/>', 2);
    expect(b).toEqual({ minX: 3, minY: 3, maxX: 21, maxY: 21 });
  });

  it('unions circles, rects, lines, ellipses and point lists', () => {
    const b = markupBounds(
      '<circle cx="12" cy="12" r="2"/><rect x="2" y="3" width="4" height="5"/>' +
        '<line x1="1" y1="20" x2="22" y2="20"/><ellipse cx="12" cy="2" rx="3" ry="1"/>' +
        '<polyline points="18 6 23 6"/>',
      0,
    );
    expect(b).toEqual({ minX: 1, minY: 1, maxX: 23, maxY: 20 });
  });

  it('refuses markup it cannot measure (transforms)', () => {
    expect(markupBounds('<g transform="rotate(45)"><path d="M0 0L1 1"/></g>', 1)).toBeNull();
  });

  it('returns null for markup with no geometry', () => {
    expect(markupBounds('<title>x</title>', 1)).toBeNull();
  });
});

describe('centreOffsetPx', () => {
  it('reports the ink centre offset from the viewBox centre in rendered px', () => {
    // Ink 2..18 in a 24 box: centre 10 vs 12, so -2 units = -1px at 12px.
    const off = centreOffsetPx('<path d="M2 2L18 18"/>', { units: 24, sizePx: 12, strokeUnits: 0 });
    expect(off).toEqual({ dx: -1, dy: -1 });
  });

  it('is zero for a centred glyph', () => {
    const off = centreOffsetPx('<circle cx="12" cy="12" r="9"/>', {
      units: 24,
      sizePx: 24,
      strokeUnits: 2,
    });
    expect(off).toEqual({ dx: 0, dy: 0 });
  });
});
