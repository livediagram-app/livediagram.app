// @vitest-environment jsdom
// docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not the canvas": in a busy office
// somebody is always walking, and the characters layer follows every frame of it. What follows everyone's positions
// as a fact rather than a picture (the call's scene, the meeting pieces, the game seats, who is where) reads a coarse
// copy of the characters instead, taken at most 10 times a second and at once when someone appears, leaves, sits,
// stands or crosses into another room or onto a stage (blueprint: peer-motion-store.md "The coarse copy").
//
// The bench: 50 peers and you walking for one simulated second at 60 frames a second, every peer moving every frame,
// in an office with a room, a Screen and a Room Sign. Counts, not timings.
import { act, cleanup, render } from '@testing-library/react';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { NO_POSE, type AvatarPose } from '@liveworkspace/avatar/pose';
import type { AvatarPresence } from '@livehuddle/api-schema';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { Participant } from '@/lib/identity';
import { createPeerMotion, type PeerAvatar, type PeerRowsSource } from '@/lib/peer-motion';
import { callPlacesOf, placeOf } from '@/lib/calls/call-places';
import { COARSE_MOTION_MS } from '@/lib/coarse-store';
import { createWayfindingStore } from './wayfinding/wayfinding-store';
import { CanvasCharactersLayer } from './CanvasCharactersLayer';
import type { useCanvasAvatar } from './useCanvasAvatar';

const PEERS = 50;
const FPS = 60;
const FRAME_MS = 1000 / FPS;

const counts = vi.hoisted(() => ({
  layer: 0,
  update: 0,
  parse: 0,
  zoneAt: 0,
  whoIsWhere: 0,
  meetingLive: 0,
  gameScene: 0,
}));
// The last scene the call was fed.
const fed = vi.hoisted(() => ({
  scene: null as null | { self: unknown; walkers: Map<string, { x: number; y: number }> },
}));
const tally = (key: keyof typeof counts) => {
  counts[key]++;
};

