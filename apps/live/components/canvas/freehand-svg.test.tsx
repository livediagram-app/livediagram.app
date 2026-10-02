// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createFreehand,
  encodeStrokePoints,
  freehandPenStroke,
  penStrokePath,
  type FreehandElement,
} from '@livediagram/document';
import { FreehandSvg } from './boxed-element-overlays';

const stroke = (over: Partial<FreehandElement> = {}): FreehandElement => ({
  ...createFreehand(
    [
      { x: 0, y: 0 },
      { x: 200, y: 50 },
    ],
    false,
  ),
  ...over,
});

describe('FreehandSvg', () => {
  it('draws a pen stroke as its filled pressure outline in canvas px, zooming with the board', () => {
    // docs/specs/023-draw-mode/draw-mode.md "Pens": ink on the board, drawn by perfect-freehand.
    const el = stroke({
      penWidth: 2.5,
      streamline: 0.2,
      packedPoints: encodeStrokePoints(
        [
          { nx: 0, ny: 0 },
          { nx: 1, ny: 1 },
        ],
        [0.3, 0.9],
      ),
    });
    const { container } = render(<FreehandSvg element={el} fill="none" stroke="#000" />);
    const svg = container.querySelector('svg')!;
    const path = container.querySelector('path')!;
    // In canvas coordinates: the viewBox is the element's own box on the board, so the outline's
    // numbers never depend on where the box is (a growing stroke's ink stays still).
    expect(svg.getAttribute('viewBox')).toBe(`${el.x} ${el.y} ${el.width} ${el.height}`);
    expect(path.getAttribute('d')).toBe(penStrokePath(freehandPenStroke(el, { x: el.x, y: el.y })));
    expect(path.getAttribute('fill')).toBe('#000');
    expect(path.getAttribute('stroke')).toBe('none');
  });

  it('keeps a pencil stroke on its non-scaling preset', () => {
    const { container } = render(<FreehandSvg element={stroke()} fill="none" stroke="#000" />);
    expect(container.querySelector('path')!.getAttribute('vector-effect')).toBe(
      'non-scaling-stroke',
    );
  });

  it('catches pointers on the drawn line alone when given a hit width', () => {
    // docs/specs/023-draw-mode/draw-mode.md "Selecting": a pen stroke is picked by its line, not its box.
    const el = stroke({ penWidth: 1.5 });
    const { container } = render(
      <FreehandSvg element={el} fill="none" stroke="#000" hitPenWidth={1.5} />,
    );
    const hit = container.querySelector('[data-stroke-hit]')!;
    // The outline, grown by the margin either side (13.5 - the 1.5 px line).
    expect(hit.getAttribute('stroke-width')).toBe('12');
    expect(hit.getAttribute('stroke')).toBe('transparent');
    expect((hit as SVGElement).style.pointerEvents).toBe('all');
  });

  it('has no hit line otherwise', () => {
    const { container } = render(<FreehandSvg element={stroke()} fill="none" stroke="#000" />);
    expect(container.querySelector('[data-stroke-hit]')).toBeNull();
  });
});
