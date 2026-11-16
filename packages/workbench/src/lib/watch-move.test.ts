// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchMove } from './watch-move';

// jsdom has no IntersectionObserver: a stand-in that records each observer and reports entries by hand.
type Options = { root: unknown; rootMargin: string; threshold: number };
class FakeObserver {
  static all: FakeObserver[] = [];
  disconnected = false;
  observed: Element[] = [];
  readonly callback: (entries: { intersectionRatio: number }[]) => void;
  readonly options: Options;
  constructor(callback: (entries: { intersectionRatio: number }[]) => void, options: Options) {
    this.callback = callback;
    this.options = options;
    FakeObserver.all.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
}
const latest = () => FakeObserver.all[FakeObserver.all.length - 1]!;
const report = (ratio: number) => latest().callback([{ intersectionRatio: ratio }]);

afterEach(() => {
  FakeObserver.all = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function box(rect: DOMRect) {
  const el = document.createElement('div');
  const spy = vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
  return { el, spy };
}

describe('watchMove', () => {
  it('cuts its root margin to the box and reports a move, then watches the new place', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
    const { el, spy } = box(new DOMRect(300.5, 12, 400, 46));
    const onMove = vi.fn();
    const stop = watchMove(el, onMove);
    expect(latest().options).toEqual({
      root: document,
      rootMargin: '-12px -299px -742px -300px',
      threshold: 1,
    });
    expect(latest().observed).toEqual([el]);
    // The first report is the still state.
    report(1);
    expect(onMove).not.toHaveBeenCalled();
    spy.mockReturnValue(new DOMRect(380, 12, 400, 46));
    report(0.8);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(FakeObserver.all[0]!.disconnected).toBe(true);
    expect(latest().options.rootMargin).toBe('-12px -220px -742px -380px');
    stop();
    expect(latest().disconnected).toBe(true);
  });

  it('watches from a box’s own first ratio when it never reads wholly inside', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const { el } = box(new DOMRect(0, 0, 10, 10));
    const onMove = vi.fn();
    watchMove(el, onMove);
    report(0.5);
    expect(latest().options.threshold).toBe(0.5);
    expect(FakeObserver.all).toHaveLength(2);
    // Its own first read is taken as it is, never re-cut again.
    report(0.4);
    expect(FakeObserver.all).toHaveLength(2);
    report(0.3);
    expect(onMove).toHaveBeenCalledTimes(1);
    // Fully off screen: the smallest threshold, not zero.
    const { el: gone } = box(new DOMRect(0, 0, 10, 10));
    watchMove(gone, onMove);
    report(0);
    expect(latest().options.threshold).toBe(1e-7);
  });

  it('watches nothing for a box with no size, or without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const { el } = box(new DOMRect(0, 0, 0, 0));
    watchMove(el, vi.fn())();
    expect(FakeObserver.all).toHaveLength(0);
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() => watchMove(el, vi.fn())()).not.toThrow();
  });
});