// The drawing: stand-ins, so the bench counts the layer's own work and not the sprites'.
vi.mock('@liveworkspace/avatar/components/AvatarWalker', () => ({ AvatarWalker: () => null }));
vi.mock('@liveworkspace/avatar/components/AvatarSelfWalker', () => ({
  AvatarSelfWalker: () => null,
}));
vi.mock('@liveworkspace/avatar/components/AvatarPadArrivals', () => ({
  AvatarPadArrivals: () => null,
}));
vi.mock('./receptionist/ReceptionistLayer', () => ({ ReceptionistLayer: () => null }));
vi.mock('@/components/calls/HearingRing', () => ({ HearingRing: () => null }));
vi.mock('@/components/calls/RaisedHands', () => ({ RaisedHands: () => null }));
vi.mock('@/components/calls/CallBubbles', () => ({
  CallBubbles: () => null,
  useCallBubbleRects: () => ({ current: [] }),
}));
// Rendered once per render of the layer: the layer's render count.
vi.mock('@/components/calls/TalkingBars', () => ({
  TalkingBars: () => {
    tally('layer');
    return null;
  },
}));
// The pieces you alone walk up to follow your own feet, as before; not what this bench counts.
vi.mock('@/components/canvas/collab/useSocialPieces', () => ({ useSocialPieces: () => {} }));
vi.mock('@/components/canvas/collab/usePieceMoments', () => ({ usePieceMoments: () => {} }));
vi.mock('@/lib/office/useWorkdayPieces', () => ({ useWorkdayPieces: () => {} }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => {
  const toast = { info: vi.fn(), action: vi.fn(), dismissAction: vi.fn() };
  return { useToast: () => toast };
});
vi.mock('@/lib/api/capabilities', () => ({
  apiGetCapabilities: vi.fn(async () => ({ callsEnabled: true, callsMode: 'on' })),
}));
// The call: counts what it is fed.
vi.mock('@/lib/calls/proximity-call', () => ({
  ProximityCall: class {
    ended = false;
    update = (scene: typeof fed.scene) => {
      tally('update');
      fed.scene = scene;
    };
    start = async () => {};
    stop = () => {
      this.ended = true;
    };
    setDoNotDisturb = () => {};
  },
}));
vi.mock('@liveworkspace/avatar/config', async (actual) => {
  const real = await actual<typeof import('@liveworkspace/avatar/config')>();
  return {
    ...real,
    parseAvatarConfig: (raw: unknown) => {
      tally('parse');
      return real.parseAvatarConfig(raw);
    },
  };
});
vi.mock('@livehuddle/document', async (actual) => {
  const real = await actual<typeof import('@livehuddle/document')>();
  return {
    ...real,
    zoneAt: (...a: Parameters<typeof real.zoneAt>) => {
      tally('zoneAt');
      return real.zoneAt(...a);
    },
  };
});
vi.mock('@/lib/wayfinding', async (actual) => {
  const real = await actual<typeof import('@/lib/wayfinding')>();
  return {
    ...real,
    whoIsWhere: (...a: Parameters<typeof real.whoIsWhere>) => {
      tally('whoIsWhere');
      return real.whoIsWhere(...a);
    },
  };
});
vi.mock('@/lib/office/meeting-live', async (actual) => {
  const real = await actual<typeof import('@/lib/office/meeting-live')>();
  return {
    ...real,
    setMeetingLive: (...a: Parameters<typeof real.setMeetingLive>) => {
      tally('meetingLive');
      return real.setMeetingLive(...a);
    },
  };
});
vi.mock('@/lib/table-games/table-game-scene', async (actual) => {
  const real = await actual<typeof import('@/lib/table-games/table-game-scene')>();
  return {
    ...real,
    setTableGameScene: (...a: Parameters<typeof real.setTableGameScene>) => {
      tally('gameScene');
      return real.setTableGameScene(...a);
    },
  };
});

const person = (id: string): Participant => ({ id, name: id, color: '#123456', status: 'online' });
const SELF = person('me');
const PEOPLE = Array.from({ length: PEERS }, (_, i) => person(`p${i}`));
// One costume object per peer, kept across their lean packets as the presence coalescer keeps it.
const COSTUMES = PEOPLE.map(() => ({ gender: 'f', clothing: 'suit', hair: 'bob', size: 'm' }));

const shape = (id: string, kind: string, x: number, y: number, w: number, h: number) => ({
  id,
  type: 'shape',
  shape: kind,
  x,
  y,
  width: w,
  height: h,
});
// A room across the middle with a Screen and a Room Sign in it; the rest is open floor.
const ELEMENTS = [
  shape('room', 'room', 800, 0, 800, 2000),
  shape('screen', 'screen', 1000, 100, 200, 120),
  shape('sign', 'room-sign', 1300, 100, 80, 60),
];

// Where peer i stands on frame f: every peer walks right 2 px a frame, so a few cross the room's walls each second.
const at = (i: number, f: number) => ({ x: ((i * 37) % 2400) + f * 2, y: 40 * i });
const selfAt = (f: number) => ({ x: 100 + f * 2, y: 100 });

// The frames of a second on which someone (a peer or you) crossed into another room: each passes on at once.
function crossingFrames(from: number): number {
  const places = callPlacesOf(ELEMENTS as never);
  let frames = 0;
  for (let f = from; f < from + FPS; f++) {
    const crossed =
      placeOf(selfAt(f), places) !== placeOf(selfAt(f - 1), places) ||
      PEOPLE.some((_, i) => placeOf(at(i, f), places) !== placeOf(at(i, f - 1), places));
    if (crossed) frames++;
  }
  return frames;
}

function avatarsAt(f: number): Map<string, PeerAvatar> {
  const map = new Map<string, PeerAvatar>();
  for (const [i, p] of PEOPLE.entries()) {
    map.set(p.id, {
      tabId: 't1',
      avatar: {
        ...at(i, f),
        facing: 'right',
        walking: true,
        stepFrame: f % 2,
        config: COSTUMES[i],
      } as unknown as AvatarPresence,
    });
  }
  return map;
}

function setup() {
  const motion = createPeerMotion();
  motion.avatars.set(avatarsAt(0));
  const peers: PeerRowsSource = {
    motion,
    livePresenceById: new Map([SELF, ...PEOPLE].map((p) => [p.id, p])),
    selfId: SELF.id,
    activeId: 't1',
    tabFocus: new Map(),
  };
  const poseStore = createStateStore<AvatarPose>({ ...NO_POSE, pos: { x: 100, y: 100 } });
  const props = {
    peers,
    canvasTool: 'avatar',
    selfParticipant: SELF,
    activeTabId: 't1',
    takePart: true,
    onCallSignal: vi.fn(),
    elements: ELEMENTS,
    settings: {},
    imageContext: { ownerId: 'o', documentId: 'd', shareCode: null },
    canShareScreen: true,
  } as unknown as CanvasProps;
  const canvasAvatar = {
    avatar: {
      poseStore,
      placed: true,
      readPos: () => poseStore.get().pos,
      walkTo: vi.fn(),
      seatedOn: null,
      seatClaim: null,
      standUp: vi.fn(),
      holding: null,
    },
    avatarBurst: null,
    avatarLook: { config: COSTUMES[0] },
    avatarStandingOn: null,
    avatarStatus: 'available',
    setAvatarBurst: vi.fn(),
    sitsDown: () => false,
    speech: { composerOpen: false },
    speechBubbles: [],
    walkElements: ELEMENTS,
    seatsOf: () => null,
    wayfinding: { store: createWayfindingStore() },
  } as unknown as ReturnType<typeof useCanvasAvatar>;
  const viewport = createViewportStore(1);
  render(
    <ViewportStoreProvider store={viewport}>
      <CanvasCharactersLayer
        props={props}
        canvasAvatar={canvasAvatar}
        mainSize={{ width: 1180, height: 820 }}
      />
    </ViewportStoreProvider>,
  );
  return { motion, poseStore };
}

// One simulated second: every peer and you take a step each frame, as the presence coalescer and the walk loop write.
function walkOneSecond(env: ReturnType<typeof setup>, from: number) {
  for (let f = from; f < from + FPS; f++) {
    act(() => {
      env.motion.avatars.set(avatarsAt(f));
      env.poseStore.set((pose) => ({ ...pose, pos: selfAt(f) }));
      vi.advanceTimersByTime(FRAME_MS);
    });
  }
  // The coalesced copy's last write lands once the walk has been still for its interval.
  act(() => {
    vi.advanceTimersByTime(200);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running';
      close = async () => {};
      resume = async () => {};
    },
  );
  for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the characters layer with 50 walking peers', () => {
  it('counts a second of everyone walking', async () => {
    const env = setup();
    // The call joins by itself once the capabilities answer.
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    walkOneSecond(env, 1);
    for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0;

    const cpuMs = cpuMsOf(() => walkOneSecond(env, FPS + 1));

    console.log('[characters-bench] per second', JSON.stringify({ ...counts, cpuMs }));
    // The layer draws the characters: it follows every frame, once.
    expect(counts.layer).toBeGreaterThanOrEqual(FPS);
    expect(counts.layer).toBeLessThanOrEqual(FPS + 2);
    // What reads positions as facts: at most once a COARSE_MOTION_MS, plus once per frame somebody crossed a wall
    // (and the walk's last position landing). Before the coarse copy, each of these was 60.
    const bound = Math.ceil(1000 / COARSE_MOTION_MS) + crossingFrames(FPS + 1) + 1;
    expect(bound).toBeLessThan(FPS / 2);
    for (const key of ['update', 'whoIsWhere', 'meetingLive', 'gameScene'] as const) {
      expect(counts[key], key).toBeLessThanOrEqual(bound);
      expect(counts[key], key).toBeGreaterThan(0);
    }
    // A walk that stops lands where it stopped: the call ends on everyone's last position.
    const last = 2 * FPS;
    expect(fed.scene!.walkers.get('p7')).toMatchObject(at(7, last));
    expect(fed.scene!.self).toMatchObject(selfAt(last));
    // Costumes are read once per costume, never per frame.
    expect(counts.parse).toBe(0);
  });
});
