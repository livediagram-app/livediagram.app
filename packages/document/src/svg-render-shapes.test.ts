import { describe, expect, it } from 'vitest';
import { createFreehand } from './factories';
import { svgFreehandShape } from './svg-render-shapes';

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
  it('draws a pen stroke at its recorded pen width', () => {
    expect(svgFreehandShape(stroke({ penWidth: 8 }), '#000', 'none')).toContain('stroke-width="8"');
  });

  it('falls back to the border preset without a pen width', () => {
    expect(svgFreehandShape(stroke({ strokeWidth: 'thick' }), '#000', 'none')).toContain(
      'stroke-width="4"',
    );
  });
});
