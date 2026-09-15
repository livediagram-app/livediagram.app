// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRightClickRelease } from './useRightClickRelease';

const ctxEvent = (x = 100, y = 100) =>
  ({
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as ReactMouseEvent;

const upEvent = (button: number, x = 100, y = 100) =>
  ({
    button,
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as ReactPointerEvent;

describe('useRightClickRelease', () => {
  it('opens on the release, not on the press', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));

    result.current.onContextMenu(ctxEvent());
    expect(open).not.toHaveBeenCalled();

    result.current.onPointerUp(upEvent(2));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('suppresses the native menu on the press', () => {
    const { result } = renderHook(() => useRightClickRelease(vi.fn()));
    const e = ctxEvent();
    result.current.onContextMenu(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('ignores a release that was never armed', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onPointerUp(upEvent(2));
    expect(open).not.toHaveBeenCalled();
  });

  it('ignores a primary-button release', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onContextMenu(ctxEvent());
    result.current.onPointerUp(upEvent(0));
    expect(open).not.toHaveBeenCalled();
  });

  it('opens only once per press', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onContextMenu(ctxEvent());
    result.current.onPointerUp(upEvent(2));
    result.current.onPointerUp(upEvent(2));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('drops the menu when the press travelled — that was a drag', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onContextMenu(ctxEvent(100, 100));
    result.current.onPointerUp(upEvent(2, 240, 180));
    expect(open).not.toHaveBeenCalled();
  });

  it('tolerates the wobble of a held hand', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onContextMenu(ctxEvent(100, 100));
    result.current.onPointerUp(upEvent(2, 104, 103));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('disarms on request, so a caller can cancel a pending open', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onContextMenu(ctxEvent());
    result.current.disarm();
    result.current.onPointerUp(upEvent(2));
    expect(open).not.toHaveBeenCalled();
  });
});

describe('useRightClickRelease — propagation', () => {
  it('suppresses the native menu on the press but lets the press through', () => {
    const { result } = renderHook(() => useRightClickRelease(vi.fn()));
    const e = ctxEvent();
    result.current.onContextMenu(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('never stops the release from propagating', () => {
    // Gestures end on a WINDOW pointerup and React dispatches from the root
    // container: stopping the release here strands a drag armed by the press,
    // and the element follows the cursor with no button down.
    const { result } = renderHook(() => useRightClickRelease(vi.fn()));
    result.current.onContextMenu(ctxEvent());
    const up = upEvent(2);
    result.current.onPointerUp(up);
    expect(up.stopPropagation).not.toHaveBeenCalled();
  });
});
