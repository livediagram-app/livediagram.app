// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { catmullRomToBezierPath } from '@livediagram/document';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
import { liveStrokeOf } from '@/lib/live-stroke-test-utils';
import type { PendingDraw } from '@/lib/draw-mode';
import { CanvasDrawPreview } from './CanvasDrawPreview';

// docs/specs/023-whiteboard/whiteboard.md "Pens": what you see while drawing is what lands.
const wrapper = document.createElement('div');
const base = {
  drawDrag: null,
  penPoints: null,
  penStroke: null,
  polygonVertices: [],
  polygonCursor: null,
  highlighterColor: '#fde047',
  highlighterWidth: 14,
  stamp: null,
  viewportZoom: 2,
  wrapperRef: { current: wrapper },
  whiteboardInk: '#1c1917',
};
const stroke = () =>
  liveStrokeOf([
    { x: 0, y: 0 },
    { x: 20, y: 10 },
  ]);
// The live ink's group: colour, width and the canvas-to-screen transform sit on it.
const inkGroup = (c: HTMLElement) => c.querySelector('[data-live-ink] > g')!;
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
      <CanvasDrawPreview {...base} penStroke={stroke()} pendingDraw={pen('#e5484d', 8)} />,
    );
    const g = inkGroup(container);
    expect(g.getAttribute('stroke')).toBe('#e5484d');
    // An 8 px pen drawn in canvas px under the zoom of 2: 16 screen px wide, as it lands.
    expect(g.getAttribute('stroke-width')).toBe('8');
    expect(g.getAttribute('transform')).toBe('translate(0 0) scale(2)');
  });

  it('previews the main pen in the board ink', () => {
    const { container } = render(
      <CanvasDrawPreview {...base} penStroke={stroke()} pendingDraw={pen(null, 4)} />,
    );
    expect(inkGroup(container).getAttribute('stroke')).toBe('#1c1917');
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
  // A jittery line: the stroke being drawn is the live pipeline's output through the committed
  // curve, so it is the stroke that lands.
  const jitter = Array.from({ length: 40 }, (_, i) => ({ x: i * 4, y: i % 2 === 0 ? 0 : 0.4 }));

  it('draws the pipeline\u2019s points through the curve the committed stroke renders with', () => {
    const live = liveStrokeOf(jitter);
    const { container } = render(
      <CanvasDrawPreview {...base} viewportZoom={1} penStroke={live} pendingDraw={pen(null, 2)} />,
    );
    const paths = [...container.querySelectorAll('[data-live-ink] path')];
    const d = paths.map((p) => p.getAttribute('d')).join(' ');
    expect(d).toBe(catmullRomToBezierPath(live.smoother.points(), false));
    // Smoothed and compacted: far fewer points than samples.
    expect(live.smoother.points().length).toBeLessThan(jitter.length / 2);
  });

  it('follows the stroke as it grows, without a React render', () => {
    const live = liveStrokeOf(jitter.slice(0, 10));
    const { container } = render(
      <CanvasDrawPreview {...base} viewportZoom={1} penStroke={live} pendingDraw={pen(null, 2)} />,
    );
    act(() => {
      jitter.slice(10).forEach((p, i) => live.smoother.push(p.x, p.y, (10 + i) * 8));
      live.notify();
    });
    const d = [...container.querySelectorAll('[data-live-ink] path')]
      .map((p) => p.getAttribute('d'))
      .join(' ');
    expect(d).toBe(catmullRomToBezierPath(live.smoother.points(), false));
  });
});

describe('the recognition preview (docs/specs/023-whiteboard/whiteboard.md "Shape recognition")', () => {
  const square: { x: number; y: number }[] = [];
  for (let i = 0; i <= 20; i++) square.push({ x: i * 10, y: 0 });
  for (let i = 1; i <= 20; i++) square.push({ x: 200, y: i * 10 });
  for (let i = 1; i <= 20; i++) square.push({ x: 200 - i * 10, y: 200 });
  for (let i = 1; i <= 20; i++) square.push({ x: 0, y: 200 - i * 10 });

  it('swaps the stroke for the clean shape once the pen holds still, with recognition on', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      const { container } = render(
        <CanvasDrawPreview
          {...base}
          viewportZoom={1}
          penStroke={liveStrokeOf(square)}
          pendingDraw={{ ...pen('#e5484d', 1.5), recognise: true } as PendingDraw}
        />,
      );
      expect(container.querySelector('[data-recognition-preview]')).toBeNull();
      act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
      const preview = container.querySelector('[data-recognition-preview="square"]');
      expect(preview).not.toBeNull();
      // The ink is hidden, not unmounted: its sealed chunks live only in the DOM.
      const ink = container.querySelector('[data-live-ink]') as SVGElement;
      expect(ink.style.visibility).toBe('hidden');
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it('never previews with recognition off', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(
        <CanvasDrawPreview
          {...base}
          viewportZoom={1}
          penStroke={liveStrokeOf(square)}
          pendingDraw={pen(null, 1.5)}
        />,
      );
      act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS * 2));
      expect(container.querySelector('[data-recognition-preview]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
