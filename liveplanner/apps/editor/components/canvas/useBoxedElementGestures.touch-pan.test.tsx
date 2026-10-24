// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createSticky } from '@liveplanner/project';
import { LONG_PRESS_MS } from '@/hooks/ui/useLongPress';
import { isPanThrough, panThroughTap } from '@/hooks/canvas/pan-through';
import { useBoxedElementGestures } from './useBoxedElementGestures';

// docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)": a finger on an element that runs off the screen pans the
// canvas; a tap still selects it, and the long-press menu still opens.

const SCREEN = { left: 0, top: 0, right: 400, bottom: 800 };
const rect = (r: typeof SCREEN) =>
  ({ ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top }) as DOMRect;

// Each case on its own clock, so the shared press ledger never pairs presses across tests.
let clock = 5_000_000;

afterEach(() => vi.useRealTimers());

function harness({ fits, isSelected = false }: { fits: boolean; isSelected?: boolean }) {
  const surface = document.createElement('main');
  surface.setAttribute('data-canvas-root', '');
  const node = document.createElement('div');
  surface.append(node);
  surface.getBoundingClientRect = () => rect(SCREEN);
  node.getBoundingClientRect = () =>
    rect(fits ? { left: 10, top: 10, right: 200, bottom: 200 } : { ...SCREEN, right: 900 });
  const onBeginDrag = vi.fn();
  const onPlainClick = vi.fn();
  const onContextSelect = vi.fn();
  const { result } = renderHook(() =>
    useBoxedElementGestures({
      element: { ...createSticky(0, 0), id: 's' },
      wrapperRef: { current: node },
      isEditing: false,
      remotelyLocked: false,
      isAnnotation: false,
      isMultiSelected: false,
      isSelected,
      onBeginDrag,
      onBeginEdit: vi.fn(),
      onPlainClick,
      onContextSelect,
    }),
  );
  clock += 100_000;
  const press = (pointerType = 'touch') => {
    const stopPropagation = vi.fn();
    const e = {
      button: 0,
      timeStamp: clock,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      pointerType,
      shiftKey: false,
      stopPropagation,
      nativeEvent: new Event('pointerdown'),
    } as unknown as ReactPointerEvent;
    act(() => {
      result.current.longPress.onPointerDown(e);
      result.current.handleShapeDown(e);
    });
    return { e, stopPropagation };
  };
  return { press, onBeginDrag, onPlainClick, onContextSelect };
}

describe('a finger on an element too big for the screen', () => {
  it('pans through to the canvas instead of dragging the element', () => {
    const h = harness({ fits: false });
    const { e, stopPropagation } = h.press();
    expect(isPanThrough(e)).toBe(true);
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(h.onBeginDrag).not.toHaveBeenCalled();
  });

  it('selects the element on a tap', () => {
    const h = harness({ fits: false });
    const { e } = h.press();
    panThroughTap(e)?.();
    expect(h.onPlainClick).toHaveBeenCalledWith('s');
  });

  it('opens the long-press menu, and its release is not also a tap', () => {
    vi.useFakeTimers();
    const h = harness({ fits: false });
    const { e } = h.press();
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    });
    expect(h.onContextSelect).toHaveBeenCalled();
    panThroughTap(e)?.();
    expect(h.onPlainClick).not.toHaveBeenCalled();
  });
});

describe('an element that is not panned through', () => {
  it('drags when all of it is on the screen', () => {
    const h = harness({ fits: true });
    const { e, stopPropagation } = h.press();
    expect(isPanThrough(e)).toBe(false);
    expect(stopPropagation).toHaveBeenCalled();
    expect(h.onBeginDrag.mock.calls[0]?.slice(0, 2)).toEqual(['s', 'move']);
  });

  it('drags with a mouse or a pen, however big it is', () => {
    for (const pointerType of ['mouse', 'pen']) {
      const h = harness({ fits: false });
      const { e } = h.press(pointerType);
      expect(isPanThrough(e)).toBe(false);
      expect(h.onBeginDrag).toHaveBeenCalled();
    }
  });
});
