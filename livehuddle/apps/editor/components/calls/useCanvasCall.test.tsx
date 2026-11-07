// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import {
  callLetByMe,
  callMaximised,
  resetCallPeers,
  setCallMaximised,
} from '@/lib/calls/calls-store';
import { useCanvasCall } from './useCanvasCall';

const hook = vi.hoisted(() => ({ useProximityCall: vi.fn() }));
vi.mock('@/lib/calls/useProximityCall', () => hook);
const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);
const toast = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const props = {
  remoteAvatars: [
    { id: 'p1', name: 'Sam', color: '#f00', glideMs: 33, avatar: { x: 500, y: 0, config: {} } },
  ],
  imageContext: { ownerId: 'o', documentId: 'd', shareCode: 'sc' },
  takePart: true,
  onCallSignal: vi.fn(),
  activeTabId: 't1',
  selfParticipant: { color: '#00f' },
  elements: [],
} as unknown as CanvasProps;

afterEach(() => vi.clearAllMocks());

// docs/specs/012-collaboration/proximity-audio.md "The talking equaliser".
describe('useCanvasCall', () => {
  it('feeds the call where everyone stands and walks you most of the way to a talker', () => {
    const walkTo = vi.fn();
    const { result } = renderHook(() =>
      useCanvasCall({
        props,
        canvasTool: 'avatar',
        avatar: { pos: { x: 0, y: 0 }, walkTo },
        avatarScale: 1,
      }),
    );
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        inMode: true,
        canSpeak: true,
        caller: { ownerId: 'o', documentId: 'd', shareCode: 'sc' },
        tabId: 't1',
        self: { x: 0, y: 0 },
      }),
    );
    expect(result.current.bars.peers[0]).toMatchObject({
      id: 'p1',
      at: { x: 500, y: 0 },
      // The default character size.
      scale: 1.5,
    });
    result.current.bars.onWalkTo!('p1', { x: 500, y: 0 });
    expect(walkTo).toHaveBeenCalledWith({ x: 440, y: 0 });
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'WalkToTalker');
  });

  it('out of the mode, you are nowhere and the bars only show', () => {
    const { result } = renderHook(() =>
      useCanvasCall({
        props: { ...props, imageContext: undefined, takePart: false },
        canvasTool: 'select',
        avatar: { pos: { x: 0, y: 0 }, walkTo: vi.fn() },
        avatarScale: 1,
      }),
    );
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(
      expect.objectContaining({ inMode: false, caller: null, canSpeak: false, self: null }),
    );
    expect(result.current.bars.self).toBeNull();
    expect(result.current.bars.onWalkTo).toBeUndefined();
  });

  // docs/specs/012-collaboration/video-and-screen-bubbles.md "Who sees what" and "Share roles".
  it('tells the call the visible canvas area, snapped, and whether this session may share', () => {
    const run = (viewport?: {
      offset: { x: number; y: number };
      zoom: number;
      width: number;
      height: number;
    }) =>
      renderHook(() =>
        useCanvasCall({
          props: { ...props, canShareScreen: true },
          canvasTool: 'avatar',
          avatar: { pos: { x: 0, y: 0 }, walkTo: vi.fn() },
          avatarScale: 1,
          ...(viewport ? { viewport } : {}),
        }),
      );
    // Zoomed to 200% about the screen's middle: the middle shows canvas (1640, 320), and the area spreads half the
    // screen over the zoom either side of it (1320 to 1960 across, 145 to 495 down), each edge snapped.
    const { result } = run({ offset: { x: -1000, y: 30 }, zoom: 2, width: 1280, height: 700 });
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canShare: true,
        view: { x: 1344, y: 128, width: 640, height: 384 },
      }),
    );
    expect(result.current.bubbles.self).toMatchObject({ at: { x: 0, y: 0 }, color: '#00f' });
    // The bubbles wrap inside what is surely on screen: half a snap step in from each edge (#487).
    expect(result.current.bubbles.view).toEqual({ left: 1376, width: 576 });
    // Each edge snaps on its own (#503): the screen's right edge at 1410 holds the bubbles' at 1376, where a snapped
    // width (1472) would have put it at 1440, past the screen.
    const panned = run({ offset: { x: 30, y: 0 }, zoom: 1, width: 1440, height: 900 });
    const edge = panned.result.current.bubbles.view!;
    expect(edge).toEqual({ left: 32, width: 1344 });
    expect(edge.left + edge.width).toBeLessThanOrEqual(1410);
    // Not measured yet: no view.
    run({ offset: { x: 0, y: 0 }, zoom: 1, width: 0, height: 0 });
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(expect.objectContaining({ view: null }));
    run();
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(expect.objectContaining({ view: null }));
  });

  // video-and-screen-bubbles.md "Who sees what": the canvas zooms about the screen's middle, so at any zoom the area
  // handed to the call is the one on screen. Anchored at the top-left it left everyone right of and below a centred
  // character unreceived when zoomed in, and their bubbles were never subscribed.
  it.each([0.5, 1, 1.5, 2, 3])('centres the visible area on the screen at %s zoom', (zoom) => {
    const width = 1440;
    const height = 900;
    const me = { x: 5000, y: 3000 };
    // The view centred on your character, as walking keeps it.
    const offset = { x: width / 2 - me.x, y: height / 2 - me.y };
    renderHook(() =>
      useCanvasCall({
        props,
        canvasTool: 'avatar',
        avatar: { pos: me, walkTo: vi.fn() },
        avatarScale: 1,
        viewport: { offset, zoom, width, height },
      }),
    );
    const { view } = hook.useProximityCall.mock.lastCall![0] as {
      view: { x: number; y: number; width: number; height: number };
    };
    // Its middle is your character, within half a snap step.
    expect(Math.abs(view.x + view.width / 2 - me.x)).toBeLessThanOrEqual(32);
    expect(Math.abs(view.y + view.height / 2 - me.y)).toBeLessThanOrEqual(32);
    // And it reaches each screen edge, within half a snap step.
    expect(Math.abs(view.x - (me.x - width / zoom / 2))).toBeLessThanOrEqual(32);
    expect(Math.abs(view.x + view.width - (me.x + width / zoom / 2))).toBeLessThanOrEqual(32);
    expect(Math.abs(view.y - (me.y - height / zoom / 2))).toBeLessThanOrEqual(32);
    expect(Math.abs(view.y + view.height - (me.y + height / zoom / 2))).toBeLessThanOrEqual(32);
  });

  // docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls": every room on the tab is a call, and
  // nothing else (a rug is not).
  it('hands the call the rooms and stages, and nothing else', () => {
    const room = (id: string, x: number) => ({
      id,
      type: 'shape',
      shape: 'room',
      x,
      y: 0,
      width: 480,
      height: 320,
    });
    renderHook(() =>
      useCanvasCall({
        props: {
          ...props,
          elements: [
            room('one', 0),
            room('two', 1000),
            { id: 'rug', type: 'shape', shape: 'rug', x: 0, y: 0, width: 99, height: 99 },
            { ...room('stage', 0), shape: 'stage', x: 40, y: 40, width: 360, height: 140 },
          ],
        } as unknown as CanvasProps,
        canvasTool: 'avatar',
        avatar: { pos: { x: 0, y: 0 }, walkTo: vi.fn() },
        avatarScale: 1,
      }),
    );
    const { zones, stages } = hook.useProximityCall.mock.lastCall![0] as {
      zones: { id: string }[];
      stages: { id: string; zone: string | null }[];
    };
    expect(zones.map((z) => z.id)).toEqual(['one', 'two']);
    // And each stage with the room it stands in (the same spec's "The stage").
    expect(stages.map((s) => [s.id, s.zone])).toEqual([['stage', 'one']]);
  });

  // meeting-rooms-and-stage.md "Raise hand" and "Do Not Disturb" (part 3).
  it('lets an Editor let a hand speak and press Done, and hides others’ bars under Do Not Disturb', () => {
    const send = vi.fn();
    const { result } = renderHook(() =>
      useCanvasCall({
        props: { ...props, canShareScreen: true, onCallSignal: send },
        canvasTool: 'avatar',
        avatar: { pos: { x: 0, y: 0 }, walkTo: vi.fn() },
        avatarScale: 1,
        doNotDisturb: true,
      }),
    );
    expect(result.current.bars.hidePeers).toBe(true);
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(
      expect.objectContaining({ doNotDisturb: true }),
    );
    expect(result.current.hands.self).toEqual({ at: { x: 0, y: 0 }, scale: 1 });
    result.current.hands.onLetSpeak!('p1', true);
    expect(send).toHaveBeenLastCalledWith({ kind: 'avatar-let-speak', targetId: 'p1', on: true });
    expect(callLetByMe().has('p1')).toBe(true);
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'LetSpeak');
    result.current.hands.onLetSpeak!('p1', false);
    expect(callLetByMe().has('p1')).toBe(false);
    expect(telemetry.track).toHaveBeenCalledTimes(1);
    resetCallPeers();
  });

  it('gives a Participant off every stage no Let Speak', () => {
    const { result } = renderHook(() =>
      useCanvasCall({
        props,
        canvasTool: 'avatar',
        avatar: { pos: { x: 0, y: 0 }, walkTo: vi.fn() },
        avatarScale: 1,
      }),
    );
    expect(result.current.hands.onLetSpeak).toBeUndefined();
    expect(result.current.bars.hidePeers).toBe(false);
  });

  // video-and-screen-bubbles.md "Share roles" (#469).
  it('lets an Editor stop someone else’s share, and nobody else', () => {
    const send = vi.fn();
    const run = (extra: Partial<CanvasProps>, canvasTool: 'avatar' | 'select' = 'avatar') =>
      renderHook(() =>
        useCanvasCall({
          props: { ...props, onCallSignal: send, ...extra },
          canvasTool,
          avatar: { pos: { x: 0, y: 0 }, walkTo: vi.fn() },
          avatarScale: 1,
        }),
      ).result.current.bubbles.onStopShare;
    const stop = run({ canShareScreen: true })!;
    setCallMaximised({ id: 'p1', media: 'screen' });
    stop('p2');
    expect(callMaximised()).toEqual({ id: 'p1', media: 'screen' });
    stop('p1');
    expect(callMaximised()).toBeNull();
    expect(send).toHaveBeenLastCalledWith({ kind: 'call-stop-share', targetId: 'p1' });
    expect(telemetry.track).toHaveBeenCalledWith('Canvas', 'Used', 'StopOthersShare');
    // A Participant, a Viewer, an Editor out of the mode: none.
    expect(run({})).toBeUndefined();
    expect(run({ takePart: false })).toBeUndefined();
    expect(run({ canShareScreen: true }, 'select')).toBeUndefined();
  });

  // video-and-screen-bubbles.md "Share roles" (#504).
  it('tells you which Editor stopped your share, or that an Editor did', () => {
    renderHook(() =>
      useCanvasCall({
        props,
        canvasTool: 'avatar',
        avatar: { pos: { x: 0, y: 0 }, walkTo: vi.fn() },
        avatarScale: 1,
      }),
    );
    const { onShareStopped } = hook.useProximityCall.mock.calls.at(-1)![0] as {
      onShareStopped: (by: string) => void;
    };
    onShareStopped('p1');
    expect(toast.info).toHaveBeenLastCalledWith('Sam stopped your screen share');
    onShareStopped('gone');
    expect(toast.info).toHaveBeenLastCalledWith('An Editor stopped your screen share');
  });
});
