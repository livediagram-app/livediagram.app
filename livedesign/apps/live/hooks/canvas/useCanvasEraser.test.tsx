// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livedesign/design';
import { canvasGestureNow, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { useCanvasEraser } from './useCanvasEraser';

// What the pointer is over: nothing, unless a test says so.
const hits = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock('@liveworkspace/workbench/lib/dom-hit-test', () => ({
  elementHostsAtPoint: () => hits.ids.map((id) => ({ id })),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/008-canvas/canvas-performance.md: an eraser sweep is an erase gesture, press to lift,
// however the lift comes.

function setup() {
  return renderHook(() =>
    useCanvasEraser({
      editsBlocked: false,
      layerInertIds: new Set<string>(),
      activeId: 't',
      activeTab: { id: 't', name: 'Tab', elements: [] },
      tick: vi.fn(),
      markCheckpoint: () => 1,
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
    }),
  );
}

const lift = (type: 'pointerup' | 'pointercancel') =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type));
  });

afterEach(() => {
  resetCanvasGesturesForTests();
  hits.ids = [];
});

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

// docs/specs/008-canvas/canvas-and-palette.md "Eraser": locked elements, locked layers and everything on a locked tab
// are protected, whatever the brush.
describe('useCanvasEraser and locks', () => {
  const box = { ...createShape('square', 0, 0), id: 'b' } as Element;
  const erase = (el: Element, over: { inert?: string; tabLocked?: boolean } = {}) => {
    hits.ids = [el.id];
    const tick = vi.fn();
    const { result } = renderHook(() =>
      useCanvasEraser({
        editsBlocked: false,
        layerInertIds: new Set(over.inert ? [over.inert] : []),
        activeId: 't',
        activeTab: {
          id: 't',
          name: 'Tab',
          elements: [el],
          ...(over.tabLocked ? { locked: true } : {}),
        },
        tick,
        markCheckpoint: () => 1,
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
      }),
    );
    act(() => result.current.beginErase(10, 10));
    lift('pointerup');
    return tick;
  };

  it('erases an unlocked element under the pointer', () => {
    expect(erase(box)).toHaveBeenCalledOnce();
  });

  it('passes over a locked element', () => {
    expect(erase({ ...box, locked: true })).not.toHaveBeenCalled();
  });

  it('passes over an element on a locked layer', () => {
    expect(erase(box, { inert: 'b' })).not.toHaveBeenCalled();
  });

  it('erases nothing on a locked tab', () => {
    expect(erase(box, { tabLocked: true })).not.toHaveBeenCalled();
  });
});
