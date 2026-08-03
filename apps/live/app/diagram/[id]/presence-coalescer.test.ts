import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPresenceCoalescer,
  type CursorPos,
  type LaserTrail,
  type PresenceCoalescer,
} from './presence-coalescer';
import type { AvatarPresence } from '@livediagram/api-schema';

// The coalescer is the one part of the room that treats a packet as a sample
// rather than an event: many arrive per frame and exactly one state commit
// comes out. Everything interesting about it is in that gap — what accumulates,
// what replaces, and what a tab switch resets — and none of it could be reached
// while it lived inside the connection effect's closure.

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
  lasers: () => Map<string, LaserTrail>;
  avatars: () => Map<string, { tabId: string; avatar: AvatarPresence }>;
  commits: () => number;
};

function setup(): Harness {
  let cursors = new Map<string, CursorPos>();
  let lasers = new Map<string, LaserTrail>();
  let avatars = new Map<string, { tabId: string; avatar: AvatarPresence }>();
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
    setRemoteLaserTrails: apply(
      () => lasers,
      (v) => (lasers = v),
    ),
    setRemoteAvatars: apply(
      () => avatars,
      (v) => (avatars = v),
    ),
  });
  return {
    presence,
    cursors: () => cursors,
    lasers: () => lasers,
    avatars: () => avatars,
    commits: () => commits,
  };
}

const avatarOf = (x: number) => ({ x, y: 0 }) as unknown as AvatarPresence;
const point = (x: number) => ({ x, y: 0, t: x });

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

  it('commits nothing for a stream that never arrived', () => {
    const h = setup();
    h.presence.cursor('peer', { tabId: 't1', x: 1, y: 0 });
    runFrame();
    // Only cursors moved, so only that setter is called — a frame must not
    // churn the laser and avatar maps and re-render their consumers.
    expect(h.commits()).toBe(1);
  });

  it('keeps a null cursor, because "left the tab" is a position', () => {
    const h = setup();
    h.presence.cursor('peer', null);
    runFrame();
    expect(h.cursors().has('peer')).toBe(true);
    expect(h.cursors().get('peer')).toBeNull();
  });

  it('DELETES an avatar rather than storing a null one', () => {
    // Asymmetric with cursors on purpose: nothing renders a character that
    // isn't there, so the map stays as big as the number of people walking.
    const h = setup();
    h.presence.avatar('peer', { tabId: 't1', avatar: avatarOf(1) });
    runFrame();
    expect(h.avatars().has('peer')).toBe(true);
    h.presence.avatar('peer', null);
    runFrame();
    expect(h.avatars().has('peer')).toBe(false);
  });

  it('accumulates laser points within one frame', () => {
    const h = setup();
    h.presence.laser('peer', { tabId: 't1', point: point(1) });
    h.presence.laser('peer', { tabId: 't1', point: point(2) });
    h.presence.laser('peer', { tabId: 't1', point: point(3) });
    runFrame();
    expect(
      h
        .lasers()
        .get('peer')
        ?.points.map((p) => p.x),
    ).toEqual([1, 2, 3]);
  });

  it('drops the trail on a tab switch, so no line is drawn across the gap', () => {
    const h = setup();
    h.presence.laser('peer', { tabId: 't1', point: point(1) });
    h.presence.laser('peer', { tabId: 't2', point: point(9) });
    runFrame();
    const trail = h.lasers().get('peer');
    expect(trail?.tabId).toBe('t2');
    expect(trail?.points.map((p) => p.x)).toEqual([9]);
  });

  it('carries the sender\u2019s pen through to the committed trail (spec/111)', () => {
    // "Everyone sees your pen": the look travels with the samples. This is
    // the whole feature — without it every peer renders DEFAULT_LASER_CONFIG
    // and a presenter's bold amber comet is a thin default line elsewhere.
    const config = { width: 'bold', colour: 'amber' } as unknown as LaserTrail['config'];
    const h = setup();
    h.presence.laser('peer', { tabId: 't1', point: point(1), config });
    runFrame();
    expect(h.lasers().get('peer')?.config).toBe(config);
  });

  it('keeps the last pen when a later packet carries none', () => {
    // Receivers keep the LATEST look per participant, across frames, not just
    // within one: the sender only re-sends a look when it changes.
    const config = { width: 'bold' } as unknown as LaserTrail['config'];
    const h = setup();
    h.presence.laser('peer', { tabId: 't1', point: point(1), config });
    runFrame();
    h.presence.laser('peer', { tabId: 't1', point: point(2) });
    runFrame();
    expect(h.lasers().get('peer')?.config).toBe(config);
  });

  it('takes a newer pen over the one it was holding', () => {
    const first = { width: 'fine' } as unknown as LaserTrail['config'];
    const second = { width: 'bold' } as unknown as LaserTrail['config'];
    const h = setup();
    h.presence.laser('peer', { tabId: 't1', point: point(1), config: first });
    runFrame();
    h.presence.laser('peer', { tabId: 't1', point: point(2), config: second });
    runFrame();
    expect(h.lasers().get('peer')?.config).toBe(second);
  });

  it('keeps the pen across a tab switch, because it belongs to the person', () => {
    const config = { width: 'bold' } as unknown as LaserTrail['config'];
    const h = setup();
    h.presence.laser('peer', { tabId: 't1', point: point(1), config });
    runFrame();
    h.presence.laser('peer', { tabId: 't2', point: point(9) });
    runFrame();
    const trail = h.lasers().get('peer');
    // Points reset (no line across the gap), pen does not.
    expect(trail?.points.map((p) => p.x)).toEqual([9]);
    expect(trail?.config).toBe(config);
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
