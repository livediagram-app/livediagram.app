// @vitest-environment jsdom
// What a reader opens in the page tree (knowledgebases-and-pages.md "The page tree"): nothing at first, then what they
// open, kept per knowledgebase across a reload (Work Tracker 1486).
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
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
});
