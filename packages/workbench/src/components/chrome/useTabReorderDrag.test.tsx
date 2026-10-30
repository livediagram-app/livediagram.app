// @vitest-environment jsdom

// The tab bar's drag-reorder (docs/specs/006-document/tab-folders.md "Membership UX"): the side the pointer is on
// picks where the tab lands, the caret shows it, the dragged tab knows it is being dragged, and a drop reorders.

import { act, renderHook } from '@testing-library/react';
import type { DragEvent as ReactDragEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useTabReorderDrag } from './useTabReorderDrag';

function event(clientX = 0, data = '') {
  return {
    clientX,
    preventDefault: vi.fn(),
    currentTarget: { getBoundingClientRect: () => ({ left: 0, width: 100 }) },
    dataTransfer: { setData: vi.fn(), getData: () => data, effectAllowed: '', dropEffect: '' },
  } as unknown as ReactDragEvent;
}

describe('useTabReorderDrag', () => {
  it('marks the dragged tab, shows the caret on the side the pointer is on, and drops there', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useTabReorderDrag(onReorder));
    act(() => result.current.handlersFor('a').onDragStart(event()));
    expect(result.current.isDragging('a')).toBe(true);
    expect(result.current.isDragging('b')).toBe(false);
    act(() => result.current.handlersFor('b').onDragOver(event(80)));
    expect(result.current.caretFor('b')).toBe('after');
    act(() => result.current.handlersFor('b').onDragOver(event(20)));
    expect(result.current.caretFor('b')).toBe('before');
    // No caret on the dragged tab itself, or on a tab the pointer is not over.
    act(() => result.current.handlersFor('a').onDragOver(event(20)));
    expect(result.current.caretFor('a')).toBeNull();
    expect(result.current.caretFor('c')).toBeNull();
    act(() => result.current.handlersFor('b').onDrop(event(20, 'a')));
    expect(onReorder).toHaveBeenCalledWith('a', 'b', true);
    expect(result.current.isDragging('a')).toBe(false);
  });

  it('clears the caret when the pointer leaves, and everything when the drag ends', () => {
    const { result } = renderHook(() => useTabReorderDrag(vi.fn()));
    act(() => result.current.handlersFor('a').onDragStart(event()));
    act(() => result.current.handlersFor('b').onDragOver(event(80)));
    act(() => result.current.handlersFor('c').onDragLeave());
    expect(result.current.caretFor('b')).toBe('after');
    act(() => result.current.handlersFor('b').onDragLeave());
    expect(result.current.caretFor('b')).toBeNull();
    act(() => result.current.handlersFor('a').onDragEnd());
    expect(result.current.isDragging('a')).toBe(false);
  });

  it('drops before a tab it never hovered, and ignores a tab dropped on itself', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useTabReorderDrag(onReorder));
    act(() => result.current.handlersFor('b').onDrop(event(0, 'a')));
    expect(onReorder).toHaveBeenCalledWith('a', 'b', true);
    act(() => result.current.handlersFor('a').onDrop(event(0, 'a')));
    expect(onReorder).toHaveBeenCalledOnce();
  });
});
