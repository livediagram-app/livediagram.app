// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STROKE_POINT_MAX_ERROR,
  STROKE_PRESSURE_MAX_ERROR,
  createFreehand,
  type FreehandElement,
} from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { RECOGNITION_PREVIEW_DWELL_MS } from '@/lib/recognition-preview';
import type { LiveStroke } from '@/lib/live-stroke';
import { liveStrokeOf } from '@/lib/live-stroke-test-utils';
import { FreehandSvg } from '@/components/canvas/boxed-element-overlays';
import { WhiteboardPenPreview } from './WhiteboardPenPreview';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The whiteboard pen's in-flight preview (docs/specs/023-draw-mode/draw-mode.md "Pens"): drawn
// inside the canvas's own transformed layer as exactly the stroke it lands as (the same box, svg
// and filled perfect-freehand outline), so the same layer rasterises both. The landed stroke's
// packed points are within STROKE_POINT_MAX_ERROR of the box of the raw samples the preview draws
// (docs/specs/006-document/stroke-points.md): the only difference release makes.

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
    ...createFreehand(
      [...stroke.points],
      false,
      stroke.pressures ? [...stroke.pressures] : undefined,
    ),
    penWidth: width,
    streamline: stroke.streamline,
  };
  const svg = render(<FreehandSvg element={el} fill="none" stroke="#e5484d" />).container
    .firstElementChild as SVGSVGElement;
  return { el, svg };
}

/**
 * The two outlines are the same path, command for command, every number within what packing moves
 * a point (on each axis of the box) plus what a packed pressure moves the pen's width.
 */
function expectSameOutline(live: string, landedPath: string, el: FreehandElement) {
  const tokens = (d: string) => d.split(' ');
  const a = tokens(live);
  const b = tokens(landedPath);
  expect(a).toHaveLength(b.length);
  const tolerance =
    2 * Math.max(el.width, el.height) * STROKE_POINT_MAX_ERROR +
    (el.penWidth ?? 1) * STROKE_PRESSURE_MAX_ERROR;
  a.forEach((t, i) => {
    const n = Number(t);
    if (Number.isNaN(n)) expect(t).toBe(b[i]);
    else expect(Math.abs(n - Number(b[i]))).toBeLessThanOrEqual(tolerance);
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WhiteboardPenPreview', () => {
  for (const pointerType of ['pen', 'mouse']) {
    it(`draws a ${pointerType} stroke as the svg it lands as: box, viewBox and outline`, () => {
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
      expectSameOutline(live.getAttribute('d')!, done.getAttribute('d')!, el);
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
    expectSameOutline(
      frameOf(container).querySelector('path')!.getAttribute('d')!,
      svg.querySelector('path')!.getAttribute('d')!,
      el,
    );
  });

  describe('the recognition preview (docs/specs/023-draw-mode/draw-mode.md "Shape recognition")', () => {
    const square: { x: number; y: number }[] = [];
    for (let i = 0; i <= 20; i++) square.push({ x: i * 10, y: 0 });
    for (let i = 1; i <= 20; i++) square.push({ x: 200, y: i * 10 });
    for (let i = 1; i <= 20; i++) square.push({ x: 200 - i * 10, y: 200 });
    for (let i = 1; i <= 20; i++) square.push({ x: 0, y: 200 - i * 10 });

    it('swaps the stroke for the clean shape, in canvas px, once the pen holds still', () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'info').mockImplementation(() => {});
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

  // docs/specs/023-draw-mode/draw-mode.md "Shape recognition": the chip on a touch screen.
  describe('the chip', () => {
    const square: { x: number; y: number }[] = [];
    for (let i = 0; i <= 20; i++) square.push({ x: i * 10, y: 0 });
    for (let i = 1; i <= 20; i++) square.push({ x: 200, y: i * 10 });
    for (let i = 1; i <= 20; i++) square.push({ x: 200 - i * 10, y: 200 });
    for (let i = 1; i <= 19; i++) square.push({ x: 0, y: 200 - i * 10 });

    const held = (pointerType: string, recognise = false) => {
      vi.useFakeTimers();
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const stroke = liveStrokeOf(square, { pointerType });
      const view = render(
        <WhiteboardPenPreview stroke={stroke} pen={pen({ recognise })} ink="#1c1917" zoom={2} />,
      );
      act(() => vi.advanceTimersByTime(RECOGNITION_PREVIEW_DWELL_MS + 10));
      return { stroke, ...view };
    };

    it('offers Make shape just above and before the tip, the same size at any zoom', () => {
      const { container } = held('touch');
      const chip = screen.getByRole('button', { name: 'Make shape' });
      expect(chip.hasAttribute('data-floating-panel')).toBe(true);
      const anchor = container.querySelector('[data-recognition-chip-anchor]') as HTMLElement;
      // At the tip (canvas 0, 10), undoing the canvas zoom of 2.
      expect(anchor.style.transform).toBe('translate(0px, 10px) scale(0.5)');
    });

    it('makes the shape on a tap and offers Keep drawing, the pen still down', () => {
      const { container, stroke } = held('pen');
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Make shape' }), {
        pointerId: 7,
      });
      expect(stroke.shaped()?.kind).toBe('square');
      expect(container.querySelector('[data-recognition-preview="square"]')).not.toBeNull();
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Keep drawing' }), {
        pointerId: 7,
      });
      expect(stroke.shaped()).toBeNull();
      expect(stroke.keepsInk()).toBe(true);
      expect(container.querySelector('[data-recognition-preview]')).toBeNull();
    });

    it('keeps its tap to itself: no pan, pinch or new stroke starts under it', () => {
      held('touch');
      const onParentDown = vi.fn();
      document.body.addEventListener('pointerdown', onParentDown);
      const onDocTouch = vi.fn();
      document.addEventListener('touchstart', onDocTouch);
      const chip = screen.getByRole('button', { name: 'Make shape' });
      fireEvent.pointerDown(chip, { pointerId: 7 });
      fireEvent.touchStart(chip);
      document.removeEventListener('touchstart', onDocTouch);
      document.body.removeEventListener('pointerdown', onParentDown);
      expect(onParentDown).not.toHaveBeenCalled();
      expect(onDocTouch).not.toHaveBeenCalled();
    });

    it('is never offered to a mouse', () => {
      held('mouse', true);
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
