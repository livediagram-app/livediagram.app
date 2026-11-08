// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR_CONFIG } from '@liveworkspace/avatar/config';
import { useAvatarWalk } from '@liveworkspace/avatar/hooks/useAvatarWalk';
import { useCanvasSurfaceGestures } from './useCanvasSurfaceGestures';

// docs/specs/009-elements/chair.md "Any movement stands you up": a finger's tap on the canvas while seated stands you
// up and walks there, in one gesture. The tap reaches the walk through the pan the press starts (its onTap), so the
// gesture hook and the real walk are wired together here: the test fails if anything between the tap and the walk
// stops a seated tap standing you up.

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// A chair at the canvas's top left, the floor open round it.
const chair = { id: 'chair', type: 'shape', shape: 'chair', x: 20, y: 20, width: 64, height: 72 };
const floor = { id: 'floor', type: 'shape', shape: 'rug', x: 0, y: 0, width: 400, height: 800 };

function seatedSetup() {
  const setPan = vi.fn();
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 400, bottom: 800, x: 0, y: 0, width: 400, height: 800 }) as DOMRect;
  const elements = [floor, chair];
  const { result } = renderHook(() => {
    const avatar = useAvatarWalk({
      active: true,
      config: DEFAULT_AVATAR_CONFIG,
      onToggleGender: vi.fn(),
      elements,
      mainRef: { current: null },
      wrapperRef: { current: null },
      readViewportOffset: () => ({ x: 0, y: 0 }),
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
    });
    const gestures = useCanvasSurfaceGestures({
      canvasTool: 'avatar',
      middleMousePan: true,
      pendingDraw: null,
      readViewportOffset: () => ({ x: 0, y: 0 }),
      viewportZoom: 1,
      mainRef: { current: null },
      wrapperRef: { current: wrapper },
      spaceHeldRef: { current: false },
      setPan,
      setMarquee: vi.fn(),
      spotlight: {},
      avatar,
      readPeerAvatars: () => [],
      onPushPeer: vi.fn(),
      elements,
      isoCamera: {},
      beginPendingDrawGesture: () => false,
      onDeselect: vi.fn(),
      onCanvasDoubleClick: vi.fn(),
    } as never);
    return { avatar, gestures };
  });
  act(() => result.current.avatar.teleportTo({ x: 52, y: 64 }));
  act(() => result.current.avatar.sitOn('chair', { x: 52, y: 64 }, 'down'));
  // A finger pressed on open floor well clear of the chair, at (200, 500) on the canvas.
  const press = () =>
    result.current.gestures.onPointerDownCapture({
      target: document.createElement('div'),
      button: 0,
      detail: 1,
      clientX: 200,
      clientY: 500,
      pointerType: 'touch',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as ReactPointerEvent);
  return { result, press, setPan };
}

describe('a tap while seated', () => {
  it('stands you up and walks you to the tapped spot', () => {
    const { result, press, setPan } = seatedSetup();
    expect(result.current.avatar.seatedOn).toBe('chair');
    act(() => press());
    // A finger's press pans until it turns out a tap: nothing has moved yet.
    expect(result.current.avatar.seatedOn).toBe('chair');
    const pan = setPan.mock.calls[0]?.[0] as { onTap?: () => void } | undefined;
    expect(pan?.onTap).toBeTypeOf('function');
    act(() => pan?.onTap?.());
    expect(result.current.avatar.seatedOn).toBeNull();
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(result.current.avatar.readPos()!.x).toBeCloseTo(200, 0);
    expect(result.current.avatar.readPos()!.y).toBeCloseTo(500, 0);
  });

  it('keeps you seated when the finger drags instead (a pan, not a tap)', () => {
    const { result, press, setPan } = seatedSetup();
    act(() => press());
    expect(setPan).toHaveBeenCalledTimes(1);
    // The pan never calls onTap: no walk, so no standing up.
    expect(result.current.avatar.seatedOn).toBe('chair');
  });
});
