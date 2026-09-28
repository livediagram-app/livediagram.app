// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useObservedSize } from './useObservedSize';

// jsdom has no ResizeObserver: a fake that lets the test fire a resize.
let observers: { cb: () => void; disconnected: boolean }[] = [];
class FakeResizeObserver {
  entry: { cb: () => void; disconnected: boolean };
  constructor(cb: () => void) {
    this.entry = { cb, disconnected: false };
    observers.push(this.entry);
  }
  observe() {}
  disconnect() {
    this.entry.disconnected = true;
  }
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});
afterEach(() => vi.unstubAllGlobals());

function nodeOf(size: { width: number; height: number }) {
  const el = document.createElement('main');
  el.getBoundingClientRect = () => ({ ...size, left: 0, top: 0 }) as DOMRect;
  return { ref: { current: el }, size };
}

describe('useObservedSize', () => {
  it('has the size on the first render that shows it', () => {
    const { ref } = nodeOf({ width: 800, height: 600 });
    const { result } = renderHook(() => useObservedSize(ref));
    expect(result.current).toEqual({ width: 800, height: 600 });
  });

  it('follows a resize, and keeps the same object for an equal one', () => {
    const n = nodeOf({ width: 800, height: 600 });
    const { result } = renderHook(() => useObservedSize(n.ref));
    const first = result.current;
    act(() => observers[0]!.cb());
    expect(result.current).toBe(first);

    n.size.width = 1024;
    act(() => observers[0]!.cb());
    expect(result.current).toEqual({ width: 1024, height: 600 });
  });

  it('is null and observes nothing while inactive', () => {
    const { ref } = nodeOf({ width: 800, height: 600 });
    const { result } = renderHook(() => useObservedSize(ref, false));
    expect(result.current).toBeNull();
    expect(observers).toHaveLength(0);
  });

  it('is null for a callback ref, which has nothing to read', () => {
    const { result } = renderHook(() => useObservedSize(() => {}));
    expect(result.current).toBeNull();
  });

  it('stops observing on unmount', () => {
    const { ref } = nodeOf({ width: 800, height: 600 });
    const { unmount } = renderHook(() => useObservedSize(ref));
    unmount();
    expect(observers[0]!.disconnected).toBe(true);
  });
});
