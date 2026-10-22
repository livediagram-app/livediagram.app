// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRowPointerDrag } from './useRowPointerDrag';

// docs/specs/031-photo/photo-layers.md "The Layers tab": a row dragged onto another lands above it, below it, or into
// it where it holds others (a group); the canvas's Layers panel uses the same drag (useLayerRowDrag).

// Rows 40px each: group 0-40, pixel 40-80.
function list() {
  const div = document.createElement('div');
  ['group', 'pixel'].forEach((id, i) => {
    const row = document.createElement('div');
    row.dataset.layerId = id;
    row.getBoundingClientRect = () => ({ top: i * 40, bottom: i * 40 + 40, height: 40 }) as DOMRect;
    div.appendChild(row);
  });
  return div;
}

const ev = (y: number) =>
  ({
    button: 0,
    clientX: 10,
    clientY: y,
    pointerId: 1,
    target: document.createElement('div'),
    currentTarget: { setPointerCapture: vi.fn() },
  }) as unknown as ReactPointerEvent<HTMLElement>;

function setup() {
  const onDrop = vi.fn();
  const hook = renderHook(() =>
    useRowPointerDrag({
      listRef: { current: list() },
      renamingId: null,
      canHold: (id) => id === 'group',
      onDrop,
    }),
  );
  return { hook, onDrop };
}

const dragFromPixelTo = (h: ReturnType<typeof setup>['hook'], y: number) => {
  act(() => h.result.current.rowPointerDown('pixel')(ev(60)));
  act(() => h.result.current.rowPointerMove(ev(50)));
  act(() => h.result.current.rowPointerMove(ev(y)));
};

describe('useRowPointerDrag', () => {
  it('drops into a row that holds others when let go over its middle', () => {
    const { hook, onDrop } = setup();
    dragFromPixelTo(hook, 20);
    expect(hook.result.current.over).toEqual({ id: 'group', at: 'into' });
    act(() => hook.result.current.rowPointerUp());
    expect(onDrop).toHaveBeenCalledWith('pixel', 'group', 'into');
  });

  it('drops above or below by the half it is let go over', () => {
    const { hook, onDrop } = setup();
    dragFromPixelTo(hook, 5);
    act(() => hook.result.current.rowPointerUp());
    expect(onDrop).toHaveBeenLastCalledWith('pixel', 'group', 'above');
    dragFromPixelTo(hook, 36);
    act(() => hook.result.current.rowPointerUp());
    expect(onDrop).toHaveBeenLastCalledWith('pixel', 'group', 'below');
  });

  it('drops nothing on itself, from a button, or when the pointer is cancelled', () => {
    const { hook, onDrop } = setup();
    dragFromPixelTo(hook, 60);
    expect(hook.result.current.over).toBeNull();
    act(() => hook.result.current.rowPointerUp());
    const button = document.createElement('button');
    act(() => hook.result.current.rowPointerDown('pixel')({ ...ev(60), target: button }));
    act(() => hook.result.current.rowPointerMove(ev(20)));
    expect(hook.result.current.dragId).toBeNull();
    dragFromPixelTo(hook, 20);
    act(() => hook.result.current.rowPointerCancel());
    expect(hook.result.current.dragId).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });
});
