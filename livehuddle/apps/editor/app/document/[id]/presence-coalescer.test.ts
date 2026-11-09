// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPresenceCoalescer,
  HIDDEN_FLUSH_MS,
  type CursorPos,
  type PresenceCoalescer,
} from './presence-coalescer';
import type { AvatarPresence } from '@livehuddle/api-schema';

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
  avatars: () => Map<string, { tabId: string; avatar: AvatarPresence }>;
  commits: () => number;
};

function setup(): Harness {
  let cursors = new Map<string, CursorPos>();
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
    setRemoteAvatars: apply(
      () => avatars,
      (v) => (avatars = v),
    ),
  });
  return {
    presence,
    cursors: () => cursors,
    avatars: () => avatars,
    commits: () => commits,
  };
}

const avatarOf = (x: number) => ({ x, y: 0 }) as unknown as AvatarPresence;

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
    // churn the avatar map and re-render their consumers.
    expect(h.commits()).toBe(1);
  });

  it('forgets a departed peer’s buffered packets, so the next frame cannot bring them back', () => {
    // The peer's last move and the roster that drops them land in the same frame.
    const h = setup();
    h.presence.cursor('gone', { tabId: 't1', x: 5, y: 0 });
    h.presence.avatar('gone', { tabId: 't1', avatar: avatarOf(1) });
    h.presence.cursor('here', { tabId: 't1', x: 1, y: 0 });
    h.presence.prune(new Set(['here']));
    runFrame();
    expect(h.cursors().has('gone')).toBe(false);
    expect(h.avatars().has('gone')).toBe(false);
    expect(h.cursors().get('here')).toEqual({ tabId: 't1', x: 1, y: 0 });
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

// docs/specs/008-canvas/avatar-mode.md "A busy room", "The costume rides only when it is needed".
describe('createPresenceCoalescer with lean avatar packets', () => {
  const costume = { gender: 'female', clothing: 'hoodie', hair: 'bun', size: 'regular' } as const;
  const lean = (x: number, withCostume = false) => ({
    x,
    y: 0,
    facing: 'down' as const,
    walking: true,
    ...(withCostume ? { config: costume } : null),
  });

  it('keeps the last costume seen from a peer, and fills the resting values back in', () => {
    const h = setup();
    h.presence.avatar('peer', { tabId: 't1', avatar: lean(1, true) });
    runFrame();
    h.presence.avatar('peer', { tabId: 't1', avatar: lean(2) });
    runFrame();
    expect(h.avatars().get('peer')).toEqual({
      tabId: 't1',
      avatar: { ...lean(2), config: costume, stepFrame: 0, lift: 0, wave: null },
    });
  });

  it('keeps a costume a packet held back in the same frame carried', () => {
    const h = setup();
    h.presence.avatar('peer', { tabId: 't1', avatar: lean(1, true) });
    h.presence.avatar('peer', { tabId: 't1', avatar: lean(2) });
    runFrame();
    expect(h.avatars().get('peer')?.avatar.config).toEqual(costume);
    expect(h.avatars().get('peer')?.avatar.x).toBe(2);
  });

  it('draws a peer whose costume it was never sent without one, until one arrives', () => {
    const h = setup();
    h.presence.avatar('peer', { tabId: 't1', avatar: lean(1) });
    runFrame();
    expect(h.avatars().get('peer')?.avatar.config).toBeUndefined();
    const other = { ...costume, hair: 'afro' } as const;
    h.presence.avatar('peer', { tabId: 't1', avatar: { ...lean(2), config: other } });
    runFrame();
    expect(h.avatars().get('peer')?.avatar.config).toEqual(other);
  });

  it('forgets the costume once the peer has left the mode', () => {
    const h = setup();
    h.presence.avatar('peer', { tabId: 't1', avatar: lean(1, true) });
    runFrame();
    h.presence.avatar('peer', null);
    runFrame();
    h.presence.avatar('peer', { tabId: 't1', avatar: lean(3) });
    runFrame();
    expect(h.avatars().get('peer')?.avatar.config).toBeUndefined();
  });
});

// docs/specs/012-collaboration/proximity-audio.md "Someone who arrives later": a hidden page gets no animation frames,
// so a character that walked up while the tab was hidden never reached the call and nobody subscribed to them.
describe('createPresenceCoalescer in a hidden page', () => {
  let visibility: DocumentVisibilityState = 'visible';
  beforeEach(() => {
    visibility = 'visible';
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const hide = () => {
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('commits on a timer while hidden, asking for no frame', () => {
    const h = setup();
    hide();
    h.presence.avatar('joiner', { tabId: 't1', avatar: avatarOf(5) });
    h.presence.avatar('joiner', { tabId: 't1', avatar: avatarOf(6) });
    expect(rafCalls).toBe(0);
    vi.advanceTimersByTime(HIDDEN_FLUSH_MS);
    expect(h.commits()).toBe(1);
    expect(h.avatars().get('joiner')?.avatar.x).toBe(6);
    h.presence.cancel();
  });

  it('moves a frame asked for before the page hid onto the timer', () => {
    const h = setup();
    h.presence.avatar('joiner', { tabId: 't1', avatar: avatarOf(1) });
    expect(rafCalls).toBe(1);
    const before = cancelled;
    hide();
    expect(cancelled).toBeGreaterThan(before);
    vi.advanceTimersByTime(HIDDEN_FLUSH_MS);
    expect(h.avatars().get('joiner')?.avatar.x).toBe(1);
    h.presence.cancel();
  });

  it('goes back to frames once the page shows', () => {
    const h = setup();
    hide();
    h.presence.cursor('peer', { tabId: 't1', x: 1, y: 1 });
    vi.advanceTimersByTime(HIDDEN_FLUSH_MS);
    visibility = 'visible';
    h.presence.cursor('peer', { tabId: 't1', x: 2, y: 2 });
    expect(rafCalls).toBe(1);
    runFrame();
    expect(h.cursors().get('peer')).toEqual({ tabId: 't1', x: 2, y: 2 });
    h.presence.cancel();
  });

  it('cancels a pending timer and stops listening on teardown', () => {
    const h = setup();
    const remove = vi.spyOn(document, 'removeEventListener');
    hide();
    h.presence.avatar('joiner', { tabId: 't1', avatar: avatarOf(1) });
    h.presence.cancel();
    vi.advanceTimersByTime(HIDDEN_FLUSH_MS * 4);
    expect(h.commits()).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
