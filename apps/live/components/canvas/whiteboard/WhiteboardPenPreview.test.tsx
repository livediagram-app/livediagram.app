// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catmullRomToBezierPath, createFreehand } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
import { liveStrokeOf } from '@/lib/live-stroke-test-utils';
import { FreehandSvg } from '@/components/canvas/boxed-element-overlays';
import { WhiteboardPenPreview } from './WhiteboardPenPreview';

// The whiteboard pen's in-flight preview (docs/specs/023-whiteboard/whiteboard.md "Pens"): drawn
// inside the canvas's own transformed layer, laid out exactly as the stroke it lands as, so the
// same layer rasterises both and release changes no pixel.

type Pen = Extract<PendingDraw, { variant: 'whiteboard' }>;
const pen = (over: Partial<Pen> = {}): Pen => ({
  type: 'freehand',
  variant: 'whiteboard',
  colour: '#e5484d',
  width: 1.5,
  recognise: false,
  ...over,
});
const wave = Array.from({ length: 60 }, (_, i) => ({
  x: 100.3 + i * 4,
  y: 50.7 + Math.sin(i / 5) * 20,
}));

const frameOf = (c: HTMLElement) => c.querySelector('[data-live-ink]') as HTMLDivElement;
const inkPath = (c: HTMLElement) =>
  [...c.querySelectorAll('[data-live-ink] path')].map((p) => p.getAttribute('d')).join(' ');

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WhiteboardPenPreview', () => {
  it('lays the ink out exactly as the committed stroke: same box, same viewBox, same svg', () => {
    const stroke = liveStrokeOf(wave);
    const { container } = render(
      <WhiteboardPenPreview stroke={stroke} pen={pen()} ink="#1c1917" zoom={2} />,
    );
    const landed = createFreehand(stroke.smoother.points(), false);
    const frame = frameOf(container);
    expect(frame.style.left).toBe(`${landed.x}px`);
    expect(frame.style.top).toBe(`${landed.y}px`);
    expect(frame.style.width).toBe(`${landed.width}px`);
    expect(frame.style.height).toBe(`${landed.height}px`);
    const svg = frame.querySelector('svg')!;
    const committed = render(
      <FreehandSvg element={{ ...landed, penWidth: 1.5 }} fill="none" stroke="#e5484d" />,
    ).container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe(committed.getAttribute('viewBox'));
    expect(svg.getAttribute('class')).toBe(committed.getAttribute('class'));
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    // Canvas px inside the box: the pen's own width, the canvas zoom scales it.
    const g = svg.querySelector('g')!;
    expect(g.getAttribute('stroke')).toBe('#e5484d');
    expect(g.getAttribute('stroke-width')).toBe('1.5');
    expect(g.getAttribute('transform')).toBe(`translate(${-landed.x} ${-landed.y})`);
  });

  it('draws the pipeline\u2019s points through the curve the committed stroke renders with', () => {
    const stroke = liveStrokeOf(wave);
    const { container } = render(
      <WhiteboardPenPreview stroke={stroke} pen={pen({ colour: null })} ink="#1c1917" zoom={1} />,
    );
    expect(inkPath(container)).toBe(catmullRomToBezierPath(stroke.smoother.points(), false));
    expect(container.querySelector('[data-live-ink] g')!.getAttribute('stroke')).toBe('#1c1917');
  });

  it('follows the stroke as it grows, box and path, without a React render', () => {
    const stroke = liveStrokeOf(wave.slice(0, 10));
    const { container } = render(
      <WhiteboardPenPreview stroke={stroke} pen={pen()} ink="#1c1917" zoom={1} />,
    );
    act(() => {
      wave.slice(10).forEach((p, i) => stroke.smoother.push(p.x, p.y, (10 + i) * 8));
      stroke.notify();
    });
    const points = stroke.smoother.points();
    const landed = createFreehand(points, false);
    expect(frameOf(container).style.width).toBe(`${landed.width}px`);
    expect(inkPath(container)).toBe(catmullRomToBezierPath(points, false));
  });

  describe('the recognition preview (docs/specs/023-whiteboard/whiteboard.md "Shape recognition")', () => {
    const square: { x: number; y: number }[] = [];
    for (let i = 0; i <= 20; i++) square.push({ x: i * 10, y: 0 });
    for (let i = 1; i <= 20; i++) square.push({ x: 200, y: i * 10 });
    for (let i = 1; i <= 20; i++) square.push({ x: 200 - i * 10, y: 200 });
    for (let i = 1; i <= 20; i++) square.push({ x: 0, y: 200 - i * 10 });

    it('swaps the stroke for the clean shape, in canvas px, once the pen holds still', () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'debug').mockImplementation(() => {});
      const { container } = render(
        <WhiteboardPenPreview
          stroke={liveStrokeOf(square)}
          pen={pen({ recognise: true })}
          ink="#1c1917"
          zoom={2}
        />,
      );
      expect(container.querySelector('[data-recognition-preview]')).toBeNull();
      act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
      const preview = container.querySelector(
        '[data-recognition-preview="square"]',
      ) as HTMLDivElement;
      expect(preview).not.toBeNull();
      expect(preview.style.left).toBe('0px');
      expect(preview.style.width).toBe('200px');
      // The ink is hidden, not unmounted: its sealed chunks live only in the DOM.
      expect(frameOf(container).style.visibility).toBe('hidden');
    });

    it('never previews with recognition off', () => {
      vi.useFakeTimers();
      const { container } = render(
        <WhiteboardPenPreview stroke={liveStrokeOf(square)} pen={pen()} ink="#1c1917" zoom={1} />,
      );
      act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS * 2));
      expect(container.querySelector('[data-recognition-preview]')).toBeNull();
    });
  });
});
