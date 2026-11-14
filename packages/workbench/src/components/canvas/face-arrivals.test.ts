// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchFaceArrivals } from './face-arrivals';
import { SKETCH_INK_MAX_WAIT_MS, SKETCH_INK_SETTLE_MS } from './settle-watch';

// The parts a face's take left unseen (useFaceFinishPass's FaceFinishBoard `unseen`), watched until they scroll into
// view. jsdom has no IntersectionObserver: a stand-in the test reports entries through by hand.
class FakeObserver {
  static all: FakeObserver[] = [];
  watched = new Set<Element>();
  readonly callback: (entries: IntersectionObserverEntry[]) => void;
  constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
    this.callback = callback;
    FakeObserver.all.push(this);
  }
  observe(el: Element) {
    this.watched.add(el);
  }
  disconnect() {
    this.watched.clear();
  }
}
const entry = (target: Element, isIntersecting: boolean) =>
  ({ target, isIntersecting }) as unknown as IntersectionObserverEntry;
const report = (...entries: IntersectionObserverEntry[]) => FakeObserver.all[0]!.callback(entries);

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('watchFaceArrivals', () => {
  it('takes once the arrivals pause, SKETCH_INK_SETTLE_MS after the last', async () => {
    const arrive = vi.fn();
    const arrivals = watchFaceArrivals(arrive);
    const [a, b] = [document.createElement('div'), document.createElement('div')];
    arrivals.watch([a, b]);
    report(entry(a, true));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS - 10);
    report(entry(b, true));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS - 10);
    expect(arrive).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    expect(arrive).toHaveBeenCalledTimes(1);
    arrivals.stop();
  });

  it(`waits at most SKETCH_INK_MAX_WAIT_MS (${SKETCH_INK_MAX_WAIT_MS}) while cards keep arriving`, async () => {
    const arrive = vi.fn();
    const arrivals = watchFaceArrivals(arrive);
    const cards = Array.from({ length: 200 }, () => document.createElement('div'));
    arrivals.watch(cards);
    // A card a frame for over a second: the take still comes within the cap.
    for (const [i, el] of cards.entries()) {
      report(entry(el, true));
      await vi.advanceTimersByTimeAsync(16);
      if (arrive.mock.calls.length) {
        expect(i * 16).toBeLessThanOrEqual(SKETCH_INK_MAX_WAIT_MS);
        break;
      }
    }
    expect(arrive).toHaveBeenCalledTimes(1);
    arrivals.stop();
  });

  it('counts a card once per arrival: again only after it has left the view', async () => {
    const arrive = vi.fn();
    const arrivals = watchFaceArrivals(arrive);
    const el = document.createElement('div');
    arrivals.watch([el]);
    report(entry(el, true));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS);
    expect(arrive).toHaveBeenCalledTimes(1);
    // Still in view (the next take skipped it again): no take in a loop.
    report(entry(el, true));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS);
    expect(arrive).toHaveBeenCalledTimes(1);
    report(entry(el, false));
    report(entry(el, true));
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS);
    expect(arrive).toHaveBeenCalledTimes(2);
    arrivals.stop();
  });

  it('holds no observer until there is a card to watch, and watches only the latest cards', () => {
    const arrivals = watchFaceArrivals(() => {});
    arrivals.watch([]);
    expect(FakeObserver.all).toHaveLength(0);
    const [a, b] = [document.createElement('div'), document.createElement('div')];
    arrivals.watch([a]);
    arrivals.watch([b]);
    expect(FakeObserver.all).toHaveLength(1);
    expect([...FakeObserver.all[0]!.watched]).toEqual([b]);
    arrivals.watch([]);
    expect(FakeObserver.all[0]!.watched.size).toBe(0);
    arrivals.stop();
  });

  it('stops a pending take', async () => {
    const arrive = vi.fn();
    const arrivals = watchFaceArrivals(arrive);
    const el = document.createElement('div');
    arrivals.watch([el]);
    report(entry(el, true));
    arrivals.stop();
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS * 4);
    expect(arrive).not.toHaveBeenCalled();
  });

  it('does nothing without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const arrivals = watchFaceArrivals(() => {});
    expect(() => {
      arrivals.watch([document.createElement('div')]);
      arrivals.stop();
    }).not.toThrow();
  });
});
