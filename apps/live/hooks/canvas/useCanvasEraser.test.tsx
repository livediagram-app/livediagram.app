// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
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
      emitChange: vi.fn(),
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
