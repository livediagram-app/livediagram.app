// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreehand, type FreehandElement } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
import type { LiveStroke } from '@/lib/live-stroke';
import { liveStrokeOf } from '@/lib/live-stroke-test-utils';
import { FreehandSvg } from '@/components/canvas/boxed-element-overlays';
import { WhiteboardPenPreview } from './WhiteboardPenPreview';

// The whiteboard pen's in-flight preview (docs/specs/023-whiteboard/whiteboard.md "Pens"): drawn
// inside the canvas's own transformed layer as exactly the stroke it lands as (the same box, svg
// and filled perfect-freehand outline), so the same layer rasterises both and release changes no
// pixel.

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
const pressures = wave.map((_, i) => 0.2 + (i % 9) / 10);

const frameOf = (c: HTMLElement) => c.querySelector('[data-live-ink]') as HTMLDivElement;

/** The element the stroke lands as, and the svg FreehandSvg draws for it. */
function landed(stroke: LiveStroke, width: number) {
  const el: FreehandElement = {
    ...createFreehand([...stroke.points], false),
    penWidth: width,
    ...(stroke.pressures ? { pressures: [...stroke.pressures] } : {}),
    streamline: stroke.streamline,
  };
  const svg = render(<FreehandSvg element={el} fill="none" stroke="#e5484d" />).container
    .firstElementChild as SVGSVGElement;
  return { el, svg };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WhiteboardPenPreview', () => {
  for (const pointerType of ['pen', 'mouse']) {
    it(`draws a ${pointerType} stroke as exactly the svg it lands as: box, viewBox and outline`, () => {
      const stroke = liveStrokeOf(wave, { pointerType, pressures });
      const { container } = render(
        <WhiteboardPenPreview stroke={stroke} pen={pen()} ink="#1c1917" zoom={2} />,
      );
      const { el, svg: committed } = landed(stroke, 1.5);
      const frame = frameOf(container);
      expect(frame.style.left).toBe(`${el.x}px`);
      expect(frame.style.top).toBe(`${el.y}px`);
      expect(frame.style.width).toBe(`${el.width}px`);
      expect(frame.style.height).toBe(`${el.height}px`);
      const svg = frame.querySelector('svg')!;
      expect(svg.getAttribute('viewBox')).toBe(committed.getAttribute('viewBox'));
      expect(svg.getAttribute('class')).toBe(committed.getAttribute('class'));
      expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
      const live = svg.querySelector('path')!;
      const done = committed.querySelector('path')!;
      expect(live.getAttribute('d')).toBe(done.getAttribute('d'));
      expect(live.getAttribute('fill')).toBe('#e5484d');
      expect(done.getAttribute('fill')).toBe('#e5484d');
    });
  }

  it('fills with the board ink for the main pen', () => {
    const { container } = render(
      <WhiteboardPenPreview
        stroke={liveStrokeOf(wave)}
        pen={pen({ colour: null })}
        ink="#1c1917"
        zoom={1}
      />,
    );
    expect(frameOf(container).querySelector('path')!.getAttribute('fill')).toBe('#1c1917');
  });

  it('follows the stroke as it grows, box and outline, without a React render', () => {
    const stroke = liveStrokeOf(wave.slice(0, 10));
    const { container } = render(
      <WhiteboardPenPreview stroke={stroke} pen={pen()} ink="#1c1917" zoom={1} />,
    );
    act(() => {
      wave.slice(10).forEach((p) => stroke.push(p.x, p.y));
      stroke.notify();
    });
    const { el, svg } = landed(stroke, 1.5);
    expect(frameOf(container).style.width).toBe(`${el.width}px`);
    expect(frameOf(container).querySelector('path')!.getAttribute('d')).toBe(
      svg.querySelector('path')!.getAttribute('d'),
    );
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
      // Canvas px: the preview sits in the canvas layer, which the zoom scales.
      expect(parseFloat(preview.style.width)).toBeGreaterThan(190);
      expect(parseFloat(preview.style.width)).toBeLessThanOrEqual(200);
      // The ink is hidden, not unmounted.
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
