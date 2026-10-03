// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { canvasGestureNow, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from './useCanvasDrawGesture';

// The draw-to-size and pen gestures (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/008-canvas/two-pens.md):
// a press starts one, window pointer moves drive it, and the release commits it.

const BOX: PendingDraw = { type: 'shape', kind: 'square' } as PendingDraw;
const PEN: PendingDraw = { type: 'freehand' } as PendingDraw;

type Props = {
  pendingDraw: PendingDraw | null;
  viewportZoom: number;
  onCommitDraw: CanvasProps['onCommitDraw'];
  onCommitFreehand: CanvasProps['onCommitFreehand'];
};

function setup(initial: Partial<Props> = {}, elements: Element[] = []) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
  return renderHook(
    (p: Props) =>
      useCanvasDrawGesture({
        pendingDraw: p.pendingDraw,
        elements,
        wrapperRef: { current: wrapper },
        viewportZoom: p.viewportZoom,
        isPinchingRef: { current: false },
        onCommitDraw: p.onCommitDraw,
        onCommitFreehand: p.onCommitFreehand,
        stampAt: null,
        showStamp: vi.fn(),
      }),
    {
      initialProps: {
        pendingDraw: BOX,
        viewportZoom: 1,
        onCommitDraw: vi.fn(),
        onCommitFreehand: vi.fn(),
        ...initial,
      },
    },
  );
}

const press = (result: ReturnType<typeof setup>['result'], x: number, y: number) =>
  act(() => {
    result.current.beginPendingDrawGesture({ clientX: x, clientY: y } as React.PointerEvent);
  });
const pointer = (type: 'pointermove' | 'pointerup', x = 0, y = 0, shiftKey = false) =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, shiftKey }));
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useCanvasDrawGesture box drag', () => {
  it('draws from the press to the pointer and commits on release', () => {
    const { result, rerender } = setup();
    const onCommitDraw = vi.fn();
    rerender({ pendingDraw: BOX, viewportZoom: 1, onCommitDraw, onCommitFreehand: vi.fn() });
    press(result, 100, 100);
    pointer('pointermove', 300, 250);
    expect(result.current.drawDrag).toEqual({
      startX: 100,
      startY: 100,
      currentX: 300,
      currentY: 250,
    });
    pointer('pointerup');
    expect(result.current.drawDrag).toBeNull();
    expect(onCommitDraw).toHaveBeenCalledWith(BOX, 100, 100, 300, 250);
  });

  it('reads the zoom as it is now when the view zooms mid-drag', () => {
    const { result, rerender } = setup();
    const props = { pendingDraw: BOX, onCommitDraw: vi.fn(), onCommitFreehand: vi.fn() };
    press(result, 100, 100);
    rerender({ ...props, viewportZoom: 2 });
    pointer('pointermove', 600, 500);
    expect(result.current.drawDrag).toMatchObject({ currentX: 300, currentY: 250 });
  });

  it('commits through the newest commit handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = setup({ onCommitDraw: first });
    press(result, 100, 100);
    rerender({
      pendingDraw: BOX,
      viewportZoom: 1,
      onCommitDraw: second,
      onCommitFreehand: vi.fn(),
    });
    pointer('pointermove', 300, 250);
    pointer('pointerup');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(BOX, 100, 100, 300, 250);
  });
});

// Shift keeps the aspect ratio everywhere (docs/specs/008-canvas/canvas-and-palette.md "Resize"):
// a box drawn to size with Shift is square, snapped on its leading axis.
describe('useCanvasDrawGesture with Shift', () => {
  const wall = { ...createShape('square', 300, 600), width: 80, height: 80 } as Element;

  it('draws a square box', () => {
    const { result } = setup();
    press(result, 100, 100);
    pointer('pointermove', 297, 180, true);
    expect(result.current.drawDrag).toMatchObject({ currentX: 297, currentY: 297 });
  });

  it('still snaps, on the leading axis, and stays square', () => {
    const { result } = setup({}, [wall]);
    press(result, 100, 100);
    pointer('pointermove', 297, 180, true);
    expect(result.current.drawDrag).toMatchObject({ currentX: 300, currentY: 300 });
  });

  it('stays square drawn up and to the left', () => {
    const { result } = setup({}, [wall]);
    press(result, 500, 500);
    // Leading on y, the square's left edge lands 3px from the wall's: the
    // trailing axis must not snap on its own.
    pointer('pointermove', 420, 303, true);
    const d = result.current.drawDrag!;
    expect(Math.abs(d.currentX - d.startX)).toBeCloseTo(Math.abs(d.currentY - d.startY));
  });

  it('takes Shift pressed or released mid-drag on the next move', () => {
    const { result } = setup();
    press(result, 100, 100);
    pointer('pointermove', 300, 150, false);
    expect(result.current.drawDrag).toMatchObject({ currentX: 300, currentY: 150 });
    pointer('pointermove', 300, 150, true);
    expect(result.current.drawDrag).toMatchObject({ currentX: 300, currentY: 300 });
    pointer('pointermove', 300, 150, false);
    expect(result.current.drawDrag).toMatchObject({ currentX: 300, currentY: 150 });
  });
});

describe('useCanvasDrawGesture pen', () => {
  it('samples the stroke once per frame and commits it on release', () => {
    const onCommitFreehand = vi.fn();
    const { result } = setup({ pendingDraw: PEN, onCommitFreehand });
    press(result, 10, 10);
    pointer('pointermove', 20, 20);
    pointer('pointermove', 30, 25);
    expect(result.current.penPoints).toHaveLength(1);
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(result.current.penPoints).toEqual([
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 25 },
    ]);
    pointer('pointerup');
    expect(result.current.penPoints).toBeNull();
    expect(onCommitFreehand).toHaveBeenCalledWith(
      [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 25 },
      ],
      false,
    );
  });

  it('reads the zoom as it is now when the view zooms mid-stroke', () => {
    const onCommitFreehand = vi.fn();
    const { result, rerender } = setup({ pendingDraw: PEN, onCommitFreehand });
    press(result, 10, 10);
    rerender({ pendingDraw: PEN, viewportZoom: 2, onCommitDraw: vi.fn(), onCommitFreehand });
    pointer('pointermove', 60, 40);
    pointer('pointerup');
    expect(onCommitFreehand).toHaveBeenCalledWith(
      [
        { x: 10, y: 10 },
        { x: 30, y: 20 },
      ],
      false,
    );
  });
});

describe('useCanvasDrawGesture hover snap', () => {
  it('shows no start-snap dot while a drag is in flight', () => {
    const { result } = setup();
    press(result, 100, 100);
    expect(result.current.drawHover).toBeNull();
  });
});

// docs/specs/008-canvas/canvas-performance.md: drawing is a stroke gesture, press to release.
describe('useCanvasDrawGesture gesture', () => {
  afterEach(() => resetCanvasGesturesForTests());

  it('opens a stroke while a box is drawn', () => {
    const { result } = setup();
    press(result, 100, 100);
    expect(canvasGestureNow()).toBe('stroke');
    pointer('pointermove', 300, 250);
    pointer('pointerup');
    expect(canvasGestureNow()).toBe('idle');
  });

  it('opens a stroke while the pen draws', () => {
    const { result } = setup({ pendingDraw: PEN });
    press(result, 10, 10);
    expect(canvasGestureNow()).toBe('stroke');
    pointer('pointerup');
    expect(canvasGestureNow()).toBe('idle');
  });
});
