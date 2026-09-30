// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PendingDraw } from '@/lib/draw-mode';
import { CanvasDrawPreview } from './CanvasDrawPreview';

// docs/specs/023-whiteboard/whiteboard.md "Pens": what you see while drawing is what lands.
const wrapper = document.createElement('div');
const base = {
  drawDrag: null,
  penPoints: null,
  polygonVertices: [],
  polygonCursor: null,
  highlighterColor: '#fde047',
  highlighterWidth: 14,
  stamp: null,
  viewportZoom: 2,
  wrapperRef: { current: wrapper },
  whiteboardInk: '#1c1917',
};
const stroke = [
  { x: 0, y: 0 },
  { x: 20, y: 10 },
];
const pen = (colour: string | null, width: number): PendingDraw => ({
  type: 'freehand',
  variant: 'whiteboard',
  colour,
  width,
  recognise: false,
});

describe('CanvasDrawPreview on a whiteboard', () => {
  it('previews a pen stroke in the pen colour at the pen width', () => {
    const { container } = render(
      <CanvasDrawPreview {...base} penPoints={stroke} pendingDraw={pen('#e5484d', 8)} />,
    );
    const path = container.querySelector('path')!;
    expect(path.getAttribute('stroke')).toBe('#e5484d');
    expect(path.getAttribute('stroke-width')).toBe('8');
  });

  it('previews the main pen in the board ink', () => {
    const { container } = render(
      <CanvasDrawPreview {...base} penPoints={stroke} pendingDraw={pen(null, 4)} />,
    );
    expect(container.querySelector('path')!.getAttribute('stroke')).toBe('#1c1917');
  });

  it('previews a line in the pen colour, solid, scaled with the zoom like the line itself', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
        pendingDraw={{ type: 'arrow', ends: 'none', pen: { colour: '#2f9e44', width: 4 } }}
      />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('stroke')).toBe('#2f9e44');
    expect(line.getAttribute('stroke-width')).toBe('8');
    expect(line.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('previews a rectangle with a solid pen-coloured outline and no fill', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
        pendingDraw={{ type: 'shape', kind: 'square', pen: { colour: null, width: 4 } }}
      />,
    );
    const box = container.querySelector('[data-pen-preview]') as HTMLElement;
    expect(box.style.borderStyle).toBe('solid');
    expect(box.style.borderColor).toBe('rgb(28, 25, 23)');
    expect(box.style.backgroundColor).toBe('');
  });
});

describe('CanvasDrawPreview rectangle corners', () => {
  it('rounds a pen rectangle as the committed one is, at the zoom', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
        pendingDraw={{ type: 'shape', kind: 'square', pen: { colour: null, width: 4 } }}
      />,
    );
    const box = container.querySelector('[data-pen-preview]') as HTMLElement;
    expect(box.style.borderRadius).toBe('16px');
  });
});
