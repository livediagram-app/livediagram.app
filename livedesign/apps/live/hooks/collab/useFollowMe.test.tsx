// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { useFollowMe, type RemoteViewport } from './useFollowMe';

const peers = (entries: [string, RemoteViewport][]) =>
  createStateStore(new Map<string, RemoteViewport>(entries));

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

type Args = Parameters<typeof useFollowMe>[0];

function setup(overrides: Partial<Args> = {}) {
  const viewport = createViewportStore(1);
  const args: Args = {
    remoteViewports: peers([
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
    const moved = peers([
      ['p1', { tabId: 'tab1', pan: { x: 40, y: 0 }, zoom: 3 }],
    ]);
    act(() => (args.remoteViewports as ReturnType<typeof peers>).set(moved.get()));
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

  // docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"
  it('refuses to follow someone who follows you, saying why', () => {
    const { hook, args } = setup({ followerIds: ['p1'], nameOf: () => 'Alex' });
    act(() => hook.result.current.startFollowing('p1'));
    expect(hook.result.current.followingId).toBeNull();
    expect(args.onNotice).toHaveBeenCalledWith(
      "Alex is following you, so you can't follow them back.",
    );
  });

  it('ends a follow when the person followed turns out to follow you (both pressed at once)', () => {
    const { hook, args } = setup({ nameOf: () => 'Alex' });
    act(() => hook.result.current.startFollowing('p1'));
    expect(hook.result.current.followingId).toBe('p1');
    hook.rerender({ ...args, followerIds: ['p1'], nameOf: () => 'Alex' });
    expect(hook.result.current.followingId).toBeNull();
    expect(args.onNotice).toHaveBeenCalledTimes(1);
    expect(args.onNotice).toHaveBeenCalledWith(
      "Alex is following you, so you can't follow them back.",
    );
  });

  it('tells the room who it follows, and when it stops', () => {
    const sendFollow = vi.fn();
    const { hook } = setup({ sendFollow });
    expect(sendFollow).not.toHaveBeenCalled();
    act(() => hook.result.current.startFollowing('p1'));
    expect(sendFollow).toHaveBeenLastCalledWith('p1');
    act(() => hook.result.current.stopFollowing());
    expect(sendFollow).toHaveBeenLastCalledWith(null);
    expect(sendFollow).toHaveBeenCalledTimes(2);
  });

  // docs/specs/008-canvas/canvas-performance.md: every peer who pans sends ten viewports a second. Before, each one was
  // editor state and rendered the whole editor; now a pan by someone not followed renders nothing, and the followed
  // peer's renders only the follow.
  it("renders for the followed peer's viewport alone, never for another peer's", () => {
    const store = peers([
      ['p1', { tabId: 'tab1', pan: { x: 10, y: 20 }, zoom: 2 }],
      ['p2', { tabId: 'tab1', pan: { x: 0, y: 0 }, zoom: 1 }],
    ]);
    let renders = 0;
    const viewport = createViewportStore(1);
    const hook = renderHook(() => {
      renders++;
      return useFollowMe({
        remoteViewports: store,
        livePresenceIds: ['p1', 'p2'],
        activeId: 'tab1',
        viewport,
        onFollowTab: vi.fn(),
        onNotice: vi.fn(),
      });
    });
    const panP2 = (x: number) =>
      store.set((prev) => new Map(prev).set('p2', { tabId: 'tab1', pan: { x, y: 0 }, zoom: 1 }));
    const before = renders;
    act(() => {
      for (let x = 1; x <= 100; x++) panP2(x);
    });
    // Not following anyone: a hundred viewports from p2, no render.
    expect(renders).toBe(before);
    act(() => hook.result.current.startFollowing('p1'));
    const following = renders;
    for (let x = 1; x <= 100; x++) act(() => panP2(x));
    // Following p1: p2's hundred still render nothing.
    expect(renders).toBe(following);
    act(() =>
      store.set((prev) => new Map(prev).set('p1', { tabId: 'tab1', pan: { x: 50, y: 0 }, zoom: 2 })),
    );
    expect(renders).toBe(following + 1);
    expect(viewport.get()).toEqual({ zoom: 2, offset: { x: 50, y: 0 } });
  });
});
