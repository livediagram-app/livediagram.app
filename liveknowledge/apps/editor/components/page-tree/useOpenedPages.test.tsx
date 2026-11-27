// @vitest-environment jsdom
// What a reader opens in the page tree (knowledgebases-and-pages.md "The page tree"): nothing at first, then what they
// open, kept per knowledgebase across a reload (Work Tracker 1486).
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openParentsOf } from '@/lib/page-tree-open';
import { useOpenedPages } from './useOpenedPages';

beforeEach(() => window.localStorage.clear());

describe('useOpenedPages', () => {
  it('opens nothing by default', () => {
    const { result } = renderHook(() => useOpenedPages('k1'));
    expect(result.current.opened.size).toBe(0);
  });

  it('keeps what the reader opens across a reload, and lets them close it again', () => {
    const first = renderHook(() => useOpenedPages('k1'));
    act(() => first.result.current.onSetOpen('a', true));
    expect([...first.result.current.opened]).toEqual(['a']);
    first.unmount();

    const reloaded = renderHook(() => useOpenedPages('k1'));
    expect([...reloaded.result.current.opened]).toEqual(['a']);
    act(() => reloaded.result.current.onSetOpen('a', false));
    expect(reloaded.result.current.opened.size).toBe(0);
    reloaded.unmount();
    expect(renderHook(() => useOpenedPages('k1')).result.current.opened.size).toBe(0);
  });

  it('changes nothing for a page already as asked', () => {
    const { result } = renderHook(() => useOpenedPages('k1'));
    const before = result.current.opened;
    act(() => result.current.onSetOpen('a', false));
    expect(result.current.opened).toBe(before);
  });

  it('keeps each knowledgebase its own, read again when another opens', () => {
    const { result, rerender } = renderHook(({ id }) => useOpenedPages(id), {
      initialProps: { id: 'k1' },
    });
    act(() => result.current.onSetOpen('a', true));
    rerender({ id: 'k2' });
    expect(result.current.opened.size).toBe(0);
    rerender({ id: 'k1' });
    expect([...result.current.opened]).toEqual(['a']);
  });

  it('creating a subpage opens its parent in the tree on screen, and only in its own knowledgebase', () => {
    const { result } = renderHook(() => useOpenedPages('k1'));
    const pages = [{ id: 'a' }, { id: 'b', parent: 'a' }, { id: 'new', parent: 'b' }];
    act(() => openParentsOf('k1', pages, ['new']));
    expect([...result.current.opened].sort()).toEqual(['a', 'b']);
    const before = result.current.opened;
    act(() => openParentsOf('k2', pages, ['new']));
    expect(result.current.opened).toBe(before);
  });

  it('opens it even where this browser keeps nothing', () => {
    const { result } = renderHook(() => useOpenedPages('k1'));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      act(() => openParentsOf('k1', [{ id: 'a' }, { id: 'new', parent: 'a' }], ['new']));
      expect([...result.current.opened]).toEqual(['a']);
    } finally {
      setItem.mockRestore();
    }
  });

  it('opens the first page by default; a reader who closes it keeps it closed across a reload (Work Tracker 1489)', () => {
    const first = renderHook(() => useOpenedPages('k1', 'a'));
    expect([...first.result.current.opened]).toEqual(['a']);
    const before = first.result.current.opened;
    act(() => first.result.current.onSetOpen('a', true));
    expect(first.result.current.opened).toBe(before);
    act(() => first.result.current.onSetOpen('a', false));
    expect(first.result.current.opened.has('a')).toBe(false);
    first.unmount();

    const reloaded = renderHook(() => useOpenedPages('k1', 'a'));
    expect(reloaded.result.current.opened.has('a')).toBe(false);
    act(() => reloaded.result.current.onSetOpen('a', true));
    expect(reloaded.result.current.opened.has('a')).toBe(true);
    reloaded.unmount();
    expect(renderHook(() => useOpenedPages('k1', 'a')).result.current.opened.has('a')).toBe(true);
  });
});
