// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ELEMENT_GESTURES,
  beginCanvasGesture,
  canvasGestureNow,
  resetCanvasGesturesForTests,
  selectionMoving,
  useCanvasGesture,
} from './canvas-gesture';

afterEach(() => resetCanvasGesturesForTests());

describe('canvas gesture store', () => {
  it('is idle with nothing open', () => {
    expect(canvasGestureNow()).toBe('idle');
  });

  it('reports a begun gesture until it ends', () => {
    const end = beginCanvasGesture('move');
    expect(canvasGestureNow()).toBe('move');
    end();
    expect(canvasGestureNow()).toBe('idle');
  });

  it('ends a gesture once, however often end is called', () => {
    const endPan = beginCanvasGesture('pan');
    const endMove = beginCanvasGesture('move');
    endMove();
    endMove();
    expect(canvasGestureNow()).toBe('pan');
    endPan();
  });

  it('reports the latest open gesture and falls back when it ends', () => {
    const endMove = beginCanvasGesture('move');
    const endZoom = beginCanvasGesture('zoom');
    expect(canvasGestureNow()).toBe('zoom');
    endZoom();
    expect(canvasGestureNow()).toBe('move');
    endMove();
    expect(canvasGestureNow()).toBe('idle');
  });

  it('keeps a later gesture when an earlier one ends first', () => {
    const endMove = beginCanvasGesture('move');
    const endZoom = beginCanvasGesture('zoom');
    endMove();
    expect(canvasGestureNow()).toBe('zoom');
    endZoom();
  });

  it('re-renders subscribers only when the reported gesture changes', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useCanvasGesture();
    });
    const before = renders;
    let endA = () => {};
    let endB = () => {};
    act(() => {
      endA = beginCanvasGesture('pan');
    });
    expect(result.current).toBe('pan');
    act(() => {
      // Same reported kind: no re-render.
      endB = beginCanvasGesture('pan');
    });
    act(() => endB());
    expect(renders).toBe(before + 1);
    act(() => endA());
    expect(result.current).toBe('idle');
    expect(renders).toBe(before + 2);
  });

  it('names the gestures that change elements every frame', () => {
    expect([...ELEMENT_GESTURES].sort()).toEqual(['erase', 'move', 'reshape', 'resize', 'stroke']);
  });

  it('counts move, resize and reshape as the selection moving', () => {
    expect(selectionMoving('move')).toBe(true);
    expect(selectionMoving('resize')).toBe(true);
    expect(selectionMoving('reshape')).toBe(true);
    expect(selectionMoving('pan')).toBe(false);
    expect(selectionMoving('stroke')).toBe(false);
    expect(selectionMoving('idle')).toBe(false);
  });
});
