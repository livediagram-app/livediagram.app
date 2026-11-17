// @vitest-environment jsdom

// The tab in flight the side by side drop zone answers (docs/specs/007-editor/split-view.md "Opening"): it ends however
// the drag ends (a drop anywhere, a dragend, Escape, the press after a cancelled drag), and the document listens only
// while a drag is live.

import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDraggedTab, useDraggedTab } from './tab-drag-store';

afterEach(() => {
  setDraggedTab(null);
  vi.restoreAllMocks();
});

const fire = (type: string, init?: EventInit) =>
  act(() => {
    document.body.dispatchEvent(new Event(type, { bubbles: true, ...init }));
  });

describe('tab-drag-store', () => {
  it('mirrors the tab in flight to every reader', () => {
    const { result } = renderHook(() => useDraggedTab());
    expect(result.current).toBeNull();
    act(() => setDraggedTab('a'));
    expect(result.current).toBe('a');
    act(() => setDraggedTab(null));
    expect(result.current).toBeNull();
  });

  it('renders no tab in flight on the server', () => {
    setDraggedTab('a');
    function Reader() {
      return <span>{useDraggedTab() ?? 'none'}</span>;
    }
    expect(renderToString(<Reader />)).toContain('none');
  });

  it.each(['drop', 'dragend', 'pointerdown'])(
    'ends the drag on a %s anywhere on the page',
    (type) => {
      const { result } = renderHook(() => useDraggedTab());
      act(() => setDraggedTab('a'));
      fire(type);
      expect(result.current).toBeNull();
    },
  );

  it('ends the drag on Escape, and on no other key', () => {
    const { result } = renderHook(() => useDraggedTab());
    act(() => setDraggedTab('a'));
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(result.current).toBe('a');
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(result.current).toBeNull();
  });

  it('listens on the document only while a drag is live, once however often the tab changes', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    setDraggedTab('a');
    setDraggedTab('a');
    setDraggedTab('b');
    expect(add).toHaveBeenCalledTimes(4);
    expect(remove).not.toHaveBeenCalled();
    setDraggedTab(null);
    expect(remove).toHaveBeenCalledTimes(4);
    // Between drags a drop elsewhere on the page (a file on the canvas) costs the store nothing.
    expect(remove.mock.calls.map((c) => c[0])).toEqual(add.mock.calls.map((c) => c[0]));
  });
});
