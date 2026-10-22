// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  completesRightClick,
  pendingRightClick,
  useRightClickRelease,
} from './useRightClickRelease';

// Defaults to the macOS / X11 shape: contextmenu arrives while the right
// button (bitmask 2) is still held.
const ctxEvent = (x = 100, y = 100, { button = 2, buttons = 2 } = {}) =>
  ({
    button,
    buttons,
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

describe('useRightClickRelease — platform event order', () => {
  it('Windows: contextmenu after the release opens straight away', () => {
    // pointerdown, pointerup, contextmenu: nothing is held any more.
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onPointerUp(upEvent(2));
    expect(open).not.toHaveBeenCalled();
    result.current.onContextMenu(ctxEvent(100, 100, { buttons: 0 }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('Windows: never leaves a stale arm for the next click', () => {
    // The old arm-then-wait design opened alternate clicks: the first set an
    // arm the second click's pointerup then consumed.
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    for (let i = 0; i < 3; i++) {
      result.current.onPointerUp(upEvent(2));
      result.current.onContextMenu(ctxEvent(100, 100, { buttons: 0 }));
    }
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('keyboard Menu key: no pointer at all, opens immediately', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onContextMenu(ctxEvent(10, 20, { button: 0, buttons: 0 }));
    expect(open).toHaveBeenCalledWith({ clientX: 10, clientY: 20 });
  });

  it('macOS Ctrl+click: opens on the PRIMARY button release', () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onContextMenu(ctxEvent(100, 100, { button: 0, buttons: 1 }));
    expect(open).not.toHaveBeenCalled();
    result.current.onPointerUp(upEvent(0));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('a release elsewhere clears the arm, so a later click cannot fire it', async () => {
    const open = vi.fn();
    const { result } = renderHook(() => useRightClickRelease(open));
    result.current.onContextMenu(ctxEvent(100, 100, { button: 0, buttons: 1 }));
    // Released over something else: only the window hears it.
    window.dispatchEvent(new Event('pointerup'));
    await new Promise((r) => setTimeout(r, 0));
    result.current.onPointerUp(upEvent(0));
    expect(open).not.toHaveBeenCalled();
  });
});

describe('pendingRightClick', () => {
  it('arms while a button is held, remembering which', () => {
    expect(pendingRightClick({ button: 2, buttons: 2, clientX: 1, clientY: 2 })).toEqual({
      kind: 'arm',
      button: 2,
      x: 1,
      y: 2,
    });
  });

  it('opens when nothing is held', () => {
    expect(pendingRightClick({ button: 2, buttons: 0, clientX: 1, clientY: 2 })).toEqual({
      kind: 'open',
    });
  });
});

describe('completesRightClick', () => {
  const armed = { button: 2, x: 100, y: 100 };
  it('needs the same button', () => {
    expect(completesRightClick(armed, { button: 0, clientX: 100, clientY: 100 })).toBe(false);
    expect(completesRightClick(armed, { button: 2, clientX: 100, clientY: 100 })).toBe(true);
  });
  it('rejects a drag', () => {
    expect(completesRightClick(armed, { button: 2, clientX: 140, clientY: 100 })).toBe(false);
  });
});
