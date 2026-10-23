import { describe, expect, it } from 'vitest';
import { createFreehand } from './factories';
import { svgFreehandShape, svgPathElementShape } from './svg-render-shapes';
import { createPath, pathAnchors } from './path-element';
import { pathD } from './path-geometry';
import { svgBoxed } from './svg-render';
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

describe('svgPathElementShape', () => {
  const tri = createPath(
    [
      { x: 10, y: 10, mode: 'corner' },
      { x: 60, y: 10, mode: 'corner', handleOut: { x: 60, y: 40 } },
      { x: 10, y: 60, mode: 'corner' },
    ],
    false,
  );

  it('draws the curve the canvas draws, at the border width, round-capped', () => {
    const out = svgPathElementShape(tri, '#123456', '#abcdef');
    expect(out).toBe(
      `<path d="${pathD(pathAnchors(tri), false, r2)}" fill="none" stroke="#123456" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  });

  it('fills only a closed path, and carries the width and dash', () => {
    const closed = {
      ...tri,
      closed: true,
      strokeWidth: 'thick' as const,
      strokeStyle: 'dashed' as const,
    };
    const out = svgPathElementShape(closed, '#000', '#ff0000');
    expect(out).toContain('fill="#ff0000"');
    expect(out).toContain('stroke-width="4"');
    expect(out).toContain('stroke-dasharray=');
    expect(out).toContain(' Z"');
    expect(svgPathElementShape(closed, '#000', 'transparent')).toContain('fill="none"');
  });
});

describe('svgBoxed for a path', () => {
  it('draws the path, not its box, inside its rotation group', () => {
    const el = {
      ...createPath(
        [
          { x: 0, y: 0, mode: 'corner' },
          { x: 40, y: 20, mode: 'corner' },
        ],
        false,
      ),
      rotation: 15,
    };
    const out = svgBoxed(el);
    expect(out).toContain('rotate(15');
    expect(out).toContain(`d="${pathD(pathAnchors(el), false, r2)}"`);
    expect(out).not.toContain('<rect');
  });
});
