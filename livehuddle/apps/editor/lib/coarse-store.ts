// A coarse copy of a moving store (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not
// the canvas"; blueprint: peer-motion-store.md "The coarse copy"): what follows everyone's positions as a fact (the
// call's scene, the meeting pieces, the game seats, who is where) reads it instead of the frame-by-frame store. It
// passes a change on at most once per interval while only positions move, at once when a fact changes (someone
// appears, leaves, sits, crosses a wall), and the last position of a walk that stops once the interval has passed.
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** 10 a second: under the call's 120 ms glide (audio-graph.ts GLIDE_S), and a sign a tenth of a second late reads at once. */
export const COARSE_MOTION_MS = 100;

export function coarseStore<S>(
  source: ReadableStore<S>,
  options: { intervalMs?: number; factsOf: (snapshot: S) => string },
): ReadableStore<S> {
  const intervalMs = options.intervalMs ?? COARSE_MOTION_MS;
  const { factsOf } = options;
  const listeners = createListeners();
  let subscribers = 0;
  let published = source.get();
  let facts = factsOf(published);
  let publishedAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const publish = (next: S, nextFacts: string) => {
    clearTimer();
    published = next;
    facts = nextFacts;
    publishedAt = Date.now();
    listeners.notify();
  };
  const onChange = () => {
    const next = source.get();
    if (next === published) return;
    const nextFacts = factsOf(next);
    if (nextFacts !== facts || Date.now() - publishedAt >= intervalMs) {
      publish(next, nextFacts);
      return;
    }
    // Held: a walk that goes on publishes on a later step; one that stops, when the timer fires.
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      const last = source.get();
      if (last !== published) publish(last, factsOf(last));
    }, intervalMs);
  };

  return {
    get() {
      // Nobody listening: nothing keeps the copy current, so it reads the source (a reader never starts stale).
      if (subscribers === 0) {
        const now = source.get();
        if (now !== published) {
          published = now;
          facts = factsOf(now);
        }
      }
      return published;
    },
    subscribe(listener) {
      const off = listeners.subscribe(listener);
      if (subscribers++ === 0) unsubscribe = source.subscribe(onChange);
      return () => {
        off();
        if (--subscribers === 0) {
          unsubscribe?.();
          unsubscribe = null;
          clearTimer();
        }
      };
    },
  };
}
