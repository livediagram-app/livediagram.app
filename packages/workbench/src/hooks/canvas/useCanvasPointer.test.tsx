// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useCanvasPointer } from './useCanvasPointer';

const box = (left: number, top: number) => ({ getBoundingClientRect: () => ({ left, top }) });
const move = (clientX: number, clientY: number) =>
  ({ clientX, clientY, target: 'over' }) as unknown as PointerEvent;

function setup(canvasTool: string, opts: { main?: boolean; wrapper?: boolean } = {}) {
  const onCanvasPointerMove = vi.fn();
  const mainRef = { current: opts.main === false ? null : box(10, 20) } as never;
  const wrapperRef = { current: opts.wrapper === false ? null : box(100, 50) } as never;
  const hook = renderHook(() =>
    useCanvasPointer({ canvasTool, mainRef, onCanvasPointerMove, wrapperRef, viewportZoom: 2 }),
  );
  return { hook, onCanvasPointerMove };
}

// docs/specs/008-canvas/canvas-and-palette.md: one measurement serves the spotlight, the eraser ring and peers.
describe('useCanvasPointer', () => {
  it('broadcasts the canvas position, pre-pan and unzoomed, and nothing once the pointer leaves', () => {
    const { hook, onCanvasPointerMove } = setup('select');
    act(() => hook.result.current.handlePointerMoveCanvas(move(120, 90)));
    expect(onCanvasPointerMove).toHaveBeenCalledWith(10, 20, 'over');
    expect(hook.result.current.eraserPos).toBeNull();
    expect(hook.result.current.spotlight.pos).toBeNull();
    act(() => hook.result.current.handlePointerLeaveCanvas());
    expect(onCanvasPointerMove).toHaveBeenLastCalledWith(null, null);
  });

  it('puts the spotlight and the eraser ring under the pointer in screen space', () => {
    const lit = setup('spotlight');
    act(() => lit.hook.result.current.handlePointerMoveCanvas(move(30, 40)));
    expect(lit.hook.result.current.spotlight.pos).toEqual({ x: 20, y: 20 });
    expect(lit.hook.result.current.spotlightLook.config).toBeDefined();
    const erasing = setup('eraser');
    act(() => erasing.hook.result.current.handlePointerMoveCanvas(move(30, 40)));
    expect(erasing.hook.result.current.eraserPos).toEqual({ x: 20, y: 20 });
  });

  it('waits for the canvas to be laid out', () => {
    const unmounted = setup('eraser', { main: false, wrapper: false });
    act(() => unmounted.hook.result.current.handlePointerMoveCanvas(move(30, 40)));
    expect(unmounted.hook.result.current.eraserPos).toBeNull();
    expect(unmounted.onCanvasPointerMove).not.toHaveBeenCalled();
    // A callback ref has no `current` to measure.
    const onCanvasPointerMove = vi.fn();
    const { result } = renderHook(() =>
      useCanvasPointer({
        canvasTool: 'spotlight',
        mainRef: () => {},
        onCanvasPointerMove,
        wrapperRef: { current: null },
        viewportZoom: 1,
      }),
    );
    act(() => result.current.handlePointerMoveCanvas(move(1, 1)));
    expect(result.current.spotlight.pos).toBeNull();
  });
});
