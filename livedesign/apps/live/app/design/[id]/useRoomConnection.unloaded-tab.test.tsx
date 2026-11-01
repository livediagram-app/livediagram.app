// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RoomHandlers } from '@/lib/api-client';

// A peer's element op for a tab this editor has not fetched yet (docs/specs/006-design/per-tab-storage.md):
// left to that fetch, so the placeholder never looks edited, its fetch is never thrown away, and the next
// save never writes the placeholder over the real tab. A peer's whole tab is content: loaded.

const { room } = vi.hoisted(() => ({ room: { handlers: null as RoomHandlers | null } }));
vi.mock('@/lib/api-client', () => ({
  apiCreateRoomTicket: vi.fn(async () => null),
  connectRoom: vi.fn((_doc: string, _self: unknown, handlers: RoomHandlers) => {
    room.handlers = handlers;
    return { send: vi.fn(), close: vi.fn() };
  }),
}));

const { useRoomConnection } = await import('./useRoomConnection');

async function mount() {
  room.handlers = null;
  const fn = new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (t, k: string) => (t[k] ??= vi.fn()),
  });
  const applyRemoteOp = vi.fn();
  const markTabLoaded = vi.fn();
  const self = { id: 'user_1', name: 'Me', color: '#0ea5e9', status: 'online' as const };
  renderHook(() =>
    useRoomConnection({
      ...(fn as unknown as Parameters<typeof useRoomConnection>[0]),
      hydrated: true,
      designId: 'doc-1',
      designServerStored: true,
      enabled: true,
      designTeamId: null,
      selfParticipant: self,
      sessionShareCode: null,
      lastSeenRef: { current: new Map() },
      selfParticipantRef: { current: self },
      saveBaseline: {
        tabs: { current: [] },
        name: { current: '' },
        journal: { current: { entries: [] } as never },
      },
      sessionShareCodeRef: { current: null },
      roomRef: { current: null },
      applyRemoteOp,
      markSeen: vi.fn(),
      countAppliedOp: vi.fn(),
      setDesignName: vi.fn(),
      loadedTabIdsRef: { current: new Set(['loaded']) },
      markTabLoaded,
      receiveComponent: fn.receiveComponent as unknown as (op: unknown) => void,
    }),
  );
  await waitFor(() => expect(room.handlers).not.toBeNull());
  return { applyRemoteOp, markTabLoaded, fn };
}

const add = (tabId: string) =>
  ({
    kind: 'el',
    tabId,
    op: { kind: 'add', element: { id: 'e', type: 'sticky', x: 0, y: 0, width: 10, height: 10 } },
  }) as never;

describe('useRoomConnection and tabs not fetched yet', () => {
  it('leaves an element op for an unfetched tab to its fetch, applying one for a loaded tab', async () => {
    const { applyRemoteOp } = await mount();
    room.handlers!.onOp('peer', add('placeholder'));
    expect(applyRemoteOp).not.toHaveBeenCalled();
    room.handlers!.onOp('peer', add('loaded'));
    expect(applyRemoteOp).toHaveBeenCalledOnce();
  });

  it("marks a peer's whole tab loaded", async () => {
    const { markTabLoaded } = await mount();
    room.handlers!.onOp('peer', {
      kind: 'tab',
      tabId: 'new',
      tab: { id: 'new', name: 'New', elements: [] },
    } as never);
    expect(markTabLoaded).toHaveBeenCalledWith('new');
  });
});

// A main stored in the library (docs/specs/009-elements/components.md "Sharing, collaboration and storage"): taken
// from the worker only, never from a peer's socket.
describe('useRoomConnection and the component library', () => {
  it("hands the worker's component op to the library and ignores a peer's", async () => {
    const { fn } = await mount();
    const op = {
      kind: 'component',
      component: { id: 'c', name: 'C', width: 1, height: 1, elements: [], updatedAt: 1 },
      tabIds: [],
    } as never;
    room.handlers!.onOp('peer', op);
    expect(fn.receiveComponent).not.toHaveBeenCalled();
    room.handlers!.onOp('system', op);
    expect(fn.receiveComponent).toHaveBeenCalledWith(op);
  });
});
