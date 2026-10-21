import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPresenceCoalescer, type CursorPos, type PresenceCoalescer } from './presence-coalescer';

// The coalescer is the one part of the room that treats a packet as a sample
// rather than an event: many arrive per frame and exactly one state commit
// comes out. Everything interesting about it is in that gap, and none of it
// could be reached while it lived inside the connection effect's closure.

// A hand-driven rAF: nothing runs until the test says so, which is what makes
// "several packets, one commit" observable at all.
let frame: (() => void) | null = null;
let rafCalls = 0;
let cancelled = 0;

beforeEach(() => {
  frame = null;
  rafCalls = 0;
  cancelled = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    rafCalls += 1;
    frame = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    cancelled += 1;
    frame = null;
  });
});
afterEach(() => vi.unstubAllGlobals());

const runFrame = () => {
  const cb = frame;
  frame = null;
  cb?.();
};

type Harness = {
  presence: PresenceCoalescer;
  cursors: () => Map<string, CursorPos>;
  commits: () => number;
};

function setup(): Harness {
  let cursors = new Map<string, CursorPos>();
  let commits = 0;
  const apply =
    <T>(get: () => T, set: (v: T) => void) =>
    (update: T | ((prev: T) => T)) => {
      commits += 1;
      set(typeof update === 'function' ? (update as (prev: T) => T)(get()) : update);
    };
  const presence = createPresenceCoalescer({
    setRemoteCursors: apply(
      () => cursors,
      (v) => (cursors = v),
    ),
  });
  return {
    presence,
    cursors: () => cursors,
    commits: () => commits,
  };
}

describe('createPresenceCoalescer', () => {
  it('commits once per frame however many packets arrive', () => {
    const h = setup();
    for (let i = 0; i < 20; i += 1) h.presence.cursor('peer', { tabId: 't1', x: i, y: 0 });
    // The whole point: 20 packets must not be 20 renders.
    expect(h.commits()).toBe(0);
    expect(rafCalls).toBe(1);
    runFrame();
    expect(h.commits()).toBe(1);
    expect(h.cursors().get('peer')).toEqual({ tabId: 't1', x: 19, y: 0 });
  });

  it('keeps a null cursor, because "left the tab" is a position', () => {
    const h = setup();
    h.presence.cursor('peer', null);
    runFrame();
    expect(h.cursors().has('peer')).toBe(true);
    expect(h.cursors().get('peer')).toBeNull();
  });

  it('cancels a pending frame so a flush cannot land after teardown', () => {
    const h = setup();
    h.presence.cursor('peer', { tabId: 't1', x: 1, y: 0 });
    h.presence.cancel();
    expect(cancelled).toBe(1);
    runFrame();
    expect(h.commits()).toBe(0);
  });

  it('schedules a fresh frame after one has flushed', () => {
    const h = setup();
    h.presence.cursor('peer', { tabId: 't1', x: 1, y: 0 });
    runFrame();
    h.presence.cursor('peer', { tabId: 't1', x: 2, y: 0 });
    expect(rafCalls).toBe(2);
    runFrame();
    expect(h.cursors().get('peer')).toEqual({ tabId: 't1', x: 2, y: 0 });
  });
});
