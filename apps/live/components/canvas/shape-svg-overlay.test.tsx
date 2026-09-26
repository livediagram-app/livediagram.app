// @vitest-environment jsdom

// The canvas side of the shared shape geometry table (@livediagram/diagram
// shape-geometry.ts). The export side is pinned in the package
// (shape-geometry.test.ts); this pins the overlay to the same data, so a
// silhouette edited here instead of in the table fails rather than drifting.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  BROWSER_CHROME,
  CHAIR_GEOMETRY,
  SHAPE_GEOMETRY_KINDS,
  shapeGeometry,
  type ShapeElement,
  type ShapeKind,
} from '@livediagram/diagram';
import { BrowserChrome } from './boxed-element-overlays';
import { ChairView } from './collab/ChairView';
import { ShapeSvgOverlay } from './shape-svg-overlay';

afterEach(cleanup);

// A part's defining attribute, as the DOM reports it.
const marks = (svg: Element) =>
  [...svg.querySelectorAll('path, polygon')].map(
    (n) => n.getAttribute('d') ?? n.getAttribute('points'),
  );

describe('ShapeSvgOverlay draws the shared table', () => {
  it.each(SHAPE_GEOMETRY_KINDS)('%s', (kind: ShapeKind) => {
    const { container } = render(
      <ShapeSvgOverlay shape={kind} fill="#fff" stroke="#000" aspect={1.6} />,
    );
    const svg = container.querySelector('svg')!;
    const geometry = shapeGeometry(kind, 1.6)!;
    expect(svg.getAttribute('viewBox')).toBe(geometry.viewBox);
    expect(svg.getAttribute('preserveAspectRatio')).toBe(geometry.preserveAspectRatio);
    // One element per part, in table order, with the table's path data.
    expect(svg.querySelectorAll('path, polygon, rect, ellipse, circle')).toHaveLength(
      geometry.parts.length,
    );
    expect(marks(svg)).toEqual(
      geometry.parts
        .filter((p) => p.tag === 'path' || p.tag === 'polygon')
        .map((p) => (p.tag === 'path' ? p.d : p.tag === 'polygon' ? p.points : '')),
    );
  });

  it('paints a frame with its fill, like every other shape', () => {
    const { container } = render(<ShapeSvgOverlay shape="frame" fill="#fef3c7" stroke="#000" />);
    expect(container.querySelector('rect')!.getAttribute('fill')).toBe('#fef3c7');
  });
});

describe('the fixed-pixel drawings read the table too', () => {
  it('BrowserChrome draws the table nav glyphs', () => {
    const { container } = render(<BrowserChrome stroke="#000" zoom={1} />);
    expect(marks(container.querySelector('svg')!)).toEqual([...BROWSER_CHROME.nav.paths]);
  });

  it('ChairView draws the table chair', () => {
    const chair = {
      id: 'c',
      type: 'shape',
      shape: 'chair',
      x: 0,
      y: 0,
      width: 76,
      height: 84,
    } as ShapeElement;
    const { container } = render(<ChairView element={chair} sitters={[]} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe(CHAIR_GEOMETRY.viewBox);
    expect(marks(svg)).toEqual([
      CHAIR_GEOMETRY.slat,
      CHAIR_GEOMETRY.legs,
      CHAIR_GEOMETRY.stretcher,
    ]);
  });
});
