// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasCall } from './useCanvasCall';

const hook = vi.hoisted(() => ({ useProximityCall: vi.fn() }));
vi.mock('@/lib/calls/useProximityCall', () => ({ DO_NOT_DISTURB: false, ...hook }));
const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);

const props = {
  remoteAvatars: [
    { id: 'p1', name: 'Sam', color: '#f00', glideMs: 33, avatar: { x: 500, y: 0, config: {} } },
  ],
  imageContext: { ownerId: 'o', documentId: 'd', shareCode: 'sc' },
  takePart: true,
  onCallSignal: vi.fn(),
  activeTabId: 't1',
  selfParticipant: { color: '#00f' },
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
    const { result } = run({ offset: { x: -1000, y: 30 }, zoom: 2, width: 1280, height: 700 });
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canShare: true,
        view: { x: 1024, y: 0, width: 640, height: 320 },
      }),
    );
    expect(result.current.bubbles.self).toMatchObject({ at: { x: 0, y: 0 }, color: '#00f' });
    // Not measured yet: no view.
    run({ offset: { x: 0, y: 0 }, zoom: 1, width: 0, height: 0 });
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(expect.objectContaining({ view: null }));
    run();
    expect(hook.useProximityCall).toHaveBeenLastCalledWith(expect.objectContaining({ view: null }));
  });
});
