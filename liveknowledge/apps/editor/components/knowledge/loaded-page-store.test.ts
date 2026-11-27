// @vitest-environment jsdom
// The rail's store across a page switch (docs/specs/030-knowledgebase/page-surface.md "Switching pages", Work Tracker
// 1465): held on the last loaded page while the open one loads, so the rail changes once, in place.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  EditorChromeContext,
  createEditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import {
  RAIL_HOLD_MAX_MS,
  createLoadedPageStore,
  openPageLoaded,
  useLoadedPageStore,
} from './loaded-page-store';

const view = (activeId: string, loaded: string[]) =>
  ({ activeId, loadedTabIds: new Set(loaded) }) as unknown as EditorContextValue;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the loaded page store', () => {
  it('says whether the open page has loaded', () => {
    expect(openPageLoaded(view('a', ['a']))).toBe(true);
    expect(openPageLoaded(view('b', ['a']))).toBe(false);
    expect(openPageLoaded({ activeId: 'a' } as unknown as EditorContextValue)).toBe(true);
  });

  it('holds the page before while the open one loads, then follows it', () => {
    const a = view('a', ['a']);
    const live = createEditorChromeStore(a);
    const held = createLoadedPageStore(live);
    const off = held.connect();
    const heard = vi.fn();
    held.subscribe(heard);
    live.set(view('b', ['a']));
    expect(held.get()).toBe(a);
    expect(heard).not.toHaveBeenCalled();
    const b = view('b', ['a', 'b']);
    live.set(b);
    expect(held.get()).toBe(b);
    expect(heard).toHaveBeenCalledTimes(1);
    off();
  });

  it('lets go after the cap when the load never lands', () => {
    const a = view('a', ['a']);
    const live = createEditorChromeStore(a);
    const held = createLoadedPageStore(live);
    const off = held.connect();
    const stuck = view('b', ['a']);
    live.set(stuck);
    expect(held.get()).toBe(a);
    vi.advanceTimersByTime(RAIL_HOLD_MAX_MS);
    expect(held.get()).toBe(stuck);
    // Still loading after the cap, a later change shows as it is.
    const later = view('b', ['a']);
    live.set(later);
    expect(held.get()).toBe(later);
    // Once a page loads, the next switch holds again.
    const c = view('c', ['a', 'c']);
    live.set(c);
    live.set(view('d', ['a', 'c']));
    expect(held.get()).toBe(c);
    off();
  });

  it('passes everything through before any page has loaded', () => {
    const first = view('a', []);
    const live = createEditorChromeStore(first);
    const held = createLoadedPageStore(live);
    expect(held.get()).toBe(first);
    const off = held.connect();
    const next = view('b', []);
    live.set(next);
    expect(held.get()).toBe(next);
    off();
  });

  it('catches up on connect, stops following and its timer on disconnect, and writes to the live store', () => {
    const a = view('a', ['a']);
    const live = createEditorChromeStore(a);
    const held = createLoadedPageStore(live);
    const b = view('b', ['a', 'b']);
    live.set(b);
    expect(held.get()).toBe(a);
    const off = held.connect();
    expect(held.get()).toBe(b);
    live.set(view('c', ['a', 'b']));
    off();
    vi.advanceTimersByTime(RAIL_HOLD_MAX_MS);
    expect(held.get()).toBe(b);
    live.set(view('d', ['d']));
    expect(held.get()).toBe(b);
    const written = view('e', ['e']);
    held.set(written);
    expect(live.get()).toBe(written);
  });

  it('is made once per rail and follows the editor while mounted', () => {
    const a = view('a', ['a']);
    const live = createEditorChromeStore(a);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(EditorChromeContext.Provider, { value: live }, children);
    const { result, rerender, unmount } = renderHook(() => useLoadedPageStore(), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    act(() => live.set(view('b', ['a'])));
    expect(result.current.get()).toBe(a);
    const b = view('b', ['a', 'b']);
    act(() => live.set(b));
    expect(result.current.get()).toBe(b);
    unmount();
  });
});
