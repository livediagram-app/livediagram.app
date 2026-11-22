// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingDraw } from '@/lib/draw-mode';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasPolygonGesture } from './useCanvasPolygonGesture';

// The polygon tool (docs/specs/008-canvas/polygon-tool.md): clicks place vertices, Enter finishes the
// open line, Backspace takes one back, Escape clears them and stays armed, and disarming clears all.

const POLYGON = { type: 'polygon' } as PendingDraw;

type Props = { pendingDraw: PendingDraw | null; onCommitPolygon: CanvasProps['onCommitPolygon'] };

function setup(onCommitPolygon: CanvasProps['onCommitPolygon'] = vi.fn()) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
  return renderHook(
    (p: Props) =>
      useCanvasPolygonGesture({
        pendingDraw: p.pendingDraw,
        elements: [],
        wrapperRef: { current: wrapper },
        viewportZoom: 1,
        onCommitPolygon: p.onCommitPolygon,
      }),
    { initialProps: { pendingDraw: POLYGON as PendingDraw | null, onCommitPolygon } },
  );
}

const click = (result: ReturnType<typeof setup>['result'], x: number, y: number) =>
  act(() => {
    result.current.beginPolygonPoint({ clientX: x, clientY: y } as React.PointerEvent);
  });
const key = (k: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  });

describe('useCanvasPolygonGesture', () => {
  it('finishes the open line on Enter, through the newest commit handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = setup(first);
    click(result, 0, 0);
    click(result, 100, 0);
    rerender({ pendingDraw: POLYGON, onCommitPolygon: second });
    key('Enter');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      false,
    );
    expect(result.current.polygonVertices).toEqual([]);
  });

  it('takes the last vertex back on Backspace', () => {
    const { result } = setup();
    click(result, 0, 0);
    click(result, 100, 0);
    key('Backspace');
    expect(result.current.polygonVertices).toEqual([{ x: 0, y: 0 }]);
  });

  it('clears the vertices on Escape and stays armed', () => {
    const { result } = setup();
    click(result, 0, 0);
    key('Escape');
    expect(result.current.polygonVertices).toEqual([]);
    click(result, 50, 50);
    expect(result.current.polygonVertices).toEqual([{ x: 50, y: 50 }]);
  });

  it('clears the gesture when the tool disarms', () => {
    const { result, rerender } = setup();
    click(result, 0, 0);
    click(result, 100, 0);
    rerender({ pendingDraw: null, onCommitPolygon: vi.fn() });
    expect(result.current.polygonVertices).toEqual([]);
    expect(result.current.polygonCursor).toBeNull();
  });

  it('leaves the keys alone while disarmed', () => {
    const onCommitPolygon = vi.fn();
    const { rerender } = setup(onCommitPolygon);
    rerender({ pendingDraw: null, onCommitPolygon });
    key('Enter');
    expect(onCommitPolygon).not.toHaveBeenCalled();
  });
});
