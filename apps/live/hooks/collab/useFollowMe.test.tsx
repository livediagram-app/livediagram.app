// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '@/lib/viewport-store';
import { useFollowMe, type RemoteViewport } from './useFollowMe';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

type Args = Parameters<typeof useFollowMe>[0];

function setup(overrides: Partial<Args> = {}) {
  const viewport = createViewportStore(1);
  const args: Args = {
    remoteViewports: new Map<string, RemoteViewport>([
      ['p1', { tabId: 'tab1', pan: { x: 10, y: 20 }, zoom: 2 }],
    ]),
    livePresenceIds: ['p1'],
    activeId: 'tab1',
    viewport,
    onFollowTab: vi.fn(),
    onNotice: vi.fn(),
    ...overrides,
  };
  const hook = renderHook((a: Args) => useFollowMe(a), { initialProps: args });
  return { hook, args, viewport };
}

// Follow-me viewport (docs/specs/012-collaboration/follow-me-viewport.md). The view is read from and
// written to the viewport store (docs/specs/008-canvas/blueprints/viewport-store.md).
describe('useFollowMe', () => {
  it("applies the followed peer's viewport, and keeps following once it lands", () => {
    const { hook, viewport } = setup();
    act(() => hook.result.current.startFollowing('p1'));
    expect(viewport.get()).toEqual({ zoom: 2, offset: { x: 10, y: 20 } });
    expect(hook.result.current.followingId).toBe('p1');
  });

  it('follows the peer as they move on', () => {
    const { hook, args, viewport } = setup();
    act(() => hook.result.current.startFollowing('p1'));
    const moved = new Map<string, RemoteViewport>([
      ['p1', { tabId: 'tab1', pan: { x: 40, y: 0 }, zoom: 3 }],
    ]);
    hook.rerender({ ...args, remoteViewports: moved });
    expect(viewport.get()).toEqual({ zoom: 3, offset: { x: 40, y: 0 } });
    expect(hook.result.current.followingId).toBe('p1');
  });

  it('ends when the user moves the canvas', () => {
    const { hook, viewport } = setup();
    act(() => hook.result.current.startFollowing('p1'));
    act(() => viewport.setOffset({ x: 11, y: 20 }));
    expect(hook.result.current.followingId).toBeNull();
  });

  it('ends when the user zooms', () => {
    const { hook, viewport } = setup();
    act(() => hook.result.current.startFollowing('p1'));
    act(() => viewport.setZoom(2.5));
    expect(hook.result.current.followingId).toBeNull();
  });

  it('ends with one notice when the followed peer leaves, and stays ended', () => {
    const { hook, args } = setup();
    act(() => hook.result.current.startFollowing('p1'));
    hook.rerender({ ...args, livePresenceIds: [] });
    expect(hook.result.current.followingId).toBeNull();
    expect(args.onNotice).toHaveBeenCalledTimes(1);
    expect(args.onNotice).toHaveBeenCalledWith(
      'The person you were following left. Your view is your own again.',
    );
    hook.rerender({ ...args, livePresenceIds: ['p1'] });
    expect(hook.result.current.followingId).toBeNull();
    expect(args.onNotice).toHaveBeenCalledTimes(1);
  });
});
