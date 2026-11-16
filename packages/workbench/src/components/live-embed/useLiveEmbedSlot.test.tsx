// @vitest-environment jsdom

// Whether a live embed may be live (live-embeds.md "Loading only on screen"): in view past the settle time and given a
// place; given back after the unload time off screen, or at once when no longer wanted.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveEmbedSlots } from './live-embed-slots';
import {
  LIVE_EMBED_SETTLE_MS,
  LIVE_EMBED_UNLOAD_MS,
  LIVE_EMBED_VISIBLE_RATIO,
  useLiveEmbedSlot,
} from './useLiveEmbedSlot';

type Callback = (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void;
let observers: { callback: Callback; disconnected: boolean }[];

beforeEach(() => {
  vi.useFakeTimers();
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      entry: { callback: Callback; disconnected: boolean };
      constructor(callback: Callback) {
        this.entry = { callback, disconnected: false };
        observers.push(this.entry);
      }
      observe() {}
      disconnect() {
        this.entry.disconnected = true;
      }
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const see = (index: number, ratio: number) =>
  act(() => {
    observers[index]!.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  });
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function mount(wanted = true, slots = createLiveEmbedSlots(1)) {
  const ref = { current: document.createElement('div') };
  return {
    slots,
    ...renderHook(({ wanted: w }: { wanted: boolean }) => useLiveEmbedSlot(ref, w, slots), {
      initialProps: { wanted },
    }),
  };
}

describe('a live embed slot', () => {
  it('is granted once on screen past the settle time, and given back after the unload time', () => {
    const { result, slots } = mount();
    see(0, LIVE_EMBED_VISIBLE_RATIO);
    wait(LIVE_EMBED_SETTLE_MS - 1);
    expect(result.current).toBe(false);
    wait(1);
    expect(result.current).toBe(true);
    expect(slots.counts().live).toBe(1);
    see(0, 0);
    wait(LIVE_EMBED_UNLOAD_MS - 1);
    expect(result.current).toBe(true);
    wait(1);
    expect(result.current).toBe(false);
    expect(slots.counts().live).toBe(0);
  });

  it('asks nothing for a fling past, a sliver in view, or a repeat of the same view', () => {
    const { result } = mount();
    see(0, 0.05);
    see(0, 0.5);
    see(0, 0.6);
    wait(100);
    see(0, 0);
    wait(LIVE_EMBED_SETTLE_MS);
    expect(result.current).toBe(false);
  });

  it('waits for a place, and gives its own back when no longer wanted', () => {
    const slots = createLiveEmbedSlots(1);
    const first = mount(true, slots);
    const second = mount(true, slots);
    see(0, 1);
    see(1, 1);
    wait(LIVE_EMBED_SETTLE_MS);
    expect(first.result.current).toBe(true);
    expect(second.result.current).toBe(false);
    first.rerender({ wanted: false });
    expect(first.result.current).toBe(false);
    expect(second.result.current).toBe(true);
    second.unmount();
    expect(observers[1]!.disconnected).toBe(true);
    expect(slots.counts()).toEqual({ live: 0, waiting: 0 });
  });

  it('does nothing without IntersectionObserver or a node', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(mount().result.current).toBe(false);
    const empty = renderHook(() => useLiveEmbedSlot({ current: null }, true));
    expect(empty.result.current).toBe(false);
  });
});
