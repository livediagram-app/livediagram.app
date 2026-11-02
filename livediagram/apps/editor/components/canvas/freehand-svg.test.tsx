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

  // docs/specs/023-draw-mode/fill-tool.md "What a press fills": the fill under the ink, picked by it too.
  it('draws a filled marker loop under its ink, catching pointers on it when picked', () => {
    const ring = Array.from({ length: 12 }, (_, i) => ({
      x: 50 + 40 * Math.cos((i / 12) * 2 * Math.PI),
      y: 50 + 40 * Math.sin((i / 12) * 2 * Math.PI),
    }));
    const loop: FreehandElement = {
      ...createFreehand(ring, true),
      penWidth: 1.5,
      fillColor: '#dbeafe',
    };
    const { container, rerender } = render(
      <FreehandSvg element={loop} fill="#dbeafe" stroke="#000" hitPenWidth={1.5} />,
    );
    const paths = container.querySelectorAll('path');
    expect(paths[0]!.hasAttribute('data-loop-fill')).toBe(true);
    expect(paths[0]!.getAttribute('fill')).toBe('#dbeafe');
    expect(paths[0]!.getAttribute('d')).toMatch(/^M.*Z$/);
    expect(paths[0]!.style.pointerEvents).toBe('all');
    rerender(<FreehandSvg element={loop} fill="#dbeafe" stroke="#000" />);
    expect(container.querySelector<SVGElement>('[data-loop-fill]')!.style.pointerEvents).toBe('');
    // Open, or with no fill to show: no fill path.
    rerender(<FreehandSvg element={{ ...loop, closed: false }} fill="#dbeafe" stroke="#000" />);
    expect(container.querySelector('[data-loop-fill]')).toBeNull();
  });
});
