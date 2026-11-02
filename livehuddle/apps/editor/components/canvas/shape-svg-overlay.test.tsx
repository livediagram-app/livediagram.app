// @vitest-environment jsdom

// The canvas side of the shared shape geometry table (@livehuddle/document
// shape-geometry.ts). The export side is pinned in the package
// (shape-geometry.test.ts); this pins the overlay to the same data, so a
// silhouette edited here instead of in the table fails rather than drifting.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CHAIR_ART, type ShapeElement } from '@livehuddle/document';
import { FurnitureView } from './collab/FurnitureView';
import { ShapeSvgOverlay } from './shape-svg-overlay';

afterEach(cleanup);

// A part's defining attribute, as the DOM reports it.
const marks = (svg: Element) =>
  [...svg.querySelectorAll('path, polygon')].map(
    (n) => n.getAttribute('d') ?? n.getAttribute('points'),
  );

describe('ShapeSvgOverlay draws the shared table', () => {
  it.each(['diamond', 'parallelogram', 'hexagon', 'document', 'cylinder', 'cloud'] as const)(
    'insets the %s by half its stroke so it stays inside the box',
    (shape) => {
      const { container } = render(
        <ShapeSvgOverlay shape={shape} fill="#fff" stroke="#000" strokeWidth={4} />,
      );
      const style = container.querySelector('svg')!.style;
      expect([style.left, style.top]).toEqual(['2px', '2px']);
      expect([style.width, style.height]).toEqual(['calc(100% - 4px)', 'calc(100% - 4px)']);
    },
  );

  it('draws an actor figure in its own rect, clear of the name', () => {
    const { container } = render(
      <ShapeSvgOverlay
        shape="actor"
        fill="#fff"
        stroke="#000"
        figure={{ x: 0, y: 4, width: 120, height: 80 }}
      />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.style.top).toBe('4px');
    expect(svg.style.height).toBe('80px');
  });

  it('paints a frame with its fill, like every other shape', () => {
    const { container } = render(<ShapeSvgOverlay shape="frame" fill="#fef3c7" stroke="#000" />);
    expect(container.querySelector('rect')!.getAttribute('fill')).toBe('#fef3c7');
  });
});

describe('the fixed-pixel drawings read the table too', () => {
  it('FurnitureView draws the table chair, upright at every facing', () => {
    const chair = (chairFacing: 'n' | 'e' | 's' | 'w') =>
      ({
        id: 'c',
        type: 'shape',
        shape: 'chair',
        x: 0,
        y: 0,
        width: 76,
        height: 84,
        chairFacing,
      }) as ShapeElement;
    const draw = (facing: 'n' | 'e' | 's' | 'w') => {
      const { container, unmount } = render(
        <FurnitureView element={chair(facing)} stroke="#94a3b8" sitters={[]} />,
      );
      const svg = container.querySelector('svg')!;
      const out = { svg: svg.outerHTML, viewBox: svg.getAttribute('viewBox'), paths: marks(svg) };
      unmount();
      return out;
    };
    const front = draw('n');
    expect(front.viewBox).toBe('0 0 64 72');
    expect(front.paths).toEqual(
      CHAIR_ART.front.parts.flatMap((p) => (p.tag === 'path' ? [p.d] : [])),
    );
    expect(draw('s').paths).toEqual(
      CHAIR_ART.back.parts.flatMap((p) => (p.tag === 'path' ? [p.d] : [])),
    );
    // Never rotated; facing right mirrors the side drawing.
    for (const f of ['n', 'e', 's', 'w'] as const) expect(draw(f).svg).not.toMatch(/rotate/);
    expect(draw('w').svg).toContain('scale(-1 1)');
    expect(draw('n').svg).toContain('Empty chair');
  });
});
