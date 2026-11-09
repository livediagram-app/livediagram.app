// @vitest-environment jsdom
// docs/specs/008-canvas/blueprints/peer-motion-store.md "The coarse copy": the facts that pass on at once, and the
// readers that hand the same rows the frame-rate readers built.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { NO_POSE, type AvatarPose } from '@livehuddle/avatar/pose';
import type { AvatarPresence } from '@livehuddle/api-schema';
import type { Element } from '@livehuddle/document';
import { callPlacesOf, placeOf } from '@/lib/calls/call-places';
import { createPeerMotion, type PeerAvatar, type PeerRowsSource } from '@/lib/peer-motion';
import { COARSE_MOTION_MS } from '@/lib/coarse-store';
import { feetFacts, peerFacts, useCoarseMotion } from './useCoarseMotion';
import { peerAvatarRowsOf } from './usePeerRows';

const shape = (id: string, kind: string, x: number, y: number, width: number, height: number) =>
  ({ id, type: 'shape', shape: kind, x, y, width, height }) as unknown as Element;
const ELEMENTS = [
  shape('room', 'room', 0, 0, 1000, 1000),
  shape('stage', 'stage', 100, 100, 300, 200),
];
const PLACES = callPlacesOf(ELEMENTS);

const entry = (x: number, extra: Partial<AvatarPresence> = {}, tabId = 't1'): PeerAvatar => ({
  tabId,
  avatar: { x, y: 600, facing: 'down', walking: true, ...extra } as AvatarPresence,
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('callPlacesOf and placeOf', () => {
  it('works out a board once, and names the room and the stage a point stands in', () => {
    expect(callPlacesOf(ELEMENTS)).toBe(PLACES);
    expect(PLACES.zones).toHaveLength(1);
    expect(PLACES.stages).toHaveLength(1);
    expect(placeOf({ x: 2000, y: 2000 }, PLACES)).toBe('/');
    expect(placeOf({ x: 500, y: 600 }, PLACES)).toBe('room/');
    const top = PLACES.stages[0]!;
    expect(placeOf({ x: (top.x0 + top.x1) / 2, y: (top.y0 + top.y1) / 2 }, PLACES)).toBe(
      'room/stage',
    );
    // A board with neither tests nothing.
    expect(placeOf({ x: 1, y: 1 }, callPlacesOf([]))).toBe('/');
  });
});

describe('peerFacts and feetFacts', () => {
  const facts = (e: PeerAvatar) => peerFacts(new Map([['p1', e]]), PLACES);

  it('a step within a place is no new fact', () => {
    expect(facts(entry(500))).toBe(facts(entry(520)));
  });

  it('crossing a wall, sitting, a seat, and changing tab are each a new fact', () => {
    const base = facts(entry(500));
    expect(facts(entry(1500))).not.toBe(base);
    expect(facts(entry(500, { seatedOn: 'chair' }))).not.toBe(base);
    expect(facts(entry(500, { seatedOn: 'chair', seat: { index: 1, at: 0, tie: 0 } }))).not.toBe(
      facts(entry(500, { seatedOn: 'chair', seat: { index: 0, at: 0, tie: 0 } })),
    );
    expect(facts(entry(500, {}, 't2'))).not.toBe(base);
    // Somebody appearing or leaving.
    expect(peerFacts(new Map(), PLACES)).not.toBe(base);
  });

  it('your feet: placed or not, and where', () => {
    const at = (pos: AvatarPose['pos']) => feetFacts({ ...NO_POSE, pos }, PLACES);
    expect(at(null)).toBe('away');
    expect(at({ x: 500, y: 600 })).toBe(at({ x: 510, y: 600 }));
    expect(at({ x: 1500, y: 600 })).not.toBe(at({ x: 500, y: 600 }));
  });
});

describe('useCoarseMotion', () => {
  it('hand the frame-rate rows for the snapshot they publish, and your feet, at the coarse rate', () => {
    const motion = createPeerMotion();
    motion.avatars.set(new Map([['p1', entry(500)]]));
    const peers: PeerRowsSource = {
      motion,
      livePresenceById: new Map([
        ['p1', { id: 'p1', name: 'Sam', color: '#f00', status: 'online' }],
      ]),
      selfId: 'me',
      activeId: 't1',
      tabFocus: new Map(),
    };
    const poseStore = createStateStore<AvatarPose>({ ...NO_POSE, pos: { x: 500, y: 600 } });
    const { result } = renderHook(() => {
      const { remoteAvatars, feet } = useCoarseMotion(peers, poseStore, PLACES);
      return { rows: remoteAvatars, feet };
    });
    expect(result.current.rows).toBe(peerAvatarRowsOf(peers, motion.avatars.get()));
    expect(result.current.feet).toEqual({ x: 500, y: 600 });

    // The first step passes on; the next, yours or theirs, inside the interval and the same room, waits: one cadence.
    act(() => motion.avatars.set(new Map([['p1', entry(510)]])));
    act(() => poseStore.set({ ...NO_POSE, pos: { x: 510, y: 600 } }));
    act(() => motion.avatars.set(new Map([['p1', entry(520)]])));
    expect(result.current.rows[0]!.avatar.x).toBe(510);
    expect(result.current.feet).toEqual({ x: 500, y: 600 });
    // Crossing the wall passes on at once.
    act(() => motion.avatars.set(new Map([['p1', entry(1500)]])));
    act(() => poseStore.set({ ...NO_POSE, pos: { x: 1500, y: 600 } }));
    expect(result.current.rows[0]!.avatar.x).toBe(1500);
    expect(result.current.feet).toEqual({ x: 1500, y: 600 });
    // A held step lands once the interval has passed.
    act(() => motion.avatars.set(new Map([['p1', entry(1510)]])));
    expect(result.current.rows[0]!.avatar.x).toBe(1500);
    act(() => {
      vi.advanceTimersByTime(COARSE_MOTION_MS);
    });
    expect(result.current.rows[0]!.avatar.x).toBe(1510);
  });
});
