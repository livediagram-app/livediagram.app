import { describe, expect, it } from 'vitest';
import { createFreehand } from './factories';
import { svgFreehandShape } from './svg-render-shapes';
import { freehandPenStroke, penStrokePath } from './pen-stroke';
import { r2 } from './svg-render-primitives';

const stroke = (over: object = {}) => ({
  ...createFreehand(
    [
      { x: 0, y: 0 },
      { x: 50, y: 20 },
    ],
    false,
  ),
  ...over,
});

describe('svgFreehandShape', () => {
  it('draws a pen stroke as its filled outline, at its recorded pen width', () => {
    const el = stroke({ penWidth: 8 });
    const out = svgFreehandShape(el, '#000', 'none');
    expect(out).toBe(
      `<path d="${penStrokePath(freehandPenStroke(el, { x: el.x, y: el.y }), r2)}" fill="#000" stroke="none"/>`,
    );
    expect(out).not.toBe(svgFreehandShape(stroke({ penWidth: 2 }), '#000', 'none'));
  });

  it('falls back to the border preset without a pen width', () => {
    expect(svgFreehandShape(stroke({ strokeWidth: 'thick' }), '#000', 'none')).toContain(
      'stroke-width="4"',
    );
  });
});
