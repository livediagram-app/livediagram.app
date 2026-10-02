// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  hitOutlinePathData,
  shapeHitOutline,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { ShapeHitOutline, outlineHit } from './ShapeHitOutline';
import { CanvasZoomProvider } from './CanvasZoomContext';

const shape = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'diamond',
  x: 40,
  y: 60,
  width: 200,
  height: 100,
  fillColor: 'transparent',
  ...over,
});

// docs/specs/023-whiteboard/whiteboard.md "Selecting": a shape is picked by its drawn outline.
describe('ShapeHitOutline', () => {
  it('lays the outline over the whole box in canvas px, pointer-transparent itself', () => {
    const { container } = render(<ShapeHitOutline element={shape()} borderPx={0} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 100');
    expect(svg.getAttribute('class')).toContain('pointer-events-none');
    expect(svg.style.left).toBe('0px');
    expect(svg.style.width).toBe('200px');
  });

  it('catches pointers 6 screen px either side of the drawn line, at any zoom', () => {
    const el = shape();
    const at = (zoom: number) =>
      render(
        <CanvasZoomProvider zoom={zoom}>
          <ShapeHitOutline element={el} borderPx={0} />
        </CanvasZoomProvider>,
      ).container.querySelector('[data-shape-hit="line"]')!;
    const line = at(1);
    expect(line.getAttribute('d')).toBe(hitOutlinePathData(shapeHitOutline(el).lines));
    expect(line.getAttribute('fill')).toBe('none');
    expect((line as SVGElement).style.pointerEvents).toBe('stroke');
    // The medium 2px line plus 6px either side.
    expect(line.getAttribute('stroke-width')).toBe('14');
    expect(at(2).getAttribute('stroke-width')).toBe('8');
  });

  it('adds no fill region to an unfilled shape', () => {
    const { container } = render(<ShapeHitOutline element={shape()} borderPx={0} />);
    expect(container.querySelector('[data-shape-hit="fill"]')).toBeNull();
  });

  it('catches pointers anywhere on a visible fill', () => {
    const { container } = render(
      <ShapeHitOutline element={shape({ fillColor: '#fde68a' })} borderPx={0} />,
    );
    const fill = container.querySelector('[data-shape-hit="fill"]')!;
    expect(fill.getAttribute('fill')).toBe('transparent');
    expect((fill as SVGElement).style.pointerEvents).toBe('fill');
  });

  it('sits over the border box of a CSS-drawn shape, not inside its border', () => {
    const { container } = render(
      <ShapeHitOutline element={shape({ shape: 'square' })} borderPx={2} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.style.left).toBe('-2px');
    expect(svg.style.top).toBe('-2px');
  });
});

describe('outlineHit', () => {
  const free = { onWhiteboard: true, selected: false };

  it('picks an unselected whiteboard shape by its outline', () => {
    expect(outlineHit(shape(), free)).toBe(true);
    expect(outlineHit(shape({ shape: 'square' }), free)).toBe(true);
  });

  it('gives a selected shape its box back, for dragging', () => {
    expect(outlineHit(shape(), { ...free, selected: true })).toBe(false);
  });

  it('keeps whole-box picking on a diagram tab', () => {
    expect(outlineHit(shape(), { ...free, onWhiteboard: false })).toBe(false);
  });

  it('keeps the box of a note, a text box and a kind that paints its own face', () => {
    const note = { id: 'n', type: 'sticky', x: 0, y: 0, width: 100, height: 100 } as Element;
    expect(outlineHit(note, free)).toBe(false);
    expect(outlineHit(shape({ shape: 'pie-chart' }), free)).toBe(false);
  });
});
