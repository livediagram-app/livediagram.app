// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Layer } from '@livehuddle/document';

import { useLayerRowDrag } from './useLayerRowDrag';

// docs/specs/006-document/layers.md "The Layers panel": drag a row onto another to take its slot,
// with an insertion line on the edge it lands.

const LAYERS: Layer[] = [
  { id: 'bottom', name: 'Bottom' },
  { id: 'middle', name: 'Middle' },
  { id: 'top', name: 'Top' },
];

// Rows list top first, 40px each: top 0-40, middle 40-80, bottom 80-120.
function list() {
  const ul = document.createElement('ul');
  ['top', 'middle', 'bottom'].forEach((id, i) => {
    const li = document.createElement('li');
    li.dataset.layerId = id;
    li.getBoundingClientRect = () => ({ top: i * 40, bottom: i * 40 + 40 }) as DOMRect;
    ul.appendChild(li);
  });
  return ul;
}

const ev = (y: number, extra: Partial<ReactPointerEvent<HTMLElement>> = {}) =>
  ({
    button: 0,
    clientX: 10,
    clientY: y,
    pointerId: 1,
    target: document.createElement('li'),
    currentTarget: { setPointerCapture: vi.fn() },
    ...extra,
  }) as unknown as ReactPointerEvent<HTMLElement>;

function setup() {
  const onReorderLayer = vi.fn();
  const listRef = { current: list() };
  const hook = renderHook(() =>
    useLayerRowDrag({ listRef, layers: LAYERS, renamingId: null, onReorderLayer }),
  );
  return { hook, onReorderLayer };
}

describe('useLayerRowDrag', () => {
  it('leaves a click alone: no drag under a few px of travel', () => {
    const { hook, onReorderLayer } = setup();
    act(() => hook.result.current.rowPointerDown('bottom')(ev(100)));
    act(() => hook.result.current.rowPointerMove(ev(102)));
    expect(hook.result.current.dragId).toBeNull();
    act(() => hook.result.current.rowPointerUp());
    expect(onReorderLayer).not.toHaveBeenCalled();
  });

  it('lands above a higher layer, with the line on its top edge', () => {
    const { hook, onReorderLayer } = setup();
    act(() => hook.result.current.rowPointerDown('bottom')(ev(100)));
    act(() => hook.result.current.rowPointerMove(ev(90)));
    expect(hook.result.current.dragId).toBe('bottom');
    act(() => hook.result.current.rowPointerMove(ev(20)));
    expect(hook.result.current.dropTargetId).toBe('top');
    expect(hook.result.current.dropEdge).toBe('top');
    act(() => hook.result.current.rowPointerUp());
    expect(onReorderLayer).toHaveBeenCalledWith('bottom', 2);
    expect(hook.result.current.dragId).toBeNull();
  });

  it('lands below a lower layer, with the line on its bottom edge', () => {
    const { hook } = setup();
    act(() => hook.result.current.rowPointerDown('top')(ev(10)));
    act(() => hook.result.current.rowPointerMove(ev(30)));
    act(() => hook.result.current.rowPointerMove(ev(100)));
    expect(hook.result.current.dropEdge).toBe('bottom');
  });

  it('never starts from a row button, or from the right button', () => {
    const { hook } = setup();
    const button = document.createElement('button');
    act(() => hook.result.current.rowPointerDown('top')(ev(10, { target: button })));
    act(() => hook.result.current.rowPointerDown('top')(ev(10, { button: 2 })));
    act(() => hook.result.current.rowPointerMove(ev(60)));
    expect(hook.result.current.dragId).toBeNull();
  });
});
