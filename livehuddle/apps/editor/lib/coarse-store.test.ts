// docs/specs/008-canvas/blueprints/peer-motion-store.md "The coarse copy".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { COARSE_MOTION_MS, coarseStore } from './coarse-store';

type Snap = { x: number; room: string };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const source = createStateStore<Snap>({ x: 0, room: 'a' });
  const coarse = coarseStore(source, { factsOf: (s) => s.room });
  const seen: number[] = [];
  const off = coarse.subscribe(() => seen.push(coarse.get().x));
  // Each step is a frame: the source moves, then 16 ms pass.
  const step = (next: Snap) => {
    source.set(next);
    vi.advanceTimersByTime(16);
  };
  return { source, coarse, seen, off, step };
}

describe('coarseStore', () => {
  it('passes the first change on, then at most one a COARSE_MOTION_MS while only positions move', () => {
    const { seen, step } = setup();
    for (let f = 1; f <= 60; f++) step({ x: f, room: 'a' });
    // 60 frames over 960 ms: the first, then one each time 100 ms have passed since the last.
    expect(seen.length).toBeLessThanOrEqual(Math.ceil((60 * 16) / COARSE_MOTION_MS) + 1);
    expect(seen.length).toBeGreaterThanOrEqual(Math.floor((60 * 16) / COARSE_MOTION_MS));
    expect(seen[0]).toBe(1);
  });

  it('passes a new fact on at once, whatever the interval', () => {
    const { seen, step } = setup();
    step({ x: 1, room: 'a' });
    step({ x: 2, room: 'a' });
    expect(seen).toEqual([1]);
    step({ x: 3, room: 'b' });
    step({ x: 4, room: 'a' });
    expect(seen).toEqual([1, 3, 4]);
  });

  it('lands a walk that stopped on its last position once the interval has passed, and only then', () => {
    const { seen, step } = setup();
    step({ x: 1, room: 'a' });
    step({ x: 2, room: 'a' });
    step({ x: 3, room: 'a' });
    expect(seen).toEqual([1]);
    vi.advanceTimersByTime(COARSE_MOTION_MS - 20);
    expect(seen).toEqual([1]);
    vi.advanceTimersByTime(20);
    expect(seen).toEqual([1, 3]);
    // Nothing more to land: the timer is spent.
    vi.advanceTimersByTime(COARSE_MOTION_MS * 3);
    expect(seen).toEqual([1, 3]);
  });

  it('ignores a notification with no new value, and a trailing timer with nothing new to land', () => {
    const source = createStateStore<Snap>({ x: 0, room: 'a' });
    const listeners = new Set<() => void>();
    // A source that notifies without changing, as a shared listener set may.
    const noisy = {
      get: source.get,
      subscribe: (l: () => void) => {
        listeners.add(l);
        const off = source.subscribe(l);
        return () => {
          listeners.delete(l);
          off();
        };
      },
    };
    const coarse = coarseStore(noisy, { factsOf: (s) => s.room, intervalMs: 50 });
    const seen: number[] = [];
    coarse.subscribe(() => seen.push(coarse.get().x));
    source.set({ x: 1, room: 'a' });
    for (const l of listeners) l();
    expect(seen).toEqual([1]);
    // Held, then the source goes back to what was published before the timer fires.
    const published = source.get();
    source.set({ x: 2, room: 'a' });
    source.set(published);
    vi.advanceTimersByTime(50);
    expect(seen).toEqual([1]);
  });

  it('reads the source while nobody listens, and lets go of it with the last listener', () => {
    const source = createStateStore<Snap>({ x: 0, room: 'a' });
    const coarse = coarseStore(source, { factsOf: (s) => s.room });
    source.set({ x: 5, room: 'a' });
    expect(coarse.get()).toEqual({ x: 5, room: 'a' });
    expect(coarse.get()).toBe(source.get());
    const seen: number[] = [];
    const offA = coarse.subscribe(() => seen.push(1));
    const offB = coarse.subscribe(() => seen.push(2));
    source.set({ x: 6, room: 'a' });
    expect(seen).toEqual([1, 2]);
    offA();
    source.set({ x: 7, room: 'b' });
    expect(seen).toEqual([1, 2, 2]);
    // A held change, then the last listener goes: its timer goes too, and the copy reads the source again.
    source.set({ x: 8, room: 'b' });
    offB();
    vi.advanceTimersByTime(COARSE_MOTION_MS * 2);
    expect(seen).toEqual([1, 2, 2]);
    expect(coarse.get().x).toBe(8);
    source.set({ x: 9, room: 'c' });
    expect(seen).toEqual([1, 2, 2]);
  });
});
