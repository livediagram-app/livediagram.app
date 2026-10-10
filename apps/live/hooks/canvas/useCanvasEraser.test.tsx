// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreehand, type Element, type Tab } from '@livediagram/document';
import { canvasGestureNow, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { useCanvasEraser } from './useCanvasEraser';

vi.mock('@/lib/dom-hit-test', () => ({ elementHostsAtPoint: () => [] }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/008-canvas/canvas-performance.md: an eraser sweep is an erase gesture, press to lift,
// however the lift comes.

function setup() {
  return renderHook(() =>
    useCanvasEraser({
      editsBlocked: false,
      layerInertIds: new Set<string>(),
      activeId: 't',
      activeTab: { id: 't', name: 'Tab', elements: [] } as unknown as Tab,
      tick: vi.fn(),
      markCheckpoint: () => 1,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      whiteboard: null,
    }),
  );
}

const lift = (type: 'pointerup' | 'pointercancel') =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type));
  });

afterEach(() => resetCanvasGesturesForTests());

describe('useCanvasEraser gesture', () => {
  it('opens an erase from the press to the lift', () => {
    const { result } = setup();
    act(() => result.current.beginErase(10, 10));
    expect(canvasGestureNow()).toBe('erase');
    lift('pointerup');
    expect(canvasGestureNow()).toBe('idle');
  });

  it('closes the erase the browser cancels', () => {
    const { result } = setup();
    act(() => result.current.beginErase(10, 10));
    lift('pointercancel');
    expect(canvasGestureNow()).toBe('idle');
  });

  it('closes the erase when the canvas unmounts mid-sweep', () => {
    const { result, unmount } = setup();
    act(() => result.current.beginErase(10, 10));
    unmount();
    expect(canvasGestureNow()).toBe('idle');
  });
});

describe('useCanvasEraser on a whiteboard (docs/specs/023-draw-mode/draw-mode.md "Eraser")', () => {
  // A stroke along y = 100 from x 0 to 200, and a press well above it.
  const stroke = {
    ...createFreehand(
      [
        { x: 0, y: 100 },
        { x: 200, y: 100 },
      ],
      false,
    ),
    id: 's',
    penWidth: 4,
  } as Element;
  const sweep = (over: { whiteboard: { mode: 'stroke' } | null }) => {
    const tick = vi.fn();
    const { result } = renderHook(() =>
      useCanvasEraser({
        editsBlocked: false,
        layerInertIds: new Set<string>(),
        activeId: 't',
        activeTab: { id: 't', name: 'Tab', elements: [stroke] } as unknown as Tab,
        tick,
        markCheckpoint: () => 1,
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        config: { mode: 'tap', size: 'point', target: 'anything' },
        ...over,
      }),
    );
    act(() => result.current.beginErase(100, 0, () => ({ left: 0, top: 0, zoom: 1 })));
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 100 }));
    });
    lift('pointerup');
    return tick;
  };

  it('sweeps even when the Diagram eraser is set to Tap', () => {
    expect(sweep({ whiteboard: { mode: 'stroke' } })).toHaveBeenCalled();
  });

  it('keeps Tap on a diagram tab: the move erases nothing', () => {
    expect(sweep({ whiteboard: null })).not.toHaveBeenCalled();
  });

  it('follows a pan mid-sweep: the brush stays under the pointer', () => {
    // The press is above the stroke; then the canvas pans down 100 px, so the same client point
    // now sits on the stroke (canvas y 100 at client y 200).
    let frame = { left: 0, top: 0, zoom: 1 };
    let cut: Element[] | null = null;
    const tick = vi.fn((fn: (els: Element[]) => Element[]) => {
      cut = fn([stroke]);
    });
    const { result } = renderHook(() =>
      useCanvasEraser({
        editsBlocked: false,
        layerInertIds: new Set<string>(),
        activeId: 't',
        activeTab: { id: 't', name: 'Tab', elements: [stroke] } as unknown as Tab,
        tick,
        markCheckpoint: () => 1,
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        whiteboard: { mode: 'stroke' },
      }),
    );
    act(() => result.current.beginErase(100, 200, () => frame));
    expect(tick).not.toHaveBeenCalled();
    frame = { left: 0, top: 100, zoom: 1 };
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 101, clientY: 200 }));
    });
    lift('pointerup');
    expect(tick).toHaveBeenCalled();
    expect(cut).toEqual([]);
  });
});
