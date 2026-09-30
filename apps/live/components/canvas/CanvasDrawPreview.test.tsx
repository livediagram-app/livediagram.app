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
  it('previews a pen stroke in the pen colour at the width it will land at, zoom included', () => {
    const { container } = render(
      <CanvasDrawPreview {...base} penPoints={stroke} pendingDraw={pen('#e5484d', 8)} />,
    );
    const path = container.querySelector('path')!;
    expect(path.getAttribute('stroke')).toBe('#e5484d');
    // An 8 px pen at zoom 2: the finished stroke is 16 screen px wide.
    expect(path.getAttribute('stroke-width')).toBe('16');
  });

  it('previews the main pen in the board ink', () => {
    const { container } = render(
      <CanvasDrawPreview {...base} penPoints={stroke} pendingDraw={pen(null, 4)} />,
    );
    expect(container.querySelector('path')!.getAttribute('stroke')).toBe('#1c1917');
  });

  it('previews a line in the ink at its default width, solid, scaled with the zoom', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
        pendingDraw={{ type: 'arrow', ends: 'none', board: true }}
      />,
    );
    const line = container.querySelector('line')!;
    expect(line.getAttribute('stroke')).toBe('#1c1917');
    // The default 2 px line at zoom 2.
    expect(line.getAttribute('stroke-width')).toBe('4');
    expect(line.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('previews a rectangle with a solid outline in the ink and no fill', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        drawDrag={{ startX: 0, startY: 0, currentX: 50, currentY: 50 }}
        pendingDraw={{ type: 'shape', kind: 'square', board: true }}
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
        pendingDraw={{ type: 'shape', kind: 'square', board: true }}
      />,
    );
    const box = container.querySelector('[data-pen-preview]') as HTMLElement;
    expect(box.style.borderRadius).toBe('16px');
  });
});

describe('the live pen stroke is already smoothed (docs/specs/023-whiteboard/whiteboard.md)', () => {
  // A jittery horizontal line: the committed stroke simplifies and curves it,
  // so the stroke being drawn must too, or it jumps on release.
  const jitter = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: i % 2 === 0 ? 0 : 0.3 }));

  it('draws the smoothed curve, not the raw samples', () => {
    const { container } = render(
      <CanvasDrawPreview
        {...base}
        viewportZoom={1}
        penPoints={jitter}
        pendingDraw={pen(null, 2)}
      />,
    );
    const d = container.querySelector('path')!.getAttribute('d')!;
    // Simplified to its two ends and drawn as a curve: one cubic segment.
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('C');
    expect(d).not.toContain('L');
    expect((d.match(/C/g) ?? []).length).toBe(1);
  });
});
