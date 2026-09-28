// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useFollowMe, type RemoteViewport } from './useFollowMe';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

type Args = Parameters<typeof useFollowMe>[0];

function setup(overrides: Partial<Args> = {}) {
  const args: Args = {
    remoteViewports: new Map<string, RemoteViewport>([
      ['p1', { tabId: 'tab1', pan: { x: 10, y: 20 }, zoom: 2 }],
    ]),
    livePresenceIds: ['p1'],
    activeId: 'tab1',
    viewportOffset: { x: 0, y: 0 },
    viewportZoom: 1,
    setViewportOffset: vi.fn(),
    setZoom: vi.fn(),
    onFollowTab: vi.fn(),
    onNotice: vi.fn(),
    ...overrides,
  };
  const hook = renderHook((a: Args) => useFollowMe(a), { initialProps: args });
  return { hook, args };
}

// Follow-me viewport (docs/specs/012-collaboration/follow-me-viewport.md).
describe('useFollowMe', () => {
  it("applies the followed peer's viewport", () => {
    const { hook, args } = setup();
    act(() => hook.result.current.startFollowing('p1'));
    expect(hook.result.current.followingId).toBe('p1');
    expect(args.setViewportOffset).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(args.setZoom).toHaveBeenCalledWith(2);
  });

  it("keeps following once its own apply lands in the viewport, when the peer's view is known up front", () => {
    const viewports = new Map<string, RemoteViewport>([
      ['p1', { tabId: 'tab1', pan: { x: 10, y: 20 }, zoom: 2 }],
    ]);
    const present = ['p1'];
    const { result } = renderHook(() => {
      const [pan, setPan] = useState({ x: 0, y: 0 });
      const [zoom, setZoom] = useState(1);
      const follow = useFollowMe({
        remoteViewports: viewports,
        livePresenceIds: present,
        activeId: 'tab1',
        viewportOffset: pan,
        viewportZoom: zoom,
        setViewportOffset: setPan,
        setZoom,
        onFollowTab: () => {},
        onNotice: () => {},
      });
      return { follow, pan, zoom };
    });
    act(() => result.current.follow.startFollowing('p1'));
    expect(result.current.pan).toEqual({ x: 10, y: 20 });
    expect(result.current.zoom).toBe(2);
    expect(result.current.follow.followingId).toBe('p1');
  });

  it('ends when the user moves the canvas', () => {
    const { hook, args } = setup();
    act(() => hook.result.current.startFollowing('p1'));
    hook.rerender({ ...args, viewportOffset: { x: 10, y: 20 }, viewportZoom: 2 });
    expect(hook.result.current.followingId).toBe('p1');
    hook.rerender({ ...args, viewportOffset: { x: 11, y: 20 }, viewportZoom: 2 });
    expect(hook.result.current.followingId).toBeNull();
  });

  it('ends with one notice when the followed peer leaves, and stays ended', () => {
    const { hook, args } = setup();
    act(() => hook.result.current.startFollowing('p1'));
    const synced = { ...args, viewportOffset: { x: 10, y: 20 }, viewportZoom: 2 };
    hook.rerender({ ...synced, livePresenceIds: [] });
    expect(hook.result.current.followingId).toBeNull();
    expect(args.onNotice).toHaveBeenCalledTimes(1);
    expect(args.onNotice).toHaveBeenCalledWith(
      'The person you were following left. Your view is your own again.',
    );
    hook.rerender({ ...synced, livePresenceIds: ['p1'] });
    expect(hook.result.current.followingId).toBeNull();
    expect(args.onNotice).toHaveBeenCalledTimes(1);
  });
});
