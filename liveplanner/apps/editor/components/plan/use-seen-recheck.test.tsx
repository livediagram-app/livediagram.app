// @vitest-environment jsdom
// A tile mounted while its panel is still moving in loads its picture once the motion settles, even when the
// IntersectionObserver never reports the crossing (Work Tracker 826; item-types.md "Image fields").
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeen } from './use-image-url';
import { awaitSeen, recheckSeen, SEEN_RECHECK_MS, seenWaiting } from './seen-recheck';

// An observer that reports the first entry (off screen, as mid-motion) and never a crossing after.
class MissingObserver {
  constructor(private readonly cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb(
      [{ target: el, isIntersecting: false } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

// The frames asked for, run by `nextFrame`.
let frames: FrameRequestCallback[] = [];
function nextFrame() {
  const run = frames;
  frames = [];
  for (const cb of run) cb(0);
}

// Where the tile is: off screen to the right while its panel slides in, then in place.
let rect = { top: 100, left: 5000, width: 80, height: 80 };
function place(el: Element) {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

function Tile({ onSeen }: { onSeen: (seen: boolean) => void }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  onSeen(seen);
  return (
    <div
      ref={(el) => {
        if (el) place(el);
        ref.current = el;
      }}
    />
  );
}

describe('useSeen rechecks a tile mounted mid-motion', () => {
  beforeEach(() => {
    rect = { top: 100, left: 5000, width: 80, height: 80 };
    vi.stubGlobal('IntersectionObserver', MissingObserver);
    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is seen once the panel settles and a transition ends, though the observer never reported it', () => {
    const states: boolean[] = [];
    const { unmount } = render(<Tile onSeen={(s) => states.push(s)} />);
    expect(states.at(-1)).toBe(false);
    // The slide is still under way: a transition ending elsewhere finds the tile off screen.
    act(() => {
      document.body.dispatchEvent(new Event('transitionend', { bubbles: true }));
      document.body.dispatchEvent(new Event('transitionend', { bubbles: true }));
      nextFrame();
    });
    expect(states.at(-1)).toBe(false);
    // The panel has settled with the tile in view.
    rect = { top: 100, left: 300, width: 80, height: 80 };
    act(() => {
      document.body.dispatchEvent(new Event('animationend', { bubbles: true }));
      nextFrame();
    });
    expect(states.at(-1)).toBe(true);
    expect(seenWaiting()).toBe(0);
    unmount();
  });

  it('is seen by the timed recheck when no motion event comes', () => {
    vi.useFakeTimers();
    const states: boolean[] = [];
    rect = { top: 100, left: 300, width: 80, height: 80 };
    render(<Tile onSeen={(s) => states.push(s)} />);
    expect(states.at(-1)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(SEEN_RECHECK_MS);
      nextFrame();
    });
    expect(states.at(-1)).toBe(true);
  });

  it('stays unseen while off screen, a hidden (zero-size) or detached tile too, and stops waiting on unmount', () => {
    const states: boolean[] = [];
    const { unmount } = render(<Tile onSeen={(s) => states.push(s)} />);
    rect = { top: 100, left: 300, width: 0, height: 0 };
    act(() => recheckSeen());
    expect(states.at(-1)).toBe(false);
    rect = { top: -5000, left: 300, width: 80, height: 80 };
    act(() => recheckSeen());
    expect(states.at(-1)).toBe(false);
    expect(seenWaiting()).toBe(1);
    unmount();
    expect(seenWaiting()).toBe(0);
  });

  it('never counts a detached element as seen', () => {
    const el = document.createElement('div');
    rect = { top: 100, left: 300, width: 80, height: 80 };
    place(el);
    const onSeen = vi.fn();
    const stop = awaitSeen(el, onSeen);
    recheckSeen();
    expect(onSeen).not.toHaveBeenCalled();
    stop();
    expect(seenWaiting()).toBe(0);
  });
});
